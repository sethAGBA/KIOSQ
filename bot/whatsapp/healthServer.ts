/**
 * healthServer.ts — Minimal HTTP server exposing GET /health, /qr and /.
 *
 * Exposes:
 *   - GET /health -> 200 OK
 *   - GET /qr or / -> Web page displaying the WhatsApp QR code image
 */

import * as http from 'node:http';

let latestQr: string | null = null;
let isReady = false;

export function updateQrState(qr: string | null, ready = false): void {
  latestQr = qr;
  isReady = ready;
}

/**
 * Starts a minimal HTTP server that responds to GET /health with 200 OK
 * and serves the QR code at GET /qr.
 *
 * @param port  Port to listen on (default: PORT or WHATSAPP_BOT_PORT env var or 3002).
 * @returns     The running http.Server instance.
 */
export function startHealthServer(port?: number): http.Server {
  const listenPort = port ?? parseInt(process.env.PORT ?? process.env.WHATSAPP_BOT_PORT ?? '3002', 10);

  const server = http.createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/health') {
      const body = JSON.stringify({ status: 'ok', ready: isReady });
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      });
      res.end(body);
      return;
    }

    if (req.method === 'GET' && (req.url === '/' || req.url === '/qr')) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      if (isReady) {
        res.end(`<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <title>WhatsApp Bot — Connecté</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0b141a; color: #e9edef; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; }
    .card { background: #111b21; padding: 40px; border-radius: 16px; border: 1px solid #222e35; max-width: 400px; }
    h1 { color: #25d366; font-size: 24px; margin-bottom: 12px; }
    p { color: #8696a0; font-size: 15px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>✅ WhatsApp Connecté</h1>
    <p>Le bot de commandes Kiosq est en ligne et prêt à recevoir des messages.</p>
  </div>
</body>
</html>`);
      } else if (latestQr) {
        const imgUrl = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(latestQr)}&size=360x360`;
        res.end(`<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta http-equiv="refresh" content="8">
  <title>WhatsApp Bot — Scanner le QR code</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0b141a; color: #e9edef; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; text-align: center; padding: 20px; box-sizing: border-box; }
    .card { background: #111b21; padding: 32px; border-radius: 16px; border: 1px solid #222e35; max-width: 440px; box-shadow: 0 8px 24px rgba(0,0,0,0.5); }
    h1 { font-size: 22px; margin: 0 0 8px 0; color: #e9edef; }
    p { color: #8696a0; font-size: 14px; margin: 0 0 24px 0; line-height: 1.5; }
    .qr-box { background: white; padding: 16px; border-radius: 12px; display: inline-block; margin-bottom: 20px; }
    .qr-box img { display: block; width: 320px; height: 320px; }
    .instructions { text-align: left; background: #202c33; padding: 14px 18px; border-radius: 8px; font-size: 13px; color: #d1d7db; line-height: 1.6; }
    .instructions ol { margin: 0; padding-left: 20px; }
    .status { font-size: 12px; color: #8696a0; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Connecter le Bot WhatsApp</h1>
    <p>Scannez ce code avec votre compte WhatsApp pour démarrer le bot Kiosq.</p>
    <div class="qr-box">
      <img src="${imgUrl}" alt="QR code WhatsApp" />
    </div>
    <div class="instructions">
      <ol>
        <li>Ouvrez WhatsApp sur votre téléphone</li>
        <li>Allez dans <b>Paramètres</b> &gt; <b>Appareils connectés</b></li>
        <li>Appuyez sur <b>Connecter un appareil</b></li>
        <li>Pointez votre appareil vers cet écran</li>
      </ol>
    </div>
    <div class="status">🔄 Cette page s'actualise automatiquement toutes les 8s.</div>
  </div>
</body>
</html>`);
      } else {
        res.end(`<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta http-equiv="refresh" content="3">
  <title>Initialisation du bot...</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0b141a; color: #e9edef; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; }
    .card { background: #111b21; padding: 40px; border-radius: 16px; border: 1px solid #222e35; max-width: 400px; }
    p { color: #8696a0; font-size: 15px; }
  </style>
</head>
<body>
  <div class="card">
    <h2>⏳ Démarrage du navigateur...</h2>
    <p>Génération du QR code en cours. La page s'actualise automatiquement.</p>
  </div>
</body>
</html>`);
      }
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
