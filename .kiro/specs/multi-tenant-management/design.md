# Design Document: Multi-Tenant Management

## Overview

Ce document décrit l'architecture technique complète de la gestion multi-tenant de KIOSQ. La plateforme suit un modèle SaaS à isolation par ligne (_row-level tenancy_) : chaque table métier porte une colonne `tenant_id` et chaque requête est scopée par un middleware JWT-aware.

Les blocs fonctionnels sont :
1. **Isolation des données** — colonne `tenant_id` + clauses `WHERE` systématiques
2. **Authentification multi-tenant** — JWT HS256 avec `tenantId` dans le payload + cookie httpOnly
3. **Enregistrement & onboarding** — inscription self-service + assistant 5 étapes
4. **Limites d'usage par plan** — `checkPlanLimit` vérifié avant chaque création de ressource
5. **Backoffice Superadmin** — CRUD tenants, stats, impersonation
6. **Mode maintenance** — `en_maintenance` par tenant, transparent pour Superadmin
7. **Résolution par sous-domaine/header** — lookup slug dans `requireTenantAuth`
8. **Interface frontend multi-tenant** — `authStore` enrichi, bannière essai, route `/superadmin`

### Stack

| Couche | Technologie |
|---|---|
| Base de données | Neon Postgres (serverless), Drizzle ORM |
| Backend | Vercel Serverless Functions (`api/`) |
| Auth | JWT HS256 (`jose`), cookie httpOnly `kiosq_token` |
| Frontend | React 19 + Vite + TypeScript, Zustand stores |
| Validation | Zod |
| Tests | Vitest + fast-check (property-based) |

---

## Architecture

```mermaid
graph TD
    subgraph "Frontend (React + Vite)"
        A[authStore\n(Zustand)] --> B[TopBar / Sidebar\ntenant info]
        A --> C[Onboarding Wizard\n5 étapes]
        A --> D[TrialBanner\n(statut essai)]
        A --> E[/superadmin\n(route protégée)]
    end

    subgraph "API Layer (Vercel Functions)"
        F[POST /api/tenants/register] --> G[requireTenantAuth\nmiddleware]
        H[POST /api/auth/login] --> G
        G --> I[checkTenantStatus\npure fn]
        G --> J[resolveTenantBySlug\nhelper]
        K[api/superadmin/*] --> L[requireSuperadmin\nmiddleware]
        L --> M[impersonate token\n1h JWT]
    end

    subgraph "Business Logic Helpers"
        N[checkPlanLimit\napi/_lib/planLimits.ts]
        I
        O[generateSlug\napi/_lib/slugUtils.ts]
    end

    subgraph "Database (Neon Postgres)"
        P[(tenants)]
        Q[(users)]
        R[(parametres)]
        S[(audit_logs)]
        T[tables métier\n*tenant_id*]
    end

    G --> P
    F --> Q
    F --> R
    L --> S
    N --> P
    N --> T
```

### Flux d'une requête tenant-scoped

```
Request
  │
  ▼
requireTenantAuth()
  ├─ verifyToken() → payload { sub, tenantId, role, ... }
  ├─ If no tenantId in JWT → resolve via X-Tenant-Slug header
  ├─ If still no tenantId → 401
  ├─ Verify X-Tenant-ID header consistency → 403 if mismatch
  ├─ Load tenant from DB by id (or by slug)
  │    └─ Not found → 404
  └─ checkTenantStatus(tenant)
       ├─ suspendu → 403
       ├─ essai expiré → 403
       └─ en_maintenance → 503 (unless superadmin)
          │
          ▼
        Handler(ctx: TenantAuthContext)
          └─ All DB queries scoped to ctx.tenantId
```

---

## Components and Interfaces

### Backend

#### `api/_lib/auth.ts`

Fichier existant — extensions requises :

```typescript
// Existing exports (unchanged)
export function signToken(payload): Promise<string>
export function verifyToken(token): Promise<JWTPayload>
export function requireAuth(req, res): Promise<AuthContext | null>
export function requireTenantAuth(req, res): Promise<TenantAuthContext | null>
export function requireSuperadmin(req, res): Promise<AuthContext | null>
export function checkTenantStatus(tenant): { code, message } | null

// New: resolve tenant by slug (subdomain or header)
export async function resolveTenantBySlug(
  slug: string,
  db: Db
): Promise<TenantRow | null>
```

