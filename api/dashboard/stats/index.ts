import type { VercelRequest, VercelResponse } from '@vercel/node';
import { eq, inArray, lte, gte, and, sql } from 'drizzle-orm';
import { getDb } from '../../../db/client.js';
import { factures, commandes, produits } from '../../../db/schema.js';
import { requireAuth, handleOptions } from '../../_lib/auth.js';
import { ok, err } from '../../_lib/response.js';

// ── Types ─────────────────────────────────────────────────

export interface MonthEntry {
  label: string;
  valeur: number;
  commandes: number;
}

export interface DashboardStats {
  caMonth: number;
  commandesActives: number;
  alertesStock: number;
  facturesEnRetard: number;
  caParMois: MonthEntry[];
}

// ── Pure helper: group factures into 12 rolling months ───

const MOIS_FR = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'] as const;

/**
 * Given a flat list of paid factures (only { totalTTC, dateFacture } needed),
 * returns an array of 12 entries for the 12 rolling months ending at `now`,
 * oldest first.
 *
 * This function is exported so it can be tested in isolation (PBT Property 5).
 */
export function buildCaParMois(
  rows: { totalTTC: string | number; dateFacture: Date | string | null }[],
  now: Date = new Date(),
): MonthEntry[] {
  // Fallback to current date if now is invalid
  if (!now || isNaN(now.getTime())) {
    now = new Date();
  }

  // Build a map keyed by "YYYY-MM" → { valeur, commandes }
  const map = new Map<string, { valeur: number; commandes: number }>();

  for (const row of rows) {
    const d = row.dateFacture ? new Date(row.dateFacture) : null;
    if (!d || isNaN(d.getTime())) continue;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const existing = map.get(key) ?? { valeur: 0, commandes: 0 };
    existing.valeur += Number(row.totalTTC) || 0;
    existing.commandes += 1;
    map.set(key, existing);
  }

  const result: MonthEntry[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const entry = map.get(key) ?? { valeur: 0, commandes: 0 };
    result.push({
      label: MOIS_FR[d.getMonth()],
      valeur: entry.valeur,
      commandes: entry.commandes,
    });
  }

  return result;
}

// ── Handler ───────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) return;
  const ctx = await requireAuth(req, res);
  if (!ctx) return;

  if (req.method !== 'GET') return err(res, 'Méthode non autorisée', 405);

  const db = getDb();

  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    // Start of the 12-month rolling window (first day of month, 12 months ago)
    const start12Months = new Date(now.getFullYear(), now.getMonth() - 11, 1);

    // Run all four aggregate queries in parallel
    const [
      caMonthRows,
      commandesActivesRows,
      alertesStockRows,
      facturesEnRetardRows,
      facturesPaidRows,
    ] = await Promise.all([
      // caMonth: SUM(total_ttc) for paid factures in current month
      db
        .select({ total: sql<string>`COALESCE(SUM(${factures.totalTTC}), 0)` })
        .from(factures)
        .where(
          and(
            eq(factures.statut, 'payee'),
            gte(factures.dateFacture, startOfMonth),
            lte(factures.dateFacture, endOfMonth),
          ),
        ),

      // commandesActives: COUNT(*) with active statuts
      db
        .select({ count: sql<string>`COUNT(*)` })
        .from(commandes)
        .where(
          inArray(commandes.statut, ['brouillon', 'envoye', 'confirme', 'en_preparation', 'expedie']),
        ),

      // alertesStock: COUNT(*) of active products with stockActuel <= stockMinimum
      db
        .select({ count: sql<string>`COUNT(*)` })
        .from(produits)
        .where(
          and(
            eq(produits.actif, true),
            lte(produits.stockActuel, produits.stockMinimum),
          ),
        ),

      // facturesEnRetard: SUM(reste_a_payer) for en_retard factures
      db
        .select({ total: sql<string>`COALESCE(SUM(${factures.resteAPayer}), 0)` })
        .from(factures)
        .where(eq(factures.statut, 'en_retard')),

      // caParMois: all paid factures in the last 12 months (raw rows, grouped in JS)
      db
        .select({ totalTTC: factures.totalTTC, dateFacture: factures.dateFacture })
        .from(factures)
        .where(
          and(
            eq(factures.statut, 'payee'),
            gte(factures.dateFacture, start12Months),
          ),
        ),
    ]);

    const stats: DashboardStats = {
      caMonth:           Number(caMonthRows[0]?.total ?? 0),
      commandesActives:  Number(commandesActivesRows[0]?.count ?? 0),
      alertesStock:      Number(alertesStockRows[0]?.count ?? 0),
      facturesEnRetard:  Number(facturesEnRetardRows[0]?.total ?? 0),
      caParMois:         buildCaParMois(facturesPaidRows, now),
    };

    return ok(res, stats);
  } catch (e) {
    console.error('[dashboard/stats GET]', e);
    return err(res, 'Erreur serveur', 500);
  }
}
