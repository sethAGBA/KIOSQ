import type {
  IncomingMessage,
  LignePanier,
  LigneCommande,
  Session,
  ProduitDisponible,
  CommandePayload,
  ClientKiosq,
  CommandeCreee,
  ParametresTenant,
  NluResult,
  ArticleCommande,
} from './types.js';
import type { SessionStore } from './sessionStore.js';
import { classifierMessage, transcrireEtAnalyserAudio } from './geminiNlu.js';
import { filterCatalogue, chunkCatalogue } from './kiosqWhatsappApi.js';
import { trouverMeilleurProduit, rechercherProduits } from './search.js';
import { trackCommande } from './notificationPoller.js';

export interface KiosqWhatsappApi {
  getProduits: (fetchFn?: typeof fetch) => Promise<ProduitDisponible[]>;
  getClient: (telephone: string, fetchFn?: typeof fetch) => Promise<ClientKiosq | null>;
  createClient: (nom: string, telephone: string, fetchFn?: typeof fetch) => Promise<ClientKiosq>;
  createCommande: (payload: CommandePayload, fetchFn?: typeof fetch) => Promise<CommandeCreee>;
  getCommande: (id: string, fetchFn?: typeof fetch) => Promise<CommandeCreee>;
  getCommandesClient: (clientId: string, limit?: number, fetchFn?: typeof fetch) => Promise<CommandeCreee[]>;
  getParametres: (fetchFn?: typeof fetch) => Promise<ParametresTenant>;
}

// ─── WhatsappClient interface ─────────────────────────────────────────────────

export interface WhatsappClient {
  sendTextMessage: (to: string, body: string) => Promise<void>;
}

// ─── NLU score threshold ──────────────────────────────────────────────────────

const NLU_SCORE_SEUIL = parseFloat(process.env.NLU_SCORE_SEUIL ?? '0.55');

// ─── Message helpers ──────────────────────────────────────────────────────────

function menuPrincipalText(nom: string | null): string {
  const greeting = nom ? `Bonjour ${nom} !` : 'Bonjour !';
  return (
    `${greeting} 👋\n\n` +
    `Comment puis-je vous aider aujourd'hui ?\n\n` +
    `1️⃣  *Voir le catalogue* (ou tapez le nom d'un produit)\n` +
    `2️⃣  *Voir / modifier mon panier*\n` +
    `3️⃣  *Suivre une commande*\n` +
    `4️⃣  *Aide*\n\n` +
    `💡 *Astuce :* Vous pouvez commander directement en écrivant ou en envoyant une *note vocale* (ex: _"Je veux 2 sacs de riz et 3 huiles"_).`
  );
}

function formatPanier(session: Session): string {
  if (session.panier.length === 0) {
    return '🛒 Votre panier est actuellement vide.';
  }
  const { totalHT, totalTTC } = computePanierTotaux(session.panier, session.tvaRate);
  const lignes = session.panier
    .map(
      (l, i) =>
        `${i + 1}. *${l.designation}* × ${l.quantite} = *${l.totalLigne.toFixed(2)} ${session.devise}*`,
    )
    .join('\n');
  return (
    `🛒 *Votre panier :*\n${lignes}\n\n` +
    `Sous-total HT : ${totalHT.toFixed(2)} ${session.devise}\n` +
    `Total TTC (TVA ${session.tvaRate}%) : *${totalTTC.toFixed(2)} ${session.devise}*`
  );
}

function formatProduitChunk(produits: ProduitDisponible[], devise: string, page: number, total: number): string {
  const header = total > 1 ? `📦 *Catalogue Kiosq (page ${page}/${total})* :\n\n` : `📦 *Catalogue Kiosq* :\n\n`;
  const lines = produits.map(
    (p, i) =>
      `${i + 1}. *${p.designation}* — ${p.prixVente.toFixed(2)} ${devise} _(stock: ${p.stockActuel} ${p.unite})_`,
  );
  return header + lines.join('\n');
}

function statutLabel(statut: string): string {
  const labels: Record<string, string> = {
    brouillon: 'En attente',
    confirme: 'Confirmée',
    en_preparation: 'En préparation 👨‍🍳',
    expedie: 'Expédiée / En livraison 🚚',
    livre: 'Livrée avec succès ✅',
    annule: 'Annulée ❌',
  };
  return labels[statut] ?? statut;
}

// ─── Safe sleep ───────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Computes the cart totals from a list of line items and a TVA rate.
 */
export function computePanierTotaux(
  lignes: LignePanier[],
  tvaRate: number,
): { totalHT: number; totalTTC: number } {
  const totalHT = lignes.reduce(
    (sum, ligne) => sum + ligne.prixUnitaire * ligne.quantite,
    0,
  );
  const totalTTC = totalHT * (1 + tvaRate / 100);
  return { totalHT, totalTTC };
}

/**
 * Returns a new session object with the cart cleared and the step reset to
 * MENU_PRINCIPAL after a successful order. Does NOT mutate the input session.
 */
export function clearSessionAfterOrder(session: Session): Session {
  return {
    ...session,
    panier: [],
    adresseLivraison: null,
    step: 'MENU_PRINCIPAL',
  };
}

/**
 * Returns true if and only if the commande belongs to the current session's client.
 */
export function checkCommandeOwnership(
  commande: { clientId: string | null },
  sessionClientId: string | null,
): boolean {
  return commande.clientId === sessionClientId;
}

