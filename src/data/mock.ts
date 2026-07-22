import type {
  AppUser, Categorie, Client, Produit, Fournisseur,
  Commande, Facture, CommandeFournisseur, Notification,
} from '@/types';

// ── Utilisateurs ──────────────────────────────────────────
export const mockUsers: AppUser[] = [
  {
    id: 'su1', email: 'superadmin@kiosq.com', nom: 'Super', prenom: 'Admin',
    role: 'superadmin', actif: true, telephone: '+221 77 000 00 00',
    createdAt: new Date('2024-01-01'),
  },
  {
    id: 'u1', email: 'admin@kiosq.com', nom: 'Diallo', prenom: 'Mamadou',
    role: 'admin', actif: true, telephone: '+221 77 000 00 01',
    createdAt: new Date('2024-01-01'),
  },
  {
    id: 'u2', email: 'commercial@kiosq.com', nom: 'Sow', prenom: 'Fatou',
    role: 'commercial', actif: true, telephone: '+221 77 000 00 02',
    createdAt: new Date('2024-02-01'),
  },
  {
    id: 'u3', email: 'comptable@kiosq.com', nom: 'Ba', prenom: 'Ibrahim',
    role: 'comptable', actif: true, telephone: '+221 77 000 00 03',
    createdAt: new Date('2024-02-15'),
  },
  {
    id: 'u4', email: 'gest@kiosq.com', nom: 'Ndiaye', prenom: 'Aminata',
    role: 'gestionnaire', actif: true, telephone: '+221 77 000 00 04',
    createdAt: new Date('2024-03-01'),
  },
];

// ── Catégories ────────────────────────────────────────────
export const mockCategories: Categorie[] = [
  { id: 'c1', nom: 'Électronique', description: 'Matériel électronique', couleur: '#3b82f6', createdAt: new Date('2024-01-01') },
  { id: 'c2', nom: 'Mobilier', description: 'Mobilier de bureau', couleur: '#8b5cf6', createdAt: new Date('2024-01-01') },
  { id: 'c3', nom: 'Fournitures', description: 'Fournitures de bureau', couleur: '#10b981', createdAt: new Date('2024-01-01') },
  { id: 'c4', nom: 'Informatique', description: 'Matériel informatique', couleur: '#f59e0b', createdAt: new Date('2024-01-01') },
  { id: 'c5', nom: 'Téléphonie', description: 'Téléphones et accessoires', couleur: '#ef4444', createdAt: new Date('2024-01-01') },
];

// ── Fournisseurs ──────────────────────────────────────────
export const mockFournisseurs: Fournisseur[] = [
  {
    id: 'f1', nom: 'TechDistrib SA', contact: 'Alioune Camara',
    email: 'contact@techdistrib.sn', telephone: '+221 33 800 00 01',
    adresse: '12 Rue des Industries, Dakar', pays: 'Sénégal',
    delaiLivraison: 5, conditionsPaiement: '30 jours',
    soldeDette: 450000, totalAchats: 12500000, actif: true,
    createdAt: new Date('2024-01-10'), updatedAt: new Date('2024-06-01'),
  },
  {
    id: 'f2', nom: 'Bureau Plus SARL', contact: 'Mariam Koné',
    email: 'mariam@bureauplus.ci', telephone: '+225 27 20 30 00 01',
    adresse: 'Zone Industrielle, Abidjan', pays: 'Côte d\'Ivoire',
    delaiLivraison: 10, conditionsPaiement: '60 jours',
    soldeDette: 0, totalAchats: 3200000, actif: true,
    createdAt: new Date('2024-02-01'), updatedAt: new Date('2024-06-01'),
  },
  {
    id: 'f3', nom: 'Global Office Group', contact: 'Jean Mensah',
    email: 'j.mensah@globaloffice.com', telephone: '+228 22 20 00 01',
    adresse: 'Lomé Commercial Center', pays: 'Togo',
    delaiLivraison: 14, conditionsPaiement: '45 jours',
    soldeDette: 185000, totalAchats: 6800000, actif: true,
    createdAt: new Date('2024-01-20'), updatedAt: new Date('2024-05-15'),
  },
];

