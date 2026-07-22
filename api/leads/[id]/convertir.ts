import type { VercelRequest, VercelResponse } from '@vercel/node';
import { eq, and, count } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { getDb } from '../../../db/client.js';
import { leads, clients } from '../../../db/schema.js';
import { requireTenantAuth, handleOptions } from '../../_lib/auth.js';
import { ok, err, numericRow, parseBody } from '../../_lib/response.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await parseBody(req);
  if (handleOptions(req, res)) return;
  if (req.method !== 'POST') return err(res, 'Méthode non autorisée', 405);

  const ctx = await requireTenantAuth(req, res);
  if (!ctx) return;

  const id = req.query.id as string;
  const db = getDb();

  // ── Fetch lead (scoped to tenant) ──────────────────────
  let lead;
  try {
    const [row] = await db
      .select()
      .from(leads)
      .where(and(eq(leads.id, id), eq(leads.tenantId, ctx.tenantId!)))
      .limit(1);
    lead = row;
  } catch (e) {
    console.error('[leads/convertir GET lead]', e);
    return err(res, 'Erreur serveur', 500);
  }

  if (!lead) return err(res, 'Lead introuvable', 404);
  if (lead.clientId !== null) return err(res, 'Lead déjà converti', 409);

  // ── Determine client name ──────────────────────────────
  const nom =
    lead.produitDetecte && lead.produitDetecte.trim().length > 0
      ? lead.produitDetecte.trim()
      : lead.texteOriginal.slice(0, 100);

  try {
    // ── Generate client code (scoped to tenant) ────────────
    const [{ value: clientCount }] = await db
      .select({ value: count() })
      .from(clients)
      .where(eq(clients.tenantId, ctx.tenantId!));
    const code = `CLI-${String(Number(clientCount) + 1).padStart(3, '0')}`;

    // ── Create client ──────────────────────────────────────
    const [newClient] = await db.insert(clients).values({
      id:              nanoid(),
      code,
      nom,
      typeClient:      'entreprise',
      notes:           lead.texteOriginal,
      totalAchats:     '0',
      soldeCredit:     '0',
      nombreCommandes: 0,
      actif:           true,
      tenantId:        ctx.tenantId!,
    }).returning();

    // ── Update lead ────────────────────────────────────────
    try {
      await db.update(leads)
        .set({
          clientId:  newClient.id,
          statut:    'envoye',
          updatedAt: new Date(),
        })
        .where(and(eq(leads.id, id), eq(leads.tenantId, ctx.tenantId!)));
    } catch (updateErr) {
      // Manual rollback: delete the client we just created
      console.error('[leads/convertir UPDATE lead]', updateErr);
      try {
        await db.delete(clients).where(eq(clients.id, newClient.id));
      } catch (rollbackErr) {
        console.error('[leads/convertir ROLLBACK client]', rollbackErr);
      }
      return err(res, 'Erreur serveur', 500);
    }

    return ok(res, numericRow(newClient), 201);
  } catch (e) {
    console.error('[leads/convertir]', e);
    return err(res, 'Erreur serveur', 500);
  }
}
