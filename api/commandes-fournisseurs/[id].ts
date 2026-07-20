import type { VercelRequest, VercelResponse } from '@vercel/node';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { getDb } from '../../db/client';
import { commandesFournisseurs } from '../../db/schema';
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
      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (parsed.data.statut)        updates.statut = parsed.data.statut;
      if (parsed.data.notes)         updates.notes  = parsed.data.notes;
      if (parsed.data.dateReception) updates.dateReception = new Date(parsed.data.dateReception);
      if (parsed.data.statut === 'recu') updates.dateReception = new Date();

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
      const [existing] = await db.select().from(commandesFournisseurs).where(eq(commandesFournisseurs.id, id)).limit(1);
      if (!existing) return err(res, 'Commande introuvable', 404);

      const montantPaye = Number(existing.montantPaye) + parsed.data.montant;
      const resteAPayer = Math.max(0, Number(existing.totalTTC) - montantPaye);
      const statutPaiement = resteAPayer === 0 ? 'paye' : montantPaye > 0 ? 'partiel' : 'en_attente';

      const [row] = await db.update(commandesFournisseurs)
        .set({ montantPaye: String(montantPaye), resteAPayer: String(resteAPayer), statutPaiement, updatedAt: new Date() } as any)
        .where(eq(commandesFournisseurs.id, id))
        .returning();
      return ok(res, numericRow(row));
    } catch (e) { return err(res, 'Erreur serveur', 500); }
  }

  return err(res, 'Méthode non autorisée', 405);
}