// ── Produits ──────────────────────────────────────────────
export const mockProduits: Produit[] = [
  {
    id: 'p1', reference: 'ELEC-001', designation: 'Ordinateur portable Dell XPS 15',
    categorieId: 'c4', categorie: 'Informatique', fournisseurId: 'f1', fournisseur: 'TechDistrib SA',
    unite: 'pièce', marque: 'Dell', prixAchat: 850000, prixVente: 1100000,
    stockActuel: 12, stockMinimum: 3, emplacement: 'Rayon A1', actif: true,
    createdAt: new Date('2024-01-15'), updatedAt: new Date('2024-06-01'),
  },
  {
    id: 'p2', reference: 'ELEC-002', designation: 'Écran Samsung 27" 4K',
    categorieId: 'c1', categorie: 'Électronique', fournisseurId: 'f1', fournisseur: 'TechDistrib SA',
    unite: 'pièce', marque: 'Samsung', prixAchat: 280000, prixVente: 380000,
    stockActuel: 2, stockMinimum: 5, emplacement: 'Rayon A2', actif: true,
    createdAt: new Date('2024-01-15'), updatedAt: new Date('2024-06-01'),
  },
  {
    id: 'p3', reference: 'MOB-001', designation: 'Bureau ergonomique 160cm',
    categorieId: 'c2', categorie: 'Mobilier', fournisseurId: 'f2', fournisseur: 'Bureau Plus SARL',
    unite: 'pièce', prixAchat: 95000, prixVente: 145000,
    stockActuel: 8, stockMinimum: 2, emplacement: 'Dépôt B', actif: true,
    createdAt: new Date('2024-02-01'), updatedAt: new Date('2024-06-01'),
  },
  {
    id: 'p4', reference: 'FOUR-001', designation: 'Ramette papier A4 80g (500 feuilles)',
    categorieId: 'c3', categorie: 'Fournitures', fournisseurId: 'f3', fournisseur: 'Global Office Group',
    unite: 'ramette', prixAchat: 3500, prixVente: 5500, prixVenteGros: 4800,
    stockActuel: 150, stockMinimum: 50, emplacement: 'Rayon C1', actif: true,
    createdAt: new Date('2024-01-10'), updatedAt: new Date('2024-06-01'),
  },
  {
    id: 'p5', reference: 'TEL-001', designation: 'iPhone 15 Pro 256 Go',
    categorieId: 'c5', categorie: 'Téléphonie', fournisseurId: 'f1', fournisseur: 'TechDistrib SA',
    unite: 'pièce', marque: 'Apple', prixAchat: 650000, prixVente: 850000,
    stockActuel: 5, stockMinimum: 3, emplacement: 'Vitrine 1', actif: true,
    createdAt: new Date('2024-03-01'), updatedAt: new Date('2024-06-01'),
  },
  {
    id: 'p6', reference: 'FOUR-002', designation: 'Stylos bille Bic (boîte 50)',
    categorieId: 'c3', categorie: 'Fournitures', fournisseurId: 'f3', fournisseur: 'Global Office Group',
    unite: 'boîte', prixAchat: 2500, prixVente: 4500,
    stockActuel: 0, stockMinimum: 10, emplacement: 'Rayon C2', actif: true,
    createdAt: new Date('2024-01-10'), updatedAt: new Date('2024-06-01'),
  },
  {
    id: 'p7', reference: 'ELEC-003', designation: 'Imprimante HP LaserJet Pro',
    categorieId: 'c4', categorie: 'Informatique', fournisseurId: 'f1', fournisseur: 'TechDistrib SA',
    unite: 'pièce', marque: 'HP', prixAchat: 180000, prixVente: 245000,
    stockActuel: 4, stockMinimum: 2, emplacement: 'Rayon A3', actif: true,
    createdAt: new Date('2024-02-15'), updatedAt: new Date('2024-06-01'),
  },
];

