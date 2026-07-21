import type { VercelRequest, VercelResponse } from '@vercel/node';
import { eq, ilike, or, desc } from 'drizzle-orm';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { getDb } from '../../db/client.js';
import { clients } from '../../db/schema.js';
import { requireAuth, handleOptions } from '../_lib/auth.js';
import { ok, err, numericRows, numericRow, parseBody } from '../_lib/response.js';

const ClientSchema = z.object({
  nom:             z.string().min(1),
  prenom:          z.string().optional(),
  email:           z.string().email().optional().or(z.literal('')),
  telephone:       z.string().optional(),
  adresse:         z.string().optional(),
  ville:           z.string().optional(),
  pays:            z.string().optional(),
  secteurActivite: z.string().optional(),
  commercial:      z.string().optional(),
  typeClient:      z.enum(['particulier', 'entreprise']).default('entreprise'),
  notes:           z.string().optional(),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const body = await parseBody(req);
  if (handleOptions(req, res)) return;
  const ctx = await requireAuth(req, res);
  if (!ctx) return;

  const db = getDb();

  // ── GET /api/clients ──────────────────────────────────
  if (req.method === 'GET') {
    try {
      const q = req.query.q as string | undefined;
      let rows;
      if (q) {
        rows = await db.select().from(clients)
          .where(or(ilike(clients.nom, `%${q}%`), ilike(clients.email, `%${q}%`)))
          .orderBy(desc(clients.createdAt));
      } else {
        rows = await db.select().from(clients).orderBy(desc(clients.createdAt));
      }
      return ok(res, numericRows(rows));
    } catch (e) {
      console.error('[clients GET]', e);
      return err(res, 'Erreur serveur', 500);
    }
  }

  // ── POST /api/clients ─────────────────────────────────
  if (req.method === 'POST') {
    const parsed = ClientSchema.safeParse(body);
    if (!parsed.success) return err(res, 'Données invalides', 422);
    try {
      const count = await db.select().from(clients);
      const code = `CLI-${String(count.length + 1).padStart(3, '0')}`;
      const [row] = await db.insert(clients).values({
        id:        nanoid(),
        code,
        ...parsed.data,
        email:     parsed.data.email || null,
      }).returning();
      return ok(res, numericRow(row), 201);
    } catch (e) {
      console.error('[clients POST]', e);
      return err(res, 'Erreur serveur', 500);
    }
  }

  return err(res, 'Méthode non autorisée', 405);
}
