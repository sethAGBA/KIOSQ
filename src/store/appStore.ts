import { create } from 'zustand';
import type {
  Client, Produit, Commande, Facture,
  Fournisseur, CommandeFournisseur, Notification, Categorie,
} from '@/types';
import {
  mockClients, mockProduits, mockCommandes, mockFactures,
  mockFournisseurs, mockCommandesFournisseurs, mockNotifications, mockCategories,
} from '@/data/mock';
import {
  clientsApi, produitsApi, commandesApi,
  facturesApi, fournisseursApi, categoriesApi,
  commandesFournisseursApi,
} from '@/lib/api';

const USE_API = Boolean(import.meta.env.VITE_API_URL);

interface LoadingState {
  clients: boolean;
  produits: boolean;
  commandes: boolean;
  factures: boolean;
  fournisseurs: boolean;
  commandesFournisseurs: boolean;
}

interface AppState {
  // Data
  clients: Client[];
  produits: Produit[];
  commandes: Commande[];
  factures: Facture[];
  fournisseurs: Fournisseur[];
  commandesFournisseurs: CommandeFournisseur[];
  notifications: Notification[];
  categories: Categorie[];
  loading: LoadingState;

  // ── Fetch actions (API or mock) ───────────────────────
  fetchClients:                () => Promise<void>;
  fetchProduits:               () => Promise<void>;
  fetchCommandes:              () => Promise<void>;
  fetchFactures:               () => Promise<void>;
  fetchFournisseurs:           () => Promise<void>;
  fetchCategories:             () => Promise<void>;
  fetchCommandesFournisseurs:  () => Promise<void>;
  fetchAll:                    () => Promise<void>;

  // ── Clients ───────────────────────────────────────────
  addClient:    (c: Client) => void;
  updateClient: (id: string, c: Partial<Client>) => void;
  deleteClient: (id: string) => void;

  // ── Produits ──────────────────────────────────────────
  addProduit:    (p: Produit) => void;
  updateProduit: (id: string, p: Partial<Produit>) => void;
  deleteProduit: (id: string) => void;

  // ── Commandes ─────────────────────────────────────────
  addCommande:    (c: Commande) => void;
  updateCommande: (id: string, c: Partial<Commande>) => void;

  // ── Factures ──────────────────────────────────────────
  addFacture:    (f: Facture) => void;
  updateFacture: (id: string, f: Partial<Facture>) => void;

  // ── Fournisseurs ──────────────────────────────────────
  addFournisseur:    (f: Fournisseur) => void;
  updateFournisseur: (id: string, f: Partial<Fournisseur>) => void;

  // ── Commandes fournisseurs ────────────────────────────
  addCommandeFournisseur:    (c: CommandeFournisseur) => void;
  updateCommandeFournisseur: (id: string, c: Partial<CommandeFournisseur>) => void;

  // ── Catégories ────────────────────────────────────────
  addCategorie:    (c: Categorie) => void;
  updateCategorie: (id: string, c: Partial<Categorie>) => void;
  deleteCategorie: (id: string) => void;

  // ── Notifications ─────────────────────────────────────
  markNotificationRead:    (id: string) => void;
  markAllNotificationsRead: () => void;
}

