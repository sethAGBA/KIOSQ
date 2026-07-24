import {
  pgTable, text, integer, numeric, boolean,
  timestamp, jsonb, pgEnum,
} from 'drizzle-orm/pg-core';

// ── Enums ────────────────────────────────────────────────
export const planEnum         = pgEnum('plan_tenant',    ['starter', 'pro', 'enterprise']);
export const statutTenantEnum = pgEnum('statut_tenant',  ['actif', 'suspendu', 'essai']);

export const userRoleEnum = pgEnum('user_role', [
  'superadmin', 'admin', 'commercial', 'gestionnaire', 'comptable', 'lecteur',
]);

export const typeClientEnum = pgEnum('type_client', ['particulier', 'entreprise']);

export const statutCommandeEnum = pgEnum('statut_commande', [
  'brouillon', 'envoye', 'confirme', 'en_preparation',
  'expedie', 'livre', 'annule', 'accepte', 'refuse', 'expire',
  'en_caisse', 'en_facturation',
]);

export const typeCommandeEnum = pgEnum('type_commande', ['commande', 'devis']);

export const statutFactureEnum = pgEnum('statut_facture', [
  'brouillon', 'envoyee', 'payee', 'partielle', 'en_retard', 'annulee',
]);

export const statutCFEnum = pgEnum('statut_commande_fournisseur', [
  'brouillon', 'commandee', 'recu_partiel', 'recu', 'annulee',
]);

export const statutGroupeEnum = pgEnum('statut_groupe', ['actif', 'inactif', 'erreur']);
export const statutLeadEnum   = pgEnum('statut_lead',   ['nouveau', 'envoye', 'ignore']);
export const typeMouvementEnum        = pgEnum('type_mouvement',          ['entree', 'sortie', 'usage_interne', 'ajustement']);
export const remboursementModeEnum    = pgEnum('remboursement_mode',       ['especes', 'credit_reduc', 'avoir']);

// ── Tenants ───────────────────────────────────────────────
export const tenants = pgTable('tenants', {
  id:                 text('id').primaryKey(),
  nom:                text('nom').notNull(),
  slug:               text('slug').notNull().unique(),
  domaine:            text('domaine'),
  plan:               planEnum('plan').notNull().default('starter'),
  statut:             statutTenantEnum('statut').notNull().default('essai'),
  dateEssaiFin:       timestamp('date_essai_fin'),
  logoUrl:            text('logo_url'),
  devise:             text('devise').notNull().default('XOF'),
  pays:               text('pays'),
  telephone:          text('telephone'),
  email:              text('email').notNull(),
  adresse:            text('adresse'),
  enMaintenance:      boolean('en_maintenance').notNull().default(false),
  messageMaintenance: text('message_maintenance'),
  createdAt:          timestamp('created_at').notNull().defaultNow(),
  updatedAt:          timestamp('updated_at').notNull().defaultNow(),
});

// ── Users ────────────────────────────────────────────────
export const users = pgTable('users', {
  id:                text('id').primaryKey(),
  email:             text('email').notNull().unique(),
  passwordHash:      text('password_hash').notNull(),
  nom:               text('nom').notNull(),
  prenom:            text('prenom').notNull(),
  role:              userRoleEnum('role').notNull().default('lecteur'),
  telephone:         text('telephone'),
  avatar:            text('avatar'),
  actif:             boolean('actif').notNull().default(true),
  tenantId:          text('tenant_id').references(() => tenants.id),
  premiereConnexion: boolean('premiere_connexion').notNull().default(true),
  onboardingStep:    integer('onboarding_step').notNull().default(0),
  createdAt:         timestamp('created_at').notNull().defaultNow(),
  updatedAt:         timestamp('updated_at').notNull().defaultNow(),
});

