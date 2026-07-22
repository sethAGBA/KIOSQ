import type { VercelRequest, VercelResponse } from '@vercel/node';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../../db/client.js';
import { leads, groupesSurveilles } from '../../db/schema.js';
import { requireTenantAuth, handleOptions } from '../_lib/auth.js';
import { ok, err, parseBody } from '../_lib/response.js';

const PatchLeadSchema = z.object({
  statut: z.enum(['nouveau', 'envoye', 'ignore']),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const body = await parseBody(req);
  if (handleOptions(req, res)) return;
  const ctx = await requireTenantAuth(req, res);
  if (!ctx) return;

  const { id } = req.query as { id: string };
  const db = getDb();

  // ── GET /api/leads/:id ────────────────────────────────
  if (req.method === 'GET') {
    try {
      const result = await db
        .select({
          id:                leads.id,
          groupeSurveilleId: leads.groupeSurveilleId,
          clientId:          leads.clientId,
          texteOriginal:     leads.texteOriginal,
          produitDetecte:    leads.produitDetecte,
          scoreConfiance:    leads.scoreConfiance,
          lienPost:          leads.lienPost,
          statut:            leads.statut,
          createdAt:         leads.createdAt,
          updatedAt:         leads.updatedAt,
          groupeNom:         groupesSurveilles.nomGroupe,
        })
        .from(leads)
        .leftJoin(groupesSurveilles, eq(leads.groupeSurveilleId, groupesSurveilles.id))
        .where(and(eq(leads.id, id), eq(leads.tenantId, ctx.tenantId!)))
        .limit(1);

      if (!result[0]) return err(res, 'Lead introuvable', 404);

      const row = result[0];
      return ok(res, {
        ...row,
        scoreConfiance: row.scoreConfiance !== null ? Number(row.scoreConfiance) : null,
      });
    } catch (e) {
      console.error('[leads/:id GET]', e);
      return err(res, 'Erreur serveur', 500);
    }
  }

  // ── PATCH /api/leads/:id ──────────────────────────────
  if (req.method === 'PATCH') {
    const parsed = PatchLeadSchema.safeParse(body);
    if (!parsed.success) return err(res, 'Données invalides', 422);

    try {
      const [row] = await db
        .update(leads)
        .set({ statut: parsed.data.statut, updatedAt: new Date() })
        .where(and(eq(leads.id, id), eq(leads.tenantId, ctx.tenantId!)))
        .returning();

      if (!row) return err(res, 'Lead introuvable', 404);

      return ok(res, {
        ...row,
        scoreConfiance: row.scoreConfiance !== null ? Number(row.scoreConfiance) : null,
      });
    } catch (e) {
      console.error('[leads/:id PATCH]', e);
      return err(res, 'Erreur serveur', 500);
    }
  }

  return err(res, 'Méthode non autorisée', 405);
}
