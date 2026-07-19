import type { VercelRequest, VercelResponse } from '@vercel/node';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../../db/client';
import { produits } from '../../db/schema';
import { requireAuth, handleOptions } from '../_lib/auth';
import { ok, err, numericRow } from '../_lib/response';

const PatchSchema = z.object({
  designation:   z.string().optional(),
  description:   z.string().optional(),
  categorieId:   z.string().optional(),
  fournisseurId: z.string().optional(),
  unite:         z.string().optional(),
  marque:        z.string().optional(),
  prixAchat:     z.number().optional(),
  prixVente:     z.number().optional(),
  prixVenteGros: z.number().optional(),
  stockActuel:   z.number().int().optional(),
  stockMinimum:  z.number().int().optional(),
  stockMaximum:  z.number().int().optional(),
  emplacement:   z.string().optional(),
  actif:         z.boolean().optional(),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) return;
  const ctx = await requireAuth(req, res);
  if (!ctx) return;

  const { id } = req.query as { id: string };
  const db = getDb();

  if (req.method === 'GET') {
    try {
      const [row] = await db.select().from(produits).where(eq(produits.id, id)).limit(1);
      if (!row) return err(res, 'Produit introuvable', 404);
      return ok(res, numericRow(row));
    } catch (e) { return err(res, 'Erreur serveur', 500); }
  }

  if (req.method === 'PATCH') {
    if (!['admin', 'gestionnaire'].includes(ctx.role)) return err(res, 'Accès refusé', 403);
    const parsed = PatchSchema.safeParse(req.body);
    if (!parsed.success) return err(res, 'Données invalides', 422);
    try {
      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (parsed.data.designation   !== undefined) updates.designation   = parsed.data.designation;
      if (parsed.data.description   !== undefined) updates.description   = parsed.data.description;
      if (parsed.data.categorieId   !== undefined) updates.categorieId   = parsed.data.categorieId;
      if (parsed.data.fournisseurId !== undefined) updates.fournisseurId = parsed.data.fournisseurId;
      if (parsed.data.unite         !== undefined) updates.unite         = parsed.data.unite;
      if (parsed.data.marque        !== undefined) updates.marque        = parsed.data.marque;
      if (parsed.data.prixAchat     !== undefined) updates.prixAchat     = String(parsed.data.prixAchat);
      if (parsed.data.prixVente     !== undefined) updates.prixVente     = String(parsed.data.prixVente);
      if (parsed.data.prixVenteGros !== undefined) updates.prixVenteGros = String(parsed.data.prixVenteGros);
      if (parsed.data.stockActuel   !== undefined) updates.stockActuel   = parsed.data.stockActuel;
      if (parsed.data.stockMinimum  !== undefined) updates.stockMinimum  = parsed.data.stockMinimum;
      if (parsed.data.stockMaximum  !== undefined) updates.stockMaximum  = parsed.data.stockMaximum;
      if (parsed.data.emplacement   !== undefined) updates.emplacement   = parsed.data.emplacement;
      if (parsed.data.actif         !== undefined) updates.actif         = parsed.data.actif;
      const [row] = await db.update(produits)
        .set(updates as Parameters<ReturnType<typeof db.update<typeof produits>>['set']>[0])
        .where(eq(produits.id, id))
        .returning();
      if (!row) return err(res, 'Produit introuvable', 404);
      return ok(res, numericRow(row));
    } catch (e) { return err(res, 'Erreur serveur', 500); }
  }

  if (req.method === 'DELETE') {
    if (ctx.role !== 'admin') return err(res, 'Accès refusé', 403);
    try {
      await db.update(produits).set({ actif: false, updatedAt: new Date() }).where(eq(produits.id, id));
      return ok(res, { message: 'Produit désactivé' });
    } catch (e) { return err(res, 'Erreur serveur', 500); }
  }

  return err(res, 'Méthode non autorisée', 405);
}
