import type { VercelRequest, VercelResponse } from '@vercel/node';
import { and, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import bcrypt from 'bcryptjs';
import { getDb } from '../../../db/client.js';
import { tenants, users, factures } from '../../../db/schema.js';
import { requireSuperadmin, handleOptions } from '../../_lib/auth.js';
import { ok, err, parseBody } from '../../_lib/response.js';

export const config = { api: { bodyParser: true } };

// ── Slug helper ───────────────────────────────────────────
/**
 * Transforms an arbitrary name into a URL-safe slug.
 * - Lowercase
 * - Replace non-alphanumeric characters with `-`
 * - Collapse multiple consecutive `-` into one
 * - Trim leading/trailing `-`
 * - Guarantee length ≥ 1 (fallback to 'boutique')
 */
export function generateSlug(nom: string): string {
  const slug = nom
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug.length >= 1 ? slug : 'boutique';
}

// ── Validation schemas ────────────────────────────────────

const CreateTenantSchema = z.object({
  nom:        z.string().min(1),
  emailAdmin: z.string().email(),
  plan:       z.enum(['starter', 'pro', 'enterprise']),
  devise:     z.string().min(1).default('XOF'),
  pays:       z.string().optional(),
  slug:       z.string().optional(), // can be overridden; otherwise auto-generated
});

// ── Handler ───────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) return;

  const ctx = await requireSuperadmin(req, res);
  if (!ctx) return;

  const db = getDb();

  // ── GET /api/superadmin/tenants ───────────────────────
  if (req.method === 'GET') {
    try {
      const { statut, plan, q } = req.query as Record<string, string | undefined>;

      // Build the base tenant query with optional filters
      const statutCondition =
        statut && ['actif', 'suspendu', 'essai'].includes(statut)
          ? eq(tenants.statut, statut as 'actif' | 'suspendu' | 'essai')
          : undefined;

      const planCondition =
        plan && ['starter', 'pro', 'enterprise'].includes(plan)
          ? eq(tenants.plan, plan as 'starter' | 'pro' | 'enterprise')
          : undefined;

      const searchCondition =
        q && q.trim()
          ? or(ilike(tenants.nom, `%${q.trim()}%`), ilike(tenants.slug, `%${q.trim()}%`))
          : undefined;

      const whereClause = and(statutCondition, planCondition, searchCondition);

      const tenantRows = await db
        .select()
        .from(tenants)
        .where(whereClause)
        .orderBy(desc(tenants.createdAt));

      if (tenantRows.length === 0) {
        return ok(res, []);
      }

      const tenantIds = tenantRows.map((t) => t.id);

      // Count users per tenant
      const userCountRows = await db
        .select({
          tenantId: users.tenantId,
          count: sql<string>`COUNT(*)`,
        })
        .from(users)
        .where(inArray(users.tenantId, tenantIds as [string, ...string[]]))
        .groupBy(users.tenantId);

      // Sum CA (totalTTC of paid factures) per tenant
      const caRows = await db
        .select({
          tenantId: factures.tenantId,
          caTotal: sql<string>`COALESCE(SUM(${factures.totalTTC}), 0)`,
        })
        .from(factures)
        .where(
          and(
            inArray(factures.tenantId, tenantIds as [string, ...string[]]),
            eq(factures.statut, 'payee'),
          )
        )
        .groupBy(factures.tenantId);

      // Build lookup maps
      const userCountMap = new Map(
        userCountRows.map((r) => [r.tenantId, Number(r.count)])
      );
      const caMap = new Map(
        caRows.map((r) => [r.tenantId, Number(r.caTotal)])
      );

      const data = tenantRows.map((t) => ({
        ...t,
        nombreUtilisateurs: userCountMap.get(t.id) ?? 0,
        caTotal:             caMap.get(t.id) ?? 0,
      }));

      return ok(res, data);
    } catch (e) {
      console.error('[superadmin/tenants GET]', e);
      return err(res, 'Erreur serveur', 500);
    }
  }

  // ── POST /api/superadmin/tenants ──────────────────────
  if (req.method === 'POST') {
    const body = await parseBody(req);
    const parsed = CreateTenantSchema.safeParse(body);
    if (!parsed.success) {
      return err(res, 'Données invalides : ' + parsed.error.issues.map((i) => i.message).join(', '), 422);
    }

    const { nom, emailAdmin, plan, devise, pays, slug: slugOverride } = parsed.data;

    try {
      // Generate (or use provided) slug and ensure uniqueness
      let baseSlug = slugOverride ? generateSlug(slugOverride) : generateSlug(nom);

      // Check for existing slug and append suffix if necessary
      const existing = await db
        .select({ slug: tenants.slug })
        .from(tenants)
        .where(ilike(tenants.slug, `${baseSlug}%`));

      const existingSlugs = new Set(existing.map((r) => r.slug));
      let finalSlug = baseSlug;
      let counter = 2;
      while (existingSlugs.has(finalSlug)) {
        finalSlug = `${baseSlug}-${counter}`;
        counter++;
      }

      // Create tenant
      const tenantId = nanoid();
      const [newTenant] = await db
        .insert(tenants)
        .values({
          id:        tenantId,
          nom,
          slug:      finalSlug,
          plan,
          statut:    'actif',
          devise,
          pays,
          email:     emailAdmin, // boutique contact email defaults to admin email
        })
        .returning();

      // Generate temporary password (≥12 chars via nanoid(12))
      const tempPassword = nanoid(12);
      const passwordHash = await bcrypt.hash(tempPassword, 10);

      // Create Admin_Boutique user for the new tenant
      const userId = nanoid();
      const [nomParts] = emailAdmin.split('@');
      const [newUser] = await db
        .insert(users)
        .values({
          id:           userId,
          email:        emailAdmin,
          passwordHash,
          nom:          nomParts ?? 'Admin',
          prenom:       'Boutique',
          role:         'admin',
          actif:        true,
          tenantId:     tenantId,
          premiereConnexion: true,
          onboardingStep:    0,
        })
        .returning({
          id:        users.id,
          email:     users.email,
          nom:       users.nom,
          prenom:    users.prenom,
          role:      users.role,
          createdAt: users.createdAt,
        });

      // Simulate welcome email (console log in dev)
      console.log('[email] Welcome:', emailAdmin, tempPassword);

      return ok(res, {
        tenant:        newTenant,
        adminUser:     newUser,
        tempPassword,  // returned so superadmin can relay it; remove in a real email flow
      }, 201);
    } catch (e: any) {
      if (e?.code === '23505') {
        // Unique constraint violation (slug or email)
        if (e?.detail?.includes('slug')) return err(res, 'Ce slug est déjà utilisé', 409);
        if (e?.detail?.includes('email')) return err(res, 'Cet email est déjà utilisé', 409);
        return err(res, 'Conflit de données', 409);
      }
      console.error('[superadmin/tenants POST]', e);
      return err(res, 'Erreur serveur', 500);
    }
  }

  return err(res, 'Méthode non autorisée', 405);
}
