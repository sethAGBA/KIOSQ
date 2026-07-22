import type { VercelRequest, VercelResponse } from '@vercel/node';
import { eq, ilike, gte, desc, and, count } from 'drizzle-orm';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { getDb } from '../../db/client.js';
import { leads, tenants } from '../../db/schema.js';
import { requireTenantAuth, handleOptions } from '../_lib/auth.js';
import { ok, err, parseBody } from '../_lib/response.js';
import { PLAN_LIMITS, type PlanName } from '../_lib/planLimits.js';

const QuerySchema = z.object({
  page:      z.coerce.number().int().min(1).default(1),
  limit:     z.coerce.number().int().min(1).max(100).default(20),
  statut:    z.enum(['nouveau', 'envoye', 'ignore']).optional(),
  produit:   z.string().optional(),
  score_min: z.coerce.number().min(0).max(1).optional(),
});

const LeadSchema = z.object({
  groupeSurveilleId: z.string().min(1),
  texteOriginal:     z.string().min(1),
  produitDetecte:    z.string().optional(),
  scoreConfiance:    z.number().min(0).max(1).optional(),
  lienPost:          z.string().url().optional().or(z.literal('')),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const body = await parseBody(req);
  if (handleOptions(req, res)) return;
  const ctx = await requireTenantAuth(req, res);
  if (!ctx) return;

  const db = getDb();

  // ── GET /api/leads ─────────────────────────────────────
  if (req.method === 'GET') {
    const parsed = QuerySchema.safeParse(req.query);
    if (!parsed.success) return err(res, 'Paramètres invalides', 422);

    const { page, limit, statut, produit, score_min } = parsed.data;
    const offset = (page - 1) * limit;

    try {
      // Build composable where conditions (always scoped to tenant)
      const conditions = [eq(leads.tenantId, ctx.tenantId!)];
      if (statut)    conditions.push(eq(leads.statut, statut));
      if (produit)   conditions.push(ilike(leads.produitDetecte, `%${produit}%`));
      if (score_min !== undefined) conditions.push(gte(leads.scoreConfiance, String(score_min)));

      const where = and(...conditions);

      // Count total matching rows
      const [{ value: total }] = await db
        .select({ value: count() })
        .from(leads)
        .where(where);

      // Fetch paginated rows
      const rows = await db
        .select()
        .from(leads)
        .where(where)
        .orderBy(desc(leads.createdAt))
        .limit(limit)
        .offset(offset);

      const leadsOut = rows.map(row => ({
        ...row,
        scoreConfiance: row.scoreConfiance !== null ? Number(row.scoreConfiance) : null,
      }));

      return ok(res, { leads: leadsOut, total: Number(total), page, limit });
    } catch (e) {
      console.error('[leads GET]', e);
      return err(res, 'Erreur serveur', 500);
    }
  }

  // ── POST /api/leads ────────────────────────────────────
  if (req.method === 'POST') {
    // Check plan: leads feature must be enabled for this tenant's plan
    const [tenant] = await db
      .select({ plan: tenants.plan })
      .from(tenants)
      .where(eq(tenants.id, ctx.tenantId!))
      .limit(1);

    if (!tenant) return err(res, 'Boutique introuvable', 404);

    if (PLAN_LIMITS[tenant.plan as PlanName].leads === false) {
      return res.status(403).json({
        error: 'Fonctionnalité leads non disponible sur votre plan. Passez au plan pro.',
      });
    }

    const parsed = LeadSchema.safeParse(body);
    if (!parsed.success) return err(res, 'Données invalides', 422);

    try {
      const { groupeSurveilleId, texteOriginal, produitDetecte, scoreConfiance, lienPost } = parsed.data;
      const [row] = await db.insert(leads).values({
        id:                nanoid(),
        groupeSurveilleId,
        texteOriginal,
        produitDetecte:    produitDetecte ?? null,
        scoreConfiance:    scoreConfiance !== undefined ? String(scoreConfiance) : null,
        lienPost:          lienPost || null,
        statut:            'nouveau',
        tenantId:          ctx.tenantId!,
      }).returning();

      return ok(res, {
        ...row,
        scoreConfiance: row.scoreConfiance !== null ? Number(row.scoreConfiance) : null,
      }, 201);
    } catch (e) {
      console.error('[leads POST]', e);
      return err(res, 'Erreur serveur', 500);
    }
  }

  return err(res, 'Méthode non autorisée', 405);
}
