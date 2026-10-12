import type { ArticleCommande, IntentName, NluResult, SessionStep } from './types.js';

const VALID_INTENTS = new Set<IntentName>([
  'PARCOURIR_CATALOGUE',
  'AJOUTER_PRODUIT',
  'COMMANDE_DIRECTE',
  'CONFIRMER_COMMANDE',
  'VOIR_STATUT',
  'MODIFIER_PANIER',
  'SUPPRIMER_ARTICLE',
  'ANNULER',
  'LIVRAISON',
  'QUESTION_PRODUIT',
  'SALUTATION',
  'AIDE',
  'INCONNU',
]);

const FALLBACK: NluResult = { intent: 'INCONNU', score: 0 };

const PROMPT_NLU_TEXT = `Tu es l'assistant de commande WhatsApp intelligent de la boutique Kiosq.
Analyse le message d'un client et comprends son intention globale, ses articles demandés, son adresse ou ses questions.

Règles de classification :
- COMMANDE_DIRECTE : Le client souhaite commander un ou plusieurs articles (ex: "Je veux 2 sacs de riz et 3 huiles", "Livrez-moi 1 pack d'eau", "Ajoute 5 savons").
- AJOUTER_PRODUIT : Le client sélectionne un produit spécifique.
- SUPPRIMER_ARTICLE : Le client veut retirer un article (ex: "Enlève le savon", "Supprime l'article 2", "Je ne veux plus d'huile").
- MODIFIER_PANIER : Le client veut voir ou changer une quantité dans son panier (ex: "Mets 3 bouteilles au lieu de 2").
- CONFIRMER_COMMANDE : Le client valide sa commande (ex: "Je confirme", "Oui c'est bon", "Valider la commande").
- ANNULER : Le client annule son panier ou sa commande (ex: "Annuler tout", "Vider le panier", "Laisse tomber").
- PARCOURIR_CATALOGUE : Le client demande à voir les produits ou le catalogue (ex: "Qu'est-ce que vous vendez ?", "Montrez le catalogue", "Vos prix").
- QUESTION_PRODUIT : Le client demande si un produit est dispo ou son prix (ex: "Avez-vous du lait ?", "Combien coûte le sac de 25kg ?").
- LIVRAISON : Le client donne son adresse ou son quartier (ex: "Je suis à Hedzranawoe face pharmacie", "Livrez à Akodessewa").
- VOIR_STATUT : Le client demande le statut de sa commande (ex: "Où est ma commande ?", "Statut CMD-2025-001").
- SALUTATION : Le client dit bonjour / bonsoir sans commande précise.
- AIDE : Demande d'aide ou d'assistance.

Contexte de la session :
{{SESSION_CONTEXT}}

Tu dois répondre UNIQUEMENT en JSON valide avec la structure suivante :
{
  "intent": "<INTENT>",
  "score": <0.0 à 1.0>,
  "produit": "<nom principal ou null>",
  "quantite": <quantite principale ou null>,
  "articles": [
    { "produit": "<nom>", "quantite": <nombre>, "action": "ajouter"|"supprimer"|"modifier" }
  ],
  "reponseSuggeree": "<courte réponse polie et naturelle en français, max 2 phrases>",
  "numeroCommande": "<numéro détecté ou null>",
  "adresse": "<adresse détectée ou null>"
}`;

const PROMPT_NLU_AUDIO = `Tu es l'assistant vocal de commande WhatsApp de la boutique Kiosq.
Écoute cette note vocale envoyée par un client et :
1. Transcris fidèlement ce que dit le client en français (champ "transcriptionAudio").
2. Détecte les produits et quantités qu'il souhaite commander ou modifier.
3. Détecte son intention (ex: COMMANDE_DIRECTE, CONFIRMER_COMMANDE, QUESTION_PRODUIT, etc.).
4. Détecte son adresse de livraison s'il la mentionne.

Contexte de la session :
{{SESSION_CONTEXT}}

Tu dois répondre UNIQUEMENT en JSON valide :
{
  "transcriptionAudio": "<texte transcrit>",
  "intent": "<INTENT>",
  "score": <0.0 à 1.0>,
  "produit": "<nom principal ou null>",
  "quantite": <quantite principale ou null>,
  "articles": [
    { "produit": "<nom>", "quantite": <nombre>, "action": "ajouter"|"supprimer"|"modifier" }
  ],
  "reponseSuggeree": "<courte réponse polie confirmant ce qui a été compris>",
  "numeroCommande": "<numéro détecté ou null>",
  "adresse": "<adresse détectée ou null>"
}`;

/**
 * Classifie un message texte WhatsApp via l'API Gemini.
 */
