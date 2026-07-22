# Document de Design — Module Capture de Leads

## Vue d'ensemble

Le module capture de leads intègre dans kiosq la capacité de détecter automatiquement des intentions d'achat dans des groupes Facebook publics. Un bot externe scrape les posts via Apify, les classe avec Google Gemini AI, puis pousse les résultats à l'API kiosq. Les commerciaux consultent, filtrent et convertissent ces leads en clients d'un seul clic depuis un dashboard dédié.

Le module est composé de quatre couches :

1. **Base de données** — deux tables Drizzle/Neon (`groupes_surveilles`, `leads`) avec chiffrement AES-256-GCM pour les cookies de session Facebook.
2. **API REST** — cinq fichiers de routes Vercel Serverless qui suivent le pattern existant (`requireAuth`, `ok`, `err`, `parseBody`).
3. **Interface React** — pages, composants et store Zustand intégrés dans la navigation kiosq existante.
4. **Bot de capture** — processus Node.js autonome (`bot/`) qui orchestre Apify et Gemini et appelle l'API kiosq avec un JWT de service.

---

## Architecture

```mermaid
graph TB
    subgraph "Navigateur"
        UI[React App<br/>LeadsPage / LeadDetailPage]
        STORE[Zustand leadsStore]
        UI --> STORE
    end

    subgraph "Vercel Serverless Functions"
        L1[api/leads/index.ts<br/>GET + POST]
        L2[api/leads/[id].ts<br/>GET + PATCH]
        L3[api/leads/[id]/convertir.ts<br/>POST]
        G1[api/groupes-surveilles/index.ts<br/>GET + POST]
        G2[api/groupes-surveilles/[id].ts<br/>PATCH + DELETE]
    end

    subgraph "Neon Postgres"
        DB1[(groupes_surveilles)]
        DB2[(leads)]
        DB3[(clients)]
    end

    subgraph "Bot Node.js"
        BOT[bot/index.ts<br/>Boucle principale]
        APIFY[bot/apify.ts<br/>Scraping Facebook]
        GEMINI[bot/gemini.ts<br/>Classification IA]
        KAPI[bot/kiosqApi.ts<br/>Client HTTP JWT]
        BOT --> APIFY
        BOT --> GEMINI
        BOT --> KAPI
    end

    STORE --> L1 & L2 & L3 & G1 & G2
    L1 & L2 & L3 --> DB2
    L3 --> DB3
    G1 & G2 --> DB1
    KAPI --> L1
    BOT -->|GET groupes actifs| G1
```

---

## Composants et interfaces

### API Routes

Toutes les routes suivent le pattern kiosq :
- `export default async function handler(req: VercelRequest, res: VercelResponse)`
- `const body = await parseBody(req)` avant tout autre traitement
- `if (handleOptions(req, res)) return` pour le CORS preflight
- `const ctx = await requireAuth(req, res); if (!ctx) return` pour l'authentification
- Réponses via `ok(res, data)` / `err(res, message, status)`
- Identifiants générés avec `nanoid()`
- ORM Drizzle via `getDb()` depuis `db/client.ts`

#### `api/leads/index.ts`

| Méthode | Description |
|---------|-------------|
| `GET`   | Liste paginée et filtrée des leads |
| `POST`  | Création d'un nouveau lead (usage bot) |

**GET — Paramètres query :**
```typescript
const QuerySchema = z.object({
  page:      z.coerce.number().int().min(1).default(1),
  limit:     z.coerce.number().int().min(1).max(100).default(20),
  statut:    z.enum(['nouveau', 'envoye', 'ignore']).optional(),
  produit:   z.string().optional(),
  score_min: z.coerce.number().min(0).max(1).optional(),
});
```

**GET — Réponse :**
```json
{
  "ok": true,
  "data": {
    "leads": [...],
    "total": 42,
    "page": 1,
    "limit": 20
  }
}
```

**POST — Corps :**
```typescript
const LeadSchema = z.object({
  groupeSurveilleId: z.string().min(1),
  texteOriginal:     z.string().min(1),
  produitDetecte:    z.string().optional(),
  scoreConfiance:    z.number().min(0).max(1).optional(),
  lienPost:          z.string().url().optional(),
});
```

