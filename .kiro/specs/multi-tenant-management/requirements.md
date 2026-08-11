# Requirements Document

## Introduction

Ce document décrit les exigences pour la gestion multi-tenant complète de KIOSQ, une plateforme SaaS de gestion commerciale. L'architecture repose sur une isolation par ligne (`tenant_id` sur chaque table métier), un middleware d'authentification tenant-aware, un backoffice superadmin et des limites d'usage par plan d'abonnement.

Le contexte technique existant : la table `tenants` est en place, `tenant_id` est présent sur toutes les tables métier, le middleware `requireTenantAuth` existe dans `api/_lib/auth.ts`, les routes superadmin CRUD sont implémentées, et 8 tests property-based couvrent les invariants fondamentaux.

Ce document consolide et complète les exigences en intégrant les lacunes identifiées : isolation API systématique, onboarding tenant, résolution tenant, interface superadmin, limites plan et mode maintenance.

---

## Glossary

- **Tenant**: Boutique cliente de la plateforme KIOSQ, correspondant à une entreprise abonnée.
- **Tenant_ID**: Identifiant unique du tenant, présent dans chaque table métier pour isoler les données.
- **Superadmin**: Opérateur de la plateforme KIOSQ avec accès au backoffice `/superadmin` et à toutes les boutiques.
- **Admin_Boutique**: Utilisateur avec le rôle `admin` dans un tenant donné, sans accès aux autres tenants.
- **Plan**: Niveau d'abonnement souscrit par un tenant (`starter`, `pro`, `enterprise`), définissant les limites d'usage.
- **Slug**: Identifiant textuel URL-friendly unique d'un tenant (ex : `boutique-abc`).
- **API_Guard**: Middleware `requireTenantAuth` extrayant le `tenantId` du JWT et vérifiant le statut du tenant.
- **Auth_Context**: Objet disponible dans chaque handler API après validation, contenant `sub`, `email`, `role`, `tenantId`.
- **TenantAuthContext**: Variante de `Auth_Context` où `tenantId` est garanti non-nul.
- **Limite_Plan**: Plafond d'utilisation défini par le Plan pour une ressource (utilisateurs, produits, magasins).
- **Impersonation**: Action permettant au Superadmin de prendre temporairement l'identité d'un Admin_Boutique.
- **Audit_Log**: Journal des actions importantes enregistrées par boutique, avec timestamp, utilisateur et IP.
- **Onboarding_Wizard**: Assistant guidé en 5 étapes présenté à l'Admin_Boutique lors de sa première connexion.
- **MRR**: Revenu mensuel récurrent estimé agrégé sur l'ensemble des tenants actifs.
- **Template_Catalogue**: Export du catalogue d'une boutique (catégories + produits) réutilisable par d'autres boutiques.
- **Parseur_Configuration**: Composant désérialisant une configuration de tenant en objet `TenantConfig`.
- **Pretty_Printer**: Composant sérialisant un objet `TenantConfig` en JSON lisible.

---

## Requirements

---

### Requirement 1: Isolation des données par tenant

**User Story:** En tant qu'Admin_Boutique, je veux que mes données soient strictement séparées des autres boutiques, afin qu'aucun utilisateur externe ne puisse accéder à mes informations commerciales.


#### Acceptance Criteria

1. THE Système SHALL maintenir une colonne `tenant_id` (texte, NOT NULL, clé étrangère vers `tenants.id`) sur chacune des tables métier : `categories`, `magasins`, `fournisseurs`, `produits`, `clients`, `commandes`, `factures`, `commandes_fournisseurs`, `parametres`, `unites`, `groupes_surveilles`, `leads`, `audit_logs`, `inventaires`, `sorties_caisse`, `retours_clients`, `clotures_caisse`, `catalogue_templates`.
2. THE Système SHALL maintenir la colonne `tenant_id` nullable sur la table `users`, avec la valeur `null` réservée exclusivement aux comptes Superadmin.
3. WHEN une requête API est reçue par l'API_Guard, THE API_Guard SHALL extraire le `tenantId` depuis le JWT et l'inclure dans l'Auth_Context.
4. WHEN l'API_Guard traite une requête d'un utilisateur non-Superadmin sans `tenantId` valide dans le JWT, THE API_Guard SHALL rejeter la requête avec un statut 401.
5. WHEN un handler API effectue une lecture sur une table métier, THE handler SHALL filtrer les enregistrements avec la clause `WHERE tenant_id = Auth_Context.tenantId`.
6. WHEN un handler API effectue une écriture (INSERT, UPDATE, DELETE) sur une table métier, THE handler SHALL scoper l'opération au `Auth_Context.tenantId`.
7. IF un utilisateur tente d'accéder à un enregistrement dont le `tenant_id` diffère de `Auth_Context.tenantId`, THEN THE API_Guard SHALL retourner une réponse 404 sans révéler l'existence de la ressource dans un autre tenant.

