/**
 * validateEnv.ts — Validates required environment variables for the
 * whatsapp-web.js based bot.
 *
 * Meta Cloud API variables (WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID,
 * WHATSAPP_APP_SECRET, WHATSAPP_VERIFY_TOKEN) are no longer required.
 */

const REQUIRED_VARS = [
  'BOT_JWT',
  'KIOSQ_API_URL',
  'GEMINI_API_KEY',
] as const;

/**
 * Validates that all required environment variables are set.
 * Prints each missing variable name to stderr and exits with code 1 if any are missing.
 */
export function validateWhatsappEnv(): void {
  const missing = REQUIRED_VARS.filter(key => !process.env[key]?.trim());

  if (missing.length === 0) return;

  console.error('[whatsapp-bot] Variables d\'environnement manquantes :');
  for (const key of missing) {
    console.error(`  - ${key}`);
  }
  console.error('');
  console.error('Étapes :');
  console.error('  1. cp bot/whatsapp/.env.example bot/whatsapp/.env');
  console.error('  2. Renseigner les valeurs dans bot/whatsapp/.env');

  process.exit(1);
}
