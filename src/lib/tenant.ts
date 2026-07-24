/**
 * Tenant configuration utilities.
 *
 * Implements parseTenantConfig and serializeTenantConfig for the TenantConfig
 * type defined in the gestion-multitenant design.
 *
 * Requirements: 17.1, 17.2, 17.3, 17.4, 9.1, 9.2, 9.3, 2.3
 */

// ── TenantConfig type ─────────────────────────────────────────────────────────

export interface TenantConfig {
  id: string;
  nom: string;
  slug: string;
  domaine: string | null;
  plan: 'starter' | 'pro' | 'enterprise';
  statut: 'actif' | 'suspendu' | 'essai';
  dateEssaiFin: string | null;   // ISO 8601
  logoUrl: string | null;
  devise: string;
  pays: string | null;
  telephone: string | null;
  email: string;
  adresse: string | null;
  enMaintenance: boolean;
  messageMaintenance: string | null;
  createdAt: string;             // ISO 8601
  updatedAt: string;             // ISO 8601
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const PLANS = ['starter', 'pro', 'enterprise'] as const;
const STATUTS = ['actif', 'suspendu', 'essai'] as const;

type Plan = typeof PLANS[number];
type Statut = typeof STATUTS[number];

function isPlan(v: unknown): v is Plan {
  return PLANS.includes(v as Plan);
}

function isStatut(v: unknown): v is Statut {
  return STATUTS.includes(v as Statut);
}

function isISOString(v: unknown): v is string {
  if (typeof v !== 'string') return false;
  const d = new Date(v);
  return !isNaN(d.getTime());
}

function isNullableString(v: unknown): v is string | null {
  return v === null || typeof v === 'string';
}

/**
 * Parses a raw (unknown) value into a validated TenantConfig.
 * Throws a descriptive error listing all invalid or missing fields.
 *
 * Requirements: 17.1, 17.2
 */
export function parseTenantConfig(raw: unknown): TenantConfig {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('Configuration invalide : la valeur fournie doit être un objet JSON.');
  }

  const obj = raw as Record<string, unknown>;
  const errors: string[] = [];

  // Required strings
  if (typeof obj.id !== 'string' || obj.id.length === 0)
    errors.push('id (chaîne non vide requise)');
  if (typeof obj.nom !== 'string' || obj.nom.length === 0)
    errors.push('nom (chaîne non vide requise)');
  if (typeof obj.slug !== 'string' || obj.slug.length === 0)
    errors.push('slug (chaîne non vide requise)');
  if (typeof obj.devise !== 'string' || obj.devise.length === 0)
    errors.push('devise (chaîne non vide requise)');
  if (typeof obj.email !== 'string' || obj.email.length === 0)
    errors.push('email (chaîne non vide requise)');

  // Enum fields
  if (!isPlan(obj.plan))
    errors.push(`plan (doit être l'une des valeurs : ${PLANS.join(', ')})`);
  if (!isStatut(obj.statut))
    errors.push(`statut (doit être l'une des valeurs : ${STATUTS.join(', ')})`);

  // Nullable strings
  if (!isNullableString(obj.domaine))
    errors.push('domaine (chaîne ou null)');
  if (!isNullableString(obj.logoUrl))
    errors.push('logoUrl (chaîne ou null)');
  if (!isNullableString(obj.pays))
    errors.push('pays (chaîne ou null)');
  if (!isNullableString(obj.telephone))
    errors.push('telephone (chaîne ou null)');
  if (!isNullableString(obj.adresse))
    errors.push('adresse (chaîne ou null)');
  if (!isNullableString(obj.messageMaintenance))
    errors.push('messageMaintenance (chaîne ou null)');

  // Nullable ISO date strings
  if (obj.dateEssaiFin !== null && !isISOString(obj.dateEssaiFin))
    errors.push('dateEssaiFin (date ISO 8601 ou null)');

  // Boolean
  if (typeof obj.enMaintenance !== 'boolean')
    errors.push('enMaintenance (booléen requis)');

  // Required ISO date strings
  if (!isISOString(obj.createdAt))
    errors.push('createdAt (date ISO 8601 requise)');
  if (!isISOString(obj.updatedAt))
    errors.push('updatedAt (date ISO 8601 requise)');

  if (errors.length > 0) {
    throw new Error(`Configuration invalide : ${errors.join(', ')}.`);
  }

  return {
    id:                 obj.id as string,
    nom:                obj.nom as string,
    slug:               obj.slug as string,
    domaine:            obj.domaine as string | null,
    plan:               obj.plan as Plan,
    statut:             obj.statut as Statut,
    dateEssaiFin:       (obj.dateEssaiFin ?? null) as string | null,
    logoUrl:            obj.logoUrl as string | null,
    devise:             obj.devise as string,
    pays:               obj.pays as string | null,
    telephone:          obj.telephone as string | null,
    email:              obj.email as string,
    adresse:            obj.adresse as string | null,
    enMaintenance:      obj.enMaintenance as boolean,
    messageMaintenance: obj.messageMaintenance as string | null,
    createdAt:          obj.createdAt as string,
    updatedAt:          obj.updatedAt as string,
  };
}

/**
 * Serializes a TenantConfig to a pretty-printed JSON string.
 *
 * Requirements: 17.3
 */
