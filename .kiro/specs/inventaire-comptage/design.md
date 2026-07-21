# Design — inventaire-comptage

## Nouveaux fichiers

```
src/pages/stock/
  StockInventairePage.tsx    — /stock/inventaire (ajustement rapide)
src/pages/inventaire/
  InventairePage.tsx         — /inventaire (sessions de comptage)
```

## Modifications

| Fichier | Changement |
|---|---|
| `src/types/index.ts` | Ajouter `LigneInventaire`, `InventaireSession` |
| `src/App.tsx` | Routes `/stock/inventaire` et `/inventaire` |
| `src/components/layout/AppLayout.tsx` | Entrée "Inventaire" dans NAV |

---

## Types à ajouter

```ts
// src/types/index.ts

export interface LigneInventaire {
  produitId: string;
  produitRef: string;
  produitNom: string;
  stockTheorique: number;
  stockReel: number;
  ecart: number;
}

export interface InventaireSession {
  id: string;
  date: Date;
  utilisateurId: string;
  utilisateurNom: string;
  statut: "en_cours" | "valide";
  lignes: LigneInventaire[];
  notes?: string;
  createdAt: Date;
}
```

---

## StockInventairePage (`/stock/inventaire`)

### État

```ts
const [search, setSearch]   = useState("")
const [counts, setCounts]   = useState<Record<string, number>>({})  // produitId → quantité comptée
const [motif, setMotif]     = useState("Réconciliation d'inventaire")
```

### Logique réconciliation

```ts
const handleSave = () => {
  const ids = Object.keys(counts);
  ids.forEach(id => {
    const produit = produits.find(p => p.id === id);
    const nouveauStock = counts[id];
    const diff = nouveauStock - produit.stockActuel;
    updateProduit(id, { stockActuel: nouveauStock });
    // Ajouter mouvement ajustement dans état local
  });
  toast.success(`${ids.length} ajustement(s) enregistré(s)`);
  setCounts({});
};
```

### Layout

```
┌─ Header ──────────────────────────────────────────────────┐
│ ← Retour    Inventaire Physique     [Annuler] [Enregistrer(N)] │
└───────────────────────────────────────────────────────────┘
┌─ Grille 3 colonnes ────────────────────────────────────────┐
│  Colonne 1-2 : Tableau (Produit | Stock Actuel | Compté | Écart) │
│  Colonne 3   : Récapitulatif + Motif textarea               │
└───────────────────────────────────────────────────────────┘
```

---

## InventairePage (`/inventaire`)

### État

```ts
const [view, setView]       = useState<"nouveau" | "historique">("nouveau")
const [sessions, setSessions] = useState<InventaireSession[]>([])
const [lignes, setLignes]   = useState<LigneInventaire[]>([])
const [search, setSearch]   = useState("")
const [notes, setNotes]     = useState("")
```

### Logique sauvegarde session

```ts
const handleSave = () => {
  const session: InventaireSession = {
    id: nanoid(),
    date: new Date(),
    utilisateurId: user.id,
    utilisateurNom: `${user.prenom} ${user.nom}`,
    statut: "en_cours",
    lignes,
    notes,
    createdAt: new Date(),
  };
  setSessions(prev => [session, ...prev]);
  setLignes([]);
  setView("historique");
  toast.success("Inventaire enregistré");
};
```

### Logique validation

```ts
const handleValider = (session: InventaireSession) => {
  session.lignes.forEach(l => {
    updateProduit(l.produitId, { stockActuel: l.stockReel });
  });
  setSessions(prev =>
    prev.map(s => s.id === session.id ? { ...s, statut: "valide" } : s)
  );
  toast.success("Stocks mis à jour");
};
```

### Layout vue "Nouveau comptage"

```
┌─ Gauche : Recherche produits ─────┐  ┌─ Droite : Table de comptage ───────┐
│  [input recherche]                 │  │  Produit | Théorique | Réel | Écart │
│  → résultats dropdown              │  │  ...lignes...                       │
│  [conseils]                        │  │  [Notes]  [Enregistrer]             │
└───────────────────────────────────┘  └────────────────────────────────────┘
```
