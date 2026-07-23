import type { VercelRequest, VercelResponse } from '@vercel/node';
import { eq, and, desc, gte, lte } from 'drizzle-orm';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { getDb } from '../../db/client.js';
import { sortiesCaisse } from '../../db/schema.js';
import { requireTenantAuth, handleOptions } from '../_lib/auth.js';
import { ok, err, numericRows, numericRow, parseBody } from '../_lib/response.js';
import { logAction } from '../_lib/auditLog.js';

const SortieCaisseSchema = z.object({
  montant: z.number().positive(),
  motif: z.string().min(1),
  categorie: z.string().min(1),
  beneficiaire: z.string().optional(),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const body = await parseBody(req);
  if (handleOptions(req, res)) return;
  const ctx = await requireTenantAuth(req, res);
  if (!ctx) return;

  const db = getDb();
  const tenantId = ctx.tenantId || 'tenant_demo';

  // ── GET /api/sorties-caisse ──────────────────────────────
  if (req.method === 'GET') {
    try {
      const { start, end, utilisateurId } = req.query as { start?: string; end?: string; utilisateurId?: string };
      const conditions: any[] = [];

      if (ctx.role !== 'superadmin') {
        conditions.push(eq(sortiesCaisse.tenantId, tenantId));
      }

      if (utilisateurId && utilisateurId !== 'all' && utilisateurId !== 'undefined') {
        conditions.push(eq(sortiesCaisse.utilisateurId, utilisateurId));
      }

      if (start && typeof start === 'string' && start.trim().length > 0 && start !== 'undefined') {
        const startDate = new Date(start);
        if (!isNaN(startDate.getTime())) {
          conditions.push(gte(sortiesCaisse.createdAt, startDate));
        }
      }
      if (end && typeof end === 'string' && end.trim().length > 0 && end !== 'undefined') {
        const endDate = new Date(end);
        if (!isNaN(endDate.getTime())) {
          endDate.setHours(23, 59, 59, 999);
          conditions.push(lte(sortiesCaisse.createdAt, endDate));
        }
      }

      const rows = conditions.length > 0
        ? await db
            .select()
            .from(sortiesCaisse)
            .where(and(...conditions))
            .orderBy(desc(sortiesCaisse.createdAt))
            .limit(200)
        : await db
            .select()
            .from(sortiesCaisse)
            .orderBy(desc(sortiesCaisse.createdAt))
            .limit(200);

      return ok(res, numericRows(rows as Record<string, unknown>[]));
    } catch (e) {
      console.error('[sorties-caisse GET]', e);
      return err(res, 'Erreur serveur', 500);
    }
  }

  // ── POST /api/sorties-caisse ─────────────────────────────
  if (req.method === 'POST') {
    const parsed = SortieCaisseSchema.safeParse(body);
    if (!parsed.success) return err(res, 'Données invalides', 422);

    try {
      const userName = `${ctx.prenom || ''} ${ctx.nom || ''}`.trim() || ctx.email;

      const [row] = await db
        .insert(sortiesCaisse)
        .values({
          id: nanoid(),
          tenantId,
          montant: String(parsed.data.montant),
          motif: parsed.data.motif,
          categorie: parsed.data.categorie,
          beneficiaire: parsed.data.beneficiaire || '',
          utilisateurId: ctx.sub,
          utilisateurNom: userName,
          date: new Date(),
        })
        .returning();

      await logAction(db, tenantId, ctx.sub, 'sortie_caisse.created', 'sortie_caisse', row.id, {
        montant: parsed.data.montant,
        categorie: parsed.data.categorie,
      });

      return ok(res, numericRow(row), 201);
    } catch (e) {
      console.error('[sorties-caisse POST]', e);
      return err(res, 'Erreur serveur', 500);
    }
  }

  return err(res, 'Méthode non autorisée', 405);
}
