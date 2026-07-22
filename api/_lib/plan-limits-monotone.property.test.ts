// Feature: gestion-multitenant, Property 5: Monotonie des limites de plan

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { PLAN_LIMITS, getPlanLimitForResource } from './planLimits';
import type { LimitedResource } from './planLimits';

/**
 * Validates: Requirements 7.1, 7.2, 7.3
 *
 * Property 5 : Monotonie des limites de plan
 *
 * The plan hierarchy is: starter < pro < enterprise
 * For every numeric resource (users, produits, magasins), each successive
 * plan must grant a limit that is greater than or equal to the previous one.
 *
 *   PLAN_LIMITS.pro[r]        >= PLAN_LIMITS.starter[r]
 *   PLAN_LIMITS.enterprise[r] >= PLAN_LIMITS.pro[r]
 *
 * This is deterministic (the constants don't change at runtime), but we use
 * fast-check to enumerate all resource × plan-pair combinations exhaustively
 * and document the invariant as a verifiable property.
 */

const LIMITED_RESOURCES: LimitedResource[] = ['users', 'produits', 'magasins'];

describe('planLimits — Property 5: Monotonie des limites de plan (Req 7.1, 7.2, 7.3)', () => {

  /**
   * Sub-property A: pro >= starter for every numeric resource.
   *
   * Uses fc.constantFrom to enumerate all resource names and asserts the
   * monotonicity invariant over 100 runs (each run picks one resource).
   */
  it('pro >= starter pour toutes les ressources numériques (100 itérations)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...LIMITED_RESOURCES),
        (resource) => {
          const starterLimit = getPlanLimitForResource('starter', resource);
          const proLimit     = getPlanLimitForResource('pro',     resource);

          // Infinity is treated as +∞ — any finite value is ≤ Infinity,
          // and Infinity ≤ Infinity, so the invariant holds in all cases.
          expect(proLimit).toBeGreaterThanOrEqual(starterLimit);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Sub-property B: enterprise >= pro for every numeric resource.
   */
  it('enterprise >= pro pour toutes les ressources numériques (100 itérations)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...LIMITED_RESOURCES),
        (resource) => {
          const proLimit         = getPlanLimitForResource('pro',        resource);
          const enterpriseLimit  = getPlanLimitForResource('enterprise', resource);

          expect(enterpriseLimit).toBeGreaterThanOrEqual(proLimit);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Sub-property C: full transitive chain — enterprise >= starter.
   *
   * Derived from A and B but verified independently to make any future
   * regression immediately obvious.
   */
  it('enterprise >= starter pour toutes les ressources numériques (100 itérations)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...LIMITED_RESOURCES),
        (resource) => {
          const starterLimit    = getPlanLimitForResource('starter',    resource);
          const enterpriseLimit = getPlanLimitForResource('enterprise', resource);

          expect(enterpriseLimit).toBeGreaterThanOrEqual(starterLimit);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Snapshot: validate the actual numeric values from PLAN_LIMITS directly,
   * without going through getPlanLimitForResource, to catch any divergence
   * between the two access paths.
   */
  it('les valeurs PLAN_LIMITS brutes respectent la hiérarchie pour chaque ressource', () => {
    for (const resource of LIMITED_RESOURCES) {
      const starter    = PLAN_LIMITS.starter[resource]    as number;
      const pro        = PLAN_LIMITS.pro[resource]        as number;
      const enterprise = PLAN_LIMITS.enterprise[resource] as number;

      expect(pro).toBeGreaterThanOrEqual(starter);
      expect(enterprise).toBeGreaterThanOrEqual(pro);
    }
  });
});
