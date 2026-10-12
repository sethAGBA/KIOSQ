/**
 * Server Express — émule et sert toutes les API routes de api/ et le frontend Vite.
 */
import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import type { Request, Response } from 'express';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Adapte une fonction Vercel (VercelRequest/Response) pour Express
function adapt(handlerPath: string) {
  return async (req: Request, res: Response) => {
    // Vercel injecte les params de route dans req.query via son runtime.
    if (req.params) {
      req.query = { ...req.params, ...(req.query || {}) };
    }
    const mod = await import(handlerPath);
    const handler = mod.default ?? mod;
    await handler(req as never, res as never);
  };
}

async function main() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());

  // CORS
  app.use((req, res, next) => {
    const origin = req.headers.origin || 'http://localhost:5173';
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Tenant-ID');
    if (req.method === 'OPTIONS') return res.status(204).end();
    next();
  });

  // ── Enregistrement automatique de toutes les routes Vercel dans api/ ───
  function registerApiRoutes() {
    function walk(dir: string): string[] {
      let results: string[] = [];
      const list = fs.readdirSync(dir, { withFileTypes: true });
      for (const item of list) {
        if (item.name.startsWith('_') || item.name.endsWith('.test.ts') || item.name === 'tsconfig.json') continue;
        const full = path.join(dir, item.name);
        if (item.isDirectory()) {
          results = results.concat(walk(full));
        } else if (item.name.endsWith('.ts')) {
          results.push(full);
        }
      }
      return results;
    }

    const files = walk('api');

    // Tri pour que les routes spécifiques viennent avant les routes avec paramètres (:id)
    files.sort((a, b) => {
      const aParts = a.split(path.sep).length;
      const bParts = b.split(path.sep).length;
      if (aParts !== bParts) return bParts - aParts; // sous-dossiers plus profonds en premier
      const aParam = a.includes('[');
      const bParam = b.includes('[');
      if (aParam !== bParam) return aParam ? 1 : -1; // routes statiques avant les routes paramétrées
      return a.localeCompare(b);
    });

    for (const f of files) {
      const rel = f.replace(/\\/g, '/');
      const route = '/' + rel
        .replace(/\.ts$/, '')
        .replace(/\/index$/, '')
        .replace(/\[(\w+)\]/g, ':$1');
      const handlerPath = './' + rel;
      app.all(route, adapt(handlerPath));
    }

    console.log(`   ✓ ${files.length} routes API enregistrées dynamiquement depuis api/`);
  }

  registerApiRoutes();

  // ── Servir le frontend statique Vite (production) ───────
  const distPath = path.resolve(__dirname, 'dist');
  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.use((req, res, next) => {
      if (req.path.startsWith('/api')) return next();
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 Kiosq server ready at http://0.0.0.0:${PORT}`);
  });
}

main().catch(console.error);
