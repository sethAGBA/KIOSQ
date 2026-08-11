/**
 * whatsappClient.ts — WhatsApp client using whatsapp-web.js (QR code auth).
 *
 * Replaces the Meta Cloud API HTTP client with a local WhatsApp Web session.
 * The client connects via QR code on first launch; the session is persisted
 * locally via LocalAuth so subsequent starts don't need a new QR scan.
 *
 * Public interface is identical to the former Meta Cloud API client:
 *   - sendTextMessage(to, body)
 *   - sendListMessage(to, header, sections)  ← sends as plain text (WWebJS has no list messages)
 *
 * Exports:
 *   - WhatsappWebClient  (class)
 *   - createWhatsappClient()  (factory used by index.ts)
 */

// whatsapp-web.js is a CJS module — access via default export when using ESM
import wwebjs from 'whatsapp-web.js';
const { Client, NoAuth } = wwebjs;
import qrcode from 'qrcode-terminal';

/** Section row — kept for interface compatibility with former Meta Cloud API client. */
export interface SectionRow {
  id: string;
  title: string;
  description?: string;
}

/** Section — kept for interface compatibility. */
export interface Section {
  title: string;
  rows: SectionRow[];
}

/**
 * WhatsApp client backed by whatsapp-web.js.
 *
 * Usage:
 *   const client = createWhatsappClient();
 *   await client.initialize(); // shows QR code in terminal
 *   await client.sendTextMessage('22890000000', 'Bonjour !');
 */
export class WhatsappWebClient {
  private client: Client;
  private ready = false;

  constructor() {
    this.client = new Client({
      authStrategy: new NoAuth(),
      puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      },
    });

    this.client.on('qr', (qr) => {
      console.log('\n[whatsapp] Scannez ce QR code avec WhatsApp sur votre téléphone :\n');
      qrcode.generate(qr, { small: true });
    });

    this.client.on('ready', () => {
      this.ready = true;
      console.log('[whatsapp] Client connecté et prêt.');
    });

    this.client.on('auth_failure', (msg) => {
      console.error('[whatsapp] Échec d\'authentification :', msg);
    });

    this.client.on('disconnected', (reason) => {
      this.ready = false;
      console.warn('[whatsapp] Client déconnecté :', reason);
      // Auto-reconnect after 5s unless it was a deliberate LOGOUT
      if (reason !== 'LOGOUT') {
        console.log('[whatsapp] Reconnexion dans 5 secondes…');
        setTimeout(() => {
          this.client.initialize().catch((err) =>
            console.error('[whatsapp] Erreur reconnexion :', err),
          );
        }, 5000);
      }
    });
  }

  /** Initialise the WhatsApp client (shows QR code, waits for auth). */
  async initialize(): Promise<void> {
    await this.client.initialize();
  }

  /** Gracefully destroy the session (called on shutdown). */
  async destroy(): Promise<void> {
    try {
      await this.client.destroy();
    } catch (err) {
      // On Windows, LocalAuth may fail with EBUSY when Chromium still holds
      // a lock on the Cookies file — safe to ignore during shutdown.
      const code = (err as NodeJS.ErrnoException).code;
      if (code !== 'EBUSY') {
        console.error('[whatsapp] Erreur lors de destroy :', err);
      }
    }
  }

  /**
   * Send a plain text message.
   *
   * @param to   Recipient number in E.164 format without leading `+`
   *             (e.g. `"22890000000"`). The suffix `@c.us` is added automatically.
   * @param body Message text (max 4096 chars recommended).
   */
  async sendTextMessage(to: string, body: string): Promise<void> {
    if (!this.ready) {
      throw new Error('[whatsapp] Client non prêt — message non envoyé');
    }
    const chatId = to.includes('@') ? to : `${to}@c.us`;
    await this.client.sendMessage(chatId, body);
  }

  /**
   * Send an interactive list as plain text (whatsapp-web.js has no native list
   * messages). Each row is rendered as a numbered option.
   *
   * @param to       Recipient number in E.164 format without leading `+`.
   * @param header   Header text shown before the list.
   * @param sections Array of sections with rows.
   */
  async sendListMessage(to: string, header: string, sections: Section[]): Promise<void> {
    const lines: string[] = [header, ''];
    let counter = 1;
    for (const section of sections) {
      if (section.title) lines.push(`*${section.title}*`);
      for (const row of section.rows) {
        lines.push(`${counter}. ${row.title}${row.description ? ` — ${row.description}` : ''}`);
        counter++;
      }
      lines.push('');
    }
    await this.sendTextMessage(to, lines.join('\n').trim());
  }

  /** Returns true when the client is authenticated and ready to send messages. */
  isReady(): boolean {
    return this.ready;
  }
}

/** Factory — creates and returns an uninitialised client instance. */
export function createWhatsappClient(): WhatsappWebClient {
  return new WhatsappWebClient();
}
