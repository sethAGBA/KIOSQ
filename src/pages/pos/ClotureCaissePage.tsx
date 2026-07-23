import { useEffect, useState, useMemo } from 'react';
import {
  Save, Wallet, Calculator, AlertTriangle, CheckCircle2, History,
  RefreshCw, Calendar, Search, Filter, User, Eye, X, ArrowUpRight, TrendingDown
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import toast from 'react-hot-toast';
import clsx from 'clsx';

import { useAuthStore } from '@/store/authStore';
import { cloturesCaisseApi, utilisateursApi, USE_API } from '@/lib/api';
import { formatPrice } from '@/lib/format';
import { useTableControls } from '@/hooks/useTableControls';
import { Pagination } from '@/components/ui/Pagination';
import { SortableHeader } from '@/components/ui/SortableHeader';
import type { ClotureCaisse } from '@/types';

export default function ClotureCaissePage() {
  const { user } = useAuthStore();
  const isGestionnaire = user?.role === 'admin' || user?.role === 'gestionnaire';

  const [activeTab, setActiveTab] = useState<'rapport' | 'historique'>('rapport');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Summary state for today
  const [summary, setSummary] = useState<{
    totalVentes: number;
    nbVentes: number;
    repartition: { especes: number; mobile_money: number; carte: number; credit: number; autre: number };
    totalSorties: number;
    montantTheorique: number;
  }>({
    totalVentes: 0,
    nbVentes: 0,
    repartition: { especes: 0, mobile_money: 0, carte: 0, credit: 0, autre: 0 },
    totalSorties: 0,
    montantTheorique: 0,
  });

  // Form state
  const [montantReelInput, setMontantReelInput] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [selectedVendeurId, setSelectedVendeurId] = useState<string>('all');
  const [vendeurs, setVendeurs] = useState<{ id: string; nom: string; prenom?: string }[]>([]);

  // History state
  const [history, setHistory] = useState<ClotureCaisse[]>([]);
  const [searchHistory, setSearchHistory] = useState('');
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');
  const [filtreOperateur, setFiltreOperateur] = useState('all');
  const [selectedDetail, setSelectedDetail] = useState<ClotureCaisse | null>(null);

  const loadSummaryData = async () => {
    setLoading(true);
    try {
      if (USE_API) {
        const data = await cloturesCaisseApi.getSummary(selectedVendeurId);
        setSummary(data);
        setMontantReelInput(String(data.montantTheorique));
      }
    } catch (e) {
      console.error('Erreur résumé caisse', e);
      toast.error('Erreur de chargement du résumé de caisse');
    } finally {
      setLoading(false);
    }
  };

  const loadHistoryData = async () => {
    try {
      if (USE_API) {
        const data = await cloturesCaisseApi.list({
          start: dateDebut || undefined,
          end: dateFin || undefined,
          utilisateurId: filtreOperateur !== 'all' ? filtreOperateur : undefined,
        });
        setHistory(data);
      }
    } catch (e) {
      console.error('Erreur historique clôtures', e);
    }
  };

  useEffect(() => {
    loadSummaryData();
    if (USE_API) {
      utilisateursApi
        .list()
        .then(list => setVendeurs(list.map(u => ({ id: u.id, nom: u.nom, prenom: u.prenom }))))
        .catch(() => {});
    }
  }, [selectedVendeurId]);

  useEffect(() => {
    if (activeTab === 'historique') {
      loadHistoryData();
    }
  }, [activeTab, dateDebut, dateFin, filtreOperateur]);

  const montantReelNum = parseFloat(montantReelInput) || 0;
  const ecart = montantReelNum - summary.montantTheorique;

  const handleSaveClosure = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (USE_API) {
        await cloturesCaisseApi.create({
          vendeurId: selectedVendeurId !== 'all' ? selectedVendeurId : undefined,
          montantReel: montantReelNum,
          notes: notes.trim() || undefined,
        });
        toast.success('Rapport Z de caisse enregistré avec succès');
        setNotes('');
        setActiveTab('historique');
        loadHistoryData();
      }
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || 'Erreur lors de la clôture de caisse');
    } finally {
      setSaving(false);
    }
  };

  // Filtered history list
  const filteredHistory = useMemo(() => {
    return history.filter(h => {
      if (searchHistory) {
        const q = searchHistory.toLowerCase();
        return (
          (h.utilisateurNom && h.utilisateurNom.toLowerCase().includes(q)) ||
          (h.vendeurNom && h.vendeurNom.toLowerCase().includes(q)) ||
          (h.notes && h.notes.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [history, searchHistory]);

  const table = useTableControls(filteredHistory, {
    defaultSort: 'date',
    defaultDirection: 'desc',
    defaultPageSize: 15,
  });

  return (
    <div className="space-y-6">
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-amber-700 font-mono font-semibold uppercase tracking-wider mb-1">
            <Calculator size={14} /> Clôture & Bilan Journalier
          </div>
          <h1 className="text-2xl font-bold text-gray-900 font-display">Gestion de Caisse (Rapport Z)</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Bilan des encaissements, comptage du tiroir-caisse et rapport de clôture
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center bg-gray-100 p-1 rounded-xl border border-gray-200 self-start sm:self-auto">
          <button
            onClick={() => setActiveTab('rapport')}
            className={clsx(
              'px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5',
              activeTab === 'rapport'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-900'
            )}
          >
            <Save size={14} /> Rapport Z du Jour
          </button>
          <button
            onClick={() => setActiveTab('historique')}
            className={clsx(
              'px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5',
              activeTab === 'historique'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-900'
            )}
          >
            <History size={14} /> Historique des Clôtures
          </button>
        </div>
      </div>

      {activeTab === 'rapport' ? (
        <div className="space-y-6">
          {/* Vendor selector if admin */}
          {isGestionnaire && vendeurs.length > 0 && (
            <div className="bg-white p-3.5 rounded-2xl border shadow-sm flex items-center gap-3">
              <User size={16} className="text-amber-600 shrink-0" />
              <span className="text-xs font-semibold text-gray-700 shrink-0">Filtrer par Vendeur :</span>
              <select
                className="input text-xs w-auto py-1 px-3"
                value={selectedVendeurId}
                onChange={e => setSelectedVendeurId(e.target.value)}
              >
                <option value="all">Tous les vendeurs (Global boutique)</option>
                {vendeurs.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.prenom ? `${v.prenom} ${v.nom}` : v.nom}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Top KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="card bg-gradient-to-br from-emerald-50/60 to-white border-emerald-100">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-500">Chiffre d'Affaires du jour</span>
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <ArrowUpRight size={18} />
                </div>
              </div>
              <p className="text-2xl font-bold text-gray-900 mt-2 font-mono">{formatPrice(summary.totalVentes)}</p>
              <p className="text-[11px] text-gray-500 mt-1">{summary.nbVentes} vente(s) enregistrée(s)</p>
            </div>

            <div className="card bg-gradient-to-br from-amber-50/60 to-white border-amber-100">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-500">Espèces Attendues en Caisse</span>
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                  <Wallet size={18} />
                </div>
              </div>
              <p className="text-2xl font-bold text-amber-800 mt-2 font-mono">{formatPrice(summary.montantTheorique)}</p>
              <p className="text-[11px] text-gray-500 mt-1">
                Espèces encaissées ({formatPrice(summary.repartition.especes)}) - Sorties ({formatPrice(summary.totalSorties)})
              </p>
            </div>

            <div className="card bg-gradient-to-br from-blue-50/60 to-white border-blue-100">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-500">Total Sorties de Caisse</span>
                <div className="w-8 h-8 rounded-xl bg-red-100 text-red-600 flex items-center justify-center">
                  <TrendingDown size={18} />
                </div>
              </div>
              <p className="text-2xl font-bold text-red-600 mt-2 font-mono">- {formatPrice(summary.totalSorties)}</p>
              <p className="text-[11px] text-gray-500 mt-1">Petites dépenses & décaissements</p>
            </div>
          </div>

          {/* Breakdown & Physical Count Container */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Repartition par mode de paiement */}
            <div className="card space-y-4">
              <h3 className="text-sm font-bold text-gray-900 uppercase font-mono tracking-wider flex items-center gap-2">
                <Calculator size={16} className="text-amber-600" /> Répartition des Encaissements
              </h3>

              <div className="space-y-2.5 divide-y divide-gray-100">
                <div className="flex items-center justify-between pt-1 text-xs">
                  <span className="font-semibold text-gray-700">💵 Espèces (Cash)</span>
                  <span className="font-bold text-gray-900 font-mono text-sm">
                    {formatPrice(summary.repartition.especes)}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-2.5 text-xs">
                  <span className="font-semibold text-gray-700">📱 Mobile Money (Wave, Orange, Free)</span>
                  <span className="font-bold text-gray-900 font-mono text-sm">
                    {formatPrice(summary.repartition.mobile_money)}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-2.5 text-xs">
                  <span className="font-semibold text-gray-700">💳 Carte Bancaire</span>
                  <span className="font-bold text-gray-900 font-mono text-sm">
                    {formatPrice(summary.repartition.carte)}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-2.5 text-xs">
                  <span className="font-semibold text-gray-700">📝 Crédit / Dette Client</span>
                  <span className="font-bold text-amber-700 font-mono text-sm">
                    {formatPrice(summary.repartition.credit)}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-2.5 text-xs">
                  <span className="font-semibold text-gray-700">🔄 Autre mode</span>
                  <span className="font-bold text-gray-900 font-mono text-sm">
                    {formatPrice(summary.repartition.autre)}
                  </span>
                </div>
              </div>
            </div>

            {/* Form Clôture de Caisse */}
            <form onSubmit={handleSaveClosure} className="card space-y-4 bg-gradient-to-b from-white to-gray-50/50">
              <h3 className="text-sm font-bold text-gray-900 uppercase font-mono tracking-wider flex items-center gap-2">
                <Save size={16} className="text-emerald-600" /> Comptage Physique & Valider Clôture
              </h3>

              <div>
                <label className="label">Montant Réel Physiquement en Caisse (FCFA) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  className="input text-lg font-bold font-mono text-emerald-800"
                  value={montantReelInput}
                  onChange={e => setMontantReelInput(e.target.value)}
                />
              </div>

              {/* Écart alert */}
              <div
                className={clsx(
                  'p-3.5 rounded-xl border flex items-center gap-3 text-xs font-semibold',
                  ecart === 0
                    ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                    : ecart > 0
                    ? 'bg-blue-50 text-blue-900 border-blue-200'
                    : 'bg-red-50 text-red-900 border-red-200'
                )}
              >
                {ecart === 0 ? (
                  <CheckCircle2 size={20} className="text-emerald-600 shrink-0" />
                ) : ecart > 0 ? (
                  <CheckCircle2 size={20} className="text-blue-600 shrink-0" />
                ) : (
                  <AlertTriangle size={20} className="text-red-600 shrink-0" />
                )}
                <div className="flex-1">
                  <p className="font-bold">
                    {ecart === 0
                      ? 'Caisse Parfaitement Équilibrée !'
                      : ecart > 0
                      ? `Excédent de Caisse : +${formatPrice(ecart)}`
                      : `Écart Négatif (Manquant) : ${formatPrice(ecart)}`}
                  </p>
                  <p className="text-[11px] font-normal opacity-80 mt-0.5">
                    Théorique : {formatPrice(summary.montantTheorique)} | Réel : {formatPrice(montantReelNum)}
                  </p>
                </div>
              </div>

              <div>
                <label className="label">Observations / Notes (Optionnel)</label>
                <textarea
                  rows={2}
                  className="input text-xs"
                  placeholder="Ex: Différence expliquée par une erreur de monnaie de 500 F..."
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="btn-primary w-full text-xs py-3 bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600 flex items-center justify-center gap-2 shadow-sm font-bold"
              >
                <Save size={16} />
                {saving ? 'Enregistrement du Rapport Z…' : 'Valider & Clôturer la Caisse (Rapport Z)'}
              </button>
            </form>
          </div>
        </div>
      ) : (
        /* Tab 2: Historique */
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-white p-4 rounded-2xl border shadow-sm space-y-3" style={{ borderColor: 'var(--color-cream-dark)' }}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-center">
              {/* Search */}
              <div className="relative">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  className="input pl-10 text-xs w-full"
                  placeholder="Rechercher par opérateur, notes…"
                  value={searchHistory}
                  onChange={e => setSearchHistory(e.target.value)}
                />
              </div>

              {/* Operator */}
              <div className="relative">
                <User size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <select
                  className="input pl-9 text-xs w-full bg-white cursor-pointer pr-8"
                  value={filtreOperateur}
                  onChange={e => setFiltreOperateur(e.target.value)}
                >
                  <option value="all">Tous les caissiers</option>
                  {vendeurs.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.prenom ? `${v.prenom} ${v.nom}` : v.nom}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date Filters & Refresh */}
              <div className="flex items-center gap-2 sm:col-span-2">
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
                  onClick={loadHistoryData}
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
                    <SortableHeader column="utilisateurNom" label="Opérateur" sort={table.sort} onSort={table.setSort} />
                    <SortableHeader column="totalVentes" label="Chiffre d'Affaires" align="right" sort={table.sort} onSort={table.setSort} />
                    <SortableHeader column="montantTheorique" label="Espèces Attendues" align="right" sort={table.sort} onSort={table.setSort} />
                    <SortableHeader column="montantReel" label="Espèces Réelles" align="right" sort={table.sort} onSort={table.setSort} />
                    <SortableHeader column="ecart" label="Écart" align="right" sort={table.sort} onSort={table.setSort} />
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {table.paginatedData.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center space-y-2">
                        <History size={36} className="mx-auto text-gray-300" />
                        <p className="text-xs font-semibold text-gray-500">Aucune clôture enregistrée</p>
                      </td>
                    </tr>
                  ) : (
                    table.paginatedData.map(c => {
                      const ecartVal = Number(c.ecart);

                      return (
                        <tr key={c.id} className="hover:bg-gray-50/60">
                          <td className="py-3.5 px-4 text-gray-600 font-mono text-[11px]">
                            {format(new Date(c.date), 'dd/MM/yyyy HH:mm', { locale: fr })}
                          </td>
                          <td className="py-3.5 px-4 font-semibold text-gray-900">{c.utilisateurNom}</td>
                          <td className="py-3.5 px-4 text-right font-mono font-bold text-gray-900">
                            {formatPrice(Number(c.totalVentes))}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono text-gray-600">
                            {formatPrice(Number(c.montantTheorique))}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-700">
                            {formatPrice(Number(c.montantReel))}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono font-bold">
                            <span
                              className={clsx(
                                'inline-flex items-center px-2 py-0.5 rounded-full text-[11px]',
                                ecartVal === 0
                                  ? 'bg-emerald-50 text-emerald-800'
                                  : ecartVal > 0
                                  ? 'bg-blue-50 text-blue-800'
                                  : 'bg-red-50 text-red-800'
                              )}
                            >
                              {ecartVal > 0 ? `+${formatPrice(ecartVal)}` : formatPrice(ecartVal)}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <button
                              onClick={() => setSelectedDetail(c)}
                              className="btn-secondary text-[11px] py-1 px-2.5 inline-flex items-center gap-1"
                            >
                              <Eye size={13} /> Détails
                            </button>
                          </td>
                        </tr>
                      );
                    })
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
        </div>
      )}

      {/* Details Modal */}
      {selectedDetail && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-5 border-b" style={{ borderColor: 'var(--color-cream-dark)' }}>
              <h3 className="text-xl font-semibold font-display text-gray-900">
                Détail Clôture Z #{selectedDetail.id.slice(0, 8)}
              </h3>
              <button onClick={() => setSelectedDetail(null)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-gray-50 p-3 rounded-xl">
                <div>
                  <span className="text-gray-400 block text-[10px]">Date & Heure</span>
                  <span className="font-semibold text-gray-800 font-mono">
                    {format(new Date(selectedDetail.date), 'dd/MM/yyyy HH:mm')}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[10px]">Caissier</span>
                  <span className="font-semibold text-gray-800">{selectedDetail.utilisateurNom}</span>
                </div>
              </div>

              <div className="space-y-2 border-t pt-3">
                <div className="flex justify-between">
                  <span className="text-gray-500">Total Ventes :</span>
                  <span className="font-bold text-gray-900 font-mono">{formatPrice(Number(selectedDetail.totalVentes))}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Espèces Théoriques :</span>
                  <span className="font-bold text-gray-900 font-mono">{formatPrice(Number(selectedDetail.montantTheorique))}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Espèces Réelles Comptées :</span>
                  <span className="font-bold text-emerald-700 font-mono">{formatPrice(Number(selectedDetail.montantReel))}</span>
                </div>
                <div className="flex justify-between pt-1 border-t">
                  <span className="font-bold text-gray-700">Écart de Caisse :</span>
                  <span className={clsx("font-bold font-mono", Number(selectedDetail.ecart) < 0 ? "text-red-600" : "text-emerald-600")}>
                    {formatPrice(Number(selectedDetail.ecart))}
                  </span>
                </div>
              </div>

              {selectedDetail.notes && (
                <div className="bg-amber-50/60 p-3 rounded-xl border border-amber-200/60 text-amber-900">
                  <span className="font-semibold block mb-0.5">Notes :</span>
                  <p className="text-[11px]">{selectedDetail.notes}</p>
                </div>
              )}

              <button
                onClick={() => setSelectedDetail(null)}
                className="btn-secondary w-full text-xs py-2.5 mt-2"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
