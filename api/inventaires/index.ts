import type { VercelRequest, VercelResponse } from '@vercel/node';
import { eq, and, desc } from 'drizzle-orm';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { getDb } from '../../db/client.js';
import { inventaires, produits, mouvementsStock } from '../../db/schema.js';
import { requireTenantAuth, handleOptions } from '../_lib/auth.js';
import { ok, err, numericRows, numericRow, parseBody } from '../_lib/response.js';
import { logAction } from '../_lib/auditLog.js';

const LigneSchema = z.object({
  produitId: z.string().min(1),
  produitRef: z.string().min(1),
  produitNom: z.string().min(1),
  stockTheorique: z.number().int(),
  stockReel: z.number().int().min(0),
  ecart: z.number().int(),
});

const InventaireSchema = z.object({
  lignes: z.array(LigneSchema).min(1),
  notes: z.string().optional(),
  autoValidate: z.boolean().optional(),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const body = await parseBody(req);
  if (handleOptions(req, res)) return;
  const ctx = await requireTenantAuth(req, res);
  if (!ctx) return;

  const db = getDb();
  const tenantId = ctx.tenantId || 'tenant_demo';

  // ── GET /api/inventaires ─────────────────────────────────
  if (req.method === 'GET') {
    try {
      const conditions: any[] = [];
      if (ctx.role !== 'superadmin') {
        conditions.push(eq(inventaires.tenantId, tenantId));
      }

      const rows = conditions.length > 0
        ? await db
            .select()
            .from(inventaires)
            .where(and(...conditions))
            .orderBy(desc(inventaires.createdAt))
            .limit(100)
        : await db
            .select()
            .from(inventaires)
            .orderBy(desc(inventaires.createdAt))
            .limit(100);

      return ok(res, numericRows(rows as Record<string, unknown>[]));
    } catch (e) {
      console.error('[inventaires GET]', e);
      return err(res, 'Erreur serveur', 500);
    }
  }

  // ── POST /api/inventaires ────────────────────────────────
  if (req.method === 'POST') {
    if (ctx.role !== 'admin' && ctx.role !== 'gestionnaire') {
      return err(res, 'Accès refusé', 403);
    }

    const parsed = InventaireSchema.safeParse(body);
    if (!parsed.success) return err(res, 'Données invalides', 422);

    try {
      const invId = nanoid();
      const userName = `${ctx.prenom || ''} ${ctx.nom || ''}`.trim() || ctx.email;
      const isAutoValidate = parsed.data.autoValidate === true;
      const statut = isAutoValidate ? 'valide' : 'en_cours';

      const [row] = await db
        .insert(inventaires)
        .values({
          id: invId,
          tenantId,
          date: new Date(),
          utilisateurId: ctx.sub,
          utilisateurNom: userName,
          statut,
          lignes: parsed.data.lignes,
          notes: parsed.data.notes || '',
        })
        .returning();

      // If autoValidate, apply stock updates immediately & log movements
      if (isAutoValidate) {
        for (const ligne of parsed.data.lignes) {
          if (ligne.ecart !== 0) {
            // Update product stock
            await db
              .update(produits)
              .set({ stockActuel: ligne.stockReel, updatedAt: new Date() })
              .where(and(eq(produits.id, ligne.produitId), eq(produits.tenantId, tenantId)));

            // Insert movement
            await db.insert(mouvementsStock).values({
              id: nanoid(),
              tenantId,
              produitId: ligne.produitId,
              produitNom: ligne.produitNom,
              produitRef: ligne.produitRef,
              type: 'ajustement',
              quantite: Math.abs(ligne.ecart),
              stockAvant: ligne.stockTheorique,
              stockApres: ligne.stockReel,
              motif: `Régularisation inventaire #${invId.slice(0, 8)}`,
              utilisateurId: ctx.sub,
              utilisateurNom: userName,
            });
          }
        }
      }

      await logAction(db, tenantId, ctx.sub, 'inventaire.created', 'inventaire', row.id, {
        lignesCount: parsed.data.lignes.length,
        statut,
      });

      return ok(res, numericRow(row), 201);
    } catch (e) {
      console.error('[inventaires POST]', e);
      return err(res, 'Erreur serveur', 500);
    }
  }

  return err(res, 'Méthode non autorisée', 405);
}
