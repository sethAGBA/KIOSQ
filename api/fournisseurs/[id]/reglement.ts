import type { VercelRequest, VercelResponse } from '@vercel/node';
import { eq, asc } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../../../db/client.js';
import { fournisseurs, commandesFournisseurs } from '../../../db/schema.js';
import { requireAuth, handleOptions } from '../../_lib/auth.js';
import { ok, err, numericRow, parseBody } from '../../_lib/response.js';

const ReglementSchema = z.object({
  montant: z.number().positive(),
  modePaiement: z.string().default('especes'),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const body = await parseBody(req);
  if (handleOptions(req, res)) return;
  if (req.method !== 'POST') return err(res, 'Méthode non autorisée', 405);

  const ctx = await requireAuth(req, res);
  if (!ctx) return;
  if (!['admin', 'gestionnaire', 'comptable'].includes(ctx.role)) return err(res, 'Accès refusé', 403);

  const fournisseurId = req.query.id as string;
  const parsed = ReglementSchema.safeParse(body);
  if (!parsed.success) return err(res, 'Données invalides', 422);

  const db = getDb();
  let montantRestant = parsed.data.montant;

  try {
    const [fournisseur] = await db.select().from(fournisseurs).where(eq(fournisseurs.id, fournisseurId)).limit(1);
    if (!fournisseur) return err(res, 'Fournisseur introuvable', 404);

    // Get open orders (statutPaiement != 'paye'), oldest first
    const openOrders = await db.select()
      .from(commandesFournisseurs)
      .where(eq(commandesFournisseurs.fournisseurId, fournisseurId))
      .orderBy(asc(commandesFournisseurs.createdAt));

    const ordersToPay = openOrders.filter(o => o.statutPaiement !== 'paye' && parseFloat(o.resteAPayer) > 0);
    const updatedOrders = [];

    for (const order of ordersToPay) {
      if (montantRestant <= 0) break;

      const currentReste = parseFloat(order.resteAPayer);
      const currentPaye = parseFloat(order.montantPaye);
      const montantApplique = Math.min(montantRestant, currentReste);
      
      const newReste = currentReste - montantApplique;
      const newPaye = currentPaye + montantApplique;
      const pArray = Array.isArray(order.paiements) ? order.paiements as any[] : [];

      const [updated] = await db.update(commandesFournisseurs)
        .set({
          montantPaye: String(newPaye),
          resteAPayer: String(newReste),
          paiements: [
            ...pArray,
            {
              id: `pay-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
              montant: montantApplique,
              mode: parsed.data.modePaiement,
              date: new Date().toISOString(),
            }
          ],
          statutPaiement: newReste === 0 ? 'paye' : 'partiel',
          updatedAt: new Date()
        })
        .where(eq(commandesFournisseurs.id, order.id))
        .returning();

      updatedOrders.push(updated);
      montantRestant -= montantApplique;
    }

    const currentSolde = parseFloat(fournisseur.soldeDette);
    const nouveauSolde = Math.max(0, currentSolde - parsed.data.montant);

    const [updatedFournisseur] = await db.update(fournisseurs)
      .set({
        soldeDette: String(nouveauSolde),
        updatedAt: new Date()
      })
      .where(eq(fournisseurs.id, fournisseurId))
      .returning();

    return ok(res, {
      success: true,
      fournisseur: numericRow(updatedFournisseur),
      commandesUpdated: updatedOrders.map(numericRow),
    });

  } catch (error) {
    console.error('[fournisseurs reglement POST]', error);
    return err(res, 'Erreur lors de l\'enregistrement du règlement', 500);
  }
}
