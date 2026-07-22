# Document de Requirements — Gestion Multi-Tenant

## Introduction

Ce document décrit les exigences pour transformer Kiosq d'un ERP mono-tenant en une plateforme SaaS multi-boutiques. Chaque boutique (tenant) dispose d'une isolation complète de ses données, d'un espace d'administration dédié et d'un plan d'abonnement. Un backoffice superadmin permet de gérer l'ensemble des boutiques depuis un point central.

La stratégie d'isolation choisie est **Row-Level Security via colonne `tenant_id`** : toutes les tables métier existantes reçoivent une colonne `tenant_id` qui est incluse dans chaque requête SQL, garantissant qu'un utilisateur ne peut jamais accéder aux données d'une autre boutique.

---

## Glossaire

- **Tenant** : Une boutique cliente de la plateforme Kiosq. Correspond à une entreprise ayant souscrit à un abonnement.
- **Tenant_ID** : Identifiant unique d'un tenant, présent dans toutes les tables métier pour isoler les données.
- **Superadmin** : Opérateur de la plateforme Kiosq ayant accès au backoffice `/superadmin` et à toutes les boutiques.
- **Admin_Boutique** : Utilisateur avec le rôle `admin` au sein d'un tenant donné, sans accès aux autres tenants.
- **Plan** : Niveau d'abonnement souscrit par un tenant (`starter`, `pro`, `enterprise`), définissant les limites d'usage.
- **Slug** : Identifiant textuel URL-friendly unique d'un tenant (ex : `boutique-abc`), utilisé dans le routage.
- **API_Guard** : Middleware d'authentification qui extrait le `tenantId` du JWT et l'injecte dans le contexte de chaque requête API.
- **Auth_Context** : Objet contextuel disponible dans chaque handler API, contenant `sub`, `email`, `role`, `tenantId`.
- **Onboarding_Wizard** : Assistant guidé en 5 étapes présenté à l'Admin_Boutique lors de la première connexion.
- **Audit_Log** : Journal des actions importantes enregistrées par boutique avec timestamp, utilisateur et adresse IP.
- **MRR** : Monthly Recurring Revenue — revenu mensuel récurrent estimé agrégé sur l'ensemble des tenants.
- **Impersonation** : Action permettant au Superadmin de prendre temporairement l'identité d'un Admin_Boutique pour le support.
- **Template_Catalogue** : Export du catalogue d'une boutique (catégories + produits, sans données clients) réutilisable par d'autres boutiques.
- **Limite_Plan** : Plafond d'utilisation défini par le Plan pour une ressource donnée (utilisateurs, produits, magasins).

---

## Requirements

---

### Requirement 1 : Isolation des données par tenant

**User Story :** En tant qu'Admin_Boutique, je veux que mes données soient strictement séparées de celles des autres boutiques, afin qu'aucun utilisateur externe ne puisse accéder à mes informations commerciales.

#### Critères d'acceptation

1. THE Système SHALL ajouter une colonne `tenant_id` (texte, NOT NULL, clé étrangère vers `tenants.id`) à chacune des tables suivantes : `categories`, `magasins`, `fournisseurs`, `produits`, `clients`, `commandes`, `factures`, `commandes_fournisseurs`, `parametres`, `unites`, `groupes_surveilles`, `leads`.
2. THE Système SHALL ajouter une colonne `tenant_id` (texte, nullable) à la table `users`, avec `null` réservé aux comptes Superadmin.
3. WHEN une requête API est reçue par l'API_Guard, THE API_Guard SHALL extraire le `tenantId` du JWT et l'inclure dans l'Auth_Context.
4. WHEN l'API_Guard traite une requête provenant d'un utilisateur non-Superadmin, THE API_Guard SHALL rejeter la requête avec un statut 401 si le JWT ne contient pas de `tenantId` valide.
5. WHEN un handler API effectue une lecture ou écriture sur une table métier, THE handler SHALL filtrer les enregistrements par `tenant_id = Auth_Context.tenantId`.
6. IF un utilisateur tente d'accéder à un enregistrement dont le `tenant_id` diffère de `Auth_Context.tenantId`, THEN THE API_Guard SHALL retourner une réponse 404 sans révéler l'existence de la ressource.
7. THE Système SHALL créer un index de base de données sur la colonne `tenant_id` pour chaque table métier afin de maintenir des performances de requête acceptables.

