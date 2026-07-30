/**
 * index.ts — Entry point for the WhatsApp commandes bot.
 *
 * Startup sequence:
 *   1. Load .env files via loadEnv()
 *   2. Validate required environment variables (exits with code 1 if any missing)
 *   3. Instantiate SessionStore, RateLimiter, WhatsappClient, KiosqWhatsappApi adapter
 *   4. Start the HTTP server
 *   5. Start polling commande statuses every 60 seconds
 *
 * Requirements: 10.2, 10.4
 */

import '../loadEnv.js';
import { validateWhatsappEnv } from './validateEnv.js';
import { SessionStore } from './sessionStore.js';
import { RateLimiter } from './security.js';
import { WhatsappClient } from './whatsappClient.js';
import {
  getProduits,
  getClient,
  createClient,
  createCommande,
  getCommande,
  getCommandesClient,
  getParametres,
} from './kiosqWhatsappApi.js';
import { startServer } from './server.js';
import { pollCommandeStatuts } from './notificationPoller.js';
import type { KiosqWhatsappApi } from './conversationHandler.js';

const POLL_INTERVAL_MS = 60_000; // 60 seconds

export async function main(): Promise<void> {
  // Step 1: env vars are loaded by the side-effect import above (../loadEnv.js)

  // Step 2: validate required variables — exits process with code 1 if any missing
  validateWhatsappEnv();

  // Step 3: instantiate core components
  const sessionStore = new SessionStore();
  const rateLimiter = new RateLimiter();
  const whatsappClient = new WhatsappClient();

  // Build an object that satisfies the KiosqWhatsappApi interface using the
  // standalone functions from kiosqWhatsappApi.ts
  const kiosqApi: KiosqWhatsappApi = {
    getProduits,
    getClient,
    createClient,
    createCommande,
    getCommande,
    getCommandesClient,
    getParametres,
  };

  // Step 4: start the HTTP server (GET /health, GET/POST /webhook)
  startServer(sessionStore, rateLimiter, kiosqApi, whatsappClient);

  // Step 5: poll commande statuses every 60 seconds
  const timer = setInterval(
    () =>
      pollCommandeStatuts(sessionStore, kiosqApi, whatsappClient).catch((err) =>
        console.error('[main] pollCommandeStatuts error:', err),
      ),
    POLL_INTERVAL_MS,
  );

  // Allow the process to exit cleanly even if the interval is the only
  // remaining async handle (e.g. in tests).
  if (typeof (timer as unknown as { unref?: () => void }).unref === 'function') {
    (timer as unknown as { unref: () => void }).unref();
  }

  console.log('[main] WhatsApp bot started');
}

main().catch(console.error);
