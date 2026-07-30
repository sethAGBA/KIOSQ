# Document de Requirements — WhatsApp Bot Deployment

## Introduction

Le bot WhatsApp de gestion de commandes (`bot/whatsapp/`) est un service Node.js autonome déjà fonctionnel. Il ne peut pas tourner sur Vercel (plateforme serverless) car il utilise `setInterval` pour le polling des statuts de commandes et maintient un état en mémoire entre les requêtes. Cette feature spécifie tout ce qui est nécessaire pour rendre ce service déployable, maintenable et opérationnel sur n'importe quelle plateforme d'hébergement de conteneurs ou de processus persistants (Railway, Render, Fly.io, VPS, etc.) sans vendor lock-in.

## Glossaire

- **Bot** : le service Node.js situé dans `bot/whatsapp/`, point d'entrée `bot/whatsapp/index.ts`
- **Dockerfile** : fichier de configuration Docker qui décrit comment construire l'image conteneur du Bot
- **Health_Check** : endpoint HTTP `GET /health` du Bot qui retourne `{ "status": "ok" }` avec HTTP 200
- **Graceful_Shutdown** : procédure d'arrêt propre du Bot sur réception d'un signal SIGTERM ou SIGINT, permettant de finir les requêtes en cours avant de fermer le serveur
- **Env_File** : fichier `.env.example` dans `bot/whatsapp/` listant toutes les variables d'environnement requises et optionnelles avec leurs descriptions
- **Start_Script** : script `start:whatsapp` dans `bot/package.json` permettant de démarrer le Bot depuis la racine du répertoire `bot/`
- **Build_Script** : script `build:whatsapp` dans `bot/package.json` permettant de compiler le TypeScript du Bot en JavaScript pour la production
- **Deployment_Guide** : fichier README dans `bot/whatsapp/` documentant le déploiement du Bot de façon agnostique à la plateforme
- **Platform** : toute plateforme d'hébergement supportant Docker ou Node.js (Railway, Render, Fly.io, VPS avec Docker)
- **SIGTERM** : signal Unix envoyé par les orchestrateurs de conteneurs (Docker, Kubernetes) pour demander l'arrêt d'un processus
- **SIGINT** : signal Unix envoyé lors d'un `Ctrl+C` en terminal
- **Poller** : le `setInterval` dans `bot/whatsapp/index.ts` qui appelle `pollCommandeStatuts` toutes les 60 secondes
- **BOT_JWT** : token JWT utilisé par le Bot pour s'authentifier auprès de l'API Kiosq, actuellement hardcodé dans `bot/.env`
- **tsx** : outil d'exécution TypeScript sans compilation préalable, utilisé en développement et optionnellement en production

---

## Requirements

### Requirement 1 : Script de démarrage dans bot/package.json

**User Story :** En tant que développeur ou opérateur, je veux pouvoir démarrer le bot WhatsApp avec une commande npm depuis `bot/`, afin de ne pas avoir à mémoriser le chemin complet vers `bot/whatsapp/index.ts`.

#### Acceptance Criteria

1. THE `bot/package.json` SHALL contenir un script `start:whatsapp` qui exécute `bot/whatsapp/index.ts` via `tsx`
2. THE `bot/package.json` SHALL contenir un script `build:whatsapp` qui compile `bot/whatsapp/` en JavaScript via `tsc` vers un répertoire `dist/whatsapp/`
3. WHEN le script `start:whatsapp` est exécuté depuis le répertoire `bot/`, THE Bot SHALL démarrer et loguer `[server] Listening on port <PORT>` sur stdout
4. WHEN le script `build:whatsapp` est exécuté, THE Build_Script SHALL produire des fichiers JavaScript dans `bot/dist/whatsapp/` sans erreur de compilation TypeScript

---

### Requirement 2 : Fichier de variables d'environnement bot/whatsapp/.env.example

**User Story :** En tant que développeur ou opérateur déployant le bot, je veux un fichier `.env.example` complet avec toutes les variables nécessaires documentées, afin de configurer l'environnement sans avoir à fouiller dans le code source.

#### Acceptance Criteria