// ── Clients ───────────────────────────────────────────────
export const mockClients: Client[] = [
  {
    id: 'cl1', code: 'CLI-001', nom: 'Groupe Sonatel', typeClient: 'entreprise',
    email: 'achats@sonatel.sn', telephone: '+221 33 800 10 00',
    adresse: 'Route de Ouakam, Dakar', ville: 'Dakar', pays: 'Sénégal',
    secteurActivite: 'Télécommunications', commercial: 'Fatou Sow',
    totalAchats: 8500000, soldeCredit: 350000, nombreCommandes: 24,
    derniereCommande: new Date('2024-06-10'), actif: true,
    createdAt: new Date('2024-01-05'), updatedAt: new Date('2024-06-10'),
  },
  {
    id: 'cl2', code: 'CLI-002', nom: 'CBAO Banque', typeClient: 'entreprise',
    email: 'dsi@cbao.sn', telephone: '+221 33 800 20 00',
    adresse: '1 Place de l\'Indépendance', ville: 'Dakar', pays: 'Sénégal',
    secteurActivite: 'Finance', commercial: 'Fatou Sow',
    totalAchats: 5200000, soldeCredit: 0, nombreCommandes: 15,
    derniereCommande: new Date('2024-05-28'), actif: true,
    createdAt: new Date('2024-01-20'), updatedAt: new Date('2024-05-28'),
  },
  {
    id: 'cl3', code: 'CLI-003', nom: 'Ousmane Touré', typeClient: 'particulier',
    email: 'o.toure@gmail.com', telephone: '+221 76 500 30 00',
    ville: 'Thiès', pays: 'Sénégal', commercial: 'Fatou Sow',
    totalAchats: 1250000, soldeCredit: 0, nombreCommandes: 6,
    derniereCommande: new Date('2024-06-05'), actif: true,
    createdAt: new Date('2024-03-10'), updatedAt: new Date('2024-06-05'),
  },
  {
    id: 'cl4', code: 'CLI-004', nom: 'Ministère de l\'Éducation', typeClient: 'entreprise',
    email: 'daf@education.gouv.sn', telephone: '+221 33 800 40 00',
    adresse: 'Rue Dr Calmette, Dakar', ville: 'Dakar', pays: 'Sénégal',
    secteurActivite: 'Administration', commercial: 'Fatou Sow',
    totalAchats: 22000000, soldeCredit: 0, nombreCommandes: 42,
    derniereCommande: new Date('2024-06-12'), actif: true,
    createdAt: new Date('2024-01-02'), updatedAt: new Date('2024-06-12'),
  },
  {
    id: 'cl5', code: 'CLI-005', nom: 'Start Innov SARL', typeClient: 'entreprise',
    email: 'finance@startinnov.com', telephone: '+221 77 600 50 00',
    ville: 'Dakar', pays: 'Sénégal', secteurActivite: 'Tech',
    commercial: 'Fatou Sow',
    totalAchats: 980000, soldeCredit: 175000, nombreCommandes: 8,
    derniereCommande: new Date('2024-06-01'), actif: true,
    createdAt: new Date('2024-04-01'), updatedAt: new Date('2024-06-01'),
  },
];

