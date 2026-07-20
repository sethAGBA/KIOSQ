# Requirements Document

## Introduction

Ce document définit les exigences pour rendre le backend de l'application Kiosq complet et prêt pour la production. Kiosq est une application de gestion commerciale (point de vente) qui gère clients, produits, catégories, fournisseurs, commandes, commandes fournisseurs, factures et utilisateurs.

Le projet dispose déjà d'une base solide : serverless functions Vercel, Drizzle ORM avec Neon PostgreSQL, et un frontend React qui bascule automatiquement entre les données mockées et l'API via la variable `VITE_API_URL`. L'objectif est de combler les lacunes restantes pour que le déploiement en production affiche des données réelles à la place des mocks sur toutes les pages.

## Glossary

- **API_Server** : Les Vercel Serverless Functions qui exposent les endpoints REST sous `/api/`
- **Frontend** : L'application React/Vite qui consomme les données via `src/lib/api.ts`
- **AppStore** : Le store Zustand (`src/store/appStore.ts`) qui orchestre le basculement mock/API
- **AuthStore** : Le store Zustand (`src/store/authStore.ts`) qui gère l'authentification
- **DB** : La base de données Neon PostgreSQL accédée via Drizzle ORM
- **Dashboard** : La page `/dashboard` qui affiche les KPIs et graphiques de chiffre d'affaires
- **USE_API** : Flag booléen dérivé de `VITE_API_URL` qui active l'API réelle en lieu et place des mocks
- **Numeric_Helper** : La fonction `numericRow`/`numericRows` dans `api/_lib/response.ts` qui convertit les champs numériques Drizzle (retournés en string) en nombres JavaScript
- **Seed_Script** : Le script `db/seed.ts` qui insère les données de démonstration dans Neon PostgreSQL

---

## Requirements

### Requirement 1 : Endpoints manquants pour les catégories

**User Story :** En tant qu'administrateur, je veux pouvoir modifier et supprimer des catégories via l'API, afin que la gestion du catalogue soit entièrement persistée en base de données.

#### Acceptance Criteria

1. WHEN une requête PATCH est envoyée à `/api/categories/:id` avec un corps JSON valide, THE API_Server SHALL mettre à jour la catégorie correspondante en DB et retourner la catégorie mise à jour avec un statut HTTP 200.
2. WHEN une requête DELETE est envoyée à `/api/categories/:id` par un utilisateur avec le rôle `admin`, THE API_Server SHALL désactiver ou supprimer la catégorie en DB et retourner `{ message: "Catégorie supprimée" }` avec un statut HTTP 200.
3. IF une requête PATCH ou DELETE est envoyée à `/api/categories/:id` avec un identifiant inexistant, THEN THE API_Server SHALL retourner une erreur HTTP 404.
4. IF une requête DELETE est envoyée à `/api/categories/:id` par un utilisateur dont le rôle n'est pas `admin`, THEN THE API_Server SHALL retourner une erreur HTTP 403.
5. THE API_Server SHALL exposer un fichier `api/categories/[id].ts` qui gère les méthodes PATCH et DELETE pour la route `/api/categories/:id`.

---

### Requirement 2 : Endpoint de statistiques pour le Dashboard

**User Story :** En tant qu'utilisateur, je veux que le tableau de bord affiche des KPIs calculés depuis les données réelles, afin de suivre les performances commerciales en temps réel.

#### Acceptance Criteria

1. WHEN une requête GET est envoyée à `/api/dashboard/stats`, THE API_Server SHALL retourner un objet JSON contenant : le chiffre d'affaires du mois en cours (`caMonth`), le nombre de commandes actives (`commandesActives`), le nombre de produits en alerte de stock (`alertesStock`), le montant total des factures en retard (`facturesEnRetard`), et le chiffre d'affaires des 12 derniers mois par mois (`caParMois`).
2. WHEN `caParMois` est calculé, THE API_Server SHALL retourner un tableau de 12 entrées sous la forme `{ label: string; valeur: number; commandes: number }` correspondant aux 12 derniers mois glissants.
3. IF aucune facture n'existe pour un mois donné dans `caParMois`, THEN THE API_Server SHALL retourner une entrée avec `valeur: 0` et `commandes: 0` pour ce mois.
4. THE API_Server SHALL calculer `alertesStock` en comptant les produits dont `stockActuel` est inférieur ou égal à `stockMinimum` et dont `actif` est `true`.
5. THE API_Server SHALL calculer `facturesEnRetard` en sommant les `resteAPayer` des factures dont le statut est `en_retard`.

