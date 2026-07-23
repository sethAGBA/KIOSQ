import { useEffect, useState, useMemo } from 'react';
import {
  ArrowUpCircle, ArrowDownCircle, RefreshCw, X, Download, User,
  Search, Plus, Layers
} from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { useAppStore } from '@/store/appStore';
import { useAuthStore } from '@/store/authStore';
import { exportToCSV } from '@/lib/exportUtils';
import { mouvementsApi, utilisateursApi, USE_API } from '@/lib/api';
import type { Mouvement, TypeMouvement } from '@/types';
import { useTableControls } from '@/hooks/useTableControls';
import { Pagination } from '@/components/ui/Pagination';
import { SortableHeader } from '@/components/ui/SortableHeader';
import ProductSearch from '@/components/common/ProductSearch';

export default function MouvementsPage() {
  const { produits, fetchProduits, updateProduit } = useAppStore();
  const { user } = useAuthStore();
  const canManage = user?.role === 'admin' || user?.role === 'gestionnaire';

  const [mouvements, setMouvements] = useState<Mouvement[]>([]);
  const [operateurs, setOperateurs] = useState<{ id: string; nom: string; prenom?: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);

  // Filtres
  const [filtreType, setFiltreType] = useState<'tous' | TypeMouvement>('tous');
  const [filtreOperateur, setFiltreOperateur] = useState<string>('tous');
  const [search, setSearch] = useState('');
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');

  // Formulaire nouveau mouvement
  const [form, setForm] = useState({
    produitId: '',
    type: 'entree' as TypeMouvement,
    quantite: 1,
    motif: '',
  });

  const loadMouvements = async () => {
    setLoading(true);
    try {
      if (USE_API) {
        const data = await mouvementsApi.list({
          type: filtreType !== 'tous' ? filtreType : undefined,
          start: dateDebut || undefined,
          end: dateFin || undefined,
        });
        setMouvements(data);
      } else {
        setMouvements([]);
      }
    } catch (e) {
      console.error('Erreur chargement mouvements live', e);
      setMouvements([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMouvements();
    if (produits.length === 0) fetchProduits();
    if (USE_API) {
      utilisateursApi.list().then(data => {
        setOperateurs(data.map(u => ({ id: u.id, nom: u.nom, prenom: u.prenom })));
      }).catch(() => {});
    }
  }, [filtreType, dateDebut, dateFin]);

  // Submit nouveau mouvement
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.produitId) return toast.error('Veuillez sélectionner un produit');
    if (form.quantite <= 0) return toast.error('La quantité doit être supérieure à 0');

    setSaving(true);
    try {
      if (USE_API) {
        const newMouvement = await mouvementsApi.create(form);
        setMouvements(prev => [newMouvement, ...prev]);
        // Refetch product stock
        const targetP = produits.find(p => p.id === form.produitId);
        if (targetP) {
          const delta = form.type === 'entree' ? form.quantite : -form.quantite;
          updateProduit(targetP.id, { stockActuel: Math.max(0, targetP.stockActuel + delta) });
        }
      } else {
        const targetP = produits.find(p => p.id === form.produitId);
        if (targetP) {
          const stockAvant = targetP.stockActuel;
          const delta = form.type === 'entree' ? form.quantite : -form.quantite;
          const stockApres = Math.max(0, stockAvant + delta);
          updateProduit(targetP.id, { stockActuel: stockApres });

          const newM: Mouvement = {
            id: `mvt-${Date.now()}`,
            produitId: targetP.id,
            produitRef: targetP.reference,
            produitNom: targetP.designation,
            type: form.type,
            quantite: form.quantite,
            stockAvant,
            stockApres,
            motif: form.motif || 'Ajustement manuel',
            utilisateurId: user?.id || 'sys',
            utilisateurNom: `${user?.prenom || ''} ${user?.nom || ''}`.trim() || 'Opérateur',
            createdAt: new Date(),
          };
          setMouvements(prev => [newM, ...prev]);
        }
      }
      toast.success('Mouvement de stock enregistré !');
      setShowModal(false);
      setForm({ produitId: '', type: 'entree', quantite: 1, motif: '' });
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de l\'enregistrement');
    } finally {
      setSaving(false);
    }
  };

  // Filtrage local
  const mouvementsFiltres = useMemo(() => {
    return mouvements.filter(m => {
      if (filtreType !== 'tous' && m.type !== filtreType) return false;
      if (filtreOperateur !== 'tous' && m.utilisateurId !== filtreOperateur) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          m.produitNom.toLowerCase().includes(q) ||
          m.produitRef.toLowerCase().includes(q) ||
          (m.motif && m.motif.toLowerCase().includes(q)) ||
          (m.utilisateurNom && m.utilisateurNom.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [mouvements, filtreType, filtreOperateur, search]);

  const table = useTableControls(mouvementsFiltres, {
    defaultSort: 'createdAt',
    defaultDirection: 'desc',
    defaultPageSize: 15,
  });

  // Export CSV
  const handleExport = () => {
    if (mouvementsFiltres.length === 0) return toast.error('Aucune donnée à exporter');
    const dataToExport = mouvementsFiltres.map(m => ({
      Type: m.type,
      Produit: m.produitNom,
      Référence: m.produitRef,
      Quantité: m.quantite,
      'Stock Avant': m.stockAvant,
      'Stock Après': m.stockApres,
      Motif: m.motif || '—',
      Opérateur: m.utilisateurNom,
      Date: format(new Date(m.createdAt), 'dd/MM/yyyy HH:mm'),
    }));
    exportToCSV(dataToExport, 'mouvements_stock');
    toast.success('Exportation CSV générée');
  };

  const selectedProduit = produits.find(p => p.id === form.produitId);

  return (
    <div className="space-y-6">
      {/* ── En-tête ───────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Layers size={22} style={{ color: 'var(--color-gold)' }} />
            <h1 className="text-xl font-bold" style={{ color: 'var(--color-ink)', fontFamily: 'var(--font-display)' }}>
              Mouvements de Stock
            </h1>
          </div>
          <p className="text-sm" style={{ color: 'var(--color-ink-muted)' }}>
            Registre complet et traçabilité de toutes les entrées, sorties et ajustements de stock
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleExport}
            className="btn-secondary text-xs flex items-center gap-1.5"
          >
            <Download size={14} />
            Exporter CSV
          </button>
          {canManage && (
            <button
              onClick={() => setShowModal(true)}
              className="btn-primary text-xs flex items-center gap-1.5"
            >
              <Plus size={16} />
              Nouveau Mouvement
            </button>
          )}
        </div>
      </div>

      {/* ── Barre de Filtres ──────────────────────────────────── */}
      <div className="bg-white p-4 rounded-2xl border shadow-sm space-y-3" style={{ borderColor: 'var(--color-cream-dark)' }}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Recherche */}
          <div className="relative flex-1 max-w-sm">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              className="input pl-9 text-xs"
              placeholder="Chercher par produit, référence ou motif…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Filtre Vendeur / Opérateur */}
            <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-200 text-xs">
              <User size={14} className="text-gray-400 shrink-0" />
              <select
                value={filtreOperateur}
                onChange={e => setFiltreOperateur(e.target.value)}
                className="bg-transparent font-semibold text-gray-700 focus:outline-none cursor-pointer"
              >
                <option value="tous">Tous les vendeurs / opérateurs</option>
                {operateurs.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.prenom ? `${u.prenom} ${u.nom}` : u.nom}
                  </option>
                ))}
              </select>
            </div>

            {/* Filtres Date */}
            <div className="flex items-center gap-2 bg-gray-50 p-1.5 rounded-xl border border-gray-200 text-xs">
              <span className="text-[10px] font-bold uppercase text-gray-400 px-1">Du</span>
              <input
                type="date"
                className="bg-transparent font-medium focus:outline-none"
                value={dateDebut}
                onChange={e => setDateDebut(e.target.value)}
              />
              <span className="text-[10px] font-bold uppercase text-gray-400 px-1">Au</span>
              <input
                type="date"
                className="bg-transparent font-medium focus:outline-none"
                value={dateFin}
                onChange={e => setDateFin(e.target.value)}
              />
              {(dateDebut || dateFin) && (
                <button
                  onClick={() => { setDateDebut(''); setDateFin(''); }}
                  className="p-1 text-red-500 hover:bg-red-50 rounded"
                  title="Réinitialiser les dates"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Boutons de Filtre par Type */}
        <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-gray-100">
          {[
            { id: 'tous', label: 'Tous' },
            { id: 'entree', label: 'Entrées (+)' },
            { id: 'sortie', label: 'Sorties (-)' },
            { id: 'usage_interne', label: 'Usage Interne' },
            { id: 'ajustement', label: 'Ajustements' },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFiltreType(f.id as any)}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
                filtreType === f.id
                  ? 'bg-[var(--color-gold)] text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Table des Mouvements ──────────────────────────────── */}
      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden" style={{ borderColor: 'var(--color-cream-dark)' }}>
        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400 gap-2">
            <div className="w-5 h-5 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-medium">Chargement des mouvements…</span>
          </div>
        ) : mouvementsFiltres.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto text-gray-300">
              <Layers size={24} />
            </div>
            <p className="text-sm font-medium text-gray-500">Aucun mouvement de stock trouvé</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <SortableHeader column="type" label="Type" sort={table.sort} onSort={table.setSort} />
                    <SortableHeader column="produitNom" label="Produit" sort={table.sort} onSort={table.setSort} />
                    <SortableHeader column="quantite" label="Quantité" sort={table.sort} onSort={table.setSort} align="right" />
                    <SortableHeader column="stockAvant" label="Stock Avant" sort={table.sort} onSort={table.setSort} align="right" />
                    <SortableHeader column="stockApres" label="Stock Après" sort={table.sort} onSort={table.setSort} align="right" />
                    <SortableHeader column="motif" label="Motif / Commentaire" sort={table.sort} onSort={table.setSort} />
                    <SortableHeader column="utilisateurNom" label="Opérateur" sort={table.sort} onSort={table.setSort} />
                    <SortableHeader column="createdAt" label="Date & Heure" sort={table.sort} onSort={table.setSort} align="right" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-medium">
                  {table.paginatedData.map(m => {
                    const isEntree = m.type === 'entree';
                    const isSortie = m.type === 'sortie' || m.type === 'usage_interne';

                    return (
                      <tr key={m.id} className="hover:bg-amber-50/30 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div
                              className={clsx(
                                'w-6 h-6 rounded-full flex items-center justify-center shrink-0',
                                isEntree ? 'bg-emerald-100 text-emerald-700' : isSortie ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                              )}
                            >
                              {isEntree ? (
                                <ArrowUpCircle size={14} />
                              ) : isSortie ? (
                                <ArrowDownCircle size={14} />
                              ) : (
                                <RefreshCw size={14} />
                              )}
                            </div>
                            <span className="capitalize font-semibold text-gray-700">
                              {m.type === 'usage_interne' ? 'Usage Interne' : m.type}
                            </span>
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          <p className="font-bold text-gray-900">{m.produitNom}</p>
                          <p className="text-[10px] font-mono text-gray-500">{m.produitRef}</p>
                        </td>

                        <td className={clsx('px-4 py-3 text-right font-extrabold text-sm', isEntree ? 'text-emerald-600' : isSortie ? 'text-red-600' : 'text-amber-600')}>
                          {isEntree ? '+' : isSortie ? '-' : ''}{m.quantite}
                        </td>

                        <td className="px-4 py-3 text-right text-gray-500 font-mono">{m.stockAvant}</td>
                        <td className="px-4 py-3 text-right font-bold text-gray-900 font-mono">{m.stockApres}</td>
                        <td className="px-4 py-3 text-gray-600 max-w-xs truncate">{m.motif || '—'}</td>
                        <td className="px-4 py-3 text-gray-600">{m.utilisateurNom || '—'}</td>
                        <td className="px-4 py-3 text-right font-mono text-gray-400 text-[11px]">
                          {format(new Date(m.createdAt), 'dd/MM/yyyy HH:mm')}
                        </td>
                      </tr>
                    );
                  })}
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
          </>
        )}
      </div>

      {/* ── Modal Saisie Mouvement (Style Stock-App) ────────── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-5 border-b" style={{ borderColor: 'var(--color-cream-dark)' }}>
              <h3 className="text-xl font-semibold" style={{ color: 'var(--color-ink)', fontFamily: 'var(--font-display)' }}>
                Nouveau mouvement
              </h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
              <div>
                <label className="label">Type de mouvement *</label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {(['entree', 'sortie', 'usage_interne', 'ajustement'] as const).map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, type: t }))}
                      className={clsx(
                        'py-2.5 rounded-xl text-xs font-semibold capitalize border transition-all',
                        form.type === t
                          ? 'bg-[var(--color-gold)] text-white border-[var(--color-gold)] shadow-sm'
                          : 'bg-white border-gray-200 text-gray-600 hover:border-amber-400'
                      )}
                    >
                      {t === 'entree'
                        ? 'Entrée'
                        : t === 'sortie'
                        ? 'Sortie'
                        : t === 'usage_interne'
                        ? 'Usage Interne'
                        : 'Ajustement'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="label">Produit *</label>
                <ProductSearch
                  produits={produits}
                  selectedId={form.produitId}
                  onSelect={p => setForm(f => ({ ...f, produitId: p.id }))}
                  required
                />
              </div>

              {selectedProduit && (
                <div className="bg-amber-50/70 border border-amber-100 rounded-xl px-4 py-3 text-xs flex items-center justify-between">
                  <div>
                    <span className="text-gray-500 font-medium">Stock actuel : </span>
                    <strong className="text-gray-900 font-bold">{selectedProduit.stockActuel} {selectedProduit.unite}</strong>
                  </div>
                  <div>
                    <span className="text-gray-500 font-medium">Stock min : </span>
                    <strong className="text-gray-900 font-bold">{selectedProduit.stockMinimum}</strong>
                  </div>
                </div>
              )}

              <div>
                <label className="label">Quantité *</label>
                <input
                  type="number"
                  min="1"
                  required
                  className="input text-xs font-semibold"
                  value={form.quantite}
                  onChange={e => setForm(f => ({ ...f, quantite: parseInt(e.target.value) || 1 }))}
                />
              </div>

              <div>
                <label className="label">Motif *</label>
                <input
                  required
                  className="input text-xs"
                  placeholder="Ex: Réception commande fournisseur"
                  value={form.motif}
                  onChange={e => setForm(f => ({ ...f, motif: e.target.value }))}
                />
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn-secondary flex-1 text-xs"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary flex-1 text-xs"
                >
                  {saving ? 'Enregistrement…' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
