import { nanoid } from 'nanoid';
import { auditLogs } from '../../db/schema.js';
import type { Db } from '../../db/client.js';

// ── Audit action constants ────────────────────────────────
export const AUDIT_ACTIONS = {
  FACTURE_CREATED:     'facture.created',
  FACTURE_UPDATED:     'facture.updated',
  FACTURE_DELETED:     'facture.deleted',
  PRODUIT_CREATED:     'produit.created',
  PRODUIT_DELETED:     'produit.deleted',
  USER_LOGIN:          'user.login',
  USER_LOGOUT:         'user.logout',
  USER_CREATED:        'user.created',
  USER_DISABLED:       'user.disabled',
  IMPERSONATION_START: 'impersonation.start',
  IMPERSONATION_END:   'impersonation.end',
} as const;

export type AuditAction = typeof AUDIT_ACTIONS[keyof typeof AUDIT_ACTIONS];

// ── logAction helper ─────────────────────────────────────
/**
 * Inserts an audit log entry into `audit_logs`.
 * Never throws — errors are caught and logged to console.error so audit
 * logging never breaks the main request flow.
 *
 * Requirements: 11.2
 */
export async function logAction(
  db: Db,
  tenantId: string,
  userId: string | null,
  action: string,
  resourceType: string,
  resourceId?: string,
  details?: Record<string, unknown>,
  ipAddress?: string
): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      id:           nanoid(),
      tenantId,
      userId:       userId ?? null,
      action,
      resourceType,
      resourceId:   resourceId ?? null,
      details:      details ?? null,
      ipAddress:    ipAddress ?? null,
    });
  } catch (err) {
    console.error('[auditLog] Failed to insert audit log entry:', err);
  }
}
