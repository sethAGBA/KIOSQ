// Feature: gestion-multitenant, Property 2: Round-trip du JWT tenant

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { signToken, verifyToken } from './auth.js';

/**
 * Validates: Requirements 3.1, 1.3
 *
 * Property 2 : Round-trip du JWT tenant
 *
 * For any user payload containing a non-null tenantId, signing a token with
 * `signToken({ ..., tenantId })` and then verifying it with `verifyToken`
 * must produce a payload whose `tenantId` is identical to the original value.
 *
 * This ensures that:
 *  1. The tenantId is correctly embedded in the JWT at sign time (Req 3.1)
 *  2. The tenantId can be reliably extracted from the JWT at verify time (Req 1.3)
 *  3. No corruption or truncation occurs during the sign → verify round-trip
 *  4. All other payload fields (sub, email, role, nom, prenom) are also preserved
 */

// ── Arbitrary generators ──────────────────────────────────────────────

/**
 * Generates a valid user payload with a non-null tenantId.
 * Uses realistic field shapes:
 *  - sub: UUID (simulates a DB user id)
 *  - email: valid email address
 *  - role: one of the known roles
 *  - nom / prenom: non-empty strings (names)
 *  - tenantId: UUID (non-null — superadmin scenario excluded here)
 */
const payloadArb = fc.record({
  sub:      fc.uuid(),
  email:    fc.emailAddress(),
  role:     fc.constantFrom('admin', 'gestionnaire', 'caissier'),
  nom:      fc.string({ minLength: 1, maxLength: 50 }),
  prenom:   fc.string({ minLength: 1, maxLength: 50 }),
  tenantId: fc.uuid(),
});

// ── Properties ───────────────────────────────────────────────────────

describe("jwt-roundtrip — Property 2: Round-trip du JWT tenant (Req 3.1, 1.3)", () => {

  /**
   * Core property: tenantId survives a full sign → verify round-trip.
   *
   * For 100 random payloads, sign a JWT and immediately verify it.
   * The tenantId extracted from the verified payload must exactly equal
   * the tenantId that was put into signToken.
   */
  it(
    'verifyToken(await signToken(payload)).tenantId === payload.tenantId (100 itérations)',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          payloadArb,
          async (payload) => {
            const token = await signToken(payload);
            const verified = await verifyToken(token);

            // Core invariant: tenantId round-trips exactly
            expect(verified.tenantId).toBe(payload.tenantId);
          }
        ),
        { numRuns: 100 }
      );
    }
  );

  /**
   * Extended property: all payload fields survive the round-trip intact.
   *
   * The JWT must not silently drop or alter any of the standard fields.
   * This guards against accidental field omissions in the signToken implementation.
   */
  it(
    'tous les champs du payload sont préservés après le round-trip (100 itérations)',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          payloadArb,
          async (payload) => {
            const token = await signToken(payload);
            const verified = await verifyToken(token);

            expect(verified.tenantId).toBe(payload.tenantId);
            expect(verified.sub).toBe(payload.sub);
            expect(verified.email).toBe(payload.email);
            expect(verified.role).toBe(payload.role);
            expect(verified.nom).toBe(payload.nom);
            expect(verified.prenom).toBe(payload.prenom);
          }
        ),
        { numRuns: 100 }
      );
    }
  );

  /**
   * Null tenantId property: a null tenantId (superadmin scenario) must
   * also round-trip without being coerced to undefined or another value.
   *
   * The JWT spec allows null JSON values — this verifies they are handled.
   */
  it(
    'tenantId null (superadmin) est préservé après le round-trip (100 itérations)',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            sub:      fc.uuid(),
            email:    fc.emailAddress(),
            role:     fc.constant('superadmin'),
            nom:      fc.string({ minLength: 1, maxLength: 50 }),
            prenom:   fc.string({ minLength: 1, maxLength: 50 }),
            tenantId: fc.constant(null),
          }),
          async (payload) => {
            const token = await signToken(payload);
            const verified = await verifyToken(token);

            // null tenantId must survive — not be converted to undefined
            expect(verified.tenantId).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    }
  );

  /**
   * Distinctness property: two distinct tenantIds must never produce
   * the same verified tenantId after round-trip.
   *
   * This guards against any hashing, truncation, or collision in the JWT encoding.
   */
  it(
    'deux tenantIds distincts restent distincts après round-trip (100 itérations)',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          payloadArb,
          payloadArb,
          async (payloadA, payloadB) => {
            fc.pre(payloadA.tenantId !== payloadB.tenantId);

            const [tokenA, tokenB] = await Promise.all([
              signToken(payloadA),
              signToken(payloadB),
            ]);

            const [verifiedA, verifiedB] = await Promise.all([
              verifyToken(tokenA),
              verifyToken(tokenB),
            ]);

            expect(verifiedA.tenantId).toBe(payloadA.tenantId);
            expect(verifiedB.tenantId).toBe(payloadB.tenantId);
            expect(verifiedA.tenantId).not.toBe(verifiedB.tenantId);
          }
        ),
        { numRuns: 100 }
      );
    }
  );
});
