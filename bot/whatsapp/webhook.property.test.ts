// Feature: whatsapp-commandes-bot, Property 1: hub.challenge round-trip
// Feature: whatsapp-commandes-bot, Property 2: robustesse aux payloads malformés

import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import { createHmac } from 'node:crypto';
import { handleVerification, handleWebhookPost } from './webhook';
import type { KiosqWhatsappApi, WhatsappClient } from './conversationHandler';
import type { SessionStore } from './sessionStore';
import { RateLimiter } from './security';

/**
 * Validates: Requirements 1.3
 *
 * Property 1: Vérification hub.challenge — round-trip
 *
 * For any string value of hub.challenge, handleVerification must return exactly
 * that value with HTTP 200 when hub_mode is "subscribe" and the token matches.
 */

/**
 * Validates: Requirements 1.4
 *
 * Property 2: Robustesse aux payloads malformés
 *
 * For any arbitrary raw body (bytes), handleWebhookPost must never throw an
 * exception — it always returns a response object (status 200 or 403).
 */

// ─── Minimal no-op mocks ──────────────────────────────────────────────────────

const noopSessionStore: SessionStore = {
  get: () => undefined,
  set: () => undefined,
  touch: () => undefined,
  delete: () => undefined,
  isExpired: () => false,
  sweep: () => undefined,
} as unknown as SessionStore;

const noopKiosqApi: KiosqWhatsappApi = {
  getProduits: async () => [],
  getClient: async () => null,
  createClient: async () => ({ id: 'x', nom: 'x', telephone: null, email: null, tenantId: 'x' }),
  createCommande: async () => ({ id: 'x', numero: 'x', statut: 'brouillon', totalTTC: 0, dateCommande: new Date().toISOString() }),
  getCommande: async () => ({ id: 'x', numero: 'x', statut: 'brouillon', totalTTC: 0, dateCommande: new Date().toISOString() }),
  getCommandesClient: async () => [],
  getParametres: async () => ({ tva: '18', devise: 'XOF' }),
};

const noopWhatsappClient: WhatsappClient = {
  sendTextMessage: async () => undefined,
};

