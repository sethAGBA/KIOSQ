import type { VercelRequest, VercelResponse } from '@vercel/node';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../../db/client.js';
import { users } from '../../db/schema.js';
import { requireTenantAuth, handleOptions } from '../_lib/auth.js';
import { ok, err, parseBody } from '../_lib/response.js';
import { logAction } from '../_lib/auditLog.js';

const PatchSchema = z.object({
  nom:       z.string().min(1).optional(),
  prenom:    z.string().min(1).optional(),
  role:      z.enum(['admin', 'commercial', 'gestionnaire', 'comptable', 'lecteur']).optional(),
  telephone: z.string().optional(),
  actif:     z.boolean().optional(),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const body = await parseBody(req);
  if (handleOptions(req, res)) return;
  const ctx = await requireTenantAuth(req, res);
  if (!ctx) return;
  if (ctx.role !== 'admin') return err(res, 'Accès refusé', 403);

  const { id } = req.query as { id: string };
  const db = getDb();

  // ── PATCH /api/utilisateurs/:id ───────────────────────
  if (req.method === 'PATCH') {
    const parsed = PatchSchema.safeParse(body);
    if (!parsed.success) return err(res, 'Données invalides', 422);
    try {
      const [row] = await db.update(users)
        .set({ ...parsed.data, updatedAt: new Date() })
        .where(and(eq(users.id, id), eq(users.tenantId, ctx.tenantId!)))
        .returning({
          id:        users.id,
          email:     users.email,
          nom:       users.nom,
          prenom:    users.prenom,
          role:      users.role,
          telephone: users.telephone,
          actif:     users.actif,
          createdAt: users.createdAt,
        });
      if (!row) return err(res, 'Utilisateur introuvable', 404);
      return ok(res, row);
    } catch (e) {
      console.error('[utilisateurs/:id PATCH]', e);
      return err(res, 'Erreur serveur', 500);
    }
  }

  // ── DELETE /api/utilisateurs/:id (désactivation) ──────
  if (req.method === 'DELETE') {
    if (ctx.sub === id) return err(res, 'Impossible de se désactiver soi-même', 400);
    try {
      const [row] = await db.update(users)
        .set({ actif: false, updatedAt: new Date() })
        .where(and(eq(users.id, id), eq(users.tenantId, ctx.tenantId!)))
        .returning({ id: users.id });
      if (!row) return err(res, 'Utilisateur introuvable', 404);
      await logAction(db, ctx.tenantId!, ctx.sub, 'user.disabled', 'user', id);
      return ok(res, { message: 'Utilisateur désactivé' });
    } catch (e) {
      console.error('[utilisateurs/:id DELETE]', e);
      return err(res, 'Erreur serveur', 500);
    }
  }

  return err(res, 'Méthode non autorisée', 405);
}
