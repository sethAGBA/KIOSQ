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
  clients, commandes, factures, commandesFournisseurs,
  parametres, unites,
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

  // ── Date Helpers for historical seeding ────────────────
  const now = new Date();
  const getPastDate = (monthsAgo: number, day: number = 15) => {
    return new Date(now.getFullYear(), now.getMonth() - monthsAgo, day, 12, 0, 0);
  };

  // ── Commandes Clients ────────────────────────────────
  await db.insert(commandes).values([
    { id: 'cmd1', numero: 'CMD-2026-001', type: 'commande', clientId: 'cl1', clientNom: 'Groupe Sonatel', commercial: 'Fatou Sow', statut: 'confirme', totalHT: '101695', remiseGlobale: '0', tva: '18', totalTTC: '120000', acompte: '0', resteAPayer: '120000', dateCommande: getPastDate(0, 5), createdBy: 'u2' },
    { id: 'cmd2', numero: 'CMD-2026-002', type: 'commande', clientId: 'cl2', clientNom: 'CBAO Banque', commercial: 'Fatou Sow', statut: 'en_preparation', totalHT: '67797', remiseGlobale: '0', tva: '18', totalTTC: '80000', acompte: '20000', resteAPayer: '60000', dateCommande: getPastDate(0, 10), createdBy: 'u2' },
    { id: 'cmd3', numero: 'CMD-2026-003', type: 'commande', clientId: 'cl4', clientNom: 'Ministère de l\'Éducation', commercial: 'Fatou Sow', statut: 'expedie', totalHT: '254237', remiseGlobale: '0', tva: '18', totalTTC: '300000', acompte: '0', resteAPayer: '300000', dateCommande: getPastDate(1, 15), createdBy: 'u2' },
    { id: 'cmd4', numero: 'CMD-2026-004', type: 'commande', clientId: 'cl5', clientNom: 'Start Innov SARL', commercial: 'Fatou Sow', statut: 'livre', totalHT: '381356', remiseGlobale: '0', tva: '18', totalTTC: '450000', acompte: '450000', resteAPayer: '0', dateCommande: getPastDate(2, 12), createdBy: 'u2' },
  ]).onConflictDoNothing();
  console.log('  ✓ Commandes');

  // ── Factures Clients (covering rolling 12 months) ─────
  await db.insert(factures).values([
    // Unpaid/Overdue Factures
    { id: 'fact_retard', numero: 'FAC-2026-RETARD', clientId: 'cl1', clientNom: 'Groupe Sonatel', commandeId: 'cmd1', statut: 'en_retard', totalHT: '211864', remiseGlobale: '0', tva: '18', totalTTC: '250000', montantPaye: '0', resteAPayer: '250000', dateFacture: getPastDate(1, 1), dateEcheance: getPastDate(0, 5), createdBy: 'u3' },
    
    // Paid Factures for each of the past 12 months (to feed caParMois)
    { id: 'fact_m0_1', numero: 'FAC-2026-M0-1', clientId: 'cl1', clientNom: 'Groupe Sonatel', commandeId: 'cmd1', statut: 'payee', totalHT: '101695', remiseGlobale: '0', tva: '18', totalTTC: '120000', montantPaye: '120000', resteAPayer: '0', dateFacture: getPastDate(0, 5), dateEcheance: getPastDate(0, 25), createdBy: 'u3' },
    { id: 'fact_m0_2', numero: 'FAC-2026-M0-2', clientId: 'cl2', clientNom: 'CBAO Banque', commandeId: 'cmd2', statut: 'payee', totalHT: '67797', remiseGlobale: '0', tva: '18', totalTTC: '80000', montantPaye: '80000', resteAPayer: '0', dateFacture: getPastDate(0, 10), dateEcheance: getPastDate(0, 30), createdBy: 'u3' },
    { id: 'fact_m1', numero: 'FAC-2026-M1', clientId: 'cl4', clientNom: 'Ministère de l\'Éducation', commandeId: 'cmd3', statut: 'payee', totalHT: '254237', remiseGlobale: '0', tva: '18', totalTTC: '300000', montantPaye: '300000', resteAPayer: '0', dateFacture: getPastDate(1, 15), dateEcheance: getPastDate(1, 30), createdBy: 'u3' },
    { id: 'fact_m2', numero: 'FAC-2026-M2', clientId: 'cl5', clientNom: 'Start Innov SARL', commandeId: 'cmd4', statut: 'payee', totalHT: '381356', remiseGlobale: '0', tva: '18', totalTTC: '450000', montantPaye: '450000', resteAPayer: '0', dateFacture: getPastDate(2, 12), dateEcheance: getPastDate(2, 28), createdBy: 'u3' },
    { id: 'fact_m3', numero: 'FAC-2026-M3', clientId: 'cl1', clientNom: 'Groupe Sonatel', statut: 'payee', totalHT: '127118', remiseGlobale: '0', tva: '18', totalTTC: '150000', montantPaye: '150000', resteAPayer: '0', dateFacture: getPastDate(3, 20), dateEcheance: getPastDate(3, 30), createdBy: 'u3' },
    { id: 'fact_m4', numero: 'FAC-2026-M4', clientId: 'cl2', clientNom: 'CBAO Banque', statut: 'payee', totalHT: '508474', remiseGlobale: '0', tva: '18', totalTTC: '600000', montantPaye: '600000', resteAPayer: '0', dateFacture: getPastDate(4, 18), dateEcheance: getPastDate(4, 30), createdBy: 'u3' },
    { id: 'fact_m5', numero: 'FAC-2026-M5', clientId: 'cl3', clientNom: 'Ousmane Touré', statut: 'payee', totalHT: '296610', remiseGlobale: '0', tva: '18', totalTTC: '350000', montantPaye: '350000', resteAPayer: '0', dateFacture: getPastDate(5, 5), dateEcheance: getPastDate(5, 25), createdBy: 'u3' },
    { id: 'fact_m6', numero: 'FAC-2026-M6', clientId: 'cl4', clientNom: 'Ministère de l\'Éducation', statut: 'payee', totalHT: '338983', remiseGlobale: '0', tva: '18', totalTTC: '400000', montantPaye: '400000', resteAPayer: '0', dateFacture: getPastDate(6, 14), dateEcheance: getPastDate(6, 30), createdBy: 'u3' },
    { id: 'fact_m7', numero: 'FAC-2026-M7', clientId: 'cl5', clientNom: 'Start Innov SARL', statut: 'payee', totalHT: '237288', remiseGlobale: '0', tva: '18', totalTTC: '280000', montantPaye: '280000', resteAPayer: '0', dateFacture: getPastDate(7, 22), dateEcheance: getPastDate(7, 30), createdBy: 'u3' },
    { id: 'fact_m8', numero: 'FAC-2026-M8', clientId: 'cl1', clientNom: 'Groupe Sonatel', statut: 'payee', totalHT: '423728', remiseGlobale: '0', tva: '18', totalTTC: '500000', montantPaye: '500000', resteAPayer: '0', dateFacture: getPastDate(8, 10), dateEcheance: getPastDate(8, 30), createdBy: 'u3' },
    { id: 'fact_m9', numero: 'FAC-2026-M9', clientId: 'cl2', clientNom: 'CBAO Banque', statut: 'payee', totalHT: '161016', remiseGlobale: '0', tva: '18', totalTTC: '190000', montantPaye: '190000', resteAPayer: '0', dateFacture: getPastDate(9, 25), dateEcheance: getPastDate(9, 30), createdBy: 'u3' },
    { id: 'fact_m10', numero: 'FAC-2026-M10', clientId: 'cl3', clientNom: 'Ousmane Touré', statut: 'payee', totalHT: '271186', remiseGlobale: '0', tva: '18', totalTTC: '320000', montantPaye: '320000', resteAPayer: '0', dateFacture: getPastDate(10, 15), dateEcheance: getPastDate(10, 30), createdBy: 'u3' },
    { id: 'fact_m11', numero: 'FAC-2026-M11', clientId: 'cl4', clientNom: 'Ministère de l\'Éducation', statut: 'payee', totalHT: '355932', remiseGlobale: '0', tva: '18', totalTTC: '420000', montantPaye: '420000', resteAPayer: '0', dateFacture: getPastDate(11, 8), dateEcheance: getPastDate(11, 28), createdBy: 'u3' },
  ]).onConflictDoNothing();
  console.log('  ✓ Factures');

  // ── Commandes Fournisseurs ───────────────────────────
  await db.insert(commandesFournisseurs).values([
    {
      id: 'cf1',
      numero: 'CF-2026-001',
      fournisseurId: 'f1',
      fournisseurNom: 'TechDistrib SA',
      statut: 'recu',
      totalHT: '500000',
      fraisLivraison: '0',
      totalTTC: '500000',
      montantPaye: '500000',
      resteAPayer: '0',
      statutPaiement: 'paye',
      dateCommande: getPastDate(0, 1),
      dateLivraisonPrevue: getPastDate(0, 5),
      dateReception: getPastDate(0, 4),
      lignes: [
        {
          produitId: 'p1',
          produitRef: 'ELEC-001',
          produitNom: 'Ordinateur portable Dell XPS 15',
          quantite: 5,
          quantiteRecue: 5,
          prixAchat: 100000,
          total: 500000,
        },
      ],
      createdBy: 'u4',
    },
    {
      id: 'cf2',
      numero: 'CF-2026-002',
      fournisseurId: 'f2',
      fournisseurNom: 'Bureau Plus SARL',
      statut: 'commandee',
      totalHT: '300000',
      fraisLivraison: '0',
      totalTTC: '300000',
      montantPaye: '0',
      resteAPayer: '300000',
      statutPaiement: 'en_attente',
      dateCommande: getPastDate(0, 3),
      dateLivraisonPrevue: getPastDate(0, 10),
      lignes: [
        {
          produitId: 'p2',
          produitRef: 'ELEC-002',
          produitNom: 'Écran Samsung 27" 4K',
          quantite: 3,
          quantiteRecue: 0,
          prixAchat: 100000,
          total: 300000,
        },
      ],
      createdBy: 'u4',
    },
  ]).onConflictDoNothing();
  console.log('  ✓ Commandes Fournisseurs');

  // ── Paramètres entreprise ────────────────────────────
  await db.insert(parametres).values({
    id:         'default',
    nom:        'Kiosq Commercial',
    adresse:    'Dakar, Sénégal',
    telephone:  '+221 33 800 00 00',
    email:      'contact@kiosq.com',
    siteWeb:    'www.kiosq.com',
    siret:      '',
    devise:     'XOF',
    tva:        '18',
    piedDePage: 'Merci pour votre confiance — Kiosq Commercial',
    logoUrl:    '',
  }).onConflictDoNothing();
  console.log('  ✓ Paramètres');

  // ── Unités de mesure ─────────────────────────────────
  await db.insert(unites).values([
    { id: 'u_piece',   nom: 'Pièce',     abreviation: 'pce'  },
    { id: 'u_kg',      nom: 'Kilogramme', abreviation: 'kg'   },
    { id: 'u_litre',   nom: 'Litre',     abreviation: 'L'    },
    { id: 'u_metre',   nom: 'Mètre',     abreviation: 'm'    },
    { id: 'u_boite',   nom: 'Boîte',     abreviation: 'bte'  },
    { id: 'u_sachet',  nom: 'Sachet',    abreviation: 'sac'  },
    { id: 'u_carton',  nom: 'Carton',    abreviation: 'ctn'  },
    { id: 'u_ramette', nom: 'Ramette',   abreviation: 'ram'  },
    { id: 'u_flacon',  nom: 'Flacon',    abreviation: 'fl'   },
    { id: 'u_paire',   nom: 'Paire',     abreviation: 'pr'   },
  ]).onConflictDoNothing();
  console.log('  ✓ Unités');

  console.log('\n✅ Seed terminé !');
  console.log('   Connexion : admin@kiosq.com / demo1234');
  process.exit(0);
}

seed().catch((e) => { console.error('❌ Seed échoué :', e); process.exit(1); });
