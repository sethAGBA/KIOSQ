import type { VercelRequest, VercelResponse } from '@vercel/node';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../../db/client';
import { users } from '../../db/schema';
import { signToken, setAuthCookie, handleOptions } from '../_lib/auth';
import { ok, err } from '../_lib/response';

const LoginSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) return;
  if (req.method !== 'POST') return err(res, 'Méthode non autorisée', 405);

  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) {
    console.error('[login] Zod errors:', JSON.stringify(parsed.error.errors));
    return err(res, 'Données invalides', 422);
  }

  const { email, password } = parsed.data;

  try {
    const db = getDb();
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

    if (!user || !user.actif) return err(res, 'Identifiants incorrects', 401);

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return err(res, 'Identifiants incorrects', 401);

    const token = await signToken({
      sub:    user.id,
      email:  user.email,
      role:   user.role,
      nom:    user.nom,
      prenom: user.prenom,
    });

    setAuthCookie(res, token);

    return ok(res, {
      id:     user.id,
      email:  user.email,
      role:   user.role,
      nom:    user.nom,
      prenom: user.prenom,
      actif:  user.actif,
    });
  } catch (e) {
    console.error('[login]', e);
    return err(res, 'Erreur serveur', 500);
  }
}