export const useAppStore = create<AppState>()((set, get) => ({
  // ── Initial state (mocks) ─────────────────────────────
  clients:               USE_API ? [] : mockClients,
  produits:              USE_API ? [] : mockProduits,
  commandes:             USE_API ? [] : mockCommandes,
  factures:              USE_API ? [] : mockFactures,
  fournisseurs:          USE_API ? [] : mockFournisseurs,
  commandesFournisseurs: mockCommandesFournisseurs,
  notifications:         mockNotifications,
  categories:            USE_API ? [] : mockCategories,
  loading: {
    clients: false, produits: false, commandes: false,
    factures: false, fournisseurs: false, commandesFournisseurs: false,
  },

  // ── Fetch ─────────────────────────────────────────────
  fetchClients: async () => {
    if (!USE_API) return;
    set(s => ({ loading: { ...s.loading, clients: true } }));
    try {
      const data = await clientsApi.list();
      set({ clients: data });
    } finally {
      set(s => ({ loading: { ...s.loading, clients: false } }));
    }
  },

  fetchProduits: async () => {
    if (!USE_API) return;
    set(s => ({ loading: { ...s.loading, produits: true } }));
    try {
      const data = await produitsApi.list();
      set({ produits: data });
    } finally {
      set(s => ({ loading: { ...s.loading, produits: false } }));
    }
  },

  fetchCommandes: async () => {
    if (!USE_API) return;
    set(s => ({ loading: { ...s.loading, commandes: true } }));
    try {
      const data = await commandesApi.list();
      set({ commandes: data });
    } finally {
      set(s => ({ loading: { ...s.loading, commandes: false } }));
    }
  },

  fetchFactures: async () => {
    if (!USE_API) return;
    set(s => ({ loading: { ...s.loading, factures: true } }));
    try {
      const data = await facturesApi.list();
      set({ factures: data });
    } finally {
      set(s => ({ loading: { ...s.loading, factures: false } }));
    }
  },

  fetchFournisseurs: async () => {
    if (!USE_API) return;
    set(s => ({ loading: { ...s.loading, fournisseurs: true } }));
    try {
      const data = await fournisseursApi.list();
      set({ fournisseurs: data });
    } finally {
      set(s => ({ loading: { ...s.loading, fournisseurs: false } }));
    }
  },

  fetchCategories: async () => {
    if (!USE_API) return;
    try {
      const data = await categoriesApi.list();
      set({ categories: data });
    } catch { /* ignore */ }
  },

  fetchCommandesFournisseurs: async () => {
    if (!USE_API) return;
    set(s => ({ loading: { ...s.loading, commandesFournisseurs: true } }));
    try {
      const data = await commandesFournisseursApi.list();
      set({ commandesFournisseurs: data });
    } finally {
      set(s => ({ loading: { ...s.loading, commandesFournisseurs: false } }));
    }
  },

  fetchAll: async () => {
    const { fetchClients, fetchProduits, fetchCommandes, fetchFactures, fetchFournisseurs, fetchCategories, fetchCommandesFournisseurs } = get();
    await Promise.all([
      fetchClients(), fetchProduits(), fetchCommandes(),
      fetchFactures(), fetchFournisseurs(), fetchCategories(),
      fetchCommandesFournisseurs(),
    ]);
  },

  // ── Clients ───────────────────────────────────────────
  addClient:    (c) => set(s => ({ clients: [...s.clients, c] })),
  updateClient: (id, c) =>
    set(s => ({ clients: s.clients.map(x => x.id === id ? { ...x, ...c } : x) })),
  deleteClient: (id) =>
    set(s => ({ clients: s.clients.filter(x => x.id !== id) })),

  // ── Produits ──────────────────────────────────────────
  addProduit:    (p) => set(s => ({ produits: [...s.produits, p] })),
  updateProduit: (id, p) =>
    set(s => ({ produits: s.produits.map(x => x.id === id ? { ...x, ...p } : x) })),
  deleteProduit: (id) =>
    set(s => ({ produits: s.produits.filter(x => x.id !== id) })),

  // ── Commandes ─────────────────────────────────────────
  addCommande:    (c) => set(s => ({ commandes: [...s.commandes, c] })),
  updateCommande: (id, c) =>
    set(s => ({ commandes: s.commandes.map(x => x.id === id ? { ...x, ...c } : x) })),

  // ── Factures ──────────────────────────────────────────
  addFacture:    (f) => set(s => ({ factures: [...s.factures, f] })),
  updateFacture: (id, f) =>
    set(s => ({ factures: s.factures.map(x => x.id === id ? { ...x, ...f } : x) })),

  // ── Fournisseurs ──────────────────────────────────────
  addFournisseur:    (f) => set(s => ({ fournisseurs: [...s.fournisseurs, f] })),
  updateFournisseur: (id, f) =>
    set(s => ({ fournisseurs: s.fournisseurs.map(x => x.id === id ? { ...x, ...f } : x) })),

  // ── Commandes fournisseurs ────────────────────────────
  addCommandeFournisseur: (c) =>
    set(s => ({ commandesFournisseurs: [...s.commandesFournisseurs, c] })),
  updateCommandeFournisseur: (id, c) =>
    set(s => ({ commandesFournisseurs: s.commandesFournisseurs.map(x => x.id === id ? { ...x, ...c } : x) })),

  // ── Catégories ────────────────────────────────────────
  addCategorie: (c) => set(s => ({ categories: [...s.categories, c] })),
  updateCategorie: (id, c) =>
    set(s => ({ categories: s.categories.map(x => x.id === id ? { ...x, ...c } : x) })),
  deleteCategorie: (id) =>
    set(s => ({ categories: s.categories.filter(x => x.id !== id) })),

  // ── Notifications ─────────────────────────────────────
  markNotificationRead: (id) =>
    set(s => ({ notifications: s.notifications.map(n => n.id === id ? { ...n, lu: true } : n) })),
  markAllNotificationsRead: () =>
    set(s => ({ notifications: s.notifications.map(n => ({ ...n, lu: true })) })),
}));

// ── Selectors ─────────────────────────────────────────────
export const selectUnreadCount      = (s: AppState) => s.notifications.filter(n => !n.lu).length;
export const selectAlertesProduits  = (s: AppState) => s.produits.filter(p => p.stockActuel <= p.stockMinimum);
export const selectFacturesEnRetard = (s: AppState) => s.factures.filter(f => f.statut === 'en_retard');