---

### Requirement 2 : Table `tenants` (boutiques)

**User Story :** En tant que Superadmin, je veux gérer les boutiques clientes dans une table dédiée, afin de centraliser toutes les informations relatives à chaque abonnement.

#### Critères d'acceptation

1. THE Système SHALL créer une table `tenants` avec les colonnes : `id` (text, PK), `nom` (text, NOT NULL), `slug` (text, NOT NULL, UNIQUE), `domaine` (text, nullable), `plan` (enum `starter|pro|enterprise`, NOT NULL), `statut` (enum `actif|suspendu|essai`, NOT NULL), `date_essai_fin` (timestamp, nullable), `logo_url` (text, nullable), `devise` (text, NOT NULL), `pays` (text, nullable), `telephone` (text, nullable), `email` (text, NOT NULL), `adresse` (text, nullable), `created_at` (timestamp, NOT NULL), `updated_at` (timestamp, NOT NULL).
2. THE Système SHALL garantir l'unicité du `slug` parmi tous les tenants.
3. WHEN un tenant est créé avec un `nom`, THE Système SHALL générer automatiquement un `slug` URL-friendly à partir du nom si aucun slug n'est fourni explicitement.
4. IF un slug fourni contient des caractères non URL-friendly, THEN THE Système SHALL retourner une erreur 422 décrivant les caractères invalides.
5. THE Système SHALL accepter uniquement les valeurs `starter`, `pro` et `enterprise` pour la colonne `plan`.
6. THE Système SHALL accepter uniquement les valeurs `actif`, `suspendu` et `essai` pour la colonne `statut`.

---

### Requirement 3 : Authentification multi-tenant

**User Story :** En tant qu'Admin_Boutique, je veux que mon JWT contienne l'identifiant de ma boutique, afin que chaque requête soit automatiquement scopée à mes données.

#### Critères d'acceptation

1. WHEN un utilisateur s'authentifie avec succès, THE Système SHALL inclure le `tenantId` de l'utilisateur dans le payload du JWT, en plus des champs existants (`sub`, `email`, `role`, `nom`, `prenom`).
2. WHEN un Superadmin s'authentifie, THE Système SHALL inclure une valeur `null` pour le champ `tenantId` dans le payload JWT.
3. THE API_Guard SHALL valider la présence et la cohérence du `tenantId` dans le JWT pour toutes les routes non-publiques.
4. WHEN un token JWT contenant un `tenantId` correspondant à un tenant avec le statut `suspendu` est présenté, THE API_Guard SHALL rejeter la requête avec un statut 403 et un message indiquant que la boutique est suspendue.
5. WHEN un token JWT contenant un `tenantId` correspondant à un tenant avec le statut `essai` dont la `date_essai_fin` est dépassée est présenté, THE API_Guard SHALL rejeter la requête avec un statut 403 et un message indiquant que la période d'essai est expirée.

---

### Requirement 4 : Backoffice Superadmin — Dashboard

**User Story :** En tant que Superadmin, je veux visualiser les métriques globales de la plateforme, afin de suivre la santé et la croissance du service.

#### Critères d'acceptation

1. THE Système SHALL exposer une route `/superadmin` accessible uniquement aux utilisateurs dont le `role` JWT est `superadmin`.
2. IF un utilisateur sans rôle `superadmin` tente d'accéder à `/superadmin`, THEN THE Système SHALL rediriger vers la page de connexion avec un statut 403.
3. WHEN le Superadmin accède au dashboard, THE Dashboard_Superadmin SHALL afficher : le nombre total de boutiques, le nombre de boutiques `actif`, le nombre de boutiques en `essai`, le nombre de boutiques `suspendu`, et le MRR estimé.
4. THE Dashboard_Superadmin SHALL calculer le MRR en appliquant les tarifs suivants : `starter` = 0 FCFA/mois (gratuit), `pro` = valeur configurable, `enterprise` = valeur configurable — les tarifs étant stockés dans la configuration de la plateforme.
5. THE Dashboard_Superadmin SHALL afficher l'évolution du nombre de nouvelles boutiques créées par mois sur les 12 derniers mois.
6. THE Dashboard_Superadmin SHALL afficher le taux de conversion des boutiques du statut `essai` vers `actif` sur les 90 derniers jours.