---

### Requirement 3 : Serveur de développement local complet

**User Story :** En tant que développeur, je veux que le serveur Express local (`server.ts`) expose toutes les routes API incluant les nouvelles routes, afin de tester l'intégralité du backend localement avant déploiement.

#### Acceptance Criteria

1. WHEN le serveur Express est démarré via `npm run api:dev`, THE API_Server SHALL exposer la route PATCH et DELETE `/api/categories/:id`.
2. WHEN le serveur Express est démarré via `npm run api:dev`, THE API_Server SHALL exposer la route GET `/api/dashboard/stats`.
3. THE API_Server SHALL maintenir le comportement de proxy existant où Vite redirige `/api/*` vers `localhost:3001` en mode développement.

---

### Requirement 4 : Migration complète du Frontend des mocks vers l'API réelle

**User Story :** En tant qu'utilisateur de l'application en production, je veux que toutes les pages affichent des données réelles issues de la base de données, afin que l'application soit fonctionnelle et fiable.

#### Acceptance Criteria

1. WHEN `VITE_API_URL` est défini, THE Frontend SHALL appeler `fetchAll()` au démarrage de l'application pour charger les données depuis l'API réelle.
2. WHEN `VITE_API_URL` est défini, THE Frontend SHALL afficher sur le Dashboard les KPIs calculés depuis l'endpoint `/api/dashboard/stats` plutôt que les valeurs calculées à partir des données mockées.
3. WHEN `VITE_API_URL` est défini, THE Frontend SHALL peupler la liste des catégories dans les formulaires de produits depuis l'API réelle.
4. WHEN `VITE_API_URL` est défini, THE Frontend SHALL peupler la liste des utilisateurs depuis l'API réelle.
5. IF une requête API échoue lors du chargement initial, THEN THE Frontend SHALL afficher un message d'erreur explicite à l'utilisateur plutôt qu'une page vide.
6. THE AppStore SHALL initialiser les collections `clients`, `produits`, `commandes`, `factures`, `fournisseurs`, `commandesFournisseurs` et `categories` à des tableaux vides quand `USE_API` est `true`, puis les peupler via les appels `fetch*`.

---

### Requirement 5 : Complétion des endpoints de commandes fournisseurs

**User Story :** En tant que gestionnaire, je veux pouvoir effectuer toutes les opérations de gestion sur les commandes fournisseurs via l'API, afin que le stock soit mis à jour automatiquement à la réception des marchandises.

#### Acceptance Criteria

1. WHEN une requête PATCH est envoyée à `/api/commandes-fournisseurs/:id` avec `{ statut: "recu" }` ou `{ statut: "recu_partiel" }`, THE API_Server SHALL mettre à jour le stock des produits correspondants en ajoutant les quantités reçues.
2. WHEN le statut d'une commande fournisseur passe à `"recu"`, THE API_Server SHALL mettre à jour le champ `dateReception` de la commande avec la date et heure actuelles.
3. WHEN une requête POST est envoyée à `/api/commandes-fournisseurs/:id` avec `{ montant: number }`, THE API_Server SHALL enregistrer le paiement en augmentant `montantPaye`, en recalculant `resteAPayer`, et en mettant à jour `statutPaiement` (`en_attente`, `partiel`, `paye`).
4. IF le montant total payé dépasse `totalTTC`, THEN THE API_Server SHALL retourner une erreur HTTP 400 avec le message `"Montant dépasse le total dû"`.
5. THE API_Server SHALL exposer un fichier `api/commandes-fournisseurs/[id].ts` gérant GET, PATCH et POST pour la route `/api/commandes-fournisseurs/:id`.

---

### Requirement 6 : Robustesse et cohérence des données numériques

**User Story :** En tant que développeur, je veux que toutes les valeurs numériques retournées par l'API soient des nombres JavaScript (et non des chaînes), afin que le frontend puisse effectuer des calculs sans conversion manuelle.

#### Acceptance Criteria