// ─── handleIncomingMessage — main state machine ───────────────────────────────

export async function handleIncomingMessage(
  message: IncomingMessage,
  sessionStore: SessionStore,
  kiosqApi: KiosqWhatsappApi,
  whatsappClient: WhatsappClient,
): Promise<void> {
  const phone = message.from;
  let text = (message.text?.body ?? '').trim();

  // ── Session expiry check ─────────────────────────────────────────────────
  const existing = sessionStore.get(phone);
  if (existing && sessionStore.isExpired(existing)) {
    sessionStore.delete(phone);
    await whatsappClient.sendTextMessage(
      phone,
      'Votre session a expiré après 30 minutes d\'inactivité. Envoyez un message pour recommencer.',
    );
  }

  // ── Retrieve or initialise session ───────────────────────────────────────
  let session = sessionStore.get(phone);

  if (!session) {
    let tvaRate = 18;
    let devise = 'XOF';
    try {
      const params = await kiosqApi.getParametres();
      tvaRate = parseFloat(params.tva) || 18;
      devise = params.devise || 'XOF';
    } catch {
      // Non-fatal
    }

    session = {
      phone,
      clientId: null,
      clientNom: null,
      step: 'ACCUEIL',
      panier: [],
      tvaRate,
      devise,
      lastActivity: Date.now(),
      pendingNomCapture: false,
      adresseLivraison: null,
    };
    sessionStore.set(phone, session);

    await whatsappClient.sendTextMessage(
      phone,
      `Bienvenue sur le service de commande WhatsApp Kiosq ! 👋🛍️\n\n` +
      `Je suis votre assistant commercial. Vous pouvez passer vos commandes en m'écrivant ou par *message vocal*.\n\n` +
      `Envoyez un message pour commencer.`,
    );

    session.step = 'IDENTIFICATION';
  }

  sessionStore.touch(phone);

  try {
    // ── GESTION DES NOTES VOCALES / AUDIO ─────────────────────────────────
    let nluAudio: NluResult | null = null;
    if (message.type === 'audio' && message.audio?.dataBase64) {
      console.log(`[conversationHandler] Traitement note vocale pour ${phone}...`);
      await whatsappClient.sendTextMessage(phone, '🎙️ _Écoute de votre message vocal en cours..._');

      nluAudio = await transcrireEtAnalyserAudio(
        message.audio.dataBase64,
        message.audio.mimeType,
        { step: session.step, panierSize: session.panier.length, clientNom: session.clientNom },
      );

      if (nluAudio && nluAudio.transcriptionAudio) {
        text = nluAudio.transcriptionAudio;
        await whatsappClient.sendTextMessage(
          phone,
          `📝 *Message compris :*\n_"${nluAudio.transcriptionAudio}"_`,
        );
      }
    }

    // ── GESTION DU PARTAGE DE POSITION GPS / LOCALISATION ─────────────────
    if (message.type === 'location' && message.location) {
      const { latitude, longitude, address, name } = message.location;
      const desc = address || name || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
      session.adresseLivraison = `Position GPS (${desc})`;
      sessionStore.set(phone, session);

      await whatsappClient.sendTextMessage(
        phone,
        `📍 Position de livraison enregistrée : *${session.adresseLivraison}*`,
      );

      if (session.panier.length > 0) {
        session.step = 'CONFIRMATION';
        return handleConfirmation(phone, session, sessionStore, kiosqApi, whatsappClient);
      } else {
        session.step = 'MENU_PRINCIPAL';
        await whatsappClient.sendTextMessage(phone, menuPrincipalText(session.clientNom));
        return;
      }
    }

    // ── IDENTIFICATION ───────────────────────────────────────────────────
    if (session.step === 'IDENTIFICATION') {
      if (session.pendingNomCapture) {
        const nom = extraireNom(text);
        if (!nom) {
          await whatsappClient.sendTextMessage(
            phone,
            'Je n\'ai pas bien saisi votre nom. Pouvez-vous simplement écrire votre prénom et nom ? (ex: *Seth AGBA*)',
          );
          return;
        }
        try {
          const newClient = await kiosqApi.createClient(nom, phone);
          session.clientId = newClient.id;
          session.clientNom = newClient.nom;
        } catch (err) {
          console.error('[conversationHandler] createClient failed:', err);
          session.clientNom = nom;
        }
        session.pendingNomCapture = false;
        session.step = 'MENU_PRINCIPAL';
        await whatsappClient.sendTextMessage(phone, menuPrincipalText(session.clientNom));
        return;
      }

      let client = null;
      try {
        client = await kiosqApi.getClient(phone);
      } catch (err) {
        console.error('[conversationHandler] getClient failed:', err);
      }

      if (client) {
        session.clientId = client.id;
        session.clientNom = client.nom;
        session.step = 'MENU_PRINCIPAL';
        await whatsappClient.sendTextMessage(phone, menuPrincipalText(session.clientNom));
      } else {
        session.pendingNomCapture = true;
        await whatsappClient.sendTextMessage(
          phone,
          'Bienvenue chez Kiosq ! Pour commencer, quel est votre nom et prénom ?',
        );
      }
      return;
    }

    // ── Helper NLU ────────────────────────────────────────────────────────
    const classifyInput = async (input: string): Promise<NluResult> => {
      if (nluAudio) return nluAudio;
      try {
        return await classifierMessage(input, {
          step: session!.step,
          panierSize: session!.panier.length,
          clientNom: session!.clientNom,
        });
      } catch {
        return { intent: 'INCONNU', score: 0 };
      }
    };

    // ── COMMANDE DIRECTE OU ARTICLES DÉTECTÉS PAR GEMINI ──────────────────
    // Détection NLU précoce : si le message contient des articles à commander
    const nluEarly = await classifyInput(text);

    if (
      nluEarly.score >= NLU_SCORE_SEUIL &&
      nluEarly.articles &&
      nluEarly.articles.length > 0 &&
      (nluEarly.intent === 'COMMANDE_DIRECTE' || nluEarly.intent === 'AJOUTER_PRODUIT')
    ) {
      return handleMultiArticles(phone, session, nluEarly.articles, sessionStore, kiosqApi, whatsappClient);
    }

    // ── RETRAIT OU MODIFICATION D'ARTICLE DANS LE PANIER ─────────────────
    if (
      nluEarly.score >= NLU_SCORE_SEUIL &&
      nluEarly.intent === 'SUPPRIMER_ARTICLE' &&
      nluEarly.produit
    ) {
      return handleSuppressionArticle(phone, session, nluEarly.produit, sessionStore, whatsappClient);
    }

    // ── QUESTION SUR UN PRODUIT / PRIX / STOCK ────────────────────────────
    if (nluEarly.score >= NLU_SCORE_SEUIL && nluEarly.intent === 'QUESTION_PRODUIT' && nluEarly.produit) {
      return handleQuestionProduit(phone, session, nluEarly.produit, kiosqApi, whatsappClient);
    }

    // ── COMMANDE PAR NUMÉRO DU CATALOGUE DANS CATALOGUE / MENU ────────────
    const cachedCat = (session as Session & { _catalogue?: ProduitDisponible[] })._catalogue;
    if (cachedCat && cachedCat.length > 0) {
      const selection = parseSelectionProduit(text);
      if (selection && selection.index <= cachedCat.length) {
        const produit = cachedCat[selection.index - 1]!;
        await addOuRemplacerProduit(phone, session, produit, selection.quantite, whatsappClient);
        sessionStore.set(phone, session);
        await whatsappClient.sendTextMessage(phone, formatPanier(session));
        await whatsappClient.sendTextMessage(
          phone,
          '💡 Pour valider : répondez *confirmer*\n' +
          'Pour ajouter d\'autres articles : donnez leur nom ou numéro\n' +
          'Pour vider le panier : répondez *annuler*',
        );
        return;
      }
    }

    // ── GESTION DES COMMANDES PAR ÉTAPE ───────────────────────────────────

    // ── MENU_PRINCIPAL ───────────────────────────────────────────────────
    if (session.step === 'MENU_PRINCIPAL') {
      const clean = text.toLowerCase().trim();

      if (clean === '1' || clean === 'catalogue') {
        session.step = 'CATALOGUE';
        return handleCatalogue(phone, session, sessionStore, kiosqApi, whatsappClient, null);
      }
      if (clean === '2' || clean === 'panier') {
        session.step = 'PANIER';
        await whatsappClient.sendTextMessage(phone, formatPanier(session));
        if (session.panier.length > 0) {
          await whatsappClient.sendTextMessage(
            phone,
            'Options :\n• *confirmer* — valider votre commande\n• *catalogue* — ajouter des produits\n• *supprimer [nom]* — enlever un article\n• *annuler* — vider le panier',
          );
        } else {
          await whatsappClient.sendTextMessage(phone, 'Répondez *catalogue* pour parcourir les produits disponibles.');
        }
        return;
      }
      if (clean === '3' || clean === 'suivi') {
        session.step = 'SUIVI';
        await whatsappClient.sendTextMessage(
          phone,
          '📦 Quel est le numéro de votre commande ? (ex: *CMD-2025-001* ou tapez *mes commandes*)',
        );
        return;
      }
      if (clean === '4' || clean === 'aide') {
        await whatsappClient.sendTextMessage(
          phone,
          `ℹ️ *Aide Kiosq :*\n\n` +
          `• Écrivez ce que vous voulez (ex: _"Je veux 2 cartons de savon"_) ou envoyez une note vocale.\n` +
          `• Tapez *1* pour le catalogue complet.\n` +
          `• Tapez *panier* pour revoir vos articles.\n` +
          `• Tapez *suivi* pour vérifier l'avancement d'une livraison.\n` +
          `• Tapez *menu* à tout moment pour revenir ici.`,
        );
        return;
      }

      if (nluEarly.score >= NLU_SCORE_SEUIL) {
        switch (nluEarly.intent) {
          case 'PARCOURIR_CATALOGUE':
            session.step = 'CATALOGUE';
            return handleCatalogue(phone, session, sessionStore, kiosqApi, whatsappClient, null);
          case 'AJOUTER_PRODUIT':
            session.step = 'CATALOGUE';
            return handleCatalogue(phone, session, sessionStore, kiosqApi, whatsappClient, nluEarly.produit ?? null);
          case 'CONFIRMER_COMMANDE':
            if (session.panier.length > 0) {
              return passerALivraisonOuConfirmation(phone, session, sessionStore, kiosqApi, whatsappClient);
            }
            await whatsappClient.sendTextMessage(phone, 'Votre panier est vide. Choisissez d\'abord des produits.');
            return;
          case 'VOIR_STATUT':
            session.step = 'SUIVI';
            if (nluEarly.numeroCommande) {
              return handleSuiviCommande(phone, nluEarly.numeroCommande, session, kiosqApi, whatsappClient);
            }
            await whatsappClient.sendTextMessage(
              phone,
              'Quel est le numéro de votre commande ? (ex: *CMD-2025-001*)',
            );
            return;
          case 'MODIFIER_PANIER':
            session.step = 'PANIER';
            await whatsappClient.sendTextMessage(phone, formatPanier(session));
            return;
          case 'ANNULER':
            session.panier = [];
            await whatsappClient.sendTextMessage(phone, 'Panier vidé. ' + menuPrincipalText(session.clientNom));
            return;
          case 'SALUTATION':
            await whatsappClient.sendTextMessage(
              phone,
              nluEarly.reponseSuggeree || menuPrincipalText(session.clientNom),
            );
            return;
        }
      }

      // Si le texte est un mot de recherche libre de produit (ex: "riz", "savon")
      if (text.length >= 3 && !/^\d+$/.test(text)) {
        return handleCatalogue(phone, session, sessionStore, kiosqApi, whatsappClient, text);
      }

      await whatsappClient.sendTextMessage(phone, menuPrincipalText(session.clientNom));
      return;
    }

    // ── CATALOGUE ────────────────────────────────────────────────────────
    if (session.step === 'CATALOGUE') {
      const lower = text.toLowerCase().trim();

      if (lower === 'menu' || lower === 'retour') {
        session.step = 'MENU_PRINCIPAL';
        await whatsappClient.sendTextMessage(phone, menuPrincipalText(session.clientNom));
        return;
      }
      if (lower === 'panier') {
        session.step = 'PANIER';
        await whatsappClient.sendTextMessage(phone, formatPanier(session));
        return;
      }
      if (lower === 'confirmer' || lower === 'valider') {
        if (session.panier.length > 0) {
          return passerALivraisonOuConfirmation(phone, session, sessionStore, kiosqApi, whatsappClient);
        }
        await whatsappClient.sendTextMessage(phone, 'Votre panier est vide.');
        return;
      }
      if (lower === 'annuler') {
        session.step = 'MENU_PRINCIPAL';
        await whatsappClient.sendTextMessage(phone, menuPrincipalText(session.clientNom));
        return;
      }

      // Recherche libre dans le catalogue
      return handleCatalogue(phone, session, sessionStore, kiosqApi, whatsappClient, text);
    }

    // ── PANIER ───────────────────────────────────────────────────────────
    if (session.step === 'PANIER') {
      const lower = text.toLowerCase().trim();

      if (lower === 'confirmer' || lower === 'valider' || lower === 'oui') {
        if (session.panier.length === 0) {
          await whatsappClient.sendTextMessage(phone, 'Votre panier est vide. Ajoutez des produits.');
          return;
        }
        return passerALivraisonOuConfirmation(phone, session, sessionStore, kiosqApi, whatsappClient);
      }

      if (lower === 'annuler' || lower === 'vider') {
        session.panier = [];
        session.step = 'MENU_PRINCIPAL';
        await whatsappClient.sendTextMessage(phone, 'Panier vidé. ' + menuPrincipalText(session.clientNom));
        return;
      }

      if (lower.startsWith('supprimer ') || lower.startsWith('enlever ') || lower.startsWith('retirer ')) {
        const query = text.replace(/^(supprimer|enlever|retirer)\s+/i, '').trim();
        return handleSuppressionArticle(phone, session, query, sessionStore, whatsappClient);
      }

      if (lower === 'catalogue' || lower === 'voir catalogue') {
        session.step = 'CATALOGUE';
        return handleCatalogue(phone, session, sessionStore, kiosqApi, whatsappClient, null);
      }

      if (lower === 'menu' || lower === 'retour') {
        session.step = 'MENU_PRINCIPAL';
        await whatsappClient.sendTextMessage(phone, menuPrincipalText(session.clientNom));
        return;
      }

      await whatsappClient.sendTextMessage(phone, formatPanier(session));
      await whatsappClient.sendTextMessage(
        phone,
        'Options :\n• *confirmer* — valider la commande\n• *supprimer [article]* — retirer un produit\n• *catalogue* — ajouter d\'autres produits\n• *annuler* — vider le panier',
      );
      return;
    }

    // ── LIVRAISON (NOUVELLE ÉTAPE : COLLECTE DE L'ADRESSE) ─────────────────
    if (session.step === 'LIVRAISON') {
      const lower = text.toLowerCase().trim();

      if (lower === 'annuler') {
        session.step = 'PANIER';
        await whatsappClient.sendTextMessage(phone, formatPanier(session));
        return;
      }

      if (text.length >= 3) {
        session.adresseLivraison = text;
        sessionStore.set(phone, session);
        session.step = 'CONFIRMATION';
        return handleConfirmation(phone, session, sessionStore, kiosqApi, whatsappClient);
      }

      await whatsappClient.sendTextMessage(
        phone,
        '📍 Merci de préciser votre quartier ou lieu de livraison (ex: *Hedzranawoe face pharmacie*, ou tapez *retrait magasin*).',
      );
      return;
    }

    // ── CONFIRMATION ─────────────────────────────────────────────────────
    if (session.step === 'CONFIRMATION') {
      const lower = text.toLowerCase().trim();
      if (lower === 'oui' || lower === 'confirmer' || lower === 'ok' || lower === 'valider') {
        return executerCommande(phone, session, sessionStore, kiosqApi, whatsappClient);
      }
      if (lower === 'non' || lower === 'annuler') {
        session.step = 'PANIER';
        await whatsappClient.sendTextMessage(phone, 'Commande non validée. ' + formatPanier(session));
        return;
      }
      if (lower.startsWith('adresse') || lower.startsWith('livraison')) {
        session.step = 'LIVRAISON';
        await whatsappClient.sendTextMessage(phone, '📍 Veuillez saisir votre nouvelle adresse de livraison :');
        return;
      }
      return handleConfirmation(phone, session, sessionStore, kiosqApi, whatsappClient);
    }

    // ── SUIVI ────────────────────────────────────────────────────────────
    if (session.step === 'SUIVI') {
      const lower = text.toLowerCase().trim();

      if (lower === 'menu' || lower === 'retour') {
        session.step = 'MENU_PRINCIPAL';
        await whatsappClient.sendTextMessage(phone, menuPrincipalText(session.clientNom));
        return;
      }

      if (lower === 'mes commandes' || lower === 'liste') {
        return handleSuiviListe(phone, session, kiosqApi, whatsappClient);
      }

      return handleSuiviCommande(phone, text, session, kiosqApi, whatsappClient);
    }

  } catch (err) {
    console.error('[conversationHandler] Erreur inattendue:', err);
    await whatsappClient.sendTextMessage(
      phone,
      'Je rencontre un problème temporaire. Veuillez réessayer dans quelques instants.',
    ).catch(() => undefined);
  }
}

