import './loadEnv.js';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { kiosqApi, AuthError } from './kiosqApi.js';
import { scrapeGroupe } from './apify.js';
import { classifierPost } from './gemini.js';
import { validateBotEnv } from './validateEnv.js';

export function getScoreSeuil(): number {
  const raw = process.env.SCORE_SEUIL;
  if (raw === undefined || raw === '') return 0.7;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0.7;
}

/** Propriété 7 — le bot crée un lead si et seulement si score ≥ seuil. */
export function shouldCreateLead(score: number, seuil: number): boolean {
  return score >= seuil;
}

export async function processGroupe(
  groupe: Awaited<ReturnType<typeof kiosqApi.getGroupesActifs>>[number],
  seuil: number,
): Promise<void> {
  const cookie = groupe.cookieSession;
  const posts = await scrapeGroupe(groupe.urlGroupe, cookie);

  const nbPosts    = posts.filter(p => p.type === 'post').length;
  const nbComments = posts.filter(p => p.type === 'comment').length;
  console.log(`[groupe ${groupe.id}] ${posts.length} éléments scrapés — ${nbPosts} posts, ${nbComments} commentaires`);

  if (posts.length === 0) {
    console.warn(`[groupe ${groupe.id}] Aucun contenu récupéré par Apify`);
    return;
  }

  for (let i = 0; i < posts.length; i++) {
    const post = posts[i];
    // Throttle: 1s between Gemini calls to stay within free tier RPM limit
    if (i > 0) await new Promise(r => setTimeout(r, 1100));

    const { produit, score } = await classifierPost(post.texte, {
      type: post.type,
      contextePost: post.contextePost,
    });

    // Log every item with its score for diagnosis
    const preview = post.texte.slice(0, 60).replace(/\n/g, ' ');
    console.log(`[groupe ${groupe.id}] [${post.type}] score=${score.toFixed(2)} produit=${produit ?? '—'} | "${preview}"`);

    if (shouldCreateLead(score, seuil)) {
      await kiosqApi.creerLead({
        groupeSurveilleId: groupe.id,
        texteOriginal: post.texte,
        produitDetecte: produit ?? undefined,
        scoreConfiance: score,
        lienPost: post.lien || undefined,
      });
      console.log(`[groupe ${groupe.id}] ✓ Lead créé (score=${score.toFixed(2)}, produit=${produit ?? '—'})`);
    } else {
      console.log(`[groupe ${groupe.id}] ✗ Ignoré (score=${score.toFixed(2)} < seuil=${seuil})`);
    }
  }
}

export async function main(): Promise<void> {
  validateBotEnv();

  const seuil = getScoreSeuil();
  console.log(`[bot] Démarrage — seuil=${seuil}`);

  const groupes = await kiosqApi.getGroupesActifs();
  console.log(`[bot] ${groupes.length} groupe(s) actif(s)`);

  for (const groupe of groupes) {
    try {
      await processGroupe(groupe, seuil);
    } catch (err) {
      console.error(`[groupe ${groupe.id}]`, err);
      try {
        await kiosqApi.updateGroupeStatut(groupe.id, 'erreur');
      } catch (updateErr) {
        // Non-fatal — just log as warning (e.g. group was deleted or ID mismatch)
        console.warn(`[groupe ${groupe.id}] Impossible de mettre à jour le statut (non fatal):`, (updateErr as Error).message);
      }
    }
  }

  console.log('[bot] Terminé');
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (isMain) {
  main().catch(err => {
    if (err instanceof AuthError) {
      console.error('[bot] Erreur d\'authentification — arrêt');
      process.exit(1);
    }
    console.error('[bot] Erreur fatale:', err);
    process.exit(1);
  });
}
