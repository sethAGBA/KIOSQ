import type { VercelRequest, VercelResponse } from '@vercel/node';
import { eq } from 'drizzle-orm';
import { getDb } from '../../../db/client.js';
import { clients, factures } from '../../../db/schema.js';
import { requireAuth, handleOptions } from '../../_lib/auth.js';
import { ok, err, numericRow, parseBody } from '../../_lib/response.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await parseBody(req);
  if (handleOptions(req, res)) return;
  if (req.method !== 'POST') return err(res, 'Méthode non autorisée', 405);

  const ctx = await requireAuth(req, res);
  if (!ctx) return;

  const clientId = req.query.id as string;
  const db = getDb();

  try {
    const [client] = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
    if (!client) return err(res, 'Client introuvable', 404);

    // Fetch all client factures and find the most recent debt settlement payment
    const clientFactures = await db.select().from(factures).where(eq(factures.clientId, clientId));

    let lastPaiement: { factureId: string; montant: number; index: number } | null = null;
    let lastDate = new Date(0);

    for (const f of clientFactures) {
      const pArray = Array.isArray(f.paiements) ? f.paiements : [];
      if (pArray.length === 0) continue;
      // Take the last payment of each facture (any index)
      const p = pArray[pArray.length - 1] as any;
      const d = new Date(p.date);
      if (d > lastDate) {
        lastDate = d;
        lastPaiement = { factureId: f.id, montant: Number(p.montant), index: pArray.length - 1 };
      }
    }

    if (!lastPaiement) {
      return err(res, 'Aucun paiement à annuler pour ce client', 404);
    }

    const factureToUpdate = clientFactures.find(f => f.id === lastPaiement!.factureId)!;
    const pArray = Array.isArray(factureToUpdate.paiements) ? factureToUpdate.paiements as any[] : [];
    const montantAnnule = lastPaiement.montant;
    const newPaiements = pArray.slice(0, -1);
    const newPaye = Math.max(0, parseFloat(factureToUpdate.montantPaye) - montantAnnule);
    const newReste = parseFloat(factureToUpdate.resteAPayer) + montantAnnule;

    const [updatedFacture] = await db.update(factures)
      .set({
        paiements: newPaiements,
        montantPaye: String(newPaye),
        resteAPayer: String(newReste),
        statut: newReste > 0 ? 'partielle' : 'payee',
        updatedAt: new Date()
      })
      .where(eq(factures.id, factureToUpdate.id))
      .returning();

    const currentSolde = parseFloat(client.soldeCredit);
    const newSolde = currentSolde + montantAnnule;

    const [updatedClient] = await db.update(clients)
      .set({
        soldeCredit: String(newSolde),
        updatedAt: new Date()
      })
      .where(eq(clients.id, clientId))
      .returning();

    return ok(res, {
      success: true,
      client: numericRow(updatedClient),
      factureUpdated: numericRow(updatedFacture),
    });

  } catch (error) {
    console.error('[annuler-reglement POST]', error);
    return err(res, 'Erreur lors de l\'annulation du règlement', 500);
  }
}