// ─── Sub-handlers intelligents ───────────────────────────────────────────────

/**
 * Traite plusieurs articles détectés par le NLU (commande en une phrase ou message vocal).
 */
async function handleMultiArticles(
  phone: string,
  session: Session,
  articles: ArticleCommande[],
  sessionStore: SessionStore,
  kiosqApi: KiosqWhatsappApi,
  whatsappClient: WhatsappClient,
): Promise<void> {
  let all: ProduitDisponible[] = [];
  try {
    all = await kiosqApi.getProduits();
  } catch {
    await whatsappClient.sendTextMessage(phone, 'Impossible d\'accéder aux produits pour le moment.');
    return;
  }

  const dispo = filterCatalogue(all);
  const ajoutes: string[] = [];
  const nonTrouves: string[] = [];

  for (const item of articles) {
    if (item.action === 'supprimer') {
      const idx = session.panier.findIndex(l =>
        l.designation.toLowerCase().includes(item.produit.toLowerCase())
      );
      if (idx >= 0) {
        const removed = session.panier.splice(idx, 1)[0]!;
        ajoutes.push(`❌ Retiré : *${removed.designation}*`);
      }
      continue;
    }

    const match = trouverMeilleurProduit(item.produit, dispo, 0.5);
    if (match) {
      const ok = await addOuRemplacerProduit(phone, session, match.produit, item.quantite, whatsappClient, false);
      if (ok) {
        ajoutes.push(`✅ *${match.produit.designation}* × ${item.quantite}`);
      }
    } else {
      const suggestions = rechercherProduits(item.produit, dispo, 2, 0.35);
      if (suggestions.length > 0) {
        const alt = suggestions.map(s => `*${s.produit.designation}*`).join(' ou ');
        nonTrouves.push(`"${item.produit}" (Vouliez-vous dire : ${alt} ?)`);
      } else {
        nonTrouves.push(`"${item.produit}"`);
      }
    }
  }

  sessionStore.set(phone, session);

  let messageRecap = '';
  if (ajoutes.length > 0) {
    messageRecap += `🛒 *Mise à jour de votre panier :*\n${ajoutes.join('\n')}\n\n`;
  }
  if (nonTrouves.length > 0) {
    messageRecap += `⚠️ Articles non trouvés dans le stock : ${nonTrouves.join(', ')}\n\n`;
  }

  messageRecap += formatPanier(session);
  await whatsappClient.sendTextMessage(phone, messageRecap);

  await whatsappClient.sendTextMessage(
    phone,
    `💡 *Que souhaitez-vous faire ?*\n` +
    `• Répondez *confirmer* pour valider la commande\n` +
    `• Ajoutez d'autres articles\n` +
    `• Répondez *annuler* pour vider le panier`,
  );

  session.step = 'PANIER';
  sessionStore.set(phone, session);
}

