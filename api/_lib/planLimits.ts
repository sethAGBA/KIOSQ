import { eq, and, count } from 'drizzle-orm';
import type { VercelResponse } from '@vercel/node';
import type { Db } from '../../db/client.js';
import { tenants, users, produits, magasins } from '../../db/schema.js';

// ── Plan limits ───────────────────────────────────────────

export const PLAN_LIMITS = {
  starter:    { users: 2,        produits: 500,      magasins: 1,        leads: false, whatsapp: false },
  pro:        { users: 10,       produits: Infinity, magasins: 3,        leads: true,  whatsapp: true  },
  enterprise: { users: Infinity, produits: Infinity, magasins: Infinity, leads: true,  whatsapp: true  },
} as const;

export type PlanName = keyof typeof PLAN_LIMITS;
export type LimitedResource = 'users' | 'produits' | 'magasins';

// Plan hierarchy for upgrade messaging
const NEXT_PLAN: Record<PlanName, PlanName | null> = {
  starter:    'pro',
  pro:        'enterprise',
  enterprise: null,
};

// ── getPlanLimitForResource ───────────────────────────────

/**
 * Returns the numeric ceiling for a given plan + resource.
 * Returns Infinity for unlimited resources.
 */
export function getPlanLimitForResource(plan: PlanName, resource: LimitedResource): number {
  return PLAN_LIMITS[plan][resource] as number;
}

// ── checkPlanLimit ────────────────────────────────────────

/**
 * Checks whether a tenant has reached their plan's limit for the given resource.
 *
 * @returns `true`  if the limit is not yet reached (creation is allowed)
 * @returns `false` if the limit is reached — writes a 403 response before returning
 */
export async function checkPlanLimit(
  db: Db,
  tenantId: string,
  resource: LimitedResource,
  res: VercelResponse
): Promise<boolean> {
  // 1. Load the tenant's current plan
  const [tenant] = await db
    .select({ plan: tenants.plan })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  if (!tenant) {
    res.status(404).json({ error: 'Boutique introuvable' });
    return false;
  }

  const plan = tenant.plan as PlanName;
  const limit = getPlanLimitForResource(plan, resource);

  // 2. Unlimited — skip the count query
  if (limit === Infinity) {
    return true;
  }

  // 3. Count active records for this tenant + resource
  let currentCount = 0;

  if (resource === 'users') {
    const [row] = await db
      .select({ value: count() })
      .from(users)
      .where(and(eq(users.tenantId, tenantId), eq(users.actif, true)));
    currentCount = Number(row?.value ?? 0);
  } else if (resource === 'produits') {
    const [row] = await db
      .select({ value: count() })
      .from(produits)
      .where(and(eq(produits.tenantId, tenantId), eq(produits.actif, true)));
    currentCount = Number(row?.value ?? 0);
  } else if (resource === 'magasins') {
    const [row] = await db
      .select({ value: count() })
      .from(magasins)
      .where(and(eq(magasins.tenantId, tenantId), eq(magasins.actif, true)));
    currentCount = Number(row?.value ?? 0);
  }

  // 4. Reject if at (or over) the limit
  if (currentCount >= limit) {
    const nextPlan = NEXT_PLAN[plan];
    const message = nextPlan
      ? `Limite de ${resource} atteinte pour le plan ${plan}. Passez au plan ${nextPlan}.`
      : `Limite de ${resource} atteinte pour le plan ${plan}.`;
    res.status(403).json({ error: message });
    return false;
  }

  return true;
}
