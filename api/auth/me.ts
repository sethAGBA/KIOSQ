import type { VercelRequest, VercelResponse } from '@vercel/node';
import { eq } from 'drizzle-orm';
import { getDb } from '../../db/client.js';
import { users } from '../../db/schema.js';
import { requireAuth, handleOptions } from '../_lib/auth.js';
import { ok, err } from '../_lib/response.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) return;
  if (req.method !== 'GET') return err(res, 'Méthode non autorisée', 405);

  const ctx = await requireAuth(req, res);
  if (!ctx) return;

  try {
    const db = getDb();
    const [user] = await db.select({
      id:        users.id,
      email:     users.email,
      nom:       users.nom,
      prenom:    users.prenom,
      role:      users.role,
      telephone: users.telephone,
      actif:     users.actif,
      createdAt: users.createdAt,
      tenantId:  users.tenantId,
      avatar:    users.avatar,
    }).from(users).where(eq(users.id, ctx.sub)).limit(1);

    if (!user) return err(res, 'Utilisateur introuvable', 404);
    return ok(res, user);
  } catch (e) {
    console.error('[me]', e);
    return err(res, 'Erreur serveur', 500);
  }
}
