/**
 * Central API client — wraps fetch calls to Vercel API routes.
 * Falls back gracefully: if VITE_API_URL is not set, mock data is used via the stores.
 */

const BASE = import.meta.env.VITE_API_URL ?? '';

type ApiResponse<T> = { ok: true; data: T } | { ok: false; error: string };

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    credentials: 'include', // send httpOnly cookie
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const json = (await res.json()) as ApiResponse<T>;

  if (!res.ok || !json.ok) {
    const msg = (!json.ok && 'error' in json) ? json.error : `HTTP ${res.status}`;
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

// ── Auth ──────────────────────────────────────────────────
export const authApi = {
  login:  (email: string, password: string) =>
    post<{ id: string; email: string; role: string; nom: string; prenom: string; actif: boolean }>(
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
