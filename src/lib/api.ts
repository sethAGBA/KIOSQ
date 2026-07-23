/**
 * Central API client — wraps fetch calls to Vercel API routes.
 * Falls back gracefully: if VITE_API_URL is not set, mock data is used via the stores.
 */

import { getTenantId } from '@/lib/tenant';

const BASE = import.meta.env.VITE_API_URL ?? '';

export const USE_API = Boolean(import.meta.env.VITE_API_URL) || import.meta.env.PROD;


type ApiResponse<T> = { ok: true; data: T } | { ok: false; error: string };

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('kiosq_jwt') : null;
  const authHeader: Record<string, string> = token ? { 'Authorization': `Bearer ${token}` } : {};

  // Inject X-Tenant-ID at request time so it always reflects the current tenant,
  // even if the store was populated after module load. Omit the header for
  // superadmin sessions where getTenantId() returns null.
  const tenantId = getTenantId();
  const tenantHeader: Record<string, string> = tenantId
    ? { 'X-Tenant-ID': tenantId }
    : {};

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    credentials: 'include', // send httpOnly cookie
    headers: {
      'Content-Type': 'application/json',
      ...authHeader,
      ...tenantHeader,
      ...options.headers,
    },
  });

  let json: ApiResponse<T> | null = null;
  try {
    json = (await res.json()) as ApiResponse<T>;
  } catch {
    // Response is non-JSON (e.g., 502/504 HTML error from Vercel proxy)
  }

  if (!res.ok || !json || !json.ok) {
    const msg = (json && !json.ok && 'error' in json) ? json.error : `HTTP ${res.status}`;
    throw new Error(msg);
  }

  return (json as { ok: true; data: T }).data;
}

const get  = <T>(path: string) => request<T>(path);
const post = <T>(path: string, body: unknown) =>
  request<T>(path, { method: 'POST', body: JSON.stringify(body) });
const patch = <T>(path: string, body: unknown) =>
  request<T>(path, { method: 'PATCH', body: JSON.stringify(body) });
const del  = <T>(path: string) => request<T>(path, { method: 'DELETE' });

export const api = { get, post, patch, del };

// ── Auth ──────────────────────────────────────────────────
export const authApi = {
  login:  (email: string, password: string) =>
    post<{ token?: string; id: string; email: string; role: string; nom: string; prenom: string; actif: boolean }>(
      '/api/auth/login', { email, password }
    ),
  me:     () => get<{ id: string; email: string; role: string; nom: string; prenom: string; actif: boolean }>('/api/auth/me'),
  logout: () => post<{ message: string }>('/api/auth/logout', {}),
};

