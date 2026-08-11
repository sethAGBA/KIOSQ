/**
 * healthServer.ts — Minimal HTTP server exposing GET /health.
 *
 * With whatsapp-web.js there's no webhook to expose, so we only need a
 * lightweight health-check endpoint for container orchestrators.
 */

import * as http from 'node:http';

/**
 * Starts a minimal HTTP server that responds to GET /health with 200 OK.
 *
 * @param port  Port to listen on (default: WHATSAPP_BOT_PORT env var or 3002).
 * @returns     The running http.Server instance.
 */
export function startHealthServer(port?: number): http.Server {
  const listenPort = port ?? parseInt(process.env.WHATSAPP_BOT_PORT ?? '3002', 10);

  const server = http.createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/health') {
      const body = JSON.stringify({ status: 'ok' });
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      });
      res.end(body);
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  });

  server.listen(listenPort, () => {
    console.log('[server] Health check listening on port', listenPort);
  });

  return server;
}
