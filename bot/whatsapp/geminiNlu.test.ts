import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { classifierMessage } from './geminiNlu.ts';

// ── helpers ──────────────────────────────────────────────────────────────────

const SESSION = { step: 'MENU_PRINCIPAL' as const, panierSize: 0 };

function makeFetch(status: number, body: unknown): typeof fetch {
  return async () =>
    ({
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    }) as Response;
}

function geminiResponse(text: string): unknown {
  return {
    candidates: [{ content: { parts: [{ text }] } }],
  };
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('classifierMessage', () => {
  const originalKey = process.env.GEMINI_API_KEY;

  beforeEach(() => {
    process.env.GEMINI_API_KEY = 'test-key';
  });

  afterEach(() => {
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalKey;
  });

  it('returns fallback when GEMINI_API_KEY is absent', async () => {
    delete process.env.GEMINI_API_KEY;
    const result = await classifierMessage('je veux commander du riz', SESSION);
    expect(result).toEqual({ intent: 'INCONNU', score: 0 });
  });

  it('returns fallback when fetch throws', async () => {
    const errorFetch: typeof fetch = async () => {
      throw new Error('Network error');
    };
    const result = await classifierMessage('bonjour', SESSION, errorFetch);
    expect(result).toEqual({ intent: 'INCONNU', score: 0 });
  });

  it('returns fallback on non-ok HTTP response', async () => {
    const result = await classifierMessage(
      'bonjour',
      SESSION,
      makeFetch(500, {}),
    );
    expect(result).toEqual({ intent: 'INCONNU', score: 0 });
  });

  it('returns fallback when Gemini response has no text', async () => {
    const result = await classifierMessage(
      'bonjour',
      SESSION,
      makeFetch(200, { candidates: [] }),
    );
    expect(result).toEqual({ intent: 'INCONNU', score: 0 });
  });

  it('parses a valid NLU response correctly', async () => {
    const payload = JSON.stringify({
      intent: 'AJOUTER_PRODUIT',
      score: 0.95,
      produit: 'riz',
      quantite: 2,
    });
    const result = await classifierMessage(
      'je veux 2 kg de riz',
      SESSION,
      makeFetch(200, geminiResponse(payload)),
    );
    expect(result).toEqual({
      intent: 'AJOUTER_PRODUIT',
      score: 0.95,
      produit: 'riz',
      quantite: 2,
    });
  });

  it('parses null produit and quantite', async () => {
    const payload = JSON.stringify({
      intent: 'PARCOURIR_CATALOGUE',
      score: 0.8,
      produit: null,
      quantite: null,
    });
    const result = await classifierMessage(
      'montre-moi le catalogue',
      SESSION,
      makeFetch(200, geminiResponse(payload)),
    );
    expect(result).toEqual({
      intent: 'PARCOURIR_CATALOGUE',
      score: 0.8,
      produit: null,
      quantite: null,
    });
  });

  it('returns fallback when intent is not a valid IntentName', async () => {
    const payload = JSON.stringify({
      intent: 'INVALID_INTENT',
      score: 0.9,
      produit: null,
      quantite: null,
    });
    const result = await classifierMessage(
      'test',
      SESSION,
      makeFetch(200, geminiResponse(payload)),
    );
    expect(result).toEqual({ intent: 'INCONNU', score: 0 });
  });

  it('clamps score to [0, 1]', async () => {
    const payload = JSON.stringify({ intent: 'AIDE', score: 1.5, produit: null, quantite: null });
    const result = await classifierMessage(
      'aide',
      SESSION,
      makeFetch(200, geminiResponse(payload)),
    );
    expect(result.score).toBe(1);
  });

  it('handles JSON wrapped in markdown code fences', async () => {
    const payload = '```json\n{"intent":"CONFIRMER_COMMANDE","score":0.99,"produit":null,"quantite":null}\n```';
    const result = await classifierMessage(
      'oui confirme',
      SESSION,
      makeFetch(200, geminiResponse(payload)),
    );
    expect(result.intent).toBe('CONFIRMER_COMMANDE');
    expect(result.score).toBe(0.99);
  });

  it('includes sessionContext in the prompt body sent to Gemini', async () => {
    let capturedBody: string | undefined;
    const captureFetch: typeof fetch = async (_url, init) => {
      capturedBody = init?.body as string;
      const payload = JSON.stringify({ intent: 'INCONNU', score: 0, produit: null, quantite: null });
      return makeFetch(200, geminiResponse(payload))(_url, init);
    };
    const ctx = { step: 'PANIER' as const, panierSize: 3 };
    await classifierMessage('test', ctx, captureFetch);
    // The body is JSON-stringified, so the context JSON appears escaped inside the outer string.
    // Parse it back to check the prompt text actually contains the context.
    const parsed = JSON.parse(capturedBody!) as { contents: { parts: { text: string }[] }[] };
    const promptText = parsed.contents[0].parts[0].text;
    expect(promptText).toContain(JSON.stringify(ctx));
  });
});
