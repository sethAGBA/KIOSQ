import type { VercelRequest, VercelResponse } from '@vercel/node';
import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { getDb } from '../../db/client.js';
import { commandesFournisseurs, fournisseurs } from '../../db/schema.js';
import { requireAuth, handleOptions } from '../_lib/auth.js';
import { ok, err, numericRows, numericRow, parseBody} from '../_lib/response.js';

const LigneSchema = z.object({
  produitId:     z.string(),
  produitRef:    z.string(),
  produitNom:    z.string(),
  quantite:      z.number().int().positive(),
  quantiteRecue: z.number().int().min(0).default(0),
  prixAchat:     z.number().min(0),
  total:         z.number().min(0),
});

const CFSchema = z.object({
  fournisseurId:        z.string(),
  lignes:               z.array(LigneSchema),
  totalHT:              z.number().min(0),
  fraisLivraison:       z.number().min(0).default(0),
  totalTTC:             z.number().min(0),
  dateLivraisonPrevue:  z.string().optional(),
  notes:                z.string().optional(),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const body = await parseBody(req);
  if (handleOptions(req, res)) return;
  const ctx = await requireAuth(req, res);
  if (!ctx) return;

  const db = getDb();

  // ── GET /api/commandes-fournisseurs ───────────────────
  if (req.method === 'GET') {
    try {
      const rows = await db.select().from(commandesFournisseurs).orderBy(desc(commandesFournisseurs.createdAt));
      return ok(res, numericRows(rows as Record<string, unknown>[]));
    } catch (e) {
      console.error('[CF GET]', e);
      return err(res, 'Erreur serveur', 500);
    }
  }

  // ── POST /api/commandes-fournisseurs ──────────────────
  if (req.method === 'POST') {
    if (!['admin', 'gestionnaire'].includes(ctx.role)) return err(res, 'Accès refusé', 403);
    const parsed = CFSchema.safeParse(body);
    if (!parsed.success) return err(res, 'Données invalides', 422);
    try {
      const [four] = await db.select({ nom: fournisseurs.nom, soldeDette: fournisseurs.soldeDette, totalAchats: fournisseurs.totalAchats })
        .from(fournisseurs).where(eq(fournisseurs.id, parsed.data.fournisseurId)).limit(1);
      if (!four) return err(res, 'Fournisseur introuvable', 404);

      const all = await db.select().from(commandesFournisseurs);
      const year = new Date().getFullYear();
      const numero = `ACH-${year}-${String(all.length + 1).padStart(3, '0')}`;

      // Update fournisseur balances
      await db.update(fournisseurs)
        .set({
          soldeDette: String(parseFloat(four.soldeDette) + parsed.data.totalTTC),
          totalAchats: String(parseFloat(four.totalAchats) + parsed.data.totalTTC),
          updatedAt: new Date()
        })
        .where(eq(fournisseurs.id, parsed.data.fournisseurId));

      const [row] = await db.insert(commandesFournisseurs).values({
        id:                   nanoid(),
        numero,
        fournisseurId:        parsed.data.fournisseurId,
        fournisseurNom:       four.nom,
        statut:               'brouillon',
        lignes:               parsed.data.lignes,
        totalHT:              String(parsed.data.totalHT),
        fraisLivraison:       String(parsed.data.fraisLivraison),
        totalTTC:             String(parsed.data.totalTTC),
        montantPaye:          '0',
        resteAPayer:          String(parsed.data.totalTTC),
        statutPaiement:       'en_attente',
        dateLivraisonPrevue:  parsed.data.dateLivraisonPrevue ? new Date(parsed.data.dateLivraisonPrevue) : null,
        notes:                parsed.data.notes,
        createdBy:            ctx.sub,
      }).returning();
      return ok(res, numericRow(row), 201);
    } catch (e) {
      console.error('[CF POST]', e);
      return err(res, 'Erreur serveur', 500);
    }
  }

  return err(res, 'Méthode non autorisée', 405);
}