export async function classifierMessage(
  message: string,
  sessionContext: { step: SessionStep; panierSize: number; clientNom?: string | null },
  fetchFn: typeof fetch = fetch,
): Promise<NluResult> {
  const apiKey = process.env.GEMINI_API_KEY ?? '';
  const model = process.env.GEMINI_MODEL ?? 'gemini-2.0-flash';

  if (!apiKey) {
    return FALLBACK;
  }

  const prompt = PROMPT_NLU_TEXT.replace('{{SESSION_CONTEXT}}', JSON.stringify(sessionContext));
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const body = {
    contents: [{ parts: [{ text: prompt + '\n\nMessage du client : ' + message }] }],
    generationConfig: { responseMimeType: 'application/json' },
  };

  try {
    const res = await fetchFn(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      console.warn('[geminiNlu] Gemini API HTTP', res.status);
      return FALLBACK;
    }

    const json = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };

    const raw = json.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!raw) return FALLBACK;

    return parseNluResult(raw);
  } catch (err) {
    console.error('[geminiNlu] Erreur appel Gemini:', err);
    return FALLBACK;
  }
}

/**
 * Analyse une note vocale (audio) via Gemini 2.0 Flash multimodal.
 * Transcrit l'audio et extrait automatiquement l'intention et les articles.
 */
export async function transcrireEtAnalyserAudio(
  base64Audio: string,
  mimeType: string,
  sessionContext: { step: SessionStep; panierSize: number; clientNom?: string | null },
  fetchFn: typeof fetch = fetch,
): Promise<NluResult> {
  const apiKey = process.env.GEMINI_API_KEY ?? '';
  const model = process.env.GEMINI_MODEL ?? 'gemini-2.0-flash';

  if (!apiKey) {
    return FALLBACK;
  }

  // Normaliser le mimeType audio pour Gemini (ex: audio/ogg; codecs=opus -> audio/ogg)
  const cleanMimeType = mimeType.split(';')[0]?.trim() || 'audio/ogg';

  const prompt = PROMPT_NLU_AUDIO.replace('{{SESSION_CONTEXT}}', JSON.stringify(sessionContext));
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const body = {
    contents: [
      {
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: cleanMimeType,
              data: base64Audio,
            },
          },
        ],
      },
    ],
    generationConfig: { responseMimeType: 'application/json' },
  };

  try {
    const res = await fetchFn(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      console.warn('[geminiNlu] Audio Gemini API HTTP', res.status);
      return FALLBACK;
    }

    const json = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };

    const raw = json.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!raw) return FALLBACK;

    return parseNluResult(raw);
  } catch (err) {
    console.error('[geminiNlu] Erreur analyse audio Gemini:', err);
    return FALLBACK;
  }
}

function parseNluResult(text: string): NluResult {
  try {
    const cleaned = text.replace(/```json\n?/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned) as {
      intent?: unknown;
      score?: unknown;
      produit?: unknown;
      quantite?: unknown;
      articles?: unknown;
      reponseSuggeree?: unknown;
      numeroCommande?: unknown;
      adresse?: unknown;
      transcriptionAudio?: unknown;
    };

    let intent = parsed.intent as IntentName;
    if (typeof intent !== 'string' || !VALID_INTENTS.has(intent)) {
      intent = 'INCONNU';
    }

    const score = typeof parsed.score === 'number'
      ? Math.min(1, Math.max(0, parsed.score))
      : 0.8;

    const produit = typeof parsed.produit === 'string' ? parsed.produit.trim() : null;
    const quantite = typeof parsed.quantite === 'number' ? parsed.quantite : null;

    let articles: ArticleCommande[] | undefined = undefined;
    if (Array.isArray(parsed.articles)) {
      articles = parsed.articles
        .filter((a): a is { produit: string; quantite?: number; action?: 'ajouter' | 'supprimer' | 'modifier' } =>
          typeof a === 'object' && a !== null && typeof (a as { produit: unknown }).produit === 'string'
        )
        .map(a => ({
          produit: String(a.produit).trim(),
          quantite: typeof a.quantite === 'number' && a.quantite > 0 ? a.quantite : 1,
          action: (a.action === 'supprimer' || a.action === 'modifier') ? a.action : 'ajouter',
        }));
    }

    // Si on a un produit unique mais pas de tableau d'articles, construire le tableau
    if ((!articles || articles.length === 0) && produit) {
      articles = [{ produit, quantite: quantite ?? 1, action: 'ajouter' }];
    }

    const reponseSuggeree = typeof parsed.reponseSuggeree === 'string' ? parsed.reponseSuggeree.trim() : null;
    const numeroCommande = typeof parsed.numeroCommande === 'string' ? parsed.numeroCommande.trim() : null;
    const adresse = typeof parsed.adresse === 'string' ? parsed.adresse.trim() : null;
    const transcriptionAudio = typeof parsed.transcriptionAudio === 'string' ? parsed.transcriptionAudio.trim() : null;

    return {
      intent,
      score,
      produit,
      quantite,
      articles,
      reponseSuggeree,
      numeroCommande,
      adresse,
      transcriptionAudio,
    };
  } catch (err) {
    console.error('[geminiNlu] Erreur parsing JSON Gemini:', err);
    return FALLBACK;
  }
}
