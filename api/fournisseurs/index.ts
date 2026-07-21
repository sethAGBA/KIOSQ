import type { VercelRequest, VercelResponse } from '@vercel/node';
import { desc } from 'drizzle-orm';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { getDb } from '../../db/client.js';
import { fournisseurs } from '../../db/schema.js';
import { requireAuth, handleOptions } from '../_lib/auth.js';
import { ok, err, numericRows, numericRow, parseBody} from '../_lib/response.js';

const FournisseurSchema = z.object({
  nom:                z.string().min(1),
  contact:            z.string().optional(),
  email:              z.string().email().optional().or(z.literal('')),
  telephone:          z.string().optional(),
  adresse:            z.string().optional(),
  pays:               z.string().optional(),
  delaiLivraison:     z.number().int().optional(),
  conditionsPaiement: z.string().optional(),
  notes:              z.string().optional(),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const body = await parseBody(req);
  if (handleOptions(req, res)) return;
  const ctx = await requireAuth(req, res);
  if (!ctx) return;

  const db = getDb();

  if (req.method === 'GET') {
    try {
      const rows = await db.select().from(fournisseurs).orderBy(desc(fournisseurs.nom));
      return ok(res, numericRows(rows as Record<string, unknown>[]));
    } catch (e) { return err(res, 'Erreur serveur', 500); }
  }

  if (req.method === 'POST') {
    if (!['admin', 'gestionnaire'].includes(ctx.role)) return err(res, 'Accès refusé', 403);
    const parsed = FournisseurSchema.safeParse(body);
    if (!parsed.success) return err(res, 'Données invalides', 422);
    try {
      const [row] = await db.insert(fournisseurs).values({
        id: nanoid(),
        ...parsed.data,
        email: parsed.data.email || null,
      }).returning();
      return ok(res, numericRow(row), 201);
    } catch (e) { return err(res, 'Erreur serveur', 500); }
  }

  return err(res, 'Méthode non autorisée', 405);
}
