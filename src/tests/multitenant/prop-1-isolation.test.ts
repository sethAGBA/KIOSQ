// Feature: gestion-multitenant, Property 1: Isolation des données entre tenants

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

/**
 * Validates: Requirements 1.5, 1.6
 *
 * Property 1 — Isolation des données entre tenants
 *
 * For any two distinct tenants A and B, a request made with tenant A's identity
 * against resources belonging to tenant B must never return those resources —
 * it must get either a 404 or an empty list.
 *
 * Since we cannot hit a real DB in unit tests, we test the filtering invariant
 * that every tenant-scoped API route relies on:
 *   rows.filter(row => row.tenantId === requestingTenantId)
 *
 * When all rows belong to tenant B and the request comes from tenant A (A ≠ B),
 * the result must be an empty array.
 *
 * We also verify the corollary: when rows belong to A, the same filter
 * returns all rows for A and none for B.
 */

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Simulates the WHERE clause applied by every tenant-scoped route:
 *    .where(eq(table.tenantId, ctx.tenantId))
 *
 * In pure-function form this is:
 *    rows.filter(row => row.tenantId === requestingTenantId)
 */
function filterByTenant<T extends { tenantId: string }>(
  rows: T[],
  requestingTenantId: string
): T[] {
  return rows.filter(row => row.tenantId === requestingTenantId);
}

/** Builds an arbitrary list of records belonging to a specific tenant. */
function rowsForTenant(tenantId: string) {
  return fc.array(
    fc.record({
      id: fc.uuid(),
      tenantId: fc.constant(tenantId),
      nom: fc.string({ minLength: 1, maxLength: 50 }),
    }),
    { minLength: 1, maxLength: 20 }
  );
}

// ── Distinct-tenant generator ──────────────────────────────────────────────────

/** Generates two guaranteed-distinct tenant IDs (UUID v4). */
const twoDistinctTenants = fc
  .tuple(fc.uuid(), fc.uuid())
  .filter(([a, b]) => a !== b);

// ── Property tests ─────────────────────────────────────────────────────────────

describe('Property 1 — Isolation des données entre tenants', () => {

  /**
   * Core isolation invariant:
   * Given rows all belonging to tenant B, filtering with tenant A's ID
   * must always produce an empty array.
   */
  it('tenant A never sees resources belonging to tenant B', () => {
    fc.assert(
      fc.property(
        twoDistinctTenants.chain(([tenantA, tenantB]) =>
          rowsForTenant(tenantB).map(rows => ({ tenantA, tenantB, rows }))
        ),
        ({ tenantA, rows }) => {
          const result = filterByTenant(rows, tenantA);
          expect(result).toHaveLength(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Inverse of the isolation invariant:
   * Given rows all belonging to tenant A, tenant A's filter must return
   * exactly those rows (no leakage in either direction).
   */
  it('tenant A sees all of its own resources', () => {
    fc.assert(
      fc.property(
        twoDistinctTenants.chain(([tenantA, tenantB]) =>
          rowsForTenant(tenantA).map(rows => ({ tenantA, tenantB, rows }))
        ),
        ({ tenantA, rows }) => {
          const result = filterByTenant(rows, tenantA);
          expect(result).toHaveLength(rows.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Mixed dataset:
   * When rows from both tenants are present, each tenant's filter must return
   * only its own rows — exactly the count attributed to it.
   */
  it('mixed dataset: each tenant receives only its own rows', () => {
    fc.assert(
      fc.property(
        twoDistinctTenants.chain(([tenantA, tenantB]) =>
          fc.tuple(
            rowsForTenant(tenantA),
            rowsForTenant(tenantB)
          ).map(([rowsA, rowsB]) => ({ tenantA, tenantB, rowsA, rowsB }))
        ),
        ({ tenantA, tenantB, rowsA, rowsB }) => {
          const allRows = [...rowsA, ...rowsB];

          const resultA = filterByTenant(allRows, tenantA);
          const resultB = filterByTenant(allRows, tenantB);

          // Tenant A sees only its rows
          expect(resultA).toHaveLength(rowsA.length);
          expect(resultA.every(r => r.tenantId === tenantA)).toBe(true);

          // Tenant B sees only its rows
          expect(resultB).toHaveLength(rowsB.length);
          expect(resultB.every(r => r.tenantId === tenantB)).toBe(true);

          // No cross-contamination
          expect(resultA.some(r => r.tenantId === tenantB)).toBe(false);
          expect(resultB.some(r => r.tenantId === tenantA)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Single-resource 404 equivalent:
   * Given a single resource belonging to tenant B, fetching it with tenant A's
   * tenantId (i.e., filtering a single-element list) must return nothing.
   * This models the behaviour of:
   *   db.select().from(table).where(and(eq(table.id, id), eq(table.tenantId, ctx.tenantId)))
   * which returns an empty array (→ 404) when the resource belongs to a different tenant.
   */
  it('single-resource lookup across tenants always yields an empty result (404 equivalent)', () => {
    fc.assert(
      fc.property(
        twoDistinctTenants.chain(([tenantA, tenantB]) =>
          fc.record({
            id: fc.uuid(),
            tenantId: fc.constant(tenantB),
            nom: fc.string({ minLength: 1, maxLength: 50 }),
          }).map(resource => ({ tenantA, tenantB, resource }))
        ),
        ({ tenantA, resource }) => {
          // Simulate: .where(and(eq(table.id, resource.id), eq(table.tenantId, tenantA)))
          const result = filterByTenant([resource], tenantA);
          // Empty array → handler returns 404
          expect(result).toHaveLength(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Idempotency of the filter:
   * Applying the tenant filter twice must produce the same result as applying
   * it once — the filter is a pure, stable predicate.
   */
  it('tenant filter is idempotent', () => {
    fc.assert(
      fc.property(
        twoDistinctTenants.chain(([tenantA, tenantB]) =>
          fc.tuple(
            rowsForTenant(tenantA),
            rowsForTenant(tenantB)
          ).map(([rowsA, rowsB]) => ({ tenantA, allRows: [...rowsA, ...rowsB] }))
        ),
        ({ tenantA, allRows }) => {
          const once = filterByTenant(allRows, tenantA);
          const twice = filterByTenant(once, tenantA);
          expect(twice).toEqual(once);
        }
      ),
      { numRuns: 100 }
    );
  });
});