// ── Commandes ─────────────────────────────────────────────
export const mockCommandes: Commande[] = [
  {
    id: 'cmd1', numero: 'CMD-2024-001', type: 'commande',
    clientId: 'cl4', clientNom: 'Ministère de l\'Éducation', commercial: 'Fatou Sow',
    statut: 'livre',
    lignes: [
      { produitId: 'p4', produitRef: 'FOUR-001', produitNom: 'Ramette papier A4', quantite: 500, prixUnitaire: 5500, remise: 5, total: 2612500 },
      { produitId: 'p6', produitRef: 'FOUR-002', produitNom: 'Stylos bic (boîte 50)', quantite: 100, prixUnitaire: 4500, remise: 0, total: 450000 },
    ],
    totalHT: 3062500, remiseGlobale: 0, tva: 18, totalTTC: 3613750,
    acompte: 1800000, resteAPayer: 1813750,
    dateCommande: new Date('2024-05-10'), dateLivraison: new Date('2024-05-20'),
    createdBy: 'u2', createdAt: new Date('2024-05-10'), updatedAt: new Date('2024-05-20'),
  },
  {
    id: 'cmd2', numero: 'CMD-2024-002', type: 'commande',
    clientId: 'cl1', clientNom: 'Groupe Sonatel', commercial: 'Fatou Sow',
    statut: 'en_preparation',
    lignes: [
      { produitId: 'p1', produitRef: 'ELEC-001', produitNom: 'Ordinateur portable Dell XPS 15', quantite: 5, prixUnitaire: 1100000, remise: 3, total: 5335000 },
      { produitId: 'p2', produitRef: 'ELEC-002', produitNom: 'Écran Samsung 27" 4K', quantite: 5, prixUnitaire: 380000, remise: 0, total: 1900000 },
    ],
    totalHT: 7235000, remiseGlobale: 0, tva: 18, totalTTC: 8537300,
    acompte: 4000000, resteAPayer: 4537300,
    dateCommande: new Date('2024-06-05'), dateLivraison: new Date('2024-06-20'),
    createdBy: 'u2', createdAt: new Date('2024-06-05'), updatedAt: new Date('2024-06-08'),
  },
  {
    id: 'cmd3', numero: 'DEV-2024-001', type: 'devis',
    clientId: 'cl2', clientNom: 'CBAO Banque', commercial: 'Fatou Sow',
    statut: 'envoye',
    lignes: [
      { produitId: 'p7', produitRef: 'ELEC-003', produitNom: 'Imprimante HP LaserJet Pro', quantite: 10, prixUnitaire: 245000, remise: 5, total: 2327500 },
    ],
    totalHT: 2327500, remiseGlobale: 0, tva: 18, totalTTC: 2746450,
    acompte: 0, resteAPayer: 2746450,
    dateCommande: new Date('2024-06-10'), dateValidite: new Date('2024-07-10'),
    createdBy: 'u2', createdAt: new Date('2024-06-10'), updatedAt: new Date('2024-06-10'),
  },
  {
    id: 'cmd4', numero: 'CMD-2024-003', type: 'commande',
    clientId: 'cl5', clientNom: 'Start Innov SARL', commercial: 'Fatou Sow',
    statut: 'confirme',
    lignes: [
      { produitId: 'p5', produitRef: 'TEL-001', produitNom: 'iPhone 15 Pro 256 Go', quantite: 2, prixUnitaire: 850000, remise: 0, total: 1700000 },
    ],
    totalHT: 1700000, remiseGlobale: 0, tva: 18, totalTTC: 2006000,
    acompte: 1000000, resteAPayer: 1006000,
    dateCommande: new Date('2024-06-12'), dateLivraison: new Date('2024-06-18'),
    createdBy: 'u2', createdAt: new Date('2024-06-12'), updatedAt: new Date('2024-06-12'),
  },
];

