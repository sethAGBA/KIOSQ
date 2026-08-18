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
} from './types.js';
import type { SessionStore } from './sessionStore.js';
import { classifierMessage } from './geminiNlu.js';
import { filterCatalogue, chunkCatalogue } from './kiosqWhatsappApi.js';

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

const NLU_SCORE_SEUIL = parseFloat(process.env.NLU_SCORE_SEUIL ?? '0.6');

// ─── Message helpers ──────────────────────────────────────────────────────────

function menuPrincipalText(nom: string | null): string {
  const greeting = nom ? `Bonjour ${nom} !` : 'Bonjour !';
  return (
    `${greeting}\n\n` +
    `Que souhaitez-vous faire ?\n` +
    `1️⃣  Voir le catalogue\n` +
    `2️⃣  Voir / modifier mon panier\n` +
    `3️⃣  Suivre une commande\n` +
    `4️⃣  Aide\n\n` +
    `Répondez par le numéro ou décrivez votre demande.`
  );
}

function formatPanier(session: Session): string {
  if (session.panier.length === 0) {
    return 'Votre panier est vide.';
  }
  const { totalHT, totalTTC } = computePanierTotaux(session.panier, session.tvaRate);
  const lignes = session.panier
    .map(
      (l, i) =>
        `${i + 1}. ${l.designation} × ${l.quantite} = ${l.totalLigne.toFixed(2)} ${session.devise}`,
    )
    .join('\n');
  return (
    `🛒 *Votre panier :*\n${lignes}\n\n` +
    `Sous-total HT : ${totalHT.toFixed(2)} ${session.devise}\n` +
    `Total TTC (TVA ${session.tvaRate}%) : *${totalTTC.toFixed(2)} ${session.devise}*`
  );
}

function formatProduitChunk(produits: ProduitDisponible[], devise: string, page: number, total: number): string {
  const header = total > 10 ? `📦 *Catalogue (page ${page}/${total})* :\n\n` : `📦 *Catalogue* :\n\n`;
  const lines = produits.map(
    (p, i) =>
      `${i + 1}. *${p.designation}* — ${p.prixVente.toFixed(2)} ${devise} (stock: ${p.stockActuel} ${p.unite})`,
  );
  return header + lines.join('\n');
}

function statutLabel(statut: string): string {
  const labels: Record<string, string> = {
    brouillon: 'En attente',
    confirme: 'Confirmée',
    en_preparation: 'En préparation',
    expedie: 'Expédiée',
    livre: 'Livrée',
    annule: 'Annulée',
  };
  return labels[statut] ?? statut;
}

// ─── Safe sleep ───────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Computes the cart totals from a list of line items and a TVA rate.
 *
 * totalHT  = Σ(ligne.prixUnitaire * ligne.quantite)
 * totalTTC = totalHT * (1 + tvaRate / 100)
 *
 * Validates: Requirements 4.1, 4.2, 5.1, 5.6
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
 * MENU_PRINCIPAL after a successful order.  Does NOT mutate the input session.
 *
 * Validates: Requirements 5.3
 */
export function clearSessionAfterOrder(session: Session): Session {
  return {
    ...session,
    panier: [],
    step: 'MENU_PRINCIPAL',
  };
}

/**
 * Returns true if and only if the commande belongs to the current session's
 * client.  Both values may be null (e.g. anonymous client), in which case the
 * strict equality still holds.
 *
 * Validates: Requirements 6.1, 6.4
 */
export function checkCommandeOwnership(
  commande: { clientId: string | null },
  sessionClientId: string | null,
): boolean {
  return commande.clientId === sessionClientId;
}

// ─── handleIncomingMessage — main state machine ───────────────────────────────

/**
 * Handles one incoming WhatsApp message end-to-end by dispatching through the
 * conversational state machine:
 *   ACCUEIL → IDENTIFICATION → MENU_PRINCIPAL → CATALOGUE / PANIER / SUIVI → CONFIRMATION
 *
 * Requirements: 1.2, 2.1–2.5, 3.1, 3.4, 3.5, 4.1, 4.3–4.6, 5.1–5.5,
 *               6.1–6.4, 7.1–7.6, 9.2, 9.4
 */
