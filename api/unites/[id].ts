import type { VercelRequest, VercelResponse } from '@vercel/node';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../../db/client.js';
import { unites } from '../../db/schema.js';
import { requireAuth, handleOptions } from '../_lib/auth.js';
import { ok, err, parseBody } from '../_lib/response.js';

const PatchSchema = z.object({
  nom:         z.string().min(1).optional(),
  abreviation: z.string().min(1).optional(),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) return;
  const ctx = await requireAuth(req, res);
  if (!ctx) return;
  if (!['admin', 'gestionnaire'].includes(ctx.role)) return err(res, 'Accès refusé', 403);

  const { id } = req.query as { id: string };
  const db = getDb();

  // ── PATCH /api/unites/:id ─────────────────────────────
  if (req.method === 'PATCH') {
    const body = await parseBody(req);
    const parsed = PatchSchema.safeParse(body);
    if (!parsed.success) return err(res, 'Données invalides', 422);
    try {
      const [row] = await db.update(unites)
        .set({ ...parsed.data, updatedAt: new Date() })
        .where(eq(unites.id, id))
        .returning();
      if (!row) return err(res, 'Unité introuvable', 404);
      return ok(res, row);
    } catch (e) {
      console.error('[unites/:id PATCH]', e);
      return err(res, 'Erreur serveur', 500);
    }
  }

  // ── DELETE /api/unites/:id ────────────────────────────
  if (req.method === 'DELETE') {
    try {
      const [row] = await db.delete(unites).where(eq(unites.id, id)).returning();
      if (!row) return err(res, 'Unité introuvable', 404);
      return ok(res, { message: 'Unité supprimée' });
    } catch (e) {
      console.error('[unites/:id DELETE]', e);
      return err(res, 'Erreur serveur', 500);
    }
  }

  return err(res, 'Méthode non autorisée', 405);
}
