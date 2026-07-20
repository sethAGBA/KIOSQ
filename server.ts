/**
 * Local dev server — émule les API routes Vercel avec Express.
 * Lance avec : npx tsx --env-file=.env.local server.ts
 */
import express from 'express';
import cookieParser from 'cookie-parser';
import type { Request, Response } from 'express';

// Adapte une fonction Vercel (VercelRequest/Response) pour Express
function adapt(handlerPath: string) {
  return async (req: Request, res: Response) => {
    // Vercel injecte les params de route dans req.query via son runtime.
    // On les extrait du path et on les met dans req.query manuellement.
    const mod = await import(handlerPath);
    const handler = mod.default ?? mod;
    await handler(req as never, res as never);
  };
}

async function main() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());

  // CORS pour Vite
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5173');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') return res.status(204).end();
    next();
  });

  // ── Auth ────────────────────────────────────────────────
  app.post('/api/auth/login',  adapt('./api/auth/login.ts'));
  app.get ('/api/auth/me',     adapt('./api/auth/me.ts'));
  app.post('/api/auth/logout', adapt('./api/auth/logout.ts'));

  // ── Clients ─────────────────────────────────────────────
  app.all('/api/clients/:id', async (req, res) => {
    const { default: handler } = await import('./api/clients/[id].ts');
    await handler(req as never, res as never);
  });
  app.all('/api/clients', adapt('./api/clients/index.ts'));

  // ── Produits ─────────────────────────────────────────────
  app.all('/api/produits/:id', async (req, res) => {
    const { default: handler } = await import('./api/produits/[id].ts');
    await handler(req as never, res as never);
  });
  app.all('/api/produits', adapt('./api/produits/index.ts'));

  // ── Commandes ────────────────────────────────────────────
  app.all('/api/commandes/:id', async (req, res) => {
    const { default: handler } = await import('./api/commandes/[id].ts');
    await handler(req as never, res as never);
  });
  app.all('/api/commandes', adapt('./api/commandes/index.ts'));

  // ── Factures ─────────────────────────────────────────────
  // Sub-routes FIRST — must come before the /:id catch-all in Express
  app.post('/api/factures/:id/retour', async (req, res) => {
    req.query.id = req.params.id;
    const { default: handler } = await import('./api/factures/[id]/retour.ts');
    await handler(req as never, res as never);
  });
  app.all('/api/factures/:id', async (req, res) => {
    const { default: handler } = await import('./api/factures/[id].ts');
    await handler(req as never, res as never);
  });
  app.all('/api/factures', adapt('./api/factures/index.ts'));

  // ── POS : encaissement ───────────────────────────────────
  app.post('/api/pos/vente', adapt('./api/pos/vente.ts'));

  // ── Fournisseurs ─────────────────────────────────────────
  app.all('/api/fournisseurs/:id', async (req, res) => {
    req.query.id = req.params.id;
    const { default: handler } = await import('./api/fournisseurs/[id].ts');
    await handler(req as never, res as never);
  });
  app.all('/api/fournisseurs', adapt('./api/fournisseurs/index.ts'));

  // ── Catégories ───────────────────────────────────────────
  app.all('/api/categories', adapt('./api/categories/index.ts'));

  // ── Utilisateurs ─────────────────────────────────────────
  app.all('/api/utilisateurs/:id', async (req, res) => {
    req.query.id = req.params.id;
    const { default: handler } = await import('./api/utilisateurs/[id].ts');
    await handler(req as never, res as never);
  });
  app.all('/api/utilisateurs', adapt('./api/utilisateurs/index.ts'));

  const PORT = 3001;
  app.listen(PORT, () => {
    console.log(`\n🚀 API server ready at http://localhost:${PORT}`);
    console.log('   Routes disponibles :');
    console.log('   POST   /api/auth/login');
    console.log('   GET    /api/clients');
    console.log('   GET    /api/produits');
    console.log('   GET    /api/commandes');
    console.log('   GET    /api/factures');
    console.log('   PATCH  /api/factures/:id       → mise à jour / annulation');
    console.log('   POST   /api/factures/:id/retour → retour client');
    console.log('   POST   /api/pos/vente           → encaissement POS\n');
  });
}

main().catch(console.error);
