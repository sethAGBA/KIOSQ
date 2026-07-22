// Feature: gestion-multitenant, Property 6: Rejet à l'atteinte des limites de plan

import { describe, it, expect, vi } from 'vitest';
import fc from 'fast-check';
import { checkPlanLimit, PLAN_LIMITS, getPlanLimitForResource } from './planLimits';
import type { LimitedResource, PlanName } from './planLimits';

/**
 * Validates: Requirements 7.4, 7.5, 7.6
 *
 * Property 6: Rejet à l'atteinte des limites de plan
 *
 * For any tenant whose usage of a limited resource is exactly equal to
 * PLAN_LIMITS[plan][resource], any attempt to create a new instance of that
 * resource must:
 *   1. Have checkPlanLimit return false
 *   2. Have the mocked response receive a 403 status
 */
describe('planLimits — Property 6: Rejet à l\'atteinte des limites de plan (Req 7.4, 7.5, 7.6)', () => {

  /**
   * Helper: build a mock Db whose count() query returns exactly `countValue`
   * for the appropriate resource table.
   */
  function makeMockDb(plan: PlanName, countValue: number) {
    // The mock chain: db.select().from(table).where(...) → [{ value: countValue }]
    //                 db.select().from(tenants).where(...).limit(1) → [{ plan }]
    const selectResult = (returnValue: unknown[]) => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue(returnValue),
          // For queries without .limit (resource count queries)
          then: undefined,
          // resolved as a promise directly in some chains
        }),
        // Directly awaitable (for count queries that don't use .limit)
      }),
    });

    // We need to handle two distinct query shapes:
    //   1. db.select({ plan }).from(tenants).where(...).limit(1) → [{ plan }]
    //   2. db.select({ value: count() }).from(resource).where(...) → [{ value: N }]

    let callIndex = 0;
    const mockDb = {
      select: vi.fn().mockImplementation(() => {
        callIndex++;
        if (callIndex === 1) {
          // First call: tenant plan lookup
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([{ plan }]),
              }),
            }),
          };
        } else {
          // Second call: resource count query
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([{ value: countValue }]),
            }),
          };
        }
      }),
    };

    return mockDb;
  }

  /**
   * Helper: build a mock VercelResponse that records the status and body.
   */
  function makeMockRes() {
    const mock = {
      statusCode: 0,
      body: null as unknown,
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockImplementation(function (this: typeof mock, body: unknown) {
        mock.body = body;
        return mock;
      }),
    };
    mock.status.mockImplementation((code: number) => {
      mock.statusCode = code;
      return mock;
    });
    return mock;
  }

  // The limited resources for starter and pro plans
  const LIMITED_RESOURCES: LimitedResource[] = ['users', 'produits', 'magasins'];

  it('returns false and writes 403 when usage equals plan limit (100 iterations)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('starter' as PlanName, 'pro' as PlanName),
        fc.constantFrom(...LIMITED_RESOURCES),
        async (plan, resource) => {
          // Get the exact limit for this plan/resource combination
          const limit = getPlanLimitForResource(plan, resource);

          // Skip Infinity limits (enterprise has no finite limit for these resources;
          // pro produits is Infinity — not a bounded resource for that plan)
          if (!isFinite(limit)) {
            return true; // vacuously true: no finite limit to enforce
          }

          // Build a mock DB returning count === limit (at the boundary)
          const mockDb = makeMockDb(plan, limit);
          const mockRes = makeMockRes();

          const result = await checkPlanLimit(
            mockDb as unknown as Parameters<typeof checkPlanLimit>[0],
            'tenant-test-id',
            resource,
            mockRes as unknown as Parameters<typeof checkPlanLimit>[3]
          );

          // checkPlanLimit must return false when usage === limit
          expect(result).toBe(false);

          // The response must have received a 403 status
          expect(mockRes.statusCode).toBe(403);

          // The response body must include an error message
          expect(mockRes.body).toEqual(
            expect.objectContaining({ error: expect.stringContaining(resource) })
          );

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('returns false and writes 403 when usage exceeds plan limit (100 iterations)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('starter' as PlanName, 'pro' as PlanName),
        fc.constantFrom(...LIMITED_RESOURCES),
        fc.integer({ min: 1, max: 100 }),
        async (plan, resource, excess) => {
          const limit = getPlanLimitForResource(plan, resource);

          if (!isFinite(limit)) {
            return true;
          }

          // Count is limit + excess (over the boundary)
          const mockDb = makeMockDb(plan, limit + excess);
          const mockRes = makeMockRes();

          const result = await checkPlanLimit(
            mockDb as unknown as Parameters<typeof checkPlanLimit>[0],
            'tenant-test-id',
            resource,
            mockRes as unknown as Parameters<typeof checkPlanLimit>[3]
          );

          expect(result).toBe(false);
          expect(mockRes.statusCode).toBe(403);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('returns true when usage is strictly below plan limit (100 iterations)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('starter' as PlanName, 'pro' as PlanName),
        fc.constantFrom(...LIMITED_RESOURCES),
        async (plan, resource) => {
          const limit = getPlanLimitForResource(plan, resource);

          if (!isFinite(limit) || limit === 0) {
            return true;
          }

          // Count is strictly below the limit (limit - 1)
          const countBelow = limit - 1;
          const mockDb = makeMockDb(plan, countBelow);
          const mockRes = makeMockRes();

          const result = await checkPlanLimit(
            mockDb as unknown as Parameters<typeof checkPlanLimit>[0],
            'tenant-test-id',
            resource,
            mockRes as unknown as Parameters<typeof checkPlanLimit>[3]
          );

          // Must return true when below the limit
          expect(result).toBe(true);
          // Must not set a 403 status
          expect(mockRes.statusCode).not.toBe(403);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('covers all finite-limit (plan, resource) pairs from PLAN_LIMITS', () => {
    // Ensure every finite limit combination is accounted for
    const plans: PlanName[] = ['starter', 'pro', 'enterprise'];
    for (const plan of plans) {
      for (const resource of LIMITED_RESOURCES) {
        const limit = PLAN_LIMITS[plan][resource];
        if (isFinite(limit as number)) {
          expect(limit).toBeGreaterThan(0);
        }
      }
    }
  });
});