// ── Factures ──────────────────────────────────────────────
export const mockFactures: Facture[] = [
  {
    id: 'fac1', numero: 'FAC-2024-001',
    clientId: 'cl4', clientNom: 'Ministère de l\'Éducation',
    clientEmail: 'daf@education.gouv.sn', clientAdresse: 'Rue Dr Calmette, Dakar',
    commandeId: 'cmd1', statut: 'partielle',
    lignes: [
      { designation: 'Ramette papier A4 80g (x500)', quantite: 500, prixUnitaire: 5500, remise: 5, tva: 18, total: 2612500 },
      { designation: 'Stylos bic boîte 50 (x100)', quantite: 100, prixUnitaire: 4500, remise: 0, tva: 18, total: 450000 },
    ],
    totalHT: 3062500, remiseGlobale: 0, tva: 18, totalTTC: 3613750,
    montantPaye: 1800000, resteAPayer: 1813750,
    paiements: [
      { id: 'pay1', montant: 1800000, mode: 'virement', date: new Date('2024-05-12'), reference: 'VIR-0512' },
    ],
    dateFacture: new Date('2024-05-20'), dateEcheance: new Date('2024-06-20'),
    createdBy: 'u3', createdAt: new Date('2024-05-20'), updatedAt: new Date('2024-05-20'),
  },
  {
    id: 'fac2', numero: 'FAC-2024-002',
    clientId: 'cl2', clientNom: 'CBAO Banque',
    clientEmail: 'dsi@cbao.sn', clientAdresse: 'Place de l\'Indépendance, Dakar',
    statut: 'payee',
    lignes: [
      { designation: 'Ordinateur portable Dell XPS 15 (x3)', quantite: 3, prixUnitaire: 1100000, remise: 0, tva: 18, total: 3300000 },
    ],
    totalHT: 3300000, remiseGlobale: 0, tva: 18, totalTTC: 3894000,
    montantPaye: 3894000, resteAPayer: 0,
    paiements: [
      { id: 'pay2', montant: 3894000, mode: 'virement', date: new Date('2024-05-30'), reference: 'VIR-0530' },
    ],
    dateFacture: new Date('2024-05-15'), dateEcheance: new Date('2024-06-15'),
    createdBy: 'u3', createdAt: new Date('2024-05-15'), updatedAt: new Date('2024-05-30'),
  },
  {
    id: 'fac3', numero: 'FAC-2024-003',
    clientId: 'cl1', clientNom: 'Groupe Sonatel',
    clientEmail: 'achats@sonatel.sn', clientAdresse: 'Route de Ouakam, Dakar',
    statut: 'en_retard',
    lignes: [
      { designation: 'iPhone 15 Pro 256 Go (x3)', quantite: 3, prixUnitaire: 850000, remise: 0, tva: 18, total: 2550000 },
      { designation: 'Écran Samsung 27" 4K (x2)', quantite: 2, prixUnitaire: 380000, remise: 0, tva: 18, total: 760000 },
    ],
    totalHT: 3310000, remiseGlobale: 0, tva: 18, totalTTC: 3905800,
    montantPaye: 0, resteAPayer: 3905800,
    paiements: [],
    dateFacture: new Date('2024-05-01'), dateEcheance: new Date('2024-06-01'),
    createdBy: 'u3', createdAt: new Date('2024-05-01'), updatedAt: new Date('2024-05-01'),
  },
  {
    id: 'fac4', numero: 'FAC-2024-004',
    clientId: 'cl3', clientNom: 'Ousmane Touré',
    clientEmail: 'o.toure@gmail.com',
    statut: 'envoyee',
    lignes: [
      { designation: 'Bureau ergonomique 160cm (x1)', quantite: 1, prixUnitaire: 145000, remise: 0, tva: 18, total: 145000 },
    ],
    totalHT: 145000, remiseGlobale: 0, tva: 18, totalTTC: 171100,
    montantPaye: 0, resteAPayer: 171100,
    paiements: [],
    dateFacture: new Date('2024-06-08'), dateEcheance: new Date('2024-07-08'),
    createdBy: 'u3', createdAt: new Date('2024-06-08'), updatedAt: new Date('2024-06-08'),
  },
];

