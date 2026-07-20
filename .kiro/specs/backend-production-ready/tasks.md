# Plan d'implémentation : backend-production-ready

## Overview

Ce plan convertit le design en étapes de code incrémentales. Chaque tâche s'appuie sur la précédente et se termine par le câblage des composants. L'objectif final est un backend Vercel complet qui affiche des données réelles à la place des mocks sur toutes les pages de l'application Kiosq.

## Tasks

- [x] 1. Configurer le framework de test et installer les dépendances
  - Installer `vitest`, `@vitest/coverage-v8` et `fast-check` en dev dependencies
  - Créer `vitest.config.ts` à la racine avec `environment: 'node'` et couverture v8
  - _Requirements: 6.1_

- [ ] 2. Compléter le `Numeric_Helper` et le couvrir par des tests de propriétés
  - [-] 2.1 Vérifier et compléter `numericRow` / `numericRows` dans `api/_lib/response.ts`
    - S'assurer que tous les champs listés dans Req. 6.1 sont couverts : `prixAchat`, `prixVente`, `prixVenteGros`, `stockActuel`, `stockMinimum`, `soldeDette`, `totalAchats`, `totalHT`, `totalTTC`, `remiseGlobale`, `tva`, `acompte`, `resteAPayer`, `montantPaye`, `soldeCredit`, `nombreCommandes`, `fraisLivraison`
    - _Requirements: 6.1, 6.4_

  - [ ]* 2.2 Écrire le test de propriété pour `numericRow`
    - **Property 1 : Conversion numérique complète**
    - **Validates: Requirements 6.1, 6.4**
    - Créer `api/_lib/response.test.ts`
    - Générer des objets avec fast-check contenant les champs numériques sous forme de chaînes et des champs non-numériques (string, boolean)
    - Vérifier que chaque champ numérique est bien de type `number` après conversion et que les autres champs sont inchangés

- [ ] 3. Créer `api/categories/[id].ts` (PATCH + DELETE)
  - [-] 3.1 Implémenter le handler `api/categories/[id].ts`
    - Gérer PATCH avec le `PatchSchema` Zod `{ nom?, description?, couleur? }` — retourner la catégorie mise à jour (200) ou 404 si introuvable
    - Gérer DELETE avec contrôle `admin` uniquement — supprimer la ligne en DB et retourner `{ message: "Catégorie supprimée" }` (200), ou 404, ou 403
    - Utiliser `requireAuth`, `handleOptions`, `ok`, `err` suivant le pattern des handlers existants
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [ ]* 3.2 Écrire le test de propriété — DELETE catégorie réservé à l'admin
    - **Property 4 : Accès DELETE catégories réservé à l'admin**
    - **Validates: Requirements 1.4**
    - Créer `api/categories/categories.test.ts`
    - Générer avec fast-check les rôles non-admin (`commercial`, `gestionnaire`, `comptable`, `lecteur`)
    - Vérifier que le handler retourne HTTP 403 pour tout rôle ≠ `admin` sur DELETE

- [ ] 4. Créer `api/dashboard/stats/index.ts`
  - [-] 4.1 Créer le dossier et implémenter le handler `api/dashboard/stats/index.ts`
    - Calculer `caMonth` : `SUM(total_ttc)` des factures avec `statut = 'payee'` pour le mois en cours
    - Calculer `commandesActives` : `COUNT(*)` des commandes avec `statut IN ('brouillon','envoye','confirme','en_preparation','expedie')`
    - Calculer `alertesStock` : `COUNT(*)` des produits actifs avec `stock_actuel <= stock_minimum`
    - Calculer `facturesEnRetard` : `SUM(reste_a_payer)` des factures avec `statut = 'en_retard'`
    - Calculer `caParMois` : récupérer les factures des 12 derniers mois en une seule requête, puis regrouper côté JS en tableau de 12 entrées `{ label, valeur, commandes }` avec 0 pour les mois sans données
    - Retourner l'objet `DashboardStats` via `ok(res, stats)`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [ ]* 4.2 Écrire le test de propriété — `caParMois` complétude sur 12 mois
    - **Property 5 : caParMois — complétude sur 12 mois**
    - **Validates: Requirements 2.2, 2.3**
    - Créer `api/dashboard/dashboard.test.ts`
    - Extraire la fonction pure de calcul de `caParMois` dans un module utilitaire testable
    - Générer avec fast-check des tableaux arbitraires de factures (y compris vide) avec `statut`, `totalTTC` et `dateFacture` aléatoires
    - Vérifier que le résultat a exactement 12 entrées, avec `valeur >= 0` et `commandes >= 0` pour chaque entrée

