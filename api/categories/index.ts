import type { VercelRequest, VercelResponse } from '@vercel/node';
import { nanoid } from 'nanoid';
import { getDb } from '../../db/client';
import { categories } from '../../db/schema';
import { requireAuth, handleOptions } from '../_lib/auth';
import { ok, err } from '../_lib/response';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) return;
  const ctx = await requireAuth(req, res);
  if (!ctx) return;

  const db = getDb();

  if (req.method === 'GET') {
    try {
      const rows = await db.select().from(categories);
      return ok(res, rows);
    } catch (e) { return err(res, 'Erreur serveur', 500); }
  }

  if (req.method === 'POST') {
    if (ctx.role !== 'admin') return err(res, 'Accès refusé', 403);
    const { nom, description, couleur } = req.body as { nom: string; description?: string; couleur?: string };
    if (!nom) return err(res, 'Nom requis', 422);
    try {
      const [row] = await db.insert(categories).values({ id: nanoid(), nom, description, couleur }).returning();
      return ok(res, row, 201);
    } catch (e) { return err(res, 'Erreur serveur', 500); }
  }

  return err(res, 'Méthode non autorisée', 405);
}