**POST — Réponse :** lead créé, HTTP 201.
**Rôles :** tous les `Utilisateur_Autorise` (admin, commercial, gestionnaire).

#### `api/leads/[id].ts`

| Méthode | Description |
|---------|-------------|
| `GET`   | Détail d'un lead + données du groupe source |
| `PATCH` | Mise à jour du statut |

**GET — Réponse :** lead avec `groupeNom` (jointure), HTTP 200. HTTP 404 si inexistant.

**PATCH — Corps :**
```typescript
const PatchLeadSchema = z.object({
  statut: z.enum(['nouveau', 'envoye', 'ignore']),
});
```

**PATCH — Réponse :** lead mis à jour, HTTP 200. HTTP 422 si statut invalide.
**Rôles :** `Utilisateur_Autorise`.

---

#### `api/leads/[id]/convertir.ts`

| Méthode | Description |
|---------|-------------|
| `POST`  | Conversion atomique : créer client + MAJ lead |

**Logique (transaction Drizzle) :**
1. Récupérer le lead — si inexistant → 404 ; si `clientId` non nul → 409.
2. Dans une transaction : créer un `client` avec `nom` dérivé de `produitDetecte` (ou "Lead #id"), `notes` = `texteOriginal`.
3. Mettre à jour le lead : `clientId = client.id`, `statut = 'envoye'`.
4. Retourner le client créé, HTTP 201.

**Rôles :** `Utilisateur_Autorise`.

---

#### `api/groupes-surveilles/index.ts`

| Méthode | Description |
|---------|-------------|
| `GET`   | Liste de tous les groupes (tous `Utilisateur_Autorise`) |
| `POST`  | Création d'un groupe (`admin` uniquement) |

**POST — Corps :**
```typescript
const GroupeSchema = z.object({
  nomGroupe:             z.string().min(1),
  urlGroupe:             z.string().url(),
  cookieSessionPlaintext: z.string().optional(), // chiffré avant persist
  statut:                z.enum(['actif', 'inactif', 'erreur']).default('actif'),
});
```

**GET — Comportement :** retourner les groupes **sans** `cookieSessionChiffre`. Si le JWT est de rôle `commercial` ou `admin`, inclure le cookie **déchiffré** dans un champ `cookieSession` (usage bot).

**POST — Erreur 409** si `urlGroupe` déjà présente. **Erreur 500** si `COOKIE_ENCRYPTION_KEY` absent.

---

#### `api/groupes-surveilles/[id].ts`

| Méthode   | Description |
|-----------|-------------|
| `PATCH`   | Mise à jour partielle (`admin` uniquement) |
| `DELETE`  | Suppression (`admin` uniquement) |

**PATCH — Corps :** sous-ensemble des champs de `GroupeSchema`.
**DELETE — Erreur 409** si des leads référencent ce groupe.
**Rôles :** `admin` pour toute mutation ; HTTP 403 sinon.

### Composants React

#### Arborescence

```
src/pages/leads/
  LeadsPage.tsx           — page principale avec onglets Leads / Groupes
  LeadDetailPage.tsx      — fiche lead (drawer ou page dédiée)

src/components/leads/
  LeadsTable.tsx          — tableau paginé
  LeadsFilters.tsx        — filtres statut + produit (debounce 300ms) + score_min
  LeadStatusBadge.tsx     — badge coloré selon statut
  LeadConvertButton.tsx   — bouton converti / désactivé si déjà converti
  GroupesSurveillésTable.tsx — tableau groupes (admin only)
  GroupeFormModal.tsx     — formulaire création/édition groupe
```

#### Props des composants

**`LeadsPage.tsx`**
```typescript
// Pas de props externes — charge via leadsStore
// État local : activeTab: 'leads' | 'groupes'
```

**`LeadDetailPage.tsx`**
```typescript
interface LeadDetailPageProps {
  leadId: string;
  onClose: () => void;
}
// État local : lead chargé depuis leadsStore, mode d'édition statut
```

