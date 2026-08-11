/**
 * index.ts — Entry point for the WhatsApp commandes bot (whatsapp-web.js).
 *
 * All event listeners are registered BEFORE calling initialize() to guarantee
 * no events are missed during the authentication flow.
 */

import '../loadEnv.js';
import { validateWhatsappEnv } from './validateEnv.js';
import { SessionStore } from './sessionStore.js';
import { RateLimiter } from './security.js';
import { createWhatsappClient } from './whatsappClient.js';
import { registerMessageListener } from './messageListener.js';
import { startHealthServer } from './healthServer.js';
import {
  getProduits,
  getClient,
  createClient,
  createCommande,
  getCommande,
  getCommandesClient,
  getParametres,
} from './kiosqWhatsappApi.js';
import { pollCommandeStatuts } from './notificationPoller.js';
import { createShutdownHandler } from './shutdown.js';
import type { KiosqWhatsappApi } from './conversationHandler.js';

const POLL_INTERVAL_MS = 60_000;

export async function main(): Promise<void> {
  // Step 1: validate env vars
  validateWhatsappEnv();

  // Step 2: instantiate core components
  const sessionStore = new SessionStore();
  const rateLimiter  = new RateLimiter();
  const waClient     = createWhatsappClient();

  const kiosqApi: KiosqWhatsappApi = {
    getProduits,
    getClient,
    createClient,
    createCommande,
    getCommande,
    getCommandesClient,
    getParametres,
  };

  // Step 3: start health-check server
  const healthServer = startHealthServer();

  // Step 4: access the internal wwebjsClient BEFORE initialize()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const internalClient = (waClient as any).client;

  let pollerTimer: ReturnType<typeof setInterval> | null = null;
  let shutdownRegistered = false;

  // Register 'ready' handler BEFORE initialize() so it can't be missed
  internalClient.on('ready', () => {
    console.log('[whatsapp] Client connecté et prêt.');

    // Register message listener
    registerMessageListener(internalClient, sessionStore, rateLimiter, kiosqApi, waClient);

    // Start notification poller
    pollerTimer = setInterval(
      () =>
        pollCommandeStatuts(sessionStore, kiosqApi, waClient).catch((err) =>
          console.error('[main] pollCommandeStatuts error:', err),
        ),
      POLL_INTERVAL_MS,
    );

    if (typeof (pollerTimer as unknown as { unref?: () => void }).unref === 'function') {
      (pollerTimer as unknown as { unref: () => void }).unref();
    }

    console.log('[main] Bot WhatsApp démarré et prêt à recevoir des messages.');

    // Register graceful shutdown only once
    if (!shutdownRegistered) {
      shutdownRegistered = true;
      const shutdown = createShutdownHandler(healthServer, pollerTimer!);
      process.on('SIGTERM', () => waClient.destroy().finally(() => shutdown('SIGTERM')));
      process.on('SIGINT',  () => waClient.destroy().finally(() => shutdown('SIGINT')));
    }
  });

  // Step 5: initialize (shows QR code, waits for auth)
  console.log('[main] Initialisation du client WhatsApp…');
  console.log('[main] Scannez le QR code qui va s\'afficher dans quelques secondes.');

  await waClient.initialize();
}

main().catch(console.error);
