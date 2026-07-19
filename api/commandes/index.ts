import type { VercelRequest, VercelResponse } from '@vercel/node';
import { eq, desc } from 'drizzle-orm';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { getDb } from '../../db/client';
import { commandes, clients } from '../../db/schema';
import { requireAuth, handleOptions } from '../_lib/auth';
import { ok, err, numericRows, numericRow } from '../_lib/response';

const LigneSchema = z.object({
  produitId:  z.string(),
  produitRef: z.string(),
  produitNom: z.string(),
  quantite:   z.number().int().positive(),
  prixUnitaire: z.number().min(0),
  remise:     z.number().min(0).max(100).default(0),
  total:      z.number().min(0),
});

const CommandeSchema = z.object({
  type:             z.enum(['commande', 'devis']).default('commande'),
  clientId:         z.string(),
  commercial:       z.string().optional(),
  lignes:           z.array(LigneSchema),
  totalHT:          z.number().min(0),
  remiseGlobale:    z.number().min(0).max(100).default(0),
  tva:              z.number().min(0).default(18),
  totalTTC:         z.number().min(0),
  acompte:          z.number().min(0).default(0),
  dateLivraison:    z.string().optional(),
  dateValidite:     z.string().optional(),
  adresseLivraison: z.string().optional(),
  notes:            z.string().optional(),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) return;
  const ctx = await requireAuth(req, res);
  if (!ctx) return;

  const db = getDb();

  if (req.method === 'GET') {
    try {
      const { type, statut } = req.query as Record<string, string>;
      let rows = await db.select().from(commandes).orderBy(desc(commandes.createdAt));
      if (type) rows = rows.filter(r => r.type === type);
      if (statut && statut !== 'tous') rows = rows.filter(r => r.statut === statut);
      return ok(res, numericRows(rows as Record<string, unknown>[]));
    } catch (e) {
      console.error('[commandes GET]', e);
      return err(res, 'Erreur serveur', 500);
    }
  }

  if (req.method === 'POST') {
    if (!['admin', 'commercial', 'gestionnaire'].includes(ctx.role))
      return err(res, 'Accès refusé', 403);

    const parsed = CommandeSchema.safeParse(req.body);
    if (!parsed.success) return err(res, 'Données invalides', 422);

    try {
      // Get client name
      const [client] = await db.select({ nom: clients.nom })
        .from(clients).where(eq(clients.id, parsed.data.clientId)).limit(1);
      if (!client) return err(res, 'Client introuvable', 404);

      // Build numero
      const all = await db.select().from(commandes);
      const year = new Date().getFullYear();
      const prefix = parsed.data.type === 'devis' ? 'DEV' : 'CMD';
      const numero = `${prefix}-${year}-${String(all.length + 1).padStart(3, '0')}`;

      const resteAPayer = parsed.data.totalTTC - parsed.data.acompte;

      const [row] = await db.insert(commandes).values({
        id:               nanoid(),
        numero,
        type:             parsed.data.type,
        clientId:         parsed.data.clientId,
        clientNom:        client.nom,
        commercial:       parsed.data.commercial ?? ctx.nom,
        statut:           'brouillon',
        lignes:           parsed.data.lignes,
        totalHT:          String(parsed.data.totalHT),
        remiseGlobale:    String(parsed.data.remiseGlobale),
        tva:              String(parsed.data.tva),
        totalTTC:         String(parsed.data.totalTTC),
        acompte:          String(parsed.data.acompte),
        resteAPayer:      String(resteAPayer),
        dateLivraison:    parsed.data.dateLivraison ? new Date(parsed.data.dateLivraison) : null,
        dateValidite:     parsed.data.dateValidite  ? new Date(parsed.data.dateValidite)  : null,
        adresseLivraison: parsed.data.adresseLivraison,
        notes:            parsed.data.notes,
        createdBy:        ctx.sub,
      }).returning();
      return ok(res, numericRow(row), 201);
    } catch (e) {
      console.error('[commandes POST]', e);
      return err(res, 'Erreur serveur', 500);
    }
  }

  return err(res, 'Méthode non autorisée', 405);
}
