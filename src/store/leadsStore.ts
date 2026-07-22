import { create } from 'zustand';
import type { Lead, GroupeSurveille, Client, StatutLead } from '@/types';
import { leadsApi, groupesApi } from '@/lib/api';

export interface LeadsFilters {
  statut?: StatutLead;
  produit?: string;
  score_min?: number;
}

interface LeadsState {
  // Données
  leads: Lead[];
  total: number;
  page: number;
  limit: number;
  filters: LeadsFilters;
  loading: boolean;
  leadsNouveauCount: number;

  // Groupes surveillés
  groupes: GroupeSurveille[];
  groupesLoading: boolean;

  // Actions
  fetchLeads: (newFilters?: Partial<LeadsFilters>) => Promise<void>;
  setPage: (page: number) => void;
  updateLeadStatut: (id: string, statut: StatutLead) => Promise<void>;
  convertirLead: (id: string) => Promise<Client>;
  fetchLeadsNouveauCount: () => Promise<void>;

  // Actions groupes
  fetchGroupes: () => Promise<void>;
  createGroupe: (data: Partial<GroupeSurveille> & { cookieSession?: string }) => Promise<void>;
  updateGroupe: (id: string, data: Partial<GroupeSurveille> & { cookieSession?: string }) => Promise<void>;
  deleteGroupe: (id: string) => Promise<void>;
}

export const useLeadsStore = create<LeadsState>()((set, get) => ({
  leads: [],
  total: 0,
  page: 1,
  limit: 20,
  filters: {},
  loading: false,
  leadsNouveauCount: 0,
  groupes: [],
  groupesLoading: false,

  fetchLeads: async (newFilters) => {
    const { page, limit, filters } = get();
    const merged = { ...filters, ...newFilters };
    set({ loading: true, filters: merged });
    try {
      const data = await leadsApi.list({ page, limit, ...merged });
      set({ leads: data.leads, total: data.total });
    } catch (e) {
      console.error('[leadsStore.fetchLeads]', e);
      throw e;
    } finally {
      set({ loading: false });
    }
  },

  setPage: (page) => {
    set({ page });
    get().fetchLeads();
  },

  updateLeadStatut: async (id, statut) => {
    const lead = await leadsApi.updateStatut(id, statut);
    set(s => ({
      leads: s.leads.map(l => l.id === id ? lead : l),
      leadsNouveauCount:
        statut !== 'nouveau' && s.leads.find(l => l.id === id)?.statut === 'nouveau'
          ? Math.max(0, s.leadsNouveauCount - 1)
          : s.leadsNouveauCount,
    }));
  },

  convertirLead: async (id) => {
    const client = await leadsApi.convertir(id);
    set(s => ({
      leads: s.leads.map(l =>
        l.id === id ? { ...l, clientId: client.id, statut: 'envoye' as StatutLead } : l
      ),
      leadsNouveauCount: s.leads.find(l => l.id === id)?.statut === 'nouveau'
        ? Math.max(0, s.leadsNouveauCount - 1)
        : s.leadsNouveauCount,
    }));
    return client;
  },

  fetchLeadsNouveauCount: async () => {
    try {
      const data = await leadsApi.list({ statut: 'nouveau', page: 1, limit: 1 });
      set({ leadsNouveauCount: data.total });
    } catch {
      // Silent fail — badge stays at previous count
    }
  },

  fetchGroupes: async () => {
    set({ groupesLoading: true });
    try {
      const data = await groupesApi.list();
      set({ groupes: data });
    } catch (e) {
      console.error('[leadsStore.fetchGroupes]', e);
    } finally {
      set({ groupesLoading: false });
    }
  },

  createGroupe: async (data) => {
    await groupesApi.create(data);
    get().fetchGroupes();
  },

  updateGroupe: async (id, data) => {
    await groupesApi.update(id, data);
    get().fetchGroupes();
  },

  deleteGroupe: async (id) => {
    await groupesApi.remove(id);
    get().fetchGroupes();
  },
}));
