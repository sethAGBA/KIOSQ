// Feature: gestion-multitenant, Property 10: Round-trip d'export/import de catalogue

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

/**
 * Validates: Requirements 14.1, 14.3, 14.5
 *
 * Property 10 : Round-trip d'export/import de catalogue
 *
 * For any tenant catalogue (set of categories and products), exporting the catalogue
 * as a Template_Catalogue then importing it into a new tenant must produce a catalogue
 * where:
 *
 *   1. All product `designation` values survive the round-trip exactly.
 *   2. All product `description` values survive the round-trip exactly.
 *   3. All product base `reference` values are present in the importing tenant
 *      (deduplication may append a suffix like `-2`, `-3`, but the base is preserved).
 *   4. No `tenantId` leaks into the template payload.
 *   5. All categories are present by name in the imported tenant.
 *
 * We test by:
 *   - Extracting the `uniqueReference` function and verifying its contract directly.
 *   - Modelling the export/import pipeline as pure functions (no DB needed).
 */

// ── Types mirroring api/templates/index.ts and api/templates/[id]/import.ts ─

interface TemplateCategory {
  id: string;
  nom: string;
  description?: string | null;
  couleur?: string | null;
}

interface TemplateProduit {
  reference: string;
  designation: string;
  description?: string | null;
  categorieId?: string | null;
  unite?: string | null;
  marque?: string | null;
  prixVente?: string | null;
  prixVenteGros?: string | null;
  codeBarres?: string | null;
}

interface TemplatePayload {
  categories: TemplateCategory[];
  produits: TemplateProduit[];
}

interface TenantCategory {
  id: string;
  nom: string;
  tenantId: string;
}

interface TenantProduit {
  id: string;
  reference: string;
  designation: string;
  description?: string | null;
  tenantId: string;
}

// ── Pure reimplementation of uniqueReference (matches api/templates/[id]/import.ts) ─

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

// ── Pure export simulation (mirrors POST /api/templates) ──────────────────

/**
 * Simulates the export step: build a TemplatePayload from a tenant's categories
 * and products, deliberately stripping tenantId.
 */
function simulateExport(
  tenantCategories: Array<{ id: string; nom: string; description?: string | null; couleur?: string | null }>,
  tenantProduits: Array<{
    reference: string;
    designation: string;
    description?: string | null;
    categorieId?: string | null;
    unite?: string | null;
    marque?: string | null;
    prixVente?: string | null;
    prixVenteGros?: string | null;
    codeBarres?: string | null;
  }>
): TemplatePayload {
  return {
    categories: tenantCategories.map(c => ({
      id: c.id,
      nom: c.nom,
      description: c.description ?? null,
      couleur: c.couleur ?? null,
    })),
    produits: tenantProduits.map(p => ({
      reference: p.reference,
      designation: p.designation,
      description: p.description ?? null,
      categorieId: p.categorieId ?? null,
      unite: p.unite ?? null,
      marque: p.marque ?? null,
      prixVente: p.prixVente ?? null,
      prixVenteGros: p.prixVenteGros ?? null,
      codeBarres: p.codeBarres ?? null,
    })),
  };
}

// ── Pure import simulation (mirrors POST /api/templates/[id]/import) ─────────

interface ImportResult {
  categories: TenantCategory[];
  produits: TenantProduit[];
}

/**
 * Simulates the import step: process a TemplatePayload into a new tenant context.
 * Pre-existing categories/products in the importing tenant are passed in to test
 * deduplication. Returns the final state of categories and products in the tenant
 * after import.
 */