`requireTenantAuth` est étendu pour :
1. Si `tenantId` absent du JWT → lire `X-Tenant-Slug` header → appeler `resolveTenantBySlug`
2. Si Superadmin + `en_maintenance = true` → laisser passer

#### `api/_lib/planLimits.ts`

Fichier existant — contrat à aligner sur les Requirements :

```typescript
export const PLAN_LIMITS = {
  starter:    { users: 3,        produits: 500,      magasins: 2 },
  pro:        { users: 10,       produits: 5000,     magasins: 10 },
  enterprise: { users: Infinity, produits: Infinity, magasins: Infinity },
}

// Signature canonique requise par Req 5.5
export async function checkPlanLimit(
  tenantId: string,
  resource: 'users' | 'produits' | 'magasins',
  db: Db
): Promise<{ allowed: boolean; current: number; max: number }>
```

> Note : la signature actuelle passe `res` en paramètre et écrit la réponse 403 directement. Elle sera refactorisée pour retourner `{ allowed, current, max }` et laisser le handler décider de la réponse — cela facilite le test.

#### `api/_lib/slugUtils.ts` (nouveau)

```typescript
// Generates a URL-friendly slug from a boutique name
export function generateSlug(nom: string): string

// Finds a unique slug by appending numeric suffix if needed
export async function generateUniqueSlug(nom: string, db: Db): Promise<string>
```

#### `api/tenants/register.ts` (nouveau)

```
POST /api/tenants/register
Body: { nomBoutique, email, password, nom, prenom, pays?, devise? }
→ 201 : { token, tenantId, userId }  + Set-Cookie: kiosq_token=...
→ 409 : email already exists
→ 422 : validation error
```

Opération atomique : transaction Drizzle créant en ordre :
1. `tenants` row (statut=essai, dateEssaiFin=+14j)
2. `users` row (role=admin, premiereConnexion=true, tenantId)
3. `parametres` row (id='default', tenantId)

#### `api/auth/me.ts` (modification)

Enrichir la réponse avec les champs tenant (join `tenants` sur `users.tenantId`) :

```typescript
{
  id, email, nom, prenom, role, tenantId,
  // Nouveaux champs
  tenantNom, tenantSlug, tenantPlan, tenantStatut,
  tenantDevise, tenantLogoUrl, tenantDateEssaiFin,
  showOnboarding,  // = user.premiereConnexion
  onboardingStep
}
```

#### `api/auth/profile.ts` (modification)

Étendre le schema Zod pour accepter `onboardingStep` et `premiereConnexion` (PATCH onboarding).

#### Routes Superadmin (existantes + nouvelles)

| Route | Méthode | Description |
|---|---|---|
| `/api/superadmin/tenants` | GET | Liste paginée |
| `/api/superadmin/tenants` | POST | Création directe |
| `/api/superadmin/tenants/:id` | GET | Détail + stats |
| `/api/superadmin/tenants/:id` | PATCH | Modification |
| `/api/superadmin/tenants/:id/impersonate` | POST | JWT 1h admin |
| `/api/superadmin/stats` | GET | KPIs + MRR |

`impersonate` : `signToken({ ..., expiresIn: '1h', impersonatedBy: superadminId })`

### Frontend

#### `src/store/authStore.ts` (modification)

```typescript
interface AuthState {
  user: UserInfo | null;
  // Tenant fields
  tenantId: string | null;
  tenantNom: string | null;
  tenantSlug: string | null;
  tenantPlan: 'starter' | 'pro' | 'enterprise' | null;
  tenantStatut: 'actif' | 'suspendu' | 'essai' | null;
  tenantDevise: string | null;
  tenantLogoUrl: string | null;
  tenantDateEssaiFin: string | null;
  showOnboarding: boolean;
  onboardingStep: number;
}
```

#### Composants

