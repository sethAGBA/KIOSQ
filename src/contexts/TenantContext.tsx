/**
 * TenantContext — React context that surfaces the current tenant's public info.
 *
 * Wraps the Zustand `useTenantStore` so that components can consume tenant data
 * through a standard React context / hook interface without a direct Zustand
 * dependency.
 *
 * Usage:
 *   // In the component tree (already done in App.tsx):
 *   <TenantProvider>{children}</TenantProvider>
 *
 *   // In any component:
 *   const { tenantId, tenantNom, plan, statut } = useTenant();
 *
 * Requirements: 9.1, 9.4
 */

import { createContext, useContext, type ReactNode } from 'react';
import { useTenantStore } from '@/store/tenantStore';

// ── Context value type ────────────────────────────────────────────────────────

interface TenantContextValue {
  tenantId: string | null;
  tenantNom: string | null;
  plan: 'starter' | 'pro' | 'enterprise' | null;
  statut: 'actif' | 'suspendu' | 'essai' | null;
}

// ── Context ───────────────────────────────────────────────────────────────────

export const TenantContext = createContext<TenantContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

interface TenantProviderProps {
  children: ReactNode;
}

export function TenantProvider({ children }: TenantProviderProps) {
  const tenantId = useTenantStore((s) => s.tenantId);
  const nom      = useTenantStore((s) => s.nom);
  const plan     = useTenantStore((s) => s.plan);
  const statut   = useTenantStore((s) => s.statut);

  const value: TenantContextValue = {
    tenantId,
    tenantNom: nom,
    plan,
    statut,
  };

  return (
    <TenantContext.Provider value={value}>
      {children}
    </TenantContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * Returns the current tenant context.
 * Must be used inside a <TenantProvider> (provided at the root via App.tsx).
 */
export function useTenant(): TenantContextValue {
  const ctx = useContext(TenantContext);
  if (ctx === null) {
    throw new Error('useTenant must be used within a <TenantProvider>');
  }
  return ctx;
}