// ── Commandes fournisseurs ────────────────────────────────
export const mockCommandesFournisseurs: CommandeFournisseur[] = [
  {
    id: 'cf1', numero: 'ACH-2024-001',
    fournisseurId: 'f1', fournisseurNom: 'TechDistrib SA',
    statut: 'recu',
    lignes: [
      { produitId: 'p1', produitRef: 'ELEC-001', produitNom: 'Ordinateur portable Dell XPS 15', quantite: 10, quantiteRecue: 10, prixAchat: 850000, total: 8500000 },
      { produitId: 'p5', produitRef: 'TEL-001', produitNom: 'iPhone 15 Pro 256 Go', quantite: 8, quantiteRecue: 8, prixAchat: 650000, total: 5200000 },
    ],
    totalHT: 13700000, fraisLivraison: 150000, totalTTC: 13850000,
    montantPaye: 13400000, resteAPayer: 450000, statutPaiement: 'partiel',
    paiements: [],
    dateCommande: new Date('2024-05-01'), dateLivraisonPrevue: new Date('2024-05-10'), dateReception: new Date('2024-05-12'),
    createdBy: 'u1', createdAt: new Date('2024-05-01'), updatedAt: new Date('2024-05-12'),
  },
  {
    id: 'cf2', numero: 'ACH-2024-002',
    fournisseurId: 'f3', fournisseurNom: 'Global Office Group',
    statut: 'commandee',
    lignes: [
      { produitId: 'p4', produitRef: 'FOUR-001', produitNom: 'Ramette papier A4', quantite: 300, quantiteRecue: 0, prixAchat: 3500, total: 1050000 },
      { produitId: 'p6', produitRef: 'FOUR-002', produitNom: 'Stylos bic (boîte 50)', quantite: 50, quantiteRecue: 0, prixAchat: 2500, total: 125000 },
    ],
    totalHT: 1175000, fraisLivraison: 35000, totalTTC: 1210000,
    montantPaye: 0, resteAPayer: 1210000, statutPaiement: 'en_attente',
    paiements: [],
    dateCommande: new Date('2024-06-10'), dateLivraisonPrevue: new Date('2024-06-25'),
    createdBy: 'u1', createdAt: new Date('2024-06-10'), updatedAt: new Date('2024-06-10'),
  },
];

// ── Notifications ─────────────────────────────────────────
export const mockNotifications: Notification[] = [
  { id: 'n1', type: 'alerte_stock', titre: 'Rupture de stock', message: 'Stylos bic (boîte 50) : stock à 0', lu: false, lien: '/produits', createdAt: new Date('2024-06-14T08:00:00') },
  { id: 'n2', type: 'alerte_stock', titre: 'Stock bas', message: 'Écran Samsung 27" : 2 unités (min: 5)', lu: false, lien: '/produits', createdAt: new Date('2024-06-14T08:05:00') },
  { id: 'n3', type: 'facture_due', titre: 'Facture en retard', message: 'FAC-2024-003 — Sonatel : 3 905 800 F due', lu: false, lien: '/facturation', createdAt: new Date('2024-06-12T09:00:00') },
  { id: 'n4', type: 'commande', titre: 'Nouvelle commande', message: 'CMD-2024-003 confirmée par Start Innov', lu: true, lien: '/commandes', createdAt: new Date('2024-06-12T10:30:00') },
  { id: 'n5', type: 'info', titre: 'Livraison reçue', message: 'ACH-2024-001 — TechDistrib : réception confirmée', lu: true, lien: '/fournisseurs', createdAt: new Date('2024-05-12T14:00:00') },
];

// ── Données graphique CA (12 mois) ────────────────────────
export const mockDataCA = [
  { label: 'Jan', valeur: 4200000, commandes: 8, benefice: 980000 },
  { label: 'Fév', valeur: 5800000, commandes: 11, benefice: 1340000 },
  { label: 'Mar', valeur: 7100000, commandes: 14, benefice: 1650000 },
  { label: 'Avr', valeur: 6300000, commandes: 12, benefice: 1420000 },
  { label: 'Mai', valeur: 9500000, commandes: 18, benefice: 2200000 },
  { label: 'Juin', valeur: 8200000, commandes: 15, benefice: 1900000 },
  { label: 'Juil', valeur: 7600000, commandes: 13, benefice: 1760000 },
  { label: 'Août', valeur: 5400000, commandes: 10, benefice: 1250000 },
  { label: 'Sep', valeur: 8900000, commandes: 17, benefice: 2060000 },
  { label: 'Oct', valeur: 10200000, commandes: 20, benefice: 2360000 },
  { label: 'Nov', valeur: 11500000, commandes: 22, benefice: 2660000 },
  { label: 'Déc', valeur: 13800000, commandes: 26, benefice: 3190000 },
];
