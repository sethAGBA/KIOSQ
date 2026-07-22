import type { VercelRequest, VercelResponse } from '@vercel/node';
import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { getDb } from '../../db/client.js';
import { magasins } from '../../db/schema.js';
import { requireTenantAuth, handleOptions } from '../_lib/auth.js';
import { ok, err, numericRows, numericRow, parseBody } from '../_lib/response.js';

const MagasinSchema = z.object({
  nom: z.string().min(1),
  adresse: z.string().optional(),
  telephone: z.string().optional(),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const body = await parseBody(req);
  if (handleOptions(req, res)) return;
  const ctx = await requireTenantAuth(req, res);
  if (!ctx) return;

  const db = getDb();

  if (req.method === 'GET') {
    try {
      const rows = await db.select().from(magasins).where(eq(magasins.tenantId, ctx.tenantId)).orderBy(desc(magasins.createdAt));
      return ok(res, numericRows(rows as Record<string, unknown>[]));
    } catch (error) {
      console.error('[Magasins GET]', error);
      return err(res, 'Erreur serveur', 500);
    }
  }

  if (req.method === 'POST') {
    if (ctx.role !== 'admin') return err(res, 'Accès refusé', 403);
    const parsed = MagasinSchema.safeParse(body);
    if (!parsed.success) return err(res, 'Données invalides', 422);

    try {
      const [row] = await db.insert(magasins).values({
        id: nanoid(),
        tenantId: ctx.tenantId,
        nom: parsed.data.nom,
        adresse: parsed.data.adresse,
        telephone: parsed.data.telephone,
      }).returning();
      return ok(res, numericRow(row), 201);
    } catch (error) {
      console.error('[Magasins POST]', error);
      return err(res, 'Erreur serveur', 500);
    }
  }

  return err(res, 'Méthode non autorisée', 405);
}