// ── Categories ────────────────────────────────────────────
export const categories = pgTable('categories', {
  id:          text('id').primaryKey(),
  nom:         text('nom').notNull(),
  description: text('description'),
  couleur:     text('couleur'),
  tenantId:    text('tenant_id').notNull().references(() => tenants.id),
  createdAt:   timestamp('created_at').notNull().defaultNow(),
});

// ── Magasins ──────────────────────────────────────────────
export const magasins = pgTable('magasins', {
  id:          text('id').primaryKey(),
  nom:         text('nom').notNull(),
  adresse:     text('adresse'),
  telephone:   text('telephone'),
  actif:       boolean('actif').notNull().default(true),
  tenantId:    text('tenant_id').notNull().references(() => tenants.id),
  createdAt:   timestamp('created_at').notNull().defaultNow(),
  updatedAt:   timestamp('updated_at').notNull().defaultNow(),
});

// ── Fournisseurs ──────────────────────────────────────────
export const fournisseurs = pgTable('fournisseurs', {
  id:                  text('id').primaryKey(),
  nom:                 text('nom').notNull(),
  contact:             text('contact'),
  email:               text('email'),
  telephone:           text('telephone'),
  adresse:             text('adresse'),
  pays:                text('pays'),
  delaiLivraison:      integer('delai_livraison'),
  conditionsPaiement:  text('conditions_paiement'),
  soldeDette:          numeric('solde_dette', { precision: 15, scale: 2 }).notNull().default('0'),
  totalAchats:         numeric('total_achats', { precision: 15, scale: 2 }).notNull().default('0'),
  actif:               boolean('actif').notNull().default(true),
  notes:               text('notes'),
  tenantId:            text('tenant_id').notNull().references(() => tenants.id),
  createdAt:           timestamp('created_at').notNull().defaultNow(),
  updatedAt:           timestamp('updated_at').notNull().defaultNow(),
});

// ── Produits ──────────────────────────────────────────────
export const produits = pgTable('produits', {
  id:           text('id').primaryKey(),
  reference:    text('reference').notNull().unique(),
  designation:  text('designation').notNull(),
  description:  text('description'),
  categorieId:  text('categorie_id').references(() => categories.id),
  fournisseurId:text('fournisseur_id').references(() => fournisseurs.id),
  unite:        text('unite').notNull().default('pièce'),
  marque:       text('marque'),
  prixAchat:    numeric('prix_achat', { precision: 15, scale: 2 }).notNull().default('0'),
  prixVente:    numeric('prix_vente', { precision: 15, scale: 2 }).notNull().default('0'),
  prixVenteGros:numeric('prix_vente_gros', { precision: 15, scale: 2 }),
  stockActuel:  integer('stock_actuel').notNull().default(0),
  stockMinimum: integer('stock_minimum').notNull().default(0),
  stockMaximum: integer('stock_maximum'),
  datePeremption:timestamp('date_peremption'),
  emplacement:  text('emplacement'),
  codeBarres:   text('code_barres'),
  magasinId:    text('magasin_id').references(() => magasins.id),
  actif:        boolean('actif').notNull().default(true),
  tenantId:     text('tenant_id').notNull().references(() => tenants.id),
  createdAt:    timestamp('created_at').notNull().defaultNow(),
  updatedAt:    timestamp('updated_at').notNull().defaultNow(),
});

// ── Mouvements de Stock ───────────────────────────────────
export const mouvementsStock = pgTable('mouvements_stock', {
  id:            text('id').primaryKey(),
  tenantId:      text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  produitId:     text('produit_id').notNull().references(() => produits.id, { onDelete: 'cascade' }),
  produitNom:    text('produit_nom').notNull(),
  produitRef:    text('produit_ref').notNull(),
  type:          typeMouvementEnum('type').notNull(),
  quantite:      integer('quantite').notNull(),
  stockAvant:    integer('stock_avant').notNull(),
  stockApres:    integer('stock_apres').notNull(),
  motif:         text('motif'),
  utilisateurId: text('utilisateur_id'),
  utilisateurNom:text('utilisateur_nom'),
  createdAt:     timestamp('created_at').notNull().defaultNow(),
});

