import type { VercelRequest, VercelResponse } from '@vercel/node';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../../db/client.js';
import { categories } from '../../db/schema.js';
import { requireAuth, handleOptions } from '../_lib/auth.js';
import { ok, err, parseBody } from '../_lib/response.js';

const PatchSchema = z.object({
  nom:         z.string().min(1).optional(),
  description: z.string().optional(),
  couleur:     z.string().optional(),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const body = await parseBody(req);
  if (handleOptions(req, res)) return;
  const ctx = await requireAuth(req, res);
  if (!ctx) return;

  const { id } = req.query as { id: string };
  const db = getDb();

  if (req.method === 'PATCH') {
    const parsed = PatchSchema.safeParse(body);
    if (!parsed.success) return err(res, 'Données invalides', 422);
    try {
      const updates: Record<string, unknown> = {};
      if (parsed.data.nom         !== undefined) updates.nom         = parsed.data.nom;
      if (parsed.data.description !== undefined) updates.description = parsed.data.description;
      if (parsed.data.couleur     !== undefined) updates.couleur     = parsed.data.couleur;
      const [row] = await db.update(categories)
        .set(updates as Parameters<ReturnType<typeof db.update<typeof categories>>['set']>[0])
        .where(eq(categories.id, id))
        .returning();
      if (!row) return err(res, 'Catégorie introuvable', 404);
      return ok(res, row);
    } catch (e) { return err(res, 'Erreur serveur', 500); }
  }

  if (req.method === 'DELETE') {
    if (ctx.role !== 'admin') return err(res, 'Accès refusé', 403);
    try {
      const [row] = await db.delete(categories).where(eq(categories.id, id)).returning();
      if (!row) return err(res, 'Catégorie introuvable', 404);
      return ok(res, { message: 'Catégorie supprimée' });
    } catch (e) { return err(res, 'Erreur serveur', 500); }
  }

  return err(res, 'Méthode non autorisée', 405);
}
