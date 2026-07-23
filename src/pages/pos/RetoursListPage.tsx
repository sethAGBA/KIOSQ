import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  RotateCcw, Search, ArrowLeft, PackageX,
  Calendar, Filter, X, RefreshCw,
} from 'lucide-react';
import clsx from 'clsx';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { retoursApi, USE_API } from '@/lib/api';
import { formatPrice } from '@/lib/format';
import type { RetourClient, RemboursementMode } from '@/types';
import { useTableControls } from '@/hooks/useTableControls';
import { Pagination } from '@/components/ui/Pagination';
import { SortableHeader } from '@/components/ui/SortableHeader';

// ── Mock data (demo mode) ─────────────────────────────────
const MOCK_RETOURS: RetourClient[] = [
  {
    id: 'ret-1',
    factureId: 'fac-1',
    factureNumero: 'FAC-2024-001',
    clientId: 'c1',
    clientNom: 'Diallo Mamadou',
    lignes: [
      { designation: 'RAM — Clé USB 32 Go', quantite: 2, prixUnitaire: 5000, total: 10000 },
    ],
    totalTTC: 10000,
    motif: 'Produit défectueux',
    remboursementMode: 'especes',
    utilisateurNom: 'Aminata Ndiaye',
    createdAt: new Date('2024-07-15T10:30:00'),
  },
  {
    id: 'ret-2',
    factureId: 'fac-2',
    factureNumero: 'FAC-2024-008',
    clientId: 'c2',
    clientNom: 'Entreprise Sow & Fils',
    lignes: [
      { designation: 'PAP — Ramette A4 500F', quantite: 5, prixUnitaire: 3500, total: 17500 },
      { designation: 'STY — Stylo Bic bleu', quantite: 10, prixUnitaire: 250, total: 2500 },
    ],
    totalTTC: 20000,
    motif: 'Mauvaise référence commandée',
    remboursementMode: 'avoir',
    utilisateurNom: 'Mamadou Diallo',
    createdAt: new Date('2024-07-18T14:15:00'),
  },
  {
    id: 'ret-3',
    factureId: 'fac-5',
    factureNumero: 'FAC-2024-015',
    clientId: 'c3',
    clientNom: 'Bakary Coulibaly',
    lignes: [
      { designation: 'ECR — Ecran 24 pouces', quantite: 1, prixUnitaire: 85000, total: 85000 },
    ],
    totalTTC: 85000,
    motif: 'Écran endommagé à la livraison',
    remboursementMode: 'credit_reduc',
    utilisateurNom: 'Fatou Sow',
    createdAt: new Date('2024-07-20T09:00:00'),
  },
];

// ── Helpers ───────────────────────────────────────────────
const MODE_LABEL: Record<RemboursementMode, string> = {
  especes:      'Espèces',
  credit_reduc: 'Réduction dette',
  avoir:        'Avoir',
};

const MODE_STYLE: Record<RemboursementMode, string> = {
  especes:      'bg-green-100 text-green-700',
  credit_reduc: 'bg-blue-100  text-blue-700',
  avoir:        'bg-gray-100  text-gray-600',
};

