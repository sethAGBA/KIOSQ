import type { VercelRequest, VercelResponse } from '@vercel/node';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../../db/client';
import { clients } from '../../db/schema';
import { requireAuth, handleOptions } from '../_lib/auth';
import { ok, err, numericRow } from '../_lib/response';

const PatchSchema = z.object({
  nom:             z.string().min(1).optional(),
  prenom:          z.string().optional(),
  email:           z.string().email().optional().or(z.literal('')),
  telephone:       z.string().optional(),
  adresse:         z.string().optional(),
  ville:           z.string().optional(),
  pays:            z.string().optional(),
  secteurActivite: z.string().optional(),
  commercial:      z.string().optional(),
  typeClient:      z.enum(['particulier', 'entreprise']).optional(),
  actif:           z.boolean().optional(),
  notes:           z.string().optional(),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) return;
  const ctx = await requireAuth(req, res);
  if (!ctx) return;

  const { id } = req.query as { id: string };
  const db = getDb();

  // ── GET /api/clients/:id ──────────────────────────────
  if (req.method === 'GET') {
    try {
      const [row] = await db.select().from(clients).where(eq(clients.id, id)).limit(1);
      if (!row) return err(res, 'Client introuvable', 404);
      return ok(res, numericRow(row));
    } catch (e) {
      console.error('[clients/:id GET]', e);
      return err(res, 'Erreur serveur', 500);
    }
  }

  // ── PATCH /api/clients/:id ────────────────────────────
  if (req.method === 'PATCH') {
    const parsed = PatchSchema.safeParse(req.body);
    if (!parsed.success) return err(res, 'Données invalides', 422);
    try {
      const [row] = await db.update(clients)
        .set({ ...parsed.data, updatedAt: new Date() })
        .where(eq(clients.id, id))
        .returning();
      if (!row) return err(res, 'Client introuvable', 404);
      return ok(res, numericRow(row));
    } catch (e) {
      console.error('[clients/:id PATCH]', e);
      return err(res, 'Erreur serveur', 500);
    }
  }

  // ── DELETE /api/clients/:id ───────────────────────────
  if (req.method === 'DELETE') {
    if (ctx.role !== 'admin') return err(res, 'Accès refusé', 403);
    try {
      await db.update(clients)
        .set({ actif: false, updatedAt: new Date() })
        .where(eq(clients.id, id));
      return ok(res, { message: 'Client désactivé' });
    } catch (e) {
      console.error('[clients/:id DELETE]', e);
      return err(res, 'Erreur serveur', 500);
    }
  }

  return err(res, 'Méthode non autorisée', 405);
}