1. THE Env_File SHALL exister à l'emplacement `bot/whatsapp/.env.example`
2. THE Env_File SHALL lister toutes les variables requises : `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`, `BOT_JWT`, `KIOSQ_API_URL`, `GEMINI_API_KEY`
3. THE Env_File SHALL lister les variables optionnelles avec leur valeur par défaut : `WHATSAPP_BOT_PORT` (défaut : `3002`), `NLU_SCORE_SEUIL` (défaut : `0.6`)
4. WHEN une variable est requise, THE Env_File SHALL inclure un commentaire expliquant son rôle et comment l'obtenir ou la générer
5. THE Env_File SHALL NE PAS contenir de valeurs réelles de secrets (tokens, clés API, JWT) — toutes les valeurs doivent être des placeholders descriptifs (ex: `your-whatsapp-bearer-token`)
6. THE Env_File SHALL mentionner que `BOT_JWT` doit être généré via `npm run generate-jwt` depuis le répertoire `bot/`

---

### Requirement 3 : Dockerfile pour bot/whatsapp/

**User Story :** En tant qu'opérateur déployant le bot sur une Platform supportant Docker, je veux un Dockerfile qui containerise le bot correctement, afin de pouvoir construire et lancer une image reproductible sans configuration manuelle.

#### Acceptance Criteria

1. THE Dockerfile SHALL exister à l'emplacement `bot/whatsapp/Dockerfile`
2. THE Dockerfile SHALL utiliser une image de base officielle Node.js LTS (version 22 ou supérieure) en variante `slim` ou `alpine`
3. THE Dockerfile SHALL compiler le TypeScript via `npm run build:whatsapp` au moment du build de l'image
4. THE Dockerfile SHALL démarrer le Bot depuis les fichiers JavaScript compilés (pas `tsx`) en production via `node dist/whatsapp/index.js`
5. THE Dockerfile SHALL exposer le port défini par `WHATSAPP_BOT_PORT` (par défaut 3002) via l'instruction `EXPOSE`
6. THE Dockerfile SHALL configurer un `HEALTHCHECK` qui appelle `GET /health` avec un intervalle de 30 secondes, un timeout de 10 secondes et 3 tentatives avant de marquer le conteneur comme `unhealthy`
7. THE Dockerfile SHALL exécuter le processus en tant qu'utilisateur non-root (instruction `USER node` ou équivalent)
8. IF le Dockerfile est construit sans les variables d'environnement requises, THEN THE Bot SHALL démarrer mais `validateWhatsappEnv()` SHALL terminer le processus avec exit code 1 et loguer les noms des variables manquantes
9. THE Dockerfile SHALL copier uniquement les fichiers nécessaires à la production (pas les fichiers `*.test.ts`, `*.property.test.ts`, ni `node_modules` locaux)

---

### Requirement 4 : Health Check compatible avec les plateformes d'hébergement

**User Story :** En tant qu'opérateur, je veux que le health check du bot soit fiable et compatible avec les standards des plateformes d'hébergement, afin que la Platform détecte correctement si le bot est opérationnel.

#### Acceptance Criteria

