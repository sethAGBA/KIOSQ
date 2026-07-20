# Kiosq — Plateforme de gestion commerciale

Application web de gestion commerciale complète : clients, catalogue, commandes, facturation, fournisseurs, rapports et gestion des utilisateurs.

**Stack :** React 19 · Vite · TypeScript · Tailwind CSS v4 · Zustand · Recharts  
**Backend :** Vercel Serverless Functions · Neon Postgres · Drizzle ORM · JWT

---

## Modules

| Module | Routes | Description |
|---|---|---|
| Tableau de bord | `/dashboard` | KPIs, graphiques CA, alertes stock, factures en retard |
| Clients | `/clients` | CRM léger, fiche client, historique commandes/factures |
| Catalogue & Stock | `/produits` | Produits, catégories, alertes rupture |
| Commandes & Devis | `/commandes` | Création, suivi statuts, tabs commandes/devis |
| Facturation | `/facturation` | Génération factures, paiements, aperçu PDF |
| Fournisseurs | `/fournisseurs` | Gestion fournisseurs, commandes achat |
| Rapports | `/rapports` | Graphiques CA, taux de marge, top clients |
| Utilisateurs | `/utilisateurs` | Gestion équipe, rôles et permissions |
| Configuration | `/configuration` | Paramètres entreprise, TVA, devise |

---

## Démarrage rapide (mode démo)

```bash
npm install
npm run dev
```

Ouvre `http://localhost:5173` et connecte-toi avec :

| Email | Mot de passe | Rôle |
|---|---|---|
| admin@kiosq.com | demo1234 | Administrateur |
| commercial@kiosq.com | demo1234 | Commercial |
| comptable@kiosq.com | demo1234 | Comptable |
| gest@kiosq.com | demo1234 | Gestionnaire |

En mode démo, toutes les données sont mockées localement — aucun backend requis.

---

## Architecture

```
kiosq/
├── src/                        # Front-end React
│   ├── components/
│   │   ├── auth/AuthGuard.tsx  # Protection des routes
│   │   └── layout/
│   │       ├── AppLayout.tsx   # Sidebar + topbar
│   │       └── NotificationDrawer.tsx
│   ├── pages/                  # Pages par module
│   │   ├── DashboardPage.tsx
│   │   ├── clients/
│   │   ├── produits/
│   │   ├── commandes/
│   │   ├── facturation/
│   │   ├── fournisseurs/
│   │   ├── rapports/
│   │   ├── utilisateurs/
│   │   └── configuration/
│   ├── store/
│   │   ├── authStore.ts        # Auth (Zustand + persist)
│   │   └── appStore.ts         # État global + fetch API
│   ├── lib/
│   │   ├── api.ts              # Client HTTP vers les API routes
│   │   └── format.ts           # Formatage prix, dates, statuts
│   ├── types/index.ts          # Tous les types TypeScript
│   └── data/mock.ts            # Données de démonstration
│
├── api/                        # Vercel Serverless Functions
│   ├── _lib/
│   │   ├── auth.ts             # JWT (sign/verify), cookies, CORS
│   │   └── response.ts         # Helpers ok/err, numericRow
│   ├── auth/
│   │   ├── login.ts            # POST /api/auth/login
│   │   ├── me.ts               # GET  /api/auth/me
│   │   └── logout.ts           # POST /api/auth/logout
│   ├── clients/
│   │   ├── index.ts            # GET /api/clients · POST /api/clients
│   │   └── [id].ts             # GET · PATCH · DELETE /api/clients/:id
│   ├── produits/
│   │   ├── index.ts            # GET · POST /api/produits
│   │   └── [id].ts             # GET · PATCH · DELETE /api/produits/:id
│   ├── commandes/
│   │   ├── index.ts            # GET · POST /api/commandes
│   │   └── [id].ts             # GET · PATCH /api/commandes/:id
│   ├── factures/
│   │   ├── index.ts            # GET · POST /api/factures
│   │   └── [id].ts             # GET · PATCH · POST(paiement) /api/factures/:id
│   ├── fournisseurs/
│   │   ├── index.ts            # GET · POST /api/fournisseurs
│   │   └── [id].ts             # GET · PATCH /api/fournisseurs/:id
│   └── categories/
│       └── index.ts            # GET · POST /api/categories
│
├── db/
│   ├── schema.ts               # Schéma Drizzle (8 tables + 6 enums)
│   ├── client.ts               # Connexion Neon HTTP
│   ├── seed.ts                 # Script de données initiales
│   └── check.ts                # Vérification de la base
│
└── server.ts                   # Serveur Express local (dev uniquement)
```

---

## Mode API réelle (développement)

Le switch entre mocks et API réelle se fait via une seule variable d'environnement.

### Prérequis