**`LeadsTable.tsx`**
```typescript
interface LeadsTableProps {
  leads: Lead[];
  loading: boolean;
  onLeadClick: (lead: Lead) => void;
}
// Colonnes : produitDetecte, scoreConfiance, groupeNom, statut (badge), createdAt
```

**`LeadsFilters.tsx`**
```typescript
interface LeadsFiltersProps {
  filters: LeadsFilters;
  onChange: (filters: Partial<LeadsFilters>) => void;
}
// État local : inputProduit (debounce 300ms avant onChange)
```

**`LeadStatusBadge.tsx`**
```typescript
interface LeadStatusBadgeProps {
  statut: StatutLead;
}
// nouveau → orange, envoye → vert, ignore → gris
```

**`LeadConvertButton.tsx`**
```typescript
interface LeadConvertButtonProps {
  leadId: string;
  clientId: string | null;
  onConverted: (client: Client) => void;
}
// Désactivé + tooltip "Lead déjà converti" si clientId non nul
```

**`GroupesSurveillésTable.tsx`**
```typescript
interface GroupesSurveillésTableProps {
  groupes: GroupeSurveille[];
  loading: boolean;
  onEdit: (groupe: GroupeSurveille) => void;
  onDelete: (id: string) => void;
}
```

**`GroupeFormModal.tsx`**
```typescript
interface GroupeFormModalProps {
  groupe?: GroupeSurveille; // undefined = création
  onSave: () => void;
  onClose: () => void;
}
// État local : form state (nomGroupe, urlGroupe, cookieSession, statut)
```

### Store Zustand — `src/store/leadsStore.ts`

```typescript
import { create } from 'zustand';
import type { Lead, GroupeSurveille, Client } from '@/types';
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
  leadsNouveauCount: number; // badge sidebar

  // Groupes surveillés
  groupes: GroupeSurveille[];
  groupesLoading: boolean;

  // Actions
  fetchLeads: (filters?: Partial<LeadsFilters>) => Promise<void>;
  setPage: (page: number) => void;
  updateLeadStatut: (id: string, statut: StatutLead) => Promise<void>;
  convertirLead: (id: string) => Promise<Client>;
  fetchLeadsNouveauCount: () => Promise<void>;

  // Actions groupes
  fetchGroupes: () => Promise<void>;
  createGroupe: (data: Partial<GroupeSurveille>) => Promise<void>;
  updateGroupe: (id: string, data: Partial<GroupeSurveille>) => Promise<void>;
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
      leadsNouveauCount: statut !== 'nouveau' && s.leads.find(l => l.id === id)?.statut === 'nouveau'
        ? Math.max(0, s.leadsNouveauCount - 1)
        : s.leadsNouveauCount,
    }));
  },

  convertirLead: async (id) => {
    const client = await leadsApi.convertir(id);
    set(s => ({
      leads: s.leads.map(l => l.id === id ? { ...l, clientId: client.id, statut: 'envoye' } : l),
      leadsNouveauCount: s.leads.find(l => l.id === id)?.statut === 'nouveau'
        ? Math.max(0, s.leadsNouveauCount - 1)
        : s.leadsNouveauCount,
    }));
    return client;
  },

  fetchLeadsNouveauCount: async () => {
    const data = await leadsApi.list({ statut: 'nouveau', page: 1, limit: 1 });
    set({ leadsNouveauCount: data.total });
  },

  fetchGroupes: async () => {
    set({ groupesLoading: true });
    try {
      const data = await groupesApi.list();
      set({ groupes: data });
    } finally {
      set({ groupesLoading: false });
    }
  },

  createGroupe:  async (data) => { await groupesApi.create(data); get().fetchGroupes(); },
  updateGroupe:  async (id, data) => { await groupesApi.update(id, data); get().fetchGroupes(); },
  deleteGroupe:  async (id) => { await groupesApi.remove(id); get().fetchGroupes(); },
}));
```

### Client API — additions à `src/lib/api.ts`

