import type { VercelRequest, VercelResponse } from '@vercel/node';
import { eq, sql, and, gte } from 'drizzle-orm';
import { getDb } from '../../db/client.js';
import { tenants } from '../../db/schema.js';
import { requireSuperadmin, handleOptions } from '../_lib/auth.js';
import { ok, err } from '../_lib/response.js';

// ── MRR tarifs (FCFA/mois) ────────────────────────────────
// Configurable: modifier ces constantes pour changer les tarifs.
const MRR_STARTER    = 0;       // plan starter gratuit
const MRR_PRO        = 29000;   // 29 000 FCFA/mois
const MRR_ENTERPRISE = 99000;   // 99 000 FCFA/mois

// ── Types ─────────────────────────────────────────────────

export interface SuperadminStats {
  total: number;
  parStatut: {
    actif: number;
    essai: number;
    suspendu: number;
  };
  mrr: number;
  tauxConversion90j: number;
  courbe12mois: Array<{ mois: string; nouvelles: number }>;
}

// ── Pure helper: build 12-month curve from DB rows ────────

/**
 * Given raw rows from a GROUP BY date_trunc('month', created_at) query,
 * returns a normalized array of 12 entries (oldest → newest),
 * filling in zeros for months with no new tenants.
 */
export function buildCourbe12Mois(
  rows: { mois: Date | string; nouvelles: string | number }[],
  now: Date = new Date(),
): Array<{ mois: string; nouvelles: number }> {
  // Build lookup: "YYYY-MM" → count
  const map = new Map<string, number>();
  for (const row of rows) {
    const d = row.mois ? new Date(row.mois) : null;
    if (!d || isNaN(d.getTime())) continue;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    map.set(key, Number(row.nouvelles) || 0);
  }

  const result: Array<{ mois: string; nouvelles: number }> = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    result.push({ mois: key, nouvelles: map.get(key) ?? 0 });
  }

  return result;
}

// ── Handler ───────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) return;

  const ctx = await requireSuperadmin(req, res);
  if (!ctx) return;

  if (req.method !== 'GET') return err(res, 'Méthode non autorisée', 405);

  const db = getDb();

  try {
    const now = new Date();
    const start12Months = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    const start90Days = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    const [
      totauxParStatut,
      mrrRows,
      conversionRows,
      courbeRows,
    ] = await Promise.all([
      // 1. Total + par statut: GROUP BY statut
      db
        .select({
          statut: tenants.statut,
          count: sql<string>`COUNT(*)`,
        })
        .from(tenants)
        .groupBy(tenants.statut),

      // 2. MRR: GROUP BY plan, COUNT(*) pour les tenants actifs uniquement
      db
        .select({
          plan: tenants.plan,
          count: sql<string>`COUNT(*)`,
        })
        .from(tenants)
        .where(eq(tenants.statut, 'actif'))
        .groupBy(tenants.plan),

      // 3. Taux de conversion 90j: tenants créés dans les 90 derniers jours,
      //    compter ceux en 'actif' et ceux en 'essai'
      db
        .select({
          statut: tenants.statut,
          count: sql<string>`COUNT(*)`,
        })
        .from(tenants)
        .where(
          and(
            gte(tenants.createdAt, start90Days),
            sql`${tenants.statut} IN ('actif', 'essai')`,
          ),
        )
        .groupBy(tenants.statut),

      // 4. Courbe 12 mois: nouvelles boutiques créées par mois
      db
        .select({
          mois: sql<string>`date_trunc('month', ${tenants.createdAt})`,
          nouvelles: sql<string>`COUNT(*)`,
        })
        .from(tenants)
        .where(gte(tenants.createdAt, start12Months))
        .groupBy(sql`date_trunc('month', ${tenants.createdAt})`),
    ]);

    // ── Aggregate totals par statut ───────────────────────
    let total = 0;
    const parStatut = { actif: 0, essai: 0, suspendu: 0 };

    for (const row of totauxParStatut) {
      const count = Number(row.count) || 0;
      total += count;
      if (row.statut === 'actif')    parStatut.actif    = count;
      if (row.statut === 'essai')    parStatut.essai    = count;
      if (row.statut === 'suspendu') parStatut.suspendu = count;
    }

    // ── MRR ───────────────────────────────────────────────
    let mrr = 0;
    for (const row of mrrRows) {
      const count = Number(row.count) || 0;
      if (row.plan === 'starter')    mrr += count * MRR_STARTER;
      if (row.plan === 'pro')        mrr += count * MRR_PRO;
      if (row.plan === 'enterprise') mrr += count * MRR_ENTERPRISE;
    }

    // ── Taux de conversion essai→actif sur 90j ────────────
    let actifs90 = 0;
    let essais90 = 0;
    for (const row of conversionRows) {
      if (row.statut === 'actif') actifs90 = Number(row.count) || 0;
      if (row.statut === 'essai') essais90 = Number(row.count) || 0;
    }
    const totalEssaiActif = actifs90 + essais90;
    const tauxConversion90j =
      totalEssaiActif > 0
        ? Math.round((actifs90 / totalEssaiActif) * 10000) / 10000
        : 0;

    // ── Courbe 12 mois ────────────────────────────────────
    const courbe12mois = buildCourbe12Mois(
      courbeRows.map(r => ({ mois: r.mois, nouvelles: r.nouvelles })),
      now,
    );

    const stats: SuperadminStats = {
      total,
      parStatut,
      mrr,
      tauxConversion90j,
      courbe12mois,
    };

    return ok(res, stats);
  } catch (e) {
    console.error('[superadmin/stats GET]', e);
    return err(res, 'Erreur serveur', 500);
  }
}
