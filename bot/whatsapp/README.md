# Bot WhatsApp Kiosq — Guide de déploiement

Bot WhatsApp de gestion de commandes pour Kiosq. Service Node.js autonome (non serverless) qui maintient un état en mémoire et utilise un poller pour synchroniser les statuts de commandes.

---

## Table des matières

1. [Prérequis](#prérequis)
2. [Développement local](#développement-local)
3. [Variables d'environnement](#variables-denvironnement)
4. [Docker — build et exécution](#docker--build-et-exécution)
5. [Déploiement sur Railway](#déploiement-sur-railway)
6. [Déploiement sur Render](#déploiement-sur-render)
7. [Configuration du webhook WhatsApp](#configuration-du-webhook-whatsapp)
8. [Génération et rotation du BOT_JWT](#génération-et-rotation-du-bot_jwt)
9. [Endpoints API](#endpoints-api)
10. [Dépannage](#dépannage)

---

## Prérequis

| Outil | Version minimale | Obligatoire |
|---|---|---|
| Node.js | 22 (LTS) | Oui |
| npm | 10+ | Oui |
| Docker | 24+ | Non (uniquement pour le déploiement conteneurisé) |

Vérifier les versions installées :

```bash
node --version   # doit afficher v22.x.x ou supérieur
npm --version
docker --version # optionnel
```

---

## Développement local

### 1. Copier le fichier d'exemple et renseigner les variables

```bash
# Depuis la racine du dépôt
cp bot/whatsapp/.env.example bot/.env
```

Ouvrir `bot/.env` et renseigner toutes les variables marquées comme requises (voir [tableau ci-dessous](#variables-denvironnement)).

### 2. Installer les dépendances

```bash
cd bot
npm install
```

### 3. Démarrer le bot

```bash
# Depuis le répertoire bot/
npm run start:whatsapp
```

Le bot démarre et affiche dans le terminal :

```
[main] Démarrage du bot WhatsApp…
[server] Listening on port 3002
[main] Poller démarré (intervalle 60s)
```

Le bot est maintenant accessible sur `http://localhost:3002`.

---

## Variables d'environnement

Toutes les variables sont lues depuis l'environnement du processus. En développement local, créer un fichier `bot/.env` à partir de `bot/whatsapp/.env.example`. En production, injecter directement via la plateforme (ne jamais committer de secrets).

| Variable | Obligatoire | Défaut | Description | Exemple de valeur |
|---|---|---|---|---|
| `WHATSAPP_TOKEN` | Oui | — | Bearer token d'accès à l'API WhatsApp Cloud (Meta). Obtenir dans Meta Developer Portal → App → WhatsApp → API Setup → Access Token | `EAABsBCS...` |
| `WHATSAPP_PHONE_NUMBER_ID` | Oui | — | Identifiant numérique du numéro WhatsApp Business. Obtenir dans Meta Developer Portal → App → WhatsApp → API Setup → Phone Number ID | `123456789012345` |
| `WHATSAPP_APP_SECRET` | Oui | — | Secret de l'application Meta, utilisé pour valider la signature HMAC-SHA256 des webhooks entrants. Obtenir dans Meta Developer Portal → App → Paramètres de base → App Secret | `a1b2c3d4e5f6...` |
| `WHATSAPP_VERIFY_TOKEN` | Oui | — | Chaîne aléatoire choisie librement, utilisée lors de la vérification initiale du webhook par Meta. Générer avec `openssl rand -hex 20` | `3f8a2c1d9e7b...` |
| `BOT_JWT` | Oui | — | Token JWT signé pour l'authentification du bot auprès de l'API Kiosq. Générer avec `npm run generate-jwt` depuis `bot/` | `eyJhbGciOiJIUzI1...` |
| `KIOSQ_API_URL` | Oui | — | URL de base de l'API Kiosq, sans slash final. En local : `http://localhost:3000` | `https://kiosq.vercel.app` |
| `GEMINI_API_KEY` | Oui | — | Clé API Google Gemini pour le module NLU. Obtenir sur https://aistudio.google.com/app/apikey | `AIzaSyB...` |
| `WHATSAPP_BOT_PORT` | Non | `3002` | Port TCP sur lequel le serveur HTTP du bot écoute | `3002` |
| `NLU_SCORE_SEUIL` | Non | `0.6` | Score de confiance minimum (0–1) en dessous duquel le bot demande une reformulation | `0.6` |

---

## Docker — build et exécution

### Build de l'image

Le contexte de build Docker est le répertoire `bot/`. La commande doit être exécutée depuis `bot/`.

```bash
# Depuis le répertoire bot/
docker build -f whatsapp/Dockerfile -t kiosq-whatsapp-bot .
```

Le build s'effectue en deux étapes (multi-stage) :
- **Stage builder** : installe toutes les dépendances et compile le TypeScript
- **Stage runtime** : copie uniquement les fichiers compilés et les dépendances de production

### Exécution du conteneur

**Option 1 — avec un fichier `.env`** (développement ou test local) :

```bash
docker run --rm \
  --env-file bot/.env \
  -p 3002:3002 \
  kiosq-whatsapp-bot
```

**Option 2 — avec des variables `-e` individuelles** (recommandé en production) :

```bash
docker run --rm \
  -e WHATSAPP_TOKEN=EAABsBCS... \
  -e WHATSAPP_PHONE_NUMBER_ID=123456789012345 \
  -e WHATSAPP_APP_SECRET=a1b2c3... \
  -e WHATSAPP_VERIFY_TOKEN=3f8a2c... \
  -e BOT_JWT=eyJhbGci... \
  -e KIOSQ_API_URL=https://kiosq.vercel.app \
  -e GEMINI_API_KEY=AIzaSyB... \
  -p 3002:3002 \
  kiosq-whatsapp-bot
```

Vérifier que le conteneur est sain :

```bash
docker ps  # la colonne STATUS doit afficher "healthy" après ~90s
curl http://localhost:3002/health
# {"status":"ok"}
```

---

## Déploiement sur Railway

[Railway](https://railway.app) supporte les déploiements Docker directement depuis GitHub.

### Étapes

1. Créer un nouveau service dans votre projet Railway → **"Deploy from GitHub repo"**
2. Sélectionner le dépôt et configurer :

| Paramètre | Valeur |
|---|---|
| **Root directory** | `bot` |
| **Dockerfile path** | `whatsapp/Dockerfile` |
| **Start command** | _(laisser vide — CMD du Dockerfile est utilisé)_ |
| **Health check path** | `/health` |
| **Port** | `3002` |

3. Dans l'onglet **Variables**, ajouter toutes les variables d'environnement requises (voir tableau ci-dessus). Ne pas utiliser de fichier `.env` — saisir chaque variable individuellement.

4. Déclencher un déploiement. Railway construira l'image, vérifiera `/health` et passera le service en état `active` une fois le health check validé.

> **Note** : Railway envoie SIGTERM avant d'arrêter un conteneur lors d'un redéploiement. Le bot gère ce signal proprement (graceful shutdown en moins de 10 secondes).

---

## Déploiement sur Render

[Render](https://render.com) permet de déployer des services Docker ou Node.js.

### Via Docker (recommandé)

1. Créer un nouveau service → **"Web Service"** → **"Deploy an existing image or use a Dockerfile"**
2. Configurer :

| Paramètre | Valeur |
|---|---|
| **Service type** | Web Service |
| **Root directory** | `bot` |
| **Dockerfile path** | `./whatsapp/Dockerfile` |
| **Build command** | _(géré par le Dockerfile)_ |
| **Start command** | _(géré par le Dockerfile — `node dist/whatsapp/index.js`)_ |
| **Health check path** | `/health` |
| **Port** | `3002` |

3. Dans l'onglet **Environment**, ajouter toutes les variables requises. Render injecte ces variables dans l'environnement du processus au démarrage.

4. Render envoie SIGTERM lors des déploiements successifs. Le bot drainera les connexions actives et se terminera proprement.

### Via Node.js natif (alternative sans Docker)

| Paramètre | Valeur |
|---|---|
| **Environment** | Node |
| **Build command** | `npm install && npm run build:whatsapp` |
| **Start command** | `node dist/whatsapp/index.js` |
| **Health check path** | `/health` |

---

## Configuration du webhook WhatsApp

Le bot reçoit les messages des utilisateurs via un webhook HTTP. Meta envoie les événements WhatsApp à l'URL publique du bot.

### Étapes dans le Meta Developer Portal

1. Aller sur [developers.facebook.com](https://developers.facebook.com) et sélectionner votre application
2. Dans le menu de gauche : **WhatsApp → Configuration**
3. Dans la section **Webhooks**, cliquer sur **"Modifier"**
4. Renseigner les champs :

| Champ | Valeur |
|---|---|
| **URL de rappel (Callback URL)** | `https://<HOST>/webhook` |
| **Jeton de vérification (Verify Token)** | La valeur de `WHATSAPP_VERIFY_TOKEN` configurée dans l'environnement du bot |

5. Cliquer sur **"Vérifier et enregistrer"** — Meta appellera `GET /webhook` avec le verify token pour valider l'endpoint
6. Dans les **Champs webhook**, s'abonner à `messages`

> **Important** : l'URL doit être accessible publiquement en HTTPS. En développement local, utiliser [ngrok](https://ngrok.com) : `ngrok http 3002`, puis utiliser l'URL HTTPS fournie.

### Format de l'URL webhook

```
https://<HOST>/webhook
```

Exemples :
- Railway : `https://kiosq-bot-production.up.railway.app/webhook`
- Render : `https://kiosq-whatsapp-bot.onrender.com/webhook`
- ngrok (dev) : `https://abc123.ngrok.io/webhook`

---

## Génération et rotation du BOT_JWT

Le `BOT_JWT` est un token JWT signé utilisé par le bot pour s'authentifier auprès de l'API Kiosq. Il a une durée de validité limitée et doit être renouvelé avant expiration.

### Générer un nouveau token

```bash
# Depuis le répertoire bot/
npm run generate-jwt
```

La commande affiche le token généré dans le terminal :

```
BOT_JWT=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Durée de validité

La durée de validité est configurée dans le script `generate-jwt` (typiquement plusieurs mois). Vérifier la date d'expiration avec :

```bash
# Décoder le payload du token (sans vérification de signature)
echo "<TOKEN>" | cut -d'.' -f2 | base64 -d 2>/dev/null | python3 -m json.tool
# Chercher le champ "exp" (timestamp Unix)
```

### Renouveler et redéployer

1. Exécuter `npm run generate-jwt` depuis `bot/`
2. Copier le nouveau token
3. Mettre à jour la variable `BOT_JWT` dans la plateforme (Railway → Variables, Render → Environment)
4. Déclencher un redéploiement du service

> **Attention** : un token expiré provoquera des erreurs 401 sur toutes les requêtes à l'API Kiosq. Le bot continuera à recevoir les messages WhatsApp mais ne pourra plus lire ni écrire de données. Surveiller les logs du service pour détecter les erreurs d'authentification.

---

## Endpoints API

Le bot expose trois endpoints HTTP sur le port configuré (défaut : `3002`).

### `GET /health`

Health check du service. Retourne toujours `200 OK` si le processus Node.js est en vie, indépendamment de l'état des connexions externes (API Kiosq, WhatsApp).

**Réponse :**
```json
{ "status": "ok" }
```

**En-têtes :**
```
Content-Type: application/json
```

### `GET /webhook`

Endpoint de vérification du webhook WhatsApp. Appelé par Meta lors de la configuration initiale ou lors de chaque tentative de (re)vérification.

**Paramètres de requête attendus (envoyés par Meta) :**
- `hub.mode` — doit valoir `subscribe`
- `hub.verify_token` — doit correspondre à `WHATSAPP_VERIFY_TOKEN`
- `hub.challenge` — valeur à retourner telle quelle en cas de succès

### `POST /webhook`

Réception des événements WhatsApp (messages entrants, mises à jour de statut, etc.). Meta signe chaque requête avec un header `x-hub-signature-256` ; le bot valide cette signature via `WHATSAPP_APP_SECRET` avant de traiter le payload.

---

## Dépannage

### Le bot ne démarre pas — variables d'environnement manquantes

**Symptôme** : le processus s'arrête immédiatement avec exit code 1 et des messages comme :
```
[env] Variable manquante : WHATSAPP_TOKEN
[env] Variable manquante : BOT_JWT
[main] Variables d'environnement manquantes — arrêt
```

**Solution** : vérifier que toutes les variables requises sont définies dans l'environnement. En local, s'assurer que `bot/.env` existe et contient les bonnes valeurs. En production, vérifier la section des variables de la plateforme.

### Conflit de port

**Symptôme** : `Error: listen EADDRINUSE :::3002`

**Solution** : soit arrêter le processus qui utilise le port 3002, soit changer le port via la variable `WHATSAPP_BOT_PORT` :

```bash
WHATSAPP_BOT_PORT=3003 npm run start:whatsapp
```

Penser à mettre à jour l'URL du health check et le port exposé si Docker est utilisé.

### SIGTERM non géré — conteneur tué brutalement

**Symptôme** : lors d'un redéploiement, des messages WhatsApp en cours de traitement sont perdus ; la plateforme affiche un exit code 137 (SIGKILL).

**Cause** : le processus ne répondait pas au SIGTERM dans le délai imparti (10 secondes) et a été tué de force.

**Solution** : vérifier que la version déployée inclut les handlers de signal dans `bot/whatsapp/index.ts`. Les logs de shutdown attendus sont :
```
[main] Arrêt en cours (SIGTERM)…
[main] Poller arrêté
[main] Serveur HTTP fermé — exit 0
```
Si ces lignes n'apparaissent pas, l'image Docker est peut-être ancienne — reconstruire avec `docker build`.

### Erreurs 401 sur les appels à l'API Kiosq

**Symptôme** : le bot reçoit les messages WhatsApp mais répond systématiquement par une erreur ; les logs montrent des réponses 401.

**Cause** : le `BOT_JWT` est expiré ou invalide.

**Solution** : générer un nouveau JWT et redéployer (voir [Génération et rotation du BOT_JWT](#génération-et-rotation-du-bot_jwt)).

### Le webhook Meta retourne une erreur de vérification

**Symptôme** : lors de la configuration du webhook dans le Meta Developer Portal, Meta retourne `"Échec de la validation du token de vérification"`.

**Causes possibles** :
1. `WHATSAPP_VERIFY_TOKEN` dans l'environnement du bot ne correspond pas au token saisi dans le portail Meta
2. L'URL du webhook n'est pas accessible publiquement (vérifier avec `curl https://<HOST>/webhook?hub.mode=subscribe&hub.verify_token=<TOKEN>&hub.challenge=test`)
3. Le bot n'est pas encore démarré ou le health check n'est pas encore vert

### Le conteneur Docker reste en état `starting` indéfiniment

**Symptôme** : `docker ps` affiche `(health: starting)` pendant plus de 90 secondes.

**Solution** : vérifier les logs du conteneur :
```bash
docker logs <container_id>
```
Le plus souvent, le bot a planté au démarrage à cause de variables manquantes (voir premier cas de dépannage ci-dessus).
