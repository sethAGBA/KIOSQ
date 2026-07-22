import { SignJWT, jwtVerify } from 'jose';
import { eq } from 'drizzle-orm';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb } from '../../db/client.js';
import { tenants } from '../../db/schema.js';

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
  tenantId?: string | null;
  impersonatedBy?: string;
  expiresIn?: string;
}): Promise<string> {
  const { expiresIn = '7d', ...jwtPayload } = payload;
  return new SignJWT(jwtPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
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
    tenantId?: string | null;
    impersonatedBy?: string;
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

// ── Auth context type ─────────────────────────────────────
export type AuthContext = {
  sub: string;
  email: string;
  role: string;
  nom: string;
  prenom: string;
  tenantId: string | null;   // null pour superadmin
  impersonatedBy?: string;   // présent si session d'impersonation
};

/** AuthContext where tenantId is guaranteed non-null (returned by requireTenantAuth). */
export type TenantAuthContext = Omit<AuthContext, 'tenantId'> & { tenantId: string };

// ── Route guards ──────────────────────────────────────────

/**
 * Backward-compatible guard. Kept for existing routes until they are migrated
 * to requireTenantAuth in tasks 4.x.
 */
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
    const payload = await verifyToken(token);
    return {
      sub: payload.sub,
      email: payload.email,
      role: payload.role,
      nom: payload.nom,
      prenom: payload.prenom,
      tenantId: payload.tenantId ?? null,
      impersonatedBy: payload.impersonatedBy,
    };
  } catch {
    res.status(401).json({ error: 'Token invalide ou expiré' });
    return null;
  }
}

/**
 * Pure helper that checks whether a tenant object should block access.
 * Returns `{ code, message }` if the tenant is blocked, or `null` if access is allowed.
 *
 * Used internally by `requireTenantAuth` and exported for unit/property testing.
 */
export function checkTenantStatus(tenant: {
  statut: 'actif' | 'suspendu' | 'essai';
  dateEssaiFin: Date | null;
  enMaintenance: boolean;
  messageMaintenance: string | null;
}): { code: number; message: string } | null {
  // Suspended tenant
  if (tenant.statut === 'suspendu') {
    return { code: 403, message: 'Boutique suspendue. Contactez le support.' };
  }

  // Trial expired
  if (tenant.statut === 'essai' && tenant.dateEssaiFin && tenant.dateEssaiFin < new Date()) {
    return { code: 403, message: "Période d'essai expirée. Veuillez souscrire à un plan." };
  }

  // Maintenance mode
  if (tenant.enMaintenance) {
    const message = tenant.messageMaintenance ?? 'Service temporairement indisponible pour maintenance.';
    return { code: 503, message };
  }

  return null;
}

/**
 * Guard for tenant-scoped routes.
 * 1. Extracts and verifies JWT → 401 if absent/invalid
 * 2. Requires tenantId in JWT (non-superadmin) → 401 if absent
 * 3. Validates X-Tenant-ID header consistency → 403 if mismatch
 * 4. Loads tenant from DB → 404 if not found
 * 5. Checks tenant status: suspendu → 403, essai expiré → 403, maintenance → 503
 * 6. Returns enriched AuthContext
 */
export async function requireTenantAuth(
  req: VercelRequest,
  res: VercelResponse
): Promise<TenantAuthContext | null> {
  // 1. Extract + verify token
  const token = getTokenFromRequest(req);
  if (!token) {
    res.status(401).json({ error: 'Non authentifié' });
    return null;
  }

  let payload: Awaited<ReturnType<typeof verifyToken>>;
  try {
    payload = await verifyToken(token);
  } catch {
    res.status(401).json({ error: 'Token invalide ou expiré' });
    return null;
  }

  // 2. Require tenantId in JWT
  if (!payload.tenantId) {
    res.status(401).json({ error: 'Non authentifié' });
    return null;
  }

  const tenantId = payload.tenantId;

  // 3. Verify X-Tenant-ID header consistency (if present)
  const headerTenantId = req.headers['x-tenant-id'];
  if (headerTenantId && headerTenantId !== tenantId) {
    res.status(403).json({ error: 'Incohérence de tenant' });
    return null;
  }

  // 4. Load tenant from DB
  const db = getDb();
  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  if (!tenant) {
    res.status(404).json({ error: 'Boutique introuvable' });
    return null;
  }

  // 5a–5c. Check tenant active status
  const statusBlock = checkTenantStatus(tenant);
  if (statusBlock) {
    res.status(statusBlock.code).json({ error: statusBlock.message });
    return null;
  }

  // 6. Return enriched AuthContext
  return {
    sub: payload.sub,
    email: payload.email,
    role: payload.role,
    nom: payload.nom,
    prenom: payload.prenom,
    tenantId,           // tenantId is string here (already verified non-null above)
    impersonatedBy: payload.impersonatedBy,
  } satisfies TenantAuthContext;
}

/**
 * Guard for superadmin-only routes.
 * Calls requireAuth first, then verifies role === 'superadmin'.
 */
export async function requireSuperadmin(
  req: VercelRequest,
  res: VercelResponse
): Promise<AuthContext | null> {
  const token = getTokenFromRequest(req);
  if (!token) {
    res.status(401).json({ error: 'Non authentifié' });
    return null;
  }

  let payload: Awaited<ReturnType<typeof verifyToken>>;
  try {
    payload = await verifyToken(token);
  } catch {
    res.status(401).json({ error: 'Token invalide ou expiré' });
    return null;
  }

  if (payload.role !== 'superadmin') {
    res.status(403).json({ error: 'Accès refusé' });
    return null;
  }

  return {
    sub: payload.sub,
    email: payload.email,
    role: payload.role,
    nom: payload.nom,
    prenom: payload.prenom,
    tenantId: payload.tenantId ?? null,
    impersonatedBy: payload.impersonatedBy,
  };
}

// ── CORS + method helpers ─────────────────────────────────
export function setCors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN ?? '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Tenant-ID');
}

export function handleOptions(req: VercelRequest, res: VercelResponse): boolean {
  setCors(res);
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }
  return false;
}
