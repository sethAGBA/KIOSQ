/**
 * notificationPoller.ts
 *
 * Polls the Kiosq API every 60 seconds to detect commande status changes
 * and sends WhatsApp notifications for eligible transitions.
 *
 * Requirements: 8.1, 8.2, 8.3, 8.5
 */

import type { KiosqWhatsappApi, WhatsappClient } from './conversationHandler.js';
import type { SessionStore } from './sessionStore.js';

// ─── StatutCommande enum ──────────────────────────────────────────────────────

export type StatutCommande =
  | 'brouillon'
  | 'confirme'
  | 'en_preparation'
  | 'expedie'
  | 'livre'
  | 'annule';

export const statutCommandeValues: StatutCommande[] = [
  'brouillon',
  'confirme',
  'en_preparation',
  'expedie',
  'livre',
  'annule',
];

// ─── Eligible transitions (Req 8.3) ──────────────────────────────────────────

const TRANSITIONS_NOTIFIABLES = new Set<string>([
  'brouillon→confirme',
  'confirme→en_preparation',
  'en_preparation→expedie',
  'expedie→livre',
]);

/**
 * Returns true if and only if (ancien, nouveau) is one of the 4 eligible
 * notification transitions.
 *
 * Validates: Requirements 8.3
 */
export function isTransitionNotifiable(ancien: string, nouveau: string): boolean {
  return TRANSITIONS_NOTIFIABLES.has(`${ancien}→${nouveau}`);
}

// ─── Human-readable status labels ────────────────────────────────────────────

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

// ─── In-memory tracking state ─────────────────────────────────────────────────

/**
 * Tracks the last known statut for each commande ID.
 * Populated on first successful poll; updated after each status change.
 */
const knownStatuts = new Map<string, string>();

/**
 * Registry of commandes to track, keyed by commandeId.
 * Each entry carries the phone number of the client to notify.
 * Populated via trackCommande() when a new order is placed.
 */
const trackedCommandes = new Map<string, { commandeId: string; phone: string }>();

/**
 * Register a commande for status-change polling and notifications.
 * Called by conversationHandler after a successful order creation.
 *
 * @param commandeId  The commande ID (e.g. "cmd-abc-123")
 * @param phone       Client WhatsApp number in E.164 format without leading `+`
 */
export function trackCommande(commandeId: string, phone: string): void {
  trackedCommandes.set(commandeId, { commandeId, phone });
}

// ─── Notification helper ──────────────────────────────────────────────────────

/**
 * Attempt to send a status-change notification, with one retry after 60s on
 * failure (Req 8.5).
 */
async function sendNotificationWithRetry(
  whatsappClient: WhatsappClient,
  phone: string,
  commandeId: string,
  nouveauStatut: string,
): Promise<void> {
  const message =
    `📦 Mise à jour de votre commande *${commandeId}* :\n` +
    `Nouveau statut : *${statutLabel(nouveauStatut)}*`;

  try {
    await whatsappClient.sendTextMessage(phone, message);
    console.info(
      `[notificationPoller] Notification envoyée — commande=${commandeId} statut=${nouveauStatut} phone=${phone}`,
    );
  } catch (err) {
    console.warn(
      `[notificationPoller] Échec envoi notification — commande=${commandeId}, retry dans 60s`,
      err,
    );

    // Retry once after 60 seconds (Req 8.5)
    setTimeout(async () => {
      try {
        await whatsappClient.sendTextMessage(phone, message);
        console.info(
          `[notificationPoller] Notification retry réussie — commande=${commandeId} statut=${nouveauStatut}`,
        );
      } catch (retryErr) {
        console.error(
          `[notificationPoller] Retry notification échoué — commande=${commandeId} statut=${nouveauStatut}`,
          retryErr,
        );
      }
    }, 60_000);
  }
}

// ─── Poll cycle ───────────────────────────────────────────────────────────────

/**
 * Execute one poll cycle: for each tracked commande, fetch its current status
 * from the Kiosq API. If the status has changed to an eligible transition,
 * send a WhatsApp notification to the associated phone number.
 *
 * This function is designed to be called every 60 seconds via setInterval in
 * index.ts. It is a single cycle and does not schedule itself.
 *
 * Requirements: 8.1, 8.2, 8.3, 8.5
 *
 * @param sessionStore   Not used for iteration (no public iterator), kept for
 *                       future use (e.g. tenant notification prefs — Req 8.4)
 * @param kiosqApi       API client used to fetch commande details
 * @param whatsappClient Client used to send notification messages
 */
export async function pollCommandeStatuts(
  sessionStore: SessionStore,
  kiosqApi: KiosqWhatsappApi,
  whatsappClient: WhatsappClient,
): Promise<void> {
  if (trackedCommandes.size === 0) {
    return;
  }

  const promises: Promise<void>[] = [];

  for (const { commandeId, phone } of trackedCommandes.values()) {
    promises.push(
      (async () => {
        let commande;
        try {
          commande = await kiosqApi.getCommande(commandeId);
        } catch (err) {
          // Network or API error — skip this cycle, retry next poll (Req 8.1)
          console.warn(
            `[notificationPoller] Impossible de récupérer la commande ${commandeId} — retry au prochain cycle`,
            err,
          );
          return;
        }

        const nouveauStatut = commande.statut;
        const ancienStatut = knownStatuts.get(commandeId);

        if (ancienStatut === undefined) {
          // First time we see this commande — record statut, no notification
          knownStatuts.set(commandeId, nouveauStatut);
          return;
        }

        if (ancienStatut === nouveauStatut) {
          // No change — nothing to do
          return;
        }

        // Status has changed — update our record
        knownStatuts.set(commandeId, nouveauStatut);

        // Only notify for the 4 eligible transitions (Req 8.3)
        if (!isTransitionNotifiable(ancienStatut, nouveauStatut)) {
          return;
        }

        // Stop tracking once a terminal state is reached
        if (nouveauStatut === 'livre' || nouveauStatut === 'annule') {
          trackedCommandes.delete(commandeId);
        }

        await sendNotificationWithRetry(whatsappClient, phone, commande.numero ?? commandeId, nouveauStatut);
      })(),
    );
  }

  await Promise.allSettled(promises);
}