// ── Clients ───────────────────────────────────────────────
export const clients = pgTable('clients', {
  id:               text('id').primaryKey(),
  code:             text('code').notNull().unique(),
  nom:              text('nom').notNull(),
  prenom:           text('prenom'),
  email:            text('email'),
  telephone:        text('telephone'),
  adresse:          text('adresse'),
  ville:            text('ville'),
  pays:             text('pays'),
  secteurActivite:  text('secteur_activite'),
  commercial:       text('commercial'),
  typeClient:       typeClientEnum('type_client').notNull().default('entreprise'),
  totalAchats:      numeric('total_achats', { precision: 15, scale: 2 }).notNull().default('0'),
  soldeCredit:      numeric('solde_credit', { precision: 15, scale: 2 }).notNull().default('0'),
  nombreCommandes:  integer('nombre_commandes').notNull().default(0),
  derniereCommande: timestamp('derniere_commande'),
  actif:            boolean('actif').notNull().default(true),
  notes:            text('notes'),
  tenantId:         text('tenant_id').notNull().references(() => tenants.id),
  createdAt:        timestamp('created_at').notNull().defaultNow(),
  updatedAt:        timestamp('updated_at').notNull().defaultNow(),
});

// ── Commandes / Devis ─────────────────────────────────────
export const commandes = pgTable('commandes', {
  id:               text('id').primaryKey(),
  numero:           text('numero').notNull().unique(),
  type:             typeCommandeEnum('type').notNull().default('commande'),
  clientId:         text('client_id').references(() => clients.id),
  clientNom:        text('client_nom').notNull(),
  commercial:       text('commercial'),
  statut:           statutCommandeEnum('statut').notNull().default('brouillon'),
  // lignes stockées en JSONB
  lignes:           jsonb('lignes').notNull().default([]),
  totalHT:          numeric('total_ht', { precision: 15, scale: 2 }).notNull().default('0'),
  remiseGlobale:    numeric('remise_globale', { precision: 5, scale: 2 }).notNull().default('0'),
  tva:              numeric('tva', { precision: 5, scale: 2 }).notNull().default('18'),
  totalTTC:         numeric('total_ttc', { precision: 15, scale: 2 }).notNull().default('0'),
  acompte:          numeric('acompte', { precision: 15, scale: 2 }).notNull().default('0'),
  resteAPayer:      numeric('reste_a_payer', { precision: 15, scale: 2 }).notNull().default('0'),
  dateCommande:     timestamp('date_commande').notNull().defaultNow(),
  dateLivraison:    timestamp('date_livraison'),
  dateValidite:     timestamp('date_validite'),
  adresseLivraison: text('adresse_livraison'),
  notes:            text('notes'),
  tenantId:         text('tenant_id').notNull().references(() => tenants.id),
  createdBy:        text('created_by').references(() => users.id),
  createdAt:        timestamp('created_at').notNull().defaultNow(),
  updatedAt:        timestamp('updated_at').notNull().defaultNow(),
});

