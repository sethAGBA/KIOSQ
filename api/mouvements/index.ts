import type { VercelRequest, VercelResponse } from '@vercel/node';
import { eq, and, desc, gte, lte } from 'drizzle-orm';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { getDb } from '../../db/client.js';
import { mouvementsStock, produits } from '../../db/schema.js';
import { requireTenantAuth, handleOptions } from '../_lib/auth.js';
import { ok, err, numericRows, numericRow, parseBody } from '../_lib/response.js';
import { logAction } from '../_lib/auditLog.js';

const MouvementSchema = z.object({
  produitId: z.string().min(1),
  type: z.enum(['entree', 'sortie', 'usage_interne', 'ajustement']),
  quantite: z.number().int().min(1),
  motif: z.string().optional(),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const body = await parseBody(req);
  if (handleOptions(req, res)) return;
  const ctx = await requireTenantAuth(req, res);
  if (!ctx) return;

  const db = getDb();

  // ── GET /api/mouvements ──────────────────────────────────
  if (req.method === 'GET') {
    try {
      const { type, start, end } = req.query as { type?: string; start?: string; end?: string };
      const tenantId = ctx.tenantId || 'tenant_demo';
      const conditions: any[] = [];

      if (ctx.role !== 'superadmin') {
        conditions.push(eq(mouvementsStock.tenantId, tenantId));
      }

      if (type && type !== 'tous' && type !== 'undefined') {
        conditions.push(eq(mouvementsStock.type, type as any));
      }
      if (start && typeof start === 'string' && start.trim().length > 0 && start !== 'undefined') {
        const startDate = new Date(start);
        if (!isNaN(startDate.getTime())) {
          conditions.push(gte(mouvementsStock.createdAt, startDate));
        }
      }
      if (end && typeof end === 'string' && end.trim().length > 0 && end !== 'undefined') {
        const endDate = new Date(end);
        if (!isNaN(endDate.getTime())) {
          endDate.setHours(23, 59, 59, 999);
          conditions.push(lte(mouvementsStock.createdAt, endDate));
        }
      }

      const rows = conditions.length > 0
        ? await db
            .select()
            .from(mouvementsStock)
            .where(and(...conditions))
            .orderBy(desc(mouvementsStock.createdAt))
            .limit(200)
        : await db
            .select()
            .from(mouvementsStock)
            .orderBy(desc(mouvementsStock.createdAt))
            .limit(200);

      return ok(res, numericRows(rows as Record<string, unknown>[]));
    } catch (e) {
      console.error('[mouvements GET]', e);
      return err(res, 'Erreur serveur', 500);
    }
  }

  // ── POST /api/mouvements ─────────────────────────────────
  if (req.method === 'POST') {
    if (ctx.role !== 'admin' && ctx.role !== 'gestionnaire') {
      return err(res, 'Accès refusé', 403);
    }

    const parsed = MouvementSchema.safeParse(body);
    if (!parsed.success) return err(res, 'Données invalides', 422);

    try {
      const tenantId = ctx.tenantId || 'tenant_demo';
      // 1. Fetch product
      const [produit] = await db
        .select()
        .from(produits)
        .where(eq(produits.id, parsed.data.produitId));

      if (!produit) return err(res, 'Produit introuvable', 404);

      const stockAvant = produit.stockActuel;
      let delta = 0;
      if (parsed.data.type === 'entree') {
        delta = parsed.data.quantite;
      } else if (parsed.data.type === 'sortie' || parsed.data.type === 'usage_interne') {
        delta = -parsed.data.quantite;
      } else if (parsed.data.type === 'ajustement') {
        // Quantite represents new stock or adjustment amount
        delta = parsed.data.quantite - stockAvant;
      }

      const stockApres = Math.max(0, stockAvant + delta);

      // 2. Update product stock
      await db
        .update(produits)
        .set({ stockActuel: stockApres, updatedAt: new Date() })
        .where(eq(produits.id, produit.id));

      // 3. Insert movement log
      const [mouvement] = await db
        .insert(mouvementsStock)
        .values({
          id: nanoid(),
          tenantId: produit.tenantId || tenantId,
          produitId: produit.id,
          produitNom: produit.designation,
          produitRef: produit.reference,
          type: parsed.data.type,
          quantite: parsed.data.quantite,
          stockAvant,
          stockApres,
          motif: parsed.data.motif || '',
          utilisateurId: ctx.sub,
          utilisateurNom: `${ctx.prenom || ''} ${ctx.nom || ''}`.trim() || ctx.email,
        })
        .returning();

      await logAction(db, ctx.tenantId!, ctx.sub, 'stock.mouvement', 'produit', produit.id, {
        type: parsed.data.type,
        quantite: parsed.data.quantite,
        stockAvant,
        stockApres,
      });

      return ok(res, numericRow(mouvement), 201);
    } catch (e) {
      console.error('[mouvements POST]', e);
      return err(res, 'Erreur serveur', 500);
    }
  }

  return err(res, 'Méthode non autorisée', 405);
}
