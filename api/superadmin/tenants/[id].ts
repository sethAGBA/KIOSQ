import type { VercelRequest, VercelResponse } from '@vercel/node';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../../../db/client.js';
import { tenants, users } from '../../../db/schema.js';
import { requireSuperadmin, handleOptions } from '../../_lib/auth.js';
import { ok, err, parseBody } from '../../_lib/response.js';

export const config = { api: { bodyParser: true } };

// ── Validation schema ─────────────────────────────────────

const PatchTenantSchema = z.object({
  plan:               z.enum(['starter', 'pro', 'enterprise']).optional(),
  statut:             z.enum(['actif', 'suspendu', 'essai']).optional(),
  enMaintenance:      z.boolean().optional(),
  messageMaintenance: z.string().nullable().optional(),
}).strict();

// ── Handler ───────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) return;

  const ctx = await requireSuperadmin(req, res);
  if (!ctx) return;

  const { id } = req.query as { id: string };
  if (!id || typeof id !== 'string') {
    return err(res, 'Identifiant manquant', 400);
  }

  const db = getDb();

  // ── GET /api/superadmin/tenants/[id] ─────────────────
  if (req.method === 'GET') {
    try {
      const [tenant] = await db
        .select()
        .from(tenants)
        .where(eq(tenants.id, id))
        .limit(1);

      if (!tenant) {
        return err(res, 'Boutique introuvable', 404);
      }

      const tenantUsers = await db
        .select({
          id:        users.id,
          email:     users.email,
          nom:       users.nom,
          prenom:    users.prenom,
          role:      users.role,
          actif:     users.actif,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(eq(users.tenantId, id));

      return ok(res, { ...tenant, users: tenantUsers });
    } catch (e) {
      console.error('[superadmin/tenants/[id] GET]', e);
      return err(res, 'Erreur serveur', 500);
    }
  }

  // ── PATCH /api/superadmin/tenants/[id] ───────────────
  if (req.method === 'PATCH') {
    const body = await parseBody(req);
    const parsed = PatchTenantSchema.safeParse(body);
    if (!parsed.success) {
      return err(
        res,
        'Données invalides : ' + parsed.error.issues.map((i) => i.message).join(', '),
        422,
      );
    }

    // Nothing to update
    if (Object.keys(parsed.data).length === 0) {
      return err(res, 'Aucun champ à modifier', 400);
    }

    try {
      const [existing] = await db
        .select({ id: tenants.id })
        .from(tenants)
        .where(eq(tenants.id, id))
        .limit(1);

      if (!existing) {
        return err(res, 'Boutique introuvable', 404);
      }

      const [updated] = await db
        .update(tenants)
        .set({ ...parsed.data, updatedAt: new Date() })
        .where(eq(tenants.id, id))
        .returning();

      return ok(res, updated);
    } catch (e) {
      console.error('[superadmin/tenants/[id] PATCH]', e);
      return err(res, 'Erreur serveur', 500);
    }
  }

  // ── DELETE /api/superadmin/tenants/[id] ──────────────
  if (req.method === 'DELETE') {
    try {
      const [existing] = await db
        .select({ id: tenants.id, statut: tenants.statut })
        .from(tenants)
        .where(eq(tenants.id, id))
        .limit(1);

      if (!existing) {
        return err(res, 'Boutique introuvable', 404);
      }

      // Soft delete: set statut to 'suspendu'
      const [updated] = await db
        .update(tenants)
        .set({ statut: 'suspendu', updatedAt: new Date() })
        .where(eq(tenants.id, id))
        .returning({ id: tenants.id, statut: tenants.statut });

      return ok(res, updated);
    } catch (e) {
      console.error('[superadmin/tenants/[id] DELETE]', e);
      return err(res, 'Erreur serveur', 500);
    }
  }

  return err(res, 'Méthode non autorisée', 405);
}