1. WHEN `GET /health` est appelé, THE Health_Check SHALL retourner HTTP 200 avec le corps JSON `{ "status": "ok" }`
2. WHEN `GET /health` est appelé, THE Health_Check SHALL retourner le header `Content-Type: application/json`
3. WHEN le Bot est en train de démarrer (avant que le serveur HTTP soit prêt), THE Health_Check SHALL ne pas répondre (la Platform interprétera l'absence de réponse comme un état "starting")
4. WHEN `GET /health` est appelé, THE Health_Check SHALL répondre en moins de 1000 ms dans des conditions normales
5. THE Health_Check SHALL fonctionner indépendamment de l'état des connexions à l'API Kiosq ou à WhatsApp Cloud API — il teste uniquement la vivacité du processus Node.js

---

### Requirement 5 : Graceful Shutdown sur SIGTERM et SIGINT

**User Story :** En tant qu'opérateur déployant le bot dans un conteneur Docker ou sur une Platform, je veux que le bot s'arrête proprement quand la Platform lui demande de s'arrêter, afin d'éviter les requêtes tronquées et les messages perdus lors des redéploiements.

#### Acceptance Criteria

1. WHEN le Bot reçoit un signal SIGTERM, THE Graceful_Shutdown SHALL arrêter d'accepter de nouvelles connexions HTTP
2. WHEN le Bot reçoit un signal SIGTERM, THE Graceful_Shutdown SHALL attendre la fin des requêtes HTTP en cours avant de fermer le serveur, avec un timeout maximum de 10 secondes
3. WHEN le Bot reçoit un signal SIGTERM, THE Graceful_Shutdown SHALL arrêter le Poller (`clearInterval`) avant de fermer le serveur
4. WHEN le Bot reçoit un signal SIGTERM et que toutes les ressources sont libérées, THE Bot SHALL quitter avec exit code 0
5. WHEN le timeout de 10 secondes est dépassé pendant le Graceful_Shutdown, THE Bot SHALL forcer la fermeture et quitter avec exit code 1
6. WHEN le Bot reçoit un signal SIGINT, THE Graceful_Shutdown SHALL se comporter de façon identique à la réception de SIGTERM
7. THE Graceful_Shutdown SHALL loguer les étapes de l'arrêt sur stdout : début de l'arrêt, fin du poller, fermeture du serveur HTTP, exit

---

### Requirement 6 : Configuration TypeScript pour la compilation production

**User Story :** En tant que développeur, je veux que la configuration TypeScript de `bot/whatsapp/` soit configurée pour produire des fichiers JavaScript compatibles ESM valides, afin que `node dist/whatsapp/index.js` fonctionne sans `tsx`.

#### Acceptance Criteria

1. THE `bot/tsconfig.json` (ou un `bot/whatsapp/tsconfig.json` dédié) SHALL configurer `outDir` pour émettre les fichiers compilés dans `bot/dist/`
2. THE configuration TypeScript SHALL cibler `ES2022` ou supérieur et le module système `NodeNext` ou `Node16`
3. WHEN `npm run build:whatsapp` est exécuté, THE Build_Script SHALL produire des fichiers `.js` avec les extensions d'import correctes pour ESM (les imports `./foo.js` sont conservés tels quels)
4. THE configuration TypeScript SHALL exclure les fichiers `*.test.ts` et `*.property.test.ts` de la compilation production

---

### Requirement 7 : Documentation de déploiement (Deployment Guide)

**User Story :** En tant qu'opérateur ou développeur qui n'a pas participé au développement du bot, je veux une documentation claire sur comment déployer le bot, afin de pouvoir mettre en place le service sans assistance supplémentaire.

#### Acceptance Criteria

1. THE Deployment_Guide SHALL exister à l'emplacement `bot/whatsapp/README.md`
2. THE Deployment_Guide SHALL décrire les prérequis (Node.js 22+, npm, Docker optionnel)
3. THE Deployment_Guide SHALL documenter les étapes de démarrage en développement local : copie du `.env.example`, remplissage des variables, `npm run start:whatsapp`
4. THE Deployment_Guide SHALL documenter les étapes de déploiement via Docker : `docker build`, `docker run` avec les variables d'environnement
5. THE Deployment_Guide SHALL documenter le déploiement sur au moins deux Platform nommées (ex: Railway et Render) avec les paramètres spécifiques à configurer
6. THE Deployment_Guide SHALL documenter comment générer le `BOT_JWT` via `npm run generate-jwt` et expliquer sa durée de validité
7. THE Deployment_Guide SHALL documenter la procédure de configuration du webhook WhatsApp dans le Meta Developer Portal, incluant l'URL du webhook (`https://<HOST>/webhook`) et le `WHATSAPP_VERIFY_TOKEN`
8. THE Deployment_Guide SHALL lister toutes les variables d'environnement avec leur description, leur caractère obligatoire/optionnel et un exemple de valeur
9. THE Deployment_Guide SHALL documenter les endpoints exposés par le Bot : `GET /health`, `GET /webhook`, `POST /webhook`
10. WHEN le `BOT_JWT` expire, THE Deployment_Guide SHALL expliquer comment en générer un nouveau et redéployer le service

---

### Requirement 8 : Isolation des secrets en production

**User Story :** En tant qu'opérateur, je veux que les secrets du bot (tokens, clés API, JWT) soient gérés exclusivement via des variables d'environnement de la Platform et jamais dans des fichiers commitables, afin de garantir la sécurité des credentials en production.

#### Acceptance Criteria

1. THE `bot/whatsapp/.env.example` SHALL être commité dans le dépôt git
2. THE `bot/.gitignore` (ou le `.gitignore` racine) SHALL contenir une règle excluant `bot/whatsapp/.env` et `bot/.env` des commits
3. WHEN le Bot démarre sans fichier `.env` local, THE Bot SHALL lire les variables d'environnement directement depuis l'environnement du processus (variables injectées par la Platform)
4. THE `bot/whatsapp/index.ts` SHALL charger les variables d'environnement via `loadEnv.js` qui ne doit pas planter si le fichier `.env` est absent (la fonction doit être silencieuse sur l'absence de fichier)
5. THE Dockerfile SHALL NE PAS inclure d'instruction `COPY` pour les fichiers `.env` ou `bot/.env`

