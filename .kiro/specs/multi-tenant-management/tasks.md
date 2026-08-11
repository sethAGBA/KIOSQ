# Implementation Plan: Multi-Tenant Management

## Overview

Ce plan d'implémentation couvre la gestion multi-tenant complète de KIOSQ : isolation des données, authentification JWT tenant-aware, enregistrement self-service avec onboarding, limites d'usage par plan, backoffice Superadmin, mode maintenance par boutique, résolution de tenant par sous-domaine/header, et interface frontend multi-tenant.

L'implémentation suit un ordre bottom-up : utilitaires et helpers purs en premier, puis les endpoints API, et enfin les composants frontend.

## Task Dependency Graph

```json
{
  "waves": [
    { "wave": 1, "tasks": ["1", "2", "3"] },
    { "wave": 2, "tasks": ["4", "6"] },
    { "wave": 3, "tasks": ["5", "7"] },
    { "wave": 4, "tasks": ["8"] },
    { "wave": 5, "tasks": ["9", "10"] },
    { "wave": 6, "tasks": ["11"] }
  ]
}
```

## Notes

- Les tâches 1, 2 et 3 sont indépendantes et peuvent être développées en parallèle.
- Les tâches marquées **[PBT]** sont des tests property-based utilisant **fast-check** avec minimum 100 itérations.
- La refactorisation de `checkPlanLimit` (tâche 2.2) est un breaking change interne : mettre à jour tous les handlers appelants dans la même tâche (2.3).
- L'extension de `requireTenantAuth` (tâche 3) doit rester rétro-compatible avec les routes existantes.
- `PLAN_LIMITS.starter` dans le code actuel définit `users: 2` et `magasins: 1` — la tâche 2.1 les aligne sur les Requirements (users: 3, magasins: 2).

## Tasks

- [ ] 1. Utilitaires slug (`api/_lib/slugUtils.ts`)
  - [ ] 1.1 Créer `api/_lib/slugUtils.ts` avec `generateSlug(nom: string): string` (minuscules, `[a-z0-9-]`, sans tirets doublons ni tirets en début/fin)
  - [ ] 1.2 Implémenter `generateUniqueSlug(nom: string, db: Db): Promise<string>` ajoutant un suffixe numérique en cas de collision (lookup dans `tenants.slug`)
  - [ ] 1.3 Écrire les tests property-based dans `api/_lib/slugUtils.test.ts`
    - [ ] 1.3.1 **[PBT]** Property 1 : pour tout nom non vide, `generateSlug` retourne un slug au format `[a-z0-9-]+` sans tirets en début/fin ni tirets consécutifs
    - [ ] 1.3.2 **[PBT]** Property 2 : pour tout ensemble de noms produisant le même slug de base, `generateUniqueSlug` retourne des valeurs toutes distinctes
  - **Requirements : 2.3, 2.4**

- [ ] 2. Alignement `PLAN_LIMITS` et refactoring `checkPlanLimit`
  - [ ] 2.1 Mettre à jour `PLAN_LIMITS` dans `api/_lib/planLimits.ts` : `starter = { users: 3, produits: 500, magasins: 2 }`, `pro = { users: 10, produits: 5000, magasins: 10 }`, `enterprise = { users: Infinity, produits: Infinity, magasins: Infinity }`
  - [ ] 2.2 Refactoriser la signature de `checkPlanLimit` pour retourner `Promise<{ allowed: boolean; current: number; max: number }>` sans écrire directement sur `res` (la réponse 403 est déléguée aux handlers)
  - [ ] 2.3 Mettre à jour tous les handlers appelant `checkPlanLimit` (`api/utilisateurs/index.ts`, `api/produits/index.ts`, `api/magasins/index.ts`) pour utiliser la nouvelle signature et retourner le message 403 approprié
  - [ ] 2.4 Écrire les tests property-based dans `api/_lib/planLimits.test.ts`
    - [ ] 2.4.1 **[PBT]** Property 8 : pour tout tenant `starter`/`pro` et toute ressource, `checkPlanLimit` retourne `{ allowed: false }` quand `current >= max` et `{ allowed: true }` quand `current < max`
    - [ ] 2.4.2 **[PBT]** Property 9 : pour tout tenant `enterprise`, toute ressource et tout compteur N, `checkPlanLimit` retourne `{ allowed: true, max: Infinity }`
  - **Requirements : 5.1, 5.2, 5.3, 5.4, 5.5, 5.6**

