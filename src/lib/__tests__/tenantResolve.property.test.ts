// Feature: gestion-multitenant, Property 11: Résolution de tenant depuis l'URL

import { describe, it, expect, afterEach, vi } from 'vitest';
import fc from 'fast-check';

/**
 * Validates: Requirements 9.1, 9.2
 *
 * Property 11: Résolution de tenant depuis l'URL
 *
 * For any slug of an existing tenant, resolveTenantFromUrl() invoked with a
 * URL containing that slug (either as a subdomain {slug}.kiosq.app or as a
 * path /app/{slug}) must return an object whose `tenantId` corresponds
 * exactly to `tenants.id` of the tenant associated with that slug.
 *
 * The function reads window.location, sessionStorage, and fetch at call time
 * (not at import time), so we install globals before each call.
 *
 * This test mocks:
 *   - global.window        (hostname / pathname)
 *   - global.sessionStorage (to control caching)
 *   - global.fetch          (to return a controlled API response)
 */

// Import once — resolveTenantFromUrl reads globals at call time
import { resolveTenantFromUrl } from '../tenant';

// ── Generators ────────────────────────────────────────────────────────────────

/**
 * Generates URL-safe slugs: [a-z0-9] with optional internal hyphens.
 * Covers single-char, multi-char, and hyphenated slugs.
 */
const alphaSlugArb = fc.stringMatching(/^[a-z0-9]{1,20}$/).filter((s) => s.length >= 1);
const hyphenatedSlugArb = fc.tuple(
  fc.stringMatching(/^[a-z0-9]{1,10}$/),
  fc.stringMatching(/^[a-z0-9]{1,10}$/)
).map(([a, b]) => `${a}-${b}`);

const anySlugArb = fc.oneof(
  alphaSlugArb,
  hyphenatedSlugArb,
  fc.constantFrom(
    'boutique', 'shop', 'test', 'abc', 'ma-boutique',
    'my-shop', 'test-123', 'abc123', 'store42',
  )
);

/**
 * Generates a fake tenant API response payload (mirrors api/tenants/resolve.ts output).
 * The `tenantId` represents the real `tenants.id` in the DB.
 */
