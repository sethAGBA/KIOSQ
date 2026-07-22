import type { VercelRequest, VercelResponse } from '@vercel/node';
import { eq, and, count } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../../db/client.js';
import { groupesSurveilles, leads } from '../../db/schema.js';
import { encrypt } from '../../db/crypto.js';
import { requireTenantAuth, handleOptions } from '../_lib/auth.js';
import { ok, err, parseBody } from '../_lib/response.js';

const PatchGroupeSchema = z.object({
  nomGroupe:              z.string().min(1).optional(),
  urlGroupe:              z.string().url().optional(),
  cookieSessionPlaintext: z.string().optional(),
  statut:                 z.enum(['actif', 'inactif', 'erreur']).optional(),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const body = await parseBody(req);
  if (handleOptions(req, res)) return;
  const ctx = await requireTenantAuth(req, res);
  if (!ctx) return;

  const { id } = req.query as { id: string };
  const db = getDb();

  // ── PATCH /api/groupes-surveilles/:id ─────────────────
  if (req.method === 'PATCH') {
    const isAdmin = ctx.role === 'admin';
    const isBot   = ctx.role === 'commercial';

    // commercial (bot) can only update statut
    if (!isAdmin && !isBot) return err(res, 'Accès refusé', 403);

    const parsed = PatchGroupeSchema.safeParse(body);
    if (!parsed.success) return err(res, 'Données invalides', 422);

    const { cookieSessionPlaintext, ...rest } = parsed.data;

    // Bot (commercial) can only touch statut — block any other field
    if (isBot && !isAdmin) {
      const keys = Object.keys(rest);
      const allowedForBot = ['statut'];
      const forbidden = keys.filter(k => !allowedForBot.includes(k));
      if (forbidden.length > 0 || cookieSessionPlaintext !== undefined) {
        return err(res, 'Accès refusé', 403);
      }
    }

    const updateData: Record<string, unknown> = { ...rest, updatedAt: new Date() };

    if (cookieSessionPlaintext !== undefined) {
      if (!isAdmin) return err(res, 'Accès refusé', 403);
      const encryptionKey = process.env.COOKIE_ENCRYPTION_KEY;
      if (!encryptionKey) return err(res, 'Configuration manquante : COOKIE_ENCRYPTION_KEY', 500);
      updateData.cookieSessionChiffre = encrypt(cookieSessionPlaintext, encryptionKey);
    }

    try {
      const [row] = await db.update(groupesSurveilles)
        .set(updateData)
        .where(and(eq(groupesSurveilles.id, id), eq(groupesSurveilles.tenantId, ctx.tenantId!)))
        .returning();
      if (!row) return err(res, 'Groupe introuvable', 404);

      const { cookieSessionChiffre: _omit, ...safeRow } = row;
      return ok(res, safeRow);
    } catch (e) {
      console.error('[groupes-surveilles/:id PATCH]', e);
      return err(res, 'Erreur serveur', 500);
    }
  }

  // ── DELETE /api/groupes-surveilles/:id ────────────────
  if (req.method === 'DELETE') {
    if (ctx.role !== 'admin') return err(res, 'Accès refusé', 403);

    try {
      // Check if the group exists (scoped to tenant)
      const [existing] = await db.select({ id: groupesSurveilles.id })
        .from(groupesSurveilles)
        .where(and(eq(groupesSurveilles.id, id), eq(groupesSurveilles.tenantId, ctx.tenantId!)))
        .limit(1);
      if (!existing) return err(res, 'Groupe introuvable', 404);

      // Check if any leads reference this group (scoped to tenant)
      const [{ count: leadsCount }] = await db
        .select({ count: count() })
        .from(leads)
        .where(and(eq(leads.groupeSurveilleId, id), eq(leads.tenantId, ctx.tenantId!)));

      if (Number(leadsCount) > 0) {
        return err(res, 'Ce groupe possède des leads et ne peut pas être supprimé', 409);
      }

      await db.delete(groupesSurveilles).where(
        and(eq(groupesSurveilles.id, id), eq(groupesSurveilles.tenantId, ctx.tenantId!))
      );
      return ok(res, { message: 'Groupe supprimé' });
    } catch (e) {
      console.error('[groupes-surveilles/:id DELETE]', e);
      return err(res, 'Erreur serveur', 500);
    }
  }

  return err(res, 'Méthode non autorisée', 405);
}
