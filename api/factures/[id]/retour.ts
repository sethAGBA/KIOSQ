import type { VercelRequest, VercelResponse } from '@vercel/node';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../../../db/client';
import { factures, produits } from '../../../db/schema';
import { requireAuth, handleOptions } from '../../_lib/auth';
import { ok, err, numericRow } from '../../_lib/response';

// ── Validation ────────────────────────────────────────────────────────────────
const RetourLineSchema = z.object({
  designation: z.string(),        // "REF — Nom du produit"
  quantite:    z.number().int().positive(),
  prixUnitaire: z.number().positive(),
});

const RetourSchema = z.object({
  lignesRetour:       z.array(RetourLineSchema).min(1, 'Au moins un article requis'),
  motif:              z.string().min(3, 'Motif requis (min 3 caractères)'),
  remboursementMode:  z.enum(['especes', 'credit_reduc', 'avoir']),
});

// ── Handler ───────────────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) return;

  // Only POST allowed on this sub-route
  if (req.method !== 'POST') return err(res, 'Méthode non autorisée', 405);

  const ctx = await requireAuth(req, res);
  if (!ctx) return;

  // Only admin/gestionnaire may process returns
  if (!['admin', 'gestionnaire'].includes(ctx.role)) {
    return err(res, 'Accès refusé : rôle insuffisant pour enregistrer un retour', 403);
  }

  const { id } = req.query as { id: string };
  const db = getDb();

  // ── Validate payload ───────────────────────────────────────────────────────
  const parsed = RetourSchema.safeParse(req.body);
  if (!parsed.success) {
    return err(res, `Données invalides : ${parsed.error.issues.map(i => i.message).join(', ')}`, 422);
  }

  const { lignesRetour, motif, remboursementMode } = parsed.data;

  try {
    // ── 1. Fetch the original facture ─────────────────────────────────────────
    const [facture] = await db.select().from(factures).where(eq(factures.id, id)).limit(1);
    if (!facture) return err(res, 'Facture introuvable', 404);

    if (facture.statut === 'annulee') {
      return err(res, 'Impossible de retourner une vente déjà annulée', 409);
    }

    // ── 2. Restore stock for each returned line ───────────────────────────────
    for (const ligne of lignesRetour) {
      const ref = ligne.designation.split(' — ')[0]?.trim();
      if (!ref) continue;

      const [prod] = await db.select().from(produits).where(eq(produits.reference, ref)).limit(1);
      if (prod) {
        await db.update(produits)
          .set({
            stockActuel: prod.stockActuel + ligne.quantite,
            updatedAt:   new Date(),
          })
          .where(eq(produits.id, prod.id));
      }
    }

    // ── 3. Append return note to the facture ──────────────────────────────────
    const returnSummary = lignesRetour
      .map(l => `${l.quantite}× ${l.designation}`)
      .join(', ');

    const now = new Date().toLocaleDateString('fr-FR');
    const newNote = `[Retour Client le ${now}] ${returnSummary}. Mode remboursement : ${remboursementMode}. Motif : ${motif}`;
    const existingNotes = (facture.notes ?? '').trim();
    const updatedNotes  = existingNotes ? `${existingNotes}\n${newNote}` : newNote;

    // ── 4. Update facture notes ───────────────────────────────────────────────
    const [updated] = await db.update(factures)
      .set({ notes: updatedNotes, updatedAt: new Date() })
      .where(eq(factures.id, id))
      .returning();

    return ok(res, numericRow(updated));

  } catch (e) {
    console.error('[factures/:id/retour POST]', e);
    return err(res, 'Erreur serveur lors du retour', 500);
  }
}
