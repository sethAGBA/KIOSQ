# Requirements Document

## Introduction

Ce document décrit les exigences du chatbot WhatsApp de gestion de commandes pour l'application Kiosq. Le bot permet aux clients de passer des commandes directement via WhatsApp, de consulter le catalogue produits, de suivre l'état de leurs commandes et de recevoir des confirmations — le tout sans passer par l'interface web. Le bot s'intègre à l'API Kiosq existante et utilise le service Gemini pour la compréhension du langage naturel.

## Glossaire

- **WhatsApp_Bot** : Le service de chatbot hébergé dans `bot/` qui interagit avec les clients via l'API WhatsApp Business.
- **WhatsApp_API** : L'API officielle Meta WhatsApp Business (Webhook + Cloud API) pour recevoir et envoyer des messages.
- **Kiosq_API** : L'API REST existante de l'application Kiosq (`/api/...`) qui gère produits, clients, commandes, etc.
- **Session** : L'état conversationnel d'un client identifié par son numéro de téléphone WhatsApp, conservé en mémoire ou en base pendant la durée du flux de commande.
- **Flux_Commande** : La séquence d'étapes guidant un client depuis la découverte du catalogue jusqu'à la confirmation de sa commande.
- **NLU** : Natural Language Understanding — la capacité à interpréter les messages texte libres des clients via Gemini.
- **Tenant** : Une boutique/kiosque utilisant la plateforme Kiosq. Chaque tenant possède son propre catalogue, ses clients, ses commandes.
- **Client_WhatsApp** : Un utilisateur final qui interagit avec le bot via son numéro de téléphone WhatsApp.
- **Panier** : L'ensemble des lignes produits sélectionnées par un Client_WhatsApp avant confirmation de la commande.
- **Webhook** : Le point d'entrée HTTPS exposé par le WhatsApp_Bot pour recevoir les événements entrants de WhatsApp_API.

---

## Requirements

### Requirement 1 : Réception et routage des messages WhatsApp

**User Story :** En tant que Client_WhatsApp, je veux pouvoir envoyer un message au numéro WhatsApp de ma boutique et recevoir une réponse immédiate, afin de savoir que le bot est actif et prêt à traiter ma demande.

#### Acceptance Criteria

1. WHEN WhatsApp_API envoie un événement POST sur le Webhook, THE WhatsApp_Bot SHALL répondre avec un HTTP 200 dans un délai de 5 secondes.
2. WHEN un message entrant est reçu depuis un numéro inconnu, THE WhatsApp_Bot SHALL envoyer un message de bienvenue décrivant les fonctionnalités disponibles (catalogue, passer une commande, suivre une commande).
3. WHEN WhatsApp_API envoie un événement de vérification (`hub.challenge`), THE WhatsApp_Bot SHALL retourner la valeur `hub.challenge` avec un HTTP 200.
4. IF le corps de la requête entrante est malformé ou ne correspond pas au format attendu de WhatsApp_API, THEN THE WhatsApp_Bot SHALL retourner un HTTP 200 sans traitement et enregistrer un log d'erreur.
5. THE WhatsApp_Bot SHALL traiter les messages de type texte, image et document de manière à répondre au minimum aux messages texte.

---

### Requirement 2 : Identification et association du client

**User Story :** En tant que gérant de kiosque, je veux que le bot identifie automatiquement les clients existants par leur numéro de téléphone, afin que les commandes WhatsApp soient liées aux bons profils clients dans Kiosq.

#### Acceptance Criteria

