import './loadEnv.js';
import { SignJWT } from 'jose';

const secret = new TextEncoder().encode(
  process.env.JWT_SECRET ?? 'kiosq-dev-secret-change-in-prod',
);

async function main() {
  const token = await new SignJWT({
    sub: 'bot-capture',
    email: 'bot@kiosq.app',
    role: 'commercial',
    nom: 'Bot',
    prenom: 'Capture',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('365d')
    .sign(secret);

  console.log('\nAjoutez cette ligne dans bot/.env :\n');
  console.log(`BOT_JWT=${token}\n`);
}

main().catch(err => {
  console.error('Erreur génération JWT:', err);
  process.exit(1);
});
