// Feature: gestion-multitenant, Property 2: Round-trip du JWT tenant

import { describe, it } from 'vitest';
import fc from 'fast-check';
import { expect } from 'vitest';
import { signToken, verifyToken } from '../../../api/_lib/auth.js';

/**
 * Validates: Requirements 3.1, 1.3
 *
 * Property 2 — Round-trip du JWT tenant
 *
 * For any user with a non-null tenantId, signing a token with
 * signToken({ ..., tenantId }) then verifying it with verifyToken must
 * produce a payload where tenantId is identical to the original value.
 * Other identity fields (sub, email, role) must also be preserved.
 */
describe('Property 2: Round-trip du JWT tenant (Req 3.1, 1.3)', () => {
  it('tenantId and identity fields survive sign → verify round-trip', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          sub:      fc.uuid(),
          email:    fc.emailAddress(),
          role:     fc.constantFrom('admin', 'gestionnaire', 'vendeur'),
          nom:      fc.string(),
          prenom:   fc.string(),
          tenantId: fc.uuid(),
        }),
        async (payload) => {
          const token   = await signToken(payload);
          const decoded = await verifyToken(token);

          expect(decoded.tenantId).toBe(payload.tenantId);
          expect(decoded.sub).toBe(payload.sub);
          expect(decoded.email).toBe(payload.email);
          expect(decoded.role).toBe(payload.role);
        },
      ),
      { numRuns: 100 },
    );
  });
});