1. WHEN un Client_WhatsApp envoie un message, THE WhatsApp_Bot SHALL rechercher dans Kiosq_API un client dont le champ `telephone` correspond au numéro WhatsApp de l'expéditeur.
2. WHEN un client existant est trouvé dans Kiosq_API, THE WhatsApp_Bot SHALL adresser le client par son nom dans les réponses et associer la commande à son `clientId`.
3. WHEN aucun client existant n'est trouvé, THE WhatsApp_Bot SHALL demander le nom du Client_WhatsApp et créer un nouveau profil client dans Kiosq_API via `POST /api/clients`.
4. THE WhatsApp_Bot SHALL conserver en Session l'identifiant du client (`clientId`) pour toute la durée du Flux_Commande.
5. IF la création d'un nouveau client dans Kiosq_API échoue, THEN THE WhatsApp_Bot SHALL continuer le Flux_Commande avec un `clientId` null et enregistrer un log d'erreur.

---

### Requirement 3 : Affichage du catalogue produits

**User Story :** En tant que Client_WhatsApp, je veux pouvoir consulter la liste des produits disponibles avec leurs prix, afin de choisir ce que je souhaite commander.

#### Acceptance Criteria

1. WHEN un Client_WhatsApp demande à voir le catalogue (par mot-clé ou menu), THE WhatsApp_Bot SHALL récupérer via Kiosq_API (`GET /api/produits`) les produits du Tenant dont le champ `actif` est `true` et dont `stockActuel > 0`.
2. WHEN le catalogue est récupéré, THE WhatsApp_Bot SHALL présenter les produits en groupes de 10 au maximum par message, avec pour chaque produit : la désignation, le prix de vente (en devise du Tenant), et le stock disponible.
3. WHEN un Client_WhatsApp demande une catégorie spécifique, THE WhatsApp_Bot SHALL filtrer les produits par `categorieId` correspondant à la catégorie demandée.
4. WHEN Kiosq_API retourne une liste vide de produits disponibles, THE WhatsApp_Bot SHALL informer le Client_WhatsApp qu'aucun produit n'est disponible actuellement.
5. IF Kiosq_API retourne une erreur lors de la récupération du catalogue, THEN THE WhatsApp_Bot SHALL notifier le Client_WhatsApp d'une indisponibilité temporaire et proposer de réessayer.

---

### Requirement 4 : Gestion du panier

**User Story :** En tant que Client_WhatsApp, je veux pouvoir ajouter plusieurs produits à un panier avant de confirmer ma commande, afin de composer ma commande librement avant de la valider.

#### Acceptance Criteria

1. WHEN un Client_WhatsApp sélectionne un produit et une quantité, THE WhatsApp_Bot SHALL ajouter la ligne produit (désignation, prix unitaire, quantité, total ligne) à la Session du Panier.
2. WHEN un produit est ajouté au Panier, THE WhatsApp_Bot SHALL confirmer l'ajout au Client_WhatsApp en affichant le récapitulatif du Panier mis à jour (lignes, sous-total HT, total TTC).
3. WHEN un Client_WhatsApp demande à modifier ou supprimer une ligne du Panier, THE WhatsApp_Bot SHALL mettre à jour la Session en conséquence et afficher le Panier mis à jour.
4. WHILE le Panier est non vide, THE WhatsApp_Bot SHALL proposer les options : ajouter un produit, modifier le panier, confirmer la commande, ou annuler.
5. WHEN un Client_WhatsApp demande une quantité supérieure au `stockActuel` d'un produit, THE WhatsApp_Bot SHALL informer le Client_WhatsApp du stock disponible et proposer d'ajuster la quantité.
6. IF la Session expire (inactivité supérieure à 30 minutes), THEN THE WhatsApp_Bot SHALL effacer le Panier et notifier le Client_WhatsApp que la session a expiré.

---

### Requirement 5 : Confirmation et création de la commande

**User Story :** En tant que Client_WhatsApp, je veux confirmer ma commande et recevoir un numéro de commande, afin de savoir que ma demande a bien été enregistrée dans le système.

#### Acceptance Criteria

