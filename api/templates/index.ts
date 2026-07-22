import type { VercelRequest, VercelResponse } from '@vercel/node';
import { eq, desc } from 'drizzle-orm';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { getDb } from '../../db/client.js';
import { catalogueTemplates, categories, produits } from '../../db/schema.js';
import { requireTenantAuth, handleOptions } from '../_lib/auth.js';
import { ok, err, parseBody } from '../_lib/response.js';

const ExportSchema = z.object({
  nom:             z.string().min(1),
  description:     z.string().optional(),
  secteurActivite: z.string().optional(),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const body = await parseBody(req);
  if (handleOptions(req, res)) return;
  const ctx = await requireTenantAuth(req, res);
  if (!ctx) return;

  const db = getDb();

  // ── GET /api/templates — marketplace listing ───────────────────────────
  if (req.method === 'GET') {
    try {
      const { secteurActivite } = req.query as Record<string, string>;

      const rows = await db
        .select({
          id:              catalogueTemplates.id,
          tenantId:        catalogueTemplates.tenantId,
          nom:             catalogueTemplates.nom,
          description:     catalogueTemplates.description,
          secteurActivite: catalogueTemplates.secteurActivite,
          createdAt:       catalogueTemplates.createdAt,
          // payload omitted from list view for bandwidth — clients fetch per-template on import
        })
        .from(catalogueTemplates)
        .orderBy(desc(catalogueTemplates.createdAt));

      const result = secteurActivite
        ? rows.filter(r => r.secteurActivite === secteurActivite)
        : rows;

      return ok(res, result);
    } catch (e) {
      console.error('[templates GET]', e);
      return err(res, 'Erreur serveur', 500);
    }
  }

  // ── POST /api/templates — export current tenant catalogue as template ──
  if (req.method === 'POST') {
    if (!['admin', 'gestionnaire'].includes(ctx.role)) {
      return err(res, 'Accès refusé', 403);
    }

    const parsed = ExportSchema.safeParse(body);
    if (!parsed.success) return err(res, 'Données invalides', 422);

    try {
      // Fetch the tenant's categories (nom + description only — exclude tenantId)
      const tenantCategories = await db
        .select({
          id:          categories.id,
          nom:         categories.nom,
          description: categories.description,
          couleur:     categories.couleur,
        })
        .from(categories)
        .where(eq(categories.tenantId, ctx.tenantId!));

      // Fetch the tenant's products — include catalogue-relevant fields only.
      // Exclude: tenantId, financial transaction data (stock levels, purchase price),
      // clientId, createdBy, and operational fields.
      const tenantProduits = await db
        .select({
          reference:    produits.reference,
          designation:  produits.designation,
          description:  produits.description,
          categorieId:  produits.categorieId,
          unite:        produits.unite,
          marque:       produits.marque,
          prixVente:    produits.prixVente,
          prixVenteGros:produits.prixVenteGros,
          codeBarres:   produits.codeBarres,
        })
        .from(produits)
        .where(eq(produits.tenantId, ctx.tenantId!));

      const payload = {
        categories: tenantCategories,
        produits:   tenantProduits,
      };

      const [row] = await db
        .insert(catalogueTemplates)
        .values({
          id:              nanoid(),
          tenantId:        ctx.tenantId!,
          nom:             parsed.data.nom,
          description:     parsed.data.description,
          secteurActivite: parsed.data.secteurActivite,
          payload,
        })
        .returning();

      return ok(res, row, 201);
    } catch (e) {
      console.error('[templates POST]', e);
      return err(res, 'Erreur serveur', 500);
    }
  }

  return err(res, 'Méthode non autorisée', 405);
}
