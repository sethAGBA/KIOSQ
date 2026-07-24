// ── Auth / Utilisateurs ──────────────────────────────────
export type UserRole = "admin" | "commercial" | "gestionnaire" | "comptable" | "lecteur" | "superadmin";

export interface AppUser {
  id: string;
  email: string;
  nom: string;
  prenom: string;
  role: UserRole;
  actif: boolean;
  telephone?: string | null;
  avatar?: string | null;
  dernierLogin?: Date;
  createdAt: Date;
  premiereConnexion?: boolean;
  onboardingStep?: number;
  tenantId?: string | null;
}

// ── Entreprise / Configuration ───────────────────────────
export interface Entreprise {
  id: string;
  nom: string;
  adresse?: string;
  telephone?: string;
  email?: string;
  siteWeb?: string;
  siret?: string;
  tva?: number;
  devise: string;        // "XOF", "EUR", "USD"
  piedDePage?: string;
  logoUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ── Catégorie produit ────────────────────────────────────
export interface Categorie {
  id: string;
  nom: string;
  description?: string;
  couleur?: string;
  createdAt: Date;
}

// ── Unité de mesure ──────────────────────────────────────
export interface Unite {
  id: string;
  nom: string;
  abreviation: string;
  createdAt: Date;
}

export interface Magasin {
  id: string;
  nom: string;
  adresse?: string;
  telephone?: string;
  actif: boolean;
  createdAt: Date;
}

// ── Fournisseur ──────────────────────────────────────────
export interface Fournisseur {
  id: string;
  nom: string;
  contact?: string;
  email?: string;
  telephone?: string;
  adresse?: string;
  pays?: string;
  delaiLivraison?: number;   // jours
  conditionsPaiement?: string;
  soldeDette: number;
  totalAchats: number;
  actif: boolean;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ── Produit / Catalogue ──────────────────────────────────
export interface Produit {
  id: string;
  reference: string;
  designation: string;
  description?: string;
  categorieId: string;
  categorie?: string;
  fournisseurId?: string;
  fournisseur?: string;
  unite: string;
  marque?: string;
  prixAchat: number;
  prixVente: number;
  prixVenteGros?: number;
  stockActuel: number;
  stockMinimum: number;
  stockMaximum?: number;
  datePeremption?: Date;
  emplacement?: string;
  codeBarres?: string;
  magasinId?: string;
  photoUrl?: string;
  actif: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ── Mouvement de stock ────────────────────────────────────
export type TypeMouvement = "entree" | "sortie" | "usage_interne" | "ajustement" | "retour";

export interface Mouvement {
  id: string;
  produitId: string;
  produitRef: string;
  produitNom: string;
  type: TypeMouvement;
  quantite: number;
  stockAvant: number;
  stockApres: number;
  motif: string;
  utilisateurId: string;
  utilisateurNom: string;
  commandeId?: string;
  createdAt: Date;
}

// ── Client ───────────────────────────────────────────────
export interface Client {
  id: string;
  code: string;          // ex: CLI-001
  nom: string;
  prenom?: string;
  email?: string;
  telephone?: string;
  adresse?: string;
  ville?: string;
  pays?: string;
  secteurActivite?: string;
  commercial?: string;   // commercial assigné
  typeClient: "particulier" | "entreprise";
  totalAchats: number;
  soldeCredit: number;   // montant dû par le client
  nombreCommandes: number;
  derniereCommande?: Date;
  actif: boolean;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ── Devis / Commande ─────────────────────────────────────
export type StatutCommande =
  | "brouillon"
  | "envoye"
  | "confirme"
  | "en_preparation"
  | "expedie"
  | "livre"
  | "en_caisse"
  | "en_facturation"
  | "annule";

export type StatutDevis = "brouillon" | "envoye" | "accepte" | "refuse" | "expire";

export interface LigneCommande {
  produitId: string;
  produitRef: string;
  produitNom: string;
  quantite: number;
  prixUnitaire: number;
  remise: number;        // %
  total: number;
}

export interface Commande {
  id: string;
  numero: string;         // ex: CMD-2024-001
  type: "commande" | "devis";
  clientId: string;
  clientNom: string;
  commercial?: string;
  statut: StatutCommande | StatutDevis;
  lignes: LigneCommande[];
  totalHT: number;
  remiseGlobale: number;  // %
  tva: number;            // %
  totalTTC: number;
  acompte: number;
  resteAPayer: number;
  dateCommande: Date;
  dateLivraison?: Date;
  dateValidite?: Date;    // pour les devis
  adresseLivraison?: string;
  notes?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

// ── Facture ──────────────────────────────────────────────
export type StatutFacture = "brouillon" | "envoyee" | "payee" | "partielle" | "en_retard" | "annulee";
export type ModePaiement = "especes" | "virement" | "cheque" | "mobile_money" | "carte" | "autre";

export interface LigneFacture {
  designation: string;
  quantite: number;
  prixUnitaire: number;
  remise: number;
  tva: number;
  total: number;
}

export interface Paiement {
  id: string;
  montant: number;
  mode: ModePaiement;
  date: Date;
  reference?: string;
  note?: string;
}

export interface Facture {
  id: string;
  numero: string;        // ex: FAC-2024-001
  clientId: string;
  clientNom: string;
  clientEmail?: string;
  clientAdresse?: string;
  commandeId?: string;
  statut: StatutFacture;
  lignes: LigneFacture[];
  totalHT: number;
  remiseGlobale: number;
  tva: number;
  totalTTC: number;
  montantPaye: number;
  resteAPayer: number;
  paiements: Paiement[];
  dateFacture: Date;
  dateEcheance: Date;
  notes?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

// ── Commande fournisseur ─────────────────────────────────
export type StatutCommandeFournisseur =
  | "brouillon"
  | "commandee"
  | "recu_partiel"
  | "recu"
  | "annulee";

export interface CommandeFournisseur {
  id: string;
  numero: string;
  fournisseurId: string;
  fournisseurNom: string;
  statut: StatutCommandeFournisseur;
  lignes: {
    produitId: string;
    produitRef: string;
    produitNom: string;
    quantite: number;
    quantiteRecue: number;
    prixAchat: number;
    total: number;
  }[];
  totalHT: number;
  fraisLivraison: number;
  totalTTC: number;
  montantPaye: number;
  resteAPayer: number;
  paiements: Paiement[];
  statutPaiement: "en_attente" | "partiel" | "paye";
  dateCommande: Date;
  dateLivraisonPrevue?: Date;
  dateReception?: Date;
  notes?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

// ── Rapport ──────────────────────────────────────────────
export interface FiltreRapport {
  dateDebut: Date;
  dateFin: Date;
  clientId?: string;
  fournisseurId?: string;
  categorieId?: string;
  commercial?: string;
}

// ── Notification ─────────────────────────────────────────
export interface Notification {
  id: string;
  type: "alerte_stock" | "facture_due" | "commande" | "info";
  titre: string;
  message: string;
  lu: boolean;
  lien?: string;
  createdAt: Date;
}

// ── KPI Dashboard ────────────────────────────────────────
export interface DashboardKPIs {
  chiffreAffaireMois: number;
  chiffreAffaireVariation: number;      // % vs mois précédent
  commandesMois: number;
  commandesVariation: number;
  clientsActifs: number;
  facturesEnAttente: number;
  montantFacturesEnAttente: number;
  produitsEnRupture: number;
  produitsEnAlerte: number;
  beneficeMois: number;
  tauxMarge: number;
}

// ── Graphique chiffre d'affaires ──────────────────────────
export interface DataPoint {
  label: string;
  valeur: number;
  commandes?: number;
  benefice?: number;
}

// ── Leads ─────────────────────────────────────────────────
export type StatutLead   = 'nouveau' | 'envoye' | 'ignore';
export type StatutGroupe = 'actif' | 'inactif' | 'erreur';

export interface Lead {
  id: string;
  groupeSurveilleId: string;
  groupeNom?: string;          // présent dans GET /api/leads/:id (jointure)
  clientId: string | null;
  clientNom?: string | null;   // présent si converti
  texteOriginal: string;
  produitDetecte: string | null;
  scoreConfiance: number | null;
  lienPost: string | null;
  statut: StatutLead;
  createdAt: Date;
  updatedAt: Date;
}

export interface GroupeSurveille {
  id: string;
  nomGroupe: string;
  urlGroupe: string;
  statut: StatutGroupe;
  // cookieSessionChiffre omis des réponses Interface
  // cookieSession déchiffré présent uniquement pour rôles bot/admin
  createdAt: Date;
  updatedAt: Date;
}

// ── Inventaire (Comptage Physique) ────────────────────────
export interface LigneInventaire {
  produitId: string;
  produitRef: string;
  produitNom: string;
  stockTheorique: number;
  stockReel: number;
  ecart: number;
}

export interface InventaireSession {
  id: string;
  date: Date;
  utilisateurId: string;
  utilisateurNom: string;
  statut: 'en_cours' | 'valide';
  lignes: LigneInventaire[];
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ── Sortie de Caisse ─────────────────────────────────────
export interface SortieCaisse {
  id: string;
  montant: number;
  motif: string;
  categorie: string;
  beneficiaire?: string;
  utilisateurId: string;
  utilisateurNom: string;
  date: Date;
  createdAt: Date;
}

// ── Retour Client ─────────────────────────────────────────
export type RemboursementMode = 'especes' | 'credit_reduc' | 'avoir';

export interface LigneRetourClient {
  designation: string;
  quantite: number;
  prixUnitaire: number;
  total: number;
}

export interface RetourClient {
  id: string;
  factureId: string;
  factureNumero: string;
  clientId: string;
  clientNom: string;
  lignes: LigneRetourClient[];
  totalTTC: number;
  motif: string;
  remboursementMode: RemboursementMode;
  utilisateurId?: string;
  utilisateurNom?: string;
  createdAt: Date;
}

// ── Clôture de Caisse (Rapport Z) ───────────────────────
export interface ClotureCaisse {
  id: string;
  date: Date;
  totalVentes: number;
  nbVentes: number;
  repartition: {
    especes?: number;
    mobile_money?: number;
    carte?: number;
    credit?: number;
    autre?: number;
  };
  montantTheorique: number;
  montantReel: number;
  ecart: number;
  notes?: string;
  utilisateurId: string;
  utilisateurNom: string;
  vendeurId: string;
  vendeurNom: string;
  createdAt: Date;
}