---

### Requirement 5 : Backoffice Superadmin — Gestion des boutiques

**User Story :** En tant que Superadmin, je veux lister, créer, consulter et modifier les boutiques, afin de gérer le cycle de vie complet de chaque tenant.

#### Critères d'acceptation

1. WHEN le Superadmin accède à la liste des boutiques, THE Liste_Boutiques SHALL afficher pour chaque tenant : nom, plan, statut, date de création, nombre d'utilisateurs et chiffre d'affaires total.
2. THE Liste_Boutiques SHALL permettre le filtrage par `statut` et par `plan`.
3. THE Liste_Boutiques SHALL permettre la recherche par `nom` ou `slug`.
4. WHEN le Superadmin soumet le formulaire de création de boutique avec les champs (nom, email admin, plan, devise, pays), THE Système SHALL créer le tenant en base de données, créer l'utilisateur Admin_Boutique associé avec un mot de passe temporaire, et déclencher l'envoi d'un email de bienvenue.
5. WHEN le Superadmin accède au détail d'une boutique, THE Detail_Boutique SHALL afficher toutes les colonnes du tenant ainsi que la liste de ses utilisateurs.
6. WHEN le Superadmin modifie le plan d'un tenant, THE Système SHALL mettre à jour la colonne `plan` du tenant et recalculer immédiatement les limites applicables.
7. WHEN le Superadmin suspend un tenant, THE Système SHALL mettre le statut du tenant à `suspendu`, ce qui bloquera l'authentification de tous les utilisateurs du tenant conformément au Requirement 3.4.
8. WHEN le Superadmin réactive un tenant suspendu, THE Système SHALL mettre le statut du tenant à `actif`.

---

### Requirement 6 : Impersonation

**User Story :** En tant que Superadmin, je veux pouvoir prendre temporairement l'identité d'un Admin_Boutique, afin d'assurer le support technique sans demander ses credentials.

#### Critères d'acceptation

1. WHEN le Superadmin déclenche l'impersonation d'un tenant, THE Système SHALL émettre un JWT temporaire contenant le `tenantId` du tenant cible, le `role` `admin`, et un champ `impersonatedBy` égal à l'identifiant du Superadmin.
2. THE JWT d'impersonation SHALL avoir une durée de validité maximale de 2 heures.
3. WHEN une session d'impersonation est active, THE Interface SHALL afficher une bannière visible indiquant que le Superadmin opère en mode impersonation, avec le nom de la boutique cible.
4. WHEN le Superadmin met fin à la session d'impersonation, THE Système SHALL invalider le JWT d'impersonation et restaurer la session Superadmin.
5. THE Système SHALL enregistrer dans l'Audit_Log de la boutique cible chaque démarrage et fin de session d'impersonation, avec l'identifiant du Superadmin, le timestamp et l'adresse IP.

---

### Requirement 7 : Plans et limites d'abonnement

**User Story :** En tant que Superadmin, je veux appliquer des limites d'usage par plan, afin de différencier les offres et d'inciter les boutiques à upgrader.

#### Critères d'acceptation

1. THE Système SHALL définir les limites suivantes pour le plan `starter` : 2 utilisateurs maximum, 500 produits maximum, 1 magasin maximum, fonctionnalité de captures de leads désactivée, fonctionnalité WhatsApp bot désactivée.
2. THE Système SHALL définir les limites suivantes pour le plan `pro` : 10 utilisateurs maximum, produits illimités, 3 magasins maximum, captures de leads activée, WhatsApp bot activé.
3. THE Système SHALL définir les limites suivantes pour le plan `enterprise` : utilisateurs illimités, produits illimités, magasins illimités, domaine personnalisé activé, support prioritaire, accès API activé.
4. WHEN une requête de création d'un utilisateur est reçue pour un tenant ayant atteint sa limite d'utilisateurs selon son Plan, THE API_Guard SHALL rejeter la requête avec un statut 403 et un message précisant la limite atteinte et le plan supérieur disponible.
5. WHEN une requête de création d'un produit est reçue pour un tenant ayant atteint sa limite de produits selon son Plan, THE API_Guard SHALL rejeter la requête avec un statut 403 et un message précisant la limite atteinte et le plan supérieur disponible.
6. WHEN une requête de création d'un magasin est reçue pour un tenant ayant atteint sa limite de magasins selon son Plan, THE API_Guard SHALL rejeter la requête avec un statut 403 et un message précisant la limite atteinte et le plan supérieur disponible.
7. WHEN une requête est reçue pour utiliser la fonctionnalité de captures de leads pour un tenant sur le plan `starter`, THE API_Guard SHALL rejeter la requête avec un statut 403.

