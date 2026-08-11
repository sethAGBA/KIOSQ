/**
 * messageListener.ts — Bridges whatsapp-web.js message events to the
 * conversation handler.
 *
 * Replaces the Meta Cloud API webhook (webhook.ts + server.ts).
 * Instead of receiving HTTP POST events from Meta, we listen directly to
 * whatsapp-web.js 'message' events on the Client instance.
 */

import { RateLimiter } from './security.js';
import type { SessionStore } from './sessionStore.js';
import { handleIncomingMessage } from './conversationHandler.js';
import type { KiosqWhatsappApi } from './conversationHandler.js';
import type { WhatsappWebClient } from './whatsappClient.js';
import type { IncomingMessage } from './types.js';

/**
 * Register the message listener on the WWebJS client.
 * Uses `any` for the wwebjs Client instance to avoid ESM/CJS type conflicts.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function registerMessageListener(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  wwebjsClient: any,
  sessionStore: SessionStore,
  rateLimiter: RateLimiter,
  kiosqApi: KiosqWhatsappApi,
  whatsappClient: WhatsappWebClient,
): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  wwebjsClient.on('message', async (msg: any) => {
    // Only handle text, image, document
    if (msg.type !== 'chat' && msg.type !== 'image' && msg.type !== 'document') {
      return;
    }

    // Skip group messages
    if (msg.from.includes('@g.us')) {
      return;
    }

    // Normalise sender number: strip @c.us suffix
    const phone = (msg.from as string).replace('@c.us', '');

    // Rate-limit check (mirrors Req 9.5)
    if (!rateLimiter.isAllowed(phone)) {
      return;
    }

    // Adapt wwebjs Message to our internal IncomingMessage type
    const incomingMessage: IncomingMessage = {
      from: phone,
      id: msg.id._serialized as string,
      timestamp: String(msg.timestamp),
      type: msg.type === 'chat' ? 'text' : (msg.type as 'image' | 'document'),
      text: msg.type === 'chat' ? { body: msg.body as string } : undefined,
    };

    try {
      await handleIncomingMessage(incomingMessage, sessionStore, kiosqApi, whatsappClient);
    } catch (err) {
      console.error('[messageListener] handleIncomingMessage error for phone', phone, ':', err);
    }
  });

  console.log('[messageListener] Écoute des messages WhatsApp activée.');
}
