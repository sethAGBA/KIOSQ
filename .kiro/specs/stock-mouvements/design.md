# Design — stock-mouvements

## Architecture

### Nouveaux fichiers

```
src/pages/stock/
  StockPage.tsx          — page principale /stock
src/lib/
  csv.ts                 — utilitaire exportToCSV (si pas déjà présent)
```

### Modifications

| Fichier | Changement |
|---|---|
| `src/App.tsx` | Route `/stock` → `<StockPage />` |
| `src/components/layout/AppLayout.tsx` | Entrée "Mouvements Stock" dans NAV |
| `src/lib/api.ts` | Ajouter `mouvementsApi` |

---

## Modèle de données

Le type `Mouvement` existe déjà dans `src/types/index.ts` :

```ts
interface Mouvement {
  id: string;
  produitId: string;
  produitRef: string;
  produitNom: string;
  type: TypeMouvement;       // "entree" | "sortie" | "ajustement" | "retour"
  quantite: number;
  stockAvant: number;
  stockApres: number;
  motif: string;
  utilisateurId: string;
  utilisateurNom: string;
  commandeId?: string;
  createdAt: Date;
}
```

### Mocks initiaux

Générer ~10 mouvements de démonstration à partir de `mockProduits` :

```ts
export const mockMouvements: Mouvement[] = [
  // entrees et sorties sur quelques produits
];
```

---

## Composant StockPage

### État local

```ts
const [mouvements, setMouvements] = useState<Mouvement[]>(mockMouvements ou [])
const [filtre, setFiltre] = useState<"tous" | TypeMouvement>("tous")
const [dateDebut, setDateDebut] = useState("")
const [dateFin, setDateFin]   = useState("")
const [showModal, setShowModal] = useState(false)
const [form, setForm] = useState({ produitId, type, quantite, motif })
```

### Logique de filtrage

```ts
const filtered = mouvements
  .filter(m => filtre === "tous" || m.type === filtre)
  .filter(m => {
    if (!dateDebut && !dateFin) return true;
    const d = new Date(m.createdAt);
    if (dateDebut && d < new Date(dateDebut)) return false;
    if (dateFin   && d > new Date(dateFin + "T23:59:59")) return false;
    return true;
  });
```

### Création d'un mouvement

```ts
const handleSubmit = () => {
  const produit = produits.find(p => p.id === form.produitId);
  const stockAvant = produit.stockActuel;
  const delta = form.type === "entree" ? +form.quantite : -form.quantite;
  const stockApres = stockAvant + delta;

  const mouvement: Mouvement = {
    id: nanoid(),
    ...form,
    produitRef: produit.reference,
    produitNom: produit.designation,
    stockAvant,
    stockApres,
    utilisateurId: user.id,
    utilisateurNom: `${user.prenom} ${user.nom}`,
    createdAt: new Date(),
  };

  updateProduit(produit.id, { stockActuel: Math.max(0, stockApres) });
  setMouvements(prev => [mouvement, ...prev]);
  toast.success("Mouvement enregistré");
};
```

---

## API (mode production)

Ajouter dans `src/lib/api.ts` :

```ts
export const mouvementsApi = {
  list: (params?: { dateDebut?: string; dateFin?: string; type?: string }) =>
    get<Mouvement[]>(`/api/stock/mouvements?${new URLSearchParams(params as any)}`),
  create: (data: { produitId: string; type: TypeMouvement; quantite: number; motif: string }) =>
    post<Mouvement>('/api/stock/mouvements', data),
};
```

> Note : l'endpoint API `/api/stock/mouvements` est à créer dans une spec backend séparée. En attendant, le mode mock est fonctionnel.

---

## UI

### Layout

```
┌─ Header ───────────────────────────────────────────────────────────┐
│ Stock / Mouvements          [Du ___] [Au ___] [Nouveau mouvement] │
└────────────────────────────────────────────────────────────────────┘
┌─ Filtres pills ─────────────────────────────────────────────────────┐
│  [Tous] [Entrées] [Sorties] [Ajustements]    ● Temps Réel / Archive │
└────────────────────────────────────────────────────────────────────┘
┌─ Tableau ───────────────────────────────────────────────────────────┐
│ Action | Article | Qté | Stock Ini | Stock Fin | Motif | Op | Date │
└────────────────────────────────────────────────────────────────────┘
```

### Couleurs par type

| Type | Icône | Couleur |
|---|---|---|
| entree | ArrowUpCircle | vert (`text-green-600`, `bg-green-100`) |
| sortie | ArrowDownCircle | rouge (`text-red-600`, `bg-red-100`) |
| ajustement | RefreshCw | orange (`text-amber-600`, `bg-amber-100`) |
| retour | RotateCcw | bleu (`text-blue-600`, `bg-blue-100`) |

### Modal nouveau mouvement

- 4 boutons type (grille 2×2)
- `SearchableSelect` pour le produit (existant dans le projet)
- Bandeau stock actuel/minimum si produit sélectionné
- Input quantité + input motif
- Boutons Annuler / Enregistrer
