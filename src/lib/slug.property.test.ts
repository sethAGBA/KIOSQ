// Feature: gestion-multitenant, Property 4: Génération de slug URL-safe

import { describe, it } from 'vitest';
import fc from 'fast-check';
import { generateSlug } from './tenant';

/**
 * Validates: Requirements 2.3
 *
 * Property 4 : Génération de slug URL-safe
 *
 * For any arbitrary non-empty store name, `generateSlug(nom)` must produce a
 * string that:
 *   1. Contains only characters matching `[a-z0-9-]`
 *   2. Starts and ends with `[a-z0-9]` (no leading/trailing hyphens)
 *   3. Has a minimum length of 1
 *
 * Edge cases covered by fast-check generation:
 *   - Names with only special characters (e.g. "!!!---###")
 *   - Names with accented characters (é, à, ü, ñ, ç …)
 *   - Names with only spaces
 *   - Names containing only digits or only letters
 *   - Very long names (fast-check's default max string length)
 */

const URL_SAFE_PATTERN = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/;

describe("slug — Property 4: Génération de slug URL-safe (Req 2.3)", () => {

  /**
   * Sub-property A: output only contains [a-z0-9-]
   */
  it(
    'le slug ne contient que des caractères [a-z0-9-] (100 itérations)',
    () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }),
          (nom) => {
            const slug = generateSlug(nom);
            // Every character must be a-z, 0-9 or hyphen
            return /^[a-z0-9-]+$/.test(slug);
          }
        ),
        { numRuns: 100 }
      );
    }
  );

  /**
   * Sub-property B: output starts and ends with [a-z0-9] (no leading/trailing hyphens)
   */
  it(
    'le slug commence et se termine par [a-z0-9] — pas de tirets en début/fin (100 itérations)',
    () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }),
          (nom) => {
            const slug = generateSlug(nom);
            return URL_SAFE_PATTERN.test(slug);
          }
        ),
        { numRuns: 100 }
      );
    }
  );

  /**
   * Sub-property C: output length is at least 1
   */
  it(
    'le slug a une longueur minimale de 1 (100 itérations)',
    () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }),
          (nom) => {
            const slug = generateSlug(nom);
            return slug.length >= 1;
          }
        ),
        { numRuns: 100 }
      );
    }
  );

  /**
   * Sub-property D: combined — all three invariants hold simultaneously
   * This is the canonical formulation of Property 4.
   */
  it(
    'toutes les propriétés URL-safe satisfaites simultanément (100 itérations)',
    () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }),
          (nom) => {
            const slug = generateSlug(nom);

            // 1. Only [a-z0-9-] characters
            if (!/^[a-z0-9-]+$/.test(slug)) return false;

            // 2. Starts and ends with [a-z0-9]
            if (!URL_SAFE_PATTERN.test(slug)) return false;

            // 3. Minimum length 1
            if (slug.length < 1) return false;

            return true;
          }
        ),
        { numRuns: 100 }
      );
    }
  );

  /**
   * Sub-property E: names that consist entirely of special characters
   * must still produce a valid slug (fallback to 'boutique').
   *
   * We use a fixed set of strings that contain only non-alphanumeric characters
   * to exercise the fallback path rather than attempting to generate them via
   * fast-check (fc.char() is unavailable in this version).
   */
  it(
    'un nom composé uniquement de caractères spéciaux produit un slug valide (100 itérations)',
    () => {
      // Use a representative set of special-char-only strings as the input space
      const specialOnlyNames = [
        '!!!', '---', '###', '   ', '...', '@@@', '///\\\\\\',
        '!@#$%^&*()', '<<>>', '~~~~', '\t\n', ';;;', '---___---',
      ];

      fc.assert(
        fc.property(
          fc.constantFrom(...specialOnlyNames),
          (nom) => {
            const slug = generateSlug(nom);

            return (
              slug.length >= 1 &&
              /^[a-z0-9-]+$/.test(slug) &&
              URL_SAFE_PATTERN.test(slug)
            );
          }
        ),
        { numRuns: 100 }
      );
    }
  );
});