```typescript
// ── Leads ─────────────────────────────────────────────────
export const leadsApi = {
  list: (params: {
    page?: number;
    limit?: number;
    statut?: string;
    produit?: string;
    score_min?: number;
  }) => {
    const qs = new URLSearchParams();
    if (params.page)      qs.set('page',      String(params.page));
    if (params.limit)     qs.set('limit',     String(params.limit));
    if (params.statut)    qs.set('statut',    params.statut);
    if (params.produit)   qs.set('produit',   params.produit);
    if (params.score_min !== undefined) qs.set('score_min', String(params.score_min));
    return get<{ leads: Lead[]; total: number; page: number; limit: number }>(
      `/api/leads?${qs}`
    );
  },
  getById:      (id: string) => get<Lead & { groupeNom: string }>(`/api/leads/${id}`),
  create:       (data: Partial<Lead>) => post<Lead>('/api/leads', data),
  updateStatut: (id: string, statut: string) =>
    patch<Lead>(`/api/leads/${id}`, { statut }),
  convertir:    (id: string) => post<import('@/types').Client>(`/api/leads/${id}/convertir`, {}),
};

// ── Groupes surveillés ────────────────────────────────────
export const groupesApi = {
  list:   () => get<GroupeSurveille[]>('/api/groupes-surveilles'),
  create: (data: Partial<GroupeSurveille> & { cookieSession?: string }) =>
    post<GroupeSurveille>('/api/groupes-surveilles', data),
  update: (id: string, data: Partial<GroupeSurveille> & { cookieSession?: string }) =>
    patch<GroupeSurveille>(`/api/groupes-surveilles/${id}`, data),
  remove: (id: string) => del<{ message: string }>(`/api/groupes-surveilles/${id}`),
};
```

---

## Modèles de données

### Schéma Drizzle — `db/schema.ts` (ajouts)

```typescript
// ── Nouveaux enums ────────────────────────────────────────
export const statutGroupeEnum = pgEnum('statut_groupe', ['actif', 'inactif', 'erreur']);
export const statutLeadEnum   = pgEnum('statut_lead',   ['nouveau', 'envoye', 'ignore']);

// ── Table groupes_surveilles ──────────────────────────────
export const groupesSurveilles = pgTable('groupes_surveilles', {
  id:                    text('id').primaryKey(),
  nomGroupe:             text('nom_groupe').notNull(),
  urlGroupe:             text('url_groupe').notNull().unique(),
  cookieSessionChiffre:  text('cookie_session_chiffre'),
  statut:                statutGroupeEnum('statut').notNull().default('actif'),
  createdAt:             timestamp('created_at').notNull().defaultNow(),
  updatedAt:             timestamp('updated_at').notNull().defaultNow(),
});

// ── Table leads ───────────────────────────────────────────
export const leads = pgTable('leads', {
  id:                 text('id').primaryKey(),
  groupeSurveilleId:  text('groupe_surveille_id')
                        .notNull()
                        .references(() => groupesSurveilles.id),
  clientId:           text('client_id')
                        .references(() => clients.id),
  texteOriginal:      text('texte_original').notNull(),
  produitDetecte:     text('produit_detecte'),
  scoreConfiance:     numeric('score_confiance', { precision: 4, scale: 3 }),
  lienPost:           text('lien_post'),
  statut:             statutLeadEnum('statut').notNull().default('nouveau'),
  createdAt:          timestamp('created_at').notNull().defaultNow(),
  updatedAt:          timestamp('updated_at').notNull().defaultNow(),
});

// ── Type helpers ──────────────────────────────────────────
export type GroupeSurveilleRow = typeof groupesSurveilles.$inferSelect;
export type LeadRow            = typeof leads.$inferSelect;
```

### Types TypeScript — additions à `src/types/index.ts`

```typescript
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
```

---

### Utilitaire de chiffrement — `db/crypto.ts`

