/**
 * AuthGuard — route guard for authenticated tenant users.
 *
 * In addition to checking that the user is authenticated, this guard:
 *  1. Shows a loading state while the tenant is being resolved.
 *  2. Blocks access with an error message if the tenant has status `suspendu`.
 *
 * Superadmin users (role === 'superadmin') bypass tenant checks because their
 * tenantId is null by design — they are platform-level operators, not tied to
 * any boutique.
 *
 * Requirements: 4.1, 4.2
 */

import { useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { useAppStore } from '@/store/appStore';
import { useTenant } from '@/contexts/TenantContext';
import AppLayout from '@/components/layout/AppLayout';

export default function AuthGuard() {
  const { isAuthenticated, refreshMe } = useAuthStore();
  const user = useAuthStore((s) => s.user);
  const { fetchAll } = useAppStore();
  const { tenantId, statut } = useTenant();

  useEffect(() => {
    if (isAuthenticated) {
      // Refresh JWT session silently, then load all data
      refreshMe().catch(() => {});
      fetchAll().catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Superadmins have no tenant — skip tenant checks entirely
  const isSuperadmin = user?.role === 'superadmin';

  if (!isSuperadmin) {
    // Tenant resolution is still in progress — show a neutral loading screen
    if (tenantId === null) {
      return (
        <div className="flex h-screen items-center justify-center bg-background text-sm text-muted-foreground">
          Chargement de votre boutique…
        </div>
      );
    }

    // Tenant is suspended — block access with a clear message
    if (statut === 'suspendu') {
      return (
        <div className="flex h-screen items-center justify-center bg-background">
          <div className="max-w-md rounded-xl border border-red-200 bg-red-50 p-8 text-center shadow-sm">
            <p className="mb-2 text-lg font-semibold text-red-700">Boutique suspendue</p>
            <p className="text-sm text-red-600">
              Votre boutique a été suspendue. Veuillez contacter le support pour rétablir l'accès.
            </p>
          </div>
        </div>
      );
    }
  }

  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  );
}
