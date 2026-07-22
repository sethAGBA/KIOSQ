import type { VercelRequest, VercelResponse } from '@vercel/node';
import { eq } from 'drizzle-orm';
import { getDb } from '../../db/client.js';
import { users } from '../../db/schema.js';
import { requireTenantAuth, handleOptions } from '../_lib/auth.js';
import { ok, err, parseBody } from '../_lib/response.js';

/**
 * GET /api/onboarding
 *   Returns { premiereConnexion, onboardingStep } for the current user.
 *
 * PATCH /api/onboarding
 *   Body: { onboardingStep?: number (0–5) } | { ignore: true }
 *   - Updates onboardingStep when provided.
 *   - Sets premiereConnexion = false when onboardingStep reaches 5
 *     or when body contains { ignore: true }.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) return;

  const ctx = await requireTenantAuth(req, res);
  if (!ctx) return;

  const db = getDb();

  // ── GET ──────────────────────────────────────────────────
  if (req.method === 'GET') {
    try {
      const [user] = await db
        .select({
          premiereConnexion: users.premiereConnexion,
          onboardingStep:    users.onboardingStep,
        })
        .from(users)
        .where(eq(users.id, ctx.sub))
        .limit(1);

      if (!user) {
        return err(res, 'Utilisateur introuvable', 404);
      }

      return ok(res, {
        premiereConnexion: user.premiereConnexion,
        onboardingStep:    user.onboardingStep,
      });
    } catch (e) {
      console.error('[onboarding GET]', e);
      return err(res, 'Erreur serveur', 500);
    }
  }

  // ── PATCH ────────────────────────────────────────────────
  if (req.method === 'PATCH') {
    let body: { onboardingStep?: unknown; ignore?: unknown };
    try {
      body = await parseBody(req);
    } catch {
      return err(res, 'Corps de requête invalide', 400);
    }

    const isIgnore = body.ignore === true;

    // Validate onboardingStep when provided
    if (!isIgnore && body.onboardingStep !== undefined) {
      const step = Number(body.onboardingStep);
      if (!Number.isInteger(step) || step < 0 || step > 5) {
        return err(res, 'onboardingStep doit être un entier entre 0 et 5', 422);
      }
    }

    try {
      const updates: Partial<{ onboardingStep: number; premiereConnexion: boolean }> = {};

      if (isIgnore) {
        // User explicitly skips the onboarding wizard
        updates.premiereConnexion = false;
      } else if (body.onboardingStep !== undefined) {
        const step = Number(body.onboardingStep);
        updates.onboardingStep = step;
        if (step === 5) {
          // Final step completed — mark onboarding as done
          updates.premiereConnexion = false;
        }
      } else {
        return err(res, 'Paramètre manquant : onboardingStep ou ignore requis', 422);
      }

      await db
        .update(users)
        .set(updates)
        .where(eq(users.id, ctx.sub));

      // Return the updated state
      const [updated] = await db
        .select({
          premiereConnexion: users.premiereConnexion,
          onboardingStep:    users.onboardingStep,
        })
        .from(users)
        .where(eq(users.id, ctx.sub))
        .limit(1);

      return ok(res, {
        premiereConnexion: updated.premiereConnexion,
        onboardingStep:    updated.onboardingStep,
      });
    } catch (e) {
      console.error('[onboarding PATCH]', e);
      return err(res, 'Erreur serveur', 500);
    }
  }

  return err(res, 'Méthode non autorisée', 405);
}