- [ ] 5. Mettre à jour `api/commandes-fournisseurs/[id].ts` — logique de réception de stock
  - [-] 5.1 Ajouter la mise à jour du stock produits au PATCH statut `recu` / `recu_partiel`
    - Dans le handler PATCH, si le nouveau statut est `recu` ou `recu_partiel` ET que le statut précédent n'est pas déjà `recu`, itérer sur `existing.lignes` (JSONB) et pour chaque ligne : `UPDATE produits SET stock_actuel = stock_actuel + ligne.quantiteRecue WHERE id = ligne.produitId`
    - Vérifier que `dateReception` est bien définie sur `new Date()` quand le statut passe à `recu`
    - Vérifier que le paiement POST retourne HTTP 400 si `montantPaye + montant > totalTTC`
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [ ]* 5.2 Écrire le test de propriété — invariant financier des paiements CF
    - **Property 2 : Invariant financier des paiements CF**
    - **Validates: Requirements 5.3**
    - Créer `api/commandes-fournisseurs/cf.test.ts`
    - Extraire la logique de calcul du paiement dans une fonction pure testable
    - Générer avec fast-check des triplets `(totalTTC, montantActuel, paiement)` valides
    - Vérifier que `montantPaye_new + resteAPayer_new = totalTTC` après paiement

  - [ ]* 5.3 Écrire le test de propriété — mise à jour de stock à la réception
    - **Property 6 : Mise à jour de stock à la réception CF**
    - **Validates: Requirements 5.1**
    - Générer avec fast-check des tableaux de lignes avec `produitId` et `quantiteRecue > 0`
    - Utiliser un mock en mémoire de la DB pour vérifier que chaque `stockActuel` augmente exactement de `ligne.quantiteRecue`

- [~] 6. Checkpoint — s'assurer que les tests existants passent
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Mettre à jour `server.ts` — enregistrer les nouvelles routes
  - [~] 7.1 Ajouter les routes manquantes dans `server.ts`
    - Ajouter la route `app.all('/api/categories/:id', ...)` avec injection de `req.query.id = req.params.id` (même pattern que `fournisseurs/:id`)
    - Ajouter la route `app.get('/api/dashboard/stats', adapt('./api/dashboard/stats/index.ts'))`
    - Placer la route `categories/:id` avant la route `categories` générale pour respecter la priorité Express
    - Mettre à jour le log de démarrage avec les nouvelles routes
    - _Requirements: 3.1, 3.2, 3.3_

- [ ] 8. Ajouter `dashboardApi.stats()` dans `src/lib/api.ts`
  - [~] 8.1 Déclarer l'interface `DashboardStats` et ajouter l'objet `dashboardApi` dans `src/lib/api.ts`
    - Définir le type `DashboardStats` aligné sur la réponse de l'endpoint (champs : `caMonth`, `commandesActives`, `alertesStock`, `facturesEnRetard`, `caParMois`)
    - Ajouter `export const dashboardApi = { stats: () => get<DashboardStats>('/api/dashboard/stats') }`
    - _Requirements: 4.2_

