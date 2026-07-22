const GEMINI_API_KEY = () => process.env.GEMINI_API_KEY ?? '';
const MODEL = () => process.env.GEMINI_MODEL ?? 'gemini-2.0-flash';

export interface ClassificationResult {
  produit: string | null;
  score: number;
}

const PROMPT_POST = `Tu es un assistant commercial. Analyse le texte suivant d'un post Facebook et détermine s'il exprime une intention d'achat.

Réponds UNIQUEMENT en JSON valide avec ce format exact :
{"produit": "<nom du produit recherché ou null>", "score": <nombre entre 0 et 1>}

- score proche de 1 = forte intention d'achat explicite ("je cherche", "je veux acheter", "qui vend", "besoin de", "budget X")
- score proche de 0 = pas d'intention d'achat (offre de vente, discussion, annonce)
- produit = le produit ou service mentionné, null si aucun

Texte du post :
`;

const PROMPT_COMMENT = `Tu es un assistant commercial. Analyse le commentaire suivant publié sous un post Facebook et détermine s'il exprime une intention d'achat ou un intérêt commercial (demande de prix, de disponibilité, de livraison, ou d'information pour acheter).

Réponds UNIQUEMENT en JSON valide avec ce format exact :
{"produit": "<nom du produit ou service concerné ou null>", "score": <nombre entre 0 et 1>}

- score proche de 1 = fort intérêt d'achat ("intéressé", "c'est combien", "vous livrez où", "je prends", "quel est le prix", "je veux", "disponible ?")
- score proche de 0 = commentaire sans intérêt commercial (like, blague, hors sujet)
- produit = déduit du commentaire ET du contexte du post si fourni, null si impossible

`;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function parseGeminiJson(text: string): ClassificationResult {
  const cleaned = text.replace(/```json\n?/g, '').replace(/```/g, '').trim();
  const parsed = JSON.parse(cleaned) as { produit?: string | null; score?: number };
  const score = typeof parsed.score === 'number' ? Math.min(1, Math.max(0, parsed.score)) : 0;
  const produit = parsed.produit ?? null;
  return { produit, score };
}

/**
 * Classifie un post ou commentaire via l'API Gemini.
 * Pour les commentaires, fournir le contexte du post parent améliore la détection du produit.
 */
export async function classifierPost(
  texte: string,
  options: { type?: 'post' | 'comment'; contextePost?: string } = {},
): Promise<ClassificationResult> {
  const apiKey = GEMINI_API_KEY();
  if (!apiKey) throw new Error('GEMINI_API_KEY manquant');

  const { type = 'post', contextePost } = options;

  // Construire le prompt selon le type
  let prompt: string;
  if (type === 'comment') {
    prompt = PROMPT_COMMENT;
    if (contextePost) {
      prompt += `Contexte du post original :\n"${contextePost.slice(0, 300)}"\n\nCommentaire à analyser :\n`;
    } else {
      prompt += `Commentaire à analyser :\n`;
    }
  } else {
    prompt = PROMPT_POST;
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL()}:generateContent?key=${apiKey}`;
  const body = {
    contents: [{ parts: [{ text: prompt + texte }] }],
    generationConfig: { responseMimeType: 'application/json' },
  };

  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      // Rate limited
      if (res.status === 429) {
        const errJson = await res.json().catch(() => ({})) as {
          error?: {
            details?: ({ retryDelay?: string; violations?: { quotaId?: string; limit?: number }[] })[];
          };
        };

        // Check for daily quota exhaustion (limit: 0 means quota is zero, not just exceeded)
        const violations = errJson.error?.details
          ?.flatMap(d => d.violations ?? []) ?? [];
        const isDailyExhausted = violations.some(
          v => v.quotaId?.includes('PerDay') && v.limit === 0
        );

        if (isDailyExhausted) {
          throw new Error(
            '[gemini] Quota journalier épuisé — relancer le bot demain ou activer la facturation sur https://ai.dev/rate-limit'
          );
        }

        // Per-minute rate limit — wait and retry
        const retryDelayStr = errJson.error?.details
          ?.find(d => d.retryDelay)?.retryDelay ?? '60s';
        const retryDelayMs = Math.min(parseFloat(retryDelayStr) * 1000, 120_000);
        console.warn(`[gemini] Rate limited (429) — attente ${Math.ceil(retryDelayMs / 1000)}s…`);
        await sleep(retryDelayMs);
        lastError = new Error(`Gemini HTTP 429 (rate limit)`);
        continue;
      }

      if (res.status >= 500) throw new Error(`Gemini HTTP ${res.status}`);

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Gemini HTTP ${res.status}: ${errText}`);
      }

      const json = await res.json() as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };
      const raw = json.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!raw) throw new Error('Réponse Gemini vide');
      return parseGeminiJson(raw);

    } catch (err) {
      lastError = err;
      if (attempt < 2) await sleep(1000 * Math.pow(2, attempt));
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Échec classification Gemini');
}
