import { create } from 'zustand';
import type {
  Client, Produit, Commande, Facture,
  Fournisseur, CommandeFournisseur, Notification, Categorie, Magasin,
} from '@/types';
import {
  mockClients, mockProduits, mockCommandes, mockFactures,
  mockFournisseurs, mockCommandesFournisseurs, mockNotifications, mockCategories,
} from '@/data/mock';
import {
  clientsApi, produitsApi, commandesApi, facturesApi, fournisseursApi,
  commandesFournisseursApi, notificationsApi, categoriesApi, magasinsApi, USE_API,
} from '@/lib/api';


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
  magasins: Magasin[];
  notifications: Notification[];
  categories: Categorie[];
  loading: LoadingState;
  error: string | null;

  // ── Fetch actions (API or mock) ───────────────────────
  fetchClients:                () => Promise<void>;
  fetchProduits:               () => Promise<void>;
  fetchCommandes:              () => Promise<void>;
  fetchFactures:               () => Promise<void>;
  fetchFournisseurs:           () => Promise<void>;
  fetchCategories:             () => Promise<void>;
  fetchCommandesFournisseurs:  () => Promise<void>;
  fetchNotifications:          () => Promise<void>;
  fetchMagasins:               () => Promise<void>;
  fetchAll:                    () => Promise<void>;

  // ── Clients ───────────────────────────────────────────
  addClient:    (c: Client) => void;
  updateClient: (id: string, c: Partial<Client>) => void;
  deleteClient: (id: string) => void;
  reglerDetteClient: (clientId: string, montant: number, modePaiement: string) => Promise<void>;
  annulerDernierReglement: (clientId: string) => Promise<void>;

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
  deleteFournisseur: (id: string) => void;
  reglerDetteFournisseur: (fournisseurId: string, montant: number, modePaiement: string) => Promise<void>;
  annulerDernierReglementFournisseur: (fournisseurId: string) => Promise<void>;

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
  commandesFournisseurs: USE_API ? [] : mockCommandesFournisseurs,
  magasins:              [],
  notifications:         USE_API ? [] : mockNotifications,
  categories:            USE_API ? [] : mockCategories,
  loading: {
    clients: false, produits: false, commandes: false,
    factures: false, fournisseurs: false, commandesFournisseurs: false,
  },
  error: null,

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

  fetchNotifications: async () => {
    let rawNotifications: any[] = [];
    if (USE_API) {
      try {
        rawNotifications = await notificationsApi.list();
      } catch { /* Silent fail */ }
    } else {
      const state = get();
      const alertes = state.produits.filter(p => p.stockActuel <= p.stockMinimum);
      const factures = state.factures.filter(f => f.statut === 'en_retard');
      const cf = state.commandesFournisseurs.filter(c => c.statut === 'commandee');
      
      for (const p of alertes) {
        const rupture = p.stockActuel === 0;
        rawNotifications.push({ id: `alerte-${p.id}`, type: 'alerte_stock', titre: rupture ? 'Rupture de stock' : 'Stock bas', message: rupture ? `${p.designation} (${p.reference}) : stock à 0` : `${p.designation} : ${p.stockActuel} unité(s)`, lu: false, lien: '/produits', createdAt: new Date().toISOString() });
      }
      for (const f of factures) {
        rawNotifications.push({ id: `facture-${f.id}`, type: 'facture_due', titre: 'Facture en retard', message: `Facture ${f.numero} - ${f.clientNom}`, lu: false, lien: `/facturation/${f.id}`, createdAt: new Date().toISOString() });
      }
      for (const c of cf) {
        rawNotifications.push({ id: `cf-${c.id}`, type: 'commande', titre: 'Commande fournisseur', message: `Commande ${c.numero} - ${c.fournisseurNom}`, lu: false, lien: `/fournisseurs/commandes/${c.id}`, createdAt: new Date().toISOString() });
      }
    }

    // Restore read state
    const readIds: string[] = JSON.parse(localStorage.getItem('kiosq_read_notifications') || '[]');
    set({
      notifications: rawNotifications.map(n => ({
        ...n,
        type: n.type as Notification['type'],
        createdAt: new Date(n.createdAt),
        lu: readIds.includes(n.id)
      }))
    });
  },

  fetchMagasins: async () => {
    if (!USE_API) return;
    try {
      const data = await magasinsApi.list();
      set({ magasins: data });
    } catch { /* ignore */ }
  },

  fetchAll: async () => {
    const { fetchClients, fetchProduits, fetchCommandes, fetchFactures, fetchFournisseurs, fetchCategories, fetchCommandesFournisseurs, fetchNotifications, fetchMagasins } = get();
    set({ error: null });
    try {
      await Promise.all([
        fetchClients(), fetchProduits(), fetchCommandes(),
        fetchFactures(), fetchFournisseurs(), fetchCategories(),
        fetchCommandesFournisseurs(), fetchNotifications(), fetchMagasins(),
      ]);
    } catch (err: any) {
      console.error('[fetchAll error]', err);
      set({ error: err.message || 'Erreur de connexion à l\'API' });
    }
  },

  // ── Clients ───────────────────────────────────────────
  addClient:    (c) => set(s => ({ clients: [...s.clients, c] })),
  updateClient: (id, c) =>
    set(s => ({ clients: s.clients.map(x => x.id === id ? { ...x, ...c } : x) })),
  deleteClient: (id) =>
    set(s => ({ clients: s.clients.filter(x => x.id !== id) })),
  reglerDetteClient: async (clientId, montant, modePaiement) => {
    if (USE_API) {
      const res = await clientsApi.reglerDette(clientId, montant, modePaiement);
      get().updateClient(clientId, res.client);
      res.facturesUpdated.forEach(f => get().updateFacture(f.id, f));
    } else {
      const state = get();
      const client = state.clients.find(c => c.id === clientId);
      if (!client) throw new Error('Client introuvable');
      
      let reste = montant;
      const facturesOuvertes = state.factures
        .filter(f => f.clientId === clientId && f.resteAPayer > 0)
        .sort((a, b) => new Date(a.dateFacture).getTime() - new Date(b.dateFacture).getTime());
        
      for (const f of facturesOuvertes) {
        if (reste <= 0) break;
        const montantApplique = Math.min(f.resteAPayer, reste);
        const newReste = f.resteAPayer - montantApplique;
        const newPaye = f.montantPaye + montantApplique;
        
        const updatedFacture = {
          ...f,
          resteAPayer: newReste,
          montantPaye: newPaye,
          statut: newReste === 0 ? ('payee' as any) : ('partielle' as any),
          paiements: [
            ...f.paiements,
            { id: `pay-${Date.now()}-${Math.random()}`, montant: montantApplique, mode: modePaiement as any, date: new Date() }
          ]
        };
        state.updateFacture(f.id, updatedFacture);
        reste -= montantApplique;
      }
      
      state.updateClient(clientId, { soldeCredit: Math.max(0, client.soldeCredit - montant) });
    }
  },

  annulerDernierReglement: async (clientId) => {
    if (USE_API) {
      const res = await clientsApi.annulerDernierReglement(clientId);
      get().updateClient(clientId, res.client);
      if (res.factureUpdated) get().updateFacture(res.factureUpdated.id, res.factureUpdated);
    } else {
      const state = get();
      const client = state.clients.find(c => c.id === clientId);
      if (!client) throw new Error('Client introuvable');

      // Find the most recent payment across ALL client factures (any index)
      let lastPaiement: { factureId: string; paiementId: string; montant: number } | null = null;
      let lastDate = new Date(0);

      for (const f of state.factures.filter(f => f.clientId === clientId)) {
        if (!f.paiements || f.paiements.length === 0) continue;
        // Take the last payment of each facture
        const p = f.paiements[f.paiements.length - 1];
        const d = new Date(p.date);
        if (d > lastDate) {
          lastDate = d;
          lastPaiement = { factureId: f.id, paiementId: p.id, montant: Number(p.montant) };
        }
      }

      if (!lastPaiement) throw new Error('Aucun paiement \u00e0 annuler pour ce client');

      const facture = state.factures.find(f => f.id === lastPaiement!.factureId)!;
      const montantAnnule = lastPaiement.montant;
      const newPaiements = facture.paiements.slice(0, -1);
      const newPaye = Math.max(0, facture.montantPaye - montantAnnule);
      const newReste = facture.resteAPayer + montantAnnule;

      state.updateFacture(facture.id, {
        paiements: newPaiements,
        montantPaye: newPaye,
        resteAPayer: newReste,
        statut: newReste > 0 ? ('partielle' as any) : ('payee' as any),
      });
      state.updateClient(clientId, { soldeCredit: client.soldeCredit + montantAnnule });
    }
  },

  reglerDetteFournisseur: async (fournisseurId, montant, modePaiement) => {
    if (USE_API) {
      const res = await fournisseursApi.reglerDette(fournisseurId, montant, modePaiement);
      get().updateFournisseur(fournisseurId, res.fournisseur);
      res.commandesUpdated.forEach((c: any) => get().updateCommandeFournisseur(c.id, c));
    } else {
      const state = get();
      const fournisseur = state.fournisseurs.find(f => f.id === fournisseurId);
      if (!fournisseur) throw new Error('Fournisseur introuvable');
      
      const cmds = state.commandesFournisseurs
        .filter(c => c.fournisseurId === fournisseurId && c.statutPaiement !== 'paye' && c.resteAPayer > 0)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

      let restant = montant;
      cmds.forEach(c => {
        if (restant <= 0) return;
        const app = Math.min(restant, c.resteAPayer);
        const newReste = c.resteAPayer - app;
        const newPaye = c.montantPaye + app;
        const pArray = c.paiements || [];
        state.updateCommandeFournisseur(c.id, {
          montantPaye: newPaye,
          resteAPayer: newReste,
          paiements: [
            ...pArray,
            { id: `pay-${Date.now()}-${Math.random()}`, montant: app, mode: modePaiement as any, date: new Date() }
          ],
          statutPaiement: newReste === 0 ? 'paye' : 'partiel',
        });
        restant -= app;
      });
      state.updateFournisseur(fournisseurId, { soldeDette: Math.max(0, fournisseur.soldeDette - montant) });
    }
  },

  annulerDernierReglementFournisseur: async (fournisseurId) => {
    if (USE_API) {
      const res = await fournisseursApi.annulerDernierReglement(fournisseurId);
      get().updateFournisseur(fournisseurId, res.fournisseur);
      if (res.commandeUpdated) get().updateCommandeFournisseur(res.commandeUpdated.id, res.commandeUpdated);
    } else {
      const state = get();
      const fournisseur = state.fournisseurs.find(f => f.id === fournisseurId);
      if (!fournisseur) throw new Error('Fournisseur introuvable');

      let lastPaiement: { orderId: string; paiementId: string; montant: number } | null = null;
      let lastDate = new Date(0);

      for (const o of state.commandesFournisseurs.filter(o => o.fournisseurId === fournisseurId)) {
        if (!o.paiements || o.paiements.length === 0) continue;
        const p = o.paiements[o.paiements.length - 1];
        const d = new Date(p.date);
        if (d > lastDate) {
          lastDate = d;
          lastPaiement = { orderId: o.id, paiementId: p.id, montant: Number(p.montant) };
        }
      }

      if (!lastPaiement) throw new Error('Aucun paiement \u00e0 annuler pour ce fournisseur');

      const order = state.commandesFournisseurs.find(o => o.id === lastPaiement!.orderId)!;
      const montantAnnule = lastPaiement.montant;
      const newPaiements = order.paiements.slice(0, -1);
      const newPaye = Math.max(0, order.montantPaye - montantAnnule);
      const newReste = order.resteAPayer + montantAnnule;

      state.updateCommandeFournisseur(order.id, {
        paiements: newPaiements,
        montantPaye: newPaye,
        resteAPayer: newReste,
        statutPaiement: newReste === 0 ? 'paye' : newPaye > 0 ? 'partiel' : 'en_attente',
      });
      state.updateFournisseur(fournisseurId, { soldeDette: fournisseur.soldeDette + montantAnnule });
    }
  },

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
  deleteFournisseur: (id) =>
    set(s => ({ fournisseurs: s.fournisseurs.filter(x => x.id !== id) })),

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
  markNotificationRead: (id) => {
    set(s => {
      const newNotifs = s.notifications.map(n => n.id === id ? { ...n, lu: true } : n);
      const readIds = newNotifs.filter(n => n.lu).map(n => n.id);
      localStorage.setItem('kiosq_read_notifications', JSON.stringify(readIds));
      return { notifications: newNotifs };
    });
  },
  markAllNotificationsRead: () => {
    set(s => {
      const newNotifs = s.notifications.map(n => ({ ...n, lu: true }));
      const readIds = newNotifs.map(n => n.id);
      localStorage.setItem('kiosq_read_notifications', JSON.stringify(readIds));
      return { notifications: newNotifs };
    });
  },
}));

// ── Selectors ─────────────────────────────────────────────
export const selectUnreadCount      = (s: AppState) => s.notifications.filter(n => !n.lu).length;
export const selectAlertesProduits  = (s: AppState) => s.produits.filter(p => p.stockActuel <= p.stockMinimum);
export const selectFacturesEnRetard = (s: AppState) => s.factures.filter(f => f.statut === 'en_retard');
