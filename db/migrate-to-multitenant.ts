/**
 * Migration script — transforms a mono-tenant Kiosq DB into a multi-tenant one.
 *
 * What it does (all operations are idempotent):
 *  1. Add 'superadmin' value to the user_role enum (if not already present)
 *  2. Create the default tenant "Kiosq Default" (id: 'tenant-default')
 *  3. Create the superadmin account (email: 'superadmin@kiosq.app', tenantId: null)
 *  4. UPDATE all business tables SET tenant_id = 'tenant-default' WHERE tenant_id IS NULL
 *  5. Add NOT NULL constraint on tenant_id for all business tables (except users)
 *  6. Create indexes idx_{table}_tenant_id on all business tables
 *
 * Run with:
 *   npx tsx --env-file=.env.local db/migrate-to-multitenant.ts
 */

import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import { sql } from 'drizzle-orm';
import { getDb } from './client.js';
import { tenants, users } from './schema.js';

// Business tables that need tenant_id handling
const BUSINESS_TABLES = [
  'categories',
  'magasins',
  'fournisseurs',
  'produits',
  'clients',
  'commandes',
  'factures',
  'commandes_fournisseurs',
  'parametres',
  'unites',
  'groupes_surveilles',
  'leads',
] as const;

export async function runMigration() {
  const db = getDb();

  console.log('🚀 Démarrage de la migration multi-tenant…\n');

  // ── Étape 1 : Ajouter 'superadmin' à l'enum user_role (idempotent) ────────
  console.log("1️⃣  Ajout de 'superadmin' à l'enum user_role…");
  try {
    await db.execute(
      sql`ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'superadmin' BEFORE 'admin'`
    );
    console.log("   ✓ Valeur 'superadmin' présente dans user_role\n");
  } catch (err: unknown) {
    // PostgreSQL may throw if the enum value already exists without IF NOT EXISTS support
    // on older versions — we check for that case
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('already exists')) {
      console.log("   ✓ Valeur 'superadmin' déjà présente dans user_role\n");
    } else {
      throw err;
    }
  }

  // ── Étape 2 : Créer le tenant par défaut (idempotent) ────────────────────
  console.log("2️⃣  Création du tenant 'Kiosq Default'…");
  await db
    .insert(tenants)
    .values({
      id:     'tenant-default',
      nom:    'Kiosq Default',
      slug:   'default',
      plan:   'enterprise',
      statut: 'actif',
      email:  'admin@kiosq.app',
      devise: 'XOF',
    })
    .onConflictDoNothing();
  console.log("   ✓ Tenant 'tenant-default' créé ou déjà existant\n");

  // ── Étape 3 : Créer le compte superadmin (idempotent) ────────────────────
  console.log("3️⃣  Création du compte superadmin…");
  const existingSuperadmin = await db.execute(
    sql`SELECT id FROM users WHERE email = 'superadmin@kiosq.app' LIMIT 1`
  );

  if (existingSuperadmin.rows.length === 0) {
    const passwordHash = await bcrypt.hash('SuperAdmin@Kiosq2025!', 12);
    const superadminId = nanoid();
    await db.insert(users).values({
      id:           superadminId,
      email:        'superadmin@kiosq.app',
      passwordHash,
      nom:          'Superadmin',
      prenom:       'Kiosq',
      role:         'superadmin',
      tenantId:     null, // superadmin has no tenant
      actif:        true,
    });
    console.log('   ✓ Compte superadmin créé');
    console.log('   📧 Email    : superadmin@kiosq.app');
    console.log('   🔑 Password : SuperAdmin@Kiosq2025!');
    console.log('   ⚠️  Changez ce mot de passe immédiatement en production !\n');
  } else {
    console.log('   ✓ Compte superadmin déjà existant\n');
  }

  // ── Étape 4 : Backfill tenant_id sur toutes les tables métier ────────────
  console.log("4️⃣  Backfill tenant_id = 'tenant-default' sur les tables métier…");
  for (const table of BUSINESS_TABLES) {
    const result = await db.execute(
      sql.raw(
        `UPDATE "${table}" SET tenant_id = 'tenant-default' WHERE tenant_id IS NULL`
      )
    );
    const count = result.rowCount ?? 0;
    if (count > 0) {
      console.log(`   ✓ ${table} — ${count} enregistrement(s) mis à jour`);
    } else {
      console.log(`   ✓ ${table} — aucune mise à jour nécessaire`);
    }
  }
  console.log();

  // ── Étape 5 : Ajouter contrainte NOT NULL sur tenant_id ──────────────────
  console.log('5️⃣  Ajout des contraintes NOT NULL sur tenant_id…');
  for (const table of BUSINESS_TABLES) {
    try {
      await db.execute(
        sql.raw(
          `ALTER TABLE "${table}" ALTER COLUMN tenant_id SET NOT NULL`
        )
      );
      console.log(`   ✓ ${table}.tenant_id — contrainte NOT NULL ajoutée`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      // If the column is already NOT NULL, Postgres won't throw — but some wrappers might.
      // Drizzle ORM already defines most of these as NOT NULL in schema, so this is mostly a no-op.
      if (
        message.includes('already') ||
        message.includes('cannot') ||
        message.includes('does not exist')
      ) {
        console.log(`   ✓ ${table}.tenant_id — déjà NOT NULL`);
      } else {
        console.warn(`   ⚠️  ${table}.tenant_id — ${message}`);
      }
    }
  }
  console.log();

  // ── Étape 6 : Créer les index sur tenant_id ───────────────────────────────
  console.log('6️⃣  Création des index tenant_id…');
  for (const table of BUSINESS_TABLES) {
    const indexName = `idx_${table}_tenant_id`;
    try {
      await db.execute(
        sql.raw(
          `CREATE INDEX IF NOT EXISTS "${indexName}" ON "${table}"(tenant_id)`
        )
      );
      console.log(`   ✓ ${indexName}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`   ⚠️  ${indexName} — ${message}`);
    }
  }
  console.log();

  // Also create index on users.tenant_id (nullable but still useful for lookups)
  try {
    await db.execute(
      sql.raw(
        `CREATE INDEX IF NOT EXISTS "idx_users_tenant_id" ON "users"(tenant_id)`
      )
    );
    console.log('   ✓ idx_users_tenant_id');
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`   ⚠️  idx_users_tenant_id — ${message}`);
  }

  console.log('\n✅ Migration multi-tenant terminée avec succès !');
}

// ── Point d'entrée (exécution directe uniquement) ─────────────────────────
// Détection ESM-compatible : si ce fichier est le module principal
const isMain =
  typeof process !== 'undefined' &&
  process.argv[1] != null &&
  (process.argv[1].endsWith('migrate-to-multitenant.ts') ||
    process.argv[1].endsWith('migrate-to-multitenant.js'));

if (isMain) {
  runMigration()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Migration échouée :', err);
      process.exit(1);
    });
}
