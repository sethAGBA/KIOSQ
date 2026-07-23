import { getDb } from './client.js';
import { sql } from 'drizzle-orm';

async function migrate() {
  console.log('🚀 Ensuring clotures_caisse table exists in Postgres...');
  const db = getDb();
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS clotures_caisse (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id),
      date TIMESTAMP NOT NULL DEFAULT NOW(),
      total_ventes NUMERIC(15, 2) NOT NULL,
      nb_ventes INTEGER NOT NULL DEFAULT 0,
      repartition JSONB NOT NULL DEFAULT '{}'::jsonb,
      montant_theorique NUMERIC(15, 2) NOT NULL,
      montant_reel NUMERIC(15, 2) NOT NULL,
      ecart NUMERIC(15, 2) NOT NULL,
      notes TEXT,
      utilisateur_id TEXT NOT NULL,
      utilisateur_nom TEXT NOT NULL,
      vendeur_id TEXT NOT NULL,
      vendeur_nom TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);
  console.log('✅ Table clotures_caisse is ready on Neon Postgres!');
  process.exit(0);
}

migrate().catch(err => {
  console.error('❌ Migration error:', err);
  process.exit(1);
});