/**
 * Supprime un article spécifique du panier.
 */
async function handleSuppressionArticle(
  phone: string,
  session: Session,
  query: string,
  sessionStore: SessionStore,
  whatsappClient: WhatsappClient,
): Promise<void> {
  if (session.panier.length === 0) {
    await whatsappClient.sendTextMessage(phone, 'Votre panier est déjà vide.');
    return;
  }

  // Si c'est un numéro d'index (ex: "1", "2")
  const num = parseInt(query, 10);
  if (!isNaN(num) && num >= 1 && num <= session.panier.length) {
    const supprime = session.panier.splice(num - 1, 1)[0]!;
    sessionStore.set(phone, session);
    await whatsappClient.sendTextMessage(phone, `🗑️ *${supprime.designation}* a été retiré de votre panier.`);
    await whatsappClient.sendTextMessage(phone, formatPanier(session));
    return;
  }

  // Recherche par nom de produit dans le panier
  const lower = query.toLowerCase();
  const idx = session.panier.findIndex(l => l.designation.toLowerCase().includes(lower));
  if (idx >= 0) {
    const supprime = session.panier.splice(idx, 1)[0]!;
    sessionStore.set(phone, session);
    await whatsappClient.sendTextMessage(phone, `🗑️ *${supprime.designation}* a été retiré de votre panier.`);
    await whatsappClient.sendTextMessage(phone, formatPanier(session));
    return;
  }

  await whatsappClient.sendTextMessage(
    phone,
    `Je n'ai pas trouvé "${query}" dans votre panier.\n` + formatPanier(session),
  );
}

