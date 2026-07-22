# Plan d'implémentation : Gestion Multi-Tenant

## Vue d'ensemble

Transformation de Kiosq d'un ERP mono-tenant en plateforme SaaS multi-boutiques. La migration s'effectue en 10 groupes séquentiels : fondations DB, middleware API, routes d'authentification, migration des routes existantes, routes superadmin, routes tenant, tests, frontend fondations, backoffice superadmin et fonctionnalités tenant.

## Tâches

- [x] 1. Groupe 1 — Fondations DB

  - [x] 1.1 Créer les enums et la table `tenants` dans `db/schema.ts`
    - Ajouter `planEnum` (`starter | pro | enterprise`) et `statutTenantEnum` (`actif | suspendu | essai`)
    - Définir la table `tenants` avec toutes ses colonnes selon le design : `id`, `nom`, `slug` (UNIQUE), `domaine`, `plan`, `statut`, `dateEssaiFin`, `logoUrl`, `devise`, `pays`, `telephone`, `email`, `adresse`, `enMaintenance`, `messageMaintenance`, `createdAt`, `updatedAt`
    - Exporter `TenantRow = typeof tenants.$inferSelect`
    - _Requirements : 2.1, 2.2, 2.5, 2.6_

  - [x] 1.2 Ajouter `tenant_id` à toutes les tables métier + champs onboarding sur `users`
    - Ajouter `tenantId: text('tenant_id').notNull().references(() => tenants.id)` sur : `categories`, `magasins`, `fournisseurs`, `produits`, `clients`, `commandes`, `factures`, `commandes_fournisseurs`, `parametres`, `unites`, `groupes_surveilles`, `leads`
    - Ajouter `tenantId: text('tenant_id').references(() => tenants.id)` (nullable) sur `users`
    - Ajouter `premiereConnexion: boolean('premiere_connexion').notNull().default(true)` sur `users`
    - Ajouter `onboardingStep: integer('onboarding_step').notNull().default(0)` sur `users`
    - _Requirements : 1.1, 1.2, 8.2_

  - [x] 1.3 Créer la table `audit_logs` dans `db/schema.ts`
    - Définir la table avec : `id`, `tenantId` (FK → tenants), `userId` (nullable, FK → users), `action`, `resourceType`, `resourceId`, `details` (jsonb), `ipAddress`, `createdAt`
    - Exporter `AuditLogRow = typeof auditLogs.$inferSelect`
    - _Requirements : 11.1_

  - [x] 1.4 Créer la table `catalogue_templates` dans `db/schema.ts`
    - Définir la table avec : `id`, `tenantId` (FK → tenants), `nom`, `description`, `secteurActivite`, `payload` (jsonb — `{ categories: [], produits: [] }`), `createdAt`
    - Exporter `CatalogueTemplateRow = typeof catalogueTemplates.$inferSelect`
    - _Requirements : 14.1, 14.2_

  - [x] 1.5 Créer et exécuter le script de migration `db/migrate-to-multitenant.ts`
    - Créer le tenant `"Kiosq Default"` (`id: 'tenant-default'`, `slug: 'default'`, `plan: 'enterprise'`, `statut: 'actif'`)
    - Créer le compte superadmin (`email: 'superadmin@kiosq.app'`, `role: 'superadmin'`, `tenantId: null`)
    - `UPDATE` toutes les tables métier `SET tenant_id = 'tenant-default'` pour les enregistrements sans `tenant_id`
    - Ajouter la contrainte `NOT NULL` sur `tenant_id` (sauf `users` qui reste nullable)
    - Créer les index `CREATE INDEX idx_{table}_tenant_id ON {table}(tenant_id)` sur toutes les tables métier
    - _Requirements : 1.7_