// ── Factures ──────────────────────────────────────────────
export const factures = pgTable('factures', {
  id:             text('id').primaryKey(),
  numero:         text('numero').notNull().unique(),
  clientId:       text('client_id').notNull().references(() => clients.id),
  clientNom:      text('client_nom').notNull(),
  clientEmail:    text('client_email'),
  clientAdresse:  text('client_adresse'),
  commandeId:     text('commande_id').references(() => commandes.id),
  statut:         statutFactureEnum('statut').notNull().default('brouillon'),
  lignes:         jsonb('lignes').notNull().default([]),
  totalHT:        numeric('total_ht', { precision: 15, scale: 2 }).notNull().default('0'),
  remiseGlobale:  numeric('remise_globale', { precision: 5, scale: 2 }).notNull().default('0'),
  tva:            numeric('tva', { precision: 5, scale: 2 }).notNull().default('18'),
  totalTTC:       numeric('total_ttc', { precision: 15, scale: 2 }).notNull().default('0'),
  montantPaye:    numeric('montant_paye', { precision: 15, scale: 2 }).notNull().default('0'),
  resteAPayer:    numeric('reste_a_payer', { precision: 15, scale: 2 }).notNull().default('0'),
  paiements:      jsonb('paiements').notNull().default([]),
  dateFacture:    timestamp('date_facture').notNull().defaultNow(),
  dateEcheance:   timestamp('date_echeance').notNull(),
  notes:          text('notes'),
  tenantId:       text('tenant_id').notNull().references(() => tenants.id),
  createdBy:      text('created_by').references(() => users.id),
  createdAt:      timestamp('created_at').notNull().defaultNow(),
  updatedAt:      timestamp('updated_at').notNull().defaultNow(),
});

// ── Commandes fournisseurs ────────────────────────────────
export const commandesFournisseurs = pgTable('commandes_fournisseurs', {
  id:                   text('id').primaryKey(),
  numero:               text('numero').notNull().unique(),
  fournisseurId:        text('fournisseur_id').notNull().references(() => fournisseurs.id),
  fournisseurNom:       text('fournisseur_nom').notNull(),
  statut:               statutCFEnum('statut').notNull().default('brouillon'),
  lignes:               jsonb('lignes').notNull().default([]),
  totalHT:              numeric('total_ht', { precision: 15, scale: 2 }).notNull().default('0'),
  fraisLivraison:       numeric('frais_livraison', { precision: 15, scale: 2 }).notNull().default('0'),
  totalTTC:             numeric('total_ttc', { precision: 15, scale: 2 }).notNull().default('0'),
  montantPaye:          numeric('montant_paye', { precision: 15, scale: 2 }).notNull().default('0'),
  resteAPayer:          numeric('reste_a_payer', { precision: 15, scale: 2 }).notNull().default('0'),
  paiements:            jsonb('paiements').notNull().default([]),
  statutPaiement:       text('statut_paiement').notNull().default('en_attente'),
  dateCommande:         timestamp('date_commande').notNull().defaultNow(),
  dateLivraisonPrevue:  timestamp('date_livraison_prevue'),
  dateReception:        timestamp('date_reception'),
  notes:                text('notes'),
  tenantId:             text('tenant_id').notNull().references(() => tenants.id),
  createdBy:            text('created_by').references(() => users.id),
  createdAt:            timestamp('created_at').notNull().defaultNow(),
  updatedAt:            timestamp('updated_at').notNull().defaultNow(),
});

// ── Paramètres entreprise ─────────────────────────────────
// Table clé-valeur : une seule ligne par tenant avec id = 'default'
export const parametres = pgTable('parametres', {
  id:          text('id').primaryKey(),           // always 'default' (per tenant)
  nom:         text('nom').notNull().default('Kiosq Commercial'),
  adresse:     text('adresse'),
  telephone:   text('telephone'),
  email:       text('email'),
  siteWeb:     text('site_web'),
  siret:       text('siret'),
  devise:      text('devise').notNull().default('XOF'),
  tva:         text('tva').notNull().default('18'),
  piedDePage:  text('pied_de_page'),
  logoUrl:     text('logo_url'),
  tenantId:    text('tenant_id').notNull().references(() => tenants.id),
  updatedAt:   timestamp('updated_at').notNull().defaultNow(),
});

// ── Unités de mesure ──────────────────────────────────────
export const unites = pgTable('unites', {
  id:           text('id').primaryKey(),
  nom:          text('nom').notNull(),
  abreviation:  text('abreviation').notNull(),
  tenantId:     text('tenant_id').notNull().references(() => tenants.id),
  createdAt:    timestamp('created_at').notNull().defaultNow(),
  updatedAt:    timestamp('updated_at').notNull().defaultNow(),
});