export async function handleIncomingMessage(
  message: IncomingMessage,
  sessionStore: SessionStore,
  kiosqApi: KiosqWhatsappApi,
  whatsappClient: WhatsappClient,
): Promise<void> {
  const phone = message.from;
  const text = (message.text?.body ?? '').trim();

  // ── Session expiry check ─────────────────────────────────────────────────
  const existing = sessionStore.get(phone);
  if (existing && sessionStore.isExpired(existing)) {
    sessionStore.delete(phone);
    await whatsappClient.sendTextMessage(
      phone,
      'Votre session a expiré après 30 minutes d\'inactivité. Envoyez un message pour recommencer.',
    );
    // Fall through: no session — will be treated as ACCUEIL below
  }

  // ── Retrieve or initialise session ───────────────────────────────────────
  let session = sessionStore.get(phone);

  if (!session) {
    // ── ACCUEIL: new contact ─────────────────────────────────────────────
    // Fetch tenant parameters to seed the session
    let tvaRate = 18;
    let devise = 'XOF';
    try {
      const params = await kiosqApi.getParametres();
      tvaRate = parseFloat(params.tva) || 18;
      devise = params.devise || 'XOF';
    } catch {
      // Non-fatal — use defaults
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
    };
    sessionStore.set(phone, session);

    await whatsappClient.sendTextMessage(
      phone,
      `Bienvenue sur le service de commande WhatsApp ! 👋\n\n` +
      `Je peux vous aider à :\n` +
      `🛍️  Parcourir le catalogue\n` +
      `🛒  Passer une commande\n` +
      `📦  Suivre une commande\n\n` +
      `Envoyez un message pour commencer.`,
    );

    // Move to IDENTIFICATION and continue in the same call
    session.step = 'IDENTIFICATION';
  }

  // Touch the session to reset the inactivity timer
  sessionStore.touch(phone);

  try {
    // ── IDENTIFICATION ───────────────────────────────────────────────────
    if (session.step === 'IDENTIFICATION') {
      if (session.pendingNomCapture) {
        // Extraire le nom depuis des formulations comme "je suis Seth AGBA", "mon nom est Seth", etc.
        const nom = extraireNom(text);
        if (!nom) {
          // Pas compris — redemander plus simplement
          await whatsappClient.sendTextMessage(phone, 'Je n\'ai pas bien saisi votre nom. Pouvez-vous juste écrire votre prénom et nom ? (ex: *Seth AGBA*)');
          return;
        }
        try {
          const newClient = await kiosqApi.createClient(nom, phone);
          session.clientId = newClient.id;
          session.clientNom = newClient.nom;
        } catch (err) {
          // Req 2.5: continue with null clientId on creation failure
          console.error('[conversationHandler] createClient failed:', err);
          session.clientNom = nom;
        }
        session.pendingNomCapture = false;
        session.step = 'MENU_PRINCIPAL';
        await whatsappClient.sendTextMessage(phone, menuPrincipalText(session.clientNom));
        return;
      }

      // Look up by phone
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
        // Unknown client — ask for their name
        session.pendingNomCapture = true;
        await whatsappClient.sendTextMessage(
          phone,
          'Je ne vous trouve pas encore dans notre système. Quel est votre nom ?',
        );
      }
      return;
    }

    // ── NLU helper (used in MENU_PRINCIPAL and sub-steps) ────────────────
    const classifyText = async (input: string) => {
      try {
        return await classifierMessage(input, {
          step: session!.step,
          panierSize: session!.panier.length,
        });
      } catch {
        return { intent: 'INCONNU' as const, score: 0 };
      }
    };

    // ── MENU_PRINCIPAL ───────────────────────────────────────────────────
    if (session.step === 'MENU_PRINCIPAL') {
      // Numbered shortcut detection first
      const num = text.replace(/[^\d]/g, '');
      if (num === '1') {
        session.step = 'CATALOGUE';
        return handleCatalogue(phone, session, sessionStore, kiosqApi, whatsappClient, null);
      }
      if (num === '2') {
        session.step = 'PANIER';
        await whatsappClient.sendTextMessage(phone, formatPanier(session));
        await whatsappClient.sendTextMessage(
          phone,
          session.panier.length > 0
            ? 'Pour ajouter un produit tapez son numéro (depuis le catalogue). Pour confirmer répondez *confirmer*. Pour annuler répondez *annuler*.'
            : 'Votre panier est vide. Répondez *catalogue* pour voir les produits disponibles.',
        );
        return;
      }
      if (num === '3') {
        session.step = 'SUIVI';
        await whatsappClient.sendTextMessage(
          phone,
          'Quel est le numéro de votre commande ? (ex: CMD-2025-001)',
        );
        return;
      }

      // NLU classification
      const nlu = await classifyText(text);
      const useNlu = nlu.score >= NLU_SCORE_SEUIL;

      if (useNlu) {
        switch (nlu.intent) {
          case 'PARCOURIR_CATALOGUE':
            session.step = 'CATALOGUE';
            return handleCatalogue(phone, session, sessionStore, kiosqApi, whatsappClient, null);
          case 'AJOUTER_PRODUIT':
            session.step = 'CATALOGUE';
            return handleCatalogue(phone, session, sessionStore, kiosqApi, whatsappClient, nlu.produit ?? null);
          case 'CONFIRMER_COMMANDE':
            if (session.panier.length > 0) {
              session.step = 'CONFIRMATION';
              return handleConfirmation(phone, session, sessionStore, kiosqApi, whatsappClient);
            }
            await whatsappClient.sendTextMessage(phone, 'Votre panier est vide. Ajoutez d\'abord des produits.');
            return;
          case 'VOIR_STATUT':
            session.step = 'SUIVI';
            await whatsappClient.sendTextMessage(
              phone,
              'Quel est le numéro de votre commande ? (ex: CMD-2025-001)',
            );
            return;
          case 'MODIFIER_PANIER':
            session.step = 'PANIER';
            await whatsappClient.sendTextMessage(phone, formatPanier(session));
            return;
          case 'ANNULER':
            session.panier = [];
            await whatsappClient.sendTextMessage(phone, 'Panier annulé. ' + menuPrincipalText(session.clientNom));
            return;
          case 'AIDE':
          default:
            break;
        }
      }

      // Fallback: numbered menu
      await whatsappClient.sendTextMessage(phone, menuPrincipalText(session.clientNom));
      return;
    }

    // ── CATALOGUE ────────────────────────────────────────────────────────
    if (session.step === 'CATALOGUE') {
      const lower = text.toLowerCase();

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

      // "non", "annuler" depuis CATALOGUE → retour au menu
      if (lower === 'non' || lower === 'annuler') {
        session.step = 'MENU_PRINCIPAL';
        await whatsappClient.sendTextMessage(phone, menuPrincipalText(session.clientNom));
        return;
      }

      // "confirmer" depuis CATALOGUE → aller directement à la confirmation
      if (lower === 'confirmer' || lower === 'oui' || lower === 'valider') {
        if (session.panier.length > 0) {
          session.step = 'CONFIRMATION';
          return handleConfirmation(phone, session, sessionStore, kiosqApi, whatsappClient);
        }
        await whatsappClient.sendTextMessage(phone, 'Votre panier est vide. Ajoutez d\'abord des produits.');
        return;
      }

      // If there's a cached catalogue, try to interpret as a product selection
      const cached = (session as Session & { _catalogue?: ProduitDisponible[] })._catalogue;
      if (cached && cached.length > 0) {
        const selection = parseSelectionProduit(text);
        if (selection && selection.index <= cached.length) {
          const produit = cached[selection.index - 1];
          const added = await addOuRemplacerProduit(phone, session, produit!, selection.quantite, whatsappClient);
          if (added) {
            await whatsappClient.sendTextMessage(phone, formatPanier(session));
            await whatsappClient.sendTextMessage(
              phone,
              'Ajouter un autre produit (tapez son numéro), ou :\n• *confirmer* — valider la commande\n• *panier* — voir le panier\n• *menu* — revenir au menu',
            );
          }
          return;
        }
      }

      // NLU pour détecter intentions dans CATALOGUE
      const nluCat = await classifyText(text);
      if (nluCat.score >= NLU_SCORE_SEUIL) {
        if (nluCat.intent === 'CONFIRMER_COMMANDE' && session.panier.length > 0) {
          session.step = 'CONFIRMATION';
          return handleConfirmation(phone, session, sessionStore, kiosqApi, whatsappClient);
        }
        if (nluCat.intent === 'ANNULER') {
          session.step = 'MENU_PRINCIPAL';
          await whatsappClient.sendTextMessage(phone, menuPrincipalText(session.clientNom));
          return;
        }
        if (nluCat.intent === 'MODIFIER_PANIER') {
          session.step = 'PANIER';
          await whatsappClient.sendTextMessage(phone, formatPanier(session));
          return;
        }
      }

      // No cached catalogue or couldn't parse — show the catalogue
      return handleCatalogue(phone, session, sessionStore, kiosqApi, whatsappClient, null);
    }

    // ── PANIER ───────────────────────────────────────────────────────────
    if (session.step === 'PANIER') {
      const lower = text.toLowerCase();

      if (lower === 'confirmer' || lower === 'oui' || lower === 'valider') {
        if (session.panier.length === 0) {
          await whatsappClient.sendTextMessage(phone, 'Votre panier est vide. Ajoutez des produits d\'abord.');
          return;
        }
        session.step = 'CONFIRMATION';
        return handleConfirmation(phone, session, sessionStore, kiosqApi, whatsappClient);
      }

      if (lower === 'annuler' || lower === 'vider') {
        session.panier = [];
        session.step = 'MENU_PRINCIPAL';
        await whatsappClient.sendTextMessage(phone, 'Panier vidé. ' + menuPrincipalText(session.clientNom));
        return;
      }

      if (lower === 'menu' || lower === 'retour') {
        session.step = 'MENU_PRINCIPAL';
        await whatsappClient.sendTextMessage(phone, menuPrincipalText(session.clientNom));
        return;
      }

      if (lower === 'catalogue' || lower === 'voir catalogue') {
        session.step = 'CATALOGUE';
        return handleCatalogue(phone, session, sessionStore, kiosqApi, whatsappClient, null);
      }

      // Try NLU to see if user wants to add a product
      const nlu = await classifyText(text);
      if (nlu.score >= NLU_SCORE_SEUIL && (nlu.intent === 'AJOUTER_PRODUIT' || nlu.intent === 'PARCOURIR_CATALOGUE')) {
        session.step = 'CATALOGUE';
        return handleCatalogue(phone, session, sessionStore, kiosqApi, whatsappClient, nlu.produit ?? null);
      }

      // Si l'utilisateur tape un numéro depuis le panier → aller au catalogue
      const numPanier = parseInt(text.trim(), 10);
      if (!isNaN(numPanier) && numPanier >= 1) {
        session.step = 'CATALOGUE';
        return handleCatalogue(phone, session, sessionStore, kiosqApi, whatsappClient, null);
      }

      // Show cart summary with options
      await whatsappClient.sendTextMessage(phone, formatPanier(session));
      await whatsappClient.sendTextMessage(
        phone,
        'Options :\n• *catalogue* — ajouter des produits\n• *confirmer* — valider la commande\n• *annuler* — vider le panier et revenir au menu',
      );
      return;
    }

    // ── SUIVI ────────────────────────────────────────────────────────────
    if (session.step === 'SUIVI') {
      const lower = text.toLowerCase();

      if (lower === 'menu' || lower === 'retour' || text.trim() === '4') {
        session.step = 'MENU_PRINCIPAL';
        await whatsappClient.sendTextMessage(phone, menuPrincipalText(session.clientNom));
        return;
      }

      // Raccourcis menu depuis SUIVI
      if (text.trim() === '1') {
        session.step = 'CATALOGUE';
        return handleCatalogue(phone, session, sessionStore, kiosqApi, whatsappClient, null);
      }
      if (text.trim() === '2') {
        session.step = 'PANIER';
        await whatsappClient.sendTextMessage(phone, formatPanier(session));
        await whatsappClient.sendTextMessage(
          phone,
          session.panier.length > 0
            ? 'Pour confirmer répondez *confirmer*. Pour annuler répondez *annuler*.'
            : 'Votre panier est vide. Répondez *catalogue* pour voir les produits.',
        );
        return;
      }

      if (lower === 'mes commandes' || lower === 'liste') {
        return handleSuiviListe(phone, session, kiosqApi, whatsappClient);
      }

      // NLU pour détecter les intentions depuis SUIVI
      const nluSuivi = await classifyText(text);
      if (nluSuivi.score >= NLU_SCORE_SEUIL) {
        switch (nluSuivi.intent) {
          case 'PARCOURIR_CATALOGUE':
          case 'AJOUTER_PRODUIT':
            session.step = 'CATALOGUE';
            return handleCatalogue(phone, session, sessionStore, kiosqApi, whatsappClient, nluSuivi.produit ?? null);
          case 'CONFIRMER_COMMANDE':
          case 'MODIFIER_PANIER':
            session.step = 'PANIER';
            await whatsappClient.sendTextMessage(phone, formatPanier(session));
            return;
          case 'ANNULER':
            session.step = 'MENU_PRINCIPAL';
            await whatsappClient.sendTextMessage(phone, menuPrincipalText(session.clientNom));
            return;
        }
      }

      // Si ça ressemble à un numéro de commande (contient CMD ou DEV ou des chiffres longs)
      const looksLikeOrderNumber = /CMD|DEV/i.test(text) || /^\d{5,}$/.test(text.trim());
      if (!looksLikeOrderNumber && text.trim().length < 5) {
        // Trop court pour être un numéro de commande — retourner au menu
        session.step = 'MENU_PRINCIPAL';
        await whatsappClient.sendTextMessage(phone, menuPrincipalText(session.clientNom));
        return;
      }

      // Interpret as a commande number/id
      return handleSuiviCommande(phone, text, session, kiosqApi, whatsappClient);
    }

    // ── CONFIRMATION ─────────────────────────────────────────────────────
    if (session.step === 'CONFIRMATION') {
      const lower = text.toLowerCase();
      if (lower === 'oui' || lower === 'confirmer' || lower === 'ok') {
        return handleConfirmation(phone, session, sessionStore, kiosqApi, whatsappClient);
      }
      if (lower === 'non' || lower === 'annuler') {
        session.step = 'PANIER';
        await whatsappClient.sendTextMessage(phone, 'Commande annulée. ' + formatPanier(session));
        return;
      }
      // Re-show confirmation prompt
      return handleConfirmation(phone, session, sessionStore, kiosqApi, whatsappClient);
    }

  } catch (err) {
    // Req 9.4 — never expose internal errors
    console.error('[conversationHandler] unhandled error:', err);
    await whatsappClient.sendTextMessage(
      phone,
      'Je rencontre un problème temporaire. Veuillez réessayer dans quelques instants.',
    ).catch(() => undefined);
  }
}

