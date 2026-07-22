/**
 * BoutiquesPage — filterable list of all tenants for the superadmin.
 *
 * Consumes: GET /api/superadmin/tenants
 * Requirements: 5.1, 5.2, 5.3
 */

import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, RefreshCcw, AlertCircle, Store } from 'lucide-react';
import { superadminApi, type TenantListItem } from '@/lib/api';
import BoutiqueCard from '@/components/superadmin/BoutiqueCard';

// ── Filter types ───────────────────────────────────────────

type StatutFilter = '' | 'actif' | 'essai' | 'suspendu';
type PlanFilter   = '' | 'starter' | 'pro' | 'enterprise';

const STATUT_OPTIONS: { value: StatutFilter; label: string }[] = [
  { value: '',          label: 'Tous statuts' },
  { value: 'actif',     label: 'Actif'        },
  { value: 'essai',     label: 'Essai'        },
  { value: 'suspendu',  label: 'Suspendu'     },
];

const PLAN_OPTIONS: { value: PlanFilter; label: string }[] = [
  { value: '',            label: 'Tous plans'  },
  { value: 'starter',     label: 'Starter'     },
  { value: 'pro',         label: 'Pro'         },
  { value: 'enterprise',  label: 'Enterprise'  },
];

// ── Loading skeleton ───────────────────────────────────────

function CardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 h-[106px] animate-pulse">
      <div className="h-4 bg-gray-100 rounded w-1/3 mb-2" />
      <div className="h-3 bg-gray-100 rounded w-1/4 mb-4" />
      <div className="grid grid-cols-3 gap-3">
        <div className="h-3 bg-gray-100 rounded" />
        <div className="h-3 bg-gray-100 rounded" />
        <div className="h-3 bg-gray-100 rounded" />
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────

export default function BoutiquesPage() {
  const navigate = useNavigate();

  const [boutiques, setBoutiques] = useState<TenantListItem[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);

  // Filters
  const [search, setSearch]   = useState('');
  const [statut, setStatut]   = useState<StatutFilter>('');
  const [plan, setPlan]       = useState<PlanFilter>('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await superadminApi.tenants.list({
        statut: statut || undefined,
        plan:   plan   || undefined,
        q:      search || undefined,
      });
      setBoutiques(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [statut, plan, search]);

  // Reload whenever filters change (with a small debounce on search)
  useEffect(() => {
    const timer = setTimeout(() => { load(); }, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [load, search]);

  // ── Render ───────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* ── Page header ──────────────────────────────── */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 mb-1">Boutiques</h1>
          <p className="text-sm text-gray-500">Liste de toutes les boutiques de la plateforme</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={load}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-sm text-gray-600 transition-colors shadow-sm"
            title="Rafraîchir"
          >
            <RefreshCcw size={13} />
            Actualiser
          </button>
          <button
            onClick={() => navigate('/superadmin/boutiques/new')}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#e94560] hover:bg-[#d03550] text-white text-sm font-medium transition-colors shadow-sm"
          >
            <Plus size={15} />
            Créer une boutique
          </button>
        </div>
      </div>

      {/* ── Filters bar ──────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-wrap gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par nom ou slug…"
            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e94560]/20 focus:border-[#e94560]"
          />
        </div>

        {/* Statut filter */}
        <select
          value={statut}
          onChange={(e) => setStatut(e.target.value as StatutFilter)}
          className="py-2 px-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e94560]/20 focus:border-[#e94560] bg-white text-gray-700"
        >
          {STATUT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        {/* Plan filter */}
        <select
          value={plan}
          onChange={(e) => setPlan(e.target.value as PlanFilter)}
          className="py-2 px-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e94560]/20 focus:border-[#e94560] bg-white text-gray-700"
        >
          {PLAN_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* ── Content ───────────────────────────────────── */}

      {/* Error state */}
      {error && !loading && (
        <div className="bg-white rounded-xl border border-red-100 p-8 flex flex-col items-center gap-3 text-center">
          <AlertCircle size={32} className="text-red-400" />
          <p className="text-gray-700 font-medium">{error}</p>
          <button
            onClick={load}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm text-gray-700 transition-colors"
          >
            <RefreshCcw size={14} />
            Réessayer
          </button>
        </div>
      )}

      {/* Loading skeletons */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && boutiques.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-100 p-12 flex flex-col items-center gap-3 text-center">
          <Store size={40} className="text-gray-300" />
          <p className="text-gray-600 font-medium">Aucune boutique trouvée</p>
          <p className="text-sm text-gray-400">
            {search || statut || plan
              ? 'Essayez de modifier vos filtres.'
              : 'Créez la première boutique de la plateforme.'}
          </p>
          {!search && !statut && !plan && (
            <button
              onClick={() => navigate('/superadmin/boutiques/new')}
              className="mt-2 flex items-center gap-2 px-4 py-2 rounded-lg bg-[#e94560] hover:bg-[#d03550] text-white text-sm font-medium transition-colors"
            >
              <Plus size={15} />
              Créer une boutique
            </button>
          )}
        </div>
      )}

      {/* Cards grid */}
      {!loading && !error && boutiques.length > 0 && (
        <>
          <p className="text-xs text-gray-400">
            {boutiques.length} boutique{boutiques.length !== 1 ? 's' : ''}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {boutiques.map((b) => (
              <BoutiqueCard
                key={b.id}
                boutique={b}
                onClick={(id) => navigate(`/superadmin/boutiques/${id}`)}
              />
            ))}
          </div>
        </>
      )}

    </div>
  );
}
