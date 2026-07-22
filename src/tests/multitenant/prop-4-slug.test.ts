// Feature: gestion-multitenant, Property 4: Génération de slug URL-safe

import { describe, it } from 'vitest';
import fc from 'fast-check';
import { generateSlug } from '../../../api/superadmin/tenants/index.js';

/**
 * Validates: Requirements 2.3
 *
 * Property 4 — Génération de slug URL-safe
 *
 * For any non-empty shop name, `generateSlug(nom)` must produce a string that:
 *   - only contains [a-z0-9-]
 *   - starts with [a-z0-9]
 *   - ends with [a-z0-9]
 *   - has length >= 1
 */
describe('generateSlug — Property 4: URL-safe slug generation (Req 2.3)', () => {
  const VALID_CHARS_RE = /^[a-z0-9-]+$/;
  const STARTS_ALNUM_RE = /^[a-z0-9]/;
  const ENDS_ALNUM_RE = /[a-z0-9]$/;

  it('produces a valid URL-safe slug for any non-empty string', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        (nom) => {
          const slug = generateSlug(nom);

          // Must have length >= 1
          if (slug.length < 1) return false;
          // Must only contain [a-z0-9-]
          if (!VALID_CHARS_RE.test(slug)) return false;
          // Must start with alphanumeric
          if (!STARTS_ALNUM_RE.test(slug)) return false;
          // Must end with alphanumeric
          if (!ENDS_ALNUM_RE.test(slug)) return false;

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('produces a valid URL-safe slug for realistic non-empty shop names', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
        (nom) => {
          const slug = generateSlug(nom);

          // Must have length >= 1
          if (slug.length < 1) return false;
          // Must only contain [a-z0-9-]
          if (!VALID_CHARS_RE.test(slug)) return false;
          // Must start with alphanumeric
          if (!STARTS_ALNUM_RE.test(slug)) return false;
          // Must end with alphanumeric
          if (!ENDS_ALNUM_RE.test(slug)) return false;

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
