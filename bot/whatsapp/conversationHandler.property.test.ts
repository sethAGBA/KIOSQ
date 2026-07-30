// Feature: whatsapp-commandes-bot, Property 5: Invariant du panier — cohérence des totaux
// Feature: whatsapp-commandes-bot, Property 6: Session effacée après confirmation de commande
// Feature: whatsapp-commandes-bot, Property 7: Isolation commande — ownership check

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  computePanierTotaux,
  clearSessionAfterOrder,
  checkCommandeOwnership,
} from './conversationHandler';
import type { LignePanier, Session, SessionStep } from './types';

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/** Arbitrary for a single cart line item */
const arbLignePanier = fc.record({
  produitId: fc.string(),
  designation: fc.string(),
  // fc.float min/max must be 32-bit floats (fast-check v4 requirement)
  prixUnitaire: fc.float({ min: Math.fround(0.01), max: Math.fround(999999), noNaN: true }),
  quantite: fc.integer({ min: 1, max: 1000 }),
  totalLigne: fc.float({ min: Math.fround(0), noNaN: true }), // not checked by computePanierTotaux
});

/** Arbitrary for a non-empty cart */
const arbNonEmptyPanier = fc.array(arbLignePanier, { minLength: 1 });

/** Arbitrary for any valid SessionStep */
const arbSessionStep: fc.Arbitrary<SessionStep> = fc.constantFrom(
  'ACCUEIL',
  'IDENTIFICATION',
  'MENU_PRINCIPAL',
  'CATALOGUE',
  'PANIER',
  'CONFIRMATION',
  'SUIVI',
);

/** Arbitrary for a Session that has a non-empty panier */
const arbSessionWithPanier: fc.Arbitrary<Session> = fc.record({
  phone: fc.string({ minLength: 1, maxLength: 20 }),
  clientId: fc.option(fc.string({ minLength: 1 }), { nil: null }),
  clientNom: fc.option(fc.string({ minLength: 1 }), { nil: null }),
  step: arbSessionStep,
  panier: arbNonEmptyPanier,
  tvaRate: fc.float({ min: Math.fround(0), max: Math.fround(100), noNaN: true }),
  devise: fc.string({ minLength: 1, maxLength: 8 }),
  lastActivity: fc.integer({ min: 0 }),
  pendingNomCapture: fc.boolean(),
});

// ─── Property 5 : Invariant du panier — cohérence des totaux ─────────────────

/**
 * Validates: Requirements 4.1, 4.2, 5.1, 5.6
 *
 * Property 5: Invariant du panier — cohérence des totaux
 *
 * For any list of cart lines and any TVA rate in [0, 100]:
 *   totalHT  === Σ(ligne.prixUnitaire * ligne.quantite)
 *   |totalTTC - totalHT * (1 + tvaRate / 100)| < 0.01
 */
