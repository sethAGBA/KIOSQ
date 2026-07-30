/**
 * kiosqWhatsappApi.ts
 *
 * Wraps kiosqRequest() from bot/kiosqApi.ts to expose the API calls
 * needed by the WhatsApp commandes bot. Also exports two pure helper
 * functions (filterCatalogue, chunkCatalogue) that do not make network calls.
 *
 * Requirements: 2.1, 2.3, 3.1, 3.3, 5.1, 6.1, 6.3
 */

import { kiosqRequest } from '../kiosqApi';
import type {
  ProduitDisponible,
  ClientKiosq,
  CommandeCreee,
  CommandePayload,
  ParametresTenant,
} from './types';

type FetchFn = typeof fetch;

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function parseJson<T>(res: Response): Promise<T> {
  const json = (await res.json()) as { ok: boolean; data?: T; error?: string };
  if (!res.ok || !json.ok) {
    throw new Error(json.error ?? `HTTP ${res.status}`);
  }
  return json.data as T;
}

// ─── API wrappers ─────────────────────────────────────────────────────────────

/**
 * Fetch all products for the bot's tenant.
 * The caller is responsible for filtering (use filterCatalogue()).
 *
 * Requirement 3.1 — récupérer les produits via GET /api/produits
 */
export async function getProduits(fetchFn: FetchFn = fetch): Promise<ProduitDisponible[]> {
  const res = await kiosqRequest('/api/produits', {}, fetchFn);
  return parseJson<ProduitDisponible[]>(res);
}

/**
 * Look up a client by their WhatsApp phone number.
 * Returns the first match or null if not found.
 *
 * Requirement 2.1 — rechercher un client par numéro de téléphone
 */
export async function getClient(
  telephone: string,
  fetchFn: FetchFn = fetch,
): Promise<ClientKiosq | null> {
  const encoded = encodeURIComponent(telephone);
  const res = await kiosqRequest(`/api/clients?telephone=${encoded}`, {}, fetchFn);
  const clients = await parseJson<ClientKiosq[]>(res);
  return clients.length > 0 ? clients[0] : null;
}

/**
 * Create a new client profile in Kiosq.
 *
 * Requirement 2.3 — créer un nouveau profil client via POST /api/clients
 */
export async function createClient(
  nom: string,
  telephone: string,
  fetchFn: FetchFn = fetch,
): Promise<ClientKiosq> {
  const res = await kiosqRequest(
    '/api/clients',
    {
      method: 'POST',
      body: JSON.stringify({ nom, telephone }),
    },
    fetchFn,
  );
  return parseJson<ClientKiosq>(res);
}

/**
 * Create a commande from a validated cart.
 *
 * Requirement 5.1 — créer la commande via POST /api/commandes
 */
export async function createCommande(
  payload: CommandePayload,
  fetchFn: FetchFn = fetch,
): Promise<CommandeCreee> {
  const res = await kiosqRequest(
    '/api/commandes',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    fetchFn,
  );
  return parseJson<CommandeCreee>(res);
}

/**
 * Fetch a single commande by ID.
 *
 * Requirement 6.1 — récupérer la commande via GET /api/commandes/{id}
 */
export async function getCommande(
  id: string,
  fetchFn: FetchFn = fetch,
): Promise<CommandeCreee> {
  const res = await kiosqRequest(`/api/commandes/${encodeURIComponent(id)}`, {}, fetchFn);
  return parseJson<CommandeCreee>(res);
}

/**
 * Fetch the most recent `limit` commandes for a given client.
 *
 * Requirement 6.3 — afficher les dernières commandes du client
 */
export async function getCommandesClient(
  clientId: string,
  limit = 5,
  fetchFn: FetchFn = fetch,
): Promise<CommandeCreee[]> {
  const encoded = encodeURIComponent(clientId);
  const res = await kiosqRequest(
    `/api/commandes?clientId=${encoded}&limit=${limit}`,
    {},
    fetchFn,
  );
  return parseJson<CommandeCreee[]>(res);
}

/**
 * Fetch tenant-level parameters (TVA rate, currency).
 *
 * Requirement 5.1 — lire le taux TVA depuis les paramètres du tenant
 */
export async function getParametres(fetchFn: FetchFn = fetch): Promise<ParametresTenant> {
  const res = await kiosqRequest('/api/parametres', {}, fetchFn);
  return parseJson<ParametresTenant>(res);
}

// ─── Pure helpers ─────────────────────────────────────────────────────────────

/**
 * Filter a product list to only those currently available:
 *   - actif === true
 *   - stockActuel > 0
 *   - optionally matching categorieId
 *
 * Requirements 3.1, 3.3
 *
 * @param produits  Full list returned by getProduits()
 * @param categorieId  Optional category filter
 */
export function filterCatalogue(
  produits: ProduitDisponible[],
  categorieId?: string,
): ProduitDisponible[] {
  return produits.filter(
    (p) =>
      p.actif === true &&
      p.stockActuel > 0 &&
      (categorieId === undefined || p.categorieId === categorieId),
  );
}

/**
 * Split a product array into consecutive chunks of at most `size` items.
 * The concatenation of all chunks equals the original array.
 *
 * Requirement 3.2 — présenter les produits en groupes de 10 au maximum
 *
 * @param produits  Products to paginate
 * @param size      Maximum items per chunk (default 10)
 */
export function chunkCatalogue<T>(produits: T[], size = 10): T[][] {
  if (size < 1) throw new RangeError('chunk size must be >= 1');
  const chunks: T[][] = [];
  for (let i = 0; i < produits.length; i += size) {
    chunks.push(produits.slice(i, i + size));
  }
  return chunks;
}
