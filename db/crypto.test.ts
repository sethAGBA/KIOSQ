import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { encrypt, decrypt } from './crypto.js';

const TEST_KEY = '0'.repeat(64); // 32 zero-bytes as hex

/**
 * Validates: Requirements 13.1, 13.2
 * Feature: leads-capture-module
 * Property 1: Round-trip du chiffrement symétrique
 */
describe('db/crypto — Feature: leads-capture-module', () => {
  // Property 1: Round-trip du chiffrement symétrique
  it('Property 1: decrypt(encrypt(plaintext, key), key) === plaintext for any string', () => {
    fc.assert(
      fc.property(fc.string(), (plaintext) => {
        return decrypt(encrypt(plaintext, TEST_KEY), TEST_KEY) === plaintext;
      }),
      { numRuns: 100 }
    );
  });

  it('throws on invalid ciphertext format (not 3 parts)', () => {
    expect(() => decrypt('invalid', TEST_KEY)).toThrow('Format de ciphertext invalide');
  });

  it('throws on corrupted ciphertext (modified authTag)', () => {
    const ciphertext = encrypt('hello world', TEST_KEY);
    const parts = ciphertext.split(':');
    // Corrupt the authTag (second part)
    parts[1] = 'a'.repeat(32);
    expect(() => decrypt(parts.join(':'), TEST_KEY)).toThrow();
  });

  it('throws when key length is incorrect', () => {
    expect(() => encrypt('hello', 'tooshort')).toThrow();
  });

  it('produces different ciphertexts for same plaintext (random IV)', () => {
    const c1 = encrypt('same', TEST_KEY);
    const c2 = encrypt('same', TEST_KEY);
    expect(c1).not.toBe(c2); // different IVs
  });
});