---

### Requirement 8 : Onboarding d'une nouvelle boutique

**User Story :** En tant qu'Admin_Boutique nouvellement créé, je veux être guidé lors de ma première connexion, afin de configurer ma boutique rapidement et efficacement.

#### Critères d'acceptation

1. WHEN une boutique est créée par le Superadmin, THE Système SHALL créer le tenant en base de données, créer l'utilisateur Admin_Boutique avec un mot de passe temporaire généré aléatoirement d'au moins 12 caractères, et envoyer un email de bienvenue contenant les credentials et le lien d'accès à la boutique dans un délai de 5 minutes.
2. WHEN l'Admin_Boutique se connecte pour la première fois (détecté par un flag `premiere_connexion` sur l'utilisateur), THE Onboarding_Wizard SHALL démarrer automatiquement.
3. THE Onboarding_Wizard SHALL guider l'Admin_Boutique en 5 étapes séquentielles : (1) configuration entreprise, (2) création du premier produit, (3) création du premier client, (4) création de la première commande, (5) invitation d'un collègue.
4. WHEN l'Admin_Boutique complète une étape de l'Onboarding_Wizard, THE Onboarding_Wizard SHALL enregistrer la progression et permettre de reprendre là où l'Admin_Boutique s'est arrêté lors d'une session ultérieure.
5. WHEN l'Admin_Boutique accepte le pré-remplissage de données de démonstration lors de la création de la boutique, THE Système SHALL insérer des catégories et des produits de démonstration dans le tenant, tous scopés au `tenant_id` du nouveau tenant.
6. WHEN l'Admin_Boutique ignore ou complète l'Onboarding_Wizard, THE Système SHALL mettre à jour le flag `premiere_connexion` à `false` sur l'utilisateur.

---

### Requirement 9 : Routage multi-boutiques

**User Story :** En tant qu'Admin_Boutique, je veux accéder à ma boutique via une URL dédiée (sous-domaine ou path), afin d'avoir une expérience personnalisée et isolée.

#### Critères d'acceptation

1. WHEN l'Application_React reçoit une requête sur un sous-domaine de format `{slug}.kiosq.app`, THE Application_React SHALL résoudre le tenant correspondant au `slug` et stocker le `tenantId` dans le contexte de l'application.
2. WHEN l'Application_React reçoit une requête sur le chemin `/app/{slug}`, THE Application_React SHALL résoudre le tenant correspondant au `slug` et stocker le `tenantId` dans le contexte de l'application.
3. IF aucun tenant ne correspond au `slug` extrait de l'URL, THEN THE Application_React SHALL afficher une page d'erreur 404 avec un message indiquant que la boutique n'existe pas.
4. WHEN le `tenantId` est résolu depuis l'URL, THE Application_React SHALL transmettre le `tenantId` dans toutes les requêtes API via un en-tête `X-Tenant-ID`.
5. THE API_Guard SHALL vérifier la cohérence entre le `tenantId` du JWT et le `tenantId` de l'en-tête `X-Tenant-ID` pour les requêtes non-Superadmin.
6. WHERE le plan `enterprise` est actif pour un tenant, THE Système SHALL permettre l'accès via un domaine personnalisé configuré dans la colonne `domaine` du tenant.

---

### Requirement 10 : Notifications de dépassement de limite (upsell)

**User Story :** En tant qu'Admin_Boutique, je veux être notifié lorsque j'approche des limites de mon plan, afin d'anticiper un upgrade avant d'être bloqué.

#### Critères d'acceptation