| Composant | Description |
|---|---|
| `src/components/layout/TopBar.tsx` | Affiche `tenantNom` + `tenantLogoUrl` |
| `src/components/layout/TrialBanner.tsx` | Bannière si `tenantStatut='essai'` |
| `src/components/onboarding/OnboardingWizard.tsx` | Modal 5 étapes séquentielles |
| `src/pages/superadmin/SuperadminPage.tsx` | Liste tenants + stats + actions |
| `src/components/maintenance/MaintenancePage.tsx` | Page affichée sur 503 maintenance |

#### Route guard superadmin

```typescript
// Dans le router React
<Route
  path="/superadmin"
  element={
    <ProtectedRoute requiredRole="superadmin">
      <SuperadminPage />
    </ProtectedRoute>
  }
/>
```

---

## Data Models

### `tenants` (existant, complet)

```typescript
{
  id: string (PK, uuid/nanoid)
  nom: string (NOT NULL)
  slug: string (NOT NULL, UNIQUE)
  domaine: string | null
  plan: 'starter' | 'pro' | 'enterprise'
  statut: 'actif' | 'suspendu' | 'essai'
  dateEssaiFin: Date | null
  logoUrl: string | null
  devise: string (default 'XOF')
  pays: string | null
  telephone: string | null
  email: string (NOT NULL)
  adresse: string | null
  enMaintenance: boolean (default false)
  messageMaintenance: string | null
  createdAt: Date
  updatedAt: Date
}
```

### `users` (existant, champs onboarding déjà présents)

```typescript
{
  id: string (PK)
  email: string (UNIQUE)
  passwordHash: string
  nom: string
  prenom: string
  role: 'superadmin' | 'admin' | 'commercial' | 'gestionnaire' | 'comptable' | 'lecteur'
  tenantId: string | null  // null pour superadmin
  actif: boolean
  premiereConnexion: boolean (default true)
  onboardingStep: number (default 0)
  createdAt: Date
  updatedAt: Date
}
```

### `parametres` (existant)

```typescript
{
  id: string  // always 'default' (unique per tenant via tenantId)
  nom: string
  devise: string
  tenantId: string (FK → tenants.id)
  ...autres champs
}
```

### `audit_logs` (existant)

```typescript
{
  id: string (PK)
  tenantId: string (FK → tenants.id)
  userId: string | null
  action: string  // e.g. 'TENANT_SUSPENDED', 'USER_LOGIN'
  resourceType: string
  resourceId: string | null
  details: jsonb | null
  ipAddress: string | null
  createdAt: Date
}
```

### Constantes PLAN_LIMITS (alignées sur Req 5.1)

