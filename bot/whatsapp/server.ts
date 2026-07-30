import * as http from 'node:http';
import { URL } from 'node:url';
import { handleVerification, handleWebhookPost } from './webhook.js';
import type { SessionStore } from './sessionStore.js';
import type { RateLimiter } from './security.js';
import type { KiosqWhatsappApi, WhatsappClient } from './conversationHandler.js';

/**
 * Creates and starts a Node.js HTTP server for the WhatsApp commandes bot.
 *
 * Routes:
 *   GET  /health  → { "status": "ok" } with HTTP 200
 *   GET  /webhook → handleVerification() with hub.challenge query params
 *   POST /webhook → handleWebhookPost() with raw body Buffer + X-Hub-Signature-256
 *   *             → HTTP 404
 *
 * The raw body is collected as Buffer chunks before JSON parsing so that the
 * HMAC-SHA256 signature can be validated against the original bytes.
 *
 * Validates: Requirements 10.3, 1.3, 1.1
 */
export function startServer(
  sessionStore: SessionStore,
  rateLimiter: RateLimiter,
  kiosqApi: KiosqWhatsappApi,
  whatsappClient: WhatsappClient,
): http.Server {
  const port = parseInt(process.env.WHATSAPP_BOT_PORT ?? '3002', 10);

  const server = http.createServer((req, res) => {
    // Parse URL (use a dummy base since we only care about pathname + query)
    const parsedUrl = new URL(req.url ?? '/', `http://localhost:${port}`);
    const pathname = parsedUrl.pathname;
    const method = req.method ?? 'GET';

    // ── GET /health ──────────────────────────────────────────────────────
    if (method === 'GET' && pathname === '/health') {
      const body = JSON.stringify({ status: 'ok' });
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      });
      res.end(body);
      return;
    }

    // ── GET /webhook — hub.challenge verification ─────────────────────────
    if (method === 'GET' && pathname === '/webhook') {
      const query = {
        hub_mode: parsedUrl.searchParams.get('hub.mode') ?? undefined,
        hub_challenge: parsedUrl.searchParams.get('hub.challenge') ?? undefined,
        hub_verify_token: parsedUrl.searchParams.get('hub.verify_token') ?? undefined,
      };
      const result = handleVerification(query);
      res.writeHead(result.status, { 'Content-Type': 'text/plain' });
      res.end(result.body);
      return;
    }

    // ── POST /webhook — incoming WhatsApp message ─────────────────────────
    if (method === 'POST' && pathname === '/webhook') {
      const chunks: Buffer[] = [];

      req.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });

      req.on('end', () => {
        const rawBody = Buffer.concat(chunks);
        const signatureHeader = req.headers['x-hub-signature-256'] as string | undefined;

        handleWebhookPost(rawBody, signatureHeader, sessionStore, rateLimiter, kiosqApi, whatsappClient)
          .then((result) => {
            res.writeHead(result.status, { 'Content-Type': 'text/plain' });
            res.end(result.body);
          })
          .catch((err) => {
            // Fallback: always return 200 to prevent WhatsApp retries (Req 1.1)
            console.error('[server] Unexpected error in handleWebhookPost:', err);
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end('ok');
          });
      });

      req.on('error', (err) => {
        console.error('[server] Request stream error:', err);
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('ok');
      });

      return;
    }

    // ── Unknown routes ────────────────────────────────────────────────────
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  });

  server.listen(port, () => {
    console.log('[server] Listening on port', port);
  });

  return server;
}
