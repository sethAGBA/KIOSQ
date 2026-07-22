import type { VercelRequest, VercelResponse } from '@vercel/node';
import { and, eq } from 'drizzle-orm';
import { getDb } from '../../../../db/client.js';
import { tenants, users } from '../../../../db/schema.js';
import { signToken, requireSuperadmin, handleOptions } from '../../../_lib/auth.js';
import { ok, err } from '../../../_lib/response.js';
import { logAction, AUDIT_ACTIONS } from '../../../_lib/auditLog.js';

export const config = { api: { bodyParser: false } };

/**
 * POST /api/superadmin/tenants/:id/impersonate
 *
 * Superadmin-only. Emits a short-lived (2h) impersonation JWT scoped to the
 * target tenant's admin user. The tenantId is taken from the URL parameter
 * rather than the request body.
 *
 * Requirements: 6.1, 6.2, 6.5
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) return;
  if (req.method !== 'POST') return err(res, 'Méthode non autorisée', 405);

  const ctx = await requireSuperadmin(req, res);
  if (!ctx) return;

  const tenantId = req.query.id as string;
  if (!tenantId) return err(res, 'tenantId manquant', 400);

  try {
    const db = getDb();

    // Vérifier que le tenant existe et récupérer son nom
    const [tenant] = await db
      .select({ id: tenants.id, nom: tenants.nom })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    if (!tenant) return err(res, 'Boutique introuvable', 404);

    // Charger l'Admin_Boutique principal du tenant (premier utilisateur actif avec rôle 'admin')
    const [adminUser] = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.tenantId, tenantId),
          eq(users.role, 'admin'),
          eq(users.actif, true)
        )
      )
      .limit(1);

    if (!adminUser) return err(res, "Aucun administrateur actif trouvé pour cette boutique", 404);

    // Émettre un JWT d'impersonation valable 2h
    const token = await signToken({
      sub:            adminUser.id,
      email:          adminUser.email,
      role:           'admin',
      nom:            adminUser.nom,
      prenom:         adminUser.prenom,
      tenantId,
      impersonatedBy: ctx.sub,
      expiresIn:      '2h',
    });

    // Enregistrer l'audit log dans le tenant cible
    const ip = req.headers['x-forwarded-for'] as string | undefined;
    await logAction(
      db,
      tenantId,
      ctx.sub,
      AUDIT_ACTIONS.IMPERSONATION_START,
      'tenant',
      tenantId,
      undefined,
      ip
    );

    return ok(res, {
      token,
      tenantNom: tenant.nom,
      tenantId,
    });
  } catch (e) {
    console.error('[superadmin/impersonate]', e);
    return err(res, 'Erreur serveur', 500);
  }
}
