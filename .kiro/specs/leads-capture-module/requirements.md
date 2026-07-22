# Document de Requirements — Module Capture de Leads

## Introduction

Ce module intègre la logique de l'application **buyers_capture** directement dans kiosq en tant que fonctionnalité native. Il permet de détecter automatiquement des intentions d'achat dans des groupes Facebook publics (via Apify), de les classifier avec Google Gemini AI, de les afficher dans un dashboard dédié, et de les convertir en clients kiosq d'un seul clic.

Le module comporte quatre grandes parties :
1. **Persistance** — deux nouvelles tables Drizzle/Neon (`groupes_surveilles`, `leads`).
2. **API REST** — nouvelles routes Vercel Serverless respectant le pattern existant de kiosq.
3. **Interface React** — une section `/leads` dans la navigation kiosq avec dashboard, gestion des groupes et fiche lead.
4. **Bot de capture** — processus Node.js (adapté de buyers_capture) qui appelle l'API kiosq avec un JWT de service.

---

## Glossaire

- **Bot_Capture** : processus Node.js autonome qui orchestre Apify et Gemini pour créer des leads via l'API kiosq.
- **Système** : le backend kiosq (Vercel Serverless Functions + Neon Postgres).
- **Interface** : l'application React kiosq côté navigateur.
- **Lead** : intention d'achat détectée dans un groupe Facebook, stockée dans la table `leads`.
- **Groupe_Surveille** : groupe Facebook public dont les posts sont analysés, stocké dans la table `groupes_surveilles`.
- **Utilisateur_Autorise** : utilisateur kiosq dont le rôle est `admin`, `commercial` ou `gestionnaire`.
- **Utilisateur_Admin** : utilisateur kiosq dont le rôle est `admin`.
- **JWT_Service** : token JWT signé avec le même secret kiosq, associé à un compte utilisateur dédié de rôle `commercial`, utilisé exclusivement par le Bot_Capture.
- **Score_Confiance** : valeur numérique entre 0 et 1 attribuée par Gemini représentant la probabilité qu'un post exprime une intention d'achat.
- **Statut_Lead** : énumération `nouveau | envoye | ignore`.
- **Statut_Groupe** : énumération `actif | inactif | erreur`.
- **Cookie_Session_Chiffre** : valeur du cookie de session Facebook, chiffrée au repos dans la base de données.
- **Pagination** : mécanisme de retour partiel des résultats via les paramètres `page` et `limit`.

---

## Requirements

### Requirement 1 — Schéma de base de données : Groupes surveillés

**User Story :** En tant qu'administrateur, je veux gérer les groupes Facebook à surveiller depuis kiosq, afin de centraliser la configuration du bot de capture.

#### Critères d'acceptation

1. THE Système SHALL créer une table `groupes_surveilles` contenant les colonnes : `id` (text, clé primaire), `nom_groupe` (text, non nul), `url_groupe` (text, non nul, unique), `cookie_session_chiffre` (text), `statut` (enum `statut_groupe`, défaut `actif`), `createdAt` (timestamp, défaut now), `updatedAt` (timestamp, défaut now).
2. THE Système SHALL définir l'enum `statut_groupe` avec les valeurs `actif`, `inactif`, `erreur` en suivant le pattern `pgEnum` existant du fichier `db/schema.ts`.
3. THE Système SHALL exporter les types `GroupeSurveilleRow` et `LeadRow` depuis `db/schema.ts` en suivant le pattern des types existants (`ClientRow`, `ProduitRow`, etc.).

---

### Requirement 2 — Schéma de base de données : Leads

**User Story :** En tant que commercial, je veux que chaque lead détecté soit persisté avec ses métadonnées, afin de pouvoir le consulter et le traiter ultérieurement.

#### Critères d'acceptation

1. THE Système SHALL créer une table `leads` contenant les colonnes : `id` (text, clé primaire), `groupe_surveille_id` (text, clé étrangère → `groupes_surveilles.id`), `client_id` (text, nullable, clé étrangère → `clients.id`), `texte_original` (text, non nul), `produit_detecte` (text), `score_confiance` (numeric, précision 4, échelle 3), `lien_post` (text), `statut` (enum `statut_lead`, défaut `nouveau`), `createdAt` (timestamp, défaut now), `updatedAt` (timestamp, défaut now).
2. THE Système SHALL définir l'enum `statut_lead` avec les valeurs `nouveau`, `envoye`, `ignore` en suivant le pattern `pgEnum` existant du fichier `db/schema.ts`.
3. WHEN un lead est converti en client, THE Système SHALL mettre à jour la colonne `client_id` avec l'identifiant du client créé.

