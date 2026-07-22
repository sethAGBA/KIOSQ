# Plan d'implémentation — Module Capture de Leads

## Vue d'ensemble

Implémentation du module de capture de leads en cinq groupes ordonnés : infrastructure DB et crypto, routes API, tests property-based et unitaires, interface React, et bot de capture. Chaque tâche est atomique et s'appuie sur les précédentes.

---

## Tâches

- [x] 1. Groupe 1 — Infrastructure DB et crypto

  - [x] 1.1 Créer `db/crypto.ts` — utilitaire AES-256-GCM
    - Fichiers : `db/crypto.ts` (créer)
    - Implémenter les fonctions `encrypt(plaintext, key)` et `decrypt(ciphertext, key)` en AES-256-GCM.
    - Format de stockage : `"<iv_hex>:<authTag_hex>:<ciphertext_hex>"` (séparateur `:`).
    - Utiliser `node:crypto` (`createCipheriv`, `createDecipheriv`, `randomBytes`).
    - Lever une erreur si le format est invalide ou si le déchiffrement échoue.
    - _Requirements : 13.1, 13.2_

  - [x] 1.2 Étendre `db/schema.ts` — tables `groupesSurveilles` et `leads`
    - Fichiers : `db/schema.ts` (modifier)
    - Ajouter les enums Drizzle `statutGroupeEnum` (`actif`, `inactif`, `erreur`) et `statutLeadEnum` (`nouveau`, `envoye`, `ignore`).
    - Ajouter la table `groupesSurveilles` avec toutes les colonnes définies dans le design (id, nomGroupe, urlGroupe unique, cookieSessionChiffre, statut, createdAt, updatedAt).
    - Ajouter la table `leads` avec clé étrangère vers `groupesSurveilles.id` et FK nullable vers `clients.id`.
    - Exporter les types `GroupeSurveilleRow` et `LeadRow` en suivant le pattern existant.
    - _Requirements : 1.1, 1.2, 1.3, 2.1, 2.2_

  - [x] 1.3 Ajouter les types TypeScript dans `src/types/index.ts`
    - Fichiers : `src/types/index.ts` (modifier)
    - Ajouter `StatutLead`, `StatutGroupe`, l'interface `Lead` et l'interface `GroupeSurveille` en fin de fichier.
    - `Lead.clientId` est `string | null`. `Lead.groupeNom` et `Lead.clientNom` sont optionnels (champs de jointure).
    - `GroupeSurveille` n'expose pas `cookieSessionChiffre` (omis de l'interface).
    - _Requirements : 1.3, 2.1_

  - [x] 1.4 Mettre à jour `.env.example` et `.env.local` avec les nouvelles variables
    - Fichiers : `.env.example` (modifier), `.env.local` (modifier)
    - Ajouter les variables `COOKIE_ENCRYPTION_KEY`, `BOT_JWT`, `KIOSQ_API_URL`, `APIFY_TOKEN`, `GEMINI_API_KEY`, `SCORE_SEUIL`.
    - Dans `.env.example`, commenter chaque variable avec sa description et sa valeur par défaut.
    - Ne pas renseigner de vraies valeurs dans `.env.example`.
    - _Requirements : 13.1, 13.4_

