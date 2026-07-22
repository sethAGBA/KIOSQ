import type { VercelRequest, VercelResponse } from '@vercel/node';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../../db/client.js';
import { parametres } from '../../db/schema.js';
import { requireTenantAuth, handleOptions } from '../_lib/auth.js';
import { ok, err, parseBody } from '../_lib/response.js';

const PatchSchema = z.object({
  nom:        z.string().min(1).optional(),
  adresse:    z.string().optional(),
  telephone:  z.string().optional(),
  email:      z.string().optional(),
  siteWeb:    z.string().optional(),
  siret:      z.string().optional(),
  devise:     z.string().optional(),
  tva:        z.string().optional(),
  piedDePage: z.string().optional(),
  logoUrl:    z.string().optional(),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) return;
  const ctx = await requireTenantAuth(req, res);
  if (!ctx) return;

  const db = getDb();
  // Use a tenant-scoped ID so each tenant has their own settings row
  const tenantDefaultId = `default-${ctx.tenantId!}`;

  // ── GET /api/parametres ───────────────────────────────
  if (req.method === 'GET') {
    try {
      let [row] = await db.select().from(parametres)
        .where(and(eq(parametres.tenantId, ctx.tenantId!), eq(parametres.id, tenantDefaultId)))
        .limit(1);
      // Auto-create defaults if not yet seeded
      if (!row) {
        [row] = await db.insert(parametres).values({ id: tenantDefaultId, tenantId: ctx.tenantId! }).returning();
      }
      return ok(res, row);
    } catch (e) {
      console.error('[parametres GET]', e);
      return err(res, 'Erreur serveur', 500);
    }
  }

  // ── PATCH /api/parametres ─────────────────────────────
  if (req.method === 'PATCH') {
    if (!['admin', 'gestionnaire'].includes(ctx.role)) return err(res, 'Accès refusé', 403);
    const body = await parseBody(req);
    const parsed = PatchSchema.safeParse(body);
    if (!parsed.success) return err(res, 'Données invalides', 422);
    try {
      // Upsert: update if exists, insert if not
      const existing = await db.select().from(parametres)
        .where(and(eq(parametres.tenantId, ctx.tenantId!), eq(parametres.id, tenantDefaultId)))
        .limit(1);
      let row;
      if (existing.length > 0) {
        [row] = await db.update(parametres)
          .set({ ...parsed.data, updatedAt: new Date() })
          .where(and(eq(parametres.tenantId, ctx.tenantId!), eq(parametres.id, tenantDefaultId)))
          .returning();
      } else {
        [row] = await db.insert(parametres)
          .values({ id: tenantDefaultId, tenantId: ctx.tenantId!, ...parsed.data })
          .returning();
      }
      return ok(res, row);
    } catch (e) {
      console.error('[parametres PATCH]', e);
      return err(res, 'Erreur serveur', 500);
    }
  }

  return err(res, 'Méthode non autorisée', 405);
}
