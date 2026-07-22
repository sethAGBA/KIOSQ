import type { VercelRequest, VercelResponse } from '@vercel/node';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../../db/client.js';
import { commandes } from '../../db/schema.js';
import { requireTenantAuth, handleOptions } from '../_lib/auth.js';
import { ok, err, numericRow, parseBody} from '../_lib/response.js';

const PatchSchema = z.object({
  statut:           z.enum(['brouillon','envoye','confirme','en_preparation','expedie','livre','annule','accepte','refuse','expire']).optional(),
  acompte:          z.number().optional(),
  dateLivraison:    z.string().optional(),
  adresseLivraison: z.string().optional(),
  notes:            z.string().optional(),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const body = await parseBody(req);
  if (handleOptions(req, res)) return;
  const ctx = await requireTenantAuth(req, res);
  if (!ctx) return;

  const { id } = req.query as { id: string };
  const db = getDb();

  if (req.method === 'GET') {
    try {
      const [row] = await db.select().from(commandes)
        .where(and(eq(commandes.id, id), eq(commandes.tenantId, ctx.tenantId!)))
        .limit(1);
      if (!row) return err(res, 'Commande introuvable', 404);
      return ok(res, numericRow(row));
    } catch (e) { return err(res, 'Erreur serveur', 500); }
  }

  if (req.method === 'PATCH') {
    const parsed = PatchSchema.safeParse(body);
    if (!parsed.success) return err(res, 'Données invalides', 422);
    try {
      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (parsed.data.statut) updates.statut = parsed.data.statut;
      if (parsed.data.notes !== undefined) updates.notes = parsed.data.notes;
      if (parsed.data.adresseLivraison !== undefined) updates.adresseLivraison = parsed.data.adresseLivraison;
      if (parsed.data.dateLivraison) updates.dateLivraison = new Date(parsed.data.dateLivraison);
      if (parsed.data.acompte !== undefined) {
        const [existing] = await db.select().from(commandes)
            .where(and(eq(commandes.id, id), eq(commandes.tenantId, ctx.tenantId!)))
            .limit(1);
        if (existing) {
          updates.acompte = String(parsed.data.acompte);
          updates.resteAPayer = String(Number(existing.totalTTC) - parsed.data.acompte);
        }
      }
      const [row] = await db.update(commandes)
        .set(updates as Parameters<ReturnType<typeof db.update>['set']>[0])
        .where(and(eq(commandes.id, id), eq(commandes.tenantId, ctx.tenantId!)))
        .returning();
      if (!row) return err(res, 'Commande introuvable', 404);
      return ok(res, numericRow(row));
    } catch (e) { return err(res, 'Erreur serveur', 500); }
  }

  return err(res, 'Méthode non autorisée', 405);
}
