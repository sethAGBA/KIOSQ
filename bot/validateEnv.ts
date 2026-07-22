const REQUIRED = ['KIOSQ_API_URL', 'BOT_JWT', 'APIFY_TOKEN', 'GEMINI_API_KEY'] as const;

export function validateBotEnv(): void {
  const missing = REQUIRED.filter(key => !process.env[key]?.trim());

  if (missing.length === 0) return;

  console.error('[bot] Variables d\'environnement manquantes :');
  for (const key of missing) console.error(`  - ${key}`);
  console.error('');
  console.error('Étapes :');
  console.error('  1. cp .env.example .env');
  console.error('  2. Renseigner les valeurs dans bot/.env');
  console.error('');
  console.error('En local (API kiosq sur le port 3001) :');
  console.error('  KIOSQ_API_URL=http://localhost:3001');
  console.error('');
  console.error('Générer BOT_JWT (utilise JWT_SECRET de ../.env.local) :');
  console.error('  npm run generate-jwt');
  console.error('');
  console.error('Lancer l\'API locale dans un autre terminal :');
  console.error('  cd .. && npm run api:dev');

  process.exit(1);
}