```typescript
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGO = 'aes-256-gcm';

/**
 * Chiffre une chaîne avec AES-256-GCM.
 * Format stocké : "<iv_hex>:<authTag_hex>:<ciphertext_hex>"
 */
export function encrypt(plaintext: string, key: string): string {
  const keyBuf = Buffer.from(key, 'hex');       // 32 bytes
  const iv     = randomBytes(12);               // 96 bits recommandé pour GCM
  const cipher = createCipheriv(ALGO, keyBuf, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    iv.toString('hex'),
    authTag.toString('hex'),
    encrypted.toString('hex'),
  ].join(':');
}

/**
 * Déchiffre une chaîne produite par `encrypt`.
 * @throws si le format est invalide ou si l'authentification échoue.
 */
export function decrypt(ciphertext: string, key: string): string {
  const parts = ciphertext.split(':');
  if (parts.length !== 3) throw new Error('Format de ciphertext invalide');

  const [ivHex, authTagHex, dataHex] = parts;
  const keyBuf  = Buffer.from(key, 'hex');
  const iv      = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const data    = Buffer.from(dataHex, 'hex');

  const decipher = createDecipheriv(ALGO, keyBuf, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}
```

Le bot copie ce fichier ou l'importe depuis un chemin partagé (`bot/crypto.ts` re-exporte `db/crypto.ts`).

---

### Structure du bot — `bot/`

```
bot/
  index.ts          — point d'entrée : charge les groupes actifs, orchestre le scraping
  apify.ts          — client Apify, scraping des posts d'un groupe Facebook
  gemini.ts         — classification intention d'achat via Gemini API
  kiosqApi.ts       — client HTTP vers l'API kiosq (JWT Bearer depuis BOT_JWT)
  crypto.ts         — ré-export de db/crypto.ts pour déchiffrer le cookie de session
  .env.example      — documentation des variables d'environnement requises
```

**`bot/index.ts` — boucle principale :**
```typescript
async function main() {
  const groupes = await kiosqApi.getGroupesActifs();
  for (const groupe of groupes) {
    try {
      const cookie  = groupe.cookieSession;            // déchiffré par l'API
      const posts   = await scrapeGroupe(groupe.urlGroupe, cookie);
      for (const post of posts) {
        const { produit, score } = await classifierPost(post.texte);
        if (score >= Number(process.env.SCORE_SEUIL ?? 0.7)) {
          await kiosqApi.creerLead({
            groupeSurveilleId: groupe.id,
            texteOriginal:     post.texte,
            produitDetecte:    produit,
            scoreConfiance:    score,
            lienPost:          post.lien,
          });
        }
      }
    } catch (err) {
      console.error(`[groupe ${groupe.id}]`, err);
      await kiosqApi.updateGroupeStatut(groupe.id, 'erreur');
    }
  }
}
```

### Modification de la navigation — `src/components/layout/AppLayout.tsx`

Ajouter l'entrée Leads dans le tableau `NAV` existant, après l'entrée POS :

```typescript
// Imports à ajouter :
import { Crosshair } from 'lucide-react';

// Ajout dans le tableau NAV (entre POS et Clients) :
{ to: '/leads', label: 'Capture de Leads', icon: Crosshair, roles: ['admin', 'commercial', 'gestionnaire'], badge: 'leadsNouveau' },
```

Le badge est rendu conditionnellement dans le composant de rendu de navigation :

```tsx
// Dans le rendu NavLink, après le label :
{sidebarOpen && item.badge === 'leadsNouveau' && leadsNouveauCount > 0 && (
  <span
    className="ml-auto min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold
               flex items-center justify-center text-white"
    style={{ backgroundColor: '#f97316' }}  // orange-500
  >
    {leadsNouveauCount > 99 ? '99+' : leadsNouveauCount}
  </span>
)}
```

`leadsNouveauCount` est chargé via `useLeadsStore(s => s.leadsNouveauCount)` dans `AppLayout`.
Le rafraîchissement toutes les 60 secondes est géré par un `useEffect` dans `AppLayout` :

```typescript
useEffect(() => {
  fetchLeadsNouveauCount();
  const interval = setInterval(fetchLeadsNouveauCount, 60_000);
  return () => clearInterval(interval);
}, []);
```

