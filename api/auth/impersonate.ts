import type { VercelRequest, VercelResponse } from '@vercel/node';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../../db/client.js';
import { tenants, users } from '../../db/schema.js';
import { signToken, requireSuperadmin, handleOptions } from '../_lib/auth.js';
import { ok, err, parseBody } from '../_lib/response.js';
import { logAction, AUDIT_ACTIONS } from '../_lib/auditLog.js';

export const config = { api: { bodyParser: true } };

const ImpersonateSchema = z.object({
  tenantId: z.string().min(1),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) return;
  if (req.method !== 'POST') return err(res, 'Méthode non autorisée', 405);

  const ctx = await requireSuperadmin(req, res);
  if (!ctx) return;

  const body = await parseBody(req);
  const parsed = ImpersonateSchema.safeParse(body);
  if (!parsed.success) {
    return err(res, 'Données invalides', 422);
  }

  const { tenantId } = parsed.data;

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
    });
  } catch (e) {
    console.error('[impersonate]', e);
    return err(res, 'Erreur serveur', 500);
  }
}
