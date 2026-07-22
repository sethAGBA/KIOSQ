// Feature: gestion-multitenant, Property 3: Rejet des tenants non actifs

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { checkTenantStatus } from './auth';

/**
 * Validates: Requirements 3.4, 3.5, 16.2
 *
 * Property 3: Rejet des tenants non actifs
 *
 * For any tenant whose status is `suspendu`, or whose status is `essai`
 * with a `dateEssaiFin` in the past, or whose `enMaintenance` flag is true —
 * `checkTenantStatus` must return a rejection with an HTTP code that is
 * either 4xx or 503 (never null / never 2xx).
 *
 * The pure helper `checkTenantStatus` encapsulates the exact gate logic used
 * inside `requireTenantAuth`, so testing it directly exercises the real
 * business rules without requiring a DB mock.
 *
 * Expected outcomes per scenario:
 *   - statut === 'suspendu'                          → 403
 *   - statut === 'essai' && dateEssaiFin < now       → 403
 *   - enMaintenance === true (any non-suspended status) → 503
 */

// ── Shared date helpers ────────────────────────────────────────────────

/** A date guaranteed to be in the past */
const pastDate = (offsetMs = 1000) => new Date(Date.now() - offsetMs);

/** A date guaranteed to be in the future */
const futureDate = (offsetMs = 1000 * 60 * 60 * 24) => new Date(Date.now() + offsetMs);

// ── Arbitraries ────────────────────────────────────────────────────────

/**
 * Generates a suspended tenant object.
 * enMaintenance and dateEssaiFin are varied arbitrarily — status alone
 * must be enough to trigger rejection.
 */
const suspendedTenantArb = fc.record({
  statut: fc.constant('suspendu' as const),
  dateEssaiFin: fc.option(
    fc.date({ min: pastDate(1_000_000), max: futureDate(1_000_000) }),
    { nil: null }
  ),
  enMaintenance: fc.boolean(),
  messageMaintenance: fc.option(fc.string({ maxLength: 200 }), { nil: null }),
});

/**
 * Generates a trial tenant whose trial period is expired (dateEssaiFin in the past).
 * enMaintenance is varied — the trial expiry rule takes precedence.
 */
const expiredTrialTenantArb = fc.record({
  statut: fc.constant('essai' as const),
  // dateEssaiFin between 1 millisecond and ~10 years ago
  dateEssaiFin: fc.date({
    min: new Date(Date.now() - 1_000 * 60 * 60 * 24 * 365 * 10),
    max: new Date(Date.now() - 1),
  }),
  enMaintenance: fc.boolean(),
  messageMaintenance: fc.option(fc.string({ maxLength: 200 }), { nil: null }),
});

/**
 * Generates an `actif` or `essai` tenant (with valid/null trial date) that has
 * enMaintenance === true. The maintenance flag must trigger a 503 regardless of
 * the base statut, as long as the tenant is not suspended (suspension is checked
 * first and returns 403).
 *
 * For essai tenants, dateEssaiFin must be comfortably in the future (minimum 7 days
 * ahead) to ensure the trial-expired check does NOT fire before the maintenance check.
 */
const maintenanceTenantArb = fc.record({
  statut: fc.constantFrom('actif' as const, 'essai' as const),
  // For essai: dateEssaiFin is either null or well in the future (trial not expired).
  // Using a minimum of 7 days to avoid race conditions where a "near future" date
  // slips into the past between generation and assertion.
  dateEssaiFin: fc.option(
    fc.date({
      min: new Date(Date.now() + 1_000 * 60 * 60 * 24 * 7),    // +7 days minimum
      max: new Date(Date.now() + 1_000 * 60 * 60 * 24 * 365),  // +1 year maximum
    }),
    { nil: null }
  ),
  enMaintenance: fc.constant(true as const),
  messageMaintenance: fc.option(fc.string({ maxLength: 200 }), { nil: null }),
});

// ── Test suite ─────────────────────────────────────────────────────────

