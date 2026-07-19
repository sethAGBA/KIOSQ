import { SignJWT, jwtVerify } from 'jose';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? 'kiosq-dev-secret-change-in-prod'
);

const COOKIE_NAME = 'kiosq_token';
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days

// ── Token ─────────────────────────────────────────────────
export async function signToken(payload: {
  sub: string;
  email: string;
  role: string;
  nom: string;
  prenom: string;
}): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(SECRET);
}

export async function verifyToken(token: string) {
  const { payload } = await jwtVerify(token, SECRET);
  return payload as {
    sub: string;
    email: string;
    role: string;
    nom: string;
    prenom: string;
  };
}

// ── Cookie helpers ────────────────────────────────────────
export function setAuthCookie(res: VercelResponse, token: string) {
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=${token}; HttpOnly; Path=/; Max-Age=${MAX_AGE}; SameSite=Lax${
      process.env.NODE_ENV === 'production' ? '; Secure' : ''
    }`
  );
}

export function clearAuthCookie(res: VercelResponse) {
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`
  );
}

export function getTokenFromRequest(req: VercelRequest): string | null {
  const cookieHeader = req.headers.cookie ?? '';
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`));
  if (match) return match[1];
  // Fallback: Authorization: Bearer <token>
  const authHeader = req.headers.authorization ?? '';
  if (authHeader.startsWith('Bearer ')) return authHeader.slice(7);
  return null;
}

// ── Route guard ───────────────────────────────────────────
export type AuthContext = {
  sub: string;
  email: string;
  role: string;
  nom: string;
  prenom: string;
};

export async function requireAuth(
  req: VercelRequest,
  res: VercelResponse
): Promise<AuthContext | null> {
  const token = getTokenFromRequest(req);
  if (!token) {
    res.status(401).json({ error: 'Non authentifié' });
    return null;
  }
  try {
    return await verifyToken(token);
  } catch {
    res.status(401).json({ error: 'Token invalide ou expiré' });
    return null;
  }
}

// ── CORS + method helpers ─────────────────────────────────
export function setCors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN ?? '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export function handleOptions(req: VercelRequest, res: VercelResponse): boolean {
  setCors(res);
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }
  return false;
}
