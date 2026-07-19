import type { VercelRequest, VercelResponse } from '@vercel/node';
import { eq, ilike, or, desc, lte } from 'drizzle-orm';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { getDb } from '../../db/client';
import { produits, categories, fournisseurs } from '../../db/schema';
import { requireAuth, handleOptions } from '../_lib/auth';
import { ok, err, numericRows, numericRow } from '../_lib/response';

const ProduitSchema = z.object({
  reference:     z.string().min(1),
  designation:   z.string().min(1),
  description:   z.string().optional(),
  categorieId:   z.string().optional(),
  fournisseurId: z.string().optional(),
  unite:         z.string().default('pièce'),
  marque:        z.string().optional(),
  prixAchat:     z.number().min(0),
  prixVente:     z.number().min(0),
  prixVenteGros: z.number().optional(),
  stockActuel:   z.number().int().min(0).default(0),
  stockMinimum:  z.number().int().min(0).default(0),
  stockMaximum:  z.number().int().optional(),
  emplacement:   z.string().optional(),
  codeBarres:    z.string().optional(),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) return;
  const ctx = await requireAuth(req, res);
  if (!ctx) return;

  const db = getDb();

  if (req.method === 'GET') {
    try {
      const { q, alerte, categorieId } = req.query as Record<string, string>;

      // Join with categories and fournisseurs for denormalized names
      const rows = await db
        .select({
          id:            produits.id,
          reference:     produits.reference,
          designation:   produits.designation,
          description:   produits.description,
          categorieId:   produits.categorieId,
          categorie:     categories.nom,
          fournisseurId: produits.fournisseurId,
          fournisseur:   fournisseurs.nom,
          unite:         produits.unite,
          marque:        produits.marque,
          prixAchat:     produits.prixAchat,
          prixVente:     produits.prixVente,
          prixVenteGros: produits.prixVenteGros,
          stockActuel:   produits.stockActuel,
          stockMinimum:  produits.stockMinimum,
          stockMaximum:  produits.stockMaximum,
          emplacement:   produits.emplacement,
          codeBarres:    produits.codeBarres,
          actif:         produits.actif,
          createdAt:     produits.createdAt,
          updatedAt:     produits.updatedAt,
        })
        .from(produits)
        .leftJoin(categories, eq(produits.categorieId, categories.id))
        .leftJoin(fournisseurs, eq(produits.fournisseurId, fournisseurs.id))
        .orderBy(desc(produits.updatedAt));

      let result = rows;
      if (q) result = result.filter(r =>
        r.designation.toLowerCase().includes(q.toLowerCase()) ||
        r.reference.toLowerCase().includes(q.toLowerCase())
      );
      if (alerte === '1') result = result.filter(r => Number(r.stockActuel) <= Number(r.stockMinimum));
      if (categorieId) result = result.filter(r => r.categorieId === categorieId);

      return ok(res, numericRows(result as Record<string, unknown>[]));
    } catch (e) {
      console.error('[produits GET]', e);
      return err(res, 'Erreur serveur', 500);
    }
  }

  if (req.method === 'POST') {
    if (!['admin', 'gestionnaire'].includes(ctx.role)) return err(res, 'Accès refusé', 403);
    const parsed = ProduitSchema.safeParse(req.body);
    if (!parsed.success) return err(res, 'Données invalides', 422);
    try {
      const [row] = await db.insert(produits).values({
        id: nanoid(),
        ...parsed.data,
        prixAchat:     String(parsed.data.prixAchat),
        prixVente:     String(parsed.data.prixVente),
        prixVenteGros: parsed.data.prixVenteGros != null ? String(parsed.data.prixVenteGros) : undefined,
      }).returning();
      return ok(res, numericRow(row), 201);
    } catch (e) {
      console.error('[produits POST]', e);
      return err(res, 'Erreur serveur', 500);
    }
  }

  return err(res, 'Méthode non autorisée', 405);
}