- [ ] 3. Extension de `requireTenantAuth` : slug resolution + superadmin bypass maintenance
  - [ ] 3.1 Implémenter `resolveTenantBySlug(slug: string, db: Db): Promise<TenantRow | null>` dans `api/_lib/auth.ts`
  - [ ] 3.2 Modifier `requireTenantAuth` pour, si `tenantId` absent du JWT, lire le header `X-Tenant-Slug` et appeler `resolveTenantBySlug`
  - [ ] 3.3 Modifier `requireTenantAuth` pour laisser passer les Superadmin même si `en_maintenance = true` (actuellement bloqué comme les autres)
  - [ ] 3.4 Écrire les tests property-based dans `api/_lib/auth.test.ts`
    - [ ] 3.4.1 **[PBT]** Property 3 : pour tout objet tenant généré aléatoirement, `checkTenantStatus` retourne le bon code (403 suspendu, 403 essai expiré, 503 maintenance, null sinon)
    - [ ] 3.4.2 **[PBT]** Property 4 : pour toute paire `(tenantIdJWT, tenantIdHeader)` distincts non-null, `requireTenantAuth` retourne HTTP 403
    - [ ] 3.4.3 **[PBT]** Property 13 : pour tout slug existant, `resolveTenantBySlug` retourne le tenant correspondant ; pour tout slug absent, retourne null
  - **Requirements : 3.3, 7.2, 8.1, 8.2, 8.3, 8.4**

- [ ] 4. Endpoint `POST /api/tenants/register`
  - [ ] 4.1 Créer `api/tenants/register.ts` avec validation Zod : `nomBoutique` (2–100 chars), `email` (email valide), `password` (min 8 chars), `nom`, `prenom`, `pays` (optionnel), `devise` (optionnel, défaut `XOF`)
  - [ ] 4.2 Implémenter la création atomique en transaction Drizzle : tenant (statut=essai, dateEssaiFin=now+14j, slug via `generateUniqueSlug`), user (role=admin, premiereConnexion=true), parametres (id='default')
  - [ ] 4.3 Implémenter la vérification d'email dupliqué (409 avant la transaction)
  - [ ] 4.4 Signer un JWT et le placer dans un cookie httpOnly à l'issue de l'inscription réussie
  - [ ] 4.5 Écrire les tests dans `api/tenants/register.test.ts`
    - [ ] 4.5.1 **[PBT]** Property 5 : pour tout corps de requête avec au moins un champ invalide, le handler retourne 422 sans créer d'entrée en base
    - [ ] 4.5.2 **[PBT]** Property 6 : pour tout email déjà présent en base, le handler retourne 409 sans créer tenant/user/parametres
    - [ ] 4.5.3 Test d'intégration : inscription valide → 201 + cookie + tenant/user/parametres créés
  - **Requirements : 4.1, 4.2, 4.3, 4.4**

- [ ] 5. Extension de `/api/auth/me` et `/api/auth/profile` pour l'onboarding
  - [ ] 5.1 Modifier `api/auth/me.ts` : joindre la table `tenants` sur `users.tenantId` et inclure dans la réponse `tenantNom`, `tenantSlug`, `tenantPlan`, `tenantStatut`, `tenantDevise`, `tenantLogoUrl`, `tenantDateEssaiFin`, `showOnboarding` (= `premiereConnexion`), `onboardingStep`
  - [ ] 5.2 Modifier `api/auth/profile.ts` : étendre le schema Zod pour accepter `onboardingStep?: number` et `premiereConnexion?: boolean` ; les mettre à jour si présents dans le body
  - [ ] 5.3 Écrire les tests dans `api/auth/me.test.ts`
    - [ ] 5.3.1 **[PBT]** Property 7 : pour tout utilisateur avec `premiereConnexion = true`, `showOnboarding` = true ; pour `false`, `showOnboarding` = false
    - [ ] 5.3.2 **[PBT]** Property 14 : pour tout utilisateur lié à un tenant, la réponse contient tous les champs tenant avec des valeurs cohérentes
  - **Requirements : 4.5, 4.7, 4.8, 9.2**

- [ ] 6. Routes Superadmin : alignement et nouvelles fonctionnalités
  - [ ] 6.1 Vérifier/compléter `GET /api/superadmin/tenants` (pagination, champs requis : nbUtilisateursActifs, nbProduits)
  - [ ] 6.2 Vérifier/compléter `GET /api/superadmin/tenants/:id` (détail + stats)
  - [ ] 6.3 Vérifier/compléter `POST /api/superadmin/tenants` (création directe sans onboarding)
  - [ ] 6.4 Vérifier/compléter `PATCH /api/superadmin/tenants/:id` : accepter `nom`, `plan`, `statut`, `domaine`, `enMaintenance`, `messageMaintenance` ; déclencher l'audit log `TENANT_SUSPENDED` si `statut = 'suspendu'`
  - [ ] 6.5 Créer `api/superadmin/tenants/[id]/impersonate.ts` : générer un JWT avec `role=admin`, `tenantId` cible, `expiresIn='1h'`, `impersonatedBy=superadminId`
  - [ ] 6.6 Vérifier `GET /api/superadmin/stats` : retourner tenants par statut, par plan, MRR estimé
  - [ ] 6.7 Écrire les tests dans `api/superadmin/`
    - [ ] 6.7.1 **[PBT]** Property 10 : pour tout tenantId cible valide, le JWT d'impersonation contient `tenantId`, `role='admin'`, `impersonatedBy`, et expire dans ≤ 1h
    - [ ] 6.7.2 **[PBT]** Property 11 : pour toute distribution de tenants actifs par plan, le MRR = Σ(count_plan × tarif_plan)
    - [ ] 6.7.3 **[PBT]** Property 12 : pour tout appel PATCH avec `statut='suspendu'`, exactement un audit log `TENANT_SUSPENDED` est créé avec `resourceId = tenantId`
  - **Requirements : 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8**

