// Feature: gestion-multitenant, Property 9: Round-trip de TenantConfig

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { parseTenantConfig, serializeTenantConfig } from '../tenant';
import type { TenantConfig } from '../tenant';

/**
 * Validates: Requirements 17.4, 17.1, 17.3
 *
 * Property 9: Round-trip de TenantConfig
 *
 * For any valid TenantConfig object:
 *   parseTenantConfig(serializeTenantConfig(config)) ≅ config
 *
 * That is, every property of the deserialized result must be equivalent
 * to the corresponding property of the original config.
 */

// ── Generators ────────────────────────────────────────────────────────────────

/** Generates a non-empty string (printable ASCII without control chars) */
const nonEmptyString = fc.string({ minLength: 1, maxLength: 100 }).filter(
  (s) => s.trim().length > 0
);

/** Generates a valid ISO 8601 date string */
const isoDateString = fc
  .integer({ min: new Date('2020-01-01').getTime(), max: new Date('2030-12-31').getTime() })
  .map((ms) => new Date(ms).toISOString());

/** Generates a valid nullable ISO 8601 date string */
const nullableIsoDate = fc.option(isoDateString, { nil: null });

/** Generates a nullable non-empty string */
const nullableString = fc.option(nonEmptyString, { nil: null });

/** Generates a valid TenantConfig with all required fields */
const tenantConfigArb: fc.Arbitrary<TenantConfig> = fc.record<TenantConfig>({
  id:                 nonEmptyString,
  nom:                nonEmptyString,
  slug:               nonEmptyString,
  domaine:            nullableString,
  plan:               fc.constantFrom('starter' as const, 'pro' as const, 'enterprise' as const),
  statut:             fc.constantFrom('actif' as const, 'suspendu' as const, 'essai' as const),
  dateEssaiFin:       nullableIsoDate,
  logoUrl:            nullableString,
  devise:             nonEmptyString,
  pays:               nullableString,
  telephone:          nullableString,
  email:              nonEmptyString,
  adresse:            nullableString,
  enMaintenance:      fc.boolean(),
  messageMaintenance: nullableString,
  createdAt:          isoDateString,
  updatedAt:          isoDateString,
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('tenant — Property 9: Round-trip de TenantConfig (Req 17.4, 17.1, 17.3)', () => {

  it('parseTenantConfig(serializeTenantConfig(config)) produit un objet équivalent (100 itérations)', () => {
    fc.assert(
      fc.property(tenantConfigArb, (config) => {
        const serialized = serializeTenantConfig(config);
        const roundTripped = parseTenantConfig(JSON.parse(serialized));

        // Every property must be equivalent to the original
        expect(roundTripped.id).toBe(config.id);
        expect(roundTripped.nom).toBe(config.nom);
        expect(roundTripped.slug).toBe(config.slug);
        expect(roundTripped.domaine).toBe(config.domaine);
        expect(roundTripped.plan).toBe(config.plan);
        expect(roundTripped.statut).toBe(config.statut);
        expect(roundTripped.dateEssaiFin).toBe(config.dateEssaiFin);
        expect(roundTripped.logoUrl).toBe(config.logoUrl);
        expect(roundTripped.devise).toBe(config.devise);
        expect(roundTripped.pays).toBe(config.pays);
        expect(roundTripped.telephone).toBe(config.telephone);
        expect(roundTripped.email).toBe(config.email);
        expect(roundTripped.adresse).toBe(config.adresse);
        expect(roundTripped.enMaintenance).toBe(config.enMaintenance);
        expect(roundTripped.messageMaintenance).toBe(config.messageMaintenance);
        expect(roundTripped.createdAt).toBe(config.createdAt);
        expect(roundTripped.updatedAt).toBe(config.updatedAt);

        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('serializeTenantConfig produit un JSON valide (100 itérations)', () => {
    fc.assert(
      fc.property(tenantConfigArb, (config) => {
        const serialized = serializeTenantConfig(config);

        // Must be a valid JSON string
        expect(typeof serialized).toBe('string');
        expect(() => JSON.parse(serialized)).not.toThrow();

        const parsed = JSON.parse(serialized);
        expect(parsed).toBeTypeOf('object');

        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('parseTenantConfig lève une erreur sur un objet invalide (100 itérations)', () => {
    // Generate configs missing required fields
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant(null),
          fc.constant(undefined),
          fc.constant('chaîne invalide'),
          fc.constant(42),
          fc.constant([]),
          // Object missing required fields
          fc.record({ id: fc.constant('') }),  // empty id
          fc.record({ plan: fc.constant('invalid-plan') }),
          fc.record({ statut: fc.constant('invalid-statut') }),
        ),
        (invalid) => {
          expect(() => parseTenantConfig(invalid)).toThrow();
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('double round-trip produit un résultat stable (100 itérations)', () => {
    fc.assert(
      fc.property(tenantConfigArb, (config) => {
        // First round-trip
        const once = parseTenantConfig(JSON.parse(serializeTenantConfig(config)));
        // Second round-trip on the already-parsed result
        const twice = parseTenantConfig(JSON.parse(serializeTenantConfig(once)));

        // Both round-trips must produce identical results
        expect(twice).toEqual(once);

        return true;
      }),
      { numRuns: 100 }
    );
  });

});
