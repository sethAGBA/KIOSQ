# Plan d'implémentation — inventaire-comptage

## Overview

Implémenter les deux pages d'inventaire physique : ajustement rapide (`/stock/inventaire`) et sessions de comptage complètes (`/inventaire`).

## Tasks

- [ ] 1. Ajouter les types `LigneInventaire` et `InventaireSession` dans `src/types/index.ts`
  - _Requirements: 3.1, 3.2_

- [ ] 2. Créer `src/pages/stock/StockInventairePage.tsx`
  - Tableau produits avec input "Compté" et colonne Écart calculée
  - Filtre recherche
  - Boutons Annuler / Enregistrer (N)
  - `handleSave` : `updateProduit` pour chaque ligne modifiée, toast récapitulatif
  - Lien retour vers `/stock`
  - _Requirements: 1.1 → 1.10, 4.3_

- [ ] 3. Créer `src/pages/inventaire/InventairePage.tsx`
  - Toggle "Nouveau" / "Historique"
  - Vue Nouveau : recherche produits, ajout à la session, saisie stock réel, écart temps réel, notes, bouton sauvegarder
  - Vue Historique : tableau sessions, bouton "Valider les écarts" pour sessions `en_cours`
  - `handleSave` : crée une `InventaireSession` et bascule vers l'historique
  - `handleValider` : applique les écarts via `updateProduit`, passe session en `valide`
  - _Requirements: 2.1 → 2.12_

- [ ] 4. Ajouter les routes dans `App.tsx`
  - `/stock/inventaire` → `StockInventairePage` (avant `/stock/:id` pour éviter conflit)
  - `/inventaire` → `InventairePage`
  - _Requirements: 4.1, 4.2_

- [ ] 5. Ajouter l'entrée "Inventaire" dans la sidebar `AppLayout.tsx`
  - Icon : `ClipboardList`, rôles : `admin`, `gestionnaire`
  - _Requirements: 4.2_

- [ ] 6. Vérifier les diagnostics TypeScript
  - `get_diagnostics` sur tous les fichiers modifiés

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2", "3"] },
    { "id": 2, "tasks": ["4", "5"] },
    { "id": 3, "tasks": ["6"] }
  ]
}
```
