import type { VercelRequest, VercelResponse } from '@vercel/node';
import { eq, and, count } from 'drizzle-orm';
import { getDb } from '../../db/client.js';
import { tenants, users, produits, magasins } from '../../db/schema.js';
import { requireTenantAuth, handleOptions } from '../_lib/auth.js';
import { getPlanLimitForResource, type PlanName } from '../_lib/planLimits.js';
import { ok, err } from '../_lib/response.js';

/**
 * GET /api/abonnement
 *
 * Returns the tenant's subscription info: plan, status, trial end date,
 * real-time usage counts, and plan limits for users/produits/magasins.
 *
 * Cache-Control: max-age=60 — data is fresh but may be up to 60s stale.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) return;

  if (req.method !== 'GET') {
    return err(res, 'Méthode non autorisée', 405);
  }

  const ctx = await requireTenantAuth(req, res);
  if (!ctx) return;

  const db = getDb();

  try {
    // Load tenant to get plan, statut, dateEssaiFin
    const [tenant] = await db
      .select({
        plan:         tenants.plan,
        statut:       tenants.statut,
        dateEssaiFin: tenants.dateEssaiFin,
      })
      .from(tenants)
      .where(eq(tenants.id, ctx.tenantId!))
      .limit(1);

    if (!tenant) {
      return err(res, 'Boutique introuvable', 404);
    }

    const plan = tenant.plan as PlanName;

    // Count active resources in parallel
    const [usersRow, produitsRow, magasinsRow] = await Promise.all([
      db.select({ value: count() })
        .from(users)
        .where(and(eq(users.tenantId, ctx.tenantId!), eq(users.actif, true)))
        .then(([row]) => Number(row?.value ?? 0)),

      db.select({ value: count() })
        .from(produits)
        .where(and(eq(produits.tenantId, ctx.tenantId!), eq(produits.actif, true)))
        .then(([row]) => Number(row?.value ?? 0)),

      db.select({ value: count() })
        .from(magasins)
        .where(and(eq(magasins.tenantId, ctx.tenantId!), eq(magasins.actif, true)))
        .then(([row]) => Number(row?.value ?? 0)),
    ]);

    // Convert Infinity to null for JSON serialization
    const limitOrNull = (n: number): number | null =>
      n === Infinity ? null : n;

    res.setHeader('Cache-Control', 'max-age=60');

    return ok(res, {
      plan:         tenant.plan,
      statut:       tenant.statut,
      dateEssaiFin: tenant.dateEssaiFin,
      usage: {
        users:    usersRow,
        produits: produitsRow,
        magasins: magasinsRow,
      },
      limites: {
        users:    limitOrNull(getPlanLimitForResource(plan, 'users')),
        produits: limitOrNull(getPlanLimitForResource(plan, 'produits')),
        magasins: limitOrNull(getPlanLimitForResource(plan, 'magasins')),
      },
    });
  } catch (e) {
    console.error('[abonnement GET]', e);
    return err(res, 'Erreur serveur', 500);
  }
}
