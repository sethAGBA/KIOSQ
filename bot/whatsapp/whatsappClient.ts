/**
 * WhatsApp Cloud API client for sending messages.
 *
 * Docs: https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages
 */

/** A single row inside a WhatsApp interactive list section. */
export interface SectionRow {
  id: string;
  title: string;
  description?: string;
}

/** A section in a WhatsApp interactive list message. */
export interface Section {
  title: string;
  rows: SectionRow[];
}

type FetchFn = typeof fetch;

function getConfig() {
  return {
    token: process.env.WHATSAPP_TOKEN ?? '',
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID ?? '',
  };
}

const GRAPH_API_BASE = 'https://graph.facebook.com/v20.0';

/**
 * Client for the WhatsApp Cloud API.
 *
 * By default it reads `WHATSAPP_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID` from
 * `process.env`. Pass explicit values to the constructor to override (useful
 * in tests).
 */
export class WhatsappClient {
  private readonly token: string;
  private readonly phoneNumberId: string;
  private readonly fetchFn: FetchFn;

  constructor(
    options: { token?: string; phoneNumberId?: string; fetchFn?: FetchFn } = {},
  ) {
    const cfg = getConfig();
    this.token = options.token ?? cfg.token;
    this.phoneNumberId = options.phoneNumberId ?? cfg.phoneNumberId;
    this.fetchFn = options.fetchFn ?? fetch;
  }

  private get messagesUrl(): string {
    return `${GRAPH_API_BASE}/${this.phoneNumberId}/messages`;
  }

  private async post(body: unknown): Promise<void> {
    const res = await this.fetchFn(this.messagesUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.token}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`WhatsApp API HTTP ${res.status}: ${text}`);
    }
  }

  /**
   * Send a plain text message to a WhatsApp number.
   *
   * @param to - Recipient phone number in E.164 format without leading `+`
   *             (e.g. `"221771234567"`).
   * @param body - The text content of the message (max 4096 chars).
   */
  async sendTextMessage(to: string, body: string): Promise<void> {
    await this.post({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: {
        preview_url: false,
        body,
      },
    });
  }

  /**
   * Send an interactive list message to a WhatsApp number.
   *
   * List messages display a button that opens a scrollable list of options
   * grouped into sections. Each row has an `id` (returned when the user
   * selects it) and a `title`.
   *
   * @param to       - Recipient phone number in E.164 format without leading `+`.
   * @param header   - Short header text displayed above the list button (max 60 chars).
   * @param sections - Array of sections, each with a title and an array of rows.
   */
  async sendListMessage(to: string, header: string, sections: Section[]): Promise<void> {
    await this.post({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'interactive',
      interactive: {
        type: 'list',
        header: {
          type: 'text',
          text: header,
        },
        body: {
          text: header,
        },
        action: {
          button: 'Choisir',
          sections,
        },
      },
    });
  }
}
