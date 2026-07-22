/**
 * AbonnementPage — Subscription usage dashboard for the current tenant.
 *
 * Features:
 *  - Active plan badge + subscription status + trial end date (Req 12.1, 12.2)
 *  - Progress bars per limited resource: users, produits, magasins (Req 12.1)
 *    · Green  < 80%    of limit
 *    · Orange ≥ 80%    of limit
 *    · Red    = 100%   of limit (blocked)
 *  - Plan comparison table with features and limits (Req 12.3)
 *  - "Contacter pour upgrader" button (Req 12.3)
 *  - Real-time data, max 60s cache enforced server-side (Req 12.4)
 *
 * Requirements: 12.1, 12.2, 12.3, 12.4
 */

import { useEffect, useState } from 'react';
import {
  CreditCard,
  Users,
  Package,
  Store,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Mail,
  Zap,
  Building2,
  Star,
} from 'lucide-react';
import PlanBadge from '@/components/superadmin/PlanBadge';
import { USE_API, abonnementApi, type AbonnementData } from '@/lib/api';

// ── Helpers ───────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

/**
 * Returns the fill percentage for a resource bar.
 * If limit is null (unlimited), always 0%.
 */
function usagePercent(used: number, limit: number | null): number {
  if (limit === null || limit === 0) return 0;
  return Math.min(100, Math.round((used / limit) * 100));
}

/**
 * Color based on usage ratio:
 *   < 80%  → green
 *   ≥ 80%  → orange
 *   100%   → red (blocked)
 */
function barColor(pct: number): string {
  if (pct >= 100) return 'bg-red-500';
  if (pct >= 80)  return 'bg-orange-400';
  return 'bg-emerald-500';
}

function labelColor(pct: number): string {
  if (pct >= 100) return 'text-red-600';
  if (pct >= 80)  return 'text-orange-500';
  return 'text-emerald-600';
}

// ── Statut badge ──────────────────────────────────────────

const STATUT_CONFIG = {
  actif:    { label: 'Actif',    className: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  essai:    { label: 'Essai',    className: 'bg-amber-50 text-amber-700 border border-amber-200'       },
  suspendu: { label: 'Suspendu', className: 'bg-red-50 text-red-700 border border-red-200'             },
} as const;

function StatutBadge({ statut }: { statut: 'actif' | 'essai' | 'suspendu' }) {
  const cfg = STATUT_CONFIG[statut];
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.className}`}>
      {cfg.label}
    </span>
  );
}

// ── ResourceBar ───────────────────────────────────────────

interface ResourceBarProps {
  icon: React.ReactNode;
  label: string;
  used: number;
  limit: number | null;
}

function ResourceBar({ icon, label, used, limit }: ResourceBarProps) {
  const pct = usagePercent(used, limit);
  const isUnlimited = limit === null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--color-ink)' }}>
          <span style={{ color: 'var(--color-gold)' }}>{icon}</span>
          {label}
        </div>
        <span className={`text-sm font-semibold tabular-nums ${isUnlimited ? 'text-emerald-600' : labelColor(pct)}`}>
          {isUnlimited ? `${used} / ∞` : `${used} / ${limit}`}
        </span>
      </div>

      {isUnlimited ? (
        <div className="h-2 rounded-full bg-emerald-100 overflow-hidden">
          <div className="h-full w-full bg-emerald-200 rounded-full" />
        </div>
      ) : (
        <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-cream-dark)' }}>
          <div
            className={`h-full rounded-full transition-all duration-500 ${barColor(pct)}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

      {!isUnlimited && pct >= 100 && (
        <p className="text-xs text-red-600 font-medium">
          Limite atteinte — nouvelles créations bloquées
        </p>
      )}
      {!isUnlimited && pct >= 80 && pct < 100 && (
        <p className="text-xs text-orange-500">
          {100 - pct}% de capacité restante
        </p>
      )}
    </div>
  );
}

// ── Plan comparison table ─────────────────────────────────

type PlanName = 'starter' | 'pro' | 'enterprise';

interface ComparisonRow {
  label: string;
  icon: React.ReactNode;
  starter: React.ReactNode;
  pro: React.ReactNode;
  enterprise: React.ReactNode;
}

function CheckIcon({ ok }: { ok: boolean }) {
  return ok
    ? <CheckCircle2 size={16} className="text-emerald-500 mx-auto" />
    : <XCircle     size={16} className="mx-auto" style={{ color: 'var(--color-ink-muted)' }} />;
}