// ── Groupes surveillés ────────────────────────────────────
export const groupesSurveilles = pgTable('groupes_surveilles', {
  id:                   text('id').primaryKey(),
  nomGroupe:            text('nom_groupe').notNull(),
  urlGroupe:            text('url_groupe').notNull().unique(),
  cookieSessionChiffre: text('cookie_session_chiffre'),
  statut:               statutGroupeEnum('statut').notNull().default('actif'),
  tenantId:             text('tenant_id').notNull().references(() => tenants.id),
  createdAt:            timestamp('created_at').notNull().defaultNow(),
  updatedAt:            timestamp('updated_at').notNull().defaultNow(),
});

// ── Leads ─────────────────────────────────────────────────
export const leads = pgTable('leads', {
  id:                text('id').primaryKey(),
  groupeSurveilleId: text('groupe_surveille_id')
                       .notNull()
                       .references(() => groupesSurveilles.id),
  clientId:          text('client_id')
                       .references(() => clients.id),
  texteOriginal:     text('texte_original').notNull(),
  produitDetecte:    text('produit_detecte'),
  scoreConfiance:    numeric('score_confiance', { precision: 4, scale: 3 }),
  lienPost:          text('lien_post'),
  statut:            statutLeadEnum('statut').notNull().default('nouveau'),
  tenantId:          text('tenant_id').notNull().references(() => tenants.id),
  createdAt:         timestamp('created_at').notNull().defaultNow(),
  updatedAt:         timestamp('updated_at').notNull().defaultNow(),
});

// ── Audit Logs ────────────────────────────────────────────
export const auditLogs = pgTable('audit_logs', {
  id:           text('id').primaryKey(),
  tenantId:     text('tenant_id').notNull().references(() => tenants.id),
  userId:       text('user_id').references(() => users.id),
  action:       text('action').notNull(),
  resourceType: text('resource_type').notNull(),
  resourceId:   text('resource_id'),
  details:      jsonb('details'),
  ipAddress:    text('ip_address'),
  createdAt:    timestamp('created_at').notNull().defaultNow(),
});

// ── Catalogue templates ───────────────────────────────────
export const catalogueTemplates = pgTable('catalogue_templates', {
  id:              text('id').primaryKey(),
  tenantId:        text('tenant_id').notNull().references(() => tenants.id),
  nom:             text('nom').notNull(),
  description:     text('description'),
  secteurActivite: text('secteur_activite'),
  payload:         jsonb('payload').notNull(), // { categories: [], produits: [] }
  createdAt:       timestamp('created_at').notNull().defaultNow(),
});

// ── Inventaires (Comptage Physique) ────────────────────────
export const inventaires = pgTable('inventaires', {
  id:             text('id').primaryKey(),
  tenantId:       text('tenant_id').notNull().references(() => tenants.id),
  date:           timestamp('date').notNull().defaultNow(),
  utilisateurId: text('utilisateur_id').notNull(),
  utilisateurNom:text('utilisateur_nom').notNull(),
  statut:         text('statut').notNull().default('en_cours'), // 'en_cours' | 'valide'
  lignes:         jsonb('lignes').notNull().default([]), // array of { produitId, produitRef, produitNom, stockTheorique, stockReel, ecart }
  notes:          text('notes'),
  createdAt:      timestamp('created_at').notNull().defaultNow(),
  updatedAt:      timestamp('updated_at').notNull().defaultNow(),
});

// ── Sorties de Caisse ─────────────────────────────────────
export const sortiesCaisse = pgTable('sorties_caisse', {
  id:             text('id').primaryKey(),
  tenantId:       text('tenant_id').notNull().references(() => tenants.id),
  montant:        numeric('montant', { precision: 15, scale: 2 }).notNull(),
  motif:          text('motif').notNull(),
  categorie:      text('categorie').notNull(),
  beneficiaire:   text('beneficiaire'),
  utilisateurId: text('utilisateur_id').notNull(),
  utilisateurNom:text('utilisateur_nom').notNull(),
  date:           timestamp('date').notNull().defaultNow(),
  createdAt:      timestamp('created_at').notNull().defaultNow(),
});