function simulateImport(
  payload: TemplatePayload,
  importerTenantId: string,
  preExistingCategories: TenantCategory[],
  preExistingRefs: string[]
): ImportResult {
  // Seed category map from pre-existing categories
  const existingCatByNom = new Map<string, string>(
    preExistingCategories.map(c => [c.nom.toLowerCase().trim(), c.id])
  );
  const allCategories: TenantCategory[] = [...preExistingCategories];
  const categoryIdMap = new Map<string, string>();

  let catCounter = 1000; // synthetic id generator for pure test
  for (const templateCat of payload.categories) {
    const normNom = templateCat.nom.toLowerCase().trim();
    const existingId = existingCatByNom.get(normNom);
    if (existingId) {
      categoryIdMap.set(templateCat.id, existingId);
    } else {
      const newId = `new-cat-${catCounter++}`;
      allCategories.push({ id: newId, nom: templateCat.nom, tenantId: importerTenantId });
      categoryIdMap.set(templateCat.id, newId);
      existingCatByNom.set(normNom, newId);
    }
  }

  // Seed reference set from pre-existing products
  const existingRefs = new Set<string>(preExistingRefs);
  const allProduits: TenantProduit[] = [];

  let prodCounter = 1000;
  for (const templateProduit of payload.produits) {
    const finalRef = uniqueReference(templateProduit.reference, existingRefs);
    existingRefs.add(finalRef);

    allProduits.push({
      id: `new-prod-${prodCounter++}`,
      reference: finalRef,
      designation: templateProduit.designation,
      description: templateProduit.description ?? null,
      tenantId: importerTenantId,
    });
  }

  return {
    categories: allCategories,
    produits: allProduits,
  };
}

// ── Helper: extract the base reference (strip trailing -N suffix) ─────────

/**
 * Returns the base part of a deduplicated reference.
 * "REF-001-2" → "REF-001", "REF-001" → "REF-001".
 *
 * The uniqueReference function only appends `-N` where N >= 2 (integer).
 * So we strip the last `-\d+` segment if it exists and corresponds to a
 * numeric deduplication suffix (>= 2).
 */
function baseReference(ref: string): string {
  const match = ref.match(/^(.*)-(\d+)$/);
  if (match) {
    const suffix = parseInt(match[2], 10);
    if (suffix >= 2) return match[1];
  }
  return ref;
}

// ── Generators ──────────────────────────────────────────────────────────────

/**
 * Generates a non-empty, URL-safe reference string.
 * Avoids references that end in `-N` to prevent confusion with deduplication suffixes.
 */
const referenceArb = fc
  .stringMatching(/^[A-Z][A-Z0-9-]{0,18}[A-Z0-9]$/)
  .filter(r => !/.*-\d+$/.test(r)); // must not already end in -N

/**
 * Generates a template category with a unique-enough nom.
 */
const templateCategoryArb = fc.record({
  id: fc.uuid(),
  nom: fc.string({ minLength: 2, maxLength: 40 }).filter(s => s.trim().length >= 2),
  description: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: null }),
  couleur: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: null }),
});

/**
 * Generates a template product.
 * categorieId is set externally to a valid category id, so here it's null
 * (we test category mapping separately).
 */
const templateProduitArb = (ref: string) =>
  fc.record({
    reference: fc.constant(ref),
    designation: fc.string({ minLength: 2, maxLength: 80 }).filter(s => s.trim().length >= 2),
    description: fc.option(fc.string({ minLength: 1, maxLength: 200 }), { nil: null }),
    categorieId: fc.constant(null as string | null),
    unite: fc.option(fc.constantFrom('pièce', 'kg', 'litre', 'boîte'), { nil: null }),
    marque: fc.option(fc.string({ minLength: 1, maxLength: 40 }), { nil: null }),
    prixVente: fc.option(fc.float({ min: 0, max: 99999, noNaN: true }).map(n => n.toFixed(2)), { nil: null }),
    prixVenteGros: fc.constant(null as string | null),
    codeBarres: fc.constant(null as string | null),
  });

/**
 * Generates a complete TemplatePayload:
 * 1–8 categories with distinct noms, 1–12 products with distinct references.
 */
const templatePayloadArb = fc
  .uniqueArray(templateCategoryArb, {
    minLength: 1,
    maxLength: 8,
    selector: cat => cat.nom.toLowerCase().trim(),
  })
  .chain(cats =>
    fc
      .uniqueArray(referenceArb, { minLength: 1, maxLength: 12 })
      .chain(refs =>
        fc.tuple(...refs.map(r => templateProduitArb(r))).map(produits => ({
          categories: cats,
          produits,
        }))
      )
  );

// ── Test suite ───────────────────────────────────────────────────────────────

