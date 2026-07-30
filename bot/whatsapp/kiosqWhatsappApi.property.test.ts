// Feature: whatsapp-commandes-bot, Property 3: Filtrage catalogue — tous les produits retournés sont éligibles
// Feature: whatsapp-commandes-bot, Property 4: Pagination catalogue — max 10 produits par message

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { filterCatalogue, chunkCatalogue } from './kiosqWhatsappApi';
import type { ProduitDisponible } from './types';

/**
 * Validates: Requirements 3.1, 3.3
 *
 * Property 3: Filtrage catalogue — tous les produits retournés sont éligibles
 *
 * For any array of products (mix of active/inactive, various stock levels, optional
 * categorieId), filterCatalogue() must return only products satisfying:
 *   actif === true && stockActuel > 0
 * When a categorieId filter is provided, all returned products must also match it.
 */

/**
 * Validates: Requirements 3.2
 *
 * Property 4: Pagination catalogue — max 10 produits par message
 *
 * For any array of products of arbitrary size N, chunkCatalogue() must produce
 * chunks where:
 *   - every chunk has at most 10 items
 *   - concatenating all chunks reconstructs the original array (same length)
 */

// Arbitrary for a minimal product record (only fields checked by filterCatalogue)
const arbProduit = fc.record({
  id: fc.string(),
  designation: fc.string(),
  prixVente: fc.float({ min: 0, noNaN: true }),
  stockActuel: fc.integer({ min: 0, max: 100 }),
  categorieId: fc.option(fc.string(), { nil: null }),
  unite: fc.string(),
  actif: fc.boolean(),
});

describe('kiosqWhatsappApi — Property 3: filtrage catalogue (Req 3.1, 3.3)', () => {
  it(
    'Property 3a — sans filtre catégorie : seuls les produits actifs et en stock sont retournés (100 itérations)',
    () => {
      fc.assert(
        fc.property(fc.array(arbProduit), (produits) => {
          const result = filterCatalogue(produits as ProduitDisponible[]);

          for (const p of result) {
            expect(p.actif).toBe(true);
            expect(p.stockActuel).toBeGreaterThan(0);
          }
        }),
        { numRuns: 100 },
      );
    },
  );

  it(
    'Property 3b — avec filtre categorieId : tous les résultats ont le bon categorieId (100 itérations)',
    () => {
      fc.assert(
        fc.property(
          fc.array(arbProduit),
          fc.string({ minLength: 1 }),
          (produits, categorieId) => {
            const result = filterCatalogue(produits as ProduitDisponible[], categorieId);

            for (const p of result) {
              expect(p.actif).toBe(true);
              expect(p.stockActuel).toBeGreaterThan(0);
              expect(p.categorieId).toBe(categorieId);
            }
          },
        ),
        { numRuns: 100 },
      );
    },
  );

  it(
    'Property 3c — aucun produit inactif ou hors stock ne figure dans le résultat (100 itérations)',
    () => {
      fc.assert(
        fc.property(fc.array(arbProduit), (produits) => {
          const result = filterCatalogue(produits as ProduitDisponible[]);
          const ineligible = produits.filter(
            (p) => !p.actif || p.stockActuel <= 0,
          );
          for (const p of ineligible) {
            expect(result).not.toContain(p);
          }
        }),
        { numRuns: 100 },
      );
    },
  );
});

describe('kiosqWhatsappApi — Property 4: pagination catalogue (Req 3.2)', () => {
  it(
    'Property 4a — chaque lot contient au maximum 10 éléments (100 itérations)',
    () => {
      fc.assert(
        fc.property(fc.array(fc.anything(), { maxLength: 500 }), (input) => {
          const lots = chunkCatalogue(input as unknown[]);

          for (const lot of lots) {
            expect(lot.length).toBeLessThanOrEqual(10);
          }
        }),
        { numRuns: 100 },
      );
    },
  );

  it(
    'Property 4b — la concaténation de tous les lots reconstitue la liste originale (100 itérations)',
    () => {
      fc.assert(
        fc.property(fc.array(fc.anything(), { maxLength: 500 }), (input) => {
          const lots = chunkCatalogue(input as unknown[]);

          expect(lots.flat().length).toBe(input.length);
        }),
        { numRuns: 100 },
      );
    },
  );

  it(
    'Property 4c — lots et longueur combinées : chaque lot <= 10 et concat = original (100 itérations)',
    () => {
      fc.assert(
        fc.property(fc.array(fc.anything(), { maxLength: 500 }), (input) => {
          const lots = chunkCatalogue(input as unknown[]);

          const allChunksSmallEnough = lots.every((lot) => lot.length <= 10);
          const totalLength = lots.flat().length === input.length;

          return allChunksSmallEnough && totalLength;
        }),
        { numRuns: 100 },
      );
    },
  );
});
