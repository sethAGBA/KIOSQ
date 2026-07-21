# Plan d'implémentation — stock-mouvements

## Overview

Implémenter la page `/stock` de suivi des mouvements de stock. La page fonctionne en mode démo (données locales) et s'intègre avec l'API en production via `mouvementsApi`.

## Tasks

- [ ] 1. Ajouter les mocks de mouvements initiaux
  - Ajouter `mockMouvements: Mouvement[]` dans `src/data/mock.ts` avec ~10 mouvements (entrées, sorties, ajustements) basés sur les produits existants
  - Couvrir les 4 types : `entree`, `sortie`, `ajustement`, `retour`
  - _Requirements: 5.2, 5.3_

- [ ] 2. Ajouter `mouvementsApi` dans `src/lib/api.ts`
  - Ajouter `mouvementsApi.list()` et `mouvementsApi.create()` dans `src/lib/api.ts`
  - _Requirements: 3.6_

- [ ] 3. Créer `src/pages/stock/StockPage.tsx`
  - État local : `mouvements`, `filtre`, `dateDebut`, `dateFin`, `showModal`, `form`
  - Header avec titre, filtres date, bouton "Nouveau mouvement" (admin/gestionnaire)
  - Pills de filtre par type
  - Indicateur mode Temps Réel / Archive
  - Tableau des mouvements filtrés avec icônes colorées par type
  - Message vide si aucun mouvement
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 2.5_

- [ ] 4. Implémenter le modal "Nouveau mouvement" dans StockPage
  - Sélection type (4 boutons)
  - `SearchableSelect` pour le produit
  - Bandeau stock actuel/minimum si produit sélectionné
  - Input quantité et motif
  - `handleSubmit` : calcule `stockAvant`/`stockApres`, appelle `updateProduit`, ajoute à `mouvements`
  - En mode `USE_API`, appeler `mouvementsApi.create()`
  - Toast succès
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

- [ ] 5. Implémenter l'export CSV
  - Bouton "Exporter" qui génère un CSV des mouvements filtrés via `xlsx` (déjà installé)
  - _Requirements: 4.1, 4.2_

- [ ] 6. Ajouter la route et le lien sidebar
  - Ajouter `<Route path="/stock" element={<StockPage />} />` dans `App.tsx`
  - Ajouter l'entrée `{ to: '/stock', label: 'Mouvements Stock', icon: ArrowLeftRight, roles: ['admin','gestionnaire','lecteur'] }` dans le tableau `NAV` de `AppLayout.tsx`
  - _Requirements: 6.1, 6.2_

- [ ] 7. Vérifier les diagnostics TypeScript
  - Lancer `get_diagnostics` sur `StockPage.tsx`, `mock.ts`, `api.ts`, `App.tsx`, `AppLayout.tsx`
  - Corriger toute erreur de typage

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1", "2"] },
    { "id": 1, "tasks": ["3", "4"] },
    { "id": 2, "tasks": ["5", "6"] },
    { "id": 3, "tasks": ["7"] }
  ]
}
```