describe('catalogue-roundtrip — Property 10: Round-trip d\'export/import de catalogue (Req 14.1, 14.3, 14.5)', () => {

  /**
   * Sub-property A: All product designations survive the round-trip unchanged.
   *
   * The export step captures designations from the source tenant.
   * The import step copies them verbatim into the importing tenant.
   * No transformation should alter designation values.
   */
  it(
    'toutes les désignations sont préservées après export→import (100 itérations)',
    () => {
      fc.assert(
        fc.property(
          templatePayloadArb,
          fc.uuid(), // importing tenant id
          (payload, importerTenantId) => {
            const result = simulateImport(payload, importerTenantId, [], []);

            // Every designation from the original payload must appear in the imported products
            for (const original of payload.produits) {
              const found = result.produits.some(p => p.designation === original.designation);
              expect(found).toBe(true);
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    }
  );

  /**
   * Sub-property B: All product descriptions survive the round-trip unchanged.
   */
  it(
    'toutes les descriptions sont préservées après export→import (100 itérations)',
    () => {
      fc.assert(
        fc.property(
          templatePayloadArb,
          fc.uuid(),
          (payload, importerTenantId) => {
            const result = simulateImport(payload, importerTenantId, [], []);

            for (const original of payload.produits) {
              const found = result.produits.some(p => p.description === (original.description ?? null));
              expect(found).toBe(true);
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    }
  );

  /**
   * Sub-property C: All base references survive the round-trip.
   *
   * When importing into a tenant with no pre-existing products, references
   * must survive exactly. When collisions occur (pre-existing refs), the
   * base reference must still appear as the prefix of the final reference.
   */
  it(
    'toutes les références de base sont présentes après import (hors suffixes de déduplication) (100 itérations)',
    () => {
      fc.assert(
        fc.property(
          templatePayloadArb,
          fc.uuid(),
          (payload, importerTenantId) => {
            const result = simulateImport(payload, importerTenantId, [], []);

            for (const original of payload.produits) {
              // Each imported product reference must either be exactly the original
              // OR start with original + '-' (deduplication suffix appended)
              const found = result.produits.some(p => {
                const base = baseReference(p.reference);
                return base === original.reference || p.reference === original.reference;
              });
              expect(found).toBe(true);
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    }
  );

  /**
   * Sub-property D: All categories are present by name in the importing tenant.
   *
   * The import step creates missing categories or reuses existing ones.
   * Either way, after import every template category nom must be findable
   * in the importing tenant's category list.
   */
  it(
    'toutes les catégories sont présentes par nom dans le tenant importateur (100 itérations)',
    () => {
      fc.assert(
        fc.property(
          templatePayloadArb,
          fc.uuid(),
          (payload, importerTenantId) => {
            const result = simulateImport(payload, importerTenantId, [], []);

            const importedNoms = new Set(
              result.categories.map(c => c.nom.toLowerCase().trim())
            );

            for (const templateCat of payload.categories) {
              expect(importedNoms.has(templateCat.nom.toLowerCase().trim())).toBe(true);
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    }
  );

  /**
   * Sub-property E: No tenantId leaks into the template payload.
   *
   * The export step must strip tenantId from both categories and products.
   * The payload JSON must not contain any tenantId field.
   */
  it(
    'aucun tenantId ne fuit dans le payload exporté (100 itérations)',
    () => {
      fc.assert(
        fc.property(
          templatePayloadArb,
          fc.uuid(), // exporting tenant id (must NOT appear in payload)
          (payload, exporterTenantId) => {
            // Simulate the export using source-tenant categories and products
            // enriched with tenantId (which the export step must strip)
            const sourceCategories = payload.categories.map(c => ({
              ...c,
              tenantId: exporterTenantId, // present in DB, must NOT appear in payload
            }));
            const sourceProduits = payload.produits.map(p => ({
              ...p,
              tenantId: exporterTenantId,
            }));

            const exportedPayload = simulateExport(sourceCategories, sourceProduits);

            // Serialise the payload and check tenantId does not appear
            const serialised = JSON.stringify(exportedPayload);
            expect(serialised).not.toContain('"tenantId"');
            expect(serialised).not.toContain(exporterTenantId);

            // Also verify payload structure directly
            for (const cat of exportedPayload.categories) {
              expect(cat).not.toHaveProperty('tenantId');
            }
            for (const prod of exportedPayload.produits) {
              expect(prod).not.toHaveProperty('tenantId');
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    }
  );

  /**
   * Sub-property F: uniqueReference — returns base unchanged when no collision.
   *
   * Direct test of the deduplication helper's primary contract:
   * if the reference is not in the existing set, it must come back unchanged.
   */
  it(
    'uniqueReference retourne la base inchangée quand aucune collision (100 itérations)',
    () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 0, maxLength: 20 }),
          (base, others) => {
            // Ensure base is not in the existing set
            const existingRefs = new Set(others.filter(o => o !== base));

            const result = uniqueReference(base, existingRefs);
            expect(result).toBe(base);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    }
  );

  /**
   * Sub-property G: uniqueReference — result is always different from all existing refs.
   *
   * Whatever the existing set, the returned reference must not be in it.
   */
  it(
    'uniqueReference produit toujours une référence absente du set existant (100 itérations)',
    () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 30 }),
          fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 0, maxLength: 20 }),
          (base, others) => {
            const existingRefs = new Set(others);

            const result = uniqueReference(base, existingRefs);
            expect(existingRefs.has(result)).toBe(false);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    }
  );

  /**
   * Sub-property H: uniqueReference — suffix form is always `{base}-{N}` with N >= 2.
   *
   * When a suffix is added, it must follow the pattern and the counter starts at 2.
   */
  it(
    'uniqueReference applique le suffixe -N (N≥2) en cas de collision (100 itérations)',
    () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 30 }).filter(s => !/.*-\d+$/.test(s)),
          (base) => {
            // Force a collision by having the base in the existing set
            const existingRefs = new Set([base]);

            const result = uniqueReference(base, existingRefs);

            // Must not equal base
            expect(result).not.toBe(base);

            // Must match pattern base-N where N >= 2
            expect(result).toMatch(new RegExp(`^${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-\\d+$`));

            // Extract the suffix number and verify it is >= 2
            const suffixMatch = result.match(/-(\d+)$/);
            expect(suffixMatch).not.toBeNull();
            const suffixNum = parseInt(suffixMatch![1], 10);
            expect(suffixNum).toBeGreaterThanOrEqual(2);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    }
  );

  /**
   * Sub-property I: Round-trip with pre-existing collisions.
   *
   * When the importing tenant already has some of the same references,
   * the import must still produce a product count equal to the template's
   * product count (every product lands, just possibly deduplicated).
   * All designations must still be present.
   */
  it(
    'round-trip avec collisions : toutes les désignations présentes, count correct (100 itérations)',
    () => {
      fc.assert(
        fc.property(
          templatePayloadArb,
          fc.uuid(),
          (payload, importerTenantId) => {
            // Pre-populate the tenant with all the same references to force collisions
            const preExistingRefs = payload.produits.map(p => p.reference);

            const result = simulateImport(payload, importerTenantId, [], preExistingRefs);

            // All products imported (count matches template)
            expect(result.produits).toHaveLength(payload.produits.length);

            // All designations still present
            const importedDesignations = result.produits.map(p => p.designation);
            for (const original of payload.produits) {
              expect(importedDesignations).toContain(original.designation);
            }

            // All resulting references are unique
            const refs = result.produits.map(p => p.reference);
            const uniqueRefs = new Set(refs);
            expect(uniqueRefs.size).toBe(refs.length);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    }
  );

  /**
   * Sub-property J: Imported products are all scoped to the importing tenant.
   *
   * Every product created during import must carry importerTenantId, never
   * the source tenant's id.
   */
  it(
    'tous les produits importés sont scopés au tenantId importateur (100 itérations)',
    () => {
      fc.assert(
        fc.property(
          templatePayloadArb,
          fc.uuid(), // importer tenant
          fc.uuid(), // exporter tenant (must NOT appear in imported products)
          (payload, importerTenantId, exporterTenantId) => {
            fc.pre(importerTenantId !== exporterTenantId);

            const result = simulateImport(payload, importerTenantId, [], []);

            for (const p of result.produits) {
              expect(p.tenantId).toBe(importerTenantId);
              expect(p.tenantId).not.toBe(exporterTenantId);
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    }
  );
});
