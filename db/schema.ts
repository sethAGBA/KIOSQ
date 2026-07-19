import {
  pgTable, text, integer, numeric, boolean,
  timestamp, jsonb, pgEnum,
} from 'drizzle-orm/pg-core';

// ── Enums ────────────────────────────────────────────────
export const userRoleEnum = pgEnum('user_role', [
  'admin', 'commercial', 'gestionnaire', 'comptable', 'lecteur',
]);

export const typeClientEnum = pgEnum('type_client', ['particulier', 'entreprise']);

export const statutCommandeEnum = pgEnum('statut_commande', [
  'brouillon', 'envoye', 'confirme', 'en_preparation',
  'expedie', 'livre', 'annule', 'accepte', 'refuse', 'expire',
]);

export const typeCommandeEnum = pgEnum('type_commande', ['commande', 'devis']);

export const statutFactureEnum = pgEnum('statut_facture', [
  'brouillon', 'envoyee', 'payee', 'partielle', 'en_retard', 'annulee',
]);

export const statutCFEnum = pgEnum('statut_commande_fournisseur', [
  'brouillon', 'commandee', 'recu_partiel', 'recu', 'annulee',
]);

// ── Users ────────────────────────────────────────────────
export const users = pgTable('users', {
  id:           text('id').primaryKey(),
  email:        text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  nom:          text('nom').notNull(),
  prenom:       text('prenom').notNull(),
  role:         userRoleEnum('role').notNull().default('lecteur'),
  telephone:    text('telephone'),
  actif:        boolean('actif').notNull().default(true),
  createdAt:    timestamp('created_at').notNull().defaultNow(),
  updatedAt:    timestamp('updated_at').notNull().defaultNow(),
});

// ── Categories ────────────────────────────────────────────
export const categories = pgTable('categories', {
  id:          text('id').primaryKey(),
  nom:         text('nom').notNull(),
  description: text('description'),
  couleur:     text('couleur'),
  createdAt:   timestamp('created_at').notNull().defaultNow(),
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
  emplacement:  text('emplacement'),
  codeBarres:   text('code_barres'),
  actif:        boolean('actif').notNull().default(true),
  createdAt:    timestamp('created_at').notNull().defaultNow(),
  updatedAt:    timestamp('updated_at').notNull().defaultNow(),
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
  createdAt:        timestamp('created_at').notNull().defaultNow(),
  updatedAt:        timestamp('updated_at').notNull().defaultNow(),
});

// ── Commandes / Devis ─────────────────────────────────────
export const commandes = pgTable('commandes', {
  id:               text('id').primaryKey(),
  numero:           text('numero').notNull().unique(),
  type:             typeCommandeEnum('type').notNull().default('commande'),
  clientId:         text('client_id').notNull().references(() => clients.id),
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
  statutPaiement:       text('statut_paiement').notNull().default('en_attente'),
  dateCommande:         timestamp('date_commande').notNull().defaultNow(),
  dateLivraisonPrevue:  timestamp('date_livraison_prevue'),
  dateReception:        timestamp('date_reception'),
  notes:                text('notes'),
  createdBy:            text('created_by').references(() => users.id),
  createdAt:            timestamp('created_at').notNull().defaultNow(),
  updatedAt:            timestamp('updated_at').notNull().defaultNow(),
});

// ── Type helpers ──────────────────────────────────────────
export type UserRow           = typeof users.$inferSelect;
export type CategoryRow       = typeof categories.$inferSelect;
export type FournisseurRow    = typeof fournisseurs.$inferSelect;
export type ProduitRow        = typeof produits.$inferSelect;
export type ClientRow         = typeof clients.$inferSelect;
export type CommandeRow       = typeof commandes.$inferSelect;
export type FactureRow        = typeof factures.$inferSelect;
export type CommandeCFRow     = typeof commandesFournisseurs.$inferSelect;