---

### Requirement 3 — API : Liste et création de leads

**User Story :** En tant qu'utilisateur autorisé, je veux récupérer la liste paginée des leads et permettre au bot de créer de nouveaux leads, afin d'alimenter et de consulter le pipeline commercial.

#### Critères d'acceptation

1. WHEN une requête `GET /api/leads` est reçue avec un JWT valide d'un Utilisateur_Autorise, THE Système SHALL retourner une liste paginée de leads ordonnée par `createdAt` décroissant.
2. WHEN les paramètres `page` (entier ≥ 1) et `limit` (entier entre 1 et 100) sont fournis dans la requête `GET /api/leads`, THE Système SHALL appliquer la pagination et retourner le nombre total de leads dans la réponse.
3. WHEN le paramètre `statut` est fourni dans la requête `GET /api/leads`, THE Système SHALL filtrer les leads dont le statut correspond à la valeur fournie.
4. WHEN le paramètre `produit` est fourni dans la requête `GET /api/leads`, THE Système SHALL filtrer les leads dont le `produit_detecte` contient la valeur fournie (recherche insensible à la casse).
5. WHEN le paramètre `score_min` (numérique entre 0 et 1) est fourni dans la requête `GET /api/leads`, THE Système SHALL filtrer les leads dont le `score_confiance` est supérieur ou égal à `score_min`.
6. WHEN une requête `POST /api/leads` est reçue avec un corps JSON valide et un JWT valide, THE Système SHALL créer un nouveau lead et retourner le lead créé avec le statut HTTP 201.
7. IF le corps de la requête `POST /api/leads` est invalide ou incomplet (champs obligatoires manquants), THEN THE Système SHALL retourner une erreur HTTP 422 avec un message descriptif.
8. IF une requête `GET /api/leads` ou `POST /api/leads` est reçue sans JWT valide, THEN THE Système SHALL retourner une erreur HTTP 401.

---

### Requirement 4 — API : Détail et mise à jour d'un lead

**User Story :** En tant que commercial, je veux consulter le détail d'un lead et mettre à jour son statut, afin de suivre l'avancement du traitement commercial.

#### Critères d'acceptation

1. WHEN une requête `GET /api/leads/:id` est reçue avec un JWT valide d'un Utilisateur_Autorise, THE Système SHALL retourner le lead correspondant avec les données du groupe surveillé associé.
2. IF le lead identifié par `:id` n'existe pas lors d'une requête `GET /api/leads/:id`, THEN THE Système SHALL retourner une erreur HTTP 404.
3. WHEN une requête `PATCH /api/leads/:id` est reçue avec un corps JSON contenant un champ `statut` valide et un JWT d'un Utilisateur_Autorise, THE Système SHALL mettre à jour le statut du lead et retourner le lead mis à jour.
4. IF la valeur du champ `statut` dans la requête `PATCH /api/leads/:id` n'est pas l'une des valeurs `nouveau`, `envoye`, `ignore`, THEN THE Système SHALL retourner une erreur HTTP 422.
5. IF une requête `PATCH /api/leads/:id` est reçue sans JWT valide, THEN THE Système SHALL retourner une erreur HTTP 401.

---

### Requirement 5 — API : Conversion d'un lead en client

**User Story :** En tant que commercial, je veux convertir un lead qualifié en client kiosq, afin d'initialiser le cycle de vente sans ressaisie.

#### Critères d'acceptation

1. WHEN une requête `POST /api/leads/:id/convertir` est reçue avec un JWT valide d'un Utilisateur_Autorise, THE Système SHALL créer un nouveau client kiosq à partir des données du lead (nom extrait de `produit_detecte` si disponible, `notes` alimenté par `texte_original`) et retourner le client créé avec le statut HTTP 201.
2. WHEN la conversion est effectuée avec succès, THE Système SHALL mettre à jour le champ `client_id` du lead avec l'identifiant du client nouvellement créé et mettre à jour le statut du lead à `envoye`.
3. IF le lead identifié par `:id` n'existe pas lors d'une requête `POST /api/leads/:id/convertir`, THEN THE Système SHALL retourner une erreur HTTP 404.
4. IF le lead identifié par `:id` possède déjà un `client_id` non nul, THEN THE Système SHALL retourner une erreur HTTP 409 indiquant que le lead est déjà converti.
5. IF une requête `POST /api/leads/:id/convertir` est reçue sans JWT valide, THEN THE Système SHALL retourner une erreur HTTP 401.