// ── Clients ───────────────────────────────────────────────
export const clientsApi = {
  list:   (q?: string) => get<import('@/types').Client[]>(`/api/clients${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  get:    (id: string) => get<import('@/types').Client>(`/api/clients/${id}`),
  create: (data: Partial<import('@/types').Client>) => post<import('@/types').Client>('/api/clients', data),
  update: (id: string, data: Partial<import('@/types').Client>) => patch<import('@/types').Client>(`/api/clients/${id}`, data),
  remove: (id: string) => del<{ message: string }>(`/api/clients/${id}`),
  reglerDette: (id: string, montant: number, modePaiement: string) => 
    post<{ success: boolean; client: import('@/types').Client; facturesUpdated: import('@/types').Facture[] }>(`/api/clients/${id}/reglement`, { montant, modePaiement }),
  annulerDernierReglement: (id: string) =>
    post<{ success: boolean; client: import('@/types').Client; factureUpdated?: import('@/types').Facture }>(`/api/clients/${id}/annuler-reglement`, {}),
};

// ── Produits ──────────────────────────────────────────────
export const produitsApi = {
  list:   (params?: { q?: string; alerte?: boolean; categorieId?: string }) => {
    const qs = new URLSearchParams();
    if (params?.q) qs.set('q', params.q);
    if (params?.alerte) qs.set('alerte', '1');
    if (params?.categorieId) qs.set('categorieId', params.categorieId);
    const query = qs.toString();
    return get<import('@/types').Produit[]>(`/api/produits${query ? `?${query}` : ''}`);
  },
  get:    (id: string) => get<import('@/types').Produit>(`/api/produits/${id}`),
  create: (data: Partial<import('@/types').Produit>) => post<import('@/types').Produit>('/api/produits', data),
  update: (id: string, data: Partial<import('@/types').Produit>) => patch<import('@/types').Produit>(`/api/produits/${id}`, data),
  remove: (id: string) => del<{ message: string }>(`/api/produits/${id}`),
};

// ── Commandes ─────────────────────────────────────────────
export const commandesApi = {
  list:   (params?: { type?: string; statut?: string }) => {
    const qs = new URLSearchParams(params as Record<string, string>);
    return get<import('@/types').Commande[]>(`/api/commandes?${qs}`);
  },
  get:    (id: string) => get<import('@/types').Commande>(`/api/commandes/${id}`),
  create: (data: Partial<import('@/types').Commande>) => post<import('@/types').Commande>('/api/commandes', data),
  update: (id: string, data: Partial<import('@/types').Commande>) => patch<import('@/types').Commande>(`/api/commandes/${id}`, data),
};

// ── Factures ──────────────────────────────────────────────
export const facturesApi = {
  list:      (statut?: string) => get<import('@/types').Facture[]>(`/api/factures${statut ? `?statut=${statut}` : ''}`),
  get:       (id: string) => get<import('@/types').Facture>(`/api/factures/${id}`),
  create:    (data: Partial<import('@/types').Facture>) => post<import('@/types').Facture>('/api/factures', data),
  update:    (id: string, data: Partial<import('@/types').Facture>) => patch<import('@/types').Facture>(`/api/factures/${id}`, data),
  addPaiement: (id: string, paiement: import('@/types').Paiement) =>
    post<import('@/types').Facture>(`/api/factures/${id}`, paiement),

  /** Annule une vente et restaure le stock côté serveur */
  annuler: (id: string, motif: string) =>
    patch<import('@/types').Facture>(`/api/factures/${id}`, { statut: 'annulee', notes: motif }),

  /** Enregistre un retour client et restaure le stock côté serveur */
  retour: (
    id: string,
    payload: {
      lignesRetour: { designation: string; quantite: number; prixUnitaire: number }[];
      motif: string;
      remboursementMode: 'especes' | 'credit_reduc' | 'avoir';
    }
  ) => post<import('@/types').Facture>(`/api/factures/${id}/retour`, payload),
};

// ── Fournisseurs ──────────────────────────────────────────
export const fournisseursApi = {
  list:   () => get<import('@/types').Fournisseur[]>('/api/fournisseurs'),
  get:    (id: string) => get<import('@/types').Fournisseur>(`/api/fournisseurs/${id}`),
  create: (data: Partial<import('@/types').Fournisseur>) => post<import('@/types').Fournisseur>('/api/fournisseurs', data),
  update: (id: string, data: Partial<import('@/types').Fournisseur>) => patch<import('@/types').Fournisseur>(`/api/fournisseurs/${id}`, data),
  reglerDette: (id: string, montant: number, modePaiement: string) => 
    post<{ success: boolean; fournisseur: import('@/types').Fournisseur; commandesUpdated: import('@/types').CommandeFournisseur[] }>(`/api/fournisseurs/${id}/reglement`, { montant, modePaiement }),
  annulerDernierReglement: (id: string) =>
    post<{ success: boolean; fournisseur: import('@/types').Fournisseur; commandeUpdated?: import('@/types').CommandeFournisseur }>(`/api/fournisseurs/${id}/annuler-reglement`, {}),
};

// ── Catégories ────────────────────────────────────────────
export const categoriesApi = {
  list:   () => get<import('@/types').Categorie[]>('/api/categories'),
  create: (data: { nom: string; description?: string; couleur?: string }) =>
    post<import('@/types').Categorie>('/api/categories', data),
  update: (id: string, data: Partial<import('@/types').Categorie>) =>
    patch<import('@/types').Categorie>(`/api/categories/${id}`, data),
  remove: (id: string) => del<{ message: string }>(`/api/categories/${id}`),
};

// ── Magasins ──────────────────────────────────────────────
export const magasinsApi = {
  list:   () => get<import('@/types').Magasin[]>('/api/magasins'),
  create: (data: { nom: string; adresse?: string; telephone?: string }) =>
    post<import('@/types').Magasin>('/api/magasins', data),
  update: (id: string, data: Partial<{ nom: string; adresse: string; telephone: string; actif: boolean }>) =>
    patch<import('@/types').Magasin>(`/api/magasins/${id}`, data),
  delete: (id: string) =>
    del<{ message: string }>(`/api/magasins/${id}`),
};

// ── Mouvements de stock ───────────────────────────────────
export const mouvementsApi = {
  list: (params?: { type?: string; start?: string; end?: string }) => {
    const cleanParams: Record<string, string> = {};
    if (params?.type && params.type !== 'tous') cleanParams.type = params.type;
    if (params?.start) cleanParams.start = params.start;
    if (params?.end) cleanParams.end = params.end;
    const searchStr = new URLSearchParams(cleanParams).toString();
    const q = searchStr ? `?${searchStr}` : '';
    return get<import('@/types').Mouvement[]>('/api/mouvements' + q);
  },
  create: (data: { produitId: string; type: string; quantite: number; motif?: string }) =>
    post<import('@/types').Mouvement>('/api/mouvements', data),
};

// ── Inventaires ──────────────────────────────────────────
export const inventairesApi = {
  list:    () => get<import('@/types').InventaireSession[]>('/api/inventaires'),
  create:  (data: { lignes: import('@/types').LigneInventaire[]; notes?: string; autoValidate?: boolean }) =>
    post<import('@/types').InventaireSession>('/api/inventaires', data),
  valider: (id: string) =>
    post<import('@/types').InventaireSession>(`/api/inventaires/${id}/valider`, {}),
};

// ── Sorties de caisse ─────────────────────────────────────
export const sortiesCaisseApi = {
  list: (params?: { start?: string; end?: string; utilisateurId?: string }) => {
    const cleanParams: Record<string, string> = {};
    if (params?.start) cleanParams.start = params.start;
    if (params?.end) cleanParams.end = params.end;
    if (params?.utilisateurId && params.utilisateurId !== 'all') cleanParams.utilisateurId = params.utilisateurId;
    const searchStr = new URLSearchParams(cleanParams).toString();
    const q = searchStr ? `?${searchStr}` : '';
    return get<import('@/types').SortieCaisse[]>('/api/sorties-caisse' + q);
  },
  create: (data: { montant: number; motif: string; categorie: string; beneficiaire?: string }) =>
    post<import('@/types').SortieCaisse>('/api/sorties-caisse', data),
};

// ── Retours Clients ───────────────────────────────────────
export const retoursApi = {
  list: (params?: {
    start?: string;
    end?: string;
    mode?: string;
    utilisateurId?: string;
    q?: string;
  }) => {
    const qs = new URLSearchParams();
    if (params?.start)         qs.set('start',         params.start);
    if (params?.end)           qs.set('end',           params.end);
    if (params?.mode)          qs.set('mode',          params.mode);
    if (params?.utilisateurId) qs.set('utilisateurId', params.utilisateurId);
    if (params?.q)             qs.set('q',             params.q);
    const query = qs.toString();
    return get<import('@/types').RetourClient[]>(`/api/retours-clients${query ? `?${query}` : ''}`);
  },
};

// ── Clôtures de caisse (Rapport Z) ───────────────────────
export const cloturesCaisseApi = {
  list: (params?: { start?: string; end?: string; utilisateurId?: string }) => {
    const cleanParams: Record<string, string> = {};
    if (params?.start) cleanParams.start = params.start;
    if (params?.end) cleanParams.end = params.end;
    if (params?.utilisateurId && params.utilisateurId !== 'all') cleanParams.utilisateurId = params.utilisateurId;
    const searchStr = new URLSearchParams(cleanParams).toString();
    const q = searchStr ? `?${searchStr}` : '';
    return get<import('@/types').ClotureCaisse[]>('/api/clotures-caisse' + q);
  },
  getSummary: (vendeurId?: string) => {
    const q = vendeurId && vendeurId !== 'all' ? `?vendeurId=${vendeurId}` : '';
    return get<{
      totalVentes: number;
      nbVentes: number;
      repartition: { especes: number; mobile_money: number; carte: number; credit: number; autre: number };
      totalSorties: number;
      montantTheorique: number;
    }>('/api/clotures-caisse/summary' + q);
  },
  create: (data: {
    vendeurId?: string;
    montantReel: number;
    notes?: string;
  }) => post<import('@/types').ClotureCaisse>('/api/clotures-caisse', data),
};

// ── Commandes fournisseurs ────────────────────────────────
export const commandesFournisseursApi = {
  list:            () => get<import('@/types').CommandeFournisseur[]>('/api/commandes-fournisseurs'),
  get:             (id: string) => get<import('@/types').CommandeFournisseur>(`/api/commandes-fournisseurs/${id}`),
  create:          (data: Partial<import('@/types').CommandeFournisseur>) =>
    post<import('@/types').CommandeFournisseur>('/api/commandes-fournisseurs', data),
  updateStatut:    (id: string, statut: string) =>
    patch<import('@/types').CommandeFournisseur>(`/api/commandes-fournisseurs/${id}`, { statut }),
  addPaiement:     (id: string, montant: number) =>
    post<import('@/types').CommandeFournisseur>(`/api/commandes-fournisseurs/${id}`, { montant }),
};

// ── POS ──────────────────────────────────────────────────
export const posApi = {
  /** Encaisse une vente POS : valide les stocks, les déduit, crée le ticket */
  enregistrerVente: (data: {
    clientId?: string;
    clientNom?: string;
    lignes: {
      produitId: string;
      produitRef: string;
      produitNom: string;
      designation: string;
      quantite: number;
      prixUnitaire: number;
      remise: number;
      tva: number;
      total: number;
    }[];
    totalHT: number;
    remiseGlobale: number;
    tva: number;
    totalTTC: number;
    modePaiement: string;
    montantRecu: number;
  }) => post<import('@/types').Facture>('/api/pos/vente', data),
};

// ── Utilisateurs ──────────────────────────────────────────
export const utilisateursApi = {
  list:     () => get<import('@/types').AppUser[]>('/api/utilisateurs'),
  create:   (data: { email: string; password: string; nom: string; prenom: string; role: string; telephone?: string }) =>
    post<import('@/types').AppUser>('/api/utilisateurs', data),
  update:   (id: string, data: Partial<import('@/types').AppUser>) =>
    patch<import('@/types').AppUser>(`/api/utilisateurs/${id}`, data),
  remove:   (id: string) => del<{ message: string }>(`/api/utilisateurs/${id}`),
};

// ── Dashboard ─────────────────────────────────────────────
export interface DashboardStats {
  caMonth: number;
  commandesActives: number;
  alertesStock: number;
  facturesEnRetard: number;
  caParMois: {
    label: string;
    valeur: number;
    commandes: number;
  }[];
}

export const dashboardApi = {
  stats: () => get<DashboardStats>('/api/dashboard/stats'),
};

// ── Notifications ─────────────────────────────────────────
export interface ApiNotification {
  id: string;
  type: string;
  titre: string;
  message: string;
  lu: boolean;
  lien: string;
  createdAt: string;
}

export const notificationsApi = {
  list: () => get<ApiNotification[]>('/api/notifications'),
};

// ── Abonnement ────────────────────────────────────────────

export interface AbonnementData {
  plan: 'starter' | 'pro' | 'enterprise';
  statut: 'actif' | 'essai' | 'suspendu';
  dateEssaiFin: string | null;
  usage: {
    users: number;
    produits: number;
    magasins: number;
  };
  limites: {
    users: number | null;    // null = illimité
    produits: number | null;
    magasins: number | null;
  };
}

export const abonnementApi = {
  get: () => get<AbonnementData>('/api/abonnement'),
};
export interface Parametres {
  id: string;
  nom: string;
  adresse: string | null;
  telephone: string | null;
  email: string | null;
  siteWeb: string | null;
  siret: string | null;
  devise: string;
  tva: string;
  piedDePage: string | null;
  logoUrl: string | null;
  updatedAt: string;
}

export const parametresApi = {
  get:    () => get<Parametres>('/api/parametres'),
  update: (data: Partial<Omit<Parametres, 'id' | 'updatedAt'>>) =>
    patch<Parametres>('/api/parametres', data),
  resetDb: () => post<{ success: boolean, message: string }>('/api/maintenance/reset', {}),
};

// ── Unités de mesure ──────────────────────────────────────
export interface Unite {
  id: string;
  nom: string;
  abreviation: string;
  createdAt: string;
  updatedAt: string;
}

export const unitesApi = {
  list:   () => get<Unite[]>('/api/unites'),
  create: (data: { nom: string; abreviation: string }) =>
    post<Unite>('/api/unites', data),
  update: (id: string, data: { nom?: string; abreviation?: string }) =>
    patch<Unite>(`/api/unites/${id}`, data),
  remove: (id: string) => del<{ message: string }>(`/api/unites/${id}`),
};

// ── Leads ─────────────────────────────────────────────────
export const leadsApi = {
  list: (params: {
    page?: number;
    limit?: number;
    statut?: string;
    produit?: string;
    score_min?: number;
  } = {}) => {
    const qs = new URLSearchParams();
    if (params.page      !== undefined) qs.set('page',      String(params.page));
    if (params.limit     !== undefined) qs.set('limit',     String(params.limit));
    if (params.statut)                  qs.set('statut',    params.statut);
    if (params.produit)                 qs.set('produit',   params.produit);
    if (params.score_min !== undefined) qs.set('score_min', String(params.score_min));
    const query = qs.toString();
    return get<{ leads: import('@/types').Lead[]; total: number; page: number; limit: number }>(
      `/api/leads${query ? `?${query}` : ''}`
    );
  },
  getById: (id: string) =>
    get<import('@/types').Lead & { groupeNom: string }>(`/api/leads/${id}`),
  create: (data: Partial<import('@/types').Lead>) =>
    post<import('@/types').Lead>('/api/leads', data),
  updateStatut: (id: string, statut: string) =>
    patch<import('@/types').Lead>(`/api/leads/${id}`, { statut }),
  convertir: (id: string) =>
    post<import('@/types').Client>(`/api/leads/${id}/convertir`, {}),
};

// ── Groupes surveillés ────────────────────────────────────
type GroupePayload = Partial<import('@/types').GroupeSurveille> & { cookieSession?: string };

function toGroupeBody(data: GroupePayload) {
  const { cookieSession, ...rest } = data;
  return {
    ...rest,
    ...(cookieSession ? { cookieSessionPlaintext: cookieSession } : {}),
  };
}

export const groupesApi = {
  list: () =>
    get<import('@/types').GroupeSurveille[]>('/api/groupes-surveilles'),
  create: (data: GroupePayload) =>
    post<import('@/types').GroupeSurveille>('/api/groupes-surveilles', toGroupeBody(data)),
  update: (id: string, data: GroupePayload) =>
    patch<import('@/types').GroupeSurveille>(`/api/groupes-surveilles/${id}`, toGroupeBody(data)),
  remove: (id: string) =>
    del<{ message: string }>(`/api/groupes-surveilles/${id}`),
};

// ── Onboarding ────────────────────────────────────────────

export interface OnboardingStatus {
  premiereConnexion: boolean;
  onboardingStep: number;
}

export const onboardingApi = {
  getStatus: () => get<OnboardingStatus>('/api/onboarding'),
  updateStep: (onboardingStep: number) =>
    patch<OnboardingStatus>('/api/onboarding', { onboardingStep }),
  ignore: () =>
    patch<OnboardingStatus>('/api/onboarding', { ignore: true }),
};

// ── Superadmin ────────────────────────────────────────────

export interface SuperadminStats {
  total: number;
  parStatut: {
    actif: number;
    essai: number;
    suspendu: number;
  };
  mrr: number;
  tauxConversion90j: number;
  courbe12mois: Array<{ mois: string; nouvelles: number }>;
}

export interface TenantListItem {
  id: string;
  nom: string;
  slug: string;
  plan: 'starter' | 'pro' | 'enterprise';
  statut: 'actif' | 'essai' | 'suspendu';
  createdAt: string;
  nbUtilisateurs: number;
  caTotal: number;
  devise: string;
}

export interface TenantUser {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  role: string;
  actif: boolean;
}

export interface TenantDetail {
  id: string;
  nom: string;
  slug: string;
  plan: 'starter' | 'pro' | 'enterprise';
  statut: 'actif' | 'essai' | 'suspendu';
  devise: string;
  pays: string | null;
  email: string;
  telephone: string | null;
  adresse: string | null;
  domaine: string | null;
  enMaintenance: boolean;
  messageMaintenance: string | null;
  dateEssaiFin: string | null;
  logoUrl: string | null;
  createdAt: string;
  updatedAt: string;
  utilisateurs: TenantUser[];
}

export interface TenantPatchPayload {
  plan?: 'starter' | 'pro' | 'enterprise';
  statut?: 'actif' | 'essai' | 'suspendu';
  enMaintenance?: boolean;
  messageMaintenance?: string | null;
}

export interface TenantCreatePayload {
  nom: string;
  emailAdmin: string;
  plan: 'starter' | 'pro' | 'enterprise';
  devise: string;
  pays?: string;
}

export interface TenantCreateResult {
  tenant: TenantDetail;
  adminEmail: string;
  adminPassword: string;
}

export const superadminApi = {
  stats: () => get<SuperadminStats>('/api/superadmin/stats'),
  tenants: {
    list: (params?: { statut?: string; plan?: string; q?: string }) => {
      const qs = new URLSearchParams();
      if (params?.statut) qs.set('statut', params.statut);
      if (params?.plan)   qs.set('plan',   params.plan);
      if (params?.q)      qs.set('q',      params.q);
      const query = qs.toString();
      return get<TenantListItem[]>(`/api/superadmin/tenants${query ? `?${query}` : ''}`);
    },
    get:    (id: string) => get<TenantDetail>(`/api/superadmin/tenants/${id}`),
    create: (data: TenantCreatePayload) =>
      post<TenantCreateResult>('/api/superadmin/tenants', data),
    update: (id: string, data: TenantPatchPayload) =>
      patch<TenantDetail>(`/api/superadmin/tenants/${id}`, data),
    impersonate: (id: string) =>
      post<{ token: string; boutique: string }>(`/api/superadmin/tenants/${id}/impersonate`, {}),
  },
};

// ── Audit Logs ────────────────────────────────────────────

export interface AuditLogEntry {
  id: string;
  tenantId: string;
  userId: string | null;
  userEmail?: string;
  userName?: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  details: unknown;
  ipAddress: string | null;
  createdAt: string;
}

export interface AuditLogsResponse {
  items: AuditLogEntry[];
  total: number;
  page: number;
  totalPages: number;
}

export const auditApi = {
  list: (params?: {
    page?: number;
    action?: string;
    userId?: string;
    dateDebut?: string;
    dateFin?: string;
  }) => {
    const qs = new URLSearchParams();
    if (params?.page      !== undefined) qs.set('page',      String(params.page));
    if (params?.action)                  qs.set('action',    params.action);
    if (params?.userId)                  qs.set('userId',    params.userId);
    if (params?.dateDebut)               qs.set('dateDebut', params.dateDebut);
    if (params?.dateFin)                 qs.set('dateFin',   params.dateFin);
    const query = qs.toString();
    return get<AuditLogsResponse>(`/api/audit-logs${query ? `?${query}` : ''}`);
  },
};

// ── Templates / Catalogue Marketplace ────────────────────

export interface TemplateItem {
  id: string;
  tenantId: string;
  nom: string;
  description: string | null;
  secteurActivite: string | null;
  payload: {
    categories?: unknown[];
    produits?: unknown[];
  };
  createdAt: string;
}

export interface ImportResult {
  categoriesImportees: number;
  produitsImportes: number;
}

export const templatesApi = {
  list: (secteur?: string) => {
    const url = secteur ? `/api/templates?secteur=${encodeURIComponent(secteur)}` : '/api/templates';
    return get<TemplateItem[]>(url);
  },
  export: (data: { nom: string; description?: string; secteurActivite?: string }) =>
    post<TemplateItem>('/api/templates', data),
  import: (id: string) =>
    post<ImportResult>(`/api/templates/${id}/import`, {}),
};
