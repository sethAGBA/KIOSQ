/**
 * DashboardSuperadminPage — platform-level KPIs, MRR, 12-month boutique
 * growth chart, and 90-day trial-to-active conversion rate.
 *
 * Consumes: GET /api/superadmin/stats
 * Requirements: 4.3, 4.4, 4.5, 4.6
 */

import { useEffect, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  Store,
  CheckCircle2,
  Clock,
  AlertCircle,
  TrendingUp,
  RefreshCcw,
} from 'lucide-react';
import { superadminApi, type SuperadminStats } from '@/lib/api';

// ── Helpers ───────────────────────────────────────────────

/** Format a YYYY-MM key as short French month label, e.g. "jan.", "fév." */
function formatMonthLabel(key: string): string {
  const [year, month] = key.split('-');
  const d = new Date(Number(year), Number(month) - 1, 1);
  return d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '');
}

/** Format a number as "XX XXX FCFA" */
function formatMRR(value: number): string {
  return new Intl.NumberFormat('fr-FR').format(value) + ' FCFA';
}

/** Format a 0-1 ratio as "XX %" */
function formatPct(value: number): string {
  return `${Math.round(value * 100)} %`;
}

// ── Sub-components ────────────────────────────────────────

interface KpiCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  sublabel?: string;
}

function KpiCard({ label, value, icon, iconBg, iconColor, sublabel }: KpiCardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 flex items-start gap-4 shadow-sm">
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
        style={{ backgroundColor: iconBg }}
      >
        <span style={{ color: iconColor }}>{icon}</span>
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-0.5">{label}</p>
        <p className="text-2xl font-bold text-gray-900 leading-tight">{value}</p>
        {sublabel && <p className="text-xs text-gray-400 mt-0.5">{sublabel}</p>}
      </div>
    </div>
  );
}

// Custom recharts tooltip
function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-md px-3 py-2 text-sm">
      <p className="font-semibold text-gray-700 capitalize">{label}</p>
      <p className="text-gray-500">
        <span className="font-bold text-[#e94560]">{payload[0].value}</span> boutique
        {payload[0].value !== 1 ? 's' : ''}
      </p>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────

export default function DashboardSuperadminPage() {
  const [stats, setStats] = useState<SuperadminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await superadminApi.stats();
      setStats(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  // ── Loading skeleton ─────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 mb-1">Dashboard</h1>
          <p className="text-sm text-gray-500">Vue d'ensemble de la plateforme</p>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="bg-white rounded-xl border border-gray-100 p-5 h-24 animate-pulse"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div className="h-3 bg-gray-100 rounded w-1/2 mb-3" />
              <div className="h-7 bg-gray-100 rounded w-2/3" />
            </div>
          ))}
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-6 h-72 animate-pulse">
          <div className="h-4 bg-gray-100 rounded w-1/4 mb-4" />
          <div className="h-full bg-gray-50 rounded" />
        </div>
      </div>
    );
  }

  // ── Error state ──────────────────────────────────────
  if (error || !stats) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 mb-1">Dashboard</h1>
          <p className="text-sm text-gray-500">Vue d'ensemble de la plateforme</p>
        </div>
        <div className="bg-white rounded-xl border border-red-100 p-8 flex flex-col items-center gap-3 text-center">
          <AlertCircle size={32} className="text-red-400" />
          <p className="text-gray-700 font-medium">{error ?? 'Données indisponibles'}</p>
          <button
            onClick={load}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm text-gray-700 transition-colors"
          >
            <RefreshCcw size={14} />
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  // ── Prepare chart data ───────────────────────────────
  const chartData = stats.courbe12mois.map((entry) => ({
    name: formatMonthLabel(entry.mois),
    nouvelles: entry.nouvelles,
  }));

  const conversionPct = formatPct(stats.tauxConversion90j);

  return (
    <div className="space-y-6">

      {/* ── Page header ──────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 mb-1">Dashboard</h1>
          <p className="text-sm text-gray-500">Vue d'ensemble de la plateforme</p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-sm text-gray-600 transition-colors shadow-sm"
          title="Rafraîchir"
        >
          <RefreshCcw size={13} />
          Actualiser
        </button>
      </div>

      {/* ── KPI cards ─────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard
          label="Total boutiques"
          value={stats.total}
          icon={<Store size={18} />}
          iconBg="#f0f4ff"
          iconColor="#4361ee"
        />
        <KpiCard
          label="Actives"
          value={stats.parStatut.actif}
          icon={<CheckCircle2 size={18} />}
          iconBg="#ecfdf5"
          iconColor="#10b981"
          sublabel="statut actif"
        />
        <KpiCard
          label="Essai"
          value={stats.parStatut.essai}
          icon={<Clock size={18} />}
          iconBg="#fffbeb"
          iconColor="#f59e0b"
          sublabel="en période d'essai"
        />
        <KpiCard
          label="Suspendues"
          value={stats.parStatut.suspendu}
          icon={<AlertCircle size={18} />}
          iconBg="#fff1f2"
          iconColor="#f43f5e"
          sublabel="accès bloqué"
        />
        <KpiCard
          label="MRR estimé"
          value={formatMRR(stats.mrr)}
          icon={<TrendingUp size={18} />}
          iconBg="#f5f3ff"
          iconColor="#8b5cf6"
          sublabel="boutiques actives payantes"
        />
      </div>

      {/* ── Row: chart + conversion rate ──────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* 12-month growth chart */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-sm font-semibold text-gray-800">Nouvelles boutiques</h2>
              <p className="text-xs text-gray-400 mt-0.5">12 derniers mois</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart
              data={chartData}
              margin={{ top: 4, right: 8, left: -24, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip content={<ChartTooltip />} />
              <Line
                type="monotone"
                dataKey="nouvelles"
                stroke="#e94560"
                strokeWidth={2.5}
                dot={{ r: 3, fill: '#e94560', strokeWidth: 0 }}
                activeDot={{ r: 5, fill: '#e94560', strokeWidth: 0 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Conversion rate */}
        <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm flex flex-col">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-gray-800">Taux de conversion</h2>
            <p className="text-xs text-gray-400 mt-0.5">Essai → Actif sur 90 jours</p>
          </div>

          {/* Big percentage */}
          <div className="flex-1 flex flex-col items-center justify-center gap-2 py-4">
            <span className="text-5xl font-bold text-gray-900">{conversionPct}</span>
            <span className="text-xs text-gray-400">des boutiques en essai sont passées en actif</span>
          </div>

          {/* Stacked bar: actif vs essai */}
          <div className="mt-4">
            {(() => {
              const actif = stats.parStatut.actif;
              const essai = stats.parStatut.essai;
              const total90 = actif + essai;
              const actifPct = total90 > 0 ? (actif / total90) * 100 : 0;
              return (
                <>
                  <div className="flex justify-between text-xs text-gray-400 mb-1.5">
                    <span>{actif} actives (90j)</span>
                    <span>{essai} en essai (90j)</span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${actifPct}%`, backgroundColor: '#10b981' }}
                    />
                  </div>
                </>
              );
            })()}
          </div>
        </div>

      </div>

    </div>
  );
}