1. WHEN un Client_WhatsApp confirme la commande, THE WhatsApp_Bot SHALL créer la commande dans Kiosq_API via `POST /api/commandes` avec le `clientId` résolu, les lignes du Panier, les totaux calculés (HT, TVA, TTC), et le statut `brouillon`.
2. WHEN la commande est créée avec succès dans Kiosq_API, THE WhatsApp_Bot SHALL envoyer au Client_WhatsApp un message de confirmation contenant le numéro de commande (ex. `CMD-2025-001`) et le total TTC.
3. WHEN la commande est créée avec succès, THE WhatsApp_Bot SHALL effacer la Session de Panier du Client_WhatsApp.
4. IF la création de la commande dans Kiosq_API échoue avec une erreur 4xx, THEN THE WhatsApp_Bot SHALL informer le Client_WhatsApp que la commande n'a pas pu être enregistrée et lui proposer de recommencer.
5. IF la création de la commande dans Kiosq_API échoue avec une erreur 5xx, THEN THE WhatsApp_Bot SHALL réessayer une fois après 5 secondes avant d'informer le Client_WhatsApp d'une erreur temporaire.
6. THE WhatsApp_Bot SHALL calculer le `totalTTC` en appliquant le taux de TVA par défaut du Tenant (champ `tva` de la table `parametres`).

---

### Requirement 6 : Suivi de commande

**User Story :** En tant que Client_WhatsApp, je veux pouvoir consulter l'état de ma commande en donnant mon numéro de commande, afin de savoir où en est ma livraison.

#### Acceptance Criteria

1. WHEN un Client_WhatsApp fournit un numéro de commande valide, THE WhatsApp_Bot SHALL récupérer la commande correspondante via Kiosq_API (`GET /api/commandes/{id}`) et vérifier que le `clientId` correspond au Client_WhatsApp.
2. WHEN la commande est trouvée, THE WhatsApp_Bot SHALL afficher le numéro de commande, le statut actuel (libellé lisible en français), le total TTC, la date de commande, et la date de livraison prévue si renseignée.
3. WHEN un Client_WhatsApp demande la liste de ses dernières commandes, THE WhatsApp_Bot SHALL afficher les 5 commandes les plus récentes avec leur numéro, statut et total TTC.
4. IF le numéro de commande fourni n'existe pas ou n'appartient pas au Client_WhatsApp, THEN THE WhatsApp_Bot SHALL informer le Client_WhatsApp que la commande est introuvable et proposer de vérifier le numéro.

---

### Requirement 7 : Compréhension du langage naturel (NLU)

**User Story :** En tant que Client_WhatsApp, je veux pouvoir envoyer des messages en langage naturel (ex. « je veux commander 2 kg de riz ») sans avoir à utiliser de commandes exactes, afin d'avoir une expérience de commande fluide et naturelle.

#### Acceptance Criteria

1. WHEN un Client_WhatsApp envoie un message en texte libre, THE WhatsApp_Bot SHALL transmettre le message à Gemini_API pour identifier l'intention (parcourir catalogue, ajouter produit, confirmer commande, voir statut, annuler, aide).
2. WHEN Gemini_API retourne une intention reconnue avec un score de confiance supérieur ou égal à 0.6, THE WhatsApp_Bot SHALL exécuter l'action correspondant à l'intention détectée.
3. WHEN Gemini_API retourne une intention non reconnue ou avec un score de confiance inférieur à 0.6, THE WhatsApp_Bot SHALL afficher un menu d'aide avec les options disponibles.
4. WHEN Gemini_API retourne un produit identifié dans un message de commande, THE WhatsApp_Bot SHALL rechercher ce produit dans le catalogue du Tenant par correspondance de désignation ou référence.
5. IF Gemini_API retourne une erreur ou est indisponible, THEN THE WhatsApp_Bot SHALL basculer vers un menu interactif à choix numérotés sans interrompre l'expérience utilisateur.
6. THE WhatsApp_Bot SHALL inclure dans chaque requête à Gemini_API le contexte de la Session courante (étape du flux, contenu du Panier) pour améliorer la pertinence des réponses.

---

### Requirement 8 : Notifications de changement de statut

