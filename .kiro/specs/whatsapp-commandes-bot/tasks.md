# Plan d'implémentation — WhatsApp Commandes Bot

## Vue d'ensemble

Implémentation d'un service Node.js autonome dans `bot/whatsapp/` permettant aux clients de passer des commandes, consulter le catalogue et suivre leurs commandes directement via WhatsApp. Le service s'appuie sur les modules existants dans `bot/` (gemini.ts, kiosqApi.ts, loadEnv.ts) et utilise l'API WhatsApp Business Cloud, l'API Kiosq et Google Gemini.

Le design ne contient pas de pseudocode — il utilise TypeScript. Toutes les tâches sont donc en TypeScript.

## Tâches

- [x] 1. Mise en place de la structure et des types de base
  - Créer le dossier `bot/whatsapp/` et y créer les interfaces TypeScript partagées (SessionStep, LignePanier, Session, WhatsAppWebhookPayload, IncomingMessage, MessageStatus, IntentName, NluResult, ProduitDisponible, ClientKiosq, CommandeCreee, ParametresTenant, LigneCommande, CommandePayload) dans un fichier `types.ts`
  - Créer `bot/whatsapp/.env.example` documentant toutes les variables d'environnement requises et optionnelles du design
  - _Requirements: 10.1, 10.4_

- [x] 2. Validation d'environnement et chargement
  - [x] 2.1 Implémenter `bot/whatsapp/validateEnv.ts`
    - Exporter `validateWhatsappEnv()` qui vérifie la présence de `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`, `BOT_JWT`, `KIOSQ_API_URL`, `GEMINI_API_KEY`
    - En cas de variable manquante, afficher chaque variable manquante et appeler `process.exit(1)`
    - _Requirements: 10.1, 10.2_

  - [x] 2.2 Écrire le test de propriété pour `validateWhatsappEnv`
    - **Property 10 : Validation d'environnement — rapport des variables manquantes**
    - **Valide : Requirements 10.1, 10.2**
    - Utiliser `fc.subarray()` des 7 variables requises pour générer tous les sous-ensembles non-vides de variables manquantes
    - Vérifier que le message d'erreur capturé contient le nom de chaque variable manquante (`numRuns: 100`)
    - Fichier : `bot/whatsapp/validateEnv.property.test.ts`

- [x] 3. Sécurité — HMAC et rate limiting
  - [x] 3.1 Implémenter `bot/whatsapp/security.ts`
    - Exporter `validateHmacSignature(rawBody: Buffer, appSecret: string, signatureHeader: string): boolean` avec `timingSafeEqual` (node:crypto)
    - Exporter `RateLimiter` (token bucket : 60 messages/minute par numéro WhatsApp)
    - _Requirements: 9.3, 9.5_

  - [x] 3.2 Écrire le test de propriété pour `validateHmacSignature`
    - **Property 8 : Validation HMAC-SHA256 — accept/reject symétrique**
    - **Valide : Requirements 9.3**
    - Utiliser `fc.uint8Array()` et `fc.string()` pour body et secret ; vérifier accept sur HMAC calculé, reject sur signature modifiée
    - Ajouter tests unitaires : signature vide → false, format sans `sha256=` → false
    - Fichier : `bot/whatsapp/security.property.test.ts`

- [x] 4. Store de sessions
  - [x] 4.1 Implémenter `bot/whatsapp/sessionStore.ts`
    - Exporter `SessionStore` avec `get()`, `set()`, `touch()`, `delete()`, `isExpired()`, `sweep()` (TTL 30 min, sweep toutes les 5 min)
    - _Requirements: 4.6, 2.4_

- [x] 5. Client WhatsApp (envoi de messages)
  - [x] 5.1 Implémenter `bot/whatsapp/whatsappClient.ts`
    - Exporter `WhatsappClient` avec `sendTextMessage(to: string, body: string): Promise<void>` et `sendListMessage(to: string, header: string, sections: Section[]): Promise<void>`
    - Appeler `POST https://graph.facebook.com/v20.0/{WHATSAPP_PHONE_NUMBER_ID}/messages` avec `Bearer {WHATSAPP_TOKEN}`
    - _Requirements: 1.1, 1.2_

