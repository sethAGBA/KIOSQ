import type { VercelRequest, VercelResponse } from '@vercel/node';
import { eq, and, desc, gte, lte } from 'drizzle-orm';
import { getDb } from '../../db/client.js';
import { retoursClients } from '../../db/schema.js';
import { requireTenantAuth, handleOptions } from '../_lib/auth.js';
import { ok, err } from '../_lib/response.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) return;
  const ctx = await requireTenantAuth(req, res);
  if (!ctx) return;

  if (req.method !== 'GET') return err(res, 'Méthode non autorisée', 405);

  const db = getDb();
  const tenantId = ctx.tenantId!;

  try {
    const {
      start,
      end,
      mode,
      utilisateurId,
      q,
    } = req.query as {
      start?: string;
      end?: string;
      mode?: string;
      utilisateurId?: string;
      q?: string;
    };

    const conditions: ReturnType<typeof eq>[] = [
      eq(retoursClients.tenantId, tenantId),
    ];

    if (start && start !== 'undefined') {
      const d = new Date(start);
      if (!isNaN(d.getTime())) conditions.push(gte(retoursClients.createdAt, d) as any);
    }
    if (end && end !== 'undefined') {
      const d = new Date(end);
      if (!isNaN(d.getTime())) {
        d.setHours(23, 59, 59, 999);
        conditions.push(lte(retoursClients.createdAt, d) as any);
      }
    }
    if (mode && mode !== 'tous') {
      conditions.push(eq(retoursClients.remboursementMode, mode as 'especes' | 'credit_reduc' | 'avoir') as any);
    }
    if (utilisateurId && utilisateurId !== 'all' && utilisateurId !== 'undefined') {
      conditions.push(eq(retoursClients.utilisateurId, utilisateurId) as any);
    }

    let rows = await db
      .select()
      .from(retoursClients)
      .where(and(...conditions))
      .orderBy(desc(retoursClients.createdAt))
      .limit(500);

    // Client-side text filter (nom client or numéro facture)
    if (q && q.trim()) {
      const lower = q.toLowerCase();
      rows = rows.filter(
        r =>
          r.clientNom.toLowerCase().includes(lower) ||
          r.factureNumero.toLowerCase().includes(lower),
      );
    }

    // Coerce numeric fields
    const data = rows.map(r => ({
      ...r,
      totalTTC: Number(r.totalTTC),
    }));

    return ok(res, data);
  } catch (e) {
    console.error('[retours-clients GET]', e);
    return err(res, 'Erreur serveur', 500);
  }
}
