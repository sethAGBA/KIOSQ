import type { VercelRequest, VercelResponse } from '@vercel/node';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { getDb } from '../../db/client';
import { commandesFournisseurs, produits } from '../../db/schema';
import { requireAuth, handleOptions } from '../_lib/auth';
import { ok, err, numericRow } from '../_lib/response';

const PatchSchema = z.object({
  statut:        z.enum(['brouillon', 'commandee', 'recu_partiel', 'recu', 'annulee']).optional(),
  dateReception: z.string().optional(),
  notes:         z.string().optional(),
});

const PaiementSchema = z.object({
  montant: z.number().positive(),
  date:    z.string().optional(),
  note:    z.string().optional(),
});

// ── Types ─────────────────────────────────────────────────

interface LigneCF {
  produitId:     string;
  produitRef:    string;
  produitNom:    string;
  quantite:      number;
  quantiteRecue: number;
  prixAchat:     number;
  total:         number;
}

// ── Pure business logic ───────────────────────────────────

/**
 * Calcule les champs financiers d'un paiement CF.
 * Lève une erreur si le montant dépasse le total dû.
 *
 * @param totalTTC         Montant total de la commande
 * @param montantPayeActuel Montant déjà payé
 * @param nouveauMontant   Nouveau montant à ajouter
 */
export function computePaiement(
  totalTTC: number,
  montantPayeActuel: number,
  nouveauMontant: number,
): { montantPaye: number; resteAPayer: number; statutPaiement: string } {
  const montantPaye = montantPayeActuel + nouveauMontant;
  if (montantPaye > totalTTC) {
    throw new Error('Montant dépasse le total dû');
  }
  const resteAPayer = Math.max(0, totalTTC - montantPaye);
  const statutPaiement =
    resteAPayer === 0 ? 'paye' : montantPaye > 0 ? 'partiel' : 'en_attente';
  return { montantPaye, resteAPayer, statutPaiement };
}

// ── Handler ───────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) return;
  const ctx = await requireAuth(req, res);
  if (!ctx) return;
  if (!['admin', 'gestionnaire', 'comptable'].includes(ctx.role)) return err(res, 'Accès refusé', 403);

  const { id } = req.query as { id: string };
  const db = getDb();

  // ── GET ───────────────────────────────────────────────
  if (req.method === 'GET') {
    try {
      const [row] = await db.select().from(commandesFournisseurs).where(eq(commandesFournisseurs.id, id)).limit(1);
      if (!row) return err(res, 'Commande introuvable', 404);
      return ok(res, numericRow(row));
    } catch (e) { return err(res, 'Erreur serveur', 500); }
  }

  // ── PATCH (statut / notes) ────────────────────────────
  if (req.method === 'PATCH') {
    const parsed = PatchSchema.safeParse(req.body);
    if (!parsed.success) return err(res, 'Données invalides', 422);
    try {
      // Fetch the existing record first to check previous status and get lignes
      const [existing] = await db.select().from(commandesFournisseurs)
        .where(eq(commandesFournisseurs.id, id)).limit(1);
      if (!existing) return err(res, 'Commande introuvable', 404);

      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (parsed.data.statut)        updates.statut = parsed.data.statut;
      if (parsed.data.notes)         updates.notes  = parsed.data.notes;
      if (parsed.data.dateReception) updates.dateReception = new Date(parsed.data.dateReception);
      if (parsed.data.statut === 'recu') updates.dateReception = new Date();

      // Update stock when transitioning to 'recu' or 'recu_partiel'
      // Guard: only update stock if the previous status was not already 'recu'
      const newStatut = parsed.data.statut;
      const previousStatut = existing.statut;
      if (
        (newStatut === 'recu' || newStatut === 'recu_partiel') &&
        previousStatut !== 'recu'
      ) {
        const lignes = (existing.lignes as LigneCF[]) ?? [];
        for (const ligne of lignes) {
          if (ligne.quantiteRecue > 0) {
            await db.update(produits)
              .set({
                stockActuel: sql`${produits.stockActuel} + ${ligne.quantiteRecue}`,
                updatedAt: new Date(),
              })
              .where(eq(produits.id, ligne.produitId));
          }
        }
      }

      const [row] = await db.update(commandesFournisseurs)
        .set(updates as any)
        .where(eq(commandesFournisseurs.id, id))
        .returning();
      if (!row) return err(res, 'Commande introuvable', 404);
      return ok(res, numericRow(row));
    } catch (e) { return err(res, 'Erreur serveur', 500); }
  }

  // ── POST (enregistrer paiement) ───────────────────────
  if (req.method === 'POST') {
    const parsed = PaiementSchema.safeParse(req.body);
    if (!parsed.success) return err(res, 'Données invalides', 422);
    try {
      const [existing] = await db.select().from(commandesFournisseurs)
        .where(eq(commandesFournisseurs.id, id)).limit(1);
      if (!existing) return err(res, 'Commande introuvable', 404);

      let paiement: ReturnType<typeof computePaiement>;
      try {
        paiement = computePaiement(
          Number(existing.totalTTC),
          Number(existing.montantPaye),
          parsed.data.montant,
        );
      } catch (e) {
        if (e instanceof Error && e.message === 'Montant dépasse le total dû') {
          return err(res, 'Montant dépasse le total dû', 400);
        }
        throw e;
      }

      const [row] = await db.update(commandesFournisseurs)
        .set({
          montantPaye:    String(paiement.montantPaye),
          resteAPayer:    String(paiement.resteAPayer),
          statutPaiement: paiement.statutPaiement,
          updatedAt:      new Date(),
        } as any)
        .where(eq(commandesFournisseurs.id, id))
        .returning();
      return ok(res, numericRow(row));
    } catch (e) { return err(res, 'Erreur serveur', 500); }
  }

  return err(res, 'Méthode non autorisée', 405);
}