function sampleTenantResponse(slug: string) {
  return fc.sample(
    fc.record({
      tenantId: fc.uuid(),
      slug:     fc.constant(slug),
      nom:      fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
      plan:     fc.constantFrom('starter' as const, 'pro' as const, 'enterprise' as const),
      statut:   fc.constantFrom('actif' as const, 'suspendu' as const, 'essai' as const),
    }),
    1
  )[0];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function setFakeWindow(hostname: string, pathname: string) {
  (global as Record<string, unknown>).window = { location: { hostname, pathname } };
}

function setFakeSessionStorage(preloaded?: Record<string, string>) {
  const store: Record<string, string> = { ...preloaded };
  (global as Record<string, unknown>).sessionStorage = {
    getItem:    vi.fn((key: string) => store[key] ?? null),
    setItem:    vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear:      vi.fn(() => { for (const k of Object.keys(store)) delete store[k]; }),
  };
}

function setFakeFetchOk(payload: unknown) {
  (global as Record<string, unknown>).fetch = vi.fn().mockResolvedValue({
    ok:   true,
    json: vi.fn().mockResolvedValue(payload),
  });
}

function setFakeFetch404() {
  (global as Record<string, unknown>).fetch = vi.fn().mockResolvedValue({
    ok:   false,
    json: vi.fn().mockResolvedValue({ error: 'Not found' }),
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("tenant — Property 11: Résolution de tenant depuis l'URL (Req 9.1, 9.2)", () => {

  afterEach(() => {
    delete (global as Record<string, unknown>).window;
    delete (global as Record<string, unknown>).sessionStorage;
    delete (global as Record<string, unknown>).fetch;
    vi.restoreAllMocks();
  });

  // ── Core property: subdomain URL ────────────────────────────────────────────

  it(
    '[subdomain] tenantId retourné === tenants.id pour tout slug existant (100 itérations)',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          anySlugArb,
          async (slug) => {
            const apiResponse = sampleTenantResponse(slug);

            setFakeWindow(`${slug}.kiosq.app`, '/');
            setFakeSessionStorage();            // empty cache → triggers fetch
            setFakeFetchOk(apiResponse);

            const result = await resolveTenantFromUrl();

            // Must not return null for an existing tenant
            expect(result).not.toBeNull();
            expect(result).toBeDefined();

            // Core property: tenantId must exactly equal the id from the API response
            expect(result!.tenantId).toBe(apiResponse.tenantId);

            // Slug must also be preserved
            expect(result!.slug).toBe(slug);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    }
  );

  // ── Core property: path URL (/app/slug) ─────────────────────────────────────

  it(
    '[path /app/slug] tenantId retourné === tenants.id pour tout slug existant (100 itérations)',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          anySlugArb,
          async (slug) => {
            const apiResponse = sampleTenantResponse(slug);

            setFakeWindow('localhost', `/app/${slug}`);
            setFakeSessionStorage();
            setFakeFetchOk(apiResponse);

            const result = await resolveTenantFromUrl();

            expect(result).not.toBeNull();
            // Core property: tenantId must equal tenants.id from the API
            expect(result!.tenantId).toBe(apiResponse.tenantId);
            expect(result!.slug).toBe(slug);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    }
  );

  // ── Property: API 404 → null ─────────────────────────────────────────────────

  it(
    'retourne null quand le tenant est introuvable (API 404) (100 itérations)',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          anySlugArb,
          async (slug) => {
            setFakeWindow(`${slug}.kiosq.app`, '/');
            setFakeSessionStorage();
            setFakeFetch404();

            const result = await resolveTenantFromUrl();

            expect(result).toBeNull();

            return true;
          }
        ),
        { numRuns: 100 }
      );
    }
  );

  // ── Property: no slug in URL → null ─────────────────────────────────────────

  it(
    'retourne null quand aucun slug n\'est présent dans l\'URL (50 itérations)',
    async () => {
      // These URLs have neither the {slug}.kiosq.app subdomain pattern
      // nor the /app/{slug} path pattern.
      // Note: any *.kiosq.app hostname WILL produce a slug (e.g. 'www' from www.kiosq.app),
      // so we only use hostnames that do NOT match ^([^.]+)\.kiosq\.app$.
      const noSlugUrls = [
        { hostname: 'kiosq.app',   pathname: '/'           },  // bare apex — no subdomain
        { hostname: 'localhost',   pathname: '/'           },  // no /app/slug path
        { hostname: 'localhost',   pathname: '/dashboard'  },  // path doesn't start with /app/
        { hostname: 'localhost',   pathname: '/superadmin' },  // path doesn't start with /app/
        { hostname: 'localhost',   pathname: '/login'      },  // path doesn't start with /app/
        { hostname: '127.0.0.1',   pathname: '/'           },  // IP — no slug
      ] as const;

      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...noSlugUrls),
          async ({ hostname, pathname }) => {
            setFakeWindow(hostname, pathname);
            setFakeSessionStorage();
            // fetch should never be called, but set it up as a guard
            setFakeFetchOk({ tenantId: 'should-not-be-returned', slug: '' });

            const result = await resolveTenantFromUrl();

            expect(result).toBeNull();

            return true;
          }
        ),
        { numRuns: 50 }
      );
    }
  );

  // ── Property: cache hit preserves tenantId ──────────────────────────────────

  it(
    'le cache sessionStorage préserve exactement le tenantId (100 itérations)',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          anySlugArb,
          async (slug) => {
            const apiResponse = sampleTenantResponse(slug);

            // Pre-populate sessionStorage with a fresh cache entry
            const cachedEntry = {
              tenantId:  apiResponse.tenantId,
              slug:      apiResponse.slug,
              nom:       apiResponse.nom,
              plan:      apiResponse.plan,
              statut:    apiResponse.statut,
              cachedAt:  Date.now(),  // within TTL (< 60s)
            };

            setFakeWindow(`${slug}.kiosq.app`, '/');
            setFakeSessionStorage({ kiosq_tenant: JSON.stringify(cachedEntry) });

            // fetch must NOT be called when cache is valid
            const fetchMock = vi.fn();
            (global as Record<string, unknown>).fetch = fetchMock;

            const result = await resolveTenantFromUrl();

            // Must return the cached tenantId unchanged
            expect(result).not.toBeNull();
            expect(result!.tenantId).toBe(apiResponse.tenantId);

            // fetch must not have been called (served from cache)
            expect(fetchMock).not.toHaveBeenCalled();

            return true;
          }
        ),
        { numRuns: 100 }
      );
    }
  );

  // ── Property: stale cache triggers re-fetch with correct tenantId ────────────

  it(
    'le cache expiré déclenche un re-fetch et retourne le nouveau tenantId (100 itérations)',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          anySlugArb,
          async (slug) => {
            const freshApiResponse = sampleTenantResponse(slug);

            // Expired cache: cachedAt > 60s ago
            const staleEntry = {
              tenantId:  'stale-tenant-id',
              slug,
              nom:       'Stale Tenant',
              plan:      'starter',
              statut:    'actif',
              cachedAt:  Date.now() - 120_000, // 2 minutes old
            };

            setFakeWindow(`${slug}.kiosq.app`, '/');
            setFakeSessionStorage({ kiosq_tenant: JSON.stringify(staleEntry) });
            setFakeFetchOk(freshApiResponse);

            const result = await resolveTenantFromUrl();

            expect(result).not.toBeNull();
            // Must return the fresh tenantId from the API, not the stale one
            expect(result!.tenantId).toBe(freshApiResponse.tenantId);
            expect(result!.tenantId).not.toBe('stale-tenant-id');

            return true;
          }
        ),
        { numRuns: 100 }
      );
    }
  );

});
