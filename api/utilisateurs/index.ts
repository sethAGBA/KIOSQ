import type { VercelRequest, VercelResponse } from '@vercel/node';
import { desc, eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import bcrypt from 'bcryptjs';
import { getDb } from '../../db/client.js';
import { users } from '../../db/schema.js';
import { requireTenantAuth, handleOptions } from '../_lib/auth.js';
import { ok, err, parseBody} from '../_lib/response.js';
import { checkPlanLimit } from '../_lib/planLimits.js';
import { logAction } from '../_lib/auditLog.js';

const CreateSchema = z.object({
  email:     z.string().email(),
  password:  z.string().min(6),
  nom:       z.string().min(1),
  prenom:    z.string().min(1),
  role:      z.enum(['admin', 'commercial', 'gestionnaire', 'comptable', 'lecteur']),
  telephone: z.string().optional(),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const body = await parseBody(req);
  if (handleOptions(req, res)) return;
  const ctx = await requireTenantAuth(req, res);
  if (!ctx) return;

  const db = getDb();

  // ── GET /api/utilisateurs ─────────────────────────────
  if (req.method === 'GET') {
    if (!['admin', 'gestionnaire'].includes(ctx.role))
      return err(res, 'Accès refusé', 403);
    try {
      const rows = await db.select({
        id:        users.id,
        email:     users.email,
        nom:       users.nom,
        prenom:    users.prenom,
        role:      users.role,
        telephone: users.telephone,
        actif:     users.actif,
        createdAt: users.createdAt,
      }).from(users)
        .where(eq(users.tenantId, ctx.tenantId!))
        .orderBy(desc(users.createdAt));
      return ok(res, rows);
    } catch (e) {
      console.error('[utilisateurs GET]', e);
      return err(res, 'Erreur serveur', 500);
    }
  }

  // ── POST /api/utilisateurs ────────────────────────────
  if (req.method === 'POST') {
    if (ctx.role !== 'admin') return err(res, 'Accès refusé', 403);
    const parsed = CreateSchema.safeParse(body);
    if (!parsed.success) return err(res, 'Données invalides', 422);
    // Check plan limit before creating
    if (!await checkPlanLimit(db, ctx.tenantId!, 'users', res)) return;
    try {
      const passwordHash = await bcrypt.hash(parsed.data.password, 10);
      const [row] = await db.insert(users).values({
        id:           nanoid(),
        email:        parsed.data.email,
        passwordHash,
        nom:          parsed.data.nom,
        prenom:       parsed.data.prenom,
        role:         parsed.data.role,
        telephone:    parsed.data.telephone,
        actif:        true,
        tenantId:     ctx.tenantId!,
      }).returning({
        id:        users.id,
        email:     users.email,
        nom:       users.nom,
        prenom:    users.prenom,
        role:      users.role,
        telephone: users.telephone,
        actif:     users.actif,
        createdAt: users.createdAt,
      });
      await logAction(db, ctx.tenantId!, ctx.sub, 'user.created', 'user', row.id);
      return ok(res, row, 201);
    } catch (e: any) {
      if (e?.code === '23505') return err(res, 'Email déjà utilisé', 409);
      console.error('[utilisateurs POST]', e);
      return err(res, 'Erreur serveur', 500);
    }
  }

  return err(res, 'Méthode non autorisée', 405);
}