---

### Requirement 6 — API : Gestion des groupes surveillés

**User Story :** En tant qu'administrateur, je veux créer, lister, modifier et supprimer des groupes surveillés via l'API, afin de contrôler les sources de capture de leads.

#### Critères d'acceptation

1. WHEN une requête `GET /api/groupes-surveilles` est reçue avec un JWT valide d'un Utilisateur_Autorise, THE Système SHALL retourner la liste de tous les groupes surveillés ordonnés par `createdAt` décroissant.
2. WHEN une requête `POST /api/groupes-surveilles` est reçue avec un corps JSON valide et un JWT valide d'un Utilisateur_Admin, THE Système SHALL créer un nouveau groupe surveillé et retourner le groupe créé avec le statut HTTP 201.
3. IF l'`url_groupe` fournie dans `POST /api/groupes-surveilles` existe déjà en base, THEN THE Système SHALL retourner une erreur HTTP 409 avec un message indiquant que le groupe existe déjà.
4. WHEN une requête `PATCH /api/groupes-surveilles/:id` est reçue avec un corps JSON valide et un JWT valide d'un Utilisateur_Admin, THE Système SHALL mettre à jour les champs fournis du groupe et retourner le groupe mis à jour.
5. WHEN une requête `DELETE /api/groupes-surveilles/:id` est reçue avec un JWT valide d'un Utilisateur_Admin, THE Système SHALL supprimer le groupe et retourner une réponse HTTP 200.
6. IF le groupe identifié par `:id` possède des leads associés lors d'une requête `DELETE /api/groupes-surveilles/:id`, THEN THE Système SHALL retourner une erreur HTTP 409 indiquant que le groupe ne peut pas être supprimé.
7. IF une requête `POST`, `PATCH` ou `DELETE` sur `/api/groupes-surveilles` est reçue avec un JWT valide dont le rôle n'est pas `admin`, THEN THE Système SHALL retourner une erreur HTTP 403.
8. IF une requête sur `/api/groupes-surveilles` est reçue sans JWT valide, THEN THE Système SHALL retourner une erreur HTTP 401.

---

### Requirement 7 — Interface : Navigation et accès par rôle

**User Story :** En tant qu'utilisateur autorisé, je veux accéder au module leads depuis la barre de navigation kiosq, afin d'avoir un accès rapide et cohérent avec le reste de l'application.

#### Critères d'acceptation

1. THE Interface SHALL ajouter une entrée « Capture de Leads » dans le tableau de navigation `NAV` de `AppLayout.tsx`, accessible aux rôles `admin`, `commercial` et `gestionnaire`.
2. THE Interface SHALL afficher dans l'entrée « Capture de Leads » de la sidebar un badge numérique indiquant le nombre de leads dont le statut est `nouveau`, lorsque ce nombre est supérieur à 0.
3. WHILE l'utilisateur connecté possède le rôle `comptable` ou `lecteur`, THE Interface SHALL masquer l'entrée « Capture de Leads » dans la sidebar.
4. THE Interface SHALL ajouter la route `/leads` dans `App.tsx` à l'intérieur du bloc protégé par `AuthGuard`, en suivant le pattern des routes existantes.

---

### Requirement 8 — Interface : Dashboard leads

**User Story :** En tant que commercial, je veux visualiser la liste des leads qualifiés avec des filtres et une pagination, afin de prioriser mon action commerciale.

#### Critères d'acceptation

1. WHEN l'utilisateur navigue vers `/leads`, THE Interface SHALL afficher la liste paginée des leads récupérée depuis `GET /api/leads`, avec les colonnes : produit détecté, score de confiance, groupe source, statut, date de création.
2. WHEN l'utilisateur sélectionne un filtre de statut (`nouveau`, `envoye`, `ignore`), THE Interface SHALL appeler `GET /api/leads` avec le paramètre `statut` correspondant et rafraîchir la liste affichée.
3. WHEN l'utilisateur saisit une valeur dans le champ de recherche par produit, THE Interface SHALL appeler `GET /api/leads` avec le paramètre `produit` correspondant après un délai de 300 ms (debounce).
4. WHEN l'utilisateur déplace le curseur du filtre de score minimum, THE Interface SHALL appeler `GET /api/leads` avec le paramètre `score_min` correspondant et rafraîchir la liste.
5. WHEN l'utilisateur clique sur « Page suivante » ou « Page précédente », THE Interface SHALL appeler `GET /api/leads` avec les paramètres `page` et `limit` mis à jour et rafraîchir la liste.
6. IF l'appel à `GET /api/leads` échoue, THE Interface SHALL afficher un message d'erreur non bloquant et conserver la liste précédemment chargée.