---

### Requirement 9 : .dockerignore pour optimiser le build Docker

**User Story :** En tant que développeur ou opérateur construisant l'image Docker, je veux que le contexte de build Docker soit minimal, afin de réduire la taille de l'image et le temps de build.

#### Acceptance Criteria

1. THE `bot/whatsapp/.dockerignore` (ou un `.dockerignore` à la racine de `bot/`) SHALL exister
2. THE `.dockerignore` SHALL exclure les fichiers `node_modules/`, `*.test.ts`, `*.property.test.ts`, `dist/`, `.env`, `.env.local`
3. WHEN le Dockerfile est construit, THE image résultante SHALL ne pas contenir de fichiers de test ou de fichiers `.env`
4. WHEN le Dockerfile est construit, THE image résultante SHALL ne pas contenir le répertoire `node_modules` du host (les dépendances sont installées dans le conteneur)


---

### Requirement 10 : Normalisation du numéro de téléphone WhatsApp

**User Story :** En tant que commercial créant un client dans Kiosq, je veux que le numéro de téléphone soit stocké au format E.164 (sans `+`) afin que le bot WhatsApp puisse automatiquement reconnaître ce client quand il écrit sur WhatsApp.

#### Acceptance Criteria

1. WHEN un numéro de téléphone est saisi dans le formulaire client, THE front-end SHALL supprimer tous les espaces, tirets, parenthèses et le `+` initial avant d'envoyer la valeur à l'API
2. THE numéro normalisé SHALL contenir uniquement des chiffres (0-9)
3. IF le champ téléphone est laissé vide, THEN THE normalisation SHALL ne pas s'appliquer (le téléphone reste null/vide)
4. WHEN `GET /api/clients?telephone=<normalisé>` est appelé par le bot, THE API SHALL retourner le client correspondant si son champ `telephone` stocké est égal à la valeur fournie
5. THE handler GET de `api/clients/index.ts` SHALL supporter un paramètre de requête `telephone` pour une recherche par correspondance exacte, en complément du paramètre `q` existant
6. WHEN le bot crée un nouveau client via `POST /api/clients`, THE `createClient()` du bot SHALL transmettre le numéro de téléphone déjà au format E.164 normalisé (chiffres uniquement, sans `+`)

---

### Requirement 11 : Badge "via WhatsApp" dans la liste clients

**User Story :** En tant que commercial, je veux voir quels clients ont été créés via le bot WhatsApp dans la liste clients, afin de comprendre l'origine de mes leads.

#### Acceptance Criteria

1. WHEN un client a un champ `notes` contenant la chaîne `"WhatsApp"`, THE liste clients SHALL afficher un badge WhatsApp (icône verte) à côté de son nom
2. THE badge WhatsApp SHALL être visible dans la ligne du tableau client sans nécessiter de survol ou de clic
3. THE filtres existants de la liste clients (type : tous/entreprise/particulier) SHALL fonctionner indépendamment du badge WhatsApp
4. THE badge WhatsApp SHALL ne pas apparaître pour les clients dont les notes ne contiennent pas `"WhatsApp"`

---

### Requirement 12 : Lien WhatsApp cliquable dans la fiche client

**User Story :** En tant que commercial consultant le profil d'un client, je veux un lien en un clic pour ouvrir une conversation WhatsApp avec ce client, afin de faire le suivi de ses commandes directement.

#### Acceptance Criteria

1. WHEN un client a un champ `telephone` non vide, THE page de détail client SHALL afficher un lien "Contacter sur WhatsApp"
2. THE lien SHALL ouvrir `https://wa.me/<telephone>` dans un nouvel onglet du navigateur, où `<telephone>` est le numéro normalisé (chiffres uniquement)
3. WHEN le champ `telephone` est vide ou null, THE lien WhatsApp SHALL ne pas être affiché
4. THE lien WhatsApp SHALL être visuellement distinct de l'affichage téléphonique standard (couleur verte WhatsApp ou icône dédiée)
