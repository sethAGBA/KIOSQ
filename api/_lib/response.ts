import type { VercelResponse } from '@vercel/node';

export function ok(res: VercelResponse, data: unknown, status = 200) {
  return res.status(status).json({ ok: true, data });
}

export function err(res: VercelResponse, message: string, status = 400) {
  return res.status(status).json({ ok: false, error: message });
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
