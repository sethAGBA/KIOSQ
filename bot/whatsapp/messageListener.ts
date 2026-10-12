/**
 * messageListener.ts — Bridges whatsapp-web.js message events to the
 * conversation handler.
 *
 * Listens directly to whatsapp-web.js 'message' events:
 *   - Text chats ('chat')
 *   - Voice notes ('ptt', 'audio') with automatic download & base64 encoding
 *   - Location sharing ('location')
 *   - Images ('image')
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
    console.log('[messageListener] Message reçu — type:', msg.type, 'from:', msg.from, 'body:', msg.body?.slice(0, 50));

    // Ignorer les messages envoyés par soi-même
    if (msg.fromMe) {
      return;
    }

    // Ignorer les statuts et broadcasts
    if (msg.from === 'status@broadcast' || msg.from?.includes('@broadcast')) {
      return;
    }

    // Handle text, voice note / audio, location, and images
    const isSupportedType =
      msg.type === 'chat' ||
      msg.type === 'ptt' ||
      msg.type === 'audio' ||
      msg.type === 'location' ||
      msg.type === 'image' ||
      msg.type === 'document';

    if (!isSupportedType) {
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

    // Téléchargement du média pour les notes vocales
    let audioData: { dataBase64: string; mimeType: string } | undefined = undefined;
    if ((msg.type === 'ptt' || msg.type === 'audio') && msg.hasMedia) {
      try {
        const media = await msg.downloadMedia();
        if (media && media.data) {
          audioData = {
            dataBase64: media.data,
            mimeType: media.mimetype || 'audio/ogg',
          };
          console.log('[messageListener] Note vocale reçue et téléchargée (taille base64:', media.data.length, 'bytes)');
        }
      } catch (err) {
        console.warn('[messageListener] Impossible de télécharger la note vocale:', err);
      }
    }

    // Données de localisation
    let locationData: { latitude: number; longitude: number; name?: string; address?: string } | undefined = undefined;
    if (msg.type === 'location' && msg.location) {
      locationData = {
        latitude: msg.location.latitude,
        longitude: msg.location.longitude,
        name: msg.location.name,
        address: msg.location.address || msg.location.description,
      };
      console.log('[messageListener] Position reçue:', locationData.latitude, locationData.longitude);
    }

    // Type normalisé
    let normalizedType: IncomingMessage['type'] = 'text';
    if (msg.type === 'ptt' || msg.type === 'audio') {
      normalizedType = 'audio';
    } else if (msg.type === 'location') {
      normalizedType = 'location';
    } else if (msg.type === 'image') {
      normalizedType = 'image';
    } else if (msg.type === 'document') {
      normalizedType = 'document';
    }

    const incomingMessage: IncomingMessage = {
      from: phone,
      id: msg.id._serialized as string,
      timestamp: String(msg.timestamp),
      type: normalizedType,
      text: msg.body ? { body: msg.body as string } : undefined,
      audio: audioData,
      location: locationData,
    };

    try {
      await handleIncomingMessage(incomingMessage, sessionStore, kiosqApi, whatsappClient);
    } catch (err) {
      console.error('[messageListener] handleIncomingMessage error for phone', phone, ':', err);
    }
  });

  console.log('[messageListener] Écoute des messages WhatsApp activée (Texte, Audio/Vocaux, Localisation).');
}