---

### Requirement 9 — Interface : Fiche lead et changement de statut

**User Story :** En tant que commercial, je veux consulter le détail d'un lead et en changer le statut, afin de suivre et de clore le traitement de chaque opportunité.

#### Critères d'acceptation

1. WHEN l'utilisateur clique sur un lead dans la liste, THE Interface SHALL afficher la fiche lead avec : texte original, produit détecté, score de confiance, lien vers le post Facebook, groupe source, statut actuel, date de création, et — si converti — le nom du client associé avec un lien vers sa fiche.
2. WHEN l'utilisateur sélectionne un nouveau statut dans la fiche lead et confirme, THE Interface SHALL appeler `PATCH /api/leads/:id` avec le nouveau statut et afficher un message de succès.
3. WHEN l'utilisateur clique sur « Convertir en client » dans la fiche lead, THE Interface SHALL appeler `POST /api/leads/:id/convertir` et, en cas de succès, afficher le nom du client créé et désactiver le bouton de conversion.
4. IF le lead est déjà converti (champ `client_id` non nul), THE Interface SHALL afficher le bouton « Convertir en client » en état désactivé avec une info-bulle indiquant « Lead déjà converti ».
5. IF l'appel `POST /api/leads/:id/convertir` retourne une erreur, THE Interface SHALL afficher le message d'erreur retourné par l'API sans fermer la fiche lead.

---

### Requirement 10 — Interface : Gestion des groupes surveillés

**User Story :** En tant qu'administrateur, je veux gérer les groupes Facebook à surveiller depuis l'interface kiosq, afin de configurer les sources de capture sans accès direct à la base de données.

#### Critères d'acceptation

1. THE Interface SHALL afficher un onglet ou une sous-page « Groupes surveillés » accessible depuis `/leads` uniquement aux utilisateurs de rôle `admin`.
2. WHEN l'utilisateur de rôle `admin` charge la page des groupes surveillés, THE Interface SHALL appeler `GET /api/groupes-surveilles` et afficher la liste avec les colonnes : nom du groupe, URL, statut, nombre de leads associés, date de création.
3. WHEN l'utilisateur de rôle `admin` soumet le formulaire de création d'un groupe (nom, URL obligatoires ; cookie de session optionnel), THE Interface SHALL appeler `POST /api/groupes-surveilles` et rafraîchir la liste en cas de succès.
4. WHEN l'utilisateur de rôle `admin` modifie le statut ou le cookie de session d'un groupe existant et soumet le formulaire, THE Interface SHALL appeler `PATCH /api/groupes-surveilles/:id` et rafraîchir la liste en cas de succès.
5. WHEN l'utilisateur de rôle `admin` clique sur « Supprimer » et confirme la suppression d'un groupe, THE Interface SHALL appeler `DELETE /api/groupes-surveilles/:id` et retirer l'entrée de la liste en cas de succès.
6. IF l'API retourne une erreur HTTP 409 lors de la suppression, THE Interface SHALL afficher le message d'erreur sans supprimer l'entrée de la liste.

---

### Requirement 11 — Bot de capture : Authentification et appels API

**User Story :** En tant qu'administrateur, je veux que le bot de capture utilise un compte de service kiosq pour s'authentifier, afin que les leads créés automatiquement soient traçables et sécurisés.

#### Critères d'acceptation

1. THE Bot_Capture SHALL lire un JWT de service depuis la variable d'environnement `BOT_JWT` et l'inclure dans l'en-tête `Authorization: Bearer <token>` de chaque requête vers l'API kiosq.
2. WHEN le Bot_Capture détecte un post Facebook éligible, THE Bot_Capture SHALL appeler `POST /api/leads` avec les champs `groupe_surveille_id`, `texte_original`, `produit_detecte`, `score_confiance` et `lien_post`.
3. IF l'appel `POST /api/leads` retourne une erreur HTTP 401 ou 403, THEN THE Bot_Capture SHALL arrêter l'exécution et journaliser l'erreur sans réessayer.
4. IF l'appel `POST /api/leads` retourne une erreur HTTP 5xx, THEN THE Bot_Capture SHALL réessayer l'appel une fois après un délai de 5 secondes, puis journaliser l'erreur et continuer avec le post suivant.
5. THE Bot_Capture SHALL lire l'URL de base de l'API kiosq depuis la variable d'environnement `KIOSQ_API_URL`.
6. THE Bot_Capture SHALL récupérer la liste des groupes actifs en appelant `GET /api/groupes-surveilles` au démarrage et filtrer les groupes dont le statut est `actif`.