describe('conversationHandler — Property 5: invariant panier cohérence des totaux (Req 4.1, 4.2, 5.1, 5.6)', () => {
  it(
    'Property 5 — totalHT et totalTTC sont toujours cohérents avec les lignes du panier (100 itérations)',
    () => {
      fc.assert(
        fc.property(
          fc.array(arbLignePanier),
          fc.float({ min: Math.fround(0), max: Math.fround(100), noNaN: true }),
          (lignes, tvaRate) => {
            const { totalHT, totalTTC } = computePanierTotaux(
              lignes as LignePanier[],
              tvaRate,
            );

            const expectedHT = lignes.reduce(
              (sum, l) => sum + l.prixUnitaire * l.quantite,
              0,
            );

            // totalHT must equal Σ(prixUnitaire * quantite)
            expect(Math.abs(totalHT - expectedHT)).toBeLessThan(0.01);

            // totalTTC must equal totalHT * (1 + tvaRate / 100)
            const expectedTTC = expectedHT * (1 + tvaRate / 100);
            expect(Math.abs(totalTTC - expectedTTC)).toBeLessThan(0.01);
          },
        ),
        { numRuns: 100 },
      );
    },
  );

  it('Property 5 — panier vide produit totalHT=0 et totalTTC=0 quelle que soit la TVA', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 100, noNaN: true }),
        (tvaRate) => {
          const { totalHT, totalTTC } = computePanierTotaux([], tvaRate);
          expect(totalHT).toBe(0);
          expect(totalTTC).toBe(0);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─── Property 6 : Session effacée après confirmation de commande ──────────────

/**
 * Validates: Requirements 5.3
 *
 * Property 6: Session effacée après confirmation de commande
 *
 * For any session with a non-empty panier, after clearSessionAfterOrder():
 *   updated.panier.length === 0
 *   updated.step === 'MENU_PRINCIPAL'
 *
 * All other session fields must remain unchanged (non-mutation guarantee).
 */
describe('conversationHandler — Property 6: session effacée après confirmation (Req 5.3)', () => {
  it(
    'Property 6 — le panier est vidé et le step revient à MENU_PRINCIPAL (100 itérations)',
    () => {
      fc.assert(
        fc.property(arbSessionWithPanier, (session) => {
          const updated = clearSessionAfterOrder(session);

          // Panier must be empty
          expect(updated.panier.length).toBe(0);

          // Step must be reset to MENU_PRINCIPAL
          expect(updated.step).toBe('MENU_PRINCIPAL');
        }),
        { numRuns: 100 },
      );
    },
  );

  it(
    'Property 6 — les autres champs de la session restent inchangés (100 itérations)',
    () => {
      fc.assert(
        fc.property(arbSessionWithPanier, (session) => {
          const updated = clearSessionAfterOrder(session);

          // Identity fields must not be mutated
          expect(updated.phone).toBe(session.phone);
          expect(updated.clientId).toBe(session.clientId);
          expect(updated.clientNom).toBe(session.clientNom);
          expect(updated.tvaRate).toBe(session.tvaRate);
          expect(updated.devise).toBe(session.devise);
          expect(updated.lastActivity).toBe(session.lastActivity);
          expect(updated.pendingNomCapture).toBe(session.pendingNomCapture);
        }),
        { numRuns: 100 },
      );
    },
  );

  it(
    'Property 6 — la session originale n\'est pas mutée (100 itérations)',
    () => {
      fc.assert(
        fc.property(arbSessionWithPanier, (session) => {
          const originalPanierLength = session.panier.length;
          const originalStep = session.step;

          clearSessionAfterOrder(session);

          // Original session must be untouched
          expect(session.panier.length).toBe(originalPanierLength);
          expect(session.step).toBe(originalStep);
        }),
        { numRuns: 100 },
      );
    },
  );
});

// ─── Property 7 : Isolation commande — ownership check ───────────────────────

/**
 * Validates: Requirements 6.1, 6.4
 *
 * Property 7: Isolation commande — ownership check
 *
 * For any commande.clientId and sessionClientId:
 *   checkCommandeOwnership(commande, sessionClientId) ⟺ commande.clientId === sessionClientId
 *
 * This is a strict biconditional: the function returns true if and only if the IDs
 * are strictly equal.  No commande belonging to another client may be accessible.
 */
describe('conversationHandler — Property 7: isolation commande ownership check (Req 6.1, 6.4)', () => {
  /** Arbitrary for clientId — string or null */
  const arbClientId = fc.option(fc.string(), { nil: null });

  it(
    'Property 7 — biconditional : ownership ⟺ commande.clientId === sessionClientId (100 itérations)',
    () => {
      fc.assert(
        fc.property(
          arbClientId,
          arbClientId,
          (commandeClientId, sessionClientId) => {
            const commande = { clientId: commandeClientId };
            const result = checkCommandeOwnership(commande, sessionClientId);
            const expected = commandeClientId === sessionClientId;

            expect(result).toBe(expected);
          },
        ),
        { numRuns: 100 },
      );
    },
  );

  it(
    'Property 7 — un client ne peut jamais accéder à la commande d\'un autre (100 itérations)',
    () => {
      fc.assert(
        fc.property(
          // Two distinct non-null strings
          fc.string({ minLength: 1 }),
          fc.string({ minLength: 1 }),
          (idA, idB) => {
            fc.pre(idA !== idB);

            const commande = { clientId: idA };
            // A different client must not have access
            expect(checkCommandeOwnership(commande, idB)).toBe(false);
          },
        ),
        { numRuns: 100 },
      );
    },
  );

  it(
    'Property 7 — un client accède toujours à sa propre commande (100 itérations)',
    () => {
      fc.assert(
        fc.property(
          arbClientId,
          (clientId) => {
            const commande = { clientId };
            // Owner always has access
            expect(checkCommandeOwnership(commande, clientId)).toBe(true);
          },
        ),
        { numRuns: 100 },
      );
    },
  );
});