// ── Page ──────────────────────────────────────────────────
export default function RetoursListPage() {
  const navigate  = useNavigate();

  const [retours, setRetours]       = useState<RetourClient[]>([]);
  const [loading, setLoading]       = useState(false);

  // Filters
  const [search, setSearch]         = useState('');
  const [modeFilter, setModeFilter] = useState<string>('tous');
  const [dateDebut, setDateDebut]   = useState('');
  const [dateFin, setDateFin]       = useState('');

  // ── Load data ─────────────────────────────────────────
  const loadRetours = async () => {
    setLoading(true);
    try {
      if (USE_API) {
        const data = await retoursApi.list({
          start:  dateDebut || undefined,
          end:    dateFin   || undefined,
          mode:   modeFilter !== 'tous' ? modeFilter : undefined,
        });
        // Coerce dates
        setRetours(data.map(r => ({ ...r, createdAt: new Date(r.createdAt) })));
      } else {
        setRetours(MOCK_RETOURS);
      }
    } catch (e: any) {
      toast.error(e.message || 'Erreur lors du chargement des retours');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRetours();
  }, [dateDebut, dateFin, modeFilter]);

  // ── Client-side text filter ───────────────────────────
  const filtered = useMemo(() => {
    if (!search.trim()) return retours;
    const q = search.toLowerCase();
    return retours.filter(
      r =>
        r.clientNom.toLowerCase().includes(q) ||
        r.factureNumero.toLowerCase().includes(q),
    );
  }, [retours, search]);

  // ── KPIs ──────────────────────────────────────────────
  const totalMontant  = filtered.reduce((s, r) => s + r.totalTTC, 0);
  const totalNombre   = filtered.length;

  const table = useTableControls(filtered, {
    defaultSort: 'createdAt',
    defaultDirection: 'desc',
    defaultPageSize: 20,
  });

  return (
    <div className="space-y-6 max-w-5xl mx-auto">

      {/* ── Header ──────────────────────────────────────── */}
      <div>
        <button
          onClick={() => navigate('/pos/retour')}
          className="flex items-center gap-1.5 text-sm mb-3 transition-colors"
          style={{ color: 'var(--color-ink-muted)' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-gold)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-ink-muted)')}
        >
          <ArrowLeft size={15} /> Faire un retour
        </button>

        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: 'var(--color-gold)', color: 'white' }}
            >
              <RotateCcw size={18} />
            </div>
            <div>
              <h1
                className="text-2xl font-bold"
                style={{ color: 'var(--color-ink)', fontFamily: 'var(--font-display)' }}
              >
                Historique des retours
              </h1>
              <p className="text-xs" style={{ color: 'var(--color-ink-muted)' }}>
                Tous les retours clients enregistrés
              </p>
            </div>
          </div>

          <button
            onClick={() => navigate('/pos/retour')}
            className="btn-primary flex items-center gap-2 text-sm"
          >
            <RotateCcw size={15} />
            Nouveau retour
          </button>
        </div>
      </div>

      {/* ── KPIs ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4">
        <div className="card">
          <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--color-ink-muted)' }}>
            Montant retourné
          </p>
          <p className="text-2xl font-bold" style={{ color: 'var(--color-ink)', fontFamily: 'var(--font-display)' }}>
            {formatPrice(totalMontant)}
          </p>
        </div>
        <div className="card">
          <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--color-ink-muted)' }}>
            Nombre de retours
          </p>
          <p className="text-2xl font-bold" style={{ color: 'var(--color-ink)', fontFamily: 'var(--font-display)' }}>
            {totalNombre}
          </p>
        </div>
      </div>

      {/* ── Filters ─────────────────────────────────────── */}
      <div className="bg-white p-4 rounded-2xl border shadow-sm space-y-3" style={{ borderColor: 'var(--color-cream-dark)' }}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-center">
          {/* Search */}
          <div className="relative">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="text"
              className="input pl-10 text-xs w-full"
              placeholder="Chercher par client ou n° facture…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* Mode filter */}
          <div className="relative">
            <Filter size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <select
              className="input pl-9 text-xs w-full bg-white cursor-pointer pr-8"
              value={modeFilter}
              onChange={e => setModeFilter(e.target.value)}
            >
              <option value="tous">Tous les modes</option>
              <option value="especes">Espèces</option>
              <option value="credit_reduc">Réduction dette</option>
              <option value="avoir">Avoir</option>
            </select>
          </div>

          {/* Placeholder col for alignment */}
          <div />

          {/* Date range + refresh */}
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-1 bg-gray-50 px-2.5 py-1.5 rounded-xl border border-gray-200 text-xs min-w-0">
              <Calendar size={13} className="text-gray-400 shrink-0" />
              <span className="text-gray-400 text-[10px] uppercase font-mono shrink-0">Du</span>
              <input
                type="date"
                className="bg-transparent text-[11px] font-medium text-gray-800 outline-none w-full min-w-0"
                value={dateDebut}
                onChange={e => setDateDebut(e.target.value)}
              />
              <span className="text-gray-400 text-[10px] uppercase font-mono shrink-0">Au</span>
              <input
                type="date"
                className="bg-transparent text-[11px] font-medium text-gray-800 outline-none w-full min-w-0"
                value={dateFin}
                onChange={e => setDateFin(e.target.value)}
              />
              {(dateDebut || dateFin) && (
                <button
                  onClick={() => { setDateDebut(''); setDateFin(''); }}
                  className="text-gray-400 hover:text-gray-600 ml-0.5 shrink-0"
                >
                  <X size={13} />
                </button>
              )}
            </div>
            <button
              onClick={loadRetours}
              className="btn-secondary text-xs p-2 shrink-0 h-[38px] w-[38px] flex items-center justify-center"
              title="Rafraîchir"
            >
              <RefreshCw size={14} className={clsx(loading && 'animate-spin')} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Table ───────────────────────────────────────── */}
      {loading ? (
        <div className="card flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-200" style={{ borderTopColor: 'var(--color-gold)' }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 gap-3">
          <PackageX size={40} style={{ color: 'var(--color-ink-muted)', opacity: 0.4 }} />
          <p className="text-sm font-medium" style={{ color: 'var(--color-ink-muted)' }}>
            Aucun retour trouvé
          </p>
          <button
            onClick={() => navigate('/pos/retour')}
            className="btn-primary text-sm mt-2"
          >
            Enregistrer un retour
          </button>
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-cream-dark)', backgroundColor: 'var(--color-cream)' }}>
                  <SortableHeader column="createdAt"          label="Date & heure"      sort={table.sort} onSort={table.setSort} />
                  <SortableHeader column="factureNumero"      label="N° Facture"         sort={table.sort} onSort={table.setSort} />
                  <SortableHeader column="clientNom"          label="Client"             sort={table.sort} onSort={table.setSort} />
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-ink-muted)' }}>Articles retournés</th>
                  <SortableHeader column="totalTTC"           label="Montant"            sort={table.sort} onSort={table.setSort} align="right" />
                  <SortableHeader column="remboursementMode"  label="Remboursement"      sort={table.sort} onSort={table.setSort} align="center" />
                  <SortableHeader column="utilisateurNom"     label="Opérateur"          sort={table.sort} onSort={table.setSort} />
                </tr>
              </thead>
              <tbody>
                {table.paginatedData.map((retour, i) => (
                  <tr
                    key={retour.id}
                    className="transition-colors"
                    style={{
                      borderBottom: i < table.paginatedData.length - 1 ? '1px solid var(--color-cream-dark)' : undefined,
                    }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--color-cream)')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}
                  >
                    {/* Date */}
                    <td className="px-4 py-3 whitespace-nowrap font-mono text-[11px]" style={{ color: 'var(--color-ink-muted)' }}>
                      {format(retour.createdAt, 'dd/MM/yyyy HH:mm', { locale: fr })}
                    </td>

                    {/* N° facture */}
                    <td className="px-4 py-3 whitespace-nowrap font-mono text-xs font-semibold" style={{ color: 'var(--color-ink)' }}>
                      {retour.factureNumero}
                    </td>

                    {/* Client */}
                    <td className="px-4 py-3 font-medium" style={{ color: 'var(--color-ink)' }}>
                      {retour.clientNom}
                    </td>

                    {/* Articles */}
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {retour.lignes.map((l, li) => (
                          <span
                            key={li}
                            className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700"
                          >
                            {l.quantite}× {l.designation.length > 25
                              ? l.designation.slice(0, 25) + '…'
                              : l.designation}
                          </span>
                        ))}
                      </div>
                    </td>

                    {/* Montant */}
                    <td className="px-4 py-3 whitespace-nowrap font-semibold" style={{ color: 'var(--color-ink)' }}>
                      {formatPrice(retour.totalTTC)}
                    </td>

                    {/* Mode remboursement */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={clsx('px-2 py-1 rounded-full text-xs font-semibold', MODE_STYLE[retour.remboursementMode])}>
                        {MODE_LABEL[retour.remboursementMode]}
                      </span>
                    </td>

                    {/* Opérateur */}
                    <td className="px-4 py-3 whitespace-nowrap text-xs" style={{ color: 'var(--color-ink-muted)' }}>
                      {retour.utilisateurNom ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination
              page={table.page}
              totalPages={table.totalPages}
              totalItems={table.totalItems}
              pageSize={table.pageSize}
              onPageChange={table.setPage}
              onPageSizeChange={table.setPageSize}
            />
          </div>
        </div>
      )}
    </div>
  );
}