1. Un projet [Neon](https://console.neon.tech) avec la `DATABASE_URL`
2. Générer un `JWT_SECRET` : `openssl rand -base64 32`

### Configuration

Copie `.env.example` en `.env.local` et remplis :

```env
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require
JWT_SECRET=une-clé-secrète-forte
VITE_API_URL=http://localhost:3001
```

### Initialiser la base

```bash
npm run db:push    # Crée les tables dans Neon
npm run db:seed    # Insère les données de démo
```

### Lancer en mode API

Deux terminaux :

```bash
# Terminal 1 — Serveur API local (port 3001)
npm run api:dev

# Terminal 2 — Front Vite (port 5173)
npm run dev
```

Le proxy Vite redirige automatiquement `/api/*` vers `localhost:3001`.

### Vérifier la base

```bash
npx tsx --env-file=.env.local db/check.ts
```

---

## API Reference

### Auth

| Méthode | Route | Corps | Description |
|---|---|---|---|
| POST | `/api/auth/login` | `{ email, password }` | Connexion — retourne un cookie JWT httpOnly |
| GET | `/api/auth/me` | — | Profil de l'utilisateur connecté |
| POST | `/api/auth/logout` | — | Supprime le cookie |

### Clients

| Méthode | Route | Accès | Description |
|---|---|---|---|
| GET | `/api/clients` | tous | Liste (param `?q=` pour recherche) |
| POST | `/api/clients` | tous | Créer un client |
| GET | `/api/clients/:id` | tous | Détail |
| PATCH | `/api/clients/:id` | tous | Modifier |
| DELETE | `/api/clients/:id` | admin | Désactiver |

### Produits

| Méthode | Route | Accès | Description |
|---|---|---|---|
| GET | `/api/produits` | tous | Liste (params `?q=`, `?alerte=1`, `?categorieId=`) |
| POST | `/api/produits` | admin, gestionnaire | Créer |
| GET | `/api/produits/:id` | tous | Détail |
| PATCH | `/api/produits/:id` | admin, gestionnaire | Modifier / ajuster stock |
| DELETE | `/api/produits/:id` | admin | Désactiver |

### Commandes & Devis

| Méthode | Route | Accès | Description |
|---|---|---|---|
| GET | `/api/commandes` | tous | Liste (params `?type=commande\|devis`, `?statut=`) |
| POST | `/api/commandes` | admin, commercial, gestionnaire | Créer |
| GET | `/api/commandes/:id` | tous | Détail |
| PATCH | `/api/commandes/:id` | admin, commercial, gestionnaire | Changer statut, acompte |

### Factures

| Méthode | Route | Accès | Description |
|---|---|---|---|
| GET | `/api/factures` | tous | Liste (param `?statut=`) |
| POST | `/api/factures` | admin, comptable, gestionnaire | Créer |
| GET | `/api/factures/:id` | tous | Détail |
| PATCH | `/api/factures/:id` | admin, comptable | Changer statut |
| POST | `/api/factures/:id` | admin, comptable | Enregistrer un paiement |

### Fournisseurs

| Méthode | Route | Accès | Description |
|---|---|---|---|
| GET | `/api/fournisseurs` | tous | Liste |
| POST | `/api/fournisseurs` | admin, gestionnaire | Créer |
| GET | `/api/fournisseurs/:id` | tous | Détail |
| PATCH | `/api/fournisseurs/:id` | admin, gestionnaire | Modifier |

### Catégories

| Méthode | Route | Accès | Description |
|---|---|---|---|
| GET | `/api/categories` | tous | Liste |
| POST | `/api/categories` | admin | Créer |

---

## Rôles et permissions

| Rôle | Clients | Produits | Commandes | Factures | Fournisseurs | Rapports | Admin |
|---|---|---|---|---|---|---|---|
| **admin** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **commercial** | ✅ | lecture | ✅ | lecture | lecture | — | — |
| **gestionnaire** | lecture | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| **comptable** | lecture | lecture | lecture | ✅ | lecture | ✅ | — |
| **lecteur** | lecture | lecture | lecture | lecture | lecture | — | — |

---

## Déploiement Vercel

```bash
# Lier le projet (une seule fois)
vercel link

# Déployer
vercel deploy --prod
```

Ajouter ces variables dans le dashboard Vercel (Settings → Environment Variables) :

```
DATABASE_URL   →  postgresql://...
JWT_SECRET     →  clé forte (openssl rand -base64 32)
```

`VITE_API_URL` n'est pas nécessaire en production — le front et l'API sont sur le même domaine.

---

## Scripts disponibles

```bash
npm run dev           # Front Vite (mocks, port 5173)
npm run api:dev       # Serveur API local (port 3001)
npm run build         # Build production
npm run db:push       # Pousser le schéma vers Neon
npm run db:seed       # Insérer les données de démo
npm run db:studio     # Interface Drizzle Studio
npm run db:generate   # Générer les migrations SQL
```

---

## Sécurité

- Authentification par **cookie httpOnly** (JWT HS256, 7 jours)
- Mots de passe hashés avec **bcryptjs** (12 rounds)
- Validation des entrées avec **Zod** sur toutes les routes
- Contrôle d'accès par **rôle** sur chaque endpoint
- Variables sensibles exclusivement côté serveur (jamais exposées au front)
