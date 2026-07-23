import { getDb } from './client.js';
import { sql } from 'drizzle-orm';

async function migrate() {
  console.log('🚀 Ensuring inventaires table exists in Postgres...');
  const db = getDb();
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS inventaires (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id),
      date TIMESTAMP NOT NULL DEFAULT NOW(),
      utilisateur_id TEXT NOT NULL,
      utilisateur_nom TEXT NOT NULL,
      statut TEXT NOT NULL DEFAULT 'en_cours',
      lignes JSONB NOT NULL DEFAULT '[]'::jsonb,
      notes TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);
  console.log('✅ Table inventaires is ready on Neon Postgres!');
  process.exit(0);
}

migrate().catch(err => {
  console.error('❌ Migration error:', err);
  process.exit(1);
});
