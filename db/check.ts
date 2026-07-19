import 'dotenv/config';
import { getDb } from './client';
import { users, clients, produits, categories, fournisseurs } from './schema';

async function check() {
  const db = getDb();
  const [u, c, p, cat, f] = await Promise.all([
    db.select().from(users),
    db.select().from(clients),
    db.select().from(produits),
    db.select().from(categories),
    db.select().from(fournisseurs),
  ]);
  console.log('✅ Base de données Neon — état actuel :');
  console.log(`   Users        : ${u.length}`);
  console.log(`   Clients      : ${c.length}`);
  console.log(`   Produits     : ${p.length}`);
  console.log(`   Catégories   : ${cat.length}`);
  console.log(`   Fournisseurs : ${f.length}`);
  process.exit(0);
}

check().catch(e => { console.error('❌', e.message); process.exit(1); });
