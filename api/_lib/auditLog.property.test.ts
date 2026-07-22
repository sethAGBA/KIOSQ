// Feature: gestion-multitenant, Property 8: Complétude des audit logs

import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';
import { logAction, AUDIT_ACTIONS } from './auditLog';
import type { AuditAction } from './auditLog';

/**
 * Validates: Requirements 11.2
 *
 * Property 8: Complétude des audit logs
 *
 * For every action in the audited actions list (AUDIT_ACTIONS), after calling
 * logAction(db, tenantId, userId, action, resourceType, ...), the mock DB's
 * insert should have been called exactly once with the correct action and
 * tenantId. The count for (tenantId, action) must increment by exactly 1.
 */
describe('auditLog — Property 8: Complétude des audit logs (Req 11.2)', () => {
  // All audited actions as a flat list for fc.constantFrom
  const AUDITED_ACTIONS = Object.values(AUDIT_ACTIONS) as AuditAction[];

  /**
   * Build a minimal mock DB that records insert().values() calls.
   * Returns the mock and an accessor to inspect captured calls.
   */
  function makeMockDb() {
    const insertedValues: unknown[] = [];

    const valuesMock = vi.fn().mockImplementation((data: unknown) => {
      insertedValues.push(data);
      return Promise.resolve();
    });

    const mockDb = {
      insert: vi.fn().mockReturnValue({
        values: valuesMock,
      }),
    };

    return { mockDb, insertedValues, valuesMock };
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it(
    'chaque action auditée incrémente le count de (tenantId, action) de exactement 1 (100 itérations)',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          // Iterate over every action in the audited actions list
          fc.constantFrom(...AUDITED_ACTIONS),
          // Random tenantId
          fc.uuid(),
          // Random userId (nullable)
          fc.option(fc.uuid(), { nil: null }),
          async (action, tenantId, userId) => {
            const { mockDb, insertedValues } = makeMockDb();

            const countBefore = insertedValues.length;

            await logAction(
              mockDb as unknown as Parameters<typeof logAction>[0],
              tenantId,
              userId,
              action,
              'resource-type',
            );

            const countAfter = insertedValues.length;

            // The count must be incremented by exactly 1
            expect(countAfter - countBefore).toBe(1);

            // The inserted record must carry the correct action and tenantId
            const inserted = insertedValues[countBefore] as Record<string, unknown>;
            expect(inserted.action).toBe(action);
            expect(inserted.tenantId).toBe(tenantId);

            // insert() must have been called exactly once
            expect(mockDb.insert).toHaveBeenCalledTimes(1);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    }
  );

  it(
    'le record inséré contient tenantId, userId et resourceType corrects (100 itérations)',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...AUDITED_ACTIONS),
          fc.uuid(),
          fc.option(fc.uuid(), { nil: null }),
          fc.string({ minLength: 1, maxLength: 50 }),
          async (action, tenantId, userId, resourceType) => {
            const { mockDb, insertedValues } = makeMockDb();

            await logAction(
              mockDb as unknown as Parameters<typeof logAction>[0],
              tenantId,
              userId,
              action,
              resourceType,
            );

            const inserted = insertedValues[0] as Record<string, unknown>;

            // Core fields must match exactly
            expect(inserted.action).toBe(action);
            expect(inserted.tenantId).toBe(tenantId);
            expect(inserted.userId).toBe(userId ?? null);
            expect(inserted.resourceType).toBe(resourceType);

            // id must be a non-empty string (nanoid)
            expect(typeof inserted.id).toBe('string');
            expect((inserted.id as string).length).toBeGreaterThan(0);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    }
  );

  it(
    'les champs optionnels resourceId, details et ipAddress sont correctement transmis (100 itérations)',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...AUDITED_ACTIONS),
          fc.uuid(),
          fc.option(fc.uuid(), { nil: undefined }),
          fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
          fc.option(fc.record({
            key: fc.string({ minLength: 1, maxLength: 20 }),
          }), { nil: undefined }),
          fc.option(fc.ipV4(), { nil: undefined }),
          async (action, tenantId, resourceId, userId, details, ipAddress) => {
            const { mockDb, insertedValues } = makeMockDb();

            await logAction(
              mockDb as unknown as Parameters<typeof logAction>[0],
              tenantId,
              userId ?? null,
              action,
              'resource',
              resourceId,
              details,
              ipAddress,
            );

            const inserted = insertedValues[0] as Record<string, unknown>;

            expect(inserted.resourceId).toBe(resourceId ?? null);
            expect(inserted.details).toEqual(details ?? null);
            expect(inserted.ipAddress).toBe(ipAddress ?? null);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    }
  );

  it(
    'une erreur DB n\'est pas propagée (logAction ne throw jamais) (100 itérations)',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...AUDITED_ACTIONS),
          fc.uuid(),
          async (action, tenantId) => {
            // Mock DB whose insert always throws
            const throwingDb = {
              insert: vi.fn().mockReturnValue({
                values: vi.fn().mockRejectedValue(new Error('DB connection failed')),
              }),
            };

            // logAction must never throw even if DB fails
            await expect(
              logAction(
                throwingDb as unknown as Parameters<typeof logAction>[0],
                tenantId,
                null,
                action,
                'resource',
              )
            ).resolves.toBeUndefined();

            return true;
          }
        ),
        { numRuns: 100 }
      );
    }
  );
});