- [ ] 9. Mettre à jour `DashboardPage.tsx` — remplacer `mockDataCA` par l'API
  - [~] 9.1 Câbler `DashboardPage.tsx` sur `dashboardApi.stats()`
    - Ajouter un `useState<DashboardStats | null>` et un `useEffect` qui appelle `dashboardApi.stats()` au montage si `USE_API` est vrai
    - Remplacer les références à `mockDataCA` dans les graphiques (AreaChart et BarChart) par `stats?.caParMois ?? mockDataCA`
    - Remplacer le KPI "Bénéfice estimé" (hardcodé sur `mockDataCA`) par les données réelles ou un fallback sur mock si `!USE_API`
    - Remplacer le calcul local des KPIs du Dashboard (caMonth, commandesActives, alertesStock, facturesEnRetard) par les valeurs de `stats` lorsque `USE_API` est vrai
    - Afficher un indicateur de chargement pendant l'appel et gérer l'erreur (Req. 4.5)
    - _Requirements: 4.2, 4.5_

- [ ] 10. Corriger la gestion d'erreur du chargement initial dans `AppStore`
  - [~] 10.1 Ajouter un champ `error: string | null` dans l'`AppStore` et le propager
    - Ajouter `error: string | null` dans l'interface `AppState` et l'état initial (`null`)
    - Dans `fetchAll()`, entourer le `Promise.all` d'un try/catch et écrire le message d'erreur dans `set({ error: message })`
    - Dans `AppLayout`, lire `useAppStore(s => s.error)` et afficher une bannière d'erreur si non-null
    - _Requirements: 4.5_

- [ ] 11. Compléter le script de seed avec des commandes, factures et commandes fournisseurs
  - [~] 11.1 Enrichir `db/seed.ts` avec des données historiques multi-mois
    - Ajouter 3–4 commandes clients réparties sur les 3 derniers mois avec des statuts variés (`confirme`, `livre`)
    - Ajouter 5–6 factures liées aux commandes avec des statuts variés (`payee`, `envoyee`, `en_retard`) et des dates de facturation réparties sur les 12 derniers mois pour alimenter `caParMois`
    - Ajouter 2 commandes fournisseurs (une `recu`, une `commandee`) pour tester la réception de stock
    - Vérifier que le script utilise `onConflictDoNothing()` sur toutes les insertions pour idempotence
    - Vérifier la gestion d'erreur si `DATABASE_URL` est absent (déjà géré dans `getDb()`, confirmer que `process.exit(1)` est appelé)
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [ ] 12. Ajouter les tests de propriété pour la sécurité par rôle
  - [ ]* 12.1 Écrire le test de propriété — mutations interdites au lecteur
    - **Property 3 : Autorisation par rôle — mutations interdites au lecteur**
    - **Validates: Requirements 8.4**
    - Créer `api/_lib/auth.test.ts`
    - Générer avec fast-check des paires `(route, method)` parmi les endpoints protégés et les méthodes mutantes (POST, PATCH, DELETE)
    - Utiliser un mock de `requireAuth` retournant un contexte avec `role: 'lecteur'`
    - Vérifier que les handlers retournent HTTP 403

- [~] 13. Checkpoint final — exécuter tous les tests et valider l'intégration
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Les tâches marquées `*` sont optionnelles (tests de propriétés et tests unitaires) et peuvent être ignorées pour un MVP rapide
- Chaque tâche référence les exigences correspondantes pour la traçabilité
- Les tests de propriétés utilisent **fast-check** avec le runner **Vitest** (`vitest --run` pour une exécution unique)
- Les fonctions pures à extraire pour les tâches 4.2 et 5.2 permettent de tester la logique métier sans dépendance à la DB
- Le schéma Drizzle (`db/schema.ts`) n'a besoin d'aucune modification — tous les champs nécessaires existent déjà
- Pour l'étape 9, `USE_API` est déjà défini dans `appStore.ts` — réutiliser `Boolean(import.meta.env.VITE_API_URL)` dans `DashboardPage.tsx`

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2.1", "3.1", "4.1", "5.1"] },
    { "id": 2, "tasks": ["2.2", "3.2", "4.2", "5.2", "5.3"] },
    { "id": 3, "tasks": ["7.1", "8.1"] },
    { "id": 4, "tasks": ["9.1", "10.1", "11.1", "12.1"] }
  ]
}
```