```typescript
export const PLAN_LIMITS = {
  starter:    { users: 3,        produits: 500,      magasins: 2        },
  pro:        { users: 10,       produits: 5000,     magasins: 10       },
  enterprise: { users: Infinity, produits: Infinity, magasins: Infinity },
}
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

---

### Property 1: Slug generation format invariant

*For any* boutique name (string arbitraire non vide), le slug généré par `generateSlug` SHALL être entièrement en minuscules, ne contenir que des caractères `[a-z0-9-]`, ne pas commencer ni terminer par un tiret, et ne contenir aucun tiret double consécutif.

**Validates: Requirements 2.3**

---

### Property 2: Slug uniqueness under collision

*For any* ensemble de noms de boutiques produisant le même slug de base normalisé, la fonction `generateUniqueSlug` SHALL produire des slugs tous distincts en ajoutant un suffixe numérique incrémental.

**Validates: Requirements 2.4**

---

### Property 3: checkTenantStatus blocks all invalid tenants

*For any* objet tenant, `checkTenantStatus` SHALL retourner :
- `{ code: 403 }` si `statut = 'suspendu'`
- `{ code: 403 }` si `statut = 'essai'` ET `dateEssaiFin < now`
- `{ code: 503 }` si `enMaintenance = true` (quelle que soit la date ou le statut)
- `null` si le tenant est actif, non expiré, et non en maintenance

**Validates: Requirements 3.4, 3.5, 3.6, 7.1**

---

### Property 4: JWT/header tenant mismatch always rejected

*For any* paire (`tenantIdJWT`, `tenantIdHeader`) où les deux sont non-nuls et distincts, `requireTenantAuth` SHALL toujours retourner HTTP 403.

**Validates: Requirements 3.3**

---

### Property 5: Registration input validation rejects all invalid inputs

*For any* corps de requête `POST /api/tenants/register` violant au moins une contrainte (nomBoutique < 2 chars, email invalide, password < 8 chars), le handler SHALL retourner 422 sans créer aucune entrée en base.

**Validates: Requirements 4.1**

---

### Property 6: Duplicate email registration always returns 409

*For any* email déjà présent dans la table `users`, un appel à `POST /api/tenants/register` avec ce même email SHALL retourner 409, et aucune nouvelle entrée tenant/user/parametres ne doit être créée.

**Validates: Requirements 4.3**

---

### Property 7: showOnboarding reflects premiere_connexion

*For any* utilisateur avec `premiereConnexion = true`, le champ `showOnboarding` dans la réponse de `/api/auth/me` SHALL être `true`. *For any* utilisateur avec `premiereConnexion = false`, `showOnboarding` SHALL être `false`.

**Validates: Requirements 4.5, 9.2**

---

### Property 8: checkPlanLimit enforces limits for all resource types

*For any* tenant avec plan `starter` ou `pro`, et pour toute ressource (`users`, `produits`, `magasins`), si le nombre d'enregistrements actifs atteint ou dépasse le plafond du plan, `checkPlanLimit` SHALL retourner `{ allowed: false, current: N, max: M }` avec `N >= M`. Si le nombre est inférieur au plafond, SHALL retourner `{ allowed: true, current: N, max: M }` avec `N < M`.

**Validates: Requirements 5.2, 5.3, 5.4, 5.5**

---

### Property 9: Enterprise plan is always allowed

*For any* tenant `enterprise` et *for any* ressource et *for any* valeur de compteur courant N, `checkPlanLimit` SHALL toujours retourner `{ allowed: true, current: N, max: Infinity }`.

**Validates: Requirements 5.6**

---

### Property 10: Impersonation token has correct claims and short expiry

*For any* `tenantId` cible valide, le JWT généré par `POST /api/superadmin/tenants/:id/impersonate` SHALL contenir `tenantId` égal à l'identifiant cible, `role = 'admin'`, `impersonatedBy` égal à l'id du Superadmin appelant, et une expiration inférieure ou égale à 1 heure à partir du moment de création.

**Validates: Requirements 6.6**

---

### Property 11: MRR computation is additive across plans

*For any* distribution de tenants actifs par plan, le MRR calculé par la route `/api/superadmin/stats` SHALL être égal à `Σ (count_plan × tarif_plan)` pour chaque plan, sans double-comptage.

**Validates: Requirements 6.7**

---

### Property 12: Tenant suspension always creates audit log

*For any* appel `PATCH /api/superadmin/tenants/:id` avec `statut = 'suspendu'`, le Système SHALL créer exactement une entrée dans `audit_logs` avec `action = 'TENANT_SUSPENDED'` et `resourceId = tenantId`.

**Validates: Requirements 6.8**

---

### Property 13: Slug resolution finds the correct tenant

*For any* slug existant en base (via header `X-Tenant-Slug` ou sous-domaine), `resolveTenantBySlug` SHALL retourner le tenant dont le champ `slug` correspond exactement. *For any* slug absent de la base, SHALL retourner `null`.

**Validates: Requirements 8.1, 8.2, 8.4**

---

### Property 14: /api/auth/me always includes all tenant fields

*For any* utilisateur authentifié lié à un tenant, la réponse de `/api/auth/me` SHALL contenir les champs `tenantId`, `tenantNom`, `tenantSlug`, `tenantPlan`, `tenantStatut`, `tenantDevise`, `tenantLogoUrl`, `showOnboarding`, et tous ces champs SHALL avoir des valeurs cohérentes avec la ligne correspondante dans la table `tenants`.

**Validates: Requirements 9.2**

---

## Error Handling

### Hiérarchie des erreurs HTTP

| Code | Situation | Message type |
|---|---|---|
| 400 | Données invalides (logique métier) | Message explicite |
| 401 | JWT absent ou invalide | `"Non authentifié"` |
| 403 | Tenant suspendu, essai expiré, rôle insuffisant, mismatch tenant | Message spécifique |
| 404 | Ressource introuvable (y compris cross-tenant pour ne pas révéler d'existence) | `"Introuvable"` |
| 409 | Conflit (email déjà existant à l'inscription) | `"Un compte existe déjà avec cet email."` |
| 422 | Erreur de validation Zod | Détail des champs |
| 503 | Tenant en maintenance | `{ error: "maintenance", message: "..." }` |
| 500 | Erreur serveur inattendue | `"Erreur serveur"` |

### Atomicité de l'enregistrement

L'opération `POST /api/tenants/register` doit utiliser une transaction Drizzle pour garantir que :
- Si la création du tenant échoue → aucun utilisateur ni paramètres ne sont créés
- Si la création de l'utilisateur échoue → le tenant est rollbacké
- Si la création des paramètres échoue → tout est rollbacké

### Maintenance mode : comportement attendu

```
en_maintenance = true
  └─ role = 'superadmin' → passe normalement
  └─ role ≠ 'superadmin' → 503 { error: "maintenance", message: <messageMaintenance ou défaut> }