### Modification de la navigation — `src/App.tsx`

Ajouter les routes leads dans le bloc `AuthGuard` :

```tsx
import LeadsPage      from '@/pages/leads/LeadsPage';
import LeadDetailPage from '@/pages/leads/LeadDetailPage';

// Dans le bloc <Route element={<AuthGuard />}> :
<Route path="/leads"     element={<LeadsPage />} />
<Route path="/leads/:id" element={<LeadDetailPage />} />
```

---

## Variables d'environnement

Nouvelles variables à ajouter dans `.env.local` et `.env.example` :

| Variable | Description | Valeur par défaut |
|----------|-------------|-------------------|
| `COOKIE_ENCRYPTION_KEY` | Clé AES-256 pour chiffrer les cookies Facebook (32 bytes hex = 64 chars) | — (obligatoire) |
| `BOT_JWT` | JWT signé avec `JWT_SECRET`, rôle `commercial`, utilisé par le bot | — (obligatoire pour le bot) |
| `KIOSQ_API_URL` | URL de base de l'API kiosq (ex: `https://kiosq.vercel.app`) | — (obligatoire pour le bot) |
| `APIFY_TOKEN` | Token d'API Apify pour le scraping Facebook | — (obligatoire pour le bot) |
| `GEMINI_API_KEY` | Clé API Google Gemini | — (obligatoire pour le bot) |
| `SCORE_SEUIL` | Seuil de score en dessous duquel un post est ignoré | `0.7` |

**Génération de `COOKIE_ENCRYPTION_KEY` :**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Génération de `BOT_JWT` :** signer un payload `{ sub: "<user_id>", role: "commercial", email: "bot@kiosq.app" }` avec `JWT_SECRET` et une expiration longue (ex: 1 an).

---

## Propriétés de correction

*Une propriété est une caractéristique ou un comportement qui doit rester vrai pour toutes les exécutions valides d'un système — formellement, un énoncé sur ce que le système doit faire. Les propriétés servent de pont entre les spécifications lisibles par l'humain et les garanties de correction vérifiables par la machine.*

### Réflexion sur la redondance

Avant d'écrire les propriétés finales, voici l'analyse de redondance :

