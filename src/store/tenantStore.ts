/**
 * Zustand store for the current tenant context.
 *
 * After creation the store registers itself with `src/lib/tenant.ts` via
 * `registerTenantStore(useTenantStore)` so that `getTenantId()` can fall back
 * to the store when sessionStorage is stale or unavailable.
 *
 * Requirements: 9.1, 9.4
 */

import { create } from 'zustand';
import { registerTenantStore } from '@/lib/tenant';

// ── Types ─────────────────────────────────────────────────────────────────────

type Plan = 'starter' | 'pro' | 'enterprise';
type Statut = 'actif' | 'suspendu' | 'essai';

interface TenantState {
  tenantId: string | null;
  nom: string | null;
  plan: Plan | null;
  statut: Statut | null;
  isImpersonating: boolean;
  impersonatedTenantNom: string | null;

  /** Resolves tenant info from /api/tenants/resolve?slug=xxx and stores it. */
  resolve: (slug: string) => Promise<void>;

  /**
   * Clears the impersonation session:
   *  - resets isImpersonating & impersonatedTenantNom
   *  - removes the impersonation JWT from localStorage
   */
  clearImpersonation: () => void;
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useTenantStore = create<TenantState>()((set) => ({
  tenantId: 'tenant_demo',
  nom: 'Boutique Démo',
  plan: 'pro',
  statut: 'actif',
  isImpersonating: false,
  impersonatedTenantNom: null,

  resolve: async (slug: string) => {
    try {
      const res = await fetch(`/api/tenants/resolve?slug=${encodeURIComponent(slug)}`);
      if (!res.ok) return;

      const data = await res.json();

      set({
        tenantId: data.tenantId ?? null,
        nom:      data.nom     ?? null,
        plan:     data.plan    ?? null,
        statut:   data.statut  ?? null,
      });
    } catch (err) {
      console.error('[tenantStore.resolve]', err);
    }
  },

  clearImpersonation: () => {
    // Remove the impersonation JWT that was stored during the impersonation flow.
    // Convention: stored under 'kiosq-impersonation-token' in localStorage.
    try {
      localStorage.removeItem('kiosq-impersonation-token');
    } catch {
      // localStorage unavailable — ignore
    }

    set({
      isImpersonating:        false,
      impersonatedTenantNom:  null,
    });
  },
}));

// ── Register with tenant.ts so getTenantId() can use the store ────────────────

registerTenantStore(useTenantStore);
