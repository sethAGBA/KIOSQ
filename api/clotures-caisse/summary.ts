import type { VercelRequest, VercelResponse } from '@vercel/node';
import { eq, and, gte, lte } from 'drizzle-orm';
import { getDb } from '../../db/client.js';
import { commandes, sortiesCaisse } from '../../db/schema.js';
import { requireTenantAuth, handleOptions } from '../_lib/auth.js';
import { ok, err } from '../_lib/response.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) return;
  const ctx = await requireTenantAuth(req, res);
  if (!ctx) return;

  if (req.method !== 'GET') return err(res, 'Méthode non autorisée', 405);

  const db = getDb();
  const tenantId = ctx.tenantId || 'tenant_demo';
  const { vendeurId } = req.query as { vendeurId?: string };

  try {
    const startToday = new Date();
    startToday.setHours(0, 0, 0, 0);

    const endToday = new Date();
    endToday.setHours(23, 59, 59, 999);

    // Fetch today's sales
    const commandeConditions: any[] = [
      gte(commandes.date, startToday),
      lte(commandes.date, endToday),
    ];
    if (ctx.role !== 'superadmin') {
      commandeConditions.push(eq(commandes.tenantId, tenantId));
    }
    if (vendeurId && vendeurId !== 'all' && vendeurId !== 'undefined') {
      commandeConditions.push(eq(commandes.clientNom, vendeurId)); // or user match
    }

    const todayCommandes = await db
      .select()
      .from(commandes)
      .where(and(...commandeConditions));

    // Fetch today's cash withdrawals (sorties_caisse)
    const sortieConditions: any[] = [
      gte(sortiesCaisse.date, startToday),
      lte(sortiesCaisse.date, endToday),
    ];
    if (ctx.role !== 'superadmin') {
      sortieConditions.push(eq(sortiesCaisse.tenantId, tenantId));
    }

    const todaySorties = await db
      .select()
      .from(sortiesCaisse)
      .where(and(...sortieConditions));

    const totalSorties = todaySorties.reduce((sum, s) => sum + Number(s.montant), 0);

    // Repartition by modePaiement
    const repartition = {
      especes: 0,
      mobile_money: 0,
      carte: 0,
      credit: 0,
      autre: 0,
    };

    let totalVentes = 0;
    todayCommandes.forEach(c => {
      const montant = Number(c.totalTTC);
      totalVentes += montant;
      const mode = (c.modePaiement || 'especes').toLowerCase();

      if (mode === 'especes' || mode === 'espèces' || mode === 'cash') {
        repartition.especes += montant;
      } else if (mode.includes('mobile') || mode.includes('wave') || mode.includes('orange') || mode.includes('momo')) {
        repartition.mobile_money += montant;
      } else if (mode.includes('carte') || mode.includes('card')) {
        repartition.carte += montant;
      } else if (mode.includes('credit') || mode.includes('crédit') || mode.includes('dette')) {
        repartition.credit += montant;
      } else {
        repartition.autre += montant;
      }
    });

    const montantTheorique = Math.max(0, repartition.especes - totalSorties);

    return ok(res, {
      totalVentes,
      nbVentes: todayCommandes.length,
      repartition,
      totalSorties,
      montantTheorique,
    });
  } catch (e) {
    console.error('[clotures-caisse/summary GET]', e);
    return err(res, 'Erreur serveur', 500);
  }
}
