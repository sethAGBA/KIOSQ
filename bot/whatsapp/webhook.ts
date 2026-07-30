import { validateHmacSignature, RateLimiter } from './security.js';
import type { SessionStore } from './sessionStore.js';
import { handleIncomingMessage } from './conversationHandler.js';
import type { KiosqWhatsappApi, WhatsappClient } from './conversationHandler.js';
import type { WhatsAppWebhookPayload } from './types.js';

/**
 * Handles GET /webhook for hub.challenge verification.
 *
 * If `hub_mode` is "subscribe" and `hub_verify_token` matches the configured
 * WHATSAPP_VERIFY_TOKEN, echoes back `hub_challenge` with HTTP 200.
 * Otherwise returns HTTP 403.
 *
 * Validates: Requirements 1.3
 */
export function handleVerification(query: {
  hub_mode?: string;
  hub_challenge?: string;
  hub_verify_token?: string;
}): { status: number; body: string } {
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

  if (
    query.hub_mode === 'subscribe' &&
    query.hub_verify_token === verifyToken &&
    query.hub_challenge !== undefined
  ) {
    return { status: 200, body: query.hub_challenge };
  }

  return { status: 403, body: 'Forbidden' };
}

/**
 * Handles POST /webhook — validates signature, rate-limits, and dispatches
 * each incoming message to the conversation state machine.
 *
 * Always returns HTTP 200 even when internal errors occur, to prevent
 * WhatsApp Cloud API from retrying deliveries and duplicating messages.
 *
 * Validates: Requirements 1.1, 1.4, 1.5, 9.3, 9.5
 */
export async function handleWebhookPost(
  rawBody: Buffer,
  signatureHeader: string | undefined,
  sessionStore: SessionStore,
  rateLimiter: RateLimiter,
  kiosqApi: KiosqWhatsappApi,
  whatsappClient: WhatsappClient,
): Promise<{ status: number; body: string }> {
  // Step 1 — Validate HMAC-SHA256 signature (Req 9.3)
  const appSecret = process.env.WHATSAPP_APP_SECRET ?? '';
  if (!signatureHeader || !validateHmacSignature(rawBody, appSecret, signatureHeader)) {
    return { status: 403, body: 'Invalid signature' };
  }

  // Step 2 — Parse the raw body as JSON (Req 1.4)
  let payload: WhatsAppWebhookPayload;
  try {
    payload = JSON.parse(rawBody.toString('utf8')) as WhatsAppWebhookPayload;
  } catch (err) {
    console.error('[webhook] malformed JSON body:', err);
    return { status: 200, body: 'ok' };
  }

  // Step 3 — Extract messages from the nested WhatsApp webhook structure
  const messages = payload?.entry?.flatMap((entry) =>
    entry.changes?.flatMap((change) => change.value?.messages ?? []) ?? [],
  ) ?? [];

  // Step 4 & 5 — For each message: rate-limit check then dispatch (Req 1.5, 9.5)
  for (const message of messages) {
    // Only process text messages at minimum (Req 1.5)
    if (message.type !== 'text' && message.type !== 'image' && message.type !== 'document') {
      continue;
    }

    const phone = message.from;

    // Rate limit: skip silently if exceeded (Req 9.5)
    if (!rateLimiter.isAllowed(phone)) {
      continue;
    }

    try {
      await handleIncomingMessage(message, sessionStore, kiosqApi, whatsappClient);
    } catch (err) {
      // Req 1.1: log error but never let it bubble up — always return 200
      console.error('[webhook] handleIncomingMessage error for phone', phone, ':', err);
    }
  }

  // Step 6 — Always return 200 (Req 1.1)
  return { status: 200, body: 'ok' };
}
