// Feature: whatsapp-bot-deployment, Property 5: normalizePhone — digits-only & idempotent

import { describe, it } from 'vitest';
import fc from 'fast-check';
import { normalizePhone } from './phone';

/**
 * Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.5
 *
 * Property 5: normalizePhone pureté et idempotence
 *
 * 5a — Pour toute chaîne arbitraire s :
 *       normalizePhone(s) ne contient que des chiffres (0-9)
 *
 * 5b — Pour toute chaîne arbitraire s :
 *       normalizePhone(normalizePhone(s)) === normalizePhone(s)  (idempotence)
 */

describe('phone — Property 5: normalizePhone digits-only & idempotent (Req 10.1–10.5)', () => {
  // ---------------------------------------------------------------------------
  // Property 5a — le résultat ne contient que des chiffres
  // ---------------------------------------------------------------------------
  it('Property 5a — normalizePhone produit uniquement des chiffres pour toute entrée (100 itérations)', () => {
    fc.assert(
      fc.property(
        fc.string(),
        (s) => {
          const result = normalizePhone(s);
          return /^[0-9]*$/.test(result);
        },
      ),
      { numRuns: 100 },
    );
  });

  // ---------------------------------------------------------------------------
  // Property 5b — idempotence : appliquer deux fois == appliquer une fois
  // ---------------------------------------------------------------------------
  it('Property 5b — normalizePhone est idempotente pour toute entrée (100 itérations)', () => {
    fc.assert(
      fc.property(
        fc.string(),
        (s) => {
          return normalizePhone(normalizePhone(s)) === normalizePhone(s);
        },
      ),
      { numRuns: 100 },
    );
  });
});