function planCell(plan: PlanName, isCurrentPlan: boolean, content: React.ReactNode) {
  return (
    <td
      key={plan}
      className={`px-4 py-3 text-center text-sm ${
        isCurrentPlan ? 'font-semibold' : ''
      }`}
      style={isCurrentPlan ? { color: 'var(--color-gold)' } : { color: 'var(--color-ink)' }}
    >
      {content}
    </td>
  );
}

// ── Mock data for non-API mode ────────────────────────────

const MOCK_DATA: AbonnementData = {
  plan:         'pro',
  statut:       'actif',
  dateEssaiFin: null,
  usage:        { users: 7, produits: 142, magasins: 2 },
  limites:      { users: 10, produits: null, magasins: 3 },
};

// ── Main component ────────────────────────────────────────

export default function AbonnementPage() {
  const [data, setData]       = useState<AbonnementData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      if (USE_API) {
        const result = await abonnementApi.get();
        setData(result);
      } else {
        // Fallback for local dev without API
        setData(MOCK_DATA);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  // ── Rows for comparison table ────────────────────────────

  const comparisonRows: ComparisonRow[] = [
    {
      label: 'Utilisateurs',
      icon:  <Users size={14} />,
      starter:    '2',
      pro:        '10',
      enterprise: '∞',
    },
    {
      label: 'Produits',
      icon:  <Package size={14} />,
      starter:    '500',
      pro:        '∞',
      enterprise: '∞',
    },
    {
      label: 'Magasins',
      icon:  <Store size={14} />,
      starter:    '1',
      pro:        '3',
      enterprise: '∞',
    },
    {
      label: 'Captures de leads',
      icon:  <Zap size={14} />,
      starter:    <CheckIcon ok={false} />,
      pro:        <CheckIcon ok={true}  />,
      enterprise: <CheckIcon ok={true}  />,
    },
    {
      label: 'WhatsApp Bot',
      icon:  <Mail size={14} />,
      starter:    <CheckIcon ok={false} />,
      pro:        <CheckIcon ok={true}  />,
      enterprise: <CheckIcon ok={true}  />,
    },
    {
      label: 'Domaine personnalisé',
      icon:  <Building2 size={14} />,
      starter:    <CheckIcon ok={false} />,
      pro:        <CheckIcon ok={false} />,
      enterprise: <CheckIcon ok={true}  />,
    },
    {
      label: 'Support',
      icon:  <Star size={14} />,
      starter:    'Standard',
      pro:        'Prioritaire',
      enterprise: 'Dédié 24/7',
    },
    {
      label: 'Accès API',
      icon:  <Zap size={14} />,
      starter:    <CheckIcon ok={false} />,
      pro:        <CheckIcon ok={false} />,
      enterprise: <CheckIcon ok={true}  />,
    },
  ];

  // ── Render ───────────────────────────────────────────────

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-mono tracking-widest uppercase mb-1" style={{ color: 'var(--color-ink-muted)' }}>
            Configuration
          </p>
          <h1 className="text-3xl font-bold" style={{ color: 'var(--color-ink)', fontFamily: 'var(--font-display)' }}>
            Mon Abonnement
          </h1>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="btn-secondary flex items-center gap-2"
          title="Actualiser"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Actualiser
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl px-4 py-3 text-sm text-red-700 bg-red-50 border border-red-200">
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && !data && (
        <div className="space-y-4 animate-pulse">
          <div className="card p-6 h-28 rounded-2xl" style={{ backgroundColor: 'var(--color-cream)' }} />
          <div className="card p-6 h-40 rounded-2xl" style={{ backgroundColor: 'var(--color-cream)' }} />
        </div>
      )}

      {data && (
        <>
          {/* ── Section 1: Plan actif ─────────────────────── */}
          <div className="card p-6 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <CreditCard size={16} style={{ color: 'var(--color-gold)' }} />
              <h2 className="font-semibold" style={{ color: 'var(--color-ink)' }}>Plan actif</h2>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <PlanBadge plan={data.plan} size="md" />
              <StatutBadge statut={data.statut} />
            </div>

            {data.statut === 'essai' && data.dateEssaiFin && (
              <p className="text-sm" style={{ color: 'var(--color-ink-muted)' }}>
                Période d'essai jusqu'au{' '}
                <span className="font-medium" style={{ color: 'var(--color-ink)' }}>
                  {formatDate(data.dateEssaiFin)}
                </span>
              </p>
            )}

            {data.statut === 'suspendu' && (
              <p className="text-sm text-red-600 font-medium">
                Votre boutique est suspendue. Contactez le support pour rétablir l'accès.
              </p>
            )}
          </div>

          {/* ── Section 2: Usage par ressource ────────────── */}
          <div className="card p-6 space-y-6">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="font-semibold" style={{ color: 'var(--color-ink)' }}>Utilisation des ressources</h2>
            </div>

            <ResourceBar
              icon={<Users size={15} />}
              label="Utilisateurs"
              used={data.usage.users}
              limit={data.limites.users}
            />
            <ResourceBar
              icon={<Package size={15} />}
              label="Produits"
              used={data.usage.produits}
              limit={data.limites.produits}
            />
            <ResourceBar
              icon={<Store size={15} />}
              label="Magasins"
              used={data.usage.magasins}
              limit={data.limites.magasins}
            />
          </div>

          {/* ── Section 3: Comparatif plans ───────────────── */}
          <div className="card overflow-hidden">
            <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--color-cream-dark)' }}>
              <h2 className="font-semibold" style={{ color: 'var(--color-ink)' }}>Comparatif des plans</h2>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-cream-dark)' }}>
                    <th className="px-4 py-3 text-left font-medium" style={{ color: 'var(--color-ink-muted)', width: '40%' }}>
                      Fonctionnalité
                    </th>
                    {(['starter', 'pro', 'enterprise'] as PlanName[]).map(plan => (
                      <th
                        key={plan}
                        className="px-4 py-3 text-center font-medium"
                        style={data.plan === plan
                          ? { color: 'var(--color-gold)' }
                          : { color: 'var(--color-ink-muted)' }}
                      >
                        <div className="flex flex-col items-center gap-1">
                          <PlanBadge plan={plan} size="sm" />
                          {data.plan === plan && (
                            <span className="text-[10px] font-mono tracking-wide" style={{ color: 'var(--color-gold)' }}>
                              VOTRE PLAN
                            </span>
                          )}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {comparisonRows.map((row, i) => (
                    <tr
                      key={row.label}
                      style={{
                        borderBottom: i < comparisonRows.length - 1 ? '1px solid var(--color-cream-dark)' : 'none',
                        backgroundColor: i % 2 === 0 ? 'transparent' : 'var(--color-cream)',
                      }}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2" style={{ color: 'var(--color-ink)' }}>
                          <span style={{ color: 'var(--color-ink-muted)' }}>{row.icon}</span>
                          {row.label}
                        </div>
                      </td>
                      {planCell('starter',    data.plan === 'starter',    row.starter)}
                      {planCell('pro',        data.plan === 'pro',        row.pro)}
                      {planCell('enterprise', data.plan === 'enterprise', row.enterprise)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Section 4: Upgrade CTA ────────────────────── */}
          {data.plan !== 'enterprise' && (
            <div
              className="rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
              style={{ backgroundColor: 'var(--color-cream)', border: '1px solid var(--color-cream-dark)' }}
            >
              <div>
                <h3 className="font-semibold mb-1" style={{ color: 'var(--color-ink)', fontFamily: 'var(--font-display)' }}>
                  Besoin de plus de capacité ?
                </h3>
                <p className="text-sm" style={{ color: 'var(--color-ink-muted)' }}>
                  Passez au plan{' '}
                  <strong style={{ color: 'var(--color-ink)' }}>
                    {data.plan === 'starter' ? 'Pro' : 'Enterprise'}
                  </strong>{' '}
                  pour débloquer plus de ressources et de fonctionnalités.
                </p>
              </div>
              <a
                href="mailto:support@kiosq.app?subject=Demande%20d%27upgrade%20de%20plan"
                className="btn-primary shrink-0 flex items-center gap-2"
              >
                <Mail size={14} />
                Contacter pour upgrader
              </a>
            </div>
          )}

          {data.plan === 'enterprise' && (
            <div
              className="rounded-2xl p-4 flex items-center gap-3"
              style={{ backgroundColor: 'var(--color-cream)', border: '1px solid var(--color-cream-dark)' }}
            >
              <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
              <p className="text-sm" style={{ color: 'var(--color-ink-muted)' }}>
                Vous bénéficiez du plan <strong style={{ color: 'var(--color-ink)' }}>Enterprise</strong> — toutes les fonctionnalités sont disponibles sans limites.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
