// Feature: gestion-multitenant, Property 5: Monotonie des limites de plan

import { describe, it } from 'vitest';
import * as fc from 'fast-check';
import { PLAN_LIMITS, getPlanLimitForResource } from '../../../api/_lib/planLimits.js';
import type { LimitedResource } from '../../../api/_lib/planLimits.js';

/**
 * Validates: Requirements 7.1, 7.2, 7.3
 *
 * Property 5 — Plan limit monotonicity:
 * For every consecutive plan pair (starter → pro) and (pro → enterprise),
 * and for every numeric resource (users, produits, magasins), the upper
 * plan's limit must be >= the lower plan's limit.
 * Note: Infinity >= Infinity is `true` in JS, so unlimited plans work naturally.
 */
describe('Property 5: Monotonie des limites de plan', () => {
  it('pro[r] >= starter[r] for all numeric resources', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<LimitedResource>('users', 'produits', 'magasins'),
        (r) => {
          const starterLimit = getPlanLimitForResource('starter', r);
          const proLimit = getPlanLimitForResource('pro', r);
          return proLimit >= starterLimit;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('enterprise[r] >= pro[r] for all numeric resources', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<LimitedResource>('users', 'produits', 'magasins'),
        (r) => {
          const proLimit = getPlanLimitForResource('pro', r);
          const enterpriseLimit = getPlanLimitForResource('enterprise', r);
          return enterpriseLimit >= proLimit;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('verifies the full plan ordering: starter <= pro <= enterprise', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<LimitedResource>('users', 'produits', 'magasins'),
        (r) => {
          const starter = getPlanLimitForResource('starter', r);
          const pro = getPlanLimitForResource('pro', r);
          const enterprise = getPlanLimitForResource('enterprise', r);
          return pro >= starter && enterprise >= pro;
        }
      ),
      { numRuns: 100 }
    );
  });
});
