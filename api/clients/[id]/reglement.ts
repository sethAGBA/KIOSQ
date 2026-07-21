import type { VercelRequest, VercelResponse } from '@vercel/node';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { getDb } from '../../../db/client.js';
import { clients, factures } from '../../../db/schema.js';
import { requireAuth, handleOptions } from '../../_lib/auth.js';
import { ok, err, numericRow, parseBody } from '../../_lib/response.js';

const ReglementSchema = z.object({
  montant: z.number().positive(),
  modePaiement: z.string(),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const body = await parseBody(req);
  if (handleOptions(req, res)) return;
  if (req.method !== 'POST') return err(res, 'Méthode non autorisée', 405);

  const ctx = await requireAuth(req, res);
  if (!ctx) return;

  const clientId = req.query.id as string;
  const parsed = ReglementSchema.safeParse(body);
  if (!parsed.success) {
    return err(res, 'Données invalides', 422);
  }

  const { montant, modePaiement } = parsed.data;
  const db = getDb();

  try {
    const [client] = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
    if (!client) return err(res, 'Client introuvable', 404);

    let reste = montant;

    // Récupérer les factures impayées du client
    const facturesOuvertes = await db
      .select()
      .from(factures)
      .where(
        eq(factures.clientId, clientId)
      );

    // On filtre manuellement pour > 0 et on trie par date
    const facturesAcompleter = facturesOuvertes
      .filter(f => parseFloat(f.resteAPayer) > 0)
      .sort((a, b) => new Date(a.dateFacture).getTime() - new Date(b.dateFacture).getTime());

    const facturesUpdated = [];

    for (const f of facturesAcompleter) {
      if (reste <= 0) break;
      const fReste = parseFloat(f.resteAPayer);
      const montantApplique = Math.min(fReste, reste);
      const newReste = fReste - montantApplique;
      const newPaye = parseFloat(f.montantPaye) + montantApplique;

      const newPaiement = {
        id: nanoid(),
        montant: montantApplique,
        mode: modePaiement,
        date: new Date().toISOString(),
      };
      
      const pArray = Array.isArray(f.paiements) ? f.paiements : [];
      const updatedPaiements = [...pArray, newPaiement];

      const [updatedFacture] = await db.update(factures)
        .set({
          resteAPayer: String(newReste),
          montantPaye: String(newPaye),
          statut: newReste === 0 ? 'payee' : 'partielle',
          paiements: updatedPaiements,
          updatedAt: new Date()
        })
        .where(eq(factures.id, f.id))
        .returning();

      facturesUpdated.push(numericRow(updatedFacture));
      reste -= montantApplique;
    }

    const solde = parseFloat(client.soldeCredit);
    const newSolde = Math.max(0, solde - montant);

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
      facturesUpdated
    });

  } catch (error) {
    console.error('[reglement POST]', error);
    return err(res, 'Erreur lors du règlement', 500);
  }
}
