import type { VercelRequest, VercelResponse } from '@vercel/node';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../../db/client';
import { users } from '../../db/schema';
import { requireAuth, handleOptions } from '../_lib/auth';
import { ok, err } from '../_lib/response';

const PatchSchema = z.object({
  nom:       z.string().min(1).optional(),
  prenom:    z.string().min(1).optional(),
  role:      z.enum(['admin', 'commercial', 'gestionnaire', 'comptable', 'lecteur']).optional(),
  telephone: z.string().optional(),
  actif:     z.boolean().optional(),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) return;
  const ctx = await requireAuth(req, res);
  if (!ctx) return;
  if (ctx.role !== 'admin') return err(res, 'Accès refusé', 403);

  const { id } = req.query as { id: string };
  const db = getDb();

  // ── PATCH /api/utilisateurs/:id ───────────────────────
  if (req.method === 'PATCH') {
    const parsed = PatchSchema.safeParse(req.body);
    if (!parsed.success) return err(res, 'Données invalides', 422);
    try {
      const [row] = await db.update(users)
        .set({ ...parsed.data, updatedAt: new Date() })
        .where(eq(users.id, id))
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
      await db.update(users)
        .set({ actif: false, updatedAt: new Date() })
        .where(eq(users.id, id));
      return ok(res, { message: 'Utilisateur désactivé' });
    } catch (e) {
      console.error('[utilisateurs/:id DELETE]', e);
      return err(res, 'Erreur serveur', 500);
    }
  }

  return err(res, 'Méthode non autorisée', 405);
}