- [x] 2. Groupe 2 — Middleware et helpers API

  - [x] 2.1 Étendre `api/_lib/auth.ts` : `signToken` avec `tenantId`, `requireTenantAuth`, `requireSuperadmin`
    - Étendre le type `AuthContext` avec `tenantId: string | null` et `impersonatedBy?: string`
    - Modifier `signToken` pour accepter `tenantId?: string | null`, `impersonatedBy?: string` et `expiresIn?: string` (défaut `'7d'`)
    - Ajouter `requireTenantAuth` : vérifie JWT, extrait `tenantId`, charge le tenant en DB, vérifie statut (`suspendu` → 403, essai expiré → 403, maintenance → 503)
    - Ajouter `requireSuperadmin` : vérifie `ctx.role === 'superadmin'`, retourne 403 sinon
    - Vérifier la cohérence de l'en-tête `X-Tenant-ID` avec le `tenantId` JWT (retourner 403 si incohérence)
    - _Requirements : 1.3, 1.4, 3.1, 3.2, 3.3, 3.4, 3.5, 9.4, 9.5, 16.2_

  - [x] 2.2 Créer `api/_lib/planLimits.ts` avec `PLAN_LIMITS`, `checkPlanLimit`, `getPlanLimitForResource`
    - Définir `PLAN_LIMITS` pour `starter` (2 users, 500 produits, 1 magasin, leads: false, whatsapp: false), `pro` (10 users, ∞ produits, 3 magasins, leads: true, whatsapp: true), `enterprise` (∞ tout, domaine perso: true)
    - Implémenter `checkPlanLimit(db, tenantId, resource, res)` : compte les enregistrements existants, compare à la limite, retourne 403 avec message si atteinte (`"Limite de {ressource} atteinte pour le plan {plan}. Passez au plan {plan_supérieur}."`)
    - Implémenter `getPlanLimitForResource(plan, resource)` : retourne le plafond numérique
    - _Requirements : 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

  - [x] 2.3 Créer `api/_lib/auditLog.ts` : helper `logAction`
    - Implémenter `logAction(db, tenantId, userId, action, resourceType, resourceId?, details?, ipAddress?)` qui insère dans `audit_logs` avec `nanoid()` comme id
    - Exporter les constantes d'actions auditées : `'facture.created'`, `'facture.updated'`, `'facture.deleted'`, `'produit.created'`, `'produit.deleted'`, `'user.login'`, `'user.logout'`, `'user.created'`, `'user.disabled'`, `'impersonation.start'`, `'impersonation.end'`
    - _Requirements : 11.2_


- [x] 3. Groupe 3 — Routes de résolution et authentification

  - [x] 3.1 Créer `api/tenants/resolve.ts` (GET ?slug=xxx)
    - Accepter uniquement la méthode GET, sans authentification requise (route publique)
    - Chercher le tenant par `slug` (exact match) ou par `domaine` (pour domaines personnalisés plan enterprise)
    - Retourner `{ tenantId, slug, nom, plan, statut }` ou 404 si introuvable
    - Mettre en cache côté client via headers `Cache-Control: max-age=60`
    - _Requirements : 9.1, 9.2, 9.3, 9.6_

  - [x] 3.2 Mettre à jour `api/auth/login.ts` pour inclure `tenantId` dans le JWT
    - Charger l'utilisateur + son `tenantId` depuis la DB lors du login
    - Appeler le `signToken` étendu avec `tenantId` (null si superadmin)
    - Enregistrer un `logAction` avec `'user.login'` après authentification réussie
    - _Requirements : 3.1, 3.2, 11.2_

  - [x] 3.3 Créer `api/auth/impersonate.ts` (POST, superadmin only)
    - Protéger avec `requireSuperadmin`
    - Recevoir `{ tenantId }` dans le body
    - Charger l'Admin_Boutique principal du tenant (rôle `admin`)
    - Émettre un JWT avec `tenantId`, `role: 'admin'`, `impersonatedBy: ctx.sub`, `expiresIn: '2h'`
    - Enregistrer `logAction` dans `audit_logs` du tenant cible : `'impersonation.start'`
    - _Requirements : 6.1, 6.2, 6.5_


