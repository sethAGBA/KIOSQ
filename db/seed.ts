/**
 * Seed script — inserts demo data into a fresh Neon DB.
 * Run with: npx tsx db/seed.ts
 * Requires DATABASE_URL in environment.
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import { getDb } from './client';
import {
  users, categories, fournisseurs, produits,
  clients, commandes, factures,
} from './schema';

async function seed() {
  const db = getDb();
  console.log('🌱 Seeding database…');

  // ── Users ────────────────────────────────────────────
  const passwordHash = await bcrypt.hash('demo1234', 12);
  await db.insert(users).values([
    { id: 'u1', email: 'admin@kiosq.com',      passwordHash, nom: 'Diallo',  prenom: 'Mamadou', role: 'admin',        actif: true },
    { id: 'u2', email: 'commercial@kiosq.com', passwordHash, nom: 'Sow',     prenom: 'Fatou',   role: 'commercial',   actif: true },
    { id: 'u3', email: 'comptable@kiosq.com',  passwordHash, nom: 'Ba',      prenom: 'Ibrahim', role: 'comptable',    actif: true },
    { id: 'u4', email: 'gest@kiosq.com',       passwordHash, nom: 'Ndiaye',  prenom: 'Aminata', role: 'gestionnaire', actif: true },
  ]).onConflictDoNothing();
  console.log('  ✓ Users');

  // ── Categories ───────────────────────────────────────
  await db.insert(categories).values([
    { id: 'c1', nom: 'Électronique',  couleur: '#3b82f6' },
    { id: 'c2', nom: 'Mobilier',      couleur: '#8b5cf6' },
    { id: 'c3', nom: 'Fournitures',   couleur: '#10b981' },
    { id: 'c4', nom: 'Informatique',  couleur: '#f59e0b' },
    { id: 'c5', nom: 'Téléphonie',    couleur: '#ef4444' },
  ]).onConflictDoNothing();
  console.log('  ✓ Catégories');

  // ── Fournisseurs ─────────────────────────────────────
  await db.insert(fournisseurs).values([
    { id: 'f1', nom: 'TechDistrib SA',      contact: 'Alioune Camara', email: 'contact@techdistrib.sn', telephone: '+221 33 800 00 01', pays: 'Sénégal',         delaiLivraison: 5,  conditionsPaiement: '30 jours', soldeDette: '450000',  totalAchats: '12500000' },
    { id: 'f2', nom: 'Bureau Plus SARL',    contact: 'Mariam Koné',    email: 'mariam@bureauplus.ci',   telephone: '+225 27 20 30 01',  pays: 'Côte d\'Ivoire', delaiLivraison: 10, conditionsPaiement: '60 jours', soldeDette: '0',       totalAchats: '3200000'  },
    { id: 'f3', nom: 'Global Office Group', contact: 'Jean Mensah',    email: 'j.mensah@globaloffice.com', telephone: '+228 22 20 00 01', pays: 'Togo',          delaiLivraison: 14, conditionsPaiement: '45 jours', soldeDette: '185000',  totalAchats: '6800000'  },
  ]).onConflictDoNothing();
  console.log('  ✓ Fournisseurs');

  // ── Produits ─────────────────────────────────────────
  await db.insert(produits).values([
    { id: 'p1', reference: 'ELEC-001', designation: 'Ordinateur portable Dell XPS 15', categorieId: 'c4', fournisseurId: 'f1', unite: 'pièce', marque: 'Dell',  prixAchat: '850000',  prixVente: '1100000', stockActuel: 12, stockMinimum: 3  },
    { id: 'p2', reference: 'ELEC-002', designation: 'Écran Samsung 27" 4K',           categorieId: 'c1', fournisseurId: 'f1', unite: 'pièce', marque: 'Samsung',prixAchat: '280000',  prixVente: '380000',  stockActuel: 2,  stockMinimum: 5  },
    { id: 'p3', reference: 'MOB-001',  designation: 'Bureau ergonomique 160cm',        categorieId: 'c2', fournisseurId: 'f2', unite: 'pièce',                   prixAchat: '95000',   prixVente: '145000',  stockActuel: 8,  stockMinimum: 2  },
    { id: 'p4', reference: 'FOUR-001', designation: 'Ramette papier A4 80g',           categorieId: 'c3', fournisseurId: 'f3', unite: 'ramette',                 prixAchat: '3500',    prixVente: '5500',    stockActuel: 150,stockMinimum: 50 },
    { id: 'p5', reference: 'TEL-001',  designation: 'iPhone 15 Pro 256 Go',            categorieId: 'c5', fournisseurId: 'f1', unite: 'pièce', marque: 'Apple',  prixAchat: '650000',  prixVente: '850000',  stockActuel: 5,  stockMinimum: 3  },
    { id: 'p6', reference: 'FOUR-002', designation: 'Stylos bille Bic (boîte 50)',     categorieId: 'c3', fournisseurId: 'f3', unite: 'boîte',                   prixAchat: '2500',    prixVente: '4500',    stockActuel: 0,  stockMinimum: 10 },
    { id: 'p7', reference: 'ELEC-003', designation: 'Imprimante HP LaserJet Pro',      categorieId: 'c4', fournisseurId: 'f1', unite: 'pièce', marque: 'HP',     prixAchat: '180000',  prixVente: '245000',  stockActuel: 4,  stockMinimum: 2  },
  ]).onConflictDoNothing();
  console.log('  ✓ Produits');

  // ── Clients ──────────────────────────────────────────
  await db.insert(clients).values([
    { id: 'cl1', code: 'CLI-001', nom: 'Groupe Sonatel',           typeClient: 'entreprise', email: 'achats@sonatel.sn',         telephone: '+221 33 800 10 00', ville: 'Dakar',  pays: 'Sénégal', secteurActivite: 'Télécommunications', commercial: 'Fatou Sow', totalAchats: '8500000',  soldeCredit: '350000', nombreCommandes: 24 },
    { id: 'cl2', code: 'CLI-002', nom: 'CBAO Banque',              typeClient: 'entreprise', email: 'dsi@cbao.sn',               telephone: '+221 33 800 20 00', ville: 'Dakar',  pays: 'Sénégal', secteurActivite: 'Finance',             commercial: 'Fatou Sow', totalAchats: '5200000',  soldeCredit: '0',      nombreCommandes: 15 },
    { id: 'cl3', code: 'CLI-003', nom: 'Ousmane Touré',            typeClient: 'particulier',email: 'o.toure@gmail.com',         telephone: '+221 76 500 30 00', ville: 'Thiès',  pays: 'Sénégal',                                        commercial: 'Fatou Sow', totalAchats: '1250000',  soldeCredit: '0',      nombreCommandes: 6  },
    { id: 'cl4', code: 'CLI-004', nom: 'Ministère de l\'Éducation',typeClient: 'entreprise', email: 'daf@education.gouv.sn',     telephone: '+221 33 800 40 00', ville: 'Dakar',  pays: 'Sénégal', secteurActivite: 'Administration',      commercial: 'Fatou Sow', totalAchats: '22000000', soldeCredit: '0',      nombreCommandes: 42 },
    { id: 'cl5', code: 'CLI-005', nom: 'Start Innov SARL',         typeClient: 'entreprise', email: 'finance@startinnov.com',    telephone: '+221 77 600 50 00', ville: 'Dakar',  pays: 'Sénégal', secteurActivite: 'Tech',                commercial: 'Fatou Sow', totalAchats: '980000',   soldeCredit: '175000', nombreCommandes: 8  },
  ]).onConflictDoNothing();
  console.log('  ✓ Clients');

  console.log('\n✅ Seed terminé !');
  console.log('   Connexion : admin@kiosq.com / demo1234');
  process.exit(0);
}

seed().catch((e) => { console.error('❌ Seed échoué :', e); process.exit(1); });