- [x] 6. Client API Kiosq spécifique WhatsApp
  - [x] 6.1 Implémenter `bot/whatsapp/kiosqWhatsappApi.ts`
    - Wraper `kiosqRequest()` depuis `../kiosqApi` pour exporter : `getProduits()`, `getClient(telephone)`, `createClient(nom, telephone)`, `createCommande(payload)`, `getCommande(id)`, `getCommandesClient(clientId, limit)`, `getParametres()`
    - Exporter les fonctions pures `filterCatalogue(produits, categorieId?)` et `chunkCatalogue(produits, size = 10)`
    - _Requirements: 2.1, 2.3, 3.1, 3.3, 5.1, 6.1, 6.3_

  - [x] 6.2 Écrire les tests de propriétés pour le filtrage et la pagination catalogue
    - **Property 3 : Filtrage catalogue — tous les produits retournés sont éligibles**
    - **Valide : Requirements 3.1, 3.3**
    - Utiliser `fc.array(fc.record({ actif: fc.boolean(), stockActuel: fc.integer({ min: 0, max: 100 }), categorieId: fc.option(fc.string()) }))` ; vérifier `actif === true && stockActuel > 0` et filtre categorieId
    - **Property 4 : Pagination catalogue — max 10 produits par message**
    - **Valide : Requirements 3.2**
    - Utiliser `fc.array(fc.anything(), { maxLength: 500 })` ; vérifier `lot.length <= 10` et `lots.flat().length === input.length`
    - Fichier : `bot/whatsapp/kiosqWhatsappApi.property.test.ts`

- [x] 7. NLU — classifieur d'intentions WhatsApp
  - [x] 7.1 Implémenter `bot/whatsapp/geminiNlu.ts`
    - Exporter `classifierMessage(message, sessionContext, fetchFn?)` qui appelle l'API Gemini avec le prompt NLU du design et retourne `NluResult` (intent, score, produit, quantite)
    - Retourner `{ intent: 'INCONNU', score: 0 }` si Gemini est indisponible (fallback)
    - _Requirements: 7.1, 7.2, 7.3, 7.5, 7.6_

- [x] 8. Gestionnaire de conversation — machine d'états
  - [x] 8.1 Implémenter les fonctions pures métier dans `bot/whatsapp/conversationHandler.ts`
    - Exporter `computePanierTotaux(lignes, tvaRate)` retournant `{ totalHT, totalTTC }`
    - Exporter `clearSessionAfterOrder(session)` retournant une session avec `panier = []` et `step = 'MENU_PRINCIPAL'`
    - Exporter `checkCommandeOwnership(commande, sessionClientId)` retournant `commande.clientId === sessionClientId`
    - _Requirements: 4.1, 4.2, 5.1, 5.3, 5.6, 6.1, 6.4_

  - [x] 8.2 Écrire les tests de propriétés pour les fonctions pures du panier et de la session
    - **Property 5 : Invariant du panier — cohérence des totaux**
    - **Valide : Requirements 4.1, 4.2, 5.1, 5.6**
    - Utiliser `fc.array(fc.record({ prixUnitaire: fc.float({ min: 0.01, max: 999999, noNaN: true }), quantite: fc.integer({ min: 1, max: 1000 }) }))` et `fc.float({ min: 0, max: 100, noNaN: true })`
    - **Property 6 : Session effacée après confirmation de commande**
    - **Valide : Requirements 5.3**
    - Utiliser un générateur de sessions avec panier non vide ; vérifier `panier.length === 0` et `step === 'MENU_PRINCIPAL'`
    - **Property 7 : Isolation commande — ownership check**
    - **Valide : Requirements 6.1, 6.4**
    - Utiliser `fc.string()` pour `commande.clientId` et `sessionClientId` ; vérifier biconditionnelle exacte
    - Fichier : `bot/whatsapp/conversationHandler.property.test.ts`

  - [x] 8.3 Implémenter `handleIncomingMessage()` dans `bot/whatsapp/conversationHandler.ts`
    - Implémenter la machine d'états complète : ACCUEIL → IDENTIFICATION → MENU_PRINCIPAL → CATALOGUE / PANIER / SUIVI → CONFIRMATION
    - Intégrer `geminiNlu.classifierMessage()` avec fallback menu numéroté si `score < 0.6` ou Gemini indisponible
    - Gérer l'expiration de session (30 min), la création de client si inconnu, la vérification de stock, le retry 5xx sur création commande
    - _Requirements: 1.2, 2.1, 2.2, 2.3, 2.5, 3.1, 3.4, 3.5, 4.1, 4.3, 4.4, 4.5, 4.6, 5.1, 5.2, 5.3, 5.4, 5.5, 6.1, 6.2, 6.3, 6.4, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 9.2, 9.4_

- [x] 9. Checkpoint — Vérifier les fonctions pures et la machine d'états
  - S'assurer que tous les tests passent (`vitest --run` dans `bot/whatsapp/`), demander à l'utilisateur si des questions se posent.