/** Compute a valid HMAC-SHA256 signature header for the given body and secret. */
function signBody(body: Buffer, secret: string): string {
  const hex = createHmac('sha256', secret).update(body).digest('hex');
  return `sha256=${hex}`;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('webhook — Property 1: hub.challenge round-trip (Req 1.3)', () => {
  beforeEach(() => {
    process.env.WHATSAPP_VERIFY_TOKEN = 'test-token';
  });

  it('Property 1 — handleVerification retourne exactement hub.challenge (100 itérations)', () => {
    fc.assert(
      fc.property(
        fc.string(),
        (challenge) => {
          const result = handleVerification({
            hub_mode: 'subscribe',
            hub_challenge: challenge,
            hub_verify_token: 'test-token',
          });

          expect(result.status).toBe(200);
          expect(result.body).toBe(challenge);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('handleVerification retourne 403 si hub_verify_token incorrect', () => {
    const result = handleVerification({
      hub_mode: 'subscribe',
      hub_challenge: 'abc123',
      hub_verify_token: 'wrong-token',
    });
    expect(result.status).toBe(403);
  });

  it('handleVerification retourne 403 si hub_mode absent ou différent de subscribe', () => {
    const result = handleVerification({
      hub_mode: 'other',
      hub_challenge: 'abc123',
      hub_verify_token: 'test-token',
    });
    expect(result.status).toBe(403);
  });
});

describe('webhook — Property 2: robustesse aux payloads malformés (Req 1.4)', () => {
  beforeEach(() => {
    process.env.WHATSAPP_APP_SECRET = 'test-app-secret';
    process.env.WHATSAPP_VERIFY_TOKEN = 'test-token';
  });

  it('Property 2 — handleWebhookPost ne lève jamais d\'exception pour tout rawBody (100 itérations)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uint8Array({ minLength: 0, maxLength: 2048 }),
        async (bodyBytes) => {
          const rawBody = Buffer.from(bodyBytes);

          // The function should never throw — it always returns a response object
          let result: { status: number; body: string } | undefined;
          let threw = false;
          try {
            result = await handleWebhookPost(
              rawBody,
              undefined, // no signature → expect 403, not a throw
              noopSessionStore,
              new RateLimiter(),
              noopKiosqApi,
              noopWhatsappClient,
            );
          } catch {
            threw = true;
          }

          expect(threw).toBe(false);
          expect(result).toBeDefined();
          expect(typeof result!.status).toBe('number');
        },
      ),
      { numRuns: 100 },
    );
  });

  it('Property 2b — handleWebhookPost avec signature valide mais JSON malformé retourne { status: 200 } (100 itérations)', async () => {
    const appSecret = 'test-app-secret';

    await fc.assert(
      fc.asyncProperty(
        fc.uint8Array({ minLength: 0, maxLength: 2048 }),
        async (bodyBytes) => {
          const rawBody = Buffer.from(bodyBytes);
          const signature = signBody(rawBody, appSecret);

          let result: { status: number; body: string } | undefined;
          let threw = false;
          try {
            result = await handleWebhookPost(
              rawBody,
              signature,
              noopSessionStore,
              new RateLimiter(),
              noopKiosqApi,
              noopWhatsappClient,
            );
          } catch {
            threw = true;
          }

          expect(threw).toBe(false);
          expect(result).toBeDefined();
          // With a valid signature, the function proceeds to JSON parsing.
          // Random bytes are almost certainly not valid JSON → should return 200
          // (malformed body is handled gracefully per Req 1.4).
          // In the rare case the bytes happen to be valid JSON, it also returns 200.
          expect(result!.status).toBe(200);
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe('webhook — tests unitaires signature', () => {
  beforeEach(() => {
    process.env.WHATSAPP_APP_SECRET = 'my-app-secret';
  });

  it('POST avec signature valide → traitement et retour 200', async () => {
    const appSecret = 'my-app-secret';

    // Minimal valid WhatsApp webhook payload with one text message
    const payload = JSON.stringify({
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'entry-1',
          changes: [
            {
              field: 'messages',
              value: {
                messaging_product: 'whatsapp',
                metadata: { display_phone_number: '15550001111', phone_number_id: 'phone-id-1' },
                contacts: [{ profile: { name: 'Test User' }, wa_id: '15559990000' }],
                messages: [
                  {
                    from: '15559990000',
                    id: 'wamid.abc123',
                    timestamp: '1700000000',
                    type: 'text',
                    text: { body: 'Bonjour' },
                  },
                ],
              },
            },
          ],
        },
      ],
    });

    const rawBody = Buffer.from(payload, 'utf8');
    const signature = signBody(rawBody, appSecret);

    const result = await handleWebhookPost(
      rawBody,
      signature,
      noopSessionStore,
      new RateLimiter(),
      noopKiosqApi,
      noopWhatsappClient,
    );

    expect(result.status).toBe(200);
  });

  it('POST sans signature → HTTP 403', async () => {
    const payload = JSON.stringify({ object: 'whatsapp_business_account', entry: [] });
    const rawBody = Buffer.from(payload, 'utf8');

    const result = await handleWebhookPost(
      rawBody,
      undefined, // no signature header
      noopSessionStore,
      new RateLimiter(),
      noopKiosqApi,
      noopWhatsappClient,
    );

    expect(result.status).toBe(403);
  });

  it('POST avec signature incorrecte → HTTP 403', async () => {
    const payload = JSON.stringify({ object: 'whatsapp_business_account', entry: [] });
    const rawBody = Buffer.from(payload, 'utf8');

    const result = await handleWebhookPost(
      rawBody,
      'sha256=0000000000000000000000000000000000000000000000000000000000000000',
      noopSessionStore,
      new RateLimiter(),
      noopKiosqApi,
      noopWhatsappClient,
    );

    expect(result.status).toBe(403);
  });
});