// ── Retours Clients ───────────────────────────────────────
export const retoursClients = pgTable('retours_clients', {
  id:                text('id').primaryKey(),
  tenantId:          text('tenant_id').notNull().references(() => tenants.id),
  factureId:         text('facture_id').notNull().references(() => factures.id),
  factureNumero:     text('facture_numero').notNull(),
  clientId:          text('client_id').notNull().references(() => clients.id),
  clientNom:         text('client_nom').notNull(),
  lignes:            jsonb('lignes').notNull().default([]),  // { produitId?, designation, quantite, prixUnitaire, total }[]
  totalTTC:          numeric('total_ttc', { precision: 15, scale: 2 }).notNull().default('0'),
  motif:             text('motif').notNull(),
  remboursementMode: remboursementModeEnum('remboursement_mode').notNull(),
  utilisateurId:     text('utilisateur_id'),
  utilisateurNom:    text('utilisateur_nom'),
  createdAt:         timestamp('created_at').notNull().defaultNow(),
});

// ── Clôtures de Caisse (Rapport Z) ──────────────────────
export const cloturesCaisse = pgTable('clotures_caisse', {
  id:               text('id').primaryKey(),
  tenantId:         text('tenant_id').notNull().references(() => tenants.id),
  date:             timestamp('date').notNull().defaultNow(),
  totalVentes:      numeric('total_ventes', { precision: 15, scale: 2 }).notNull(),
  nbVentes:         integer('nb_ventes').notNull().default(0),
  repartition:      jsonb('repartition').notNull().default({}),
  montantTheorique: numeric('montant_theorique', { precision: 15, scale: 2 }).notNull(),
  montantReel:      numeric('montant_reel', { precision: 15, scale: 2 }).notNull(),
  ecart:            numeric('ecart', { precision: 15, scale: 2 }).notNull(),
  notes:            text('notes'),
  utilisateurId:   text('utilisateur_id').notNull(),
  utilisateurNom:  text('utilisateur_nom').notNull(),
  vendeurId:        text('vendeur_id').notNull(),
  vendeurNom:       text('vendeur_nom').notNull(),
  createdAt:        timestamp('created_at').notNull().defaultNow(),
});

// ── Type helpers ──────────────────────────────────────────
export type TenantRow         = typeof tenants.$inferSelect;
export type UserRow           = typeof users.$inferSelect;
export type CategoryRow       = typeof categories.$inferSelect;
export type MagasinRow        = typeof magasins.$inferSelect;
export type FournisseurRow    = typeof fournisseurs.$inferSelect;
export type ProduitRow        = typeof produits.$inferSelect;
export type ClientRow         = typeof clients.$inferSelect;
export type CommandeRow       = typeof commandes.$inferSelect;
export type FactureRow        = typeof factures.$inferSelect;
export type CommandeCFRow     = typeof commandesFournisseurs.$inferSelect;
export type ParametresRow     = typeof parametres.$inferSelect;
export type UniteRow          = typeof unites.$inferSelect;
export type GroupeSurveilleRow = typeof groupesSurveilles.$inferSelect;
export type LeadRow            = typeof leads.$inferSelect;
export type AuditLogRow            = typeof auditLogs.$inferSelect;
export type CatalogueTemplateRow   = typeof catalogueTemplates.$inferSelect;
export type InventaireRow          = typeof inventaires.$inferSelect;
export type SortieCaisseRow        = typeof sortiesCaisse.$inferSelect;
export type ClotureCaisseRow       = typeof cloturesCaisse.$inferSelect;
export type RetourClientRow        = typeof retoursClients.$inferSelect;
