Listed directory components
Listed directory common
Listed directory modules
Listed directory stock
Listed directory lib
Listed directory types
Listed directory components
Listed directory pos
Searched for "RetourModal"
Searched for "AnnulationDetteModal"
Searched for "HistoriqueVersements"
Searched for "CategoriesManager"
Searched for "ReceiptPrinter"
Searched for "Scanner"
Searched for "export const "
Searched for "export const "

Pour compléter la migration de **`stock-app`** vers notre projet **`kiosq`**, voici l'inventaire précis de ce qu'il reste à copier et à adapter (au niveau de la **Base de données / API**, des **Écrans**, des **Composants** et des **Utilitaires**) :

---

### 1. 🗄️ Base de Données & APIs (`db/schema.ts` & `api/`)
Pour alimenter les nouvelles fonctionnalités, ces tables (présentes dans `stock-app`) doivent être définies dans Drizzle Postgres [db/schema.ts](file:///Users/seth/development/kiosq/db/schema.ts) et leurs endpoints créés dans `api/` :

* 🟢 **`clotures_caisse`** : Pour enregistrer les Z de caisse (fermeture journalière, montant théorique vs réel, écarts).
* 🟢 **`sorties_caisse`** : Pour tracer les décaissements / charges payées en espèces depuis la caisse.
* 🟢 **`retours`** : Pour enregistrer la liste et le détail des retours d'articles avec leur mode de remboursement.
* 🟢 **`inventaires`** : Pour stocker les sessions d'inventaire physique (comptage magasin et régularisations).
* 🟢 **`mouvements_stock`** : Table dédiée pour l'historique complet et la traçabilité de chaque mouvement (entrée, sortie, casse, ajustement, retour).
* 🟢 **`versements_dette`** : Pour suivre le remboursement échelonné des créances/dettes clients.

---

### 2. 🖥️ Écrans & Pages React (`src/pages/`)
Il reste à migrer/créer ces 5 pages principales depuis `stock-app/app/` vers `src/pages/` :

1. **Page Clôture de Caisse (`/rapports/cloture`)**
   * *Source :* [stock-app/app/rapports/cloture/page.tsx](file:///Users/seth/development/kiosq/stock-app/app/rapports/cloture/page.tsx)
   * *Rôle :* Interface de fin de journée pour compter la caisse physique, valider l'écart et consulter l'historique des Z de caisse.
2. **Page Sorties de Caisse (`/rapports/sorties`)**
   * *Source :* [stock-app/app/rapports/sorties/page.tsx](file:///Users/seth/development/kiosq/stock-app/app/rapports/sorties/page.tsx)
   * *Rôle :* Enregistrer les petites dépenses courantes (repas, fournitures, carburant, factures) imputées directement sur la caisse.
3. **Page Historique des Retours (`/retours`)**
   * *Source :* [stock-app/app/retours/page.tsx](file:///Users/seth/development/kiosq/stock-app/app/retours/page.tsx)
   * *Rôle :* Vue centralisée de tous les retours clients et avoirs accordés avec filtres par période/vendeur.
4. **Page Session d'Inventaire Physique (`/stock/inventaire`)**
   * *Source :* [stock-app/app/inventaire/page.tsx](file:///Users/seth/development/kiosq/stock-app/app/inventaire/page.tsx)
   * *Rôle :* Lancer un comptage général des stocks en magasin, calculer les écarts et appliquer les ajustements en un clic.
5. **Page Registre des Mouvements de Stock (`/stock`)**
   * *Source :* [stock-app/app/stock/page.tsx](file:///Users/seth/development/kiosq/stock-app/app/stock/page.tsx)
   * *Rôle :* Tableau de bord global du registre des flux de stock avec filtres multi-critères.

---

### 3. 🧩 Composants Métier & Modales (`src/components/`)
Ces composants spécialisés de `stock-app` restent à copier dans `src/components/` :

* 🔹 **`HistoriqueVersements.tsx`** ([stock-app/components/modules/HistoriqueVersements.tsx](file:///Users/seth/development/kiosq/stock-app/components/modules/HistoriqueVersements.tsx)) : Modal de paiement des créances clients en plusieurs tranches avec reçu de versement.
* 🔹 **`AnnulationDetteModal.tsx`** ([stock-app/components/modules/AnnulationDetteModal.tsx](file:///Users/seth/development/kiosq/stock-app/components/modules/AnnulationDetteModal.tsx)) : Modal d'abandon ou de remise exceptionnelle de créance client.
* 🔹 **`ReceiptPrinter.tsx`** ([stock-app/components/common/ReceiptPrinter.tsx](file:///Users/seth/development/kiosq/stock-app/components/common/ReceiptPrinter.tsx)) : Composant d'impression directe sur imprimante thermique de caisse ESC/POS (format ticket 80mm).
* 🔹 **`Scanner.tsx`** ([stock-app/components/common/Scanner.tsx](file:///Users/seth/development/kiosq/stock-app/components/common/Scanner.tsx)) : Gestionnaire d'écoute des événements douchette / lecteur de code-barres USB.
* 🔹 **`ProductSearch.tsx`** ([stock-app/components/common/ProductSearch.tsx](file:///Users/seth/development/kiosq/stock-app/components/common/ProductSearch.tsx)) : Recherche rapide de produits intégrée avec scanner.
* 🔹 **`CategoriesManager.tsx`** ([stock-app/components/modules/CategoriesManager.tsx](file:///Users/seth/development/kiosq/stock-app/components/modules/CategoriesManager.tsx)) : Modal de gestion visuelle des catégories/sous-catégories.

---

### 4. 🛠️ Utilitaires (`src/lib/`)
* 🔸 **`export-utils.ts`** ([stock-app/lib/export-utils.ts](file:///Users/seth/development/kiosq/stock-app/lib/export-utils.ts)) : Formateurs et exportateurs CSV/Excel pour le registre de stock et la caisse.
* 🔸 **`validation-annulation.ts`** ([stock-app/lib/validation-annulation.ts](file:///Users/seth/development/kiosq/stock-app/lib/validation-annulation.ts)) : Contrôles d'autorisation et règles de sécurité sur l'annulation de ventes et dettes.