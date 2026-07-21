import type { VercelRequest, VercelResponse } from '@vercel/node';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../../db/client.js';
import { fournisseurs } from '../../db/schema.js';
import { requireAuth, handleOptions } from '../_lib/auth.js';
import { ok, err, numericRow, parseBody} from '../_lib/response.js';

const PatchSchema = z.object({
  nom:                z.string().optional(),
  contact:            z.string().optional(),
  email:              z.string().optional(),
  telephone:          z.string().optional(),
  adresse:            z.string().optional(),
  pays:               z.string().optional(),
  delaiLivraison:     z.number().int().optional(),
  conditionsPaiement: z.string().optional(),
  actif:              z.boolean().optional(),
  notes:              z.string().optional(),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const body = await parseBody(req);
  if (handleOptions(req, res)) return;
  const ctx = await requireAuth(req, res);
  if (!ctx) return;

  const { id } = req.query as { id: string };
  const db = getDb();

  if (req.method === 'GET') {
    try {
      const [row] = await db.select().from(fournisseurs).where(eq(fournisseurs.id, id)).limit(1);
      if (!row) return err(res, 'Fournisseur introuvable', 404);
      return ok(res, numericRow(row));
    } catch (e) { return err(res, 'Erreur serveur', 500); }
  }

  if (req.method === 'PATCH') {
    if (!['admin', 'gestionnaire'].includes(ctx.role)) return err(res, 'Accès refusé', 403);
    const parsed = PatchSchema.safeParse(body);
    if (!parsed.success) return err(res, 'Données invalides', 422);
    try {
      const [row] = await db.update(fournisseurs)
        .set({ ...parsed.data, updatedAt: new Date() })
        .where(eq(fournisseurs.id, id))
        .returning();
      if (!row) return err(res, 'Fournisseur introuvable', 404);
      return ok(res, numericRow(row));
    } catch (e) { return err(res, 'Erreur serveur', 500); }
  }

  return err(res, 'Méthode non autorisée', 405);
}
