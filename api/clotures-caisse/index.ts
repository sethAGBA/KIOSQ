import type { VercelRequest, VercelResponse } from '@vercel/node';
import { eq, and, desc, gte, lte } from 'drizzle-orm';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { getDb } from '../../db/client.js';
import { cloturesCaisse, commandes, sortiesCaisse, users } from '../../db/schema.js';
import { requireTenantAuth, handleOptions } from '../_lib/auth.js';
import { ok, err, numericRows, numericRow, parseBody } from '../_lib/response.js';
import { logAction } from '../_lib/auditLog.js';

const ClotureSchema = z.object({
  vendeurId: z.string().optional(),
  montantReel: z.number().min(0),
  notes: z.string().optional(),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const body = await parseBody(req);
  if (handleOptions(req, res)) return;
  const ctx = await requireTenantAuth(req, res);
  if (!ctx) return;

  const db = getDb();
  const tenantId = ctx.tenantId || 'tenant_demo';

  // ── GET /api/clotures-caisse ─────────────────────────────
  if (req.method === 'GET') {
    try {
      const { start, end, utilisateurId } = req.query as { start?: string; end?: string; utilisateurId?: string };
      const conditions: any[] = [];

      if (ctx.role !== 'superadmin') {
        conditions.push(eq(cloturesCaisse.tenantId, tenantId));
      }

      if (utilisateurId && utilisateurId !== 'all' && utilisateurId !== 'undefined') {
        conditions.push(eq(cloturesCaisse.utilisateurId, utilisateurId));
      }

      if (start && typeof start === 'string' && start.trim().length > 0 && start !== 'undefined') {
        const startDate = new Date(start);
        if (!isNaN(startDate.getTime())) {
          conditions.push(gte(cloturesCaisse.date, startDate));
        }
      }
      if (end && typeof end === 'string' && end.trim().length > 0 && end !== 'undefined') {
        const endDate = new Date(end);
        if (!isNaN(endDate.getTime())) {
          endDate.setHours(23, 59, 59, 999);
          conditions.push(lte(cloturesCaisse.date, endDate));
        }
      }

      const rows = conditions.length > 0
        ? await db
            .select()
            .from(cloturesCaisse)
            .where(and(...conditions))
            .orderBy(desc(cloturesCaisse.date))
            .limit(100)
        : await db
            .select()
            .from(cloturesCaisse)
            .orderBy(desc(cloturesCaisse.date))
            .limit(100);

      return ok(res, numericRows(rows as Record<string, unknown>[]));
    } catch (e) {
      console.error('[clotures-caisse GET]', e);
      return err(res, 'Erreur serveur', 500);
    }
  }

  // ── POST /api/clotures-caisse ────────────────────────────
  if (req.method === 'POST') {
    const parsed = ClotureSchema.safeParse(body);
    if (!parsed.success) return err(res, 'Données invalides', 422);

    try {
      const startToday = new Date();
      startToday.setHours(0, 0, 0, 0);

      const endToday = new Date();
      endToday.setHours(23, 59, 59, 999);

      // Fetch today's sales
      const commandeConditions: any[] = [
        gte(commandes.dateCommande, startToday),
        lte(commandes.dateCommande, endToday),
      ];
      if (ctx.role !== 'superadmin') {
        commandeConditions.push(eq(commandes.tenantId, tenantId));
      }

      const todayCommandes = await db
        .select()
        .from(commandes)
        .where(and(...commandeConditions));

      // Fetch today's cash withdrawals
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
        const mode = ((c as any).modePaiement || 'especes').toLowerCase();

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
      const ecart = parsed.data.montantReel - montantTheorique;

      const userName = `${ctx.prenom || ''} ${ctx.nom || ''}`.trim() || ctx.email;

      let vendeurNom = userName;
      if (parsed.data.vendeurId && parsed.data.vendeurId !== ctx.sub) {
        const [vendeurObj] = await db
          .select()
          .from(users)
          .where(eq(users.id, parsed.data.vendeurId))
          .limit(1);
        if (vendeurObj) {
          vendeurNom = `${vendeurObj.prenom || ''} ${vendeurObj.nom || ''}`.trim() || vendeurObj.email;
        }
      }

      const [row] = await db
        .insert(cloturesCaisse)
        .values({
          id: nanoid(),
          tenantId,
          date: new Date(),
          totalVentes: String(totalVentes),
          nbVentes: todayCommandes.length,
          repartition,
          montantTheorique: String(montantTheorique),
          montantReel: String(parsed.data.montantReel),
          ecart: String(ecart),
          notes: parsed.data.notes || '',
          utilisateurId: ctx.sub,
          utilisateurNom: userName,
          vendeurId: parsed.data.vendeurId || ctx.sub,
          vendeurNom,
        })
        .returning();

      await logAction(db, tenantId, ctx.sub, 'cloture_caisse.created', 'cloture_caisse', row.id, {
        totalVentes,
        montantTheorique,
        montantReel: parsed.data.montantReel,
        ecart,
      });

      return ok(res, numericRow(row), 201);
    } catch (e) {
      console.error('[clotures-caisse POST]', e);
      return err(res, 'Erreur serveur', 500);
    }
  }

  return err(res, 'Méthode non autorisée', 405);
}
