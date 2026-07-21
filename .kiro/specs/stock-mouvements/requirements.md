# Requirements — stock-mouvements

## Overview

Implémenter la page `/stock` : historique des mouvements de stock avec filtres avancés, et modal de création d'un nouveau mouvement (entrée / sortie / ajustement). Les mouvements sont persistés dans un store local en mode démo, et via API en production.

## Requirements

### 1. Affichage de la liste des mouvements

- **1.1** La page affiche un tableau de tous les mouvements avec les colonnes : type (icône colorée), produit (nom + référence), quantité (signée +/-), stock avant, stock après, motif, opérateur, date & heure.
- **1.2** Les mouvements de type `entree` sont affichés en vert, `sortie` et `ajustement` en rouge/orange.
- **1.3** Le tableau est vide par défaut en mode démo (les mouvements sont générés dynamiquement).
- **1.4** Un message "Aucun mouvement" est affiché quand le tableau est vide.

### 2. Filtres

- **2.1** L'utilisateur peut filtrer par type de mouvement : Tous / Entrées / Sorties / Ajustements via des boutons pills.
- **2.2** L'utilisateur peut filtrer par plage de dates (Du / Au) via deux inputs date.
- **2.3** Quand aucune date n'est sélectionnée, le mode est "temps réel" (100 derniers mouvements).
- **2.4** Quand une plage de dates est définie, le mode est "archive".
- **2.5** Un bouton reset (×) permet d'effacer les filtres date.

### 3. Création d'un nouveau mouvement

- **3.1** Un bouton "Nouveau mouvement" (visible pour les rôles `admin` et `gestionnaire`) ouvre un modal.
- **3.2** Le modal contient : sélection du type (Entrée / Sortie / Ajustement), recherche de produit, champ quantité, champ motif obligatoire.
- **3.3** Quand un produit est sélectionné, le modal affiche son stock actuel et son stock minimum.
- **3.4** À la validation, le stock du produit est mis à jour dans le store (`updateProduit`).
- **3.5** Un mouvement est ajouté dans l'état local (tableau des mouvements affichés).
- **3.6** En mode `USE_API`, l'appel se fait via `mouvementsApi.create()`.
- **3.7** Un toast de succès est affiché après enregistrement.

### 4. Export CSV

- **4.1** Un bouton "Exporter" génère un fichier CSV des mouvements filtrés.
- **4.2** Le CSV contient les colonnes : Type, Produit, Référence, Quantité, Stock Avant, Stock Après, Motif, Utilisateur, Date.

### 5. Intégration store

- **5.1** Les données des produits viennent de `useAppStore().produits`.
- **5.2** Les mouvements sont stockés dans un état React local (`useState`), non dans le store global (les mouvements ne sont pas un état partagé entre pages).
- **5.3** Les mocks de mouvements initiaux sont générés à partir des produits existants (ex: 2-3 mouvements par produit).

### 6. Navigation

- **6.1** La page est accessible via `/stock`.
- **6.2** Un lien "Stock" apparaît dans la sidebar pour les rôles `admin`, `gestionnaire`, `lecteur`.
- **6.3** La sidebar groupe visuellement Stock sous Catalogue & Stock (ou entrée séparée).