- [x] 4. Groupe 4 — Migration des routes existantes

  - [x] 4.1 Migrer les routes `api/produits/` (+ checkPlanLimit)
    - Remplacer `requireAuth` par `requireTenantAuth` dans `api/produits/index.ts` et `api/produits/[id].ts`
    - Ajouter `.where(eq(produits.tenantId, ctx.tenantId!))` dans toutes les requêtes SELECT
    - Ajouter `if (!await checkPlanLimit(db, ctx.tenantId!, 'produits', res)) return;` avant INSERT
    - Ajouter `logAction` pour `'produit.created'` et `'produit.deleted'`
    - _Requirements : 1.5, 1.6, 7.5, 11.2_

  - [x] 4.2 Migrer les routes `api/clients/`
    - Remplacer `requireAuth` par `requireTenantAuth` dans `api/clients/index.ts`, `api/clients/[id].ts`, `api/clients/[id]/reglement.ts`, `api/clients/[id]/annuler-reglement.ts`
    - Ajouter le filtre `tenantId` dans toutes les requêtes SELECT, INSERT, UPDATE, DELETE
    - _Requirements : 1.5, 1.6_

  - [x] 4.3 Migrer les routes `api/commandes/`
    - Remplacer `requireAuth` par `requireTenantAuth` dans `api/commandes/index.ts` et `api/commandes/[id].ts`
    - Ajouter le filtre `tenantId` dans toutes les requêtes
    - _Requirements : 1.5, 1.6_

  - [x] 4.4 Migrer les routes `api/factures/`
    - Remplacer `requireAuth` par `requireTenantAuth` dans `api/factures/index.ts`, `api/factures/[id].ts`, `api/factures/[id]/retour.ts`
    - Ajouter le filtre `tenantId` dans toutes les requêtes
    - Ajouter `logAction` pour `'facture.created'`, `'facture.updated'`, `'facture.deleted'`
    - _Requirements : 1.5, 1.6, 11.2_

  - [x] 4.5 Migrer les routes `api/fournisseurs/`
    - Remplacer `requireAuth` par `requireTenantAuth` dans `api/fournisseurs/index.ts`, `api/fournisseurs/[id].ts`, `api/fournisseurs/[id]/reglement.ts`, `api/fournisseurs/[id]/annuler-reglement.ts`
    - Ajouter le filtre `tenantId` dans toutes les requêtes
    - _Requirements : 1.5, 1.6_

  - [x] 4.6 Migrer les routes `api/categories/`, `api/magasins/`, `api/unites/`
    - Appliquer le même pattern (`requireTenantAuth` + filtre `tenantId`) dans les 6 fichiers concernés
    - Ajouter `checkPlanLimit` pour `'magasins'` avant chaque INSERT dans `api/magasins/`
    - _Requirements : 1.5, 1.6, 7.6_

  - [x] 4.7 Migrer les routes `api/leads/` et `api/groupes-surveilles/`
    - Remplacer `requireAuth` par `requireTenantAuth` dans les 4 fichiers concernés
    - Ajouter le filtre `tenantId` dans toutes les requêtes
    - Rejeter les requêtes de création de lead avec 403 si `PLAN_LIMITS[plan].leads === false`
    - _Requirements : 1.5, 1.6, 7.7_

  - [x] 4.8 Migrer les routes `api/parametres/`, `api/pos/`, `api/dashboard/`
    - Remplacer `requireAuth` par `requireTenantAuth` dans `api/parametres/index.ts`, `api/pos/vente.ts`, `api/dashboard/stats/index.ts`
    - Ajouter le filtre `tenantId` dans toutes les requêtes
    - Migrer également `api/utilisateurs/index.ts` et `api/utilisateurs/[id].ts` avec `checkPlanLimit` pour `'users'` + `logAction` pour `'user.created'` et `'user.disabled'`
    - _Requirements : 1.5, 1.6, 7.4, 11.2_