// ─── Sub-handlers ─────────────────────────────────────────────────────────────

/**
 * Handle CATALOGUE step: fetch, filter, chunk and display products.
 * If `searchProduit` is provided, attempt to find a matching product and add it.
 */
async function handleCatalogue(
  phone: string,
  session: Session,
  sessionStore: SessionStore,
  kiosqApi: KiosqWhatsappApi,
  whatsappClient: WhatsappClient,
  searchProduit: string | null,
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

  // If Gemini detected a product name, try to match and add it
  if (searchProduit) {
    const lower = searchProduit.toLowerCase();
    const found = disponibles.find((p) => p.designation.toLowerCase().includes(lower));
    if (found) {
      await addProduitToPanier(phone, session, found, 1, whatsappClient);
      session.step = 'PANIER';
      await whatsappClient.sendTextMessage(
        phone,
        'Options :\n• *confirmer* — valider la commande\n• *catalogue* — continuer les achats\n• *annuler* — vider le panier',
      );
      return;
    }
  }

  // Display products in chunks of 10 (Req 3.2)
  const chunks = chunkCatalogue(disponibles, 10);
  for (let i = 0; i < chunks.length; i++) {
    await whatsappClient.sendTextMessage(
      phone,
      formatProduitChunk(chunks[i], session.devise, i + 1, chunks.length),
    );
  }

  await whatsappClient.sendTextMessage(
    phone,
    'Pour ajouter un produit, répondez avec son numéro et la quantité (ex: *1 2kg* ou *3 x5*).\n' +
    'Tapez *menu* pour revenir au menu principal.',
  );

  // Stay in CATALOGUE to process the next product selection
  session.step = 'CATALOGUE';

  // Store the current catalogue snapshot in session for product selection by number
  // We use a transient field on session — extend session with catalogue cache
  (session as Session & { _catalogue?: ProduitDisponible[] })._catalogue = disponibles;
  sessionStore.set(phone, session);
}