**User Story :** En tant que Client_WhatsApp, je veux recevoir une notification sur WhatsApp quand le statut de ma commande change (ex. confirmée, expédiée, livrée), afin d'être informé de l'avancement sans avoir à interroger le bot.

#### Acceptance Criteria

1. WHEN le statut d'une commande est mis à jour dans Kiosq_API (`PATCH /api/commandes/{id}`), THE WhatsApp_Bot SHALL recevoir ou détecter le changement de statut via un mécanisme de webhook ou de polling.
2. WHEN un changement de statut est détecté pour une commande associée à un Client_WhatsApp, THE WhatsApp_Bot SHALL envoyer un message de notification au numéro WhatsApp du client avec le nouveau statut et le numéro de commande.
3. THE WhatsApp_Bot SHALL envoyer des notifications uniquement pour les transitions de statut suivantes : `brouillon → confirme`, `confirme → en_preparation`, `en_preparation → expedie`, `expedie → livre`.
4. WHERE le Tenant a désactivé les notifications WhatsApp dans sa configuration, THE WhatsApp_Bot SHALL ne pas envoyer de notifications automatiques pour ce Tenant.
5. IF l'envoi d'une notification échoue, THEN THE WhatsApp_Bot SHALL réessayer une fois après 60 secondes et enregistrer le résultat dans les logs.

---

### Requirement 9 : Sécurité et isolation multi-tenant

**User Story :** En tant que gérant de kiosque, je veux que le bot n'accède qu'aux données de mon propre Tenant, afin de garantir la confidentialité et l'isolation des données entre boutiques.

#### Acceptance Criteria

1. THE WhatsApp_Bot SHALL s'authentifier auprès de Kiosq_API en utilisant exclusivement le `BOT_JWT` configuré dans les variables d'environnement, lequel est associé à un Tenant spécifique.
2. WHEN le `BOT_JWT` est expiré ou invalide, THE WhatsApp_Bot SHALL arrêter le traitement des messages entrants, enregistrer un log d'erreur critique, et renvoyer un message d'erreur générique au Client_WhatsApp.
3. THE WhatsApp_Bot SHALL valider la signature HMAC-SHA256 de chaque requête entrante de WhatsApp_API en utilisant le `WHATSAPP_APP_SECRET` configuré, et rejeter toute requête dont la signature est invalide avec un HTTP 403.
4. THE WhatsApp_Bot SHALL ne jamais exposer d'informations internes (JWT, clés API, détails de base de données) dans les messages envoyés aux clients WhatsApp.
5. THE WhatsApp_Bot SHALL limiter le nombre de messages entrants traités à 60 messages par minute par numéro WhatsApp de Client_WhatsApp pour prévenir les abus.

---

### Requirement 10 : Configuration et déploiement

**User Story :** En tant que développeur, je veux pouvoir configurer et déployer le bot WhatsApp via des variables d'environnement, afin de l'intégrer facilement dans l'infrastructure existante du projet Kiosq.

#### Acceptance Criteria

1. THE WhatsApp_Bot SHALL lire sa configuration exclusivement depuis des variables d'environnement : `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET`, `BOT_JWT`, `KIOSQ_API_URL`, `GEMINI_API_KEY`.
2. WHEN une variable d'environnement requise est absente au démarrage, THE WhatsApp_Bot SHALL terminer le processus avec un code d'erreur non nul et afficher le nom de la variable manquante.
3. THE WhatsApp_Bot SHALL exposer un point de santé (`GET /health`) retournant `{ "status": "ok" }` avec un HTTP 200 lorsque le service est opérationnel.
4. THE WhatsApp_Bot SHALL être déployable en tant que service Node.js autonome dans le dossier `bot/` du projet, en parallèle du bot de leads existant.
5. WHERE le bot est déployé en environnement de développement, THE WhatsApp_Bot SHALL accepter une variable `WHATSAPP_VERIFY_TOKEN` pour la vérification du Webhook sans HTTPS.