1. WHEN l'usage d'une ressource limitée (utilisateurs, produits, magasins) d'un tenant atteint 80% de la Limite_Plan, THE Système SHALL créer une notification in-app pour tous les utilisateurs avec le rôle `admin` du tenant, indiquant la ressource concernée, le niveau d'usage actuel et le plan supérieur recommandé.
2. WHEN l'usage d'une ressource limitée d'un tenant atteint 80% de la Limite_Plan pour la première fois, THE Système SHALL envoyer un email de notification à l'adresse email enregistrée du tenant.
3. THE Système SHALL ne pas envoyer plus d'une notification email par ressource par période de 7 jours pour un même tenant.
4. IF l'usage d'une ressource limitée dépasse 100% de la Limite_Plan (cas de données héritées), THEN THE Système SHALL bloquer les nouvelles créations conformément au Requirement 7 et maintenir une notification in-app persistante.

---

### Requirement 11 : Audit log par boutique

**User Story :** En tant qu'Admin_Boutique, je veux consulter l'historique des actions importantes réalisées dans ma boutique, afin de détecter des activités anormales et de respecter mes obligations de traçabilité.

#### Critères d'acceptation

1. THE Système SHALL créer une table `audit_logs` avec les colonnes : `id` (text, PK), `tenant_id` (text, NOT NULL, FK → `tenants.id`), `user_id` (text, nullable, FK → `users.id`), `action` (text, NOT NULL), `resource_type` (text, NOT NULL), `resource_id` (text, nullable), `details` (jsonb, nullable), `ip_address` (text, nullable), `created_at` (timestamp, NOT NULL).
2. THE Système SHALL enregistrer un Audit_Log pour chacune des actions suivantes : création/modification/suppression d'une facture, création/suppression d'un produit, connexion d'un utilisateur, déconnexion d'un utilisateur, création/désactivation d'un utilisateur, démarrage/fin d'une session d'impersonation.
3. WHEN un Admin_Boutique accède à la page Configuration → Audit, THE Interface SHALL afficher les entrées d'Audit_Log du tenant filtrées par `tenant_id`, triées par date décroissante, avec pagination de 50 entrées par page.
4. WHEN un Admin_Boutique filtre les Audit_Log par `action`, `user_id` ou plage de dates, THE Interface SHALL mettre à jour l'affichage en moins de 2 secondes.
5. THE Système SHALL conserver les Audit_Log pendant une durée minimale de 90 jours.

---

### Requirement 12 : Statistiques d'usage de l'abonnement

**User Story :** En tant qu'Admin_Boutique, je veux voir l'utilisation actuelle de mon abonnement par rapport aux limites de mon plan, afin de prendre des décisions éclairées sur un éventuel upgrade.

#### Critères d'acceptation

1. WHEN un Admin_Boutique accède à la page Configuration → Mon Abonnement, THE Interface SHALL afficher pour chaque ressource limitée : le nombre actuel utilisé, la Limite_Plan correspondante, et un indicateur visuel de progression (ex : « 7/10 utilisateurs »).
2. THE Interface SHALL afficher le plan actif du tenant, le statut de l'abonnement, et la date de fin d'essai si le statut est `essai`.
3. WHEN un Admin_Boutique clique sur « Upgrader », THE Interface SHALL afficher un comparatif des plans disponibles avec les fonctionnalités et limites de chaque plan.
4. THE Système SHALL recalculer les statistiques d'usage en temps réel lors de chaque affichage de la page Mon Abonnement, sans mise en cache supérieure à 60 secondes.

---

### Requirement 13 : Tableau de bord comparatif (superadmin)

**User Story :** En tant que Superadmin, je veux comparer les performances anonymisées des boutiques, afin d'identifier les meilleures pratiques et d'améliorer l'accompagnement client.

#### Critères d'acceptation

1. WHEN le Superadmin accède au tableau de bord comparatif, THE Dashboard_Comparatif SHALL agréger les métriques suivantes pour chaque tenant : chiffre d'affaires mensuel, nombre de commandes, nombre de clients actifs, taux de conversion devis→commande.
2. THE Dashboard_Comparatif SHALL afficher les métriques de chaque boutique en les identifiant uniquement par un identifiant anonymisé, sauf si le Superadmin choisit explicitement d'afficher le nom réel.
3. THE Dashboard_Comparatif SHALL permettre le filtrage par plan et par pays.

---

### Requirement 14 : Marketplace de templates de catalogue

**User Story :** En tant qu'Admin_Boutique, je veux exporter mon catalogue comme template réutilisable, afin de partager ma structure de produits avec d'autres boutiques du même secteur.