- [x] 2. Groupe 2 — Routes API

  - [x] 2.1 Créer `api/groupes-surveilles/index.ts` (GET + POST)
    - Fichiers : `api/groupes-surveilles/index.ts` (créer)
    - Suivre le pattern kiosq : `parseBody`, `handleOptions`, `requireAuth`, réponses via `ok`/`err`.
    - `GET` : retourner tous les groupes ordonnés par `createdAt` décroissant ; omettre `cookieSessionChiffre` sauf si rôle `commercial` ou `admin` (déchiffrer via `decrypt`).
    - `POST` : guard `admin` (403 si rôle différent) ; valider avec `GroupeSchema` (zod) ; vérifier unicité `urlGroupe` (409 si doublon) ; chiffrer `cookieSessionPlaintext` avant persistance ; retourner le groupe créé en 201.
    - Renvoyer 500 si `COOKIE_ENCRYPTION_KEY` est absent lors du chiffrement.
    - _Requirements : 6.1, 6.2, 6.3, 6.7, 6.8, 13.1, 13.2, 13.3, 13.4_

  - [x] 2.2 Créer `api/groupes-surveilles/[id].ts` (PATCH + DELETE)
    - Fichiers : `api/groupes-surveilles/[id].ts` (créer)
    - `PATCH` : guard `admin` ; valider avec sous-ensemble de `GroupeSchema` (tous les champs optionnels) ; re-chiffrer le cookie si fourni ; retourner le groupe mis à jour.
    - `DELETE` : guard `admin` ; vérifier absence de leads liés (409 si trouvés) ; supprimer et retourner 200.
    - _Requirements : 6.4, 6.5, 6.6, 6.7, 13.1_

  - [x] 2.3 Créer `api/leads/index.ts` (GET paginé + POST)
    - Fichiers : `api/leads/index.ts` (créer)
    - `GET` : valider les query params avec `QuerySchema` (zod : page, limit, statut, produit, score_min) ; appliquer les filtres composables (statut exact, produit ilike, score_confiance ≥ score_min) ; pagination via `limit`/`offset` ; ordonner par `createdAt` desc ; retourner `{ leads, total, page, limit }`.
    - `POST` : valider avec `LeadSchema` (groupeSurveilleId, texteOriginal, produitDetecte, scoreConfiance, lienPost) ; créer le lead avec statut `nouveau` ; retourner 201.
    - Erreur 401 si pas de JWT valide ; erreur 422 si body invalide.
    - _Requirements : 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

  - [x] 2.4 Créer `api/leads/[id].ts` (GET détail + PATCH statut)
    - Fichiers : `api/leads/[id].ts` (créer)
    - `GET` : jointure avec `groupesSurveilles` pour récupérer `groupeNom` ; retourner 404 si le lead n'existe pas.
    - `PATCH` : valider `PatchLeadSchema` (statut enum) ; retourner 422 si statut invalide ; mettre à jour `updatedAt` ; retourner le lead mis à jour.
    - _Requirements : 4.1, 4.2, 4.3, 4.4, 4.5_

  - [x] 2.5 Créer `api/leads/[id]/convertir.ts` (POST transaction atomique)
    - Fichiers : `api/leads/[id]/convertir.ts` (créer)
    - Récupérer le lead — 404 si inexistant ; 409 si `clientId` non nul.
    - Dans une transaction Drizzle : créer un `client` (nom = `produitDetecte ?? "Lead #id"`, notes = `texteOriginal`, code auto-généré, typeClient = `entreprise`) ; mettre à jour le lead (`clientId`, `statut = 'envoye'`, `updatedAt`).
    - Retourner le client créé, HTTP 201.
    - _Requirements : 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 3. Checkpoint — Vérification API
  - S'assurer que toutes les routes compilent (TypeScript) et que les patterns d'import sont corrects.
  - Poser des questions si des doutes subsistent sur les contraintes DB.

- [x] 4. Groupe 3 — Tests property-based et unitaires

  - [x] 4.1 Installer fast-check et créer `db/crypto.test.ts`
    - Fichiers : `db/crypto.test.ts` (créer) ; `package.json` (modifier pour ajouter `fast-check` en devDependency)
    - Installer `fast-check` en tant que dépendance de développement.
    - **Propriété 1 : Round-trip du chiffrement symétrique** — pour toute chaîne `plaintext` (y compris vide, unicode, caractères spéciaux), `decrypt(encrypt(plaintext, key), key) === plaintext`.
    - Test unitaire : clé de longueur incorrecte → erreur levée.
    - Test unitaire : ciphertext corrompu (format invalide, authTag modifié) → erreur levée.
    - Utiliser la clé de test `'0'.repeat(64)` dans les tests.
    - _Requirements : 13.1, 13.2 — Propriété 1_

  - [x] 4.2 Créer `api/leads/index.test.ts`
    - Fichiers : `api/leads/index.test.ts` (créer)
    - **Propriété 2 : Invariant de pagination cohérente** — pour tout couple `(page, limit)` valide, `len(results) ≤ limit && total ≥ len(results)`.
    - **Propriété 3 : Filtres composables et corrects** — pour toute combinaison de filtres actifs, chaque lead retourné satisfait simultanément tous les filtres.
    - **Propriété 4 : Round-trip création/lecture** — créer un lead puis le lire retourne les mêmes données avec `statut === 'nouveau'`.
    - Test unitaire : POST sans JWT → 401.
    - Test unitaire : POST avec corps incomplet (texteOriginal absent) → 422.
    - _Requirements : 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8 — Propriétés 2, 3, 4_

  - [x] 4.3 Créer `api/leads/[id]/convertir.test.ts`
    - Fichiers : `api/leads/[id]/convertir.test.ts` (créer)
    - **Propriété 5 : Idempotence de la conversion** — pour tout lead avec `clientId` non nul, `POST /convertir` retourne toujours 409.
    - **Propriété 6 : Invariant de l'état post-conversion** — après conversion réussie, `lead.clientId ≠ null` et `lead.statut === 'envoye'`.
    - Test unitaire : lead inexistant → 404.
    - _Requirements : 5.1, 5.2, 5.3, 5.4 — Propriétés 5, 6_

  - [x] 4.4 Créer `bot/index.test.ts`
    - Fichiers : `bot/index.test.ts` (créer)
    - **Propriété 7 : Seuil de score du bot** — pour tout couple `(score, seuil)` dans `[0, 1]`, le bot crée un lead si et seulement si `score ≥ seuil`.
    - Test unitaire : échec HTTP 401 → arrêt immédiat sans retry.
    - Test unitaire : échec HTTP 500 → une tentative de retry après 5s, puis poursuite.
    - _Requirements : 12.3, 12.4, 11.3, 11.4 — Propriété 7_

