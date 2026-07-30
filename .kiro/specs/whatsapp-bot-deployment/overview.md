# WhatsApp Bot Deployment — Vue fonctionnelle

Ce document décrit concrètement ce que cette feature accomplit et pourquoi elle est nécessaire.

---

## Contexte

Le bot WhatsApp de commandes (`bot/whatsapp/`) est un service Node.js autonome entièrement développé et testé. Il ne peut pas tourner sur Vercel — la plateforme qui héberge l'API Kiosq — car Vercel est serverless : chaque fonction s'arrête après la requête. Le bot utilise un `setInterval` pour surveiller les statuts de commandes toutes les 60 secondes et maintient des sessions conversationnelles en mémoire entre les messages.

Cette feature ne touche pas à la logique métier du bot. Elle ajoute uniquement ce qui est nécessaire pour le rendre **déployable, maintenable et opérationnel** sur n'importe quelle plateforme supportant Node.js ou Docker.

---

## Ce que cette feature produit

### Pour le développeur

- `npm run start:whatsapp` depuis `bot/` pour lancer le bot en développement local
- `npm run build:whatsapp` pour compiler le TypeScript en JavaScript production
- Un fichier `bot/whatsapp/.env.example` documentant toutes les variables d'environnement avec leur rôle et comment les obtenir

### Pour l'opérateur déployant le service

- Un `Dockerfile` multi-stage dans `bot/whatsapp/` qui produit une image Docker reproductible :
  - Build TypeScript dans un stage dédié
  - Image finale minimale (node:22-slim, utilisateur non-root)
  - Health check intégré sur `GET /health`
  - Aucun secret boulonné dans l'image
- Un guide de déploiement (`bot/whatsapp/README.md`) couvrant :
  - Démarrage en développement local
  - Déploiement Docker
  - Déploiement sur Railway et Render avec les paramètres spécifiques
  - Configuration du webhook WhatsApp dans le Meta Developer Portal
  - Génération et rotation du `BOT_JWT`

### Pour la robustesse du service

- **Graceful shutdown** : quand la plateforme redémarre ou met à jour le conteneur, elle envoie SIGTERM. Le bot arrête proprement le poller, attend que les requêtes en cours se terminent (max 10s), puis quitte avec exit code 0. Sans ça, les messages en transit lors d'un redéploiement seraient perdus.
- **Health check** : `GET /health` répond `{ "status": "ok" }` en JSON. Les plateformes l'utilisent pour détecter si le service est vivant et le redémarrer automatiquement en cas de problème.

---

## Ce que cette feature ne fait pas

- Pas de modification de la logique conversationnelle du bot
- Pas de choix de plateforme d'hébergement imposé — agnostique (Railway, Render, Fly.io, VPS, Docker Compose)
- Pas de pipeline CI/CD automatisé — la documentation couvre le déploiement manuel
- Pas de gestion multi-tenant du bot (c'est l'objet d'une spec séparée)

---

## Séquence de démarrage du conteneur

```
docker run --env-file .env kiosq-whatsapp-bot
  └── node dist/whatsapp/index.js
        ├── loadEnv()             — silencieux si .env absent (variables viennent de la plateforme)
        ├── validateWhatsappEnv() — exit 1 si variable manquante, nom listé dans stderr
        ├── SessionStore + RateLimiter + WhatsappClient + KiosqWhatsappApi
        ├── HTTP server :3002
        │     ├── GET  /health   → 200 { "status": "ok" }
        │     ├── GET  /webhook  → vérification Meta hub.challenge
        │     └── POST /webhook  → messages entrants clients
        └── setInterval 60s → pollCommandeStatuts()
```

## Séquence d'arrêt (SIGTERM)

```
SIGTERM reçu
  └── clearInterval(timer)          — le poller ne redéclenchera plus
  └── server.close()                — n'accepte plus de nouvelles connexions
        ├── connexions drainées < 10s → process.exit(0)
        └── timeout 10s dépassé     → process.exit(1)
```
