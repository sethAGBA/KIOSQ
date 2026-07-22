import type { VercelRequest, VercelResponse } from '@vercel/node';
import { eq, and, gte, lte, count, desc } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../../db/client.js';
import { auditLogs } from '../../db/schema.js';
import { requireTenantAuth, handleOptions } from '../_lib/auth.js';
import { ok, err } from '../_lib/response.js';

const PAGE_SIZE = 50;

const QuerySchema = z.object({
  page:      z.coerce.number().int().min(1).default(1),
  action:    z.string().optional(),
  userId:    z.string().optional(),
  dateDebut: z.string().optional(),
  dateFin:   z.string().optional(),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) return;

  // Only GET is allowed
  if (req.method !== 'GET') {
    return err(res, 'Méthode non autorisée', 405);
  }

  const ctx = await requireTenantAuth(req, res);
  if (!ctx) return;

  const parsed = QuerySchema.safeParse(req.query);
  if (!parsed.success) return err(res, 'Paramètres invalides', 422);

  const { page, action, userId, dateDebut, dateFin } = parsed.data;
  const offset = (page - 1) * PAGE_SIZE;

  const db = getDb();

  try {
    // Build WHERE conditions — tenant scope is always enforced
    const conditions = [eq(auditLogs.tenantId, ctx.tenantId!)];

    if (action) {
      conditions.push(eq(auditLogs.action, action));
    }

    if (userId) {
      conditions.push(eq(auditLogs.userId, userId));
    }

    if (dateDebut) {
      conditions.push(gte(auditLogs.createdAt, new Date(dateDebut)));
    }

    if (dateFin) {
      // Include the full end day by setting time to end of day
      const fin = new Date(dateFin);
      fin.setHours(23, 59, 59, 999);
      conditions.push(lte(auditLogs.createdAt, fin));
    }

    const where = and(...conditions);

    // Total count for pagination
    const [{ value: total }] = await db
      .select({ value: count() })
      .from(auditLogs)
      .where(where);

    // Paginated items, sorted by createdAt descending
    const items = await db
      .select()
      .from(auditLogs)
      .where(where)
      .orderBy(desc(auditLogs.createdAt))
      .limit(PAGE_SIZE)
      .offset(offset);

    const totalNum = Number(total);
    const totalPages = Math.ceil(totalNum / PAGE_SIZE);

    return ok(res, { items, total: totalNum, page, totalPages });
  } catch (e) {
    console.error('[audit-logs GET]', e);
    return err(res, 'Erreur serveur', 500);
  }
}
