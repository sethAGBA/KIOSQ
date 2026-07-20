import type { VercelRequest, VercelResponse } from '@vercel/node';
import { desc } from 'drizzle-orm';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { getDb } from '../../db/client';
import { factures, clients, produits } from '../../db/schema';
import { requireAuth, handleOptions } from '../_lib/auth';
import { ok, err, numericRows, numericRow } from '../_lib/response';
import { eq } from 'drizzle-orm';

const LigneSchema = z.object({
  designation:  z.string(),
  quantite:     z.number().int().positive(),
  prixUnitaire: z.number().min(0),
  remise:       z.number().min(0).max(100).default(0),
  tva:          z.number().min(0).default(18),
  total:        z.number().min(0),
});

const FactureSchema = z.object({
  clientId:      z.string(),
  commandeId:    z.string().optional(),
  lignes:        z.array(LigneSchema),
  totalHT:       z.number().min(0),
  remiseGlobale: z.number().min(0).max(100).default(0),
  tva:           z.number().min(0).default(18),
  totalTTC:      z.number().min(0),
  dateFacture:   z.string().optional(),
  dateEcheance:  z.string(),
  notes:         z.string().optional(),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) return;
  const ctx = await requireAuth(req, res);
  if (!ctx) return;

  const db = getDb();

  if (req.method === 'GET') {
    try {
      const { statut } = req.query as Record<string, string>;
      let rows = await db.select().from(factures).orderBy(desc(factures.createdAt));
      if (statut && statut !== 'tous') rows = rows.filter(r => r.statut === statut);
      return ok(res, numericRows(rows as Record<string, unknown>[]));
    } catch (e) {
      console.error('[factures GET]', e);
      return err(res, 'Erreur serveur', 500);
    }
  }

  if (req.method === 'POST') {
    if (!['admin', 'comptable', 'gestionnaire'].includes(ctx.role))
      return err(res, 'Accès refusé', 403);

    const parsed = FactureSchema.safeParse(req.body);
    if (!parsed.success) return err(res, 'Données invalides', 422);

    try {
      const [client] = await db.select().from(clients).where(eq(clients.id, parsed.data.clientId)).limit(1);
      if (!client) return err(res, 'Client introuvable', 404);

      // Validate stock levels first
      const productUpdates: { prodId: string; newStock: number }[] = [];
      for (const line of parsed.data.lignes) {
        const ref = line.designation.split(' — ')[0]?.trim();
        if (ref) {
          const [prod] = await db.select().from(produits).where(eq(produits.reference, ref)).limit(1);
          if (!prod) {
            return err(res, `Produit avec la référence ${ref} introuvable`, 404);
          }
          if (prod.stockActuel < line.quantite) {
            return err(res, `Stock insuffisant pour ${prod.designation} (Disponible: ${prod.stockActuel}, Demandé: ${line.quantite})`, 400);
          }
          productUpdates.push({ prodId: prod.id, newStock: prod.stockActuel - line.quantite });
        }
      }

      // Deduct stock in DB
      for (const update of productUpdates) {
        await db.update(produits)
          .set({ stockActuel: update.newStock, updatedAt: new Date() })
          .where(eq(produits.id, update.prodId));
      }

      const all = await db.select().from(factures);
      const year = new Date().getFullYear();
      const numero = `FAC-${year}-${String(all.length + 1).padStart(3, '0')}`;

      const [row] = await db.insert(factures).values({
        id:            nanoid(),
        numero,
        clientId:      parsed.data.clientId,
        clientNom:     client.nom,
        clientEmail:   client.email,
        clientAdresse: client.adresse,
        commandeId:    parsed.data.commandeId,
        statut:        'brouillon',
        lignes:        parsed.data.lignes,
        totalHT:       String(parsed.data.totalHT),
        remiseGlobale: String(parsed.data.remiseGlobale),
        tva:           String(parsed.data.tva),
        totalTTC:      String(parsed.data.totalTTC),
        montantPaye:   '0',
        resteAPayer:   String(parsed.data.totalTTC),
        paiements:     [],
        dateFacture:   parsed.data.dateFacture ? new Date(parsed.data.dateFacture) : new Date(),
        dateEcheance:  new Date(parsed.data.dateEcheance),
        notes:         parsed.data.notes,
        createdBy:     ctx.sub,
      }).returning();
      return ok(res, numericRow(row), 201);
    } catch (e) {
      console.error('[factures POST]', e);
      return err(res, 'Erreur serveur', 500);
    }
  }

  return err(res, 'Méthode non autorisée', 405);
}
