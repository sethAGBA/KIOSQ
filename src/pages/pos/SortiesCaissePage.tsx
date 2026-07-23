import { useEffect, useState, useMemo } from 'react';
import {
  Receipt, Plus, Calendar, Wallet, X,
  TrendingDown, ArrowDownRight, RefreshCw, Search, Filter, User
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import toast from 'react-hot-toast';
import clsx from 'clsx';

import { sortiesCaisseApi, utilisateursApi, USE_API } from '@/lib/api';
import { formatPrice } from '@/lib/format';
import type { SortieCaisse } from '@/types';
import { useTableControls } from '@/hooks/useTableControls';
import { Pagination } from '@/components/ui/Pagination';
import { SortableHeader } from '@/components/ui/SortableHeader';

const CATEGORIES = [
  'Petit Déjeuner / Repas',
  'Factures (Senelec, SDE, Tel)',
  'Loyers & Charges',
  'Salaires & Gratifications',
  'Maintenance & Réparations',
  'Achats Fournitures',
  'Transport',
  'Autres charges',
];

export default function SortiesCaissePage() {
  const [sorties, setSorties] = useState<SortieCaisse[]>([]);
  const [operateurs, setOperateurs] = useState<{ id: string; nom: string; prenom?: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');
  const [filtreOperateur, setFiltreOperateur] = useState('all');
  const [filtreCategorie, setFiltreCategorie] = useState('all');

  // New Outflow Form
  const [montant, setMontant] = useState('');
  const [motif, setMotif] = useState('');
  const [categorie, setCategorie] = useState('Autres charges');
  const [beneficiaire, setBeneficiaire] = useState('');

  const loadSorties = async () => {
    setLoading(true);
    try {
      if (USE_API) {
        const data = await sortiesCaisseApi.list({
          start: dateDebut || undefined,
          end: dateFin || undefined,
          utilisateurId: filtreOperateur !== 'all' ? filtreOperateur : undefined,
        });
        setSorties(data);
      }
    } catch (e) {
      console.error('Erreur chargement sorties de caisse', e);
      toast.error('Erreur de chargement des sorties de caisse');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSorties();
    if (USE_API) {
      utilisateursApi
        .list()
        .then(data => setOperateurs(data.map(u => ({ id: u.id, nom: u.nom, prenom: u.prenom }))))
        .catch(() => {});
    }
  }, [dateDebut, dateFin, filtreOperateur]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const valMontant = parseFloat(montant);
    if (!valMontant || valMontant <= 0) return toast.error('Veuillez entrer un montant valide');
    if (!motif.trim()) return toast.error('Veuillez indiquer le motif de la sortie');

    setSaving(true);
    try {
      if (USE_API) {
        await sortiesCaisseApi.create({
          montant: valMontant,
          motif: motif.trim(),
          categorie,
          beneficiaire: beneficiaire.trim() || undefined,
        });
        toast.success('Sortie de caisse enregistrée avec succès');
        setMontant('');
        setMotif('');
        setBeneficiaire('');
        setShowModal(false);
        loadSorties();
      }
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || 'Erreur lors de l’enregistrement');
    } finally {
      setSaving(false);
    }
  };

  // Filtered list & KPIs
  const filteredSorties = useMemo(() => {
    return sorties.filter(s => {
      if (filtreCategorie !== 'all' && s.categorie !== filtreCategorie) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          s.motif.toLowerCase().includes(q) ||
          s.categorie.toLowerCase().includes(q) ||
          (s.beneficiaire && s.beneficiaire.toLowerCase().includes(q)) ||
          (s.utilisateurNom && s.utilisateurNom.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [sorties, filtreCategorie, search]);

  const totalSorties = useMemo(
    () => filteredSorties.reduce((sum, s) => sum + Number(s.montant), 0),
    [filteredSorties]
  );
  const moyenneSortie = useMemo(
    () => (filteredSorties.length > 0 ? totalSorties / filteredSorties.length : 0),
    [filteredSorties, totalSorties]
  );

  const table = useTableControls(filteredSorties, {
    defaultSort: 'date',
    defaultDirection: 'desc',
    defaultPageSize: 15,
  });

  return (
    <div className="space-y-6">
      {/* Header & New Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-red-600 font-mono font-semibold uppercase tracking-wider mb-1">
            <Receipt size={14} /> Trésorerie & Caisse
          </div>
          <h1 className="text-2xl font-bold text-gray-900 font-display">Sorties de Caisse</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Gestion et suivi des décaissements et petites dépenses de fonctionnement
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="btn-primary text-xs flex items-center gap-2 py-2.5 px-4 shrink-0 shadow-sm"
        >
          <Plus size={16} /> Nouvelle Sortie de Caisse
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card bg-gradient-to-br from-red-50/50 to-white border-red-100/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500">Total décaissements</span>
            <div className="w-8 h-8 rounded-xl bg-red-100 text-red-600 flex items-center justify-center">
              <TrendingDown size={18} />
            </div>
          </div>
          <p className="text-2xl font-bold text-red-600 mt-2 font-mono">{formatPrice(totalSorties)}</p>
          <p className="text-[11px] text-gray-400 mt-1">Cumul des sorties affichées</p>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500">Nombre de sorties</span>
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
              <Receipt size={18} />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900 mt-2 font-mono">{filteredSorties.length}</p>
          <p className="text-[11px] text-gray-400 mt-1">Opérations enregistrées</p>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500">Décaissement moyen</span>
            <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
              <Wallet size={18} />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900 mt-2 font-mono">{formatPrice(moyenneSortie)}</p>
          <p className="text-[11px] text-gray-400 mt-1">Moyenne par dépense</p>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border shadow-sm space-y-3" style={{ borderColor: 'var(--color-cream-dark)' }}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-center">
          {/* Search Input */}
          <div className="relative">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="text"
              className="input pl-10 text-xs w-full"
              placeholder="Rechercher motif, catégorie…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* Category Filter */}
          <div className="relative">
            <Filter size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <select
              className="input pl-9 text-xs w-full bg-white cursor-pointer pr-8"
              value={filtreCategorie}
              onChange={e => setFiltreCategorie(e.target.value)}
            >
              <option value="all">Toutes les catégories</option>
              {CATEGORIES.map(c => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Operator Filter */}
          <div className="relative">
            <User size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <select
              className="input pl-9 text-xs w-full bg-white cursor-pointer pr-8"
              value={filtreOperateur}
              onChange={e => setFiltreOperateur(e.target.value)}
            >
              <option value="all">Tous les opérateurs</option>
              {operateurs.map(o => (
                <option key={o.id} value={o.id}>
                  {o.prenom ? `${o.prenom} ${o.nom}` : o.nom}
                </option>
              ))}
            </select>
          </div>

          {/* Date Filters & Refresh */}
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
                  onClick={() => {
                    setDateDebut('');
                    setDateFin('');
                  }}
                  className="text-gray-400 hover:text-gray-600 ml-0.5 shrink-0"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            <button
              onClick={loadSorties}
              className="btn-secondary text-xs p-2 shrink-0 h-[38px] w-[38px] flex items-center justify-center"
              title="Rafraîchir"
            >
              <RefreshCw size={14} className={clsx(loading && 'animate-spin')} />
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b text-gray-500 font-medium bg-gray-50/50">
                <SortableHeader column="date" label="Date & Heure" sort={table.sort} onSort={table.setSort} />
                <SortableHeader column="categorie" label="Catégorie" sort={table.sort} onSort={table.setSort} />
                <SortableHeader column="motif" label="Motif / Libellé" sort={table.sort} onSort={table.setSort} />
                <SortableHeader column="beneficiaire" label="Bénéficiaire" sort={table.sort} onSort={table.setSort} />
                <SortableHeader column="utilisateurNom" label="Opérateur" sort={table.sort} onSort={table.setSort} />
                <SortableHeader column="montant" label="Montant" align="right" sort={table.sort} onSort={table.setSort} />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {table.paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center space-y-2">
                    <Receipt size={36} className="mx-auto text-gray-300" />
                    <p className="text-xs font-semibold text-gray-500">Aucune sortie de caisse trouvée</p>
                    <p className="text-[11px] text-gray-400">
                      Enregistrez une nouvelle sortie de caisse en cliquant sur le bouton ci-dessus.
                    </p>
                  </td>
                </tr>
              ) : (
                table.paginatedData.map(s => (
                  <tr key={s.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="py-3.5 px-4 text-gray-600 whitespace-nowrap font-mono text-[11px]">
                      {format(new Date(s.date), 'dd/MM/yyyy HH:mm', { locale: fr })}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-900 border border-amber-200">
                        {s.categorie}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-gray-900">{s.motif}</td>
                    <td className="py-3.5 px-4 text-gray-600">
                      {s.beneficiaire ? (
                        <span className="font-medium text-gray-800">{s.beneficiaire}</span>
                      ) : (
                        <span className="text-gray-300 text-[11px]">—</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-gray-700 font-medium whitespace-nowrap">
                      {s.utilisateurNom}
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-red-600 font-mono text-sm whitespace-nowrap">
                      - {formatPrice(Number(s.montant))}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          page={table.page}
          totalPages={table.totalPages}
          totalItems={table.totalItems}
          pageSize={table.pageSize}
          onPageChange={table.setPage}
          onPageSizeChange={table.setPageSize}
        />
      </div>

      {/* Modal Nouvelle Sortie de Caisse */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div
              className="flex items-center justify-between px-6 py-5 border-b"
              style={{ borderColor: 'var(--color-cream-dark)' }}
            >
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center">
                  <ArrowDownRight size={18} />
                </div>
                <h3
                  className="text-xl font-semibold"
                  style={{ color: 'var(--color-ink)', fontFamily: 'var(--font-display)' }}
                >
                  Nouvelle Sortie de Caisse
                </h3>
              </div>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} className="px-6 py-5 space-y-4">
              <div>
                <label className="label">Montant à décaisser (FCFA) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  required
                  autoFocus
                  className="input text-base font-bold text-red-600 font-mono"
                  placeholder="Ex: 15000"
                  value={montant}
                  onChange={e => setMontant(e.target.value)}
                />
              </div>

              <div>
                <label className="label">Catégorie de dépense *</label>
                <select
                  className="input text-xs font-medium"
                  value={categorie}
                  onChange={e => setCategorie(e.target.value)}
                >
                  {CATEGORIES.map(c => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Motif / Objet de la sortie *</label>
                <input
                  required
                  className="input text-xs"
                  placeholder="Ex: Achat fournitures de bureau, Petit déjeuner équipe…"
                  value={motif}
                  onChange={e => setMotif(e.target.value)}
                />
              </div>

              <div>
                <label className="label">Bénéficiaire (Optionnel)</label>
                <input
                  className="input text-xs"
                  placeholder="Ex: Mamadou Ndiaye, Société CEET…"
                  value={beneficiaire}
                  onChange={e => setBeneficiaire(e.target.value)}
                />
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn-secondary flex-1 text-xs py-2.5"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary flex-1 text-xs py-2.5 bg-red-600 hover:bg-red-700 text-white border-red-600"
                >
                  {saving ? 'Enregistrement…' : 'Valider la sortie'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
