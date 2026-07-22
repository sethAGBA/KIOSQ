import type { VercelRequest, VercelResponse } from '@vercel/node';
import { eq, or } from 'drizzle-orm';
import { getDb } from '../../db/client.js';
import { tenants } from '../../db/schema.js';
import { handleOptions, setCors } from '../_lib/auth.js';
import { err } from '../_lib/response.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) return;

  if (req.method !== 'GET') {
    setCors(res);
    return err(res, 'Méthode non autorisée', 405);
  }

  setCors(res);

  const { slug, domaine } = req.query as Record<string, string>;

  if (!slug && !domaine) {
    return err(res, 'Paramètre slug ou domaine requis', 400);
  }

  try {
    const db = getDb();

    const conditions = [];
    if (slug) conditions.push(eq(tenants.slug, slug));
    if (domaine) conditions.push(eq(tenants.domaine, domaine));

    const [tenant] = await db
      .select({
        id:     tenants.id,
        slug:   tenants.slug,
        nom:    tenants.nom,
        plan:   tenants.plan,
        statut: tenants.statut,
      })
      .from(tenants)
      .where(or(...conditions))
      .limit(1);

    if (!tenant) {
      return err(res, 'Boutique introuvable', 404);
    }

    res.setHeader('Cache-Control', 'public, max-age=60');
    res.status(200).json({
      tenantId: tenant.id,
      slug:     tenant.slug,
      nom:      tenant.nom,
      plan:     tenant.plan,
      statut:   tenant.statut,
    });
  } catch (e) {
    console.error('[tenants/resolve GET]', e);
    return err(res, 'Erreur serveur', 500);
  }
}
