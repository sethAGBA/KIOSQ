import type { VercelRequest, VercelResponse } from '@vercel/node';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../../db/client.js';
import { users } from '../../db/schema.js';
import { requireAuth, handleOptions } from '../_lib/auth.js';
import { ok, err, parseBody } from '../_lib/response.js';
import { logAction } from '../_lib/auditLog.js';

export const config = { api: { bodyParser: true } };

const PasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) return;
  if (req.method !== 'POST') return err(res, 'Méthode non autorisée', 405);

  const ctx = await requireAuth(req, res);
  if (!ctx) return;

  // Seul le superadmin ou n'importe quel admin peut modifier son mot de passe
  if (ctx.role !== 'superadmin' && ctx.role !== 'admin') {
    return err(res, 'Accès refusé', 403);
  }

  const body = await parseBody(req);
  const parsed = PasswordSchema.safeParse(body);
  if (!parsed.success) {
    console.error('[password] Zod errors:', JSON.stringify(parsed.error.issues));
    return err(res, 'Données invalides', 422);
  }

  const { currentPassword, newPassword } = parsed.data;

  try {
    const db = getDb();
    const [user] = await db.select().from(users).where(eq(users.id, ctx.sub)).limit(1);

    if (!user) return err(res, 'Utilisateur introuvable', 404);

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) return err(res, 'Mot de passe actuel incorrect', 401);

    const newHash = await bcrypt.hash(newPassword, 10);
    await db.update(users).set({ passwordHash: newHash }).where(eq(users.id, ctx.sub));

    if (user.tenantId) {
      const ip = req.headers['x-forwarded-for'] as string | undefined;
      await logAction(
        db,
        user.tenantId,
        user.id,
        'user.password_updated',
        'user',
        user.id,
        undefined,
        ip
      );
    }

    return ok(res, { message: 'Mot de passe mis à jour avec succès' });
  } catch (e) {
    console.error('[password]', e);
    return err(res, 'Erreur serveur', 500);
  }
}
