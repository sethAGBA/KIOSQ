import type { VercelRequest, VercelResponse } from '@vercel/node';
import { clearAuthCookie, handleOptions } from '../_lib/auth';
import { ok } from '../_lib/response';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) return;
  clearAuthCookie(res);
  return ok(res, { message: 'Déconnecté' });
}