- [x] 5. Checkpoint — Tests verts
  - Lancer `npx vitest --run` et s'assurer que tous les tests passent.
  - Corriger les erreurs avant de passer au frontend.

- [x] 6. Groupe 4 — Interface React

  - [x] 6.1 Ajouter `leadsApi` et `groupesApi` dans `src/lib/api.ts`
    - Fichiers : `src/lib/api.ts` (modifier)
    - Implémenter `leadsApi` avec les méthodes : `list(params)`, `getById(id)`, `create(data)`, `updateStatut(id, statut)`, `convertir(id)`.
    - Implémenter `groupesApi` avec les méthodes : `list()`, `create(data)`, `update(id, data)`, `remove(id)`.
    - Construire les query strings avec `URLSearchParams` pour `list`.
    - _Requirements : 3.1, 3.6, 4.3, 5.1, 6.1, 6.2, 6.4, 6.5_

  - [x] 6.2 Créer `src/store/leadsStore.ts` (Zustand store)
    - Fichiers : `src/store/leadsStore.ts` (créer)
    - Implémenter le store complet conforme au design : `leads`, `total`, `page`, `limit`, `filters`, `loading`, `leadsNouveauCount`, `groupes`, `groupesLoading`.
    - Actions : `fetchLeads(newFilters?)`, `setPage(page)`, `updateLeadStatut(id, statut)`, `convertirLead(id)`, `fetchLeadsNouveauCount()`, `fetchGroupes()`, `createGroupe(data)`, `updateGroupe(id, data)`, `deleteGroupe(id)`.
    - `fetchLeadsNouveauCount` appelle `leadsApi.list({ statut: 'nouveau', page: 1, limit: 1 })` et lit `data.total`.
    - _Requirements : 8.1, 8.2, 8.3, 8.4, 8.5, 9.2, 9.3, 10.3, 10.4, 10.5, 14.1_

  - [x] 6.3 Créer les composants atomiques `LeadStatusBadge` et `LeadConvertButton`
    - Fichiers : `src/components/leads/LeadStatusBadge.tsx` (créer), `src/components/leads/LeadConvertButton.tsx` (créer)
    - `LeadStatusBadge` : badge coloré selon statut (nouveau → orange, envoye → vert, ignore → gris) en suivant le style Tailwind + CSS vars du projet.
    - `LeadConvertButton` : bouton désactivé avec tooltip « Lead déjà converti » si `clientId` non nul ; appelle `leadsStore.convertirLead` au clic et notifie via `toast.success` ; affiche `toast.error` en cas d'erreur sans fermer la fiche.
    - _Requirements : 9.3, 9.4, 9.5_

  - [x] 6.4 Créer `LeadsFilters.tsx` et `LeadsTable.tsx`
    - Fichiers : `src/components/leads/LeadsFilters.tsx` (créer), `src/components/leads/LeadsTable.tsx` (créer)
    - `LeadsFilters` : sélecteur de statut, champ de recherche produit (debounce 300ms), slider/input score_min ; appelle `onChange` avec les nouveaux filtres.
    - `LeadsTable` : tableau paginé avec colonnes produitDetecte, scoreConfiance (affiché en %), groupeNom, statut (via `LeadStatusBadge`), createdAt (date formatée) ; handler `onLeadClick`.
    - Afficher un skeleton/spinner si `loading === true`.
    - _Requirements : 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

  - [x] 6.5 Créer `GroupesSurveillésTable.tsx` et `GroupeFormModal.tsx`
    - Fichiers : `src/components/leads/GroupesSurveillésTable.tsx` (créer), `src/components/leads/GroupeFormModal.tsx` (créer)
    - `GroupesSurveillésTable` : colonnes nom, URL, statut, date de création ; boutons « Modifier » et « Supprimer » (avec confirmation) ; handler `onEdit` et `onDelete` ; afficher `toast.error` sur erreur 409.
    - `GroupeFormModal` : formulaire nom (obligatoire), URL (obligatoire), cookie de session (optionnel, type password), statut (select) ; validation côté client avant envoi ; mode création (groupe undefined) et édition (groupe fourni).
    - _Requirements : 10.2, 10.3, 10.4, 10.5, 10.6_

  - [x] 6.6 Créer `src/pages/leads/LeadsPage.tsx` (page principale avec onglets)
    - Fichiers : `src/pages/leads/LeadsPage.tsx` (créer)
    - Onglet « Leads » : monter `LeadsFilters` + `LeadsTable` ; synchroniser les filtres avec le store ; gérer la pagination via `leadsStore.setPage` ; naviguer vers `/leads/:id` au clic sur un lead.
    - Onglet « Groupes surveillés » : visible uniquement si `user.role === 'admin'` ; monter `GroupesSurveillésTable` + bouton « + Ajouter » qui ouvre `GroupeFormModal`.
    - Charger les données au montage via `fetchLeads()` et `fetchGroupes()`.
    - _Requirements : 8.1, 8.5, 10.1, 10.2_

  - [x] 6.7 Créer `src/pages/leads/LeadDetailPage.tsx` (fiche lead)
    - Fichiers : `src/pages/leads/LeadDetailPage.tsx` (créer)
    - Récupérer `leadId` depuis `useParams` ; charger le lead via `leadsApi.getById(id)`.
    - Afficher : texte original, produit détecté, score de confiance, lien post Facebook (lien externe), groupe source, statut (badge + sélecteur), date de création, et — si converti — nom client avec lien vers `/clients/:clientId`.
    - Intégrer `LeadConvertButton`.
    - Appeler `PATCH /api/leads/:id` lors du changement de statut et afficher `toast.success` / `toast.error`.
    - _Requirements : 9.1, 9.2, 9.3, 9.4, 9.5_

  - [x] 6.8 Modifier `src/components/layout/AppLayout.tsx` (nav + badge + polling)
    - Fichiers : `src/components/layout/AppLayout.tsx` (modifier)
    - Ajouter l'import `{ Crosshair }` depuis `lucide-react`.
    - Ajouter l'entrée `{ to: '/leads', label: 'Capture de Leads', icon: Crosshair, roles: ['admin', 'commercial', 'gestionnaire'] }` dans `NAV` (après l'entrée POS, avant Clients).
    - Adapter le typage de `NAV` pour supporter un champ `badge?: string` optionnel.
    - Dans le composant, lire `leadsNouveauCount` depuis `useLeadsStore` et appeler `fetchLeadsNouveauCount` au montage avec polling toutes les 60 secondes (`setInterval` nettoyé dans le `return` du `useEffect`).
    - Rendre le badge orange conditionnellement dans le rendu `NavLink` (visible uniquement si `sidebarOpen && item.badge === 'leadsNouveau' && leadsNouveauCount > 0`).
    - _Requirements : 7.1, 7.2, 7.3, 14.1, 14.2, 14.3, 14.4_

  - [x] 6.9 Modifier `src/App.tsx` (routes /leads et /leads/:id)
    - Fichiers : `src/App.tsx` (modifier)
    - Importer `LeadsPage` et `LeadDetailPage`.
    - Ajouter `<Route path="/leads" element={<LeadsPage />} />` et `<Route path="/leads/:id" element={<LeadDetailPage />} />` dans le bloc `<Route element={<AuthGuard />}>`.
    - _Requirements : 7.4_

