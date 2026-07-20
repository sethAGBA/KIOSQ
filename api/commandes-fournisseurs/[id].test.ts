import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { computePaiement } from './[id]';

// ── Unit tests — computePaiement ──────────────────────────────────────────────

describe('computePaiement — unit tests', () => {
  it('calculates correct values for a partial payment', () => {
    const result = computePaiement(1000, 0, 400);
    expect(result.montantPaye).toBe(400);
    expect(result.resteAPayer).toBe(600);
    expect(result.statutPaiement).toBe('partiel');
  });

  it('marks as "paye" when full amount is paid', () => {
    const result = computePaiement(500, 200, 300);
    expect(result.montantPaye).toBe(500);
    expect(result.resteAPayer).toBe(0);
    expect(result.statutPaiement).toBe('paye');
  });

  it('marks as "en_attente" when montantPayeActuel is 0 and first payment zeros out nothing', () => {
    // Edge case: totalTTC=100, montantPayeActuel=0, payment=0 (invalid per PaiementSchema,
    // but computePaiement itself is a pure function that shouldn't validate positive)
    const result = computePaiement(100, 0, 0);
    expect(result.montantPaye).toBe(0);
    expect(result.resteAPayer).toBe(100);
    expect(result.statutPaiement).toBe('en_attente');
  });

  it('throws when payment causes overpayment (req 5.4)', () => {
    expect(() => computePaiement(100, 80, 30)).toThrowError('Montant dépasse le total dû');
  });

  it('throws when montantPayeActuel already equals totalTTC and new payment arrives', () => {
    expect(() => computePaiement(500, 500, 1)).toThrowError('Montant dépasse le total dû');
  });

  it('does not throw when payment exactly fills the remaining balance', () => {
    const result = computePaiement(250, 100, 150);
    expect(result.montantPaye).toBe(250);
    expect(result.resteAPayer).toBe(0);
    expect(result.statutPaiement).toBe('paye');
  });

  it('handles float amounts without precision issues via rounded comparison', () => {
    const result = computePaiement(100, 33.33, 33.33);
    expect(result.montantPaye).toBeCloseTo(66.66, 5);
    expect(result.resteAPayer).toBeCloseTo(33.34, 5);
    expect(result.statutPaiement).toBe('partiel');
  });
});

// ── Property-based tests — computePaiement ────────────────────────────────────

/**
 * Validates: Requirements 5.3, 5.4
 * Property 2 — Invariant financier des paiements CF
 *
 * For any commande fournisseur with a given totalTTC and any valid payment
 * (>0 and such that montantPaye + montant <= totalTTC):
 *   montantPaye_new + resteAPayer_new === totalTTC
 *   montantPaye_new === montantPayeActuel + nouveauMontant
 */
describe('computePaiement — Property 2: payment financial invariant (Req 5.3)', () => {
  // Generator for totalTTC: realistic order amounts between 1 and 1,000,000
  const totalTTCArb = fc
    .integer({ min: 1, max: 100_000_000 })
    .map(v => v / 100); // gives 2-decimal precision amounts

  it('montantPaye + resteAPayer === totalTTC for any valid payment', () => {
    fc.assert(
      fc.property(
        totalTTCArb,
        totalTTCArb, // used as montantPayeActuel (clamped to totalTTC below)
        totalTTCArb, // used as nouveauMontant (clamped below)
        (totalTTC, rawMontantPaye, rawNouveau) => {
          // Clamp montantPayeActuel to [0, totalTTC)
          const montantPayeActuel = Math.min(rawMontantPaye, totalTTC * 0.99);
          const remaining = totalTTC - montantPayeActuel;
          // Clamp nouveauMontant to (0, remaining]
          const nouveauMontant = Math.min(Math.max(rawNouveau, 0.01), remaining);

          const result = computePaiement(totalTTC, montantPayeActuel, nouveauMontant);

          // Core invariant: sum must equal totalTTC (within floating point tolerance)
          expect(result.montantPaye + result.resteAPayer).toBeCloseTo(totalTTC, 5);
          // montantPaye must equal old + new
          expect(result.montantPaye).toBeCloseTo(montantPayeActuel + nouveauMontant, 5);
          // resteAPayer is never negative
          expect(result.resteAPayer).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('always throws for overpayment', () => {
    fc.assert(
      fc.property(
        totalTTCArb,
        // montantPayeActuel in [0, totalTTC]
        fc.float({ min: 0, max: 1, noNaN: true }),
        // excess is a small positive amount that causes overpayment
        fc.float({ min: 0.01, max: 1000, noNaN: true }),
        (totalTTC, fraction, excess) => {
          const montantPayeActuel = totalTTC * fraction;
          const remaining = totalTTC - montantPayeActuel;
          const overpayment = remaining + excess;

          expect(() =>
            computePaiement(totalTTC, montantPayeActuel, overpayment)
          ).toThrowError('Montant dépasse le total dû');
        }
      ),
      { numRuns: 200 }
    );
  });

  it('statutPaiement is "paye" iff resteAPayer === 0', () => {
    fc.assert(
      fc.property(
        totalTTCArb,
        fc.float({ min: 0, max: 1, noNaN: true }),
        (totalTTC, fraction) => {
          // Ensure we cover the exact full-payment case
          const montantPayeActuel = 0;
          const nouveauMontant = totalTTC * fraction;
          fc.pre(nouveauMontant <= totalTTC);

          const result = computePaiement(totalTTC, montantPayeActuel, nouveauMontant);
          if (result.resteAPayer === 0) {
            expect(result.statutPaiement).toBe('paye');
          } else if (result.montantPaye > 0) {
            expect(result.statutPaiement).toBe('partiel');
          } else {
            expect(result.statutPaiement).toBe('en_attente');
          }
        }
      ),
      { numRuns: 200 }
    );
  });
});
