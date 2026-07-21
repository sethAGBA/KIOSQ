import { useMemo, useState, useEffect } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, BarChart, Bar, CartesianGrid,
} from 'recharts';
import {
  TrendingUp, TrendingDown, ShoppingCart, Users,
  FileText, Package, AlertTriangle, Clock, ArrowUpRight, DollarSign,
} from 'lucide-react';
import clsx from 'clsx';
import { useAppStore } from '@/store/appStore';
import { formatPrice, formatDate, statutColor, statutLabel } from '@/lib/format';
import { dashboardApi, type DashboardStats, USE_API } from '@/lib/api';

// ── KPI Card ─────────────────────────────────────────────
interface KpiCardProps {
  label: string;
  value: string;
  sub?: string;
  trend?: number;
  icon: React.ReactNode;
  accent: string;
}

function KpiCard({ label, value, sub, trend, icon, accent }: KpiCardProps) {
  return (
    <div className="card p-5 flex flex-col gap-3 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: `${accent}18`, color: accent }}
        >
          {icon}
        </div>
        {trend !== undefined && (
          <span
            className={clsx('flex items-center gap-0.5 text-xs font-semibold px-2 py-0.5 rounded-full')}
            style={
              trend >= 0
                ? { backgroundColor: '#f0fdf4', color: '#16a34a' }
                : { backgroundColor: '#fef2f2', color: '#dc2626' }
            }
          >
            {trend >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
            {Math.abs(trend).toFixed(1)}%
          </span>
        )}
      </div>
      <div>
        <p
          className="text-[10px] font-mono uppercase tracking-widest mb-1"
          style={{ color: 'var(--color-ink-muted)' }}
        >
          {label}
        </p>
        <p className="text-2xl font-bold leading-tight" style={{ color: 'var(--color-ink)', fontFamily: 'var(--font-display)' }}>
          {value}
        </p>
        {sub && (
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-ink-muted)' }}>
            {sub}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Custom Tooltip ────────────────────────────────────────
function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: {value: number; name: string}[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="card py-2 px-3 shadow-lg text-xs space-y-1" style={{ minWidth: 140 }}>
      <p className="font-semibold" style={{ color: 'var(--color-ink)' }}>{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: 'var(--color-ink-muted)' }}>
          {p.name === 'valeur' ? 'CA' : p.name === 'benefice' ? 'Bénéfice' : p.name} :{' '}
          <span className="font-semibold" style={{ color: 'var(--color-ink)' }}>
            {formatPrice(p.value)}
          </span>
        </p>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const { commandes, factures, clients, produits } = useAppStore();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);



  useEffect(() => {
    if (!USE_API) return;
    setLoadingStats(true);
    setStatsError(null);
    dashboardApi.stats()
      .then((data) => {
        setStats(data);
      })
      .catch((err) => {
        console.error('[Dashboard fetchStats error]', err);
        setStatsError(err.message || 'Erreur lors du chargement des statistiques');
      })
      .finally(() => {
        setLoadingStats(false);
      });
  }, [USE_API]);

  // ── KPIs calculés ─────────────────────────────────────
  const kpis = useMemo(() => {
    if (USE_API && stats) {
      const caMois = stats.caMonth;
      const caMoisPrec = stats.caParMois[10]?.valeur ?? 0;
      const caVariation = caMoisPrec > 0 ? ((caMois - caMoisPrec) / caMoisPrec) * 100 : 0;
      const facturesEnAttente = factures.filter((f) => ['envoyee', 'partielle', 'en_retard'].includes(f.statut));
      const montantEnAttente = facturesEnAttente.reduce((s, f) => s + f.resteAPayer, 0);

      return {
        caMois,
        caVariation,
        commandesMois: stats.commandesActives,
        clientsActifs: clients.filter((c) => c.actif).length,
        facturesEnAttente: facturesEnAttente.length,
        montantEnAttente,
        produitsEnAlerte: stats.alertesStock,
        produitsEnRupture: produits.filter((p) => p.stockActuel === 0).length,
      };
    }

    const now = new Date();
    const moisCourant = now.getMonth();
    const annee = now.getFullYear();

    const cmdMois = commandes.filter((c) => {
      const d = new Date(c.createdAt);
      return d.getMonth() === moisCourant && d.getFullYear() === annee && c.type === 'commande';
    });
    const cmdMoisPrec = commandes.filter((c) => {
      const d = new Date(c.createdAt);
      return d.getMonth() === (moisCourant - 1 + 12) % 12 && d.getFullYear() === annee;
    });

    const caMois = cmdMois.reduce((s, c) => s + c.totalTTC, 0);
    const caMoisPrec = cmdMoisPrec.reduce((s, c) => s + c.totalTTC, 0);
    const caVariation = caMoisPrec > 0 ? ((caMois - caMoisPrec) / caMoisPrec) * 100 : 0;

    const facturesEnAttente = factures.filter((f) => ['envoyee', 'partielle', 'en_retard'].includes(f.statut));
    const montantEnAttente = facturesEnAttente.reduce((s, f) => s + f.resteAPayer, 0);

    const clientsActifs = clients.filter((c) => c.actif).length;
    const produitsEnAlerte = produits.filter((p) => p.stockActuel <= p.stockMinimum).length;
    const produitsEnRupture = produits.filter((p) => p.stockActuel === 0).length;

    return {
      caMois, caVariation,
      commandesMois: cmdMois.length,
      clientsActifs,
      facturesEnAttente: facturesEnAttente.length,
      montantEnAttente,
      produitsEnAlerte,
      produitsEnRupture,
    };
  }, [commandes, factures, clients, produits, stats, USE_API]);

  // ── Dernières commandes ───────────────────────────────
  const dernieresCommandes = useMemo(
    () => [...commandes].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5),
    [commandes]
  );

  // ── Alertes stock ─────────────────────────────────────
  const alertesProduits = useMemo(
    () => produits.filter((p) => p.stockActuel <= p.stockMinimum).slice(0, 5),
    [produits]
  );

  // ── Factures en retard ────────────────────────────────
  const facturesRetard = useMemo(
    () => factures.filter((f) => f.statut === 'en_retard').slice(0, 4),
    [factures]
  );

  // ── Données graphiques unifiées (Réel / Mock) ─────────
  const chartData = useMemo(() => {
    if (USE_API && stats) {
      return stats.caParMois.map(item => ({
        ...item,
        benefice: item.valeur * 0.25
      }));
    }
    // Fallback: derive from store commandes when no API
    const months: Record<string, { label: string; valeur: number; commandes: number; benefice: number }> = {};
    for (const c of commandes) {
      const d = new Date(c.createdAt);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const label = d.toLocaleDateString('fr-FR', { month: 'short' });
      if (!months[key]) months[key] = { label, valeur: 0, commandes: 0, benefice: 0 };
      months[key].valeur += c.totalTTC;
      months[key].commandes += 1;
      months[key].benefice += c.totalTTC * 0.25;
    }
    return Object.values(months).slice(-12);
  }, [stats, USE_API, commandes]);

  if (USE_API && loadingStats) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-amber-500"></div>
        <p className="text-sm font-medium text-slate-500">Chargement des statistiques...</p>
      </div>
    );
  }

  if (USE_API && statsError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 max-w-lg mx-auto text-center">
        <div className="p-3 bg-red-50 rounded-full text-red-500">
          <AlertTriangle size={32} />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Échec du chargement</h3>
          <p className="text-sm text-slate-500 mt-1">{statsError}</p>
        </div>
        <button
          onClick={() => {
            setLoadingStats(true);
            setStatsError(null);
            dashboardApi.stats()
              .then(setStats)
              .catch(err => setStatsError(err.message || 'Erreur lors du chargement'))
              .finally(() => setLoadingStats(false));
          }}
          className="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-semibold shadow hover:bg-amber-600 transition-colors"
        >
          Réessayer
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl">

      {/* Page title */}
      <div>
        <p className="text-[10px] font-mono tracking-widest uppercase mb-1" style={{ color: 'var(--color-ink-muted)' }}>
          Vue d'ensemble
        </p>
        <h1 className="text-3xl font-bold" style={{ color: 'var(--color-ink)', fontFamily: 'var(--font-display)' }}>
          Tableau de bord
        </h1>
      </div>

      {/* ── KPIs ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="CA ce mois"
          value={formatPrice(kpis.caMois)}
          sub="commandes confirmées + livrées"
          trend={kpis.caVariation}
          icon={<TrendingUp size={20} />}
          accent="var(--color-gold)"
        />
        <KpiCard
          label="Commandes"
          value={String(kpis.commandesMois)}
          sub={USE_API ? "actives" : "ce mois-ci"}
          icon={<ShoppingCart size={20} />}
          accent="#2563eb"
        />
        <KpiCard
          label="Clients actifs"
          value={String(kpis.clientsActifs)}
          sub={`${clients.length} au total`}
          icon={<Users size={20} />}
          accent="#10b981"
        />
        <KpiCard
          label={USE_API ? "Factures en retard" : "Factures en attente"}
          value={formatPrice(USE_API && stats ? stats.facturesEnRetard : kpis.montantEnAttente)}
          sub={USE_API ? "en retard de paiement" : `${kpis.facturesEnAttente} facture(s) non soldée(s)`}
          icon={<FileText size={20} />}
          accent={USE_API ? "#ef4444" : "#f59e0b"}
        />
      </div>

      {/* ── Second row KPIs ───────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Produits en alerte"
          value={String(kpis.produitsEnAlerte)}
          sub={`dont ${kpis.produitsEnRupture} en rupture`}
          icon={<AlertTriangle size={20} />}
          accent="#ef4444"
        />
        <KpiCard
          label="Total clients"
          value={String(clients.length)}
          sub="base client complète"
          icon={<Users size={20} />}
          accent="#8b5cf6"
        />
        <KpiCard
          label="Références catalogue"
          value={String(produits.length)}
          sub={`${produits.filter(p => p.actif).length} actives`}
          icon={<Package size={20} />}
          accent="#06b6d4"
        />
        <KpiCard
          label="Bénéfice estimé (annual)"
          value={formatPrice(chartData.reduce((s, d) => s + d.benefice, 0))}
          sub={USE_API ? "estimé à 25% de marge" : "sur 12 mois"}
          icon={<DollarSign size={20} />}
          accent="#16a34a"
        />
      </div>

      {/* ── Charts ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* CA Area chart — 2/3 width */}
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: 'var(--color-ink-muted)' }}>
                Chiffre d'affaires mensuel
              </p>
              <p className="font-semibold mt-0.5" style={{ color: 'var(--color-ink)' }}>
                12 derniers mois
              </p>
            </div>
            <div
              className="text-xs font-medium px-2.5 py-1 rounded-full"
              style={{ backgroundColor: 'var(--color-gold-pale)', color: 'var(--color-gold)' }}
            >
              {formatPrice(chartData.reduce((s, d) => s + d.valeur, 0))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gradCA" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-gold)" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="var(--color-gold)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradBen" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--color-ink-muted)' }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="valeur" stroke="var(--color-gold)" strokeWidth={2} fill="url(#gradCA)" name="valeur" />
              <Area type="monotone" dataKey="benefice" stroke="#10b981" strokeWidth={1.5} fill="url(#gradBen)" strokeDasharray="4 2" name="benefice" />
            </AreaChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-4 mt-3">
            <span className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--color-ink-muted)' }}>
              <span className="w-3 h-0.5 rounded inline-block" style={{ backgroundColor: 'var(--color-gold)' }} /> CA
            </span>
            <span className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--color-ink-muted)' }}>
              <span className="w-3 h-0.5 rounded inline-block bg-emerald-500" /> Bénéfice
            </span>
          </div>
        </div>

        {/* Bar chart commandes — 1/3 */}
        <div className="card p-5">
          <p className="text-[10px] font-mono uppercase tracking-widest mb-1" style={{ color: 'var(--color-ink-muted)' }}>
            Commandes / mois
          </p>
          <p className="font-semibold mb-4" style={{ color: 'var(--color-ink)' }}>Volume</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--color-cream-dark)" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--color-ink-muted)' }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip
                formatter={(v) => [`${v} cmd`, 'Commandes']}
                contentStyle={{ fontSize: 11, borderColor: 'var(--color-cream-dark)', borderRadius: 8 }}
              />
              <Bar dataKey="commandes" fill="var(--color-gold)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Bottom grid ───────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Dernières commandes — 2/3 */}
        <div className="card lg:col-span-2 overflow-hidden p-0">
          <div
            className="flex items-center justify-between px-5 py-4 border-b"
            style={{ borderColor: 'var(--color-cream-dark)' }}
          >
            <p className="font-semibold text-sm" style={{ color: 'var(--color-ink)' }}>
              Dernières commandes
            </p>
            <a
              href="/commandes"
              className="text-xs flex items-center gap-1 font-medium"
              style={{ color: 'var(--color-gold)' }}
            >
              Voir tout <ArrowUpRight size={12} />
            </a>
          </div>
          <table className="table-auto w-full">
            <thead>
              <tr>
                <th>Numéro</th>
                <th>Client</th>
                <th>Total TTC</th>
                <th>Statut</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {dernieresCommandes.map((c) => (
                <tr key={c.id}>
                  <td>
                    <span className="font-mono text-xs font-medium" style={{ color: 'var(--color-ink)' }}>
                      {c.numero}
                    </span>
                  </td>
                  <td style={{ color: 'var(--color-ink)' }}>{c.clientNom}</td>
                  <td className="font-medium" style={{ color: 'var(--color-ink)' }}>
                    {formatPrice(c.totalTTC)}
                  </td>
                  <td>
                    <span className={clsx('badge', statutColor(c.statut))}>
                      {statutLabel(c.statut)}
                    </span>
                  </td>
                  <td style={{ color: 'var(--color-ink-muted)' }}>{formatDate(c.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Alertes & retards — 1/3 */}
        <div className="space-y-4">

          {/* Stock alerts */}
          <div className="card p-0 overflow-hidden">
            <div
              className="flex items-center gap-2 px-4 py-3 border-b"
              style={{ borderColor: 'var(--color-cream-dark)' }}
            >
              <AlertTriangle size={14} className="text-red-500" />
              <p className="font-semibold text-sm" style={{ color: 'var(--color-ink)' }}>
                Alertes stock
              </p>
              <span className="ml-auto badge badge-danger">{alertesProduits.length}</span>
            </div>
            <div>
              {alertesProduits.length === 0 ? (
                <p className="text-xs px-4 py-3" style={{ color: 'var(--color-ink-muted)' }}>Aucune alerte</p>
              ) : (
                alertesProduits.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between px-4 py-2.5 border-b last:border-0"
                    style={{ borderColor: 'var(--color-cream-dark)' }}
                  >
                    <div>
                      <p className="text-xs font-medium" style={{ color: 'var(--color-ink)' }}>
                        {p.designation}
                      </p>
                      <p className="text-xs" style={{ color: 'var(--color-ink-muted)' }}>
                        Réf: {p.reference}
                      </p>
                    </div>
                    <span
                      className={clsx('badge text-xs font-bold', p.stockActuel === 0 ? 'badge-danger' : 'badge-warning')}
                    >
                      {p.stockActuel === 0 ? 'Rupture' : `${p.stockActuel} / ${p.stockMinimum}`}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Factures en retard */}
          <div className="card p-0 overflow-hidden">
            <div
              className="flex items-center gap-2 px-4 py-3 border-b"
              style={{ borderColor: 'var(--color-cream-dark)' }}
            >
              <Clock size={14} className="text-amber-500" />
              <p className="font-semibold text-sm" style={{ color: 'var(--color-ink)' }}>
                Factures en retard
              </p>
              <span className="ml-auto badge badge-warning">{facturesRetard.length}</span>
            </div>
            <div>
              {facturesRetard.length === 0 ? (
                <p className="text-xs px-4 py-3" style={{ color: 'var(--color-ink-muted)' }}>Aucune facture en retard</p>
              ) : (
                facturesRetard.map((f) => (
                  <div
                    key={f.id}
                    className="flex items-center justify-between px-4 py-2.5 border-b last:border-0"
                    style={{ borderColor: 'var(--color-cream-dark)' }}
                  >
                    <div>
                      <p className="text-xs font-mono font-medium" style={{ color: 'var(--color-ink)' }}>
                        {f.numero}
                      </p>
                      <p className="text-xs" style={{ color: 'var(--color-ink-muted)' }}>
                        {f.clientNom}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-red-600">{formatPrice(f.resteAPayer)}</p>
                      <p className="text-xs" style={{ color: 'var(--color-ink-muted)' }}>
                        Éch. {formatDate(f.dateEcheance)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