- **3.1 et 3.2** (pagination) peuvent être fusionnées en une seule propriété qui couvre à la fois la taille des résultats et la cohérence du total.
- **3.3, 3.4, 3.5** (filtres) peuvent être fusionnées : les trois filtres sont orthogonaux et testent le même invariant « tous les résultats satisfont le filtre ». Une propriété combinée couvre les filtres composables.
- **5.2 et 5.4** (conversion idempotente) : la propriété 5.4 (re-convertir retourne 409) est plus forte et subsume la vérification que `clientId` est non-nul après conversion — on garde les deux car elles testent des angles différents (état après succès vs comportement à l'idempotence).
- **6.3 et 6.6** (conflits URL et leads) : contraintes d'intégrité distinctes, non redondantes.

Propriétés retenues après réflexion : **7 propriétés** couvrant chiffrement, pagination, filtres, round-trip CRUD leads, round-trip CRUD groupes, conversion idempotente, et seuil de score.

---

### Propriété 1 : Round-trip du chiffrement symétrique

*Pour toute* chaîne `plaintext` (y compris chaînes vides, unicode, caractères spéciaux) et toute clé valide de 32 bytes hex, déchiffrer le résultat du chiffrement produit la chaîne originale.

```
∀ plaintext ∈ String, key ∈ HexString32Bytes :
  decrypt(encrypt(plaintext, key), key) === plaintext
```

**Valide : Requirement 13.1, 13.2**

---

### Propriété 2 : Invariant de pagination cohérente

*Pour tout* ensemble de leads en base de données et pour tout couple `(page, limit)` valide (`page ≥ 1`, `1 ≤ limit ≤ 100`), la réponse de `GET /api/leads` satisfait :
- `len(results) ≤ limit`
- `total ≥ len(results)`
- `total` est constant pour un même jeu de données et mêmes filtres, quelle que soit la valeur de `page`

```
∀ (page, limit) ∈ ℕ⁺ × [1..100] :
  len(results) ≤ limit ∧ total ≥ len(results)
```

**Valide : Requirements 3.1, 3.2**

---

### Propriété 3 : Filtres composables et corrects

*Pour tout* ensemble de leads et toute combinaison de filtres `(statut?, produit?, score_min?)`, chaque lead retourné par `GET /api/leads` satisfait simultanément tous les filtres actifs :
- Si `statut` est fourni : `lead.statut === statut`
- Si `produit` est fourni : `lead.produitDetecte?.toLowerCase().includes(produit.toLowerCase())`
- Si `score_min` est fourni : `lead.scoreConfiance >= score_min`

```
∀ filtres ∈ Filtres, ∀ lead ∈ GET /api/leads(filtres) :
  satisfait(lead, filtres)
```

**Valide : Requirements 3.3, 3.4, 3.5**

---

### Propriété 4 : Round-trip création/lecture d'un lead

*Pour tout* corps de lead valide (`groupeSurveilleId` existant, `texteOriginal` non vide), créer puis lire le lead retourne les mêmes données :

```
∀ input ∈ LeadInput valide :
  let lead = POST /api/leads(input)
  GET /api/leads/:lead.id retourne un objet tel que
    lead.texteOriginal === input.texteOriginal ∧
    lead.groupeSurveilleId === input.groupeSurveilleId ∧
    lead.statut === 'nouveau'
```

**Valide : Requirements 3.6**

---

### Propriété 5 : Idempotence de la conversion (protection doublon)

*Pour tout* lead ayant déjà un `clientId` non nul, toute tentative de conversion via `POST /api/leads/:id/convertir` retourne HTTP 409, quel que soit le nombre de tentatives :

```
∀ lead tel que lead.clientId ≠ null :
  POST /api/leads/:lead.id/convertir → 409
```

**Valide : Requirement 5.4**

---

### Propriété 6 : Invariant de l'état post-conversion

*Pour tout* lead non converti (`clientId === null`), après une conversion réussie, le lead satisfait :
- `lead.clientId ≠ null`
- `lead.statut === 'envoye'`
- Le client créé est accessible via `GET /api/clients/:clientId`

```
∀ lead tel que lead.clientId === null :
  let client = POST /api/leads/:lead.id/convertir (success)
  GET /api/leads/:lead.id → lead.clientId === client.id ∧ lead.statut === 'envoye'
```

**Valide : Requirements 5.1, 5.2**

---

### Propriété 7 : Seuil de score du bot

*Pour tout* score retourné par Gemini et tout seuil `SCORE_SEUIL` configuré, le bot crée un lead si et seulement si `score ≥ seuil` :

```
∀ score ∈ [0, 1], seuil ∈ [0, 1] :
  botCréeLead(score, seuil) ⟺ score ≥ seuil
```

**Valide : Requirements 12.3, 12.4**

---

## Gestion des erreurs

### API

| Situation | Code HTTP | Message |
|-----------|-----------|---------|
| JWT absent | 401 | `Non authentifié` |
| JWT invalide/expiré | 401 | `Token invalide ou expiré` |
| Rôle insuffisant | 403 | `Accès refusé` |
| Ressource introuvable | 404 | `Lead introuvable` / `Groupe introuvable` |
| Corps invalide (Zod) | 422 | `Données invalides` |
| Doublon URL groupe | 409 | `Un groupe avec cette URL existe déjà` |
| Lead déjà converti | 409 | `Lead déjà converti` |
| Suppression impossible (leads liés) | 409 | `Ce groupe possède des leads et ne peut pas être supprimé` |
| Clé de chiffrement absente | 500 | `Configuration manquante : COOKIE_ENCRYPTION_KEY` |
| Erreur serveur générique | 500 | `Erreur serveur` |

### Interface

- Toutes les erreurs API sont affichées via `react-hot-toast` (toast d'erreur).
- Les erreurs de chargement de liste conservent les données précédentes et affichent un message non bloquant.
- Les erreurs de mutation (PATCH, POST convertir) ne ferment pas la fiche lead.
- Les erreurs 409 sur suppression de groupe affichent le message détaillé retourné par l'API.

### Bot

- Erreur 401/403 → arrêt immédiat avec log.
- Erreur 5xx → une tentative de retry après 5 secondes, puis log et poursuite avec le post suivant.
- Echec scraping Apify → log + mise à jour statut groupe à `erreur` + poursuite avec le groupe suivant.

---

## Stratégie de tests

### Approche duale

Le module utilise deux types de tests complémentaires :

1. **Tests unitaires / exemples** : couvrent des scénarios spécifiques, les cas limites, et les conditions d'erreur.
2. **Tests basés sur les propriétés** : vérifient les invariants universels sur des entrées générées aléatoirement.

### Tests de propriétés (fast-check)

La librairie choisie est **[fast-check](https://fast-check.dev/)**, compatible avec le runner de tests Vitest déjà présent dans le projet.

Configuration :
- Minimum **100 itérations** par test de propriété.
- Chaque test est étiqueté avec le format : `Feature: leads-capture-module, Property N: <texte de la propriété>`

```typescript
import fc from 'fast-check';
import { it } from 'vitest';

// Exemple de tag pour Propriété 1 :
// Feature: leads-capture-module, Property 1: round-trip chiffrement symétrique

it('Property 1 — round-trip chiffrement', () => {
  fc.assert(
    fc.property(
      fc.string(),  // plaintext quelconque
      (plaintext) => {
        const key = '0'.repeat(64); // clé de test 32 bytes hex
        return decrypt(encrypt(plaintext, key), key) === plaintext;
      }
    ),
    { numRuns: 100 }
  );
});
```

### Plan de tests par couche

#### `db/crypto.ts` (Propriété 1)

- **PBT** : round-trip pour toute chaîne (incluant vides, unicode, multi-lignes).
- **Unitaire** : test avec clé de longueur incorrecte → erreur levée.
- **Unitaire** : test avec ciphertext corrompu → erreur levée.

#### `api/leads/index.ts` (Propriétés 2, 3, 4)

- **PBT** : pagination — générer des jeux de N leads, paginer avec (page, limit) aléatoires et vérifier `len(results) ≤ limit && total >= len(results)`.
- **PBT** : filtres — générer des leads avec statuts/produits/scores variés, appliquer des filtres aléatoires et vérifier que tous les résultats satisfont les filtres.
- **PBT** : round-trip création/lecture.
- **Unitaire** : POST sans JWT → 401 ; POST avec corps incomplet → 422.

#### `api/leads/[id]/convertir.ts` (Propriétés 5, 6)

- **PBT** : idempotence — générer des leads avec `clientId` non nul, vérifier que `POST /convertir` retourne toujours 409.
- **PBT** : état post-conversion — générer des leads sans `clientId`, convertir, vérifier `clientId ≠ null` et `statut === 'envoye'`.
- **Unitaire** : lead inexistant → 404.

#### `bot/index.ts` (Propriété 7)

- **PBT** : seuil de score — générer des couples `(score, seuil)` aléatoires dans [0,1] et vérifier que `botCréeLead(score, seuil) ⟺ score ≥ seuil`.
- **Unitaire** : échec 401 → arrêt immédiat.
- **Unitaire** : échec 5xx → retry après 5s puis poursuite.

#### Composants React

- **Tests de rendu** (Vitest + @testing-library/react) :
  - `LeadStatusBadge` affiche la bonne couleur selon le statut.
  - `LeadConvertButton` est désactivé si `clientId` non nul.
  - `AppLayout` affiche le badge orange si `leadsNouveauCount > 0`.
  - `AppLayout` masque l'entrée Leads pour les rôles `comptable` et `lecteur`.

#### Tests d'intégration

- Exécuter contre une base Neon de test dédiée.
- 1-3 scénarios de bout en bout : bot crée lead → commercial consulte → commercial convertit → client visible dans kiosq.
- Vérifier les contraintes de clé étrangère (suppression groupe avec leads → 409).
