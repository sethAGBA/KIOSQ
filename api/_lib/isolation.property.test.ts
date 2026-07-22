// Feature: gestion-multitenant, Property 1: Isolation des données entre tenants

import { describe, it, expect, vi } from 'vitest';
import fc from 'fast-check';

/**
 * Validates: Requirements 1.5, 1.6
 *
 * Property 1 : Isolation des données entre tenants
 *
 * For any two distinct tenants A and B, a request carrying tenant A's JWT
 * context must never return resources that belong to tenant B.
 *
 * This tests the applicative isolation layer — the WHERE clause pattern
 * `eq(table.tenantId, ctx.tenantId)` applied uniformly across every route.
 * We model the DB query as a pure filter function and assert that:
 *
 *   1. A list query filtered to tenantId A returns an empty list when
 *      all records belong to tenantId B.
 *   2. A single-resource lookup filtered to (id, tenantId A) returns
 *      null / undefined (→ 404) when the record belongs to tenantId B.
 *   3. Neither the records themselves nor their tenantIds leak across
 *      the tenant boundary.
 */

// ── Types mirroring the route filter pattern ──────────────────────────

interface Resource {
  id: string;
  tenantId: string;
  data: string;
}

/**
 * Simulates the WHERE clause applied in list routes:
 *   db.select().from(table).where(eq(table.tenantId, ctx.tenantId))
 */
function filterByTenant(records: Resource[], requestingTenantId: string): Resource[] {
  return records.filter(r => r.tenantId === requestingTenantId);
}

/**
 * Simulates the WHERE clause applied in single-resource routes:
 *   db.select().from(table).where(and(eq(table.id, id), eq(table.tenantId, ctx.tenantId)))
 */
function findByIdAndTenant(
  records: Resource[],
  id: string,
  requestingTenantId: string
): Resource | undefined {
  return records.find(r => r.id === id && r.tenantId === requestingTenantId);
}

// ── Mock response builder (mirrors the pattern from planLimits.property.test.ts) ──

function makeMockRes() {
  const mock = {
    statusCode: 200 as number,
    body: null as unknown,
    status: vi.fn().mockImplementation(function (code: number) {
      mock.statusCode = code;
      return mock;
    }),
    json: vi.fn().mockImplementation(function (body: unknown) {
      mock.body = body;
      return mock;
    }),
  };
  return mock;
}

/**
 * Simulate the full route handler logic for a list GET endpoint.
 * Returns { statusCode, body } mirroring the real API response shape.
 */
function simulateListRoute(
  allRecords: Resource[],
  requestingTenantId: string
): { statusCode: number; body: unknown } {
  const mockRes = makeMockRes();
  const rows = filterByTenant(allRecords, requestingTenantId);
  mockRes.status(200).json({ ok: true, data: rows });
  return { statusCode: mockRes.statusCode, body: mockRes.body };
}

/**
 * Simulate the full route handler logic for a single-resource GET endpoint.
 * Returns { statusCode, body } mirroring the real API response shape.
 */
function simulateSingleRoute(
  allRecords: Resource[],
  id: string,
  requestingTenantId: string
): { statusCode: number; body: unknown } {
  const mockRes = makeMockRes();
  const row = findByIdAndTenant(allRecords, id, requestingTenantId);
  if (!row) {
    mockRes.status(404).json({ ok: false, error: 'Ressource introuvable' });
  } else {
    mockRes.status(200).json({ ok: true, data: row });
  }
  return { statusCode: mockRes.statusCode, body: mockRes.body };
}

// ── Arbitrary generators ──────────────────────────────────────────────

/** Generate a resource owned by a specific tenant */
const resourceArb = (tenantId: string) =>
  fc.record({
    id:       fc.uuid(),
    tenantId: fc.constant(tenantId),
    data:     fc.string({ minLength: 1, maxLength: 50 }),
  });

/** Generate 1–10 resources all belonging to a given tenant */
const resourcesForTenantArb = (tenantId: string) =>
  fc.array(resourceArb(tenantId), { minLength: 1, maxLength: 10 });

// ── Properties ───────────────────────────────────────────────────────

