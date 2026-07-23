import type { VercelRequest, VercelResponse } from '@vercel/node';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { getDb } from '../../../db/client.js';
import { inventaires, produits, mouvementsStock } from '../../../db/schema.js';
import { requireTenantAuth, handleOptions } from '../../_lib/auth.js';
import { ok, err, numericRow } from '../../_lib/response.js';
import { logAction } from '../../_lib/auditLog.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) return;
  const ctx = await requireTenantAuth(req, res);
  if (!ctx) return;

  if (req.method !== 'POST') return err(res, 'Méthode non autorisée', 405);
  if (ctx.role !== 'admin' && ctx.role !== 'gestionnaire') {
    return err(res, 'Accès refusé', 403);
  }

  const { id } = req.query as { id: string };
  if (!id) return err(res, 'ID manquant', 400);

  const db = getDb();
  const tenantId = ctx.tenantId || 'tenant_demo';

  try {
    const [inv] = await db
      .select()
      .from(inventaires)
      .where(and(eq(inventaires.id, id), eq(inventaires.tenantId, tenantId)));

    if (!inv) return err(res, 'Inventaire introuvable', 404);
    if (inv.statut === 'valide') return err(res, 'Cet inventaire est déjà validé', 400);

    const userName = `${ctx.prenom || ''} ${ctx.nom || ''}`.trim() || ctx.email;
    const lignes = (inv.lignes as any[]) || [];

    // Apply stock updates and log movements
    for (const ligne of lignes) {
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
          motif: `Régularisation inventaire #${id.slice(0, 8)}`,
          utilisateurId: ctx.sub,
          utilisateurNom: userName,
        });
      }
    }

    // Update inventaire status
    const [updated] = await db
      .update(inventaires)
      .set({ statut: 'valide', updatedAt: new Date() })
      .where(eq(inventaires.id, id))
      .returning();

    await logAction(db, tenantId, ctx.sub, 'inventaire.valide', 'inventaire', id);

    return ok(res, numericRow(updated));
  } catch (e) {
    console.error('[inventaires valider]', e);
    return err(res, 'Erreur serveur', 500);
  }
}