- [ ] 7. Mode maintenance — comportement frontend
  - [ ] 7.1 Créer `src/components/maintenance/MaintenancePage.tsx` : affiche le message reçu dans le body 503 (`error.response.data.message`)
  - [ ] 7.2 Modifier l'intercepteur Axios/fetch global dans `src/lib/api.ts` (ou équivalent) pour détecter les réponses `{ error: "maintenance" }` et rediriger vers `<MaintenancePage message={...} />`
  - [ ] 7.3 Vérifier que le message par défaut `"Maintenance en cours. Revenez bientôt."` est bien appliqué côté backend quand `messageMaintenance` est null (déjà géré dans `checkTenantStatus` — confirmer le comportement)
  - **Requirements : 7.3, 7.4**

- [ ] 8. Frontend : `authStore` enrichi et composants tenant-aware
  - [ ] 8.1 Modifier `src/store/authStore.ts` (ou `appStore.ts`) pour stocker `tenantId`, `tenantNom`, `tenantSlug`, `tenantPlan`, `tenantStatut`, `tenantDevise`, `tenantLogoUrl`, `tenantDateEssaiFin`, `showOnboarding`, `onboardingStep`
  - [ ] 8.2 Mettre à jour l'action `fetchMe` (ou équivalent) pour populer ces champs depuis la réponse `/api/auth/me`
  - [ ] 8.3 Modifier `src/components/layout/TopBar.tsx` (ou équivalent) pour afficher `tenantNom` et `tenantLogoUrl`
  - [ ] 8.4 Créer `src/components/layout/TrialBanner.tsx` : affiché si `tenantStatut = 'essai'`, calcule et affiche le nombre de jours restants depuis `tenantDateEssaiFin`
  - [ ] 8.5 Intégrer `TrialBanner` dans le layout principal (ex. `src/layouts/AppLayout.tsx`)
  - **Requirements : 9.1, 9.2, 9.3, 9.4**

- [ ] 9. Onboarding Wizard frontend
  - [ ] 9.1 Créer `src/components/onboarding/OnboardingWizard.tsx` : modal en 5 étapes séquentielles (Infos boutique, Logo & devise, Premiers produits, Premier utilisateur commercial, Récapitulatif)
  - [ ] 9.2 Chaque étape appelle `PATCH /api/auth/profile` avec `onboardingStep` incrémenté et les données saisies
  - [ ] 9.3 À la complétion de l'étape 5, envoyer `{ premiereConnexion: false }` via `PATCH /api/auth/profile` et fermer le wizard
  - [ ] 9.4 Déclencher l'affichage du wizard dans le layout principal si `showOnboarding = true` (depuis `authStore`)
  - **Requirements : 4.6, 4.7, 4.8**

- [ ] 10. Route frontend `/superadmin`
  - [ ] 10.1 Créer `src/pages/superadmin/SuperadminPage.tsx` : liste paginée des tenants (nom, slug, plan, statut, dates, actions)
  - [ ] 10.2 Ajouter les actions : modifier plan/statut, activer/désactiver maintenance, impersonation (ouverture d'un nouvel onglet avec le JWT temporaire)
  - [ ] 10.3 Créer le composant `src/pages/superadmin/SuperadminStats.tsx` : KPIs (total tenants, par statut, MRR)
  - [ ] 10.4 Ajouter la route `/superadmin` dans le router React, protégée par `ProtectedRoute` (`requiredRole = 'superadmin'`)
  - [ ] 10.5 Créer `src/components/auth/ProtectedRoute.tsx` si inexistant : redirige vers `/login` si non connecté, vers `/` si rôle insuffisant
  - **Requirements : 6.1, 9.5**

- [ ] 11. Tests d'intégration et validation end-to-end
  - [ ] 11.1 Test d'intégration : flux complet inscription → login → `/api/auth/me` retourne `showOnboarding: true` → complétion onboarding → `showOnboarding: false`
  - [ ] 11.2 Test d'intégration : Superadmin suspend un tenant → requêtes du tenant retournent 403 → Superadmin réactive → requêtes passent
  - [ ] 11.3 Test d'intégration : Superadmin active maintenance → requêtes non-superadmin retournent 503 → requêtes superadmin passent → désactivation → tout passe
  - [ ] 11.4 Test d'intégration : impersonation → JWT 1h → actions en tant qu'admin → token expiré → 401
  - [ ] 11.5 Test d'intégration : résolution par header `X-Tenant-Slug` → tenant résolu → routes métier scoped correctement
  - **Requirements : 1.3–1.7, 4.2–4.4, 6.6, 7.1–7.2, 8.1–8.4**