---

### Requirement 12 — Bot de capture : Logique Apify et Gemini

**User Story :** En tant que commercial, je veux que le bot détecte et classe automatiquement les intentions d'achat dans les groupes surveillés, afin d'alimenter le pipeline sans intervention manuelle.

#### Critères d'acceptation

1. THE Bot_Capture SHALL utiliser le client Apify pour scraper les posts publics de chaque Groupe_Surveille de statut `actif`, en passant le `cookie_session_chiffre` déchiffré comme paramètre d'authentification Apify.
2. WHEN un post est récupéré par Apify, THE Bot_Capture SHALL envoyer le texte du post à l'API Gemini avec un prompt de classification d'intention d'achat et récupérer le `produit_detecte` et le `score_confiance`.
3. WHEN le `score_confiance` retourné par Gemini est supérieur ou égal au seuil défini par la variable d'environnement `SCORE_SEUIL` (défaut : 0.7), THE Bot_Capture SHALL créer un lead via `POST /api/leads`.
4. WHEN le `score_confiance` retourné par Gemini est inférieur au seuil `SCORE_SEUIL`, THE Bot_Capture SHALL ignorer le post sans créer de lead.
5. IF le scraping Apify échoue pour un groupe, THEN THE Bot_Capture SHALL journaliser l'erreur, mettre à jour le statut du groupe à `erreur` via `PATCH /api/groupes-surveilles/:id`, et continuer avec le groupe suivant.

---

### Requirement 13 — Sécurité : Chiffrement du cookie de session

**User Story :** En tant qu'administrateur, je veux que les cookies de session Facebook soient chiffrés en base de données, afin de protéger les données sensibles d'authentification.

#### Critères d'acceptation

1. WHEN un cookie de session est soumis via `POST /api/groupes-surveilles` ou `PATCH /api/groupes-surveilles/:id`, THE Système SHALL chiffrer la valeur avec AES-256-GCM en utilisant la clé définie par la variable d'environnement `COOKIE_ENCRYPTION_KEY` avant de la persister en base de données.
2. WHEN le Bot_Capture demande les données d'un groupe surveillé, THE Système SHALL déchiffrer le `cookie_session_chiffre` avant de le retourner dans la réponse, uniquement si la requête provient d'un JWT de rôle `commercial` ou `admin`.
3. THE Système SHALL ne jamais retourner la valeur brute du `cookie_session_chiffre` dans les réponses `GET /api/groupes-surveilles` destinées à l'Interface (les réponses pour l'Interface omettent ce champ).
4. IF la variable d'environnement `COOKIE_ENCRYPTION_KEY` est absente au démarrage, THEN THE Système SHALL rejeter toute requête de création ou modification de groupe avec un message d'erreur HTTP 500 indiquant une mauvaise configuration.

---

### Requirement 14 — Comptage des leads nouveaux (badge sidebar)

**User Story :** En tant qu'utilisateur autorisé, je veux voir en temps réel le nombre de leads non traités dans la sidebar, afin d'être alerté rapidement des nouvelles opportunités.

#### Critères d'acceptation

1. THE Interface SHALL charger le nombre de leads de statut `nouveau` au montage du composant `AppLayout` en appelant `GET /api/leads?statut=nouveau&limit=1` et en lisant le total retourné par l'API.
2. WHILE le nombre de leads de statut `nouveau` est supérieur à 0, THE Interface SHALL afficher un badge numérique orange sur l'entrée « Capture de Leads » dans la sidebar.
3. WHEN l'utilisateur navigue vers `/leads` et change le statut d'un lead, THE Interface SHALL décrémenter le compteur du badge de 1 si le statut précédent était `nouveau`.
4. THE Interface SHALL rafraîchir le compteur de leads nouveaux toutes les 60 secondes en arrière-plan, sans bloquer l'interface utilisateur.