- [x] 7. Checkpoint — Interface fonctionnelle
  - S'assurer que le TypeScript compile sans erreur (`npx tsc --noEmit`).
  - Vérifier que la navigation vers `/leads` fonctionne et que le badge apparaît.

- [x] 8. Groupe 5 — Bot de capture

  - [x] 8.1 Créer `bot/kiosqApi.ts` (client HTTP JWT Bearer)
    - Fichiers : `bot/kiosqApi.ts` (créer)
    - Lire `BOT_JWT` et `KIOSQ_API_URL` depuis `process.env`.
    - Exposer les méthodes : `getGroupesActifs()` → appel `GET /api/groupes-surveilles` et filtrer `statut === 'actif'` ; `creerLead(data)` → `POST /api/leads` avec retry 5xx (une tentative après 5s) ; `updateGroupeStatut(id, statut)` → `PATCH /api/groupes-surveilles/:id`.
    - En-tête `Authorization: Bearer <BOT_JWT>` sur chaque requête.
    - Lever une erreur immédiate et logguer sur 401/403, sans retry.
    - _Requirements : 11.1, 11.2, 11.3, 11.4, 11.5, 11.6_

  - [x] 8.2 Créer `bot/apify.ts` (client Apify scraping)
    - Fichiers : `bot/apify.ts` (créer)
    - Lire `APIFY_TOKEN` depuis `process.env`.
    - Exporter `scrapeGroupe(urlGroupe: string, cookieSession?: string): Promise<{ texte: string; lien: string }[]>`.
    - Utiliser l'API REST Apify pour lancer un actor de scraping Facebook et récupérer les résultats.
    - Lever une erreur en cas d'échec pour que la boucle principale puisse la capturer et mettre le groupe en erreur.
    - _Requirements : 12.1_

  - [x] 8.3 Créer `bot/gemini.ts` (classification Gemini avec retry)
    - Fichiers : `bot/gemini.ts` (créer)
    - Lire `GEMINI_API_KEY` depuis `process.env`.
    - Exporter `classifierPost(texte: string): Promise<{ produit: string | null; score: number }>`.
    - Construire un prompt de classification d'intention d'achat et parser la réponse JSON de Gemini.
    - Implémenter un retry exponentiel (max 3 tentatives) sur les erreurs réseau/5xx.
    - _Requirements : 12.2_

  - [x] 8.4 Créer `bot/index.ts` (boucle principale + gestion erreurs)
    - Fichiers : `bot/index.ts` (créer)
    - Implémenter la boucle principale conforme au design : charger les groupes actifs, scraper chaque groupe, classifier chaque post, créer un lead si `score >= SCORE_SEUIL`, gérer les erreurs par groupe (mettre à jour statut à `erreur` et continuer).
    - Lire `SCORE_SEUIL` depuis `process.env` avec valeur par défaut `0.7`.
    - Logger toutes les erreurs avec `[groupe ${id}]` en préfixe.
    - _Requirements : 11.6, 12.1, 12.2, 12.3, 12.4, 12.5_

  - [x] 8.5 Créer `bot/.env.example` et `bot/package.json`
    - Fichiers : `bot/.env.example` (créer), `bot/package.json` (créer)
    - `bot/.env.example` : documenter `BOT_JWT`, `KIOSQ_API_URL`, `APIFY_TOKEN`, `GEMINI_API_KEY`, `SCORE_SEUIL` avec descriptions.
    - `bot/package.json` : configuration minimale avec les dépendances requises (`node-fetch` ou `undici` pour les requêtes HTTP, `dotenv`), scripts `start` et `build`.
    - _Requirements : 11.1, 11.5_

