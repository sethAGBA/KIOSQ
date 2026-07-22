/**
 * ImpersonationBanner — visible orange banner when a superadmin is impersonating a tenant.
 *
 * Renders only when `tenantStore.isImpersonating === true`.
 * Displays the impersonated boutique name and the operator's identity.
 * "Terminer l'impersonation" button:
 *   1. Logs `'impersonation.end'` via POST /api/audit-logs
 *   2. Calls `tenantStore.clearImpersonation()` (removes JWT + resets state)
 *   3. Navigates back to /superadmin
 *
 * Requirements: 6.3, 6.4, 6.5
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, X, LogOut } from 'lucide-react';
import { useTenantStore } from '@/store/tenantStore';
import { useAuthStore } from '@/store/authStore';

export default function ImpersonationBanner() {
  const navigate = useNavigate();
  const isImpersonating        = useTenantStore((s) => s.isImpersonating);
  const impersonatedTenantNom  = useTenantStore((s) => s.impersonatedTenantNom);
  const tenantId               = useTenantStore((s) => s.tenantId);
  const clearImpersonation     = useTenantStore((s) => s.clearImpersonation);
  const user                   = useAuthStore((s) => s.user);

  const [ending, setEnding] = useState(false);

  if (!isImpersonating) return null;

  // Operator label: "Prénom NOM" or email fallback
  const operatorLabel =
    user?.prenom || user?.nom
      ? `${user.prenom ?? ''} ${user.nom ?? ''}`.trim()
      : (user?.email ?? 'Superadmin');

  async function handleEnd() {
    if (ending) return;
    setEnding(true);
    try {
      // Log impersonation end via the audit-logs API.
      // The backend route (/api/audit-logs) requires a tenant context which is
      // active during the impersonation session, so we fire-and-forget.
      await fetch('/api/audit-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action:       'impersonation.end',
          resourceType: 'tenant',
          resourceId:   tenantId ?? undefined,
          details:      { boutique: impersonatedTenantNom, operateur: operatorLabel },
        }),
      }).catch(() => {
        // Network error — not critical; the backend may already log this via the
        // impersonation token expiry. Don't block the UI.
        console.warn('[ImpersonationBanner] Could not log impersonation.end');
      });
    } finally {
      // Always clear impersonation and navigate back, even if the log call fails.
      clearImpersonation();
      navigate('/superadmin');
      setEnding(false);
    }
  }

  return (
    <div
      role="alert"
      aria-live="polite"
      className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-white text-sm font-medium shrink-0"
      style={{ backgroundColor: '#f97316' /* orange-500 */ }}
    >
      {/* Left: info */}
      <div className="flex items-center gap-2 min-w-0">
        <Shield size={15} className="shrink-0" aria-hidden />
        <span className="truncate">
          Mode impersonation :&nbsp;
          <span className="font-bold">{impersonatedTenantNom ?? 'boutique inconnue'}</span>
          {' '}—&nbsp;connecté en tant que&nbsp;
          <span className="font-bold">{operatorLabel}</span>
        </span>
      </div>

      {/* Right: end button */}
      <button
        onClick={handleEnd}
        disabled={ending}
        className="shrink-0 flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-colors disabled:opacity-60"
        style={{
          backgroundColor: 'rgba(0,0,0,0.15)',
        }}
        onMouseEnter={(e) => {
          if (!ending) e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.28)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.15)';
        }}
        aria-label="Terminer la session d'impersonation"
      >
        {ending ? (
          <>
            <X size={12} aria-hidden />
            Fin en cours…
          </>
        ) : (
          <>
            <LogOut size={12} aria-hidden />
            Terminer l'impersonation
          </>
        )}
      </button>
    </div>
  );
}