/**
 * Répond à une question sur la disponibilité et le prix d'un produit.
 */
async function handleQuestionProduit(
  phone: string,
  session: Session,
  query: string,
  kiosqApi: KiosqWhatsappApi,
  whatsappClient: WhatsappClient,
): Promise<void> {
  let all: ProduitDisponible[] = [];
  try {
    all = await kiosqApi.getProduits();
  } catch {
    await whatsappClient.sendTextMessage(phone, 'Impossible de vérifier le stock actuellement.');
    return;
  }

  const dispo = filterCatalogue(all);
  const match = trouverMeilleurProduit(query, dispo, 0.45);

  if (match) {
    const p = match.produit;
    await whatsappClient.sendTextMessage(
      phone,
      `🔎 *${p.designation}*\n` +
      `💰 Prix : *${p.prixVente.toFixed(2)} ${session.devise}*\n` +
      `📦 Stock disponible : *${p.stockActuel} ${p.unite}*\n\n` +
      `Pour commander, dites par exemple : _"Je prends 2 ${p.designation}"_ !`,
    );
  } else {
    await whatsappClient.sendTextMessage(
      phone,
      `Désolé, nous n'avons pas "${query}" en stock actuellement.\n` +
      `Tapez *catalogue* pour consulter nos articles disponibles.`,
    );
  }
}

