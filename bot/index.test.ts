import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';
import { shouldCreateLead } from './index.js';
import { creerLead, AuthError, kiosqRequest } from './kiosqApi.js';

/**
 * Validates: Requirements 12.3, 12.4, 11.3, 11.4
 * Feature: leads-capture-module
 * Property 7: Seuil de score du bot
 */
describe('bot — Feature: leads-capture-module', () => {
  beforeEach(() => {
    process.env.KIOSQ_API_URL = 'https://kiosq.test';
    process.env.BOT_JWT = 'test-jwt';
  });

  /**
   * Property 7: Seuil de score du bot
   */
  it('Property 7: shouldCreateLead(score, seuil) ⟺ score ≥ seuil', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 1, noNaN: true }),
        fc.float({ min: 0, max: 1, noNaN: true }),
        (score, seuil) => {
          return shouldCreateLead(score, seuil) === (score >= seuil);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('kiosqRequest: HTTP 401 → AuthError immédiat sans retry', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 401,
      ok: false,
      json: async () => ({ ok: false, error: 'Non authentifié' }),
    });

    await expect(
      kiosqRequest('/api/leads', { method: 'POST' }, fetchMock as unknown as typeof fetch),
    ).rejects.toBeInstanceOf(AuthError);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('creerLead: HTTP 500 → une retry après 5s puis poursuite', async () => {
    vi.useFakeTimers();

    let callCount = 0;
    const fetchMock = vi.fn().mockImplementation(async () => {
      callCount++;
      return {
        status: 500,
        ok: false,
        json: async () => ({ ok: false, error: 'Erreur serveur' }),
      };
    });

    const promise = creerLead(
      { groupeSurveilleId: 'g1', texteOriginal: 'test' },
      fetchMock as unknown as typeof fetch,
      5000,
    );

    await vi.advanceTimersByTimeAsync(5000);
    await promise;

    expect(callCount).toBe(2);
    vi.useRealTimers();
  });
});
