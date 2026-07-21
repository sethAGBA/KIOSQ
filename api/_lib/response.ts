import type { VercelResponse, VercelRequest } from '@vercel/node';

export function ok(res: VercelResponse, data: unknown, status = 200) {
  return res.status(status).json({ ok: true, data });
}

export function err(res: VercelResponse, message: string, status = 400) {
  return res.status(status).json({ ok: false, error: message });
}

/**
 * Read and parse the request body.
 * @vercel/node v5 in ESM mode sometimes doesn't auto-parse req.body.
 * This helper reads from the stream as a fallback.
 */
export async function parseBody<T = unknown>(req: VercelRequest): Promise<T> {
  if (req.body !== undefined) return req.body as T;
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk: Buffer) => { data += chunk.toString(); });
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        resolve({} as T);
      }
    });
    req.on('error', reject);
  });
}

/** Convert Drizzle numeric strings to numbers in a row */
export function numericRow<T extends Record<string, unknown>>(row: T): T {
  const numericFields = [
    'prixAchat','prixVente','prixVenteGros','stockActuel','stockMinimum',
    'soldeDette','totalAchats','totalHT','totalTTC','remiseGlobale','tva',
    'acompte','resteAPayer','montantPaye','soldeCredit','nombreCommandes',
    'fraisLivraison',
  ];
  const out = { ...row };
  for (const k of numericFields) {
    if (k in out && out[k] !== null && out[k] !== undefined) {
      (out as Record<string, unknown>)[k] = Number(out[k]);
    }
  }
  return out;
}

export function numericRows<T extends Record<string, unknown>>(rows: T[]): T[] {
  return rows.map(numericRow);
}