---

### Requirement 2: Schéma et contraintes de la table tenants

**User Story:** En tant que Superadmin, je veux une table `tenants` fiable avec toutes les informations d'abonnement, afin de gérer le cycle de vie complet de chaque boutique.

#### Acceptance Criteria

1. THE Système SHALL maintenir la table `tenants` avec les colonnes : `id` (text, PK), `nom` (text, NOT NULL), `slug` (text, NOT NULL, UNIQUE), `domaine` (text, nullable), `plan` (enum `starter|pro|enterprise`, NOT NULL), `statut` (enum `actif|suspendu|essai`, NOT NULL), `date_essai_fin` (timestamp, nullable), `logo_url` (text, nullable), `devise` (text, NOT NULL), `pays` (text, nullable), `telephone` (text, nullable), `email` (text, NOT NULL), `adresse` (text, nullable), `en_maintenance` (boolean, NOT NULL, default false), `message_maintenance` (text, nullable), `created_at` (timestamp, NOT NULL), `updated_at` (timestamp, NOT NULL).
2. THE Système SHALL garantir l'unicité du `slug` parmi tous les tenants.
3. WHEN un tenant est créé avec un `nom` sans `slug` explicite, THE Système SHALL générer automatiquement un `slug` URL-friendly en mettant le nom en minuscules, en remplaçant les caractères non alphanumériques par `-`, et en supprimant les tirets en début et fin.
4. IF un `slug` généré ou fourni produit une collision avec un slug existant, THEN THE Système SHALL ajouter un suffixe numérique incrémental (ex : `boutique-abc-2`, `boutique-abc-3`) pour garantir l'unicité.
5. THE Système SHALL accepter uniquement les valeurs `starter`, `pro` et `enterprise` pour la colonne `plan`.
6. THE Système SHALL accepter uniquement les valeurs `actif`, `suspendu` et `essai` pour la colonne `statut`.

---

### Requirement 3: Authentification multi-tenant et validation du JWT

**User Story:** En tant qu'Admin_Boutique, je veux que mon JWT contienne l'identifiant de ma boutique, afin que chaque requête soit automatiquement scopée à mes données sans configuration supplémentaire.

#### Acceptance Criteria

1. WHEN un utilisateur s'authentifie avec succès, THE Système SHALL inclure le `tenantId` de l'utilisateur dans le payload JWT, en plus des champs `sub`, `email`, `role`, `nom`, `prenom`.
2. WHEN un Superadmin s'authentifie, THE Système SHALL inclure la valeur `null` pour le champ `tenantId` dans le payload JWT.
3. WHEN une requête porte un JWT avec un `tenantId` valide et un en-tête `X-Tenant-ID` différent, THE API_Guard SHALL rejeter la requête avec un statut 403 et un message indiquant l'incohérence de tenant.
4. WHEN une requête porte un JWT avec un `tenantId` correspondant à un tenant au statut `suspendu`, THE API_Guard SHALL rejeter la requête avec un statut 403 et le message `"Boutique suspendue. Contactez le support."`.
5. WHEN une requête porte un JWT avec un `tenantId` correspondant à un tenant au statut `essai` dont la `date_essai_fin` est antérieure à la date courante, THE API_Guard SHALL rejeter la requête avec un statut 403 et le message `"Période d'essai expirée. Veuillez souscrire à un plan."`.
6. WHILE le flag `en_maintenance` est actif pour le tenant du JWT, THE API_Guard SHALL rejeter toutes les requêtes des utilisateurs non-Superadmin avec un statut 503 et le `message_maintenance` du tenant.


---

### Requirement 4: Enregistrement et onboarding d'un nouveau tenant

**User Story:** En tant que nouveau client, je veux m'inscrire à la plateforme KIOSQ et configurer ma boutique en quelques étapes, afin de démarrer rapidement sans intervention manuelle de l'équipe KIOSQ.