```

Le message par défaut si `messageMaintenance` est null : `"Maintenance en cours. Revenez bientôt."`

### Gestion des slugs

- Slug invalide (vide) → 400 à la création du tenant
- Slug déjà existant → suffixe `-2`, `-3`, etc. ajouté automatiquement (jamais d'erreur exposée à l'utilisateur)

---

## Testing Strategy

### Approche duale

**Tests unitaires (Vitest)** : cas spécifiques, edge cases, intégration entre composants.
**Tests property-based (Vitest + fast-check)** : propriétés universelles couvrant un large espace d'entrées.

### Tests property-based

La bibliothèque retenue est **fast-check** (déjà utilisée dans le projet existant). Chaque test property est configuré avec un minimum de 100 itérations.

Format de tag pour traçabilité :
```
// Feature: multi-tenant-management, Property N: <texte de la propriété>
```

**Tests property-based à implémenter** :

| Property | Fichier test | Artefact testé |
|---|---|---|
| P1 : slug format | `api/_lib/slugUtils.test.ts` | `generateSlug()` |
| P2 : slug uniqueness | `api/_lib/slugUtils.test.ts` | `generateUniqueSlug()` |
| P3 : checkTenantStatus | `api/_lib/auth.test.ts` | `checkTenantStatus()` |
| P4 : JWT/header mismatch | `api/_lib/auth.test.ts` | `requireTenantAuth()` mock |
| P5 : register validation | `api/tenants/register.test.ts` | handler + Zod schema |
| P6 : duplicate email | `api/tenants/register.test.ts` | handler |
| P7 : showOnboarding | `api/auth/me.test.ts` | handler |
| P8 : checkPlanLimit enforcement | `api/_lib/planLimits.test.ts` | `checkPlanLimit()` |
| P9 : enterprise always allowed | `api/_lib/planLimits.test.ts` | `checkPlanLimit()` |
| P10 : impersonation JWT | `api/superadmin/tenants/impersonate.test.ts` | `signToken()` wrapper |
| P11 : MRR computation | `api/superadmin/stats.test.ts` | `buildMRR()` helper |
| P12 : audit log on suspend | `api/superadmin/tenants.test.ts` | PATCH handler |
| P13 : slug resolution | `api/_lib/auth.test.ts` | `resolveTenantBySlug()` |
| P14 : me tenant fields | `api/auth/me.test.ts` | handler |

### Tests unitaires (exemples et cas limites)

- Authentification login : superadmin → tenantId null, admin → tenantId présent
- Création atomique tenant + user + parametres
- Onboarding step 5 → premiereConnexion = false
- Page maintenance affichée côté frontend sur réception 503

### Tests d'intégration (Vercel + Neon)

- Flux complet d'enregistrement → onboarding → première vente
- Impersonation → actions en tant qu'admin → retour superadmin
- Suspension tenant → requêtes bloquées → réactivation

### Configuration fast-check

```typescript
import fc from 'fast-check';

// Minimum iterations
fc.configureGlobal({ numRuns: 100 });
```