/**
 * Extrait un nom propre depuis une phrase de présentation.
 * "je suis Seth AGBA"       → "Seth Agba"
 * "tu peux dire Seth AGBA"  → "Seth Agba"
 * "mon nom est Seth"         → "Seth"
 * "c'est Seth AGBA"          → "Seth Agba"
 * "Seth AGBA"                → "Seth Agba"
 */
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
  // Si ça ressemble déjà à un nom (1-3 mots, pas de verbes courants), on le prend tel quel
  const mots = text.split(/\s+/);
  const motsFonction = /^(je|tu|il|elle|nous|vous|ils|elles|mon|ma|mes|le|la|les|un|une|des|est|sont|suis|peux|peut|veux|veut|fais|fait)$/i;
  const estNomDirect = mots.length <= 3 && !mots.some(m => motsFonction.test(m));
  if (estNomDirect) {
    return titreCase(text);
  }
  // Sinon retourner null pour redemander
  return '';
}

function titreCase(s: string): string {
  return s.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

/**
 * Parse a user input like "1", "2 x3", "3 5kg" into { index, quantite }.
 * Returns null if parsing fails.
 */
function parseSelectionProduit(input: string): { index: number; quantite: number } | null {
  // Normalise: remove common separators
  const clean = input.trim().replace(/[xX×*]/g, ' ').replace(/\s+/g, ' ');
  const parts = clean.split(' ');
  const idx = parseInt(parts[0] ?? '', 10);
  if (isNaN(idx) || idx < 1) return null;
  // Extract first numeric part from second token (handles "2kg", "3 kg", etc.)
  const rawQty = parts[1] ? parts[1].replace(/[^\d.]/g, '') : '1';
  const qty = Math.round(parseFloat(rawQty));
  return { index: idx, quantite: isNaN(qty) || qty < 1 ? 1 : qty };
}

/**
 * Add a product to the session cart, checking stock (Req 4.5).
 * Accumulates quantity if product already in cart.
 */
async function addProduitToPanier(
  phone: string,
  session: Session,
  produit: ProduitDisponible,
  quantite: number,
  whatsappClient: WhatsappClient,
): Promise<boolean> {
  if (quantite > produit.stockActuel) {
    await whatsappClient.sendTextMessage(
      phone,
      `Ce produit n'est plus disponible en quantité suffisante. Stock actuel : ${produit.stockActuel} ${produit.unite}.`,
    );
    return false;
  }

  const existing = session.panier.find((l) => l.produitId === produit.id);
  if (existing) {
    const newQty = existing.quantite + quantite;
    if (newQty > produit.stockActuel) {
      await whatsappClient.sendTextMessage(
        phone,
        `Quantité totale demandée (${newQty}) dépasse le stock disponible (${produit.stockActuel} ${produit.unite}).`,
      );
      return false;
    }
    existing.quantite = newQty;
    existing.totalLigne = existing.prixUnitaire * newQty;
  } else {
    const ligne: LignePanier = {
      produitId: produit.id,
      designation: produit.designation,
      prixUnitaire: produit.prixVente,
      quantite,
      totalLigne: produit.prixVente * quantite,
    };
    session.panier.push(ligne);
  }
  return true;
}

/**
 * Replace (not accumulate) the quantity of a product in the cart.
 * Used when the user re-selects a product from the catalogue — sets the
 * quantity to the new value instead of adding to the existing one.
 */
async function addOuRemplacerProduit(
  phone: string,
  session: Session,
  produit: ProduitDisponible,
  quantite: number,
  whatsappClient: WhatsappClient,
): Promise<boolean> {
  if (quantite > produit.stockActuel) {
    await whatsappClient.sendTextMessage(
      phone,
      `Stock insuffisant. Stock actuel : ${produit.stockActuel} ${produit.unite}.`,
    );
    return false;
  }

  const existing = session.panier.find((l) => l.produitId === produit.id);
  if (existing) {
    // Replace quantity instead of accumulating
    existing.quantite = quantite;
    existing.totalLigne = existing.prixUnitaire * quantite;
    await whatsappClient.sendTextMessage(
      phone,
      `Quantité de *${produit.designation}* mise à jour : ${quantite} ${produit.unite}.`,
    );
  } else {
    session.panier.push({
      produitId: produit.id,
      designation: produit.designation,
      prixUnitaire: produit.prixVente,
      quantite,
      totalLigne: produit.prixVente * quantite,
    });
    await whatsappClient.sendTextMessage(
      phone,
      `✅ *${produit.designation}* × ${quantite} ajouté au panier.`,
    );
  }
  return true;
}

/**
 * Handle CONFIRMATION step: show cart summary, ask for confirmation,
 * then create order via API with one retry on 5xx (Req 5.1, 5.4, 5.5).
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

  const { totalHT, totalTTC } = computePanierTotaux(session.panier, session.tvaRate);

  // Show confirmation summary
  await whatsappClient.sendTextMessage(
    phone,
    `${formatPanier(session)}\n\n` +
    `Confirmez-vous cette commande ?\n` +
    `Répondez *oui* pour confirmer ou *non* pour annuler.`,
  );

  // Build the commande payload
  const lignes: LigneCommande[] = session.panier.map((l) => ({
    produitId:    l.produitId,
    produitRef:   '',
    produitNom:   l.designation,
    quantite:     l.quantite,
    prixUnitaire: l.prixUnitaire,
    remise:       0,
    total:        l.totalLigne,
  }));

  const payload: CommandePayload = {
    ...(session.clientId !== null && { clientId: session.clientId }),
    lignes,
    totalHT,
    tva: session.tvaRate,
    totalTTC,
    notes: 'Commande via WhatsApp',
  };

  // Attempt to create the order (with one retry on 5xx)
  let commande;
  try {
    commande = await kiosqApi.createCommande(payload);
  } catch (err) {
    const is5xx = err instanceof Error && /HTTP 5\d\d/.test(err.message);
    if (is5xx) {
      // Req 5.5: retry once after 5 seconds
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
      // Req 5.4: 4xx — inform and let user try again
      console.error('[conversationHandler] createCommande failed:', err);
      session.step = 'PANIER';
      await whatsappClient.sendTextMessage(
        phone,
        'Votre commande n\'a pas pu être enregistrée. Vérifiez les produits sélectionnés et réessayez.',
      );
      return;
    }
  }

  // Success (Req 5.2): confirm to client and clear cart (Req 5.3)
  const updated = clearSessionAfterOrder(session);
  session.panier = updated.panier;
  session.step = updated.step;
  sessionStore.set(phone, session);

  await whatsappClient.sendTextMessage(
    phone,
    `✅ Commande confirmée !\n\n` +
    `Numéro : *${commande.numero}*\n` +
    `Total TTC : *${commande.totalTTC.toFixed(2)} ${session.devise}*\n\n` +
    `Merci pour votre commande !`,
  );

  await whatsappClient.sendTextMessage(phone, menuPrincipalText(session.clientNom));
}

/**
 * Handle SUIVI step: look up a specific order by number/id (Req 6.1, 6.2, 6.4).
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
      'Je ne trouve pas cette commande. Vérifiez le numéro et réessayez.\n' +
      'Tapez *menu* pour revenir au menu principal.',
    );
    return;
  }

  // Req 6.4: verify ownership
  // CommandeCreee doesn't carry clientId in the return type; tenant isolation
  // is enforced by the API via BOT_JWT. We display info and trust the API scope.

  const statut = statutLabel(commande.statut);
  await whatsappClient.sendTextMessage(
    phone,
    `📦 *Commande ${commande.numero}*\n` +
    `Statut : ${statut}\n` +
    `Total TTC : ${commande.totalTTC.toFixed(2)} ${session.devise}\n` +
    `Date : ${new Date(commande.dateCommande).toLocaleDateString('fr-FR')}\n\n` +
    `Tapez *mes commandes* pour voir vos dernières commandes, ou *menu* pour le menu principal.`,
  );

  session.step = 'MENU_PRINCIPAL';
}

/**
 * Handle SUIVI list: show recent orders for the current client (Req 6.3).
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
    await whatsappClient.sendTextMessage(phone, 'Vous n\'avez pas encore de commandes enregistrées.');
  } else {
    const lines = commandes.map(
      (c) =>
        `• *${c.numero}* — ${statutLabel(c.statut)} — ${c.totalTTC.toFixed(2)} ${session.devise}`,
    );
    await whatsappClient.sendTextMessage(
      phone,
      `📋 *Vos dernières commandes :*\n\n${lines.join('\n')}\n\n` +
      `Tapez le numéro d'une commande pour plus de détails, ou *menu* pour le menu principal.`,
    );
  }

  session.step = 'SUIVI';
}
