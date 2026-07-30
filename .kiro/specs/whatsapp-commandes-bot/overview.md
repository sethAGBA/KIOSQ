# WhatsApp Commandes Bot — Vue fonctionnelle

Ce document décrit concrètement ce que fait le bot WhatsApp de commandes pour les clients d'une boutique Kiosq.

---

## Scénario 1 — Passer une commande

1. Le client envoie **"Bonjour"** sur WhatsApp au numéro de la boutique.
2. Le bot répond instantanément avec un message de bienvenue et les options disponibles.
3. **Identification automatique** :
   - Si le numéro est connu → le bot appelle le client par son nom.
   - Si c'est un nouveau client → le bot demande son nom et crée sa fiche dans Kiosq automatiquement.
4. Le client tape *"je veux voir les produits"* ou *"2"* (menu numéroté) — Gemini comprend l'intention.
5. Le bot affiche le catalogue (produits actifs, en stock) par groupes de 10, avec prix et stock disponible.
6. Le client dit *"je prends 3 kg de riz et 2 huiles"* — Gemini extrait les produits et quantités.
7. Le bot affiche le récapitulatif du panier avec le total TTC.
8. Le client confirme → le bot crée la commande dans Kiosq avec statut `brouillon`.
9. Le client reçoit :

   > *Commande CMD-2025-042 enregistrée — Total : 4 500 XOF ✓*

---

## Scénario 2 — Suivre une commande

Le client envoie :

> *"où en est ma commande CMD-2025-042"*

Le bot répond avec le statut actuel en français, la date de commande et la date de livraison prévue si renseignée. Il peut aussi afficher les 5 dernières commandes du client sur demande.

---

## Scénario 3 — Notifications automatiques

Quand le gérant fait évoluer le statut d'une commande dans l'interface Kiosq, le client reçoit automatiquement un message WhatsApp :

| Transition de statut | Message envoyé |
|---|---|
| `brouillon` → `confirmé` | *"Votre commande CMD-2025-042 a été confirmée."* |
| `confirmé` → `en préparation` | *"Votre commande CMD-2025-042 est en cours de préparation."* |
| `en préparation` → `expédié` | *"Votre commande CMD-2025-042 a été expédiée."* |
| `expédié` → `livré` | *"Votre commande CMD-2025-042 a été livrée."* |

> Les notifications peuvent être désactivées par tenant dans la configuration.

---

## Ce que le bot ne fait pas

- Pas de paiement en ligne
- Pas d'accès aux données d'autres boutiques (isolation par JWT)
- Pas de support des messages vocaux, images ou documents (texte uniquement)

---

## Ce qui tourne en arrière-plan

- Un **serveur Node.js** sur le port 3002 dans `bot/whatsapp/`
- Un **poller** toutes les 60 secondes qui détecte les changements de statut et déclenche les notifications
- Des **sessions en mémoire** avec expiration après 30 minutes d'inactivité (le panier est perdu à l'expiration)
- Une **validation HMAC-SHA256** sur chaque message entrant (sécurité Meta)
- Un **rate limiter** à 60 messages/minute par numéro pour prévenir les abus