/**
 * Vérifie si l'adresse de livraison est requise avant d'afficher la confirmation.
 */
async function passerALivraisonOuConfirmation(
  phone: string,
  session: Session,
  sessionStore: SessionStore,
  kiosqApi: KiosqWhatsappApi,
  whatsappClient: WhatsappClient,
): Promise<void> {
  if (!session.adresseLivraison) {
    session.step = 'LIVRAISON';
    sessionStore.set(phone, session);
    await whatsappClient.sendTextMessage(
      phone,
      `📍 *Adresse de livraison :*\n\n` +
      `Où souhaitez-vous être livré ?\n` +
      `_(Indiquez votre quartier, repère, ou partagez votre position WhatsApp. Tapez *retrait magasin* si vous venez sur place)._`,
    );
    return;
  }

  session.step = 'CONFIRMATION';
  sessionStore.set(phone, session);
  return handleConfirmation(phone, session, sessionStore, kiosqApi, whatsappClient);
}

/**
 * Handle CATALOGUE step: fetch, filter, chunk and display products.
 */
async function handleCatalogue(
  phone: string,
  session: Session,
  sessionStore: SessionStore,
  kiosqApi: KiosqWhatsappApi,
  whatsappClient: WhatsappClient,
  searchQuery: string | null,
): Promise<void> {
  let all: ProduitDisponible[] = [];
  try {
    all = await kiosqApi.getProduits();
  } catch (err) {
    console.error('[conversationHandler] getProduits failed:', err);
    await whatsappClient.sendTextMessage(
      phone,
      'Je ne peux pas accéder au catalogue en ce moment. Veuillez réessayer dans quelques instants.',
    );
    return;
  }

  const disponibles = filterCatalogue(all);

  if (disponibles.length === 0) {
    await whatsappClient.sendTextMessage(phone, 'Aucun produit n\'est disponible actuellement.');
    session.step = 'MENU_PRINCIPAL';
    return;
  }

  // Recherche avec le matcher flou
  if (searchQuery) {
    const match = trouverMeilleurProduit(searchQuery, disponibles, 0.5);
    if (match) {
      await addOuRemplacerProduit(phone, session, match.produit, 1, whatsappClient);
      sessionStore.set(phone, session);
      await whatsappClient.sendTextMessage(phone, formatPanier(session));
      await whatsappClient.sendTextMessage(
        phone,
        'Options :\n• *confirmer* — valider la commande\n• *catalogue* — continuer les achats\n• *annuler* — vider le panier',
      );
      session.step = 'PANIER';
      return;
    } else {
      const suggestions = rechercherProduits(searchQuery, disponibles, 5, 0.35);
      if (suggestions.length > 0) {
        const lignes = suggestions.map((s, i) =>
          `${i + 1}. *${s.produit.designation}* — ${s.produit.prixVente.toFixed(2)} ${session.devise}`
        ).join('\n');
        await whatsappClient.sendTextMessage(
          phone,
          `Articles correspondant à "${searchQuery}" :\n\n${lignes}\n\n` +
          `Pour commander : indiquez la quantité (ex: *1 x2*)`,
        );
        (session as Session & { _catalogue?: ProduitDisponible[] })._catalogue = suggestions.map(s => s.produit);
        sessionStore.set(phone, session);
        session.step = 'CATALOGUE';
        return;
      }
    }
  }

  // Affichage en lots de 10
  const chunks = chunkCatalogue(disponibles, 10);
  for (let i = 0; i < chunks.length; i++) {
    await whatsappClient.sendTextMessage(
      phone,
      formatProduitChunk(chunks[i]!, session.devise, i + 1, chunks.length),
    );
  }

  await whatsappClient.sendTextMessage(
    phone,
    'Pour ajouter un produit, répondez avec son numéro et la quantité (ex: *1 2kg* ou *3 x5*).\n' +
    'Ou écrivez simplement ce que vous désirez (ex: _"2 sacs de riz"_).\n' +
    'Tapez *menu* pour revenir au menu principal.',
  );

  session.step = 'CATALOGUE';
  (session as Session & { _catalogue?: ProduitDisponible[] })._catalogue = disponibles;
  sessionStore.set(phone, session);
}

