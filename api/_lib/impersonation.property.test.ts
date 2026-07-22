// Feature: gestion-multitenant, Property 7: Scope du JWT d'impersonation

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { signToken, verifyToken } from './auth';

/**
 * Validates: Requirements 6.1, 6.2
 *
 * Property 7: Scope du JWT d'impersonation
 *
 * For any (superadminId, tenantId) pair, the JWT emitted by calling signToken
 * with impersonation parameters must satisfy simultaneously:
 *   1. payload.tenantId === tenantId
 *   2. payload.impersonatedBy === superadminId
 *   3. payload.role === 'admin'
 *   4. payload.exp - payload.iat <= 7200  (≤ 2 hours)
 */
describe("auth — Property 7: Scope du JWT d'impersonation (Req 6.1, 6.2)", () => {

  it('le JWT d\'impersonation satisfait toutes les contraintes de scope (100 itérations)', async () => {
    await fc.assert(
      fc.asyncProperty(
        // superadminId: UUID representing the superadmin's identity
        fc.uuid(),
        // tenantId: UUID representing the target tenant
        fc.uuid(),
        async (superadminId, tenantId) => {
          // Emit an impersonation JWT exactly as api/auth/impersonate.ts does
          const token = await signToken({
            sub:            'admin-user-id',
            email:          'admin@tenant.example.com',
            role:           'admin',
            nom:            'Admin',
            prenom:         'Test',
            tenantId,
            impersonatedBy: superadminId,
            expiresIn:      '2h',
          });

          // Decode and verify
          const payload = await verifyToken(token) as {
            sub: string;
            email: string;
            role: string;
            nom: string;
            prenom: string;
            tenantId?: string | null;
            impersonatedBy?: string;
            iat?: number;
            exp?: number;
          };

          // 1. tenantId is preserved exactly
          expect(payload.tenantId).toBe(tenantId);

          // 2. impersonatedBy is set to the superadmin's id
          expect(payload.impersonatedBy).toBe(superadminId);

          // 3. role is always 'admin' for impersonation tokens
          expect(payload.role).toBe('admin');

          // 4. Token lifetime does not exceed 2 hours (7200 seconds)
          expect(payload.exp).toBeDefined();
          expect(payload.iat).toBeDefined();
          expect(payload.exp! - payload.iat!).toBeLessThanOrEqual(7200);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('exp - iat vaut exactement 7200 pour expiresIn="2h" (100 itérations)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.uuid(),
        async (superadminId, tenantId) => {
          const token = await signToken({
            sub:            'admin-user-id',
            email:          'admin@tenant.example.com',
            role:           'admin',
            nom:            'Admin',
            prenom:         'Test',
            tenantId,
            impersonatedBy: superadminId,
            expiresIn:      '2h',
          });

          const payload = await verifyToken(token) as {
            iat?: number;
            exp?: number;
          };

          // exp - iat must be exactly 7200 (jose sets it as iat + duration)
          const duration = payload.exp! - payload.iat!;
          expect(duration).toBe(7200);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('impersonatedBy ne contamine pas les tokens normaux sans impersonation', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.uuid(),
        async (userId, tenantId) => {
          // A normal (non-impersonation) token should not carry impersonatedBy
          const token = await signToken({
            sub:      userId,
            email:    'user@tenant.example.com',
            role:     'admin',
            nom:      'User',
            prenom:   'Test',
            tenantId,
            expiresIn: '7d',
          });

          const payload = await verifyToken(token) as {
            impersonatedBy?: string;
            tenantId?: string | null;
          };

          expect(payload.impersonatedBy).toBeUndefined();
          expect(payload.tenantId).toBe(tenantId);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
