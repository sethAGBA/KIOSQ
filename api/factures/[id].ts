import type { VercelRequest, VercelResponse } from '@vercel/node';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { getDb } from '../../db/client';
import { factures } from '../../db/schema';
import { requireAuth, handleOptions } from '../_lib/auth';
import { ok, err, numericRow } from '../_lib/response';

const PatchSchema = z.object({
  statut: z.enum(['brouillon','envoyee','payee','partielle','en_retard','annulee']).optional(),
  notes:  z.string().optional(),
});

const PaiementSchema = z.object({
  montant:   z.number().positive(),
  mode:      z.enum(['especes','virement','cheque','mobile_money','carte','autre']),
  date:      z.string(),
  reference: z.string().optional(),
  note:      z.string().optional(),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) return;
  const ctx = await requireAuth(req, res);
  if (!ctx) return;

  const { id } = req.query as { id: string };
  const db = getDb();

  if (req.method === 'GET') {
    try {
      const [row] = await db.select().from(factures).where(eq(factures.id, id)).limit(1);
      if (!row) return err(res, 'Facture introuvable', 404);
      return ok(res, numericRow(row));
    } catch (e) { return err(res, 'Erreur serveur', 500); }
  }

  if (req.method === 'PATCH') {
    const parsed = PatchSchema.safeParse(req.body);
    if (!parsed.success) return err(res, 'Données invalides', 422);
    try {
      const [row] = await db.update(factures)
        .set({ ...parsed.data, updatedAt: new Date() })
        .where(eq(factures.id, id))
        .returning();
      if (!row) return err(res, 'Facture introuvable', 404);
      return ok(res, numericRow(row));
    } catch (e) { return err(res, 'Erreur serveur', 500); }
  }

  // ── POST /api/factures/:id/paiement via query param ───
  if (req.method === 'POST') {
    const parsed = PaiementSchema.safeParse(req.body);
    if (!parsed.success) return err(res, 'Données invalides', 422);
    try {
      const [existing] = await db.select().from(factures).where(eq(factures.id, id)).limit(1);
      if (!existing) return err(res, 'Facture introuvable', 404);

      const paiements = (existing.paiements as object[]) ?? [];
      const newPaiement = { id: nanoid(), ...parsed.data };
      paiements.push(newPaiement);

      const montantPaye = Number(existing.montantPaye) + parsed.data.montant;
      const resteAPayer = Math.max(0, Number(existing.totalTTC) - montantPaye);
      const statut = resteAPayer === 0 ? 'payee' : montantPaye > 0 ? 'partielle' : existing.statut;

      const [row] = await db.update(factures)
        .set({
          paiements,
          montantPaye: String(montantPaye),
          resteAPayer: String(resteAPayer),
          statut: statut as typeof existing.statut,
          updatedAt: new Date(),
        })
        .where(eq(factures.id, id))
        .returning();
      return ok(res, numericRow(row));
    } catch (e) { return err(res, 'Erreur serveur', 500); }
  }

  return err(res, 'Méthode non autorisée', 405);
}
