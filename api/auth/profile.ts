import type { VercelRequest, VercelResponse } from '@vercel/node';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../../db/client.js';
import { users } from '../../db/schema.js';
import { requireAuth, handleOptions } from '../_lib/auth.js';
import { ok, err, parseBody } from '../_lib/response.js';
import { logAction } from '../_lib/auditLog.js';

export const config = { api: { bodyParser: true } };

const ProfileSchema = z.object({
  nom:       z.string().min(1),
  prenom:    z.string().min(1),
  email:     z.string().email(),
  telephone: z.string().optional().nullable(),
  avatar:    z.string().optional().nullable(),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) return;
  if (req.method !== 'PATCH') return err(res, 'Méthode non autorisée', 405);

  const ctx = await requireAuth(req, res);
  if (!ctx) return;

  // Seul le superadmin ou n'importe quel admin peut modifier son profil
  if (ctx.role !== 'superadmin' && ctx.role !== 'admin') {
    return err(res, 'Accès refusé', 403);
  }

  const body = await parseBody(req);
  const parsed = ProfileSchema.safeParse(body);
  if (!parsed.success) {
    console.error('[profile] Zod errors:', JSON.stringify(parsed.error.issues));
    return err(res, 'Données invalides', 422);
  }

  const { nom, prenom, email, telephone, avatar } = parsed.data;

  try {
    const db = getDb();

    // Verify email is not already taken by another user
    const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existing && existing.id !== ctx.sub) {
      return err(res, 'Cet email est déjà utilisé par un autre compte', 400);
    }

    const [updatedUser] = await db.update(users)
      .set({
        nom,
        prenom,
        email,
        telephone: telephone ?? null,
        avatar:    avatar ?? null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, ctx.sub))
      .returning({
        id:        users.id,
        email:     users.email,
        nom:       users.nom,
        prenom:    users.prenom,
        role:      users.role,
        telephone: users.telephone,
        avatar:    users.avatar,
        actif:     users.actif,
        tenantId:  users.tenantId,
      });

    if (!updatedUser) return err(res, 'Utilisateur introuvable', 404);

    if (updatedUser.tenantId) {
      const ip = req.headers['x-forwarded-for'] as string | undefined;
      await logAction(
        db,
        updatedUser.tenantId,
        updatedUser.id,
        'user.profile_updated',
        'user',
        updatedUser.id,
        undefined,
        ip
      );
    }

    return ok(res, updatedUser);
  } catch (e) {
    console.error('[profile PATCH]', e);
    return err(res, 'Erreur serveur', 500);
  }
}
