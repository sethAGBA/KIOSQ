import type { VercelRequest, VercelResponse } from '@vercel/node';
import { and, eq } from 'drizzle-orm';
import { getDb } from '../../../db/client.js';
import { fournisseurs, commandesFournisseurs } from '../../../db/schema.js';
import { requireTenantAuth, handleOptions } from '../../_lib/auth.js';
import { ok, err, numericRow, parseBody } from '../../_lib/response.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await parseBody(req);
  if (handleOptions(req, res)) return;
  if (req.method !== 'POST') return err(res, 'Méthode non autorisée', 405);

  const ctx = await requireTenantAuth(req, res);
  if (!ctx) return;
  if (!['admin', 'gestionnaire', 'comptable'].includes(ctx.role)) return err(res, 'Accès refusé', 403);

  const fournisseurId = req.query.id as string;
  const db = getDb();

  try {
    const [fournisseur] = await db.select().from(fournisseurs)
      .where(and(eq(fournisseurs.id, fournisseurId), eq(fournisseurs.tenantId, ctx.tenantId!)))
      .limit(1);
    if (!fournisseur) return err(res, 'Fournisseur introuvable', 404);

    // Fetch all supplier orders
    const supplierOrders = await db.select().from(commandesFournisseurs)
      .where(and(eq(commandesFournisseurs.fournisseurId, fournisseurId), eq(commandesFournisseurs.tenantId, ctx.tenantId!)));

    let lastPaiement: { orderId: string; montant: number; index: number } | null = null;
    let lastDate = new Date(0);

    for (const order of supplierOrders) {
      const pArray = Array.isArray(order.paiements) ? order.paiements : [];
      if (pArray.length === 0) continue;
      // Take the last payment of each order
      const p = pArray[pArray.length - 1] as any;
      const d = new Date(p.date);
      if (d > lastDate) {
        lastDate = d;
        lastPaiement = { orderId: order.id, montant: Number(p.montant), index: pArray.length - 1 };
      }
    }

    if (!lastPaiement) {
      return err(res, 'Aucun paiement à annuler pour ce fournisseur', 404);
    }

    const orderToUpdate = supplierOrders.find(o => o.id === lastPaiement!.orderId)!;
    const pArray = Array.isArray(orderToUpdate.paiements) ? orderToUpdate.paiements as any[] : [];
    const montantAnnule = lastPaiement.montant;
    const newPaiements = pArray.slice(0, -1);
    const newPaye = Math.max(0, parseFloat(orderToUpdate.montantPaye) - montantAnnule);
    const newReste = parseFloat(orderToUpdate.resteAPayer) + montantAnnule;

    const [updatedOrder] = await db.update(commandesFournisseurs)
      .set({
        paiements: newPaiements,
        montantPaye: String(newPaye),
        resteAPayer: String(newReste),
        statutPaiement: newReste === 0 ? 'paye' : newPaye > 0 ? 'partiel' : 'en_attente',
        updatedAt: new Date()
      })
      .where(eq(commandesFournisseurs.id, orderToUpdate.id))
      .returning();

    const currentSolde = parseFloat(fournisseur.soldeDette);
    const newSolde = currentSolde + montantAnnule;

    const [updatedFournisseur] = await db.update(fournisseurs)
      .set({
        soldeDette: String(newSolde),
        updatedAt: new Date()
      })
      .where(and(eq(fournisseurs.id, fournisseurId), eq(fournisseurs.tenantId, ctx.tenantId!)))
      .returning();

    return ok(res, {
      success: true,
      fournisseur: numericRow(updatedFournisseur),
      commandeUpdated: numericRow(updatedOrder),
    });

  } catch (error) {
    console.error('[fournisseur annuler-reglement POST]', error);
    return err(res, 'Erreur lors de l\'annulation du règlement', 500);
  }
}
