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

  // ── Dashboard Stats ──────────────────────────────────────
  app.get('/api/dashboard/stats', adapt('./api/dashboard/stats/index.ts'));

  // ── Fournisseurs ─────────────────────────────────────────
  app.all('/api/fournisseurs/:id', async (req, res) => {
    req.query.id = req.params.id;
    const { default: handler } = await import('./api/fournisseurs/[id].ts');
    await handler(req as never, res as never);
  });
  app.all('/api/fournisseurs', adapt('./api/fournisseurs/index.ts'));

  // ── Catégories ───────────────────────────────────────────
  app.all('/api/categories/:id', async (req, res) => {
    req.query.id = req.params.id;
    const { default: handler } = await import('./api/categories/[id].ts');
    await handler(req as never, res as never);
  });
  app.all('/api/categories', adapt('./api/categories/index.ts'));

  // ── Notifications ────────────────────────────────────────
  app.get('/api/notifications', adapt('./api/notifications/index.ts'));

  // ── Paramètres ───────────────────────────────────────────
  app.all('/api/parametres', adapt('./api/parametres/index.ts'));

  // ── Unités ───────────────────────────────────────────────
  app.all('/api/unites/:id', async (req, res) => {
    req.query.id = req.params.id;
    const { default: handler } = await import('./api/unites/[id].ts');
    await handler(req as never, res as never);
  });
  app.all('/api/unites', adapt('./api/unites/index.ts'));

  // ── Utilisateurs ─────────────────────────────────────────
  app.all('/api/utilisateurs/:id', async (req, res) => {
    req.query.id = req.params.id;
    const { default: handler } = await import('./api/utilisateurs/[id].ts');
    await handler(req as never, res as never);
  });
  app.all('/api/utilisateurs', adapt('./api/utilisateurs/index.ts'));

  // ── Leads ────────────────────────────────────────────────
  app.post('/api/leads/:id/convertir', async (req, res) => {
    req.query.id = req.params.id;
    const { default: handler } = await import('./api/leads/[id]/convertir.ts');
    await handler(req as never, res as never);
  });
  app.all('/api/leads/:id', async (req, res) => {
    req.query.id = req.params.id;
    const { default: handler } = await import('./api/leads/[id].ts');
    await handler(req as never, res as never);
  });
  app.all('/api/leads', adapt('./api/leads/index.ts'));

  // ── Multi-Tenant & Superadmin ────────────────────────────
  app.get('/api/tenants/resolve', adapt('./api/tenants/resolve.ts'));
  app.post('/api/auth/impersonate', adapt('./api/auth/impersonate.ts'));

  app.all('/api/superadmin/tenants/:id/impersonate', async (req, res) => {
    req.query.id = req.params.id;
    const { default: handler } = await import('./api/superadmin/tenants/[id]/impersonate.ts');
    await handler(req as never, res as never);
  });
  app.all('/api/superadmin/tenants/:id/clone', async (req, res) => {
    req.query.id = req.params.id;
    const { default: handler } = await import('./api/superadmin/tenants/[id]/clone.ts');
    await handler(req as never, res as never);
  });
  app.all('/api/superadmin/tenants/:id', async (req, res) => {
    req.query.id = req.params.id;
    const { default: handler } = await import('./api/superadmin/tenants/[id].ts');
    await handler(req as never, res as never);
  });
  app.all('/api/superadmin/tenants', adapt('./api/superadmin/tenants/index.ts'));
  app.get('/api/superadmin/stats', adapt('./api/superadmin/stats.ts'));

  app.all('/api/audit-logs', adapt('./api/audit-logs/index.ts'));
  app.all('/api/abonnement', adapt('./api/abonnement/index.ts'));
  app.all('/api/onboarding', adapt('./api/onboarding/index.ts'));

  app.all('/api/templates/:id/import', async (req, res) => {
    req.query.id = req.params.id;
    const { default: handler } = await import('./api/templates/[id]/import.ts');
    await handler(req as never, res as never);
  });
  app.all('/api/templates', adapt('./api/templates/index.ts'));

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
    console.log('   POST   /api/pos/vente           → encaissement POS');
    console.log('   GET    /api/dashboard/stats     → statistiques dashboard');
    console.log('   GET    /api/parametres          → paramètres entreprise');
    console.log('   PATCH  /api/parametres          → modifier paramètres');
    console.log('   GET    /api/unites              → unités de mesure');
    console.log('   GET    /api/leads              → leads (capture)');
    console.log('   GET    /api/groupes-surveilles → groupes Facebook\n');
  });
}

main().catch(console.error);