describe('tenant-rejection — Property 3: Rejet des tenants non actifs (Req 3.4, 3.5, 16.2)', () => {

  /**
   * Sub-property A: Suspended tenants must always be rejected with 403.
   *
   * statut === 'suspendu' is a hard block regardless of any other field.
   */
  it(
    'statut=suspendu → rejet 403 (jamais null, jamais 2xx) — 100 itérations',
    () => {
      fc.assert(
        fc.property(suspendedTenantArb, (tenant) => {
          const result = checkTenantStatus(tenant);

          // Must reject (never return null / allow access)
          expect(result).not.toBeNull();

          // Must be 403 specifically
          expect(result!.code).toBe(403);

          // Message must be the standard suspended message
          expect(result!.message).toContain('suspendue');

          // Code must be 4xx or 503 (never 2xx)
          expect(result!.code >= 400 && result!.code < 600).toBe(true);

          return true;
        }),
        { numRuns: 100 }
      );
    }
  );

  /**
   * Sub-property B: Trial tenants with expired dateEssaiFin must be rejected with 403.
   *
   * statut === 'essai' && dateEssaiFin < now() → 403 (expired trial)
   */
  it(
    'statut=essai avec dateEssaiFin dans le passé → rejet 403 — 100 itérations',
    () => {
      fc.assert(
        fc.property(expiredTrialTenantArb, (tenant) => {
          const result = checkTenantStatus(tenant);

          // Must reject
          expect(result).not.toBeNull();

          // Must be 403 for expired trial
          expect(result!.code).toBe(403);

          // Message must mention trial expiry
          expect(result!.message).toMatch(/essai|expired|expir/i);

          // Code is in the error range
          expect(result!.code >= 400 && result!.code < 600).toBe(true);

          return true;
        }),
        { numRuns: 100 }
      );
    }
  );

  /**
   * Sub-property C: Tenants with enMaintenance=true (and not suspended, trial not expired)
   * must be rejected with 503.
   */
  it(
    'enMaintenance=true (non suspendu, essai non expiré) → rejet 503 — 100 itérations',
    () => {
      fc.assert(
        fc.property(maintenanceTenantArb, (tenant) => {
          const result = checkTenantStatus(tenant);

          // Must reject
          expect(result).not.toBeNull();

          // Must be 503 for maintenance
          expect(result!.code).toBe(503);

          // Code is in the error range
          expect(result!.code >= 400 && result!.code < 600).toBe(true);

          return true;
        }),
        { numRuns: 100 }
      );
    }
  );

  /**
   * Sub-property D: Combined — any inactive tenant must NEVER return null
   * (i.e., must never be granted access).
   *
   * This is the core invariant: the union of all inactive states (suspended,
   * expired trial, maintenance) must always produce a non-null rejection.
   */
  it(
    'tout tenant non actif → jamais null (accès jamais accordé) — 100 itérations',
    () => {
      // Mix all three inactive tenant generators
      const inactiveTenantArb = fc.oneof(
        suspendedTenantArb,
        expiredTrialTenantArb,
        maintenanceTenantArb
      );

      fc.assert(
        fc.property(inactiveTenantArb, (tenant) => {
          const result = checkTenantStatus(tenant);

          // Core invariant: inactive tenant must NEVER be granted access
          expect(result).not.toBeNull();

          // Code must be 4xx or 503 — never 2xx
          expect(result!.code >= 400 && result!.code < 600).toBe(true);

          return true;
        }),
        { numRuns: 100 }
      );
    }
  );

  /**
   * Sub-property E: Active tenants (statut=actif, not in maintenance, trial not expired)
   * must NOT be rejected — checkTenantStatus should return null (access granted).
   *
   * This is the negative case: valid tenants must pass through.
   */
  it(
    'tenant actif valide → null (accès accordé, jamais rejeté) — 100 itérations',
    () => {
      const activeTenantArb = fc.record({
        statut: fc.constant('actif' as const),
        dateEssaiFin: fc.option(
          fc.date({
            min: new Date(Date.now() + 1),
            max: new Date(Date.now() + 1_000 * 60 * 60 * 24 * 365),
          }),
          { nil: null }
        ),
        enMaintenance: fc.constant(false as const),
        messageMaintenance: fc.option(fc.string({ maxLength: 200 }), { nil: null }),
      });

      fc.assert(
        fc.property(activeTenantArb, (tenant) => {
          const result = checkTenantStatus(tenant);

          // Active tenant must NOT be blocked
          expect(result).toBeNull();

          return true;
        }),
        { numRuns: 100 }
      );
    }
  );
});
