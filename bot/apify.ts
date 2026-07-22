const APIFY_TOKEN = () => process.env.APIFY_TOKEN ?? '';
const ACTOR_ID       = () => process.env.APIFY_ACTOR_ID          ?? 'apify~facebook-groups-scraper';
const COMMENTS_ACTOR = () => process.env.APIFY_COMMENTS_ACTOR_ID ?? 'apify~facebook-post-comments-scraper';

export interface ScrapedPost {
  texte: string;
  lien: string;
  type: 'post' | 'comment';
  contextePost?: string;
}

type ApifyRun = { data: { id: string; defaultDatasetId: string; status: string } };

async function apifyFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = APIFY_TOKEN();
  if (!token) throw new Error('APIFY_TOKEN manquant');
  const url = `https://api.apify.com/v2${path}${path.includes('?') ? '&' : '?'}token=${token}`;
  return fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
}

async function waitForRun(runId: string, maxWaitMs = 300_000): Promise<string> {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const res = await apifyFetch(`/actor-runs/${runId}`);
    if (!res.ok) throw new Error(`Apify run status HTTP ${res.status}`);
    const json = await res.json() as ApifyRun;
    const status = json.data.status;
    if (status === 'SUCCEEDED') return json.data.defaultDatasetId;
    if (['FAILED', 'ABORTED', 'TIMED-OUT'].includes(status)) {
      throw new Error(`Apify run ${status}`);
    }
    await new Promise(r => setTimeout(r, 5000));
  }
  throw new Error('Apify run timeout');
}

function extractText(item: Record<string, unknown>): string {
  return (
    (item.text as string | undefined) ??
    (item.message as string | undefined) ??
    (item.postText as string | undefined) ??
    (item.commentText as string | undefined) ??
    ''
  ).trim();
}

function extractLink(item: Record<string, unknown>): string {
  return (
    (item.url as string | undefined) ??
    (item.postUrl as string | undefined) ??
    (item.link as string | undefined) ??
    ''
  );
}

async function fetchComments(postUrl: string, postTexte: string): Promise<ScrapedPost[]> {
  try {
    const runRes = await apifyFetch(`/acts/${COMMENTS_ACTOR()}/runs`, {
      method: 'POST',
      body: JSON.stringify({
        startUrls: [{ url: postUrl }],
        resultsLimit: 30,
      }),
    });
    if (!runRes.ok) {
      console.warn(`[apify] Commentaires: run failed HTTP ${runRes.status} pour ${postUrl}`);
      return [];
    }
    const runJson = await runRes.json() as ApifyRun;
    const datasetId = await waitForRun(runJson.data.id, 120_000); // 2min max per post

    const itemsRes = await apifyFetch(`/datasets/${datasetId}/items`);
    if (!itemsRes.ok) return [];

    const items = await itemsRes.json() as Record<string, unknown>[];
    console.log(`[apify] ${items.length} commentaire(s) récupéré(s) pour le post`);

    return items
      .map(item => {
        const texte = extractText(item);
        if (!texte) return null;
        return {
          texte,
          lien: postUrl,
          type: 'comment' as const,
          contextePost: postTexte,
        };
      })
      .filter((c): c is ScrapedPost => c !== null);
  } catch (err) {
    console.warn(`[apify] Erreur récupération commentaires:`, err);
    return [];
  }
}

export async function scrapeGroupe(urlGroupe: string, cookieSession?: string): Promise<ScrapedPost[]> {
  const input: Record<string, unknown> = {
    startUrls: [{ url: urlGroupe }],
    resultsLimit: 20,
    maxPosts: 20,
  };
  if (cookieSession) {
    input.cookies = [{ name: 'cookie', value: cookieSession }];
    input.sessionCookie = cookieSession;
  }

  const runRes = await apifyFetch(`/acts/${ACTOR_ID()}/runs`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
  if (!runRes.ok) {
    const errText = await runRes.text();
    throw new Error(`Apify run failed: HTTP ${runRes.status} — ${errText}`);
  }

  const runJson = await runRes.json() as ApifyRun;
  const datasetId = await waitForRun(runJson.data.id);

  const itemsRes = await apifyFetch(`/datasets/${datasetId}/items`);
  if (!itemsRes.ok) throw new Error(`Apify dataset HTTP ${itemsRes.status}`);

  const items = await itemsRes.json() as Record<string, unknown>[];

  if (items.length === 0) {
    console.warn('[apify] Dataset vide — Apify n\'a retourné aucun item');
    return [];
  }

  console.log(`[apify] ${items.length} post(s) récupéré(s)`);

  const results: ScrapedPost[] = [];

  for (const item of items) {
    const textePost = extractText(item);
    const lienPost  = extractLink(item);
    const commentsCount = typeof item.commentsCount === 'number' ? item.commentsCount : 0;

    if (textePost) {
      results.push({ texte: textePost, lien: lienPost, type: 'post' });
    }

    // Only fetch comments if the post has some AND we have a URL
    if (commentsCount > 0 && lienPost) {
      console.log(`[apify] Post avec ${commentsCount} commentaire(s) — récupération…`);
      const comments = await fetchComments(lienPost, textePost);
      results.push(...comments);
    }
  }

  return results;
}