- [x] 9. Checkpoint final — Vérification complète
  - Lancer `npx vitest --run` pour vérifier que tous les tests passent.
  - Lancer `npx tsc --noEmit` pour vérifier l'absence d'erreurs TypeScript.
  - Poser des questions si des comportements restent ambigus.

---

## Notes

- Les tâches marquées `*` sont optionnelles et peuvent être ignorées pour un MVP rapide.
- Les checkpoints sont des points de pause pour valider l'état du code avant de continuer.
- Chaque tâche référence les requirements correspondants pour la traçabilité.
- Les tests de propriétés (fast-check, min 100 itérations) couvrent les invariants universels ; les tests unitaires couvrent les cas limites spécifiques.
- Le bot (`bot/`) est un processus Node.js autonome, distinct de l'application Vercel principale.
- `db/crypto.ts` est utilisé côté API ; le bot peut copier ou ré-exporter ce fichier via `bot/crypto.ts`.

---

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.3", "1.4"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["2.1", "2.2", "2.3"] },
    { "id": 3, "tasks": ["2.4", "2.5"] },
    { "id": 4, "tasks": ["4.1", "6.1"] },
    { "id": 5, "tasks": ["4.2", "4.3", "6.2"] },
    { "id": 6, "tasks": ["4.4", "6.3", "6.4", "6.5"] },
    { "id": 7, "tasks": ["6.6", "6.7", "8.1", "8.2", "8.3"] },
    { "id": 8, "tasks": ["6.8", "6.9", "8.4"] },
    { "id": 9, "tasks": ["8.5"] }
  ]
}
```