#### Acceptance Criteria

1. THE Système SHALL exposer un endpoint `POST /api/tenants/register` acceptant : `nomBoutique` (string, 2–100 chars), `email` (email valide), `password` (min 8 chars), `nom` (string), `prenom` (string), `pays` (string, optionnel), `devise` (string, optionnel, défaut `XOF`).
2. WHEN `POST /api/tenants/register` est appelé avec des données valides, THE Système SHALL créer atomiquement : un tenant avec statut `essai` et `date_essai_fin` = now + 14 jours, un utilisateur admin avec `role = admin` lié au tenant, et une ligne `parametres` avec `id = 'default'` pour ce tenant.
3. WHEN `POST /api/tenants/register` est appelé avec un email déjà existant dans la table `users`, THE Système SHALL retourner 409 avec le message `"Un compte existe déjà avec cet email."`.
4. WHEN l'inscription réussit, THE Système SHALL retourner un JWT valide dans un cookie httpOnly, scopé au nouveau tenant, avec `role = admin`.
5. WHEN un Admin_Boutique se connecte pour la première fois (`premiere_connexion = true`), THE Système SHALL retourner dans la réponse `/api/auth/me` le champ `showOnboarding: true`.
6. THE Onboarding_Wizard SHALL présenter 5 étapes séquentielles : (1) Infos boutique, (2) Logo & devise, (3) Premiers produits, (4) Premier utilisateur commercial, (5) Récapitulatif.
7. WHEN l'Admin_Boutique complète une étape, THE Système SHALL appeler `PATCH /api/auth/profile` pour incrémenter `onboarding_step` et persister les données saisies.
8. WHEN l'Admin_Boutique complète l'étape 5, THE Système SHALL passer `premiere_connexion = false` dans la table `users`.

---

### Requirement 5: Limites d'usage par plan

**User Story:** En tant que Superadmin, je veux que chaque plan d'abonnement impose des limites d'utilisation automatiquement vérifiées, afin de protéger les ressources de la plateforme et de monétiser différents niveaux de service.

#### Acceptance Criteria

1. THE Système SHALL définir les limites suivantes par plan :
   - `starter` : 3 utilisateurs max, 500 produits max, 2 magasins max
   - `pro` : 10 utilisateurs max, 5 000 produits max, 10 magasins max
   - `enterprise` : illimité (valeur `Infinity`)
2. WHEN un handler `POST /api/utilisateurs` est appelé, THE Système SHALL compter les utilisateurs actifs du tenant et rejeter avec 403 + message `"Limite du plan atteinte : X utilisateurs max (plan starter/pro)."` si le plafond est atteint.
3. WHEN un handler `POST /api/produits` est appelé, THE Système SHALL compter les produits actifs du tenant et rejeter avec 403 + message `"Limite du plan atteinte : X produits max (plan starter/pro)."` si le plafond est atteint.
4. WHEN un handler `POST /api/magasins` est appelé, THE Système SHALL compter les magasins actifs du tenant et rejeter avec 403 + message `"Limite du plan atteinte : X magasins max (plan starter/pro)."` si le plafond est atteint.
5. THE Système SHALL exposer un fichier `api/_lib/planLimits.ts` exportant une fonction `checkPlanLimit(tenantId, resource, db)` retournant `{ allowed: boolean, current: number, max: number }`.
6. WHEN `checkPlanLimit` est appelé pour un tenant `enterprise`, THE fonction SHALL toujours retourner `{ allowed: true, current: N, max: Infinity }`.

---

### Requirement 6: Backoffice Superadmin

**User Story:** En tant que Superadmin, je veux un tableau de bord dédié pour gérer tous les tenants, afin de surveiller l'activité de la plateforme et intervenir rapidement en cas de problème.

#### Acceptance Criteria