export function serializeTenantConfig(config: TenantConfig): string {
  return JSON.stringify(config, null, 2);
}

// ── Slug generation ───────────────────────────────────────────────────────────

/**
 * Transforms an arbitrary store name into a URL-safe slug: [a-z0-9-],
 * no leading/trailing hyphens, minimum length 1.
 *
 * Requirements: 2.3, 9.1
 */
export function generateSlug(nom: string): string {
  const slug = nom
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')   // strip diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')       // non-alphanumeric → hyphen
    .replace(/^-+|-+$/g, '');          // trim leading/trailing hyphens

  // Guarantee minimum length 1
  return slug.length > 0 ? slug : 'boutique';
}

// ── Tenant store registration (for getTenantId fallback) ─────────────────────

/**
 * Called by `src/store/tenantStore.ts` after the Zustand store is created so
 * that `getTenantId()` can fall back to it when sessionStorage is stale or
 * unavailable.  Using a side-channel on `globalThis` keeps `tenant.ts`
 * importable even before the store module is loaded (avoids circular deps).
 */
export function registerTenantStore(store: { getState(): { tenantId: string | null } }): void {
  (globalThis as Record<string, unknown>).__tenantStoreModule = { useTenantStore: store };
}

// ── Client-side tenant resolution ─────────────────────────────────────────────

const SESSION_KEY = 'kiosq_tenant';
const CACHE_TTL_MS = 60_000;

interface CachedTenant {
  tenantId: string;
  slug: string;
  nom: string;
  plan: Plan;
  statut: Statut;
  cachedAt: number;
}

/**
 * Resolves the current tenant from the URL (subdomain or /app/:slug path).
 * Caches the result in sessionStorage for 60 seconds.
 *
 * Requirements: 9.1, 9.2, 9.3
 */
export async function resolveTenantFromUrl(): Promise<Omit<CachedTenant, 'cachedAt'> | null> {
  const { hostname, pathname } = window.location;

  // Determine slug from subdomain (slug.kiosq.app) or path (/app/slug)
  let slug: string | null = null;

  const subdomainMatch = hostname.match(/^([^.]+)\.kiosq\.app$/);
  if (subdomainMatch) {
    slug = subdomainMatch[1];
  } else {
    const pathMatch = pathname.match(/^\/app\/([^/]+)/);
    if (pathMatch) slug = pathMatch[1];
  }

  if (!slug) return null;

  // Check sessionStorage cache
  try {
    const cached = sessionStorage.getItem(SESSION_KEY);
    if (cached) {
      const parsed: CachedTenant = JSON.parse(cached);
      if (
        parsed.slug === slug &&
        Date.now() - parsed.cachedAt < CACHE_TTL_MS
      ) {
        const { cachedAt: _omit, ...result } = parsed;
        return result;
      }
    }
  } catch {
    // sessionStorage unavailable — proceed with network request
  }

  // Resolve from API
  const res = await fetch(`/api/tenants/resolve?slug=${encodeURIComponent(slug)}`);
  if (!res.ok) return null;

  const data = await res.json();
  const entry: CachedTenant = { ...data, cachedAt: Date.now() };

  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(entry));
  } catch {
    // ignore write errors
  }

  const { cachedAt: _omit, ...result } = entry;
  return result;
}

/**
 * Returns the current tenantId from sessionStorage, falling back to the
 * Zustand tenantStore if available (e.g. after React mounts).
 *
 * Safe to call outside React context: if sessionStorage is unavailable and
 * the store hasn't been initialised yet, returns null rather than throwing.
 *
 * Requirements: 9.1, 9.3
 */
export function getTenantId(): string | null {
  // 1. Try sessionStorage (fastest, no React dependency)
  try {
    const cached = sessionStorage.getItem(SESSION_KEY);
    if (cached) {
      const parsed: CachedTenant = JSON.parse(cached);
      if (Date.now() - parsed.cachedAt < CACHE_TTL_MS) return parsed.tenantId;
    }
  } catch {
    // sessionStorage unavailable (e.g. SSR, private mode) — fall through
  }

  // 2. Check if superadmin is impersonating. If so, return the impersonated tenantId.
  try {
    const tenantMod = (globalThis as any).__tenantStoreModule;
    if (tenantMod && typeof tenantMod.useTenantStore?.getState === 'function') {
      const state = tenantMod.useTenantStore.getState();
      if (state?.isImpersonating && typeof state.tenantId === 'string') {
        return state.tenantId;
      }
    }
  } catch {
    // tenantStore not available
  }

  // 3. Fall back to the logged in user's tenantId in authStore
  try {
    const authMod = (globalThis as any).__authStoreModule;
    if (authMod && typeof authMod.useAuthStore?.getState === 'function') {
      const user = authMod.useAuthStore.getState().user;
      if (user && typeof user.tenantId === 'string') {
        return user.tenantId;
      }
    }
  } catch {
    // authStore not available
  }

  // 4. Fall back to the Zustand tenantStore default (e.g. 'tenant_demo')
  try {
    const tenantMod = (globalThis as any).__tenantStoreModule;
    if (tenantMod && typeof tenantMod.useTenantStore?.getState === 'function') {
      const state = tenantMod.useTenantStore.getState();
      if (typeof state?.tenantId === 'string') return state.tenantId;
    }
  } catch {
    // tenantStore not available
  }

  return null;
}
