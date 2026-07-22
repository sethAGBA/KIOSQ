import type { VercelRequest, VercelResponse } from '@vercel/node';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { getDb } from '../../../db/client.js';
import { catalogueTemplates, categories, produits } from '../../../db/schema.js';
import { requireTenantAuth, handleOptions } from '../../_lib/auth.js';
import { ok, err } from '../../_lib/response.js';

// ── Types for the template payload ───────────────────────
interface TemplateCategory {
  id:          string;
  nom:         string;
  description?: string | null;
  couleur?:    string | null;
}

interface TemplateProduit {
  reference:     string;
  designation:   string;
  description?:  string | null;
  categorieId?:  string | null;
  unite?:        string | null;
  marque?:       string | null;
  prixVente?:    string | null;
  prixVenteGros?:string | null;
  codeBarres?:   string | null;
}

interface TemplatePayload {
  categories: TemplateCategory[];
  produits:   TemplateProduit[];
}

// ── Reference deduplication helper ───────────────────────
/**
 * Given a base reference and a set of existing references in the tenant,
 * return a unique reference by appending a numeric suffix if needed.
 * e.g.: "REF-001" → "REF-001-2" → "REF-001-3" …
 */
function uniqueReference(base: string, existingRefs: Set<string>): string {
  if (!existingRefs.has(base)) return base;
  let counter = 2;
  while (existingRefs.has(`${base}-${counter}`)) {
    counter++;
  }
  return `${base}-${counter}`;
}

// ── Handler ───────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) return;

  const ctx = await requireTenantAuth(req, res);
  if (!ctx) return;

  if (req.method !== 'POST') {
    return err(res, 'Méthode non autorisée', 405);
  }

  if (!['admin', 'gestionnaire'].includes(ctx.role)) {
    return err(res, 'Accès refusé', 403);
  }

  const { id } = req.query as Record<string, string>;
  if (!id) return err(res, 'Identifiant manquant', 400);

  const db = getDb();

  try {
    // ── 1. Load template ────────────────────────────────
    const [template] = await db
      .select()
      .from(catalogueTemplates)
      .where(eq(catalogueTemplates.id, id))
      .limit(1);

    if (!template) {
      return err(res, 'Template introuvable', 404);
    }

    const payload = template.payload as TemplatePayload;

    if (!payload?.categories || !payload?.produits) {
      return err(res, 'Payload de template invalide', 422);
    }

    const importerTenantId = ctx.tenantId!;

    // ── 2. Load existing categories in the importing tenant ──
    const existingCategories = await db
      .select({ id: categories.id, nom: categories.nom })
      .from(categories)
      .where(eq(categories.tenantId, importerTenantId));

    const existingCatByNom = new Map<string, string>(
      existingCategories.map(c => [c.nom.toLowerCase().trim(), c.id])
    );

    // ── 3. Process categories: create missing, reuse existing ──
    // Map: template category id → importing tenant category id
    const categoryIdMap = new Map<string, string>();
    let categoriesCreees = 0;

    for (const templateCat of payload.categories) {
      const normNom = templateCat.nom.toLowerCase().trim();
      const existingId = existingCatByNom.get(normNom);

      if (existingId) {
        // Reuse existing category
        categoryIdMap.set(templateCat.id, existingId);
      } else {
        // Create new category
        const newId = nanoid();
        await db.insert(categories).values({
          id:          newId,
          nom:         templateCat.nom,
          description: templateCat.description ?? null,
          couleur:     templateCat.couleur ?? null,
          tenantId:    importerTenantId,
        });
        categoryIdMap.set(templateCat.id, newId);
        existingCatByNom.set(normNom, newId);
        categoriesCreees++;
      }
    }

    // ── 4. Load existing product references in the importing tenant ──
    const existingProduits = await db
      .select({ reference: produits.reference })
      .from(produits)
      .where(eq(produits.tenantId, importerTenantId));

    const existingRefs = new Set<string>(existingProduits.map(p => p.reference));

    // ── 5. Process products: deduplicate references + remap categorieId ──
    let produitsCreees = 0;

    for (const templateProduit of payload.produits) {
      // Deduplicate reference within the importing tenant
      const finalRef = uniqueReference(templateProduit.reference, existingRefs);
      // Track so subsequent products in this same import batch don't collide either
      existingRefs.add(finalRef);

      // Remap categorieId from template space to importing tenant space
      const mappedCategorieId = templateProduit.categorieId
        ? (categoryIdMap.get(templateProduit.categorieId) ?? null)
        : null;

      await db.insert(produits).values({
        id:           nanoid(),
        reference:    finalRef,
        designation:  templateProduit.designation,
        description:  templateProduit.description ?? null,
        categorieId:  mappedCategorieId,
        unite:        templateProduit.unite ?? 'pièce',
        marque:       templateProduit.marque ?? null,
        prixVente:    templateProduit.prixVente ?? '0',
        prixVenteGros:templateProduit.prixVenteGros ?? null,
        codeBarres:   templateProduit.codeBarres ?? null,
        tenantId:     importerTenantId,
      });

      produitsCreees++;
    }

    // ── 6. Return counts ────────────────────────────────
    return ok(res, { categoriesCreees, produitsCreees }, 201);
  } catch (e) {
    console.error('[templates/[id]/import POST]', e);
    return err(res, 'Erreur serveur', 500);
  }
}