- [x] 5. Groupe 5 — Routes superadmin

  - [x] 5.1 Créer `api/superadmin/tenants/index.ts` (GET liste + POST créer)
    - Protéger avec `requireSuperadmin`
    - GET : lister tous les tenants avec agrégats (nombre d'utilisateurs, CA total) ; supporter filtre `statut`, `plan` et `q` (recherche sur nom/slug)
    - POST : valider le body (nom, email admin, plan, devise, pays), générer un `slug` avec `generateSlug`, créer le tenant en DB, créer l'utilisateur Admin_Boutique avec mot de passe temporaire (≥12 chars, `nanoid(12)`), simuler l'envoi d'email de bienvenue (log console en dev)
    - _Requirements : 5.1, 5.2, 5.3, 5.4, 8.1_

  - [x] 5.2 Créer `api/superadmin/tenants/[id].ts` (GET + PATCH + DELETE)
    - Protéger avec `requireSuperadmin`
    - GET : retourner toutes les colonnes du tenant + liste de ses utilisateurs
    - PATCH : permettre la modification de `plan`, `statut`, `enMaintenance`, `messageMaintenance` ; recalculer immédiatement les limites si plan changé
    - DELETE : supprimer le tenant (soft delete via statut ou delete réel selon politique)
    - _Requirements : 5.5, 5.6, 5.7, 5.8, 16.1, 16.4_

  - [x] 5.3 Créer `api/superadmin/tenants/[id]/impersonate.ts` (POST)
    - Protéger avec `requireSuperadmin`
    - Déléguer à la logique de `api/auth/impersonate.ts` en passant le `tenantId` de l'URL
    - Retourner le JWT temporaire et le nom de la boutique
    - _Requirements : 6.1, 6.2, 6.5_

  - [x] 5.4 Créer `api/superadmin/tenants/[id]/clone.ts` (POST)
    - Protéger avec `requireSuperadmin`
    - Recevoir `{ nom, email, slug?, plan? }` pour le tenant cible
    - Copier depuis le tenant source : `parametres`, `categories`, `produits` (tous scopés au nouveau `tenantId`)
    - Exclure : clients, commandes, factures, commandes fournisseurs, utilisateurs, leads, audit logs
    - Attribuer `plan: 'starter'` par défaut si non spécifié
    - Créer l'Admin_Boutique du clone et envoyer l'email de bienvenue
    - _Requirements : 15.1, 15.2, 15.3, 15.4_

  - [x] 5.5 Créer `api/superadmin/stats.ts` (GET KPIs + MRR + courbe 12 mois)
    - Protéger avec `requireSuperadmin`
    - Calculer : nombre total de boutiques, nombre par statut (`actif`, `essai`, `suspendu`), MRR (tarifs configurables), taux de conversion essai→actif sur 90 jours
    - Construire la courbe des 12 derniers mois (nouvelles boutiques créées par mois via `GROUP BY date_trunc('month', created_at)`)
    - _Requirements : 4.3, 4.4, 4.5, 4.6_


- [x] 6. Groupe 6 — Routes tenant

  - [x] 6.1 Créer `api/audit-logs/index.ts` (GET paginé et filtré)
    - Protéger avec `requireTenantAuth`
    - Filtrer par `tenant_id = ctx.tenantId` obligatoirement
    - Supporter les paramètres de filtre : `action`, `userId`, `dateDebut`, `dateFin`
    - Pagination : 50 entrées par page avec paramètre `page` ; retourner `{ items, total, page, totalPages }`
    - Tri par `createdAt` décroissant
    - _Requirements : 11.3, 11.4, 11.5_

  - [x] 6.2 Créer `api/abonnement/index.ts` (GET usage vs limites)
    - Protéger avec `requireTenantAuth`
    - Compter en temps réel : nombre d'utilisateurs actifs, de produits actifs, de magasins actifs du tenant
    - Retourner `{ plan, statut, dateEssaiFin, usage: { users, produits, magasins }, limites: { users, produits, magasins } }`
    - Ne pas mettre en cache plus de 60 secondes (header `Cache-Control: max-age=60`)
    - _Requirements : 12.1, 12.2, 12.4_

  - [x] 6.3 Créer `api/onboarding/index.ts` (GET + PATCH progression wizard)
    - Protéger avec `requireTenantAuth`
    - GET : retourner `{ premiereConnexion, onboardingStep }` de l'utilisateur courant
    - PATCH : mettre à jour `onboardingStep` (0–5) ; mettre `premiereConnexion = false` si step = 5 ou si l'utilisateur ignore explicitement (body `{ ignore: true }`)
    - _Requirements : 8.2, 8.3, 8.4, 8.6_

  - [x] 6.4 Créer `api/templates/index.ts` (GET marketplace + POST export)
    - Protéger avec `requireTenantAuth`
    - GET : lister tous les `catalogue_templates` (marketplace) avec filtre optionnel `secteurActivite`
    - POST : recevoir `{ nom, description, secteurActivite }`, construire le `payload` depuis les catégories et produits du tenant (exclure `tenantId`, données clients, données financières réelles), insérer dans `catalogue_templates`
    - _Requirements : 14.1, 14.2, 14.5_

  - [x] 6.5 Créer `api/templates/[id]/import.ts` (POST import avec déduplication)
    - Protéger avec `requireTenantAuth`
    - Charger le template par `id`, extraire le `payload`
    - Pour chaque catégorie : créer si absente (par nom), sinon réutiliser l'existante
    - Pour chaque produit : si la référence existe déjà dans le tenant, ajouter un suffixe numérique (`REF-001-2`, `REF-001-3`…)
    - Insérer toutes les entités scopées au `tenantId` du tenant importateur
    - _Requirements : 14.3, 14.4, 14.5_


- [x] 7. Point de contrôle — Vérifier que tous les tests passent
  - S'assurer que les tests backend existants passent après les migrations de routes
  - Demander à l'utilisateur si des questions se posent avant de continuer avec le frontend

- [x] 8. Groupe 7 — Tests property-based et unitaires

  - [x] 8.1 Propriété 1 : Isolation des données entre tenants
    - **Propriété 1 : Isolation des données entre tenants**
    - Générer deux tenants A et B distincts avec `fc.record({ tenantId: fc.uuidV4() })`
    - Vérifier qu'une requête avec le JWT du tenant A sur des ressources du tenant B retourne 404 ou liste vide
    - **Valide : Requirements 1.5, 1.6**

  - [x] 8.2 Propriété 2 : Round-trip du JWT tenant
    - **Propriété 2 : Round-trip du JWT tenant**
    - Générer des payloads `{ sub, email, role, nom, prenom, tenantId }` avec `fc.record`
    - Vérifier que `verifyToken(await signToken(payload)).tenantId === payload.tenantId`
    - **Valide : Requirements 3.1, 1.3**

  - [x] 8.3 Propriété 3 : Rejet des tenants non actifs
    - **Propriété 3 : Rejet des tenants non actifs**
    - Générer des tenants avec statut `suspendu`, essai expiré ou `enMaintenance: true`
    - Vérifier que `requireTenantAuth` retourne un code 4xx ou 503 (jamais 2xx)
    - **Valide : Requirements 3.4, 3.5, 16.2**

  - [x] 8.4 Propriété 4 : Génération de slug URL-safe
    - **Propriété 4 : Génération de slug URL-safe**
    - Générer des noms arbitraires non vides avec `fc.string({ minLength: 1 })`
    - Vérifier que `generateSlug(nom)` : correspond à `[a-z0-9-]+`, commence et finit par `[a-z0-9]`, a longueur ≥ 1
    - **Valide : Requirements 2.3**

  - [x] 8.5 Propriété 5 : Monotonie des limites de plan
    - **Propriété 5 : Monotonie des limites de plan**
    - Pour chaque ressource numérique (`users`, `produits`, `magasins`)
    - Vérifier `PLAN_LIMITS.pro[r] >= PLAN_LIMITS.starter[r]` et `PLAN_LIMITS.enterprise[r] >= PLAN_LIMITS.pro[r]`
    - **Valide : Requirements 7.1, 7.2, 7.3**

  - [x] 8.6 Propriété 6 : Rejet à l'atteinte des limites de plan
    - **Propriété 6 : Rejet à l'atteinte des limites de plan**
    - Générer un tenant dont l'usage est exactement égal à sa limite avec `fc.constantFrom('starter', 'pro')`
    - Vérifier que `checkPlanLimit` retourne `false` et écrit une réponse 403
    - **Valide : Requirements 7.4, 7.5, 7.6**

  - [x] 8.7 Propriété 7 : Scope du JWT d'impersonation
    - **Propriété 7 : Scope du JWT d'impersonation**
    - Générer des couples (superadminId, tenantId) aléatoires
    - Vérifier que le JWT émis satisfait : `tenantId === T.id`, `impersonatedBy === S.id`, `role === 'admin'`, `exp - iat <= 7200`
    - **Valide : Requirements 6.1, 6.2**

  - [x] 8.8 Propriété 8 : Complétude des audit logs
    - **Propriété 8 : Complétude des audit logs**
    - Pour chaque action de la liste (Requirement 11.2), vérifier que le count d'`audit_logs` pour `(tenantId, action)` est incrémenté de 1 après l'exécution de l'action
    - **Valide : Requirements 11.2**

  - [x] 8.9 Propriété 9 : Round-trip de TenantConfig
    - **Propriété 9 : Round-trip de TenantConfig**
    - Générer des objets `TenantConfig` valides complets avec `fc.record`
    - Vérifier que `parseTenantConfig(serializeTenantConfig(config))` ≅ `config` (toutes les propriétés équivalentes)
    - **Valide : Requirements 17.4, 17.1, 17.3**

  - [x] 8.10 Propriété 10 : Round-trip d'export/import de catalogue
    - **Propriété 10 : Round-trip d'export/import de catalogue**
    - Générer des catalogues (catégories + produits) arbitraires
    - Vérifier que l'import après export préserve toutes les désignations, descriptions et références (hors suffixes) dans le tenant importateur
    - **Valide : Requirements 14.1, 14.3, 14.5**

  - [x] 8.11 Propriété 11 : Résolution de tenant depuis l'URL
    - **Propriété 11 : Résolution de tenant depuis l'URL**
    - Pour tout slug d'un tenant existant, vérifier que `resolveTenantFromUrl()` retourne un objet dont `tenantId` correspond exactement à `tenants.id`
    - **Valide : Requirements 9.1, 9.2**


- [x] 9. Groupe 8 — Frontend : fondations

  - [x] 9.1 Créer `src/lib/tenant.ts` (`resolveTenantFromUrl`, `generateSlug`, `getTenantId`)
    - Implémenter `generateSlug(nom: string): string` : transformer en minuscules, remplacer caractères non-alphanumériques par `-`, supprimer tirets en début/fin, garantir longueur ≥ 1
    - Implémenter `resolveTenantFromUrl()` : lire `{slug}.kiosq.app` ou `/app/{slug}`, appeler `GET /api/tenants/resolve?slug=xxx`, mettre en cache dans `sessionStorage` (TTL 60s)
    - Implémenter `getTenantId()` : lire depuis sessionStorage ou le store Zustand
    - Implémenter `parseTenantConfig` et `serializeTenantConfig` pour le type `TenantConfig`
    - _Requirements : 9.1, 9.2, 9.3, 2.3, 17.1, 17.2, 17.3, 17.4_

  - [x] 9.2 Créer `src/contexts/TenantContext.tsx` + `src/store/tenantStore.ts`
    - Créer le store Zustand `tenantStore` avec les champs : `tenantId`, `nom`, `plan`, `statut`, `isImpersonating`, `impersonatedTenantNom` et les méthodes `resolve(slug)` et `clearImpersonation()`
    - Créer `TenantContext` et `useTenant` hook wrappant le store
    - Intégrer `TenantProvider` dans `main.tsx` ou `App.tsx` au niveau racine
    - _Requirements : 9.1, 9.4_

  - [x] 9.3 Mettre à jour `src/lib/api.ts` pour inclure le header `X-Tenant-ID`
    - Modifier le client HTTP pour injecter automatiquement `X-Tenant-ID: getTenantId()` dans chaque requête
    - Gérer le cas `null` (superadmin) en omettant le header
    - _Requirements : 9.4_

  - [x] 9.4 Créer `SuperadminGuard` et mettre à jour `AuthGuard` pour le multitenancy
    - Créer `src/components/auth/SuperadminGuard.tsx` : vérifie `user.role === 'superadmin'`, redirige vers `/login` avec état 403 sinon
    - Mettre à jour `AuthGuard` : en plus de la vérification JWT, vérifier que le tenant est résolu (sinon afficher page de chargement/erreur), bloquer si statut `suspendu` avec message approprié
    - _Requirements : 4.1, 4.2_


- [x] 10. Groupe 9 — Frontend : Backoffice Superadmin

  - [x] 10.1 Créer `SuperadminLayout.tsx` + routes `/superadmin` dans `App.tsx`
    - Créer `src/pages/superadmin/SuperadminLayout.tsx` : layout dédié avec sidebar sombre (fond `#1a1a2e` ou similaire), logo plateforme, navigation vers Dashboard / Boutiques
    - Mettre à jour `App.tsx` : ajouter `<Route path="/superadmin" element={<SuperadminGuard />}>` avec les sous-routes `index`, `boutiques`, `boutiques/new`, `boutiques/:id`
    - _Requirements : 4.1, 4.2_

  - [x] 10.2 Créer `DashboardSuperadminPage.tsx` (KPIs + MRR + courbe Recharts)
    - Afficher les KPIs : nombre total de boutiques, par statut (`actif`, `essai`, `suspendu`), MRR estimé
    - Afficher la courbe 12 mois des nouvelles boutiques avec `Recharts LineChart`
    - Afficher le taux de conversion essai→actif sur 90 jours
    - Consommer `GET /api/superadmin/stats`
    - _Requirements : 4.3, 4.4, 4.5, 4.6_

  - [x] 10.3 Créer `BoutiquesPage.tsx` + `BoutiqueCard.tsx` + `PlanBadge.tsx`
    - `PlanBadge.tsx` : badge coloré avec `starter` (gris), `pro` (bleu), `enterprise` (doré)
    - `BoutiqueCard.tsx` : afficher nom, plan (avec `PlanBadge`), statut, date de création, nombre d'utilisateurs, CA total
    - `BoutiquesPage.tsx` : liste filtrée par statut/plan avec barre de recherche, consommer `GET /api/superadmin/tenants`
    - _Requirements : 5.1, 5.2, 5.3_

  - [x] 10.4 Créer `BoutiqueDetailPage.tsx` (détail + actions + impersonation)
    - Afficher toutes les colonnes du tenant + liste de ses utilisateurs
    - Actions disponibles : modifier le plan (sélecteur), suspendre/réactiver, activer/désactiver maintenance (avec champ message), impersonner
    - Bouton « Impersonner » : appeler `POST /api/superadmin/tenants/:id/impersonate`, stocker le JWT temporaire, mettre à jour `tenantStore.isImpersonating = true`
    - _Requirements : 5.5, 5.6, 5.7, 5.8, 6.3, 16.1, 16.3_

  - [x] 10.5 Créer `CreerBoutiquePage.tsx` (formulaire création boutique)
    - Formulaire avec champs : nom, email admin, plan (sélecteur), devise, pays
    - Afficher le slug auto-généré en temps réel depuis le nom (utiliser `generateSlug`)
    - Soumettre via `POST /api/superadmin/tenants`, afficher confirmation avec credentials générés
    - _Requirements : 5.4, 8.1_

  - [x] 10.6 Créer `ImpersonationBanner.tsx` + intégration dans `AppLayout.tsx`
    - Bannière orange visible en haut de l'application quand `tenantStore.isImpersonating === true`
    - Afficher le nom de la boutique cible et l'identité du superadmin opérateur
    - Bouton « Terminer l'impersonation » : effacer le JWT d'impersonation, appeler `tenantStore.clearImpersonation()`, loguer `'impersonation.end'`
    - Intégrer dans `AppLayout.tsx` (composant layout partagé)
    - _Requirements : 6.3, 6.4, 6.5_


- [x] 11. Groupe 10 — Frontend : Fonctionnalités tenant

  - [x] 11.1 Créer `OnboardingWizard.tsx` (modal 5 étapes) + intégration dans `AppLayout.tsx`
    - Modal plein écran déclenchée automatiquement si `user.premiereConnexion === true` (consommer `GET /api/onboarding`)
    - Étapes séquentielles : (1) configuration entreprise, (2) premier produit, (3) premier client, (4) première commande, (5) inviter un collègue
    - Persistance : appeler `PATCH /api/onboarding { onboardingStep: N }` à chaque étape complétée
    - Bouton « Passer » : appeler `PATCH /api/onboarding { ignore: true }`, fermer la modal
    - Intégrer dans `AppLayout.tsx` : vérifier `premiereConnexion` à chaque montage
    - _Requirements : 8.2, 8.3, 8.4, 8.6_

  - [x] 11.2 Créer `AbonnementPage.tsx` (usage vs limites + comparatif plans)
    - Consommer `GET /api/abonnement` pour afficher plan actif (avec `PlanBadge`), statut, date de fin d'essai
    - Barre de progression pour chaque ressource limitée (ex : `7/10 utilisateurs`) avec indicateur coloré (vert < 80%, orange ≥ 80%, rouge = limite)
    - Tableau comparatif des plans avec fonctionnalités et limites
    - Bouton « Contacter pour upgrader » (lien mailto ou formulaire de contact)
    - Brancher sur la route `/configuration/abonnement` dans `App.tsx`
    - _Requirements : 12.1, 12.2, 12.3, 12.4_

  - [x] 11.3 Créer `AuditPage.tsx` (liste audit logs filtrée)
    - Consommer `GET /api/audit-logs` avec pagination (50/page) et filtres
    - Filtres disponibles : action (sélecteur), utilisateur, plage de dates (date début / date fin)
    - Afficher : date, utilisateur, action, type de ressource, adresse IP
    - Brancher sur la route `/configuration/audit` dans `App.tsx`
    - _Requirements : 11.3, 11.4_

  - [x] 11.4 Créer les pages marketplace de templates (liste + import + export)
    - `TemplatesPage.tsx` : liste les templates disponibles filtrés par `secteurActivite`, avec bouton « Importer »
    - `ExporterCataloguePage.tsx` : formulaire (nom, description, secteur d'activité) pour exporter le catalogue courant via `POST /api/templates`
    - Import : bouton « Importer » sur chaque template → appeler `POST /api/templates/:id/import`, afficher résumé (N catégories, M produits importés)
    - Brancher sur les routes `/templates` et `/templates/exporter` dans `App.tsx`
    - _Requirements : 14.1, 14.2, 14.3, 14.4_

- [x] 12. Point de contrôle final — Vérifier que tous les tests passent
  - S'assurer que l'ensemble des tests (unitaires et property-based) passent
  - Vérifier que le build TypeScript ne produit aucune erreur (`tsc --noEmit`)
  - Demander à l'utilisateur si des questions se posent avant de clore l'implémentation


## Notes

- Les tâches marquées `*` sont optionnelles et peuvent être ignorées pour un MVP rapide
- Chaque tâche référence les requirements spécifiques pour la traçabilité
- Les points de contrôle permettent une validation incrémentale
- Les 11 tests property-based utilisent **fast-check** avec minimum 100 itérations (déjà dans le projet)
- Les routes API suivent le pattern de migration : `requireAuth` → `requireTenantAuth` + filtre `WHERE tenant_id = ctx.tenantId`
- Le script `db/migrate-to-multitenant.ts` est idempotent (peut être relancé sans erreur)

## Graphe de dépendances des tâches

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "1.4"] },
    { "id": 2, "tasks": ["1.5"] },
    { "id": 3, "tasks": ["2.1", "2.2", "2.3"] },
    { "id": 4, "tasks": ["3.1", "3.2", "3.3"] },
    { "id": 5, "tasks": ["4.1", "4.2", "4.3", "4.4", "4.5", "4.6", "4.7", "4.8"] },
    { "id": 6, "tasks": ["5.1", "5.2", "5.3", "5.4", "5.5", "6.1", "6.2", "6.3", "6.4", "6.5"] },
    { "id": 7, "tasks": ["8.1", "8.2", "8.3", "8.4", "8.5", "8.6", "8.7", "8.8", "8.9", "8.10", "8.11"] },
    { "id": 8, "tasks": ["9.1"] },
    { "id": 9, "tasks": ["9.2", "9.3", "9.4"] },
    { "id": 10, "tasks": ["10.1"] },
    { "id": 11, "tasks": ["10.2", "10.3", "10.5"] },
    { "id": 12, "tasks": ["10.4", "10.6"] },
    { "id": 13, "tasks": ["11.1", "11.2", "11.3", "11.4"] }
  ]
}
```