1. THE Système SHALL exposer les routes superadmin sous le préfixe `/api/superadmin/`, accessibles uniquement aux utilisateurs avec `role = superadmin`.
2. THE Système SHALL implémenter `GET /api/superadmin/tenants` retournant la liste paginée de tous les tenants avec : id, nom, slug, plan, statut, email, nombre d'utilisateurs actifs, nombre de produits, dateEssaiFin, createdAt.
3. THE Système SHALL implémenter `GET /api/superadmin/tenants/:id` retournant le détail complet d'un tenant avec ses statistiques.
4. THE Système SHALL implémenter `POST /api/superadmin/tenants` pour créer un tenant directement (sans onboarding).
5. THE Système SHALL implémenter `PATCH /api/superadmin/tenants/:id` pour modifier : nom, plan, statut, domaine, enMaintenance, messageMaintenance.
6. THE Système SHALL implémenter `POST /api/superadmin/tenants/:id/impersonate` qui génère un JWT temporaire (1h) avec `role = admin` et `tenantId` du tenant cible, permettant au Superadmin de se connecter en tant qu'Admin_Boutique.
7. WHEN le Superadmin accède à `/api/superadmin/stats`, THE Système SHALL retourner : nombre total de tenants par statut, nombre de tenants par plan, MRR estimé.
8. WHEN un tenant est passé au statut `suspendu` via `PATCH /api/superadmin/tenants/:id`, THE Système SHALL enregistrer l'action dans `audit_logs` avec `action = 'TENANT_SUSPENDED'`.

---

### Requirement 7: Mode maintenance par tenant

**User Story:** En tant que Superadmin, je veux activer un mode maintenance par boutique, afin d'effectuer des opérations techniques sans impacter les autres tenants.

#### Acceptance Criteria

1. WHEN `en_maintenance = true` pour un tenant, THE API_Guard SHALL bloquer toutes les requêtes des utilisateurs non-Superadmin de ce tenant avec HTTP 503 et le body `{ "error": "maintenance", "message": "<message_maintenance>" }`.
2. WHEN `en_maintenance = true` et qu'un Superadmin effectue une requête sur ce tenant, THE API_Guard SHALL laisser passer la requête normalement.
3. WHEN le Superadmin active le mode maintenance via `PATCH /api/superadmin/tenants/:id`, THE Système SHALL accepter un champ `messageMaintenance` optionnel. Si absent, un message par défaut `"Maintenance en cours. Revenez bientôt."` sera utilisé.
4. WHEN le front-end reçoit une réponse 503 avec `"error": "maintenance"`, THE Application SHALL afficher une page de maintenance dédiée avec le `message` reçu plutôt qu'une erreur générique.

---

### Requirement 8: Résolution du tenant par sous-domaine ou header

**User Story:** En tant qu'Admin_Boutique, je veux accéder à ma boutique via mon sous-domaine personnalisé, afin d'avoir une URL dédiée et professionnelle.

#### Acceptance Criteria

1. WHEN une requête arrive sur `<slug>.kiosq.app` ou `api.<slug>.kiosq.app`, THE Système SHALL résoudre automatiquement le tenant correspondant au `slug` depuis la table `tenants`.
2. WHEN une requête API porte l'en-tête `X-Tenant-Slug: <slug>`, THE API_Guard SHALL résoudre le tenant par slug si le JWT ne contient pas de `tenantId`.
3. WHEN un tenant est résolu par sous-domaine ou header, THE Système SHALL vérifier que le tenant est en statut `actif` ou `essai` avant de traiter la requête.
4. IF le slug ne correspond à aucun tenant, THEN THE API_Guard SHALL retourner 404 avec `"Boutique introuvable."`.

---

### Requirement 9: Interface frontend multi-tenant

**User Story:** En tant qu'Admin_Boutique, je veux que l'interface affiche les informations de ma boutique et respecte ses paramètres de configuration, afin d'avoir une expérience personnalisée.

#### Acceptance Criteria

1. THE `authStore` SHALL stocker les informations du tenant courant : `tenantId`, `tenantNom`, `tenantSlug`, `tenantPlan`, `tenantStatut`, `tenantDevise`, `tenantLogoUrl`.
2. WHEN `/api/auth/me` est appelé, THE Système SHALL inclure dans la réponse les champs tenant : `tenantId`, `tenantNom`, `tenantSlug`, `tenantPlan`, `tenantStatut`, `tenantDevise`, `tenantLogoUrl`, `showOnboarding`.
3. THE Application SHALL afficher le nom et logo du tenant dans la topbar et/ou la sidebar.
4. WHEN `tenantStatut = 'essai'`, THE Application SHALL afficher une bannière d'avertissement indiquant le nombre de jours restants dans la période d'essai.
5. THE Application SHALL disposer d'une route protégée `/superadmin` accessible uniquement aux utilisateurs avec `role = superadmin`, affichant la liste des tenants avec leurs statistiques et actions de gestion.