#### Critères d'acceptation

1. WHEN un Admin_Boutique exporte son catalogue, THE Système SHALL créer un Template_Catalogue contenant les catégories et les produits (désignation, description, référence, prix indicatifs) du tenant, en excluant toutes les données clients, commandes et factures.
2. THE Template_Catalogue SHALL être identifié par un nom, une description et un secteur d'activité fournis par l'Admin_Boutique exportateur.
3. WHEN un Admin_Boutique importe un Template_Catalogue, THE Système SHALL créer les catégories et produits du template dans le tenant importateur, tous scopés au `tenant_id` de ce tenant.
4. IF un produit importé depuis un template possède une référence déjà existante dans le tenant importateur, THEN THE Système SHALL ajouter un suffixe numérique à la référence pour éviter les conflits (ex : `REF-001-2`).
5. THE Système SHALL ne jamais inclure de `tenant_id`, d'identifiants clients ou de données financières réelles dans un Template_Catalogue exporté.

---

### Requirement 15 : Clonage de boutique (superadmin)

**User Story :** En tant que Superadmin, je veux dupliquer la configuration et le catalogue d'une boutique existante, afin de créer rapidement une nouvelle boutique similaire.

#### Critères d'acceptation

1. WHEN le Superadmin déclenche le clonage d'un tenant source, THE Système SHALL créer un nouveau tenant avec un nouveau `id`, `slug` et `email` fournis par le Superadmin, en copiant la configuration (paramètres), les catégories et les produits du tenant source.
2. THE Système SHALL exclure du clonage toutes les données suivantes du tenant source : clients, commandes, factures, commandes fournisseurs, utilisateurs, leads, audit logs.
3. THE Système SHALL attribuer au tenant cloné le plan `starter` par défaut, sauf indication contraire du Superadmin au moment du clonage.
4. THE Système SHALL créer un utilisateur Admin_Boutique pour le tenant cloné et envoyer un email de bienvenue conformément au Requirement 8.1.

---

### Requirement 16 : Mode maintenance par boutique (superadmin)

**User Story :** En tant que Superadmin, je veux mettre une boutique en maintenance sans affecter les autres boutiques, afin d'effectuer des opérations techniques ciblées.

#### Critères d'acceptation

1. WHEN le Superadmin active le mode maintenance pour un tenant, THE Système SHALL enregistrer un flag `en_maintenance` et un `message_maintenance` (texte personnalisé) sur le tenant.
2. WHILE le flag `en_maintenance` est actif pour un tenant, THE API_Guard SHALL rejeter toutes les requêtes des utilisateurs de ce tenant (hors Superadmin) avec un statut 503 accompagné du `message_maintenance` personnalisé.
3. WHILE le flag `en_maintenance` est actif pour un tenant, THE Interface SHALL afficher le `message_maintenance` à la place de l'application pour les utilisateurs du tenant concerné.
4. WHEN le Superadmin désactive le mode maintenance pour un tenant, THE Système SHALL supprimer le flag `en_maintenance` et rétablir l'accès normal des utilisateurs du tenant dans un délai de 30 secondes.
5. THE Système SHALL ne pas affecter le fonctionnement des autres tenants lors de l'activation ou désactivation du mode maintenance d'un tenant donné.

---

### Requirement 17 : Parseur et sérialiseur de configuration de tenant

**User Story :** En tant que développeur, je veux pouvoir sérialiser et désérialiser la configuration complète d'un tenant, afin de faciliter les opérations d'export, de clonage et de restauration.

#### Critères d'acceptation

1. WHEN une configuration de tenant est fournie au Parseur_Configuration, THE Parseur_Configuration SHALL la désérialiser en un objet `TenantConfig` structuré contenant toutes les colonnes de la table `tenants`.
2. IF une configuration de tenant invalide est fournie au Parseur_Configuration, THEN THE Parseur_Configuration SHALL retourner une erreur descriptive identifiant les champs manquants ou invalides.
3. THE Pretty_Printer SHALL sérialiser un objet `TenantConfig` en un format JSON valide et lisible.
4. FOR ALL objets `TenantConfig` valides, la désérialisation puis la sérialisation puis la désérialisation SHALL produire un objet équivalent à l'objet initial (propriété round-trip).
