import type { VercelRequest, VercelResponse } from '@vercel/node';
import { eq, desc, and } from 'drizzle-orm';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { getDb } from '../../db/client.js';
import { produits, categories, fournisseurs } from '../../db/schema.js';
import { requireTenantAuth, handleOptions } from '../_lib/auth.js';
import { ok, err, numericRows, numericRow, parseBody} from '../_lib/response.js';
import { checkPlanLimit } from '../_lib/planLimits.js';
import { logAction, AUDIT_ACTIONS } from '../_lib/auditLog.js';

const emptyToUndefined = z.string().optional().transform(v => v === '' ? undefined : v);

const ProduitSchema = z.object({
  reference:     z.string().min(1),
  designation:   z.string().min(1),
  description:   emptyToUndefined,
  categorieId:   emptyToUndefined,
  fournisseurId: emptyToUndefined,
  unite:         z.string().default('pièce'),
  marque:        emptyToUndefined,
  prixAchat:     z.number().min(0).default(0),
  prixVente:     z.number().min(0).default(0),
  prixVenteGros: z.number().min(0).optional(),
  stockActuel:   z.number().int().min(0).default(0),
  stockMinimum:  z.number().int().min(0).default(0),
  stockMaximum:  z.number().int().min(0).optional(),
  datePeremption:z.string().optional(),
  emplacement:   z.string().optional(),
  codeBarres:    z.string().optional(),
  magasinId:     z.string().optional(),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const body = await parseBody(req);
  if (handleOptions(req, res)) return;
  const ctx = await requireTenantAuth(req, res);
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
          datePeremption:produits.datePeremption,
          emplacement:   produits.emplacement,
          codeBarres:    produits.codeBarres,
          magasinId:     produits.magasinId,
          actif:         produits.actif,
          createdAt:     produits.createdAt,
          updatedAt:     produits.updatedAt,
        })
        .from(produits)
        .leftJoin(categories, eq(produits.categorieId, categories.id))
        .leftJoin(fournisseurs, eq(produits.fournisseurId, fournisseurs.id))
        .where(eq(produits.tenantId, ctx.tenantId!))
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
    const parsed = ProduitSchema.safeParse(body);
    if (!parsed.success) return err(res, 'Données invalides', 422);
    if (!await checkPlanLimit(db, ctx.tenantId!, 'produits', res)) return;
    try {
      const [row] = await db.insert(produits).values({
        id: nanoid(),
        tenantId: ctx.tenantId!,
        ...parsed.data,
        prixAchat:     String(parsed.data.prixAchat),
        prixVente:     String(parsed.data.prixVente),
        prixVenteGros: parsed.data.prixVenteGros != null ? String(parsed.data.prixVenteGros) : undefined,
        datePeremption:parsed.data.datePeremption ? new Date(parsed.data.datePeremption) : null,
      }).returning();
      await logAction(
        db,
        ctx.tenantId!,
        ctx.sub,
        AUDIT_ACTIONS.PRODUIT_CREATED,
        'produit',
        row.id,
        { reference: row.reference, designation: row.designation }
      );
      return ok(res, numericRow(row), 201);
    } catch (e) {
      console.error('[produits POST]', e);
      return err(res, 'Erreur serveur', 500);
    }
  }

  return err(res, 'Méthode non autorisée', 405);
}