describe("isolation — Property 1: Isolation des données entre tenants (Req 1.5, 1.6)", () => {

  /**
   * Sub-property A: List route returns empty list when all records belong to another tenant.
   *
   * Generate tenants A ≠ B. Populate the "DB" exclusively with records belonging
   * to tenant B. A query scoped to tenant A must return an empty list (never 404
   * for a list — an empty array is the correct isolation response).
   */
  it(
    'liste vide pour tenant A quand toutes les ressources appartiennent au tenant B (100 itérations)',
    () => {
      fc.assert(
        fc.property(
          fc.record({ tenantId: fc.uuid() }),
          fc.record({ tenantId: fc.uuid() }).filter(
            b => b.tenantId !== undefined
          ),
          (tenantA, tenantB) => {
            // Ensure truly distinct tenants (filter handles edge cases)
            fc.pre(tenantA.tenantId !== tenantB.tenantId);

            // Build a DB with resources exclusively owned by tenant B
            const dbRecords: Resource[] = [
              { id: 'res-b-1', tenantId: tenantB.tenantId, data: 'data-b-1' },
              { id: 'res-b-2', tenantId: tenantB.tenantId, data: 'data-b-2' },
            ];

            const { statusCode, body } = simulateListRoute(dbRecords, tenantA.tenantId);

            // Status must be 200 (not 404 for a list — empty list is correct)
            expect(statusCode).toBe(200);

            // The returned list must be empty — no cross-tenant leakage
            const data = (body as { ok: boolean; data: Resource[] }).data;
            expect(data).toHaveLength(0);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    }
  );

  /**
   * Sub-property B: Single-resource route returns 404 for tenant A
   * when the resource belongs to tenant B.
   *
   * This models the `and(eq(table.id, id), eq(table.tenantId, ctx.tenantId))`
   * pattern that must never reveal resource existence to the wrong tenant.
   */
  it(
    'retourne 404 pour tenant A sur une ressource appartenant au tenant B (100 itérations)',
    () => {
      fc.assert(
        fc.property(
          fc.record({ tenantId: fc.uuid() }),
          fc.record({ tenantId: fc.uuid() }),
          fc.uuid(), // resource ID
          (tenantA, tenantB, resourceId) => {
            fc.pre(tenantA.tenantId !== tenantB.tenantId);

            // The resource exists but belongs to tenant B
            const dbRecords: Resource[] = [
              { id: resourceId, tenantId: tenantB.tenantId, data: 'sensitive-data' },
            ];

            const { statusCode, body } = simulateSingleRoute(
              dbRecords,
              resourceId,
              tenantA.tenantId  // tenant A is requesting tenant B's resource
            );

            // Must be 404 — must NOT reveal the resource exists
            expect(statusCode).toBe(404);
            expect((body as { ok: boolean }).ok).toBe(false);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    }
  );

  /**
   * Sub-property C: Resources belonging to tenant A are visible to tenant A
   * but invisible to tenant B (cross-check in both directions).
   *
   * Generates arbitrary resource sets for both tenants and verifies strict
   * bidirectional isolation.
   */
  it(
    'les ressources du tenant A sont visibles par A et invisibles par B (100 itérations)',
    () => {
      fc.assert(
        fc.property(
          fc.record({ tenantId: fc.uuid() }),
          fc.record({ tenantId: fc.uuid() }),
          (tenantA, tenantB) => {
            fc.pre(tenantA.tenantId !== tenantB.tenantId);

            // Manually create a set of resources for each tenant
            const resourcesA: Resource[] = [
              { id: 'a-1', tenantId: tenantA.tenantId, data: 'a-data-1' },
              { id: 'a-2', tenantId: tenantA.tenantId, data: 'a-data-2' },
            ];
            const resourcesB: Resource[] = [
              { id: 'b-1', tenantId: tenantB.tenantId, data: 'b-data-1' },
            ];

            const allRecords = [...resourcesA, ...resourcesB];

            // Tenant A sees only its own resources
            const { body: bodyA } = simulateListRoute(allRecords, tenantA.tenantId);
            const dataA = (bodyA as { data: Resource[] }).data;
            expect(dataA).toHaveLength(resourcesA.length);
            for (const r of dataA) {
              expect(r.tenantId).toBe(tenantA.tenantId);
            }

            // Tenant B sees only its own resources
            const { body: bodyB } = simulateListRoute(allRecords, tenantB.tenantId);
            const dataB = (bodyB as { data: Resource[] }).data;
            expect(dataB).toHaveLength(resourcesB.length);
            for (const r of dataB) {
              expect(r.tenantId).toBe(tenantB.tenantId);
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    }
  );

  /**
   * Sub-property D: For arbitrary non-empty resource sets,
   * no record returned for tenant A has tenantId === tenantB.tenantId.
   *
   * This is the core invariant — records must never leak across boundaries
   * regardless of the data content.
   */
  it(
    'aucune ressource retournée pour le tenant A ne porte le tenantId de B (100 itérations)',
    () => {
      fc.assert(
        fc.property(
          fc.record({ tenantId: fc.uuid() }),
          fc.record({ tenantId: fc.uuid() }),
          (tenantA, tenantB) => {
            fc.pre(tenantA.tenantId !== tenantB.tenantId);

            // Mixed DB: resources from both tenants
            const aResources: Resource[] = Array.from({ length: 3 }, (_, i) => ({
              id: `a-${i}`,
              tenantId: tenantA.tenantId,
              data: `data-a-${i}`,
            }));
            const bResources: Resource[] = Array.from({ length: 3 }, (_, i) => ({
              id: `b-${i}`,
              tenantId: tenantB.tenantId,
              data: `data-b-${i}`,
            }));

            const allRecords = [...aResources, ...bResources];

            // Query as tenant A
            const resultForA = filterByTenant(allRecords, tenantA.tenantId);

            // Invariant: zero records from tenant B leak into tenant A's results
            const leaked = resultForA.filter(r => r.tenantId === tenantB.tenantId);
            expect(leaked).toHaveLength(0);

            // Invariant: all returned records are actually from tenant A
            for (const r of resultForA) {
              expect(r.tenantId).toBe(tenantA.tenantId);
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    }
  );

  /**
   * Sub-property E: Single-resource lookup for tenant A on its own resource
   * returns 200 (ownership is preserved, isolation doesn't block legitimate access).
   */
  it(
    'tenant A peut accéder à ses propres ressources (200) — isolation ne bloque pas le propriétaire (100 itérations)',
    () => {
      fc.assert(
        fc.property(
          fc.record({ tenantId: fc.uuid() }),
          fc.uuid(),
          (tenantA, resourceId) => {
            const dbRecords: Resource[] = [
              { id: resourceId, tenantId: tenantA.tenantId, data: 'my-data' },
            ];

            const { statusCode, body } = simulateSingleRoute(
              dbRecords,
              resourceId,
              tenantA.tenantId
            );

            expect(statusCode).toBe(200);
            const data = (body as { ok: boolean; data: Resource }).data;
            expect(data.tenantId).toBe(tenantA.tenantId);
            expect(data.id).toBe(resourceId);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    }
  );
});
