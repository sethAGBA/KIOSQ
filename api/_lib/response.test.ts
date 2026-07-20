import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { numericRow, numericRows } from './response';

// All fields that must be converted to numbers (Req. 6.1)
const NUMERIC_FIELDS = [
  'prixAchat', 'prixVente', 'prixVenteGros', 'stockActuel', 'stockMinimum',
  'soldeDette', 'totalAchats', 'totalHT', 'totalTTC', 'remiseGlobale', 'tva',
  'acompte', 'resteAPayer', 'montantPaye', 'soldeCredit', 'nombreCommandes',
  'fraisLivraison',
] as const;

// ── Unit tests ────────────────────────────────────────────────────────────────

describe('numericRow — unit tests', () => {
  it('converts all numeric fields from string to number', () => {
    const input: Record<string, unknown> = {};
    for (const f of NUMERIC_FIELDS) input[f] = '42.50';
    const result = numericRow(input);
    for (const f of NUMERIC_FIELDS) {
      expect(typeof result[f]).toBe('number');
      expect(result[f]).toBe(42.5);
    }
  });

  it('leaves non-numeric fields unchanged', () => {
    const input = {
      nom: 'Produit X',
      actif: true,
      createdAt: new Date('2024-01-01'),
      lignes: [{ qty: 2 }],
      prixVente: '100',
    };
    const result = numericRow(input);
    expect(result.nom).toBe('Produit X');
    expect(result.actif).toBe(true);
    expect(result.createdAt).toEqual(new Date('2024-01-01'));
    expect(result.lignes).toEqual([{ qty: 2 }]);
    expect(result.prixVente).toBe(100);
  });

  it('skips null values without throwing', () => {
    const input = { prixAchat: null, prixVente: '10' };
    const result = numericRow(input as Record<string, unknown>);
    expect(result.prixAchat).toBeNull();
    expect(result.prixVente).toBe(10);
  });

  it('skips undefined values without throwing', () => {
    const input = { prixVenteGros: undefined, totalTTC: '200' };
    const result = numericRow(input as Record<string, unknown>);
    expect(result.prixVenteGros).toBeUndefined();
    expect(result.totalTTC).toBe(200);
  });

  it('handles zero correctly', () => {
    const result = numericRow({ stockActuel: '0', stockMinimum: '0' });
    expect(result.stockActuel).toBe(0);
    expect(result.stockMinimum).toBe(0);
  });

  it('does not mutate the original object', () => {
    const input = { prixVente: '99.99', nom: 'test' };
    numericRow(input);
    expect(input.prixVente).toBe('99.99'); // unchanged
  });
});

describe('numericRows — unit tests', () => {
  it('applies numericRow to every element', () => {
    const rows = [
      { prixVente: '10', nom: 'A' },
      { prixVente: '20', nom: 'B' },
    ];
    const result = numericRows(rows);
    expect(result[0].prixVente).toBe(10);
    expect(result[1].prixVente).toBe(20);
    expect(result[0].nom).toBe('A');
    expect(result[1].nom).toBe('B');
  });

  it('handles an empty array', () => {
    expect(numericRows([])).toEqual([]);
  });
});

// ── Property-based tests ──────────────────────────────────────────────────────

/**
 * Validates: Requirements 6.1, 6.4
 * Property 1 — Conversion numérique complète
 *
 * For any object returned by numericRow() containing one of the listed numeric
 * fields as a numeric string, after applying numericRow(), each such field must
 * be of type `number`, and all other fields must remain unchanged (type and value).
 */
describe('numericRow — Property 1: complete numeric conversion (Req 6.1, 6.4)', () => {
  // Arbitrary for numeric string values (including negative, fractional, large)
  const numericString = fc.oneof(
    fc.float({ min: 0, max: 1e9, noNaN: true }).map(v => String(v)),
    fc.integer({ min: 0, max: 1_000_000 }).map(v => String(v)),
  );

  it('converts every listed numeric field from string to number', () => {
    // Build an arbitrary that has all numeric fields set to numeric strings
    const allNumericArb = fc.record(
      Object.fromEntries(NUMERIC_FIELDS.map(f => [f, numericString]))
    ) as fc.Arbitrary<Record<string, string>>;

    fc.assert(
      fc.property(allNumericArb, (row) => {
        const result = numericRow(row as Record<string, unknown>);
        for (const f of NUMERIC_FIELDS) {
          expect(typeof result[f]).toBe('number');
          expect(result[f]).toBe(Number(row[f]));
        }
      }),
      { numRuns: 100 }
    );
  });

  it('leaves non-listed fields unchanged', () => {
    // Mix of numeric fields (as strings) + non-numeric fields
    const mixedArb = fc.record({
      // A sampling of numeric fields
      prixAchat: numericString,
      totalTTC: numericString,
      resteAPayer: numericString,
      // Non-numeric fields — must stay untouched
      nom: fc.string(),
      actif: fc.boolean(),
      reference: fc.string(),
      notes: fc.option(fc.string(), { nil: null }),
    });

    fc.assert(
      fc.property(mixedArb, (row) => {
        const result = numericRow(row as Record<string, unknown>);
        // Numeric fields must be numbers
        expect(typeof result.prixAchat).toBe('number');
        expect(typeof result.totalTTC).toBe('number');
        expect(typeof result.resteAPayer).toBe('number');
        // Non-numeric fields must be unchanged
        expect(result.nom).toBe(row.nom);
        expect(result.actif).toBe(row.actif);
        expect(result.reference).toBe(row.reference);
        expect(result.notes).toBe(row.notes);
      }),
      { numRuns: 100 }
    );
  });

  it('does not touch fields absent from the row', () => {
    // Row with only one known numeric field + unknown extra fields
    const partialArb = fc.record({
      prixVente: numericString,
      // Arbitrary extra fields not in the numeric list
      someOtherField: fc.string(),
      count: fc.integer(),
    });

    fc.assert(
      fc.property(partialArb, (row) => {
        const result = numericRow(row as Record<string, unknown>);
        // Only prixVente should be converted
        expect(typeof result.prixVente).toBe('number');
        // Extra fields unchanged
        expect(result.someOtherField).toBe(row.someOtherField);
        expect(result.count).toBe(row.count);
        // Fields not present in input should not appear in output
        for (const f of NUMERIC_FIELDS) {
          if (!(f in row)) {
            expect(f in result).toBe(false);
          }
        }
      }),
      { numRuns: 100 }
    );
  });

  it('numericRows applies numericRow consistently to all elements', () => {
    const rowArb = fc.record({
      prixAchat: numericString,
      prixVente: numericString,
      nom: fc.string(),
    });
    const rowsArb = fc.array(rowArb, { minLength: 0, maxLength: 50 });

    fc.assert(
      fc.property(rowsArb, (rows) => {
        const result = numericRows(rows as Record<string, unknown>[]);
        expect(result).toHaveLength(rows.length);
        for (let i = 0; i < rows.length; i++) {
          expect(typeof result[i].prixAchat).toBe('number');
          expect(typeof result[i].prixVente).toBe('number');
          expect(result[i].nom).toBe(rows[i].nom);
        }
      }),
      { numRuns: 100 }
    );
  });
});
