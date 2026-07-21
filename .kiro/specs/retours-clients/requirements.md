# Requirements — retours-clients

## Overview

Implémenter la page `/retours` : historique de tous les retours clients avec filtres (date, mode de remboursement, opérateur). Les retours sont déjà gérés au niveau de la facture (`api/factures/[id]/retour.ts`), cette page les liste et permet la consultation.

## Requirements

### 1. Affichage de la liste

- **1.1** La page affiche un tableau de tous les retours avec colonnes : Date & heure, ID retour, Vente origine (numéro facture), Client, Articles retournés, Montant total, Mode de remboursement.
- **1.2** Les articles retournés sont affichés sous forme de badges (ex: `2x Ramette A4`).
- **1.3** Le mode de remboursement est coloré : Espèces (vert), Réduction dette (bleu), Avoir (gris).
- **1.4** Si aucun retour, afficher un message vide avec icône.

### 2. KPIs en haut de page

- **2.1** Montant total des retours sur la sélection.
- **2.2** Nombre de retours sur la sélection.

### 3. Filtres

- **3.1** Filtre par plage de dates (Du / Au).
- **3.2** Filtre par mode de remboursement (Tous / Espèces / Réduction dette / Avoir).
- **3.3** Barre de recherche par nom client ou numéro de facture.
- **3.4** Filtre par opérateur (utilisateur ayant enregistré le retour).

### 4. Modèle RetourClient

- **4.1** Type `RetourClient` à ajouter dans `src/types/index.ts` :
  - `id`, `factureId`, `factureNumero`, `clientId`, `clientNom`, `lignes[]`, `totalTTC`, `motif`, `remboursementMode` (`especes` | `credit_reduc` | `avoir`), `utilisateurId`, `utilisateurNom`, `createdAt`
- **4.2** Chaque ligne retour : `produitId`, `produitNom`, `quantite`, `prixUnitaire`, `total`.

### 5. Données

- **5.1** En mode démo, des retours mock sont affichés.
- **5.2** En mode API, les retours sont chargés via `retoursApi.list()`.
- **5.3** Quand un retour est créé depuis `FactureDetailPage`, il apparaît dans cette liste.

### 6. Navigation

- **6.1** La page est accessible via `/retours`.
- **6.2** Un lien "Retours" est visible dans la sidebar pour les rôles `admin`, `gestionnaire`, `comptable`.
