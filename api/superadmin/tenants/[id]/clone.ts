import type { VercelRequest, VercelResponse } from '@vercel/node';
import { eq, ilike } from 'drizzle-orm';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import bcrypt from 'bcryptjs';
import { getDb } from '../../../../db/client.js';
import { tenants, users, parametres, categories, produits } from '../../../../db/schema.js';
import { requireSuperadmin, handleOptions } from '../../../_lib/auth.js';
import { ok, err, parseBody } from '../../../_lib/response.js';
import { generateSlug } from '../index.js';

export const config = { api: { bodyParser: true } };

// ── Validation schema ─────────────────────────────────────

const CloneTenantSchema = z.object({
  nom:   z.string().min(1),
  email: z.string().email(),
  slug:  z.string().optional(),
  plan:  z.enum(['starter', 'pro', 'enterprise']).optional().default('starter'),
});

// ── Handler ───────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) return;

  const ctx = await requireSuperadmin(req, res);
  if (!ctx) return;

  if (req.method !== 'POST') {
    return err(res, 'Méthode non autorisée', 405);
  }

  const sourceTenantId = req.query.id as string;
  if (!sourceTenantId) {
    return err(res, 'ID du tenant source manquant', 400);
  }

  const db = getDb();

  // ── 1. Validate request body ─────────────────────────
  const body = await parseBody(req);
  const parsed = CloneTenantSchema.safeParse(body);
  if (!parsed.success) {
    return err(res, 'Données invalides : ' + parsed.error.issues.map((i) => i.message).join(', '), 422);
  }

  const { nom, email, slug: slugOverride, plan } = parsed.data;

  try {
    // ── 2. Load source tenant ────────────────────────────
    const [sourceTenant] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, sourceTenantId))
      .limit(1);

    if (!sourceTenant) {
      return err(res, 'Tenant source introuvable', 404);
    }

    // ── 3. Load source data to clone ──────────────────────
    const [sourceParametres, sourceCategories, sourceProduits] = await Promise.all([
      db.select().from(parametres).where(eq(parametres.tenantId, sourceTenantId)),
      db.select().from(categories).where(eq(categories.tenantId, sourceTenantId)),
      db.select().from(produits).where(eq(produits.tenantId, sourceTenantId)),
    ]);

    // ── 4. Generate slug for new tenant ───────────────────
    const baseSlug = slugOverride ? generateSlug(slugOverride) : generateSlug(nom);

    const existingSlugs = await db
      .select({ slug: tenants.slug })
      .from(tenants)
      .where(ilike(tenants.slug, `${baseSlug}%`));

    const existingSlugSet = new Set(existingSlugs.map((r) => r.slug));
    let finalSlug = baseSlug;
    let counter = 2;
    while (existingSlugSet.has(finalSlug)) {
      finalSlug = `${baseSlug}-${counter}`;
      counter++;
    }

    // ── 5. Create new tenant ──────────────────────────────
    const newTenantId = nanoid();
    const [newTenant] = await db
      .insert(tenants)
      .values({
        id:     newTenantId,
        nom,
        slug:   finalSlug,
        plan,
        statut: 'actif',
        devise: sourceTenant.devise,
        pays:   sourceTenant.pays ?? undefined,
        email,
      })
      .returning();

    // ── 6. Copy parametres (upsert-style with new id) ─────
    let parametresCloned = 0;
    if (sourceParametres.length > 0) {
      const srcParam = sourceParametres[0];
      await db.insert(parametres).values({
        id:         `default-${newTenantId}`,
        nom:        srcParam.nom,
        adresse:    srcParam.adresse ?? undefined,
        telephone:  srcParam.telephone ?? undefined,
        email:      srcParam.email ?? undefined,
        siteWeb:    srcParam.siteWeb ?? undefined,
        siret:      srcParam.siret ?? undefined,
        devise:     srcParam.devise,
        tva:        srcParam.tva,
        piedDePage: srcParam.piedDePage ?? undefined,
        logoUrl:    srcParam.logoUrl ?? undefined,
        tenantId:   newTenantId,
      });
      parametresCloned = 1;
    }

    // ── 7. Copy categories (track old→new id mapping) ─────
    const categoryIdMap = new Map<string, string>();
    let categoriesCloned = 0;

    if (sourceCategories.length > 0) {
      const categoryValues = sourceCategories.map((cat) => {
        const newCatId = nanoid();
        categoryIdMap.set(cat.id, newCatId);
        return {
          id:          newCatId,
          nom:         cat.nom,
          description: cat.description ?? undefined,
          couleur:     cat.couleur ?? undefined,
          tenantId:    newTenantId,
        };
      });

      await db.insert(categories).values(categoryValues);
      categoriesCloned = categoryValues.length;
    }

    // ── 8. Copy produits (remap categorieId via mapping) ──
    let produitsCloned = 0;

    if (sourceProduits.length > 0) {
      const produitValues = sourceProduits.map((prod) => {
        const newProdId = nanoid();
        const newCategorieId = prod.categorieId
          ? (categoryIdMap.get(prod.categorieId) ?? null)
          : null;

        return {
          id:             newProdId,
          reference:      `${prod.reference}-${newTenantId.slice(0, 4)}`,
          designation:    prod.designation,
          description:    prod.description ?? undefined,
          categorieId:    newCategorieId ?? undefined,
          // fournisseurId and magasinId are not cloned (belong to source tenant)
          unite:          prod.unite,
          marque:         prod.marque ?? undefined,
          prixAchat:      prod.prixAchat,
          prixVente:      prod.prixVente,
          prixVenteGros:  prod.prixVenteGros ?? undefined,
          stockActuel:    0,    // reset stock for cloned tenant
          stockMinimum:   prod.stockMinimum,
          stockMaximum:   prod.stockMaximum ?? undefined,
          datePeremption: prod.datePeremption ?? undefined,
          emplacement:    prod.emplacement ?? undefined,
          codeBarres:     prod.codeBarres ?? undefined,
          actif:          prod.actif,
          tenantId:       newTenantId,
        };
      });

      await db.insert(produits).values(produitValues);
      produitsCloned = produitValues.length;
    }

    // ── 9. Create Admin_Boutique user ─────────────────────
    const tempPassword = nanoid(12);
    const passwordHash = await bcrypt.hash(tempPassword, 10);
    const userId = nanoid();
    const [nomParts] = email.split('@');

    const [newUser] = await db
      .insert(users)
      .values({
        id:                userId,
        email,
        passwordHash,
        nom:               nomParts ?? 'Admin',
        prenom:            'Boutique',
        role:              'admin',
        actif:             true,
        tenantId:          newTenantId,
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

    // ── 10. Log welcome email (console in dev) ────────────
    console.log('[email] Welcome (clone):', email, tempPassword, '→ tenant:', newTenantId);

    // ── 11. Return summary ────────────────────────────────
    return ok(res, {
      tenant:      newTenant,
      adminUser:   newUser,
      tempPassword,
      sourceTenantId,
      cloned: {
        parametres: parametresCloned,
        categories: categoriesCloned,
        produits:   produitsCloned,
      },
    }, 201);
  } catch (e: any) {
    if (e?.code === '23505') {
      if (e?.detail?.includes('slug'))      return err(res, 'Ce slug est déjà utilisé', 409);
      if (e?.detail?.includes('email'))     return err(res, 'Cet email est déjà utilisé', 409);
      if (e?.detail?.includes('reference')) return err(res, 'Conflit de référence produit', 409);
      return err(res, 'Conflit de données', 409);
    }
    console.error('[superadmin/tenants/clone POST]', e);
    return err(res, 'Erreur serveur', 500);
  }
}
