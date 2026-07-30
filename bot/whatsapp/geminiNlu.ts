import type { IntentName, NluResult, SessionStep } from './types.ts';

const VALID_INTENTS = new Set<IntentName>([
  'PARCOURIR_CATALOGUE',
  'AJOUTER_PRODUIT',
  'CONFIRMER_COMMANDE',
  'VOIR_STATUT',
  'MODIFIER_PANIER',
  'ANNULER',
  'AIDE',
  'INCONNU',
]);

const FALLBACK: NluResult = { intent: 'INCONNU', score: 0 };

const PROMPT_NLU = `Tu es l'assistant de commande d'une boutique. Analyse le message suivant d'un client WhatsApp et identifie :
1. L'intention parmi : PARCOURIR_CATALOGUE, AJOUTER_PRODUIT, CONFIRMER_COMMANDE, VOIR_STATUT, MODIFIER_PANIER, ANNULER, AIDE, INCONNU
2. Le produit mentionné (ou null)
3. La quantité mentionnée (ou null)

Contexte actuel de la session :
{{SESSION_CONTEXT}}

Réponds UNIQUEMENT en JSON valide :
{"intent": "<INTENT>", "score": <0-1>, "produit": "<nom ou null>", "quantite": <nombre ou null>}`;

/**
 * Classifie un message WhatsApp via l'API Gemini pour identifier l'intention du client.
 *
 * Validates: Requirements 7.1, 7.2, 7.3, 7.5, 7.6
 *
 * @param message       - Le texte du message WhatsApp entrant
 * @param sessionContext - Le contexte courant de la session (étape et taille du panier)
 * @param fetchFn       - Fonction fetch injectable (pour les tests)
 * @returns NluResult avec intent, score, produit et quantite
 */
export async function classifierMessage(
  message: string,
  sessionContext: { step: SessionStep; panierSize: number },
  fetchFn: typeof fetch = fetch,
): Promise<NluResult> {
  const apiKey = process.env.GEMINI_API_KEY ?? '';
  const model = process.env.GEMINI_MODEL ?? 'gemini-2.0-flash';

  if (!apiKey) {
    return FALLBACK;
  }

  const prompt = PROMPT_NLU.replace('{{SESSION_CONTEXT}}', JSON.stringify(sessionContext));
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const body = {
    contents: [{ parts: [{ text: prompt + '\n\nMessage : ' + message }] }],
    generationConfig: { responseMimeType: 'application/json' },
  };

  try {
    const res = await fetchFn(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      return FALLBACK;
    }

    const json = await res.json() as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };

    const raw = json.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!raw) {
      return FALLBACK;
    }

    return parseNluResult(raw);
  } catch {
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
    };

    const intent = parsed.intent;
    if (typeof intent !== 'string' || !VALID_INTENTS.has(intent as IntentName)) {
      return FALLBACK;
    }

    const score = typeof parsed.score === 'number'
      ? Math.min(1, Math.max(0, parsed.score))
      : 0;

    const produit = typeof parsed.produit === 'string'
      ? parsed.produit
      : null;

    const quantite = typeof parsed.quantite === 'number'
      ? parsed.quantite
      : null;

    return { intent: intent as IntentName, score, produit, quantite };
  } catch {
    return FALLBACK;
  }
}
