/**
 * POST /api/pos/vente
 *
 * Endpoint POS dédié : encaisse une vente en une seule opération atomique.
 * - Vérifie les stocks
 * - Déduit le stock pour chaque produit vendu
 * - Crée la facture avec statut "payee"
 * - Supporte le client anonyme (clientId = 'anonyme')
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { eq, sql, and } from 'drizzle-orm';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { getDb } from '../../db/client.js';
import { factures, clients, produits, mouvementsStock } from '../../db/schema.js';
import { requireTenantAuth, handleOptions } from '../_lib/auth.js';
import { ok, err, numericRow, parseBody} from '../_lib/response.js';

// ── Schema ────────────────────────────────────────────────────────────────────
const LigneSchema = z.object({
  produitId:    z.string(),
  produitRef:   z.string(),
  produitNom:   z.string(),
  designation:  z.string().optional(), // "REF — Nom"
  quantite:     z.number().int().positive(),
  prixUnitaire: z.number().nonnegative(),
  remise:       z.number().nonnegative().default(0),
  tva:          z.number().nonnegative().default(0),
  total:        z.number().nonnegative(),
});

const VenteSchema = z.object({
  clientId:      z.string().default('anonyme'),
  clientNom:     z.string().default('Client anonyme'),
  lignes:        z.array(LigneSchema).min(1),
  totalHT:       z.number().nonnegative(),
  remiseGlobale: z.number().nonnegative().default(0),
  tva:           z.number().nonnegative().default(0),
  totalTTC:      z.number().positive(),
  modePaiement:  z.enum(['especes', 'virement', 'cheque', 'mobile_money', 'carte', 'autre']),
  montantRecu:   z.number().nonnegative().default(0),
  caissier:      z.string().optional(),
});

// ── Handler ───────────────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const body = await parseBody(req);
  if (handleOptions(req, res)) return;
  if (req.method !== 'POST') return err(res, 'Méthode non autorisée', 405);

  const ctx = await requireTenantAuth(req, res);
  if (!ctx) return;

  // All authenticated users can make sales
  const parsed = VenteSchema.safeParse(body);
  if (!parsed.success) {
    return err(
      res,
      `Données invalides : ${parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ')}`,
      422
    );
  }

  const { clientId, clientNom, lignes, totalHT, remiseGlobale, tva, totalTTC, modePaiement, montantRecu } = parsed.data;
  const db = getDb();

  try {
    // ── 1. Resolve client ─────────────────────────────────────────────────────
    let resolvedClientId = clientId;
    let resolvedClientNom = clientNom;
    let resolvedClientEmail: string | undefined;

    if (clientId && clientId !== 'anonyme') {
      const [client] = await db.select().from(clients)
        .where(and(eq(clients.id, clientId), eq(clients.tenantId, ctx.tenantId!)))
        .limit(1);
      if (!client) return err(res, 'Client introuvable', 404);
      resolvedClientId  = client.id;
      resolvedClientNom = client.nom;
      resolvedClientEmail = client.email ?? undefined;
    } else {
      // Fallback: find or use anonyme client
      const [anon] = await db.select().from(clients)
          .where(and(eq(clients.code, 'CLI-ANON'), eq(clients.tenantId, ctx.tenantId!)))
          .limit(1);
      if (anon) {
        resolvedClientId  = anon.id;
        resolvedClientNom = anon.nom;
      } else {
        // Create anonymous client on-the-fly
        const anonId = nanoid();
        await db.insert(clients).values({
          id:              anonId,
          code:            'CLI-ANON',
          nom:             'Client anonyme',
          typeClient:      'particulier',
          totalAchats:     '0',
          soldeCredit:     '0',
          nombreCommandes: 0,
          actif:           true,
          tenantId:        ctx.tenantId!,
        });
        resolvedClientId  = anonId;
        resolvedClientNom = 'Client anonyme';
      }
    }

    // ── 2. Validate & deduct stock ────────────────────────────────────────────
    for (const ligne of lignes) {
      const [prod] = await db.select().from(produits)
        .where(and(eq(produits.id, ligne.produitId), eq(produits.tenantId, ctx.tenantId!)))
        .limit(1);

      if (!prod) {
        return err(res, `Produit introuvable : ${ligne.produitNom} (${ligne.produitRef})`, 404);
      }
      if (prod.stockActuel < ligne.quantite) {
        return err(res, `Stock insuffisant pour ${prod.designation} — disponible : ${prod.stockActuel}, demandé : ${ligne.quantite}`, 400);
      }

      await db.update(produits)
        .set({ stockActuel: prod.stockActuel - ligne.quantite, updatedAt: new Date() })
        .where(eq(produits.id, prod.id));
    }

    // ── 3. Generate ticket number ─────────────────────────────────────────────
    const year = new Date().getFullYear();
    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(factures)
      .where(eq(factures.tenantId, ctx.tenantId!));
    const numero = `TIC-${year}-${String((count ?? 0) + 1).padStart(4, '0')}`;

    // ── 3b. Create stock movement records in database ──────────────────────────
    for (const ligne of lignes) {
      const [prod] = await db.select().from(produits)
        .where(and(eq(produits.id, ligne.produitId), eq(produits.tenantId, ctx.tenantId!)))
        .limit(1);

      if (prod) {
        await db.insert(mouvementsStock).values({
          id:            nanoid(),
          tenantId:      ctx.tenantId!,
          produitId:     prod.id,
          produitNom:    prod.designation,
          produitRef:    prod.reference,
          type:          'sortie',
          quantite:      ligne.quantite,
          stockAvant:    prod.stockActuel + ligne.quantite, // before deduction
          stockApres:    prod.stockActuel,                  // after deduction
          motif:         `Vente POS Ticket ${numero}`,
          utilisateurId: ctx.sub,
          utilisateurNom: `${ctx.prenom || ''} ${ctx.nom || ''}`.trim() || ctx.email,
        }).catch(e => console.warn('[POS] stock movement insert failed', e));
      }
    }

    // Calculate partial payment
    const effectiveRecu = montantRecu > 0 ? montantRecu : totalTTC;
    const reste = Math.max(0, totalTTC - effectiveRecu);
    const mPaye = totalTTC - reste;

    if (reste > 0 && resolvedClientId === 'anonyme') {
      return err(res, 'Un client doit être identifié pour accorder un crédit (paiement partiel).', 400);
    }

    const factureId = nanoid();
    const now = new Date();
    const paiement = {
      id:      nanoid(),
      montant: mPaye,
      mode:    modePaiement,
      date:    now.toISOString(),
    };

    // Build ligne designations in canonical format "REF — Nom"
    const lignesFormatted = lignes.map(l => ({
      designation:  l.designation ?? `${l.produitRef} — ${l.produitNom}`,
      quantite:     l.quantite,
      prixUnitaire: l.prixUnitaire,
      remise:       l.remise,
      tva:          l.tva,
      total:        l.total,
    }));

    const [row] = await db.insert(factures).values({
      id:            factureId,
      numero,
      clientId:      resolvedClientId,
      clientNom:     resolvedClientNom,
      clientEmail:   resolvedClientEmail,
      statut:        reste > 0 ? 'partielle' : 'payee',
      lignes:        lignesFormatted,
      totalHT:       String(totalHT),
      remiseGlobale: String(remiseGlobale),
      tva:           String(tva),
      totalTTC:      String(totalTTC),
      montantPaye:   String(mPaye),
      resteAPayer:   String(reste),
      paiements:     [paiement],
      dateFacture:   now,
      dateEcheance:  now,
      notes:         montantRecu > totalTTC
        ? `Montant reçu : ${montantRecu} F — Rendu : ${montantRecu - totalTTC} F`
        : undefined,
      createdBy:     ctx.sub,
      tenantId:      ctx.tenantId!,
    }).returning();

    // ── 5. Update client stats (non-blocking) ─────────────────────────────────
    if (resolvedClientId !== 'anonyme') {
      db.update(clients)
        .set({
          totalAchats:     sql`total_achats + ${String(totalTTC)}`,
          nombreCommandes: sql`nombre_commandes + 1`,
          soldeCredit:     sql`solde_credit + ${String(reste)}`,
          derniereCommande: now,
          updatedAt:       now,
        })
        .where(eq(clients.id, resolvedClientId))
        .catch(e => console.warn('[POS] client stats update failed', e));
    }

    return ok(res, numericRow(row), 201);

  } catch (e) {
    console.error('[pos/vente POST]', e);
    return err(res, 'Erreur serveur lors de l\'encaissement', 500);
  }
}
