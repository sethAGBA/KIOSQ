import { getDb } from './client.js';
import { sql } from 'drizzle-orm';

async function migrate() {
  console.log('🚀 Ensuring sorties_caisse table exists in Postgres...');
  const db = getDb();
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS sorties_caisse (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id),
      montant NUMERIC(15, 2) NOT NULL,
      motif TEXT NOT NULL,
      categorie TEXT NOT NULL,
      beneficiaire TEXT,
      utilisateur_id TEXT NOT NULL,
      utilisateur_nom TEXT NOT NULL,
      date TIMESTAMP NOT NULL DEFAULT NOW(),
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);
  console.log('✅ Table sorties_caisse is ready on Neon Postgres!');
  process.exit(0);
}

migrate().catch(err => {
  console.error('❌ Migration error:', err);
  process.exit(1);
});