1. THE Numeric_Helper SHALL convertir en nombres JavaScript les champs `prixAchat`, `prixVente`, `prixVenteGros`, `stockActuel`, `stockMinimum`, `soldeDette`, `totalAchats`, `totalHT`, `totalTTC`, `remiseGlobale`, `tva`, `acompte`, `resteAPayer`, `montantPaye`, `soldeCredit`, `nombreCommandes` et `fraisLivraison` dans toutes les réponses API.
2. WHEN un endpoint retourne une liste de ressources, THE API_Server SHALL appliquer `numericRows()` à l'ensemble du tableau avant de sérialiser la réponse.
3. WHEN un endpoint retourne une ressource unique (création ou mise à jour), THE API_Server SHALL appliquer `numericRow()` à l'objet avant de sérialiser la réponse.
4. THE Numeric_Helper SHALL laisser inchangés les champs non listés dans le critère 1 (chaînes, booléens, dates, objets JSONB).

---

### Requirement 7 : Script de seed complet et déployable

**User Story :** En tant que développeur, je veux pouvoir initialiser une base de données Neon vide avec des données de démonstration en une seule commande, afin de valider le déploiement en production rapidement.

#### Acceptance Criteria

1. WHEN `npm run db:seed` est exécuté sur une base de données vide, THE Seed_Script SHALL créer les utilisateurs, catégories, fournisseurs, produits et clients de démonstration définis dans `db/seed.ts`.
2. WHEN `npm run db:seed` est exécuté sur une base de données déjà peuplée, THE Seed_Script SHALL utiliser `onConflictDoNothing()` pour ne pas écraser les données existantes.
3. THE Seed_Script SHALL créer au minimum 4 utilisateurs avec des rôles distincts (`admin`, `commercial`, `comptable`, `gestionnaire`) dont les mots de passe sont hashés avec bcrypt (12 rounds).
4. WHEN `npm run db:push` est exécuté, THE DB SHALL créer ou mettre à jour toutes les tables du schéma Drizzle (`users`, `categories`, `fournisseurs`, `produits`, `clients`, `commandes`, `factures`, `commandes_fournisseurs`) dans Neon PostgreSQL.
5. IF `DATABASE_URL` n'est pas défini lors de l'exécution du seed, THEN THE Seed_Script SHALL terminer avec un message d'erreur explicite et un code de sortie non-zéro.

---

### Requirement 8 : Sécurité et contrôle d'accès uniforme

**User Story :** En tant qu'administrateur, je veux que toutes les routes API appliquent les contrôles d'accès basés sur les rôles, afin que les utilisateurs ne puissent accéder qu'aux ressources autorisées par leur rôle.

#### Acceptance Criteria

1. THE API_Server SHALL exiger un token JWT valide (via cookie httpOnly `kiosq_token` ou header `Authorization: Bearer`) sur toutes les routes protégées.
2. IF une requête arrive sans token valide sur une route protégée, THEN THE API_Server SHALL retourner HTTP 401 avec le message `"Non authentifié"`.
3. IF une requête arrive avec un token expiré ou malformé sur une route protégée, THEN THE API_Server SHALL retourner HTTP 401 avec le message `"Token invalide ou expiré"`.
4. WHILE un utilisateur a le rôle `lecteur`, THE API_Server SHALL autoriser uniquement les méthodes GET sur les ressources clients, produits, commandes, factures et fournisseurs.
5. THE API_Server SHALL définir le cookie d'authentification avec les attributs `HttpOnly`, `SameSite=Lax` et `Secure` (en production uniquement) pour prévenir les attaques XSS et CSRF.

---

### Requirement 9 : Configuration et déploiement Vercel

**User Story :** En tant que développeur DevOps, je veux que l'application soit déployable sur Vercel avec un minimum de configuration, afin de passer en production rapidement.

#### Acceptance Criteria

1. WHEN l'application est déployée sur Vercel, THE API_Server SHALL lire `DATABASE_URL` et `JWT_SECRET` depuis les variables d'environnement Vercel sans nécessiter de fichier `.env` côté serveur.
2. WHEN l'application est déployée sur Vercel, THE Frontend SHALL fonctionner sans définir `VITE_API_URL` car le front et l'API partagent le même domaine, et `BASE` dans `api.ts` sera une chaîne vide.
3. THE API_Server SHALL inclure des headers CORS configurés via `ALLOWED_ORIGIN` pour autoriser uniquement le domaine de production en production.
4. WHEN `NODE_ENV` est `production`, THE API_Server SHALL ajouter l'attribut `Secure` au cookie d'authentification.
5. THE DB SHALL être accessible depuis Vercel via le driver HTTP Neon (`@neondatabase/serverless`) sans nécessiter de connexion TCP persistante, conformément aux contraintes serverless.
