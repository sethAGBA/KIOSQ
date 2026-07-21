import type { VercelRequest, VercelResponse } from '@vercel/node';
import { lte, eq } from 'drizzle-orm';
import { getDb } from '../../db/client.js';
import { produits, factures, commandesFournisseurs } from '../../db/schema.js';
import { requireAuth, handleOptions } from '../_lib/auth.js';
import { ok, err } from '../_lib/response.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) return;
  const ctx = await requireAuth(req, res);
  if (!ctx) return;

  if (req.method !== 'GET') return err(res, 'Méthode non autorisée', 405);

  try {
    const db = getDb();

    // Produits en alerte stock (stock_actuel <= stock_minimum)
    const alertesProduits = await db
      .select({ id: produits.id, designation: produits.designation, reference: produits.reference, stockActuel: produits.stockActuel, stockMinimum: produits.stockMinimum })
      .from(produits)
      .where(lte(produits.stockActuel, produits.stockMinimum));

    // Factures en retard
    const facturesRetard = await db
      .select({ id: factures.id, numero: factures.numero, clientNom: factures.clientNom, resteAPayer: factures.resteAPayer })
      .from(factures)
      .where(eq(factures.statut, 'en_retard'));

    // Commandes fournisseurs en attente (commandee)
    const cfEnAttente = await db
      .select({ id: commandesFournisseurs.id, numero: commandesFournisseurs.numero, fournisseurNom: commandesFournisseurs.fournisseurNom })
      .from(commandesFournisseurs)
      .where(eq(commandesFournisseurs.statut, 'commandee'));

    // Construire les notifications dynamiquement
    const notifications: {
      id: string;
      type: string;
      titre: string;
      message: string;
      lu: boolean;
      lien: string;
      createdAt: string;
    }[] = [];

    for (const p of alertesProduits) {
      const rupture = Number(p.stockActuel) === 0;
      notifications.push({
        id: `alerte-${p.id}`,
        type: 'alerte_stock',
        titre: rupture ? 'Rupture de stock' : 'Stock bas',
        message: rupture
          ? `${p.designation} (${p.reference}) : stock à 0`
          : `${p.designation} : ${p.stockActuel} unité(s) (min: ${p.stockMinimum})`,
        lu: false,
        lien: '/produits',
        createdAt: new Date().toISOString(),
      });
    }

    for (const f of facturesRetard) {
      notifications.push({
        id: `retard-${f.id}`,
        type: 'facture_due',
        titre: 'Facture en retard',
        message: `${f.numero} — ${f.clientNom} : ${Number(f.resteAPayer).toLocaleString('fr-FR')} F dû`,
        lu: false,
        lien: '/facturation',
        createdAt: new Date().toISOString(),
      });
    }

    for (const cf of cfEnAttente) {
      notifications.push({
        id: `cf-${cf.id}`,
        type: 'commande',
        titre: 'Commande fournisseur en attente',
        message: `${cf.numero} — ${cf.fournisseurNom} : en attente de réception`,
        lu: false,
        lien: '/achats',
        createdAt: new Date().toISOString(),
      });
    }

    return ok(res, notifications);
  } catch (e) {
    console.error('[notifications GET]', e);
    return err(res, 'Erreur serveur', 500);
  }
}
