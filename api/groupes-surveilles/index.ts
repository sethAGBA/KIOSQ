import type { VercelRequest, VercelResponse } from '@vercel/node';
import { eq, and, desc } from 'drizzle-orm';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { getDb } from '../../db/client.js';
import { groupesSurveilles } from '../../db/schema.js';
import { encrypt, decrypt } from '../../db/crypto.js';
import { requireTenantAuth, handleOptions } from '../_lib/auth.js';
import { ok, err, parseBody } from '../_lib/response.js';

const GroupeSchema = z.object({
  nomGroupe:              z.string().min(1),
  urlGroupe:              z.string().url(),
  cookieSessionPlaintext: z.string().optional(),
  statut:                 z.enum(['actif', 'inactif', 'erreur']).default('actif'),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const body = await parseBody(req);
  if (handleOptions(req, res)) return;
  const ctx = await requireTenantAuth(req, res);
  if (!ctx) return;

  const db = getDb();

  // ── GET /api/groupes-surveilles ───────────────────────
  if (req.method === 'GET') {
    try {
      const rows = await db
        .select()
        .from(groupesSurveilles)
        .where(eq(groupesSurveilles.tenantId, ctx.tenantId!))
        .orderBy(desc(groupesSurveilles.createdAt));

      const canSeeDecrypted = ctx.role === 'commercial' || ctx.role === 'admin';

      const result = rows.map((row) => {
        // Always strip the raw encrypted field
        const { cookieSessionChiffre, ...rest } = row;

        if (canSeeDecrypted && cookieSessionChiffre) {
          const encKey = process.env.COOKIE_ENCRYPTION_KEY;
          if (encKey) {
            try {
              return { ...rest, cookieSession: decrypt(cookieSessionChiffre, encKey) };
            } catch {
              // Decryption failed — omit cookieSession, don't fail the request
              return rest;
            }
          }
          // Key missing — skip decryption silently, don't fail GET
          return rest;
        }

        return rest;
      });

      return ok(res, result);
    } catch (e) {
      console.error('[groupes-surveilles GET]', e);
      return err(res, 'Erreur serveur', 500);
    }
  }

  // ── POST /api/groupes-surveilles ──────────────────────
  if (req.method === 'POST') {
    if (ctx.role !== 'admin') {
      return err(res, 'Accès refusé', 403);
    }

    const parsed = GroupeSchema.safeParse(body);
    if (!parsed.success) return err(res, 'Données invalides', 422);

    const { nomGroupe, urlGroupe, cookieSessionPlaintext, statut } = parsed.data;

    try {
      // Check URL uniqueness within tenant
      const existing = await db
        .select({ id: groupesSurveilles.id })
        .from(groupesSurveilles)
        .where(and(
          eq(groupesSurveilles.urlGroupe, urlGroupe),
          eq(groupesSurveilles.tenantId, ctx.tenantId!),
        ));

      if (existing.length > 0) {
        return err(res, 'Un groupe avec cette URL existe déjà', 409);
      }

      // Encrypt cookie if provided
      let cookieSessionChiffre: string | null = null;
      if (cookieSessionPlaintext) {
        const encKey = process.env.COOKIE_ENCRYPTION_KEY;
        if (!encKey) {
          return err(res, 'Configuration manquante : COOKIE_ENCRYPTION_KEY', 500);
        }
        cookieSessionChiffre = encrypt(cookieSessionPlaintext, encKey);
      }

      const [row] = await db
        .insert(groupesSurveilles)
        .values({
          id: nanoid(),
          nomGroupe,
          urlGroupe,
          cookieSessionChiffre,
          statut,
          tenantId: ctx.tenantId!,
        })
        .returning();

      // Strip cookieSessionChiffre from response
      const { cookieSessionChiffre: _omit, ...responseRow } = row;
      return ok(res, responseRow, 201);
    } catch (e) {
      console.error('[groupes-surveilles POST]', e);
      return err(res, 'Erreur serveur', 500);
    }
  }

  return err(res, 'Méthode non autorisée', 405);
}
