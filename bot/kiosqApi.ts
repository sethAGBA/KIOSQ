type FetchFn = typeof fetch;

function getConfig() {
  return {
    baseUrl: process.env.KIOSQ_API_URL ?? '',
    botJwt: process.env.BOT_JWT ?? '',
  };
}

export interface GroupeActif {
  id: string;
  nomGroupe: string;
  urlGroupe: string;
  statut: 'actif' | 'inactif' | 'erreur';
  cookieSession?: string;
}

export interface LeadPayload {
  groupeSurveilleId: string;
  texteOriginal: string;
  produitDetecte?: string | null;
  scoreConfiance?: number;
  lienPost?: string;
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

export class ServerError extends Error {
  constructor(status: number) {
    super(`HTTP ${status}`);
    this.name = 'ServerError';
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function kiosqRequest(
  path: string,
  options: RequestInit = {},
  fetchFn: FetchFn = fetch,
): Promise<Response> {
  const { baseUrl, botJwt } = getConfig();
  if (!baseUrl) throw new Error('KIOSQ_API_URL manquant');
  if (!botJwt) throw new Error('BOT_JWT manquant');

  const res = await fetchFn(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${botJwt}`,
      ...options.headers,
    },
  });

  if (res.status === 401 || res.status === 403) {
    console.error(`[kiosqApi] Erreur auth ${res.status} sur ${path} — arrêt immédiat`);
    throw new AuthError(`HTTP ${res.status}`);
  }

  return res;
}

async function parseJson<T>(res: Response): Promise<T> {
  const json = await res.json() as { ok: boolean; data?: T; error?: string };
  if (!res.ok || !json.ok) {
    throw new Error(json.error ?? `HTTP ${res.status}`);
  }
  return json.data as T;
}

export async function getGroupesActifs(fetchFn: FetchFn = fetch): Promise<GroupeActif[]> {
  const res = await kiosqRequest('/api/groupes-surveilles', {}, fetchFn);
  const groupes = await parseJson<GroupeActif[]>(res);
  return groupes.filter(g => g.statut === 'actif');
}

export async function creerLead(
  data: LeadPayload,
  fetchFn: FetchFn = fetch,
  delayMs = 5000,
): Promise<void> {
  const post = async () => {
    const res = await kiosqRequest('/api/leads', {
      method: 'POST',
      body: JSON.stringify(data),
    }, fetchFn);

    if (res.status >= 500) throw new ServerError(res.status);
    if (!res.ok) {
      const json = await res.json().catch(() => ({})) as { error?: string };
      throw new Error(json.error ?? `HTTP ${res.status}`);
    }
  };

  try {
    await post();
  } catch (err) {
    if (err instanceof AuthError) throw err;
    if (err instanceof ServerError) {
      console.warn(`[kiosqApi] Erreur 5xx — retry dans ${delayMs / 1000}s…`);
      await sleep(delayMs);
      try {
        await post();
        return;
      } catch (retryErr) {
        console.error('[kiosqApi] Échec après retry:', retryErr);
        return;
      }
    }
    console.error('[kiosqApi] Erreur création lead:', err);
  }
}

export async function updateGroupeStatut(
  id: string,
  statut: 'actif' | 'inactif' | 'erreur',
  fetchFn: FetchFn = fetch,
): Promise<void> {
  const res = await kiosqRequest(`/api/groupes-surveilles/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ statut }),
  }, fetchFn);
  if (!res.ok) {
    const json = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(json.error ?? `HTTP ${res.status}`);
  }
}

export const kiosqApi = {
  getGroupesActifs,
  creerLead,
  updateGroupeStatut,
};
