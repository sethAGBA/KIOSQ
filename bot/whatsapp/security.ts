import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Validates the HMAC-SHA256 signature of an incoming WhatsApp webhook request.
 *
 * @param rawBody - The raw request body as a Buffer (must be read before JSON parsing)
 * @param appSecret - The Meta app secret (`WHATSAPP_APP_SECRET`)
 * @param signatureHeader - The `X-Hub-Signature-256` header value, format: `"sha256=<hex>"`
 * @returns `true` if the signature is valid, `false` otherwise (including on any error)
 *
 * Uses `timingSafeEqual` to prevent timing-based side-channel attacks.
 */
export function validateHmacSignature(
  rawBody: Buffer,
  appSecret: string,
  signatureHeader: string,
): boolean {
  try {
    const expected = createHmac('sha256', appSecret).update(rawBody).digest('hex');
    const provided = signatureHeader.startsWith('sha256=')
      ? signatureHeader.slice('sha256='.length)
      : signatureHeader;

    return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(provided, 'hex'));
  } catch {
    return false;
  }
}

/**
 * Token-bucket rate limiter: allows up to 60 messages per minute per WhatsApp phone number.
 *
 * The bucket resets when the current minute window expires (i.e. `Date.now() > resetAt`).
 * Callers that exceed 60 requests within the window receive `false` until the window resets.
 */
export class RateLimiter {
  private readonly counters = new Map<string, { count: number; resetAt: number }>();

  /**
   * Returns `true` if the given phone number is within the rate limit, `false` if it has
   * been exceeded for the current 60-second window.
   */
  isAllowed(phone: string): boolean {
    const now = Date.now();
    const entry = this.counters.get(phone);

    if (!entry || now > entry.resetAt) {
      // New window: start fresh
      this.counters.set(phone, { count: 1, resetAt: now + 60_000 });
      return true;
    }

    if (entry.count >= 60) {
      return false;
    }

    entry.count++;
    return true;
  }
}