function extraireNom(input: string): string {
  const text = input.trim();
  const patterns = [
    /je\s+suis\s+(.+)/i,
    /je\s+m['']?appelle\s+(.+)/i,
    /mon\s+nom\s+(?:est|c['']?est)\s+(.+)/i,
    /(?:tu\s+peux\s+(?:m['']?appeler|dire)|appelez?\s+moi|call\s+me)\s+(.+)/i,
    /c['']?est\s+(.+)/i,
    /nom\s*[:]\s*(.+)/i,
    /^(?:moi\s+c['']?est|c['']?est\s+moi)\s+(.+)/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return titreCase(match[1].trim());
    }
  }
  const mots = text.split(/\s+/);
  const motsFonction = /^(je|tu|il|elle|nous|vous|ils|elles|mon|ma|mes|le|la|les|un|une|des|est|sont|suis|peux|peut|veux|veut|fais|fait)$/i;
  const estNomDirect = mots.length <= 3 && !mots.some(m => motsFonction.test(m));
  if (estNomDirect) {
    return titreCase(text);
  }
  return '';
}

function titreCase(s: string): string {
  return s.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

function parseSelectionProduit(input: string): { index: number; quantite: number } | null {
  const clean = input.trim().replace(/[xX×*]/g, ' ').replace(/\s+/g, ' ');
  const parts = clean.split(' ');
  const idx = parseInt(parts[0] ?? '', 10);
  if (isNaN(idx) || idx < 1) return null;
  const rawQty = parts[1] ? parts[1].replace(/[^\d.]/g, '') : '1';
  const qty = Math.round(parseFloat(rawQty));
  return { index: idx, quantite: isNaN(qty) || qty < 1 ? 1 : qty };
}

async function addOuRemplacerProduit(
  phone: string,
  session: Session,
  produit: ProduitDisponible,
  quantite: number,
  whatsappClient: WhatsappClient,
  notifier = true,
): Promise<boolean> {
  if (quantite > produit.stockActuel) {
    await whatsappClient.sendTextMessage(
      phone,
      `Stock insuffisant pour *${produit.designation}*. Stock actuel : ${produit.stockActuel} ${produit.unite}.`,
    );
    return false;
  }

  const existing = session.panier.find((l) => l.produitId === produit.id);
  if (existing) {
    existing.quantite = quantite;
    existing.totalLigne = existing.prixUnitaire * quantite;
    if (notifier) {
      await whatsappClient.sendTextMessage(
        phone,
        `Quantité de *${produit.designation}* mise à jour : ${quantite} ${produit.unite}.`,
      );
    }
  } else {
    session.panier.push({
      produitId: produit.id,
      designation: produit.designation,
      prixUnitaire: produit.prixVente,
      quantite,
      totalLigne: produit.prixVente * quantite,
    });
    if (notifier) {
      await whatsappClient.sendTextMessage(
        phone,
        `✅ *${produit.designation}* × ${quantite} ajouté au panier.`,
      );
    }
  }
  return true;
}

/**
 * Demande la confirmation finale avant création de la commande.
 */
async function handleConfirmation(
  phone: string,
  session: Session,
  sessionStore: SessionStore,
  kiosqApi: KiosqWhatsappApi,
  whatsappClient: WhatsappClient,
): Promise<void> {
  if (session.panier.length === 0) {
    session.step = 'MENU_PRINCIPAL';
    await whatsappClient.sendTextMessage(phone, 'Votre panier est vide. ' + menuPrincipalText(session.clientNom));
    return;
  }

  const adresse = session.adresseLivraison || 'Non spécifiée';

  await whatsappClient.sendTextMessage(
    phone,
    `📋 *RÉCAPITULATIF DE VOTRE COMMANDE*\n\n` +
    `${formatPanier(session)}\n\n` +
    `📍 *Livraison :* ${adresse}\n\n` +
    `Souhaitez-vous valider cette commande ?\n` +
    `• Répondez *oui* pour confirmer\n` +
    `• Répondez *adresse* pour modifier le lieu de livraison\n` +
    `• Répondez *non* pour modifier les articles`,
  );
}

/**
 * Exécute la création de commande dans l'API Kiosq et active le suivi en temps réel.
 */
async function executerCommande(
  phone: string,
  session: Session,
  sessionStore: SessionStore,
  kiosqApi: KiosqWhatsappApi,
  whatsappClient: WhatsappClient,
): Promise<void> {
  const { totalHT, totalTTC } = computePanierTotaux(session.panier, session.tvaRate);

  const lignes: LigneCommande[] = session.panier.map((l) => ({
    produitId:    l.produitId,
    produitRef:   '',
    produitNom:   l.designation,
    quantite:     l.quantite,
    prixUnitaire: l.prixUnitaire,
    remise:       0,
    total:        l.totalLigne,
  }));

  const noteLivraison = session.adresseLivraison ? ` | Livraison: ${session.adresseLivraison}` : '';

  const payload: CommandePayload = {
    ...(session.clientId !== null && { clientId: session.clientId }),
    lignes,
    totalHT,
    tva: session.tvaRate,
    totalTTC,
    notes: `Commande WhatsApp${noteLivraison}`,
  };

  let commande;
  try {
    commande = await kiosqApi.createCommande(payload);
  } catch (err) {
    const is5xx = err instanceof Error && /HTTP 5\d\d/.test(err.message);
    if (is5xx) {
      await sleep(5000);
      try {
        commande = await kiosqApi.createCommande(payload);
      } catch (retryErr) {
        console.error('[conversationHandler] createCommande retry failed:', retryErr);
        session.step = 'PANIER';
        await whatsappClient.sendTextMessage(
          phone,
          'Je rencontre un problème temporaire. Veuillez réessayer dans quelques instants.',
        );
        return;
      }
    } else {
      console.error('[conversationHandler] createCommande failed:', err);
      session.step = 'PANIER';
      await whatsappClient.sendTextMessage(
        phone,
        'Votre commande n\'a pas pu être enregistrée. Vérifiez les produits sélectionnés et réessayez.',
      );
      return;
    }
  }

  // Activer le tracking automatique pour notifications en temps réel !
  trackCommande(commande.id, phone);
  console.log(`[conversationHandler] Commande ${commande.numero} (${commande.id}) enregistrée pour notifications à ${phone}`);

  // Vider le panier
  const updated = clearSessionAfterOrder(session);
  session.panier = updated.panier;
  session.step = updated.step;
  session.adresseLivraison = null;
  sessionStore.set(phone, session);

  await whatsappClient.sendTextMessage(
    phone,
    `🎉 *COMMANDE ENREGISTRÉE AVEC SUCCÈS !*\n\n` +
    `Numéro de commande : *${commande.numero}*\n` +
    `Total TTC : *${commande.totalTTC.toFixed(2)} ${session.devise}*\n` +
    `Statut : *${statutLabel(commande.statut)}*\n\n` +
    `🔔 *Notification automatique :* Vous recevrez un message WhatsApp dès que votre commande passera en préparation et en livraison !\n\n` +
    `Merci pour votre fidélité ! 🙏`,
  );

  await whatsappClient.sendTextMessage(phone, menuPrincipalText(session.clientNom));
}

/**
 * Handle SUIVI step: look up a specific order by number/id.
 */
async function handleSuiviCommande(
  phone: string,
  input: string,
  session: Session,
  kiosqApi: KiosqWhatsappApi,
  whatsappClient: WhatsappClient,
): Promise<void> {
  let commande;
  try {
    commande = await kiosqApi.getCommande(input.trim());
  } catch (err) {
    console.error('[conversationHandler] getCommande failed:', err);
    await whatsappClient.sendTextMessage(
      phone,
      'Je ne trouve pas cette commande. Vérifiez le numéro (ex: *CMD-2025-001*) et réessayez.\n' +
      'Tapez *menu* pour revenir au menu principal.',
    );
    return;
  }

  const statut = statutLabel(commande.statut);
  await whatsappClient.sendTextMessage(
    phone,
    `📦 *Commande ${commande.numero}*\n\n` +
    `Statut actuel : *${statut}*\n` +
    `Total TTC : *${commande.totalTTC.toFixed(2)} ${session.devise}*\n` +
    `Date : ${new Date(commande.dateCommande).toLocaleDateString('fr-FR')}\n\n` +
    `Tapez *mes commandes* pour voir vos commandes récentes, ou *menu* pour revenir à l'accueil.`,
  );

  session.step = 'MENU_PRINCIPAL';
}

/**
 * Handle SUIVI list: show recent orders for the current client.
 */
async function handleSuiviListe(
  phone: string,
  session: Session,
  kiosqApi: KiosqWhatsappApi,
  whatsappClient: WhatsappClient,
): Promise<void> {
  if (!session.clientId) {
    await whatsappClient.sendTextMessage(
      phone,
      'Je ne peux pas retrouver vos commandes sans profil client associé.',
    );
    session.step = 'MENU_PRINCIPAL';
    return;
  }

  let commandes: CommandeCreee[] = [];
  try {
    commandes = await kiosqApi.getCommandesClient(session.clientId, 5);
  } catch (err) {
    console.error('[conversationHandler] getCommandesClient failed:', err);
    await whatsappClient.sendTextMessage(
      phone,
      'Je rencontre un problème temporaire. Veuillez réessayer dans quelques instants.',
    );
    return;
  }

  if (commandes.length === 0) {
    await whatsappClient.sendTextMessage(phone, 'Vous n\'avez pas encore de commandes enregistrées chez Kiosq.');
  } else {
    const lines = commandes.map(
      (c) =>
        `• *${c.numero}* — ${statutLabel(c.statut)} — *${c.totalTTC.toFixed(2)} ${session.devise}*`,
    );
    await whatsappClient.sendTextMessage(
      phone,
      `📋 *Vos dernières commandes :*\n\n${lines.join('\n')}\n\n` +
      `Tapez le numéro d'une commande pour plus de détails, ou *menu* pour le menu principal.`,
    );
  }

  session.step = 'SUIVI';
}