- [x] 10. Webhook — réception et routage
  - [x] 10.1 Implémenter `bot/whatsapp/webhook.ts`
    - Exporter `handleVerification(query)` : retourner `hub.challenge` si `hub.verify_token` correspond, sinon 403
    - Exporter `handleWebhookPost(rawBody, signature, sessionStore, kiosqApi, whatsappClient)` : valider HMAC → rate limit → dispatcher les messages entrants vers `handleIncomingMessage()`
    - Répondre toujours HTTP 200 après réception (même en cas d'erreur interne), logger les erreurs
    - _Requirements: 1.1, 1.3, 1.4, 1.5, 9.3, 9.5_

  - [x] 10.2 Écrire les tests de propriétés pour le webhook
    - **Property 1 : Vérification hub.challenge — round-trip**
    - **Valide : Requirements 1.3**
    - Utiliser `fc.string()` pour `hub.challenge` ; vérifier que `handleVerification` retourne exactement la valeur (`numRuns: 100`)
    - **Property 2 : Robustesse aux payloads malformés**
    - **Valide : Requirements 1.4**
    - Utiliser `fc.anything()` et `fc.uint8Array()` ; vérifier que `handleWebhookPost` ne lève jamais d'exception et retourne `{ status: 200 }`
    - Ajouter tests unitaires : POST avec signature valide → traitement ; POST sans signature → HTTP 403
    - Fichier : `bot/whatsapp/webhook.property.test.ts`

- [x] 11. Poller de notifications de statut
  - [x] 11.1 Implémenter `bot/whatsapp/notificationPoller.ts`
    - Exporter `isTransitionNotifiable(ancien, nouveau)` qui retourne `true` uniquement pour les 4 transitions éligibles du design
    - Exporter `pollCommandeStatuts(sessionStore, kiosqApi, whatsappClient)` : polling toutes les 60s, Map en mémoire `<commandeId, statut>`, retry notification après 60s en cas d'échec
    - _Requirements: 8.1, 8.2, 8.3, 8.5_

  - [x] 11.2 Écrire le test de propriété pour les transitions notifiables
    - **Property 9 : Filtrage des transitions de statut notifiables**
    - **Valide : Requirements 8.3**
    - Utiliser `fc.constantFrom(...statutCommandeValues)` pour générer des paires `(ancien, nouveau)` et vérifier l'exactitude de la biconditionnelle
    - Ajouter tests unitaires : polling détecte changement → notification envoyée ; transition non éligible → pas de notification
    - Fichier : `bot/whatsapp/notificationPoller.property.test.ts`

- [x] 12. Serveur HTTP et point d'entrée principal
  - [x] 12.1 Implémenter `bot/whatsapp/server.ts`
    - Serveur HTTP Node.js natif sur port `WHATSAPP_BOT_PORT` (défaut 3002)
    - Routes : `GET /health` → `{ "status": "ok" }` ; `GET /webhook` → `handleVerification()` ; `POST /webhook` → `handleWebhookPost()`
    - Passer le `rawBody` (Buffer) avant parsing JSON pour la validation HMAC
    - _Requirements: 10.3, 1.3, 1.1_

  - [x] 12.2 Implémenter `bot/whatsapp/index.ts`
    - Exporter `main()` : `loadEnv()` → `validateWhatsappEnv()` → instancier `SessionStore`, `RateLimiter`, `WhatsappClient`, `KiosqWhatsappApi` → démarrer le serveur → démarrer `pollCommandeStatuts()` toutes les 60s
    - _Requirements: 10.2, 10.4_

- [x] 13. Checkpoint final — Tous les tests passent
  - Exécuter `vitest --run` dans `bot/whatsapp/` et vérifier que toutes les propriétés (P1–P10) et les tests unitaires sont au vert. Demander à l'utilisateur si des questions se posent.

## Notes

- Les tâches marquées `*` sont optionnelles et peuvent être sautées pour un MVP rapide
- Chaque tâche référence les exigences spécifiques pour la traçabilité
- Les tests de propriétés utilisent `fast-check` v4.9.0 (déjà installé dans `bot/package.json`) avec `numRuns: 100` minimum
- Les fonctions pures (`computePanierTotaux`, `filterCatalogue`, `chunkCatalogue`, `clearSessionAfterOrder`, `checkCommandeOwnership`, `isTransitionNotifiable`, `handleVerification`) sont extraites pour permettre les tests de propriétés sans mock réseau
- Le bot répond toujours HTTP 200 à WhatsApp Cloud API (même en erreur interne) pour éviter les retries automatiques de Meta
- Toute la config est injectée via variables d'environnement — jamais de valeurs hardcodées

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1", "3.1", "4.1"] },
    { "id": 2, "tasks": ["2.2", "3.2", "5.1"] },
    { "id": 3, "tasks": ["6.1"] },
    { "id": 4, "tasks": ["6.2", "7.1"] },
    { "id": 5, "tasks": ["8.1"] },
    { "id": 6, "tasks": ["8.2", "8.3"] },
    { "id": 7, "tasks": ["10.1", "11.1"] },
    { "id": 8, "tasks": ["10.2", "11.2", "12.1"] },
    { "id": 9, "tasks": ["12.2"] }
  ]
}
```
