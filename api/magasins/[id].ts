import type { VercelRequest, VercelResponse } from '@vercel/node';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../../db/client.js';
import { magasins } from '../../db/schema.js';
import { requireTenantAuth, handleOptions } from '../_lib/auth.js';
import { ok, err, numericRow, parseBody } from '../_lib/response.js';

const PatchSchema = z.object({
  nom: z.string().min(1).optional(),
  adresse: z.string().optional(),
  telephone: z.string().optional(),
  actif: z.boolean().optional(),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const body = await parseBody(req);
  if (handleOptions(req, res)) return;
  const ctx = await requireTenantAuth(req, res);
  if (!ctx) return;
  if (ctx.role !== 'admin') return err(res, 'Accès refusé', 403);

  const { id } = req.query as { id: string };
  const db = getDb();

  if (req.method === 'PATCH' || req.method === 'PUT') {
    const parsed = PatchSchema.safeParse(body);
    if (!parsed.success) return err(res, 'Données invalides', 422);
    try {
      const [row] = await db.update(magasins)
        .set({ ...parsed.data, updatedAt: new Date() })
        .where(and(eq(magasins.id, id), eq(magasins.tenantId, ctx.tenantId!)))
        .returning();
      if (!row) return err(res, 'Magasin introuvable', 404);
      return ok(res, numericRow(row));
    } catch (e) {
      console.error('[magasins/:id PATCH]', e);
      return err(res, 'Erreur serveur', 500);
    }
  }

  if (req.method === 'DELETE') {
    try {
      const [row] = await db.delete(magasins)
        .where(and(eq(magasins.id, id), eq(magasins.tenantId, ctx.tenantId!)))
        .returning({ id: magasins.id });
      if (!row) return err(res, 'Magasin introuvable', 404);
      return ok(res, { message: 'Magasin supprimé' });
    } catch (e) {
      console.error('[magasins/:id DELETE]', e);
      return err(res, 'Erreur serveur', 500);
    }
  }

  return err(res, 'Méthode non autorisée', 405);
}
