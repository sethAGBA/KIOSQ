import type { VercelRequest, VercelResponse } from '@vercel/node';
import { desc } from 'drizzle-orm';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { getDb } from '../../db/client.js';
import { unites } from '../../db/schema.js';
import { requireAuth, handleOptions } from '../_lib/auth.js';
import { ok, err, parseBody } from '../_lib/response.js';

const UniteSchema = z.object({
  nom:         z.string().min(1),
  abreviation: z.string().min(1),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) return;
  const ctx = await requireAuth(req, res);
  if (!ctx) return;

  const db = getDb();

  // ── GET /api/unites ───────────────────────────────────
  if (req.method === 'GET') {
    try {
      const rows = await db.select().from(unites).orderBy(desc(unites.createdAt));
      return ok(res, rows);
    } catch (e) {
      console.error('[unites GET]', e);
      return err(res, 'Erreur serveur', 500);
    }
  }

  // ── POST /api/unites ──────────────────────────────────
  if (req.method === 'POST') {
    if (!['admin', 'gestionnaire'].includes(ctx.role)) return err(res, 'Accès refusé', 403);
    const body = await parseBody(req);
    const parsed = UniteSchema.safeParse(body);
    if (!parsed.success) return err(res, 'Données invalides', 422);
    try {
      const [row] = await db.insert(unites).values({
        id: nanoid(),
        ...parsed.data,
      }).returning();
      return ok(res, row, 201);
    } catch (e) {
      console.error('[unites POST]', e);
      return err(res, 'Erreur serveur', 500);
    }
  }

  return err(res, 'Méthode non autorisée', 405);
}
