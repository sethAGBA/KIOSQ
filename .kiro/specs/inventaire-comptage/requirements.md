# Requirements — inventaire-comptage

## Overview

Implémenter deux écrans liés à l'inventaire physique :
- `/stock/inventaire` : ajustement rapide (saisir les quantités réelles et enregistrer les écarts en un clic)
- `/inventaire` : sessions d'inventaire complètes avec comptage produit par produit, notes, historique des sessions, et validation qui applique les ajustements au stock

## Requirements

### 1. Page /stock/inventaire — Ajustement rapide

- **1.1** La page affiche un tableau de tous les produits avec colonnes : Produit (nom + ref), Stock actuel (système), Compté (input), Écart calculé.
- **1.2** L'écart est calculé automatiquement : `compté - stock_actuel`.
- **1.3** Les écarts positifs sont affichés en vert, négatifs en rouge, zéro en gris.
- **1.4** Un champ de recherche permet de filtrer les produits par nom ou référence.
- **1.5** Les lignes modifiées (input non vide) sont surlignées pour les distinguer.
- **1.6** Un bouton "Enregistrer (N)" (désactivé si aucune modification) déclenche la réconciliation.
- **1.7** Un bouton "Annuler" remet à zéro tous les inputs.
- **1.8** À l'enregistrement, le stock de chaque produit modifié est mis à jour via `updateProduit`.
- **1.9** Un mouvement d'ajustement est créé pour chaque produit modifié.
- **1.10** Un toast récapitulatif est affiché : "N ajustement(s) enregistré(s)".

### 2. Page /inventaire — Sessions de comptage

- **2.1** La page a deux vues : "Nouveau comptage" et "Historique" (toggle).
- **2.2** Vue "Nouveau comptage" : barre de recherche + liste de produits disponibles à ajouter.
- **2.3** Les produits sont ajoutés à une session de comptage en cliquant sur eux dans les résultats de recherche.
- **2.4** Pour chaque produit ajouté, l'utilisateur saisit la quantité réelle comptée.
- **2.5** L'écart (réel - théorique) est calculé et affiché en temps réel.
- **2.6** Un champ "Notes de session" permet d'ajouter un commentaire (optionnel).
- **2.7** Le bouton "Enregistrer l'inventaire" sauvegarde la session en statut `en_cours`.
- **2.8** La session enregistrée apparaît dans l'historique.
- **2.9** Vue "Historique" : tableau des sessions passées (ID, date, utilisateur, nb produits, statut).
- **2.10** Une session en statut `en_cours` peut être "Validée" depuis l'historique.
- **2.11** La validation applique les écarts au stock de chaque produit et passe la session en `valide`.
- **2.12** Une session `valide` ne peut plus être modifiée.

### 3. Modèle InventaireSession

- **3.1** Type `InventaireSession` à ajouter dans `src/types/index.ts` :
  - `id`, `date`, `utilisateurId`, `utilisateurNom`, `statut` (`en_cours` | `valide`), `lignes[]`, `notes`, `createdAt`
- **3.2** Chaque ligne : `produitId`, `produitRef`, `produitNom`, `stockTheorique`, `stockReel`, `ecart`.

### 4. Navigation

- **4.1** `/stock/inventaire` est accessible depuis la page `/stock` (lien ou onglet).
- **4.2** `/inventaire` est accessible via le sidebar pour les rôles `admin`, `gestionnaire`.
- **4.3** Lien "Retour aux mouvements" depuis `/stock/inventaire` vers `/stock`.
