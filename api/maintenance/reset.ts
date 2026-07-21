import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from 'drizzle-orm';
import { getDb } from '../../db/client.js';
import { requireAuth, handleOptions } from '../_lib/auth.js';
import { ok, err } from '../_lib/response.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) return;
  const ctx = await requireAuth(req, res);
  if (!ctx) return;

  // Seuls les admins peuvent réinitialiser la base de données
  if (ctx.role !== 'admin') {
    return err(res, 'Accès non autorisé', 403);
  }

  if (req.method !== 'POST') return err(res, 'Méthode non autorisée', 405);

  try {
    const db = getDb();
    
    // Vider toutes les tables commerciales (sauf users et parametres)
    // CASCADE permet de supprimer en ignorant les contraintes de clés étrangères (ex: lignes de factures liées aux produits)
    await db.execute(sql`
      TRUNCATE TABLE 
        factures, 
        commandes, 
        commandes_fournisseurs, 
        produits, 
        clients, 
        fournisseurs, 
        categories, 
        unites 
      CASCADE;
    `);

    return ok(res, { success: true, message: 'Base de données réinitialisée' });
  } catch (error: any) {
    console.error('[Reset DB Error]', error);
    return err(res, 'Erreur lors de la réinitialisation de la base de données', 500);
  }
}
