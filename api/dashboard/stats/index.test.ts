import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { buildCaParMois, type MonthEntry } from './index';

// ── Unit tests ────────────────────────────────────────────

describe('buildCaParMois — unit tests', () => {
  it('returns exactly 12 entries for an empty input', () => {
    const result = buildCaParMois([], new Date('2024-06-15'));
    expect(result).toHaveLength(12);
  });

  it('every entry has valeur=0 and commandes=0 when input is empty', () => {
    const result = buildCaParMois([], new Date('2024-06-15'));
    for (const entry of result) {
      expect(entry.valeur).toBe(0);
      expect(entry.commandes).toBe(0);
    }
  });

  it('last entry corresponds to the current month', () => {
    const now = new Date('2024-06-15');
    const result = buildCaParMois([], now);
    expect(result[11].label).toBe('Jun');
  });

  it('first entry corresponds to 11 months ago', () => {
    const now = new Date('2024-06-15');
    const result = buildCaParMois([], now);
    // 11 months before June 2024 = July 2023
    expect(result[0].label).toBe('Jul');
  });

  it('aggregates a single paid facture in the correct month', () => {
    const now = new Date('2024-06-15');
    const rows = [{ totalTTC: '1500', dateFacture: new Date('2024-06-03') }];
    const result = buildCaParMois(rows, now);
    const june = result[11]; // last entry = current month
    expect(june.valeur).toBe(1500);
    expect(june.commandes).toBe(1);
  });

  it('sums multiple factures in the same month', () => {
    const now = new Date('2024-06-15');
    const rows = [
      { totalTTC: '1000', dateFacture: new Date('2024-06-01') },
      { totalTTC: '500.50', dateFacture: new Date('2024-06-20') },
    ];
    const result = buildCaParMois(rows, now);
    expect(result[11].valeur).toBeCloseTo(1500.5);
    expect(result[11].commandes).toBe(2);
  });

  it('ignores factures with null dateFacture', () => {
    const now = new Date('2024-06-15');
    const rows = [{ totalTTC: '999', dateFacture: null }];
    const result = buildCaParMois(rows, now);
    expect(result.every(e => e.valeur === 0)).toBe(true);
  });

  it('labels use short French month names', () => {
    const MOIS_FR = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
    const now = new Date('2024-12-31');
    const result = buildCaParMois([], now);
    // The last entry should be Déc (month index 11)
    expect(result[11].label).toBe('Déc');
    // All labels must be in the known set
    for (const entry of result) {
      expect(MOIS_FR).toContain(entry.label);
    }
  });

  it('does not count entries outside the 12-month window', () => {
    const now = new Date('2024-06-15');
    // Facture from 13 months ago — should NOT appear
    const rows = [{ totalTTC: '9999', dateFacture: new Date('2023-05-10') }];
    const result = buildCaParMois(rows, now);
    expect(result.every(e => e.valeur === 0)).toBe(true);
  });

  it('handles numeric totalTTC values (not just strings)', () => {
    const now = new Date('2024-06-15');
    const rows = [{ totalTTC: 750 as unknown as string, dateFacture: new Date('2024-06-05') }];
    const result = buildCaParMois(rows, now);
    expect(result[11].valeur).toBe(750);
  });
});

// ── Property-based test — Property 5 ─────────────────────
// **Validates: Requirements 2.2, 2.3**

describe('buildCaParMois — PBT Property 5: caParMois always has 12 entries with non-negative values', () => {
  it('caParMois always has exactly 12 entries with non-negative values and string labels', () => {
    const rowsArb = fc.array(
      fc.record({
        totalTTC: fc
          .float({ min: 0, max: 10_000_000, noNaN: true })
          .map(v => String(Math.round(v * 100) / 100)),
        dateFacture: fc.oneof(
          fc.date({ min: new Date('2020-01-01'), max: new Date('2026-12-31') }),
          fc.constant(null),
        ),
      }),
      { maxLength: 200 },
    );
    const nowArb = fc.date({ min: new Date('2022-01-01'), max: new Date('2026-12-31') });

    fc.assert(
      fc.property(rowsArb, nowArb, (rows, now) => {
        const result = buildCaParMois(rows, now);

        // Always 12 entries
        expect(result).toHaveLength(12);

        for (const entry of result) {
          // valeur >= 0
          expect(entry.valeur).toBeGreaterThanOrEqual(0);
          // commandes >= 0
          expect(entry.commandes).toBeGreaterThanOrEqual(0);
          // label is a non-empty string
          expect(typeof entry.label).toBe('string');
          expect(entry.label.length).toBeGreaterThan(0);
          // commandes is an integer
          expect(Number.isInteger(entry.commandes)).toBe(true);
        }
      }),
      { numRuns: 200 },
    );
  });
});
