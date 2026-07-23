import { useEffect, useState } from 'react';
import {
  Search, Plus, Save, History, CheckCircle2,
  ClipboardList, Trash2, Camera, X, RefreshCw, Eye
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import toast from 'react-hot-toast';
import clsx from 'clsx';

import ProductSearch from '../../components/common/ProductSearch';
import Scanner from '../../components/common/Scanner';
import { useAppStore } from '@/store/appStore';
import { useAuthStore } from '@/store/authStore';
import { inventairesApi, USE_API } from '@/lib/api';
import type { Produit, InventaireSession, LigneInventaire } from '@/types';
import { useTableControls } from '@/hooks/useTableControls';
import { Pagination } from '@/components/ui/Pagination';
import { SortableHeader } from '@/components/ui/SortableHeader';

export default function InventairePage() {
  const { produits, fetchProduits } = useAppStore();
  const { user } = useAuthStore();
  const canManage = user?.role === 'admin' || user?.role === 'gestionnaire';

  const [history, setHistory] = useState<InventaireSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<'nouveau' | 'historique'>('nouveau');
  const [showScanner, setShowScanner] = useState(false);

  // Form state for current counting session
  const [lignes, setLignes] = useState<LigneInventaire[]>([]);
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [selectedProductSearchId, setSelectedProductSearchId] = useState('');

  // Selected session for details modal
  const [detailSession, setDetailSession] = useState<InventaireSession | null>(null);

  const historyTable = useTableControls(history, {
    defaultSort: 'date',
    defaultDirection: 'desc',
    defaultPageSize: 10,
  });

  const loadHistory = async () => {
    setLoading(true);
    try {
      if (USE_API) {
        const data = await inventairesApi.list();
        setHistory(data);
      }
    } catch (e) {
      console.error('Erreur chargement inventaires', e);
      toast.error('Erreur de chargement des inventaires');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (produits.length === 0) fetchProduits();
    loadHistory();
  }, []);

  const addToInventaire = (p: Produit) => {
    if (lignes.some(l => l.produitId === p.id)) {
      toast.error('Ce produit est déjà dans la liste de comptage');
      return;
    }
    const nouvelleLigne: LigneInventaire = {
      produitId: p.id,
      produitRef: p.reference,
      produitNom: p.designation,
      stockTheorique: p.stockActuel,
      stockReel: p.stockActuel, // Default to current theoretical stock
      ecart: 0,
    };
    setLignes(prev => [nouvelleLigne, ...prev]);
    setSelectedProductSearchId('');
    toast.success(`${p.designation} ajouté`);
  };

  const updateStockReel = (id: string, val: string) => {
    const reel = Math.max(0, parseInt(val) || 0);
    setLignes(prev =>
      prev.map(l => {
        if (l.produitId === id) {
          const ecart = reel - l.stockTheorique;
          return { ...l, stockReel: reel, ecart };
        }
        return l;
      })
    );
  };

  const removeLigne = (id: string) => {
    setLignes(prev => prev.filter(l => l.produitId !== id));
  };

  const handleSave = async (autoValidate: boolean = false) => {
    if (lignes.length === 0) return toast.error('Ajoutez au moins un produit au comptage');
    setIsSaving(true);

    try {
      if (USE_API) {
        await inventairesApi.create({
          lignes,
          notes,
          autoValidate,
        });
        toast.success(
          autoValidate
            ? 'Inventaire validé et stocks mis à jour en direct !'
            : 'Session d’inventaire enregistrée en brouillon'
        );
        fetchProduits(); // refresh updated product stocks
        loadHistory();
        setLignes([]);
        setNotes('');
        setView('historique');
      } else {
        toast.success('Inventaire enregistré');
        setLignes([]);
        setNotes('');
      }
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || 'Erreur lors de la sauvegarde de l’inventaire');
    } finally {
      setIsSaving(false);
    }
  };

  const handleValiderSession = async (inv: InventaireSession) => {
    if (
      !confirm(
        `Voulez-vous valider l'inventaire #${inv.id.slice(0, 8)} ? Cela mettra à jour les stocks réels et créera automatiquement les mouvements de régularisation.`
      )
    )
      return;

    setLoading(true);
    try {
      if (USE_API) {
        await inventairesApi.valider(inv.id);
        toast.success('Inventaire validé et stocks mis à jour !');
        fetchProduits();
        loadHistory();
      }
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || 'Erreur lors de la validation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
        {/* Header Title & Tab Switcher */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-amber-700 font-mono font-semibold uppercase tracking-wider mb-1">
              <ClipboardList size={14} /> Opérations Stock
            </div>
            <h1 className="text-2xl font-bold text-gray-900 font-display">
              Inventaire & Comptage Physique
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Réconciliation des stocks réels en magasin et régularisation automatique
            </p>
          </div>

          <div className="flex bg-gray-100 p-1 rounded-xl shrink-0 self-start sm:self-auto border border-gray-200">
            <button
              onClick={() => setView('nouveau')}
              className={clsx(
                'px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2',
                view === 'nouveau'
                  ? 'bg-white text-amber-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              )}
            >
              <Plus size={15} /> Nouveau Comptage
            </button>
            <button
              onClick={() => setView('historique')}
              className={clsx(
                'px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2',
                view === 'historique'
                  ? 'bg-white text-amber-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              )}
            >
              <History size={15} /> Historique ({history.length})
            </button>
          </div>
        </div>

        {/* ── TAB 1: NOUVEAU COMPTAGE ────────────────────────── */}
        {view === 'nouveau' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column: Product Selection */}
            <div className="lg:col-span-1 space-y-4">
              <div className="card space-y-4">
                <h3 className="font-semibold text-sm text-gray-900 flex items-center gap-2">
                  <Search size={16} className="text-amber-600" /> Ajouter un produit au comptage
                </h3>

                <div className="space-y-3">
                  <label className="label">Rechercher un produit *</label>
                  <ProductSearch
                    produits={produits}
                    selectedId={selectedProductSearchId}
                    onSelect={p => addToInventaire(p)}
                    placeholder="Taper nom ou référence…"
                  />

                  <div className="pt-2 flex items-center justify-between border-t border-gray-100">
                    <span className="text-xs text-gray-500">Ou utiliser le scanner :</span>
                    <button
                      type="button"
                      onClick={() => setShowScanner(true)}
                      className="btn-secondary text-xs flex items-center gap-1.5"
                    >
                      <Camera size={15} className="text-amber-600" /> Scanner Code-Barres
                    </button>
                  </div>
                </div>
              </div>

              {/* Quick actions info box */}
              <div className="bg-amber-50/70 border border-amber-200/60 rounded-xl p-4 text-xs text-amber-900 space-y-2">
                <p className="font-semibold flex items-center gap-1.5">
                  <CheckCircle2 size={15} className="text-amber-600" /> Guide de comptage :
                </p>
                <ul className="list-disc pl-4 space-y-1 text-[11px] text-amber-800">
                  <li>Saisissez la quantité réellement présente en magasin.</li>
                  <li>L'écart (différence) est calculé automatiquement.</li>
                  <li>La validation met à jour le stock et crée les mouvements d'ajustement.</li>
                </ul>
              </div>
            </div>

            {/* Right Column: Counting Table & Submission */}
            <div className="lg:col-span-2 space-y-4">
              <div className="card space-y-4">
                <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--color-cream-dark)' }}>
                  <div>
                    <h3 className="font-semibold text-sm text-gray-900">
                      Feuille de comptage ({lignes.length} {lignes.length > 1 ? 'articles' : 'article'})
                    </h3>
                  </div>
                  {lignes.length > 0 && (
                    <button
                      onClick={() => setLignes([])}
                      className="text-xs text-red-600 hover:text-red-700 font-medium flex items-center gap-1"
                    >
                      <Trash2 size={13} /> Tout effacer
                    </button>
                  )}
                </div>

                {lignes.length === 0 ? (
                  <div className="py-12 text-center space-y-3">
                    <ClipboardList size={36} className="mx-auto text-gray-300" />
                    <p className="text-xs font-semibold text-gray-500">
                      Aucun produit sélectionné pour le moment
                    </p>
                    <p className="text-[11px] text-gray-400 max-w-xs mx-auto">
                      Recherchez un produit à gauche ou scannez un code-barres pour démarrer la session de comptage.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b text-gray-500 font-medium bg-gray-50/50">
                          <th className="py-2.5 px-3">Produit</th>
                          <th className="py-2.5 px-3 text-center">Stock Théorique</th>
                          <th className="py-2.5 px-3 text-center">Stock Réel Compté</th>
                          <th className="py-2.5 px-3 text-center">Écart</th>
                          <th className="py-2.5 px-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {lignes.map(l => (
                          <tr key={l.produitId} className="hover:bg-gray-50/60">
                            <td className="py-3 px-3">
                              <p className="font-semibold text-gray-900">{l.produitNom}</p>
                              <p className="text-[10px] font-mono text-gray-400 uppercase">{l.produitRef}</p>
                            </td>
                            <td className="py-3 px-3 text-center font-semibold text-gray-700">
                              {l.stockTheorique}
                            </td>
                            <td className="py-3 px-3 text-center">
                              <input
                                type="number"
                                min="0"
                                className="w-20 text-center input py-1 px-2 text-xs font-bold text-amber-900 border-amber-300 focus:border-amber-600"
                                value={l.stockReel}
                                onChange={e => updateStockReel(l.produitId, e.target.value)}
                              />
                            </td>
                            <td className="py-3 px-3 text-center">
                              <span
                                className={clsx(
                                  'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold',
                                  l.ecart === 0
                                    ? 'bg-gray-100 text-gray-600'
                                    : l.ecart > 0
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : 'bg-red-100 text-red-700'
                                )}
                              >
                                {l.ecart > 0 ? `+${l.ecart}` : l.ecart}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-right">
                              <button
                                type="button"
                                onClick={() => removeLigne(l.produitId)}
                                className="p-1 text-gray-400 hover:text-red-600 rounded transition-colors"
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {lignes.length > 0 && (
                  <div className="pt-4 border-t space-y-4" style={{ borderColor: 'var(--color-cream-dark)' }}>
                    <div>
                      <label className="label">Notes / Observations</label>
                      <input
                        className="input text-xs"
                        placeholder="Ex: Inventaire annuel de fin de mois, casse constatée en rayon B..."
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                      />
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 pt-2">
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() => handleSave(false)}
                        className="btn-secondary flex-1 text-xs py-2.5 flex items-center justify-center gap-2"
                      >
                        <Save size={15} /> Enregistrer Brouillon
                      </button>
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() => handleSave(true)}
                        className="btn-primary flex-1 text-xs py-2.5 flex items-center justify-center gap-2"
                      >
                        <CheckCircle2 size={15} /> Valider & Appliquer en Direct
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 2: HISTORIQUE ─────────────────────────────── */}
        {view === 'historique' && (
          <div className="card space-y-4">
            <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--color-cream-dark)' }}>
              <h3 className="font-semibold text-sm text-gray-900">
                Historique des Sessions d’Inventaire
              </h3>
              <button onClick={loadHistory} className="btn-secondary text-xs flex items-center gap-1.5">
                <RefreshCw size={13} className={clsx(loading && 'animate-spin')} /> Actualiser
              </button>
            </div>

            {history.length === 0 ? (
              <div className="py-12 text-center space-y-2">
                <History size={36} className="mx-auto text-gray-300" />
                <p className="text-xs font-semibold text-gray-500">
                  Aucun inventaire enregistré
                </p>
                <p className="text-[11px] text-gray-400">
                  Créez votre première session de comptage en cliquant sur "Nouveau Comptage".
                </p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b text-gray-500 font-medium bg-gray-50/50">
                        <SortableHeader column="id" label="N° Session" sort={historyTable.sort} onSort={historyTable.setSort} />
                        <SortableHeader column="date" label="Date" sort={historyTable.sort} onSort={historyTable.setSort} />
                        <SortableHeader column="utilisateurNom" label="Opérateur" sort={historyTable.sort} onSort={historyTable.setSort} />
                        <th className="py-2.5 px-3 text-center text-xs font-semibold uppercase text-gray-400">Articles comptés</th>
                        <SortableHeader column="statut" label="Statut" align="center" sort={historyTable.sort} onSort={historyTable.setSort} />
                        <th className="py-2.5 px-3 text-right text-xs font-semibold uppercase text-gray-400">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {historyTable.paginatedData.map(inv => {
                        const totalEcart = ((inv.lignes as LigneInventaire[]) || []).reduce(
                          (sum, l) => sum + Math.abs(l.ecart),
                          0
                        );

                        return (
                          <tr key={inv.id} className="hover:bg-gray-50/60">
                            <td className="py-3 px-3 font-mono font-bold text-gray-900">
                              #{inv.id.slice(0, 8)}
                            </td>
                            <td className="py-3 px-3 text-gray-600">
                              {format(new Date(inv.date), 'dd MMMM yyyy HH:mm', { locale: fr })}
                            </td>
                            <td className="py-3 px-3 text-gray-800 font-medium">
                              {inv.utilisateurNom}
                            </td>
                            <td className="py-3 px-3 text-center">
                              <span className="font-semibold text-gray-900">
                                {inv.lignes?.length || 0}
                              </span>
                              {totalEcart > 0 && (
                                <span className="ml-2 text-[10px] text-amber-700 font-bold bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
                                  {totalEcart} écart(s)
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-center">
                              <span
                                className={clsx(
                                  'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold capitalize',
                                  inv.statut === 'valide'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-amber-100 text-amber-800'
                                )}
                              >
                                {inv.statut === 'valide' ? 'Validé' : 'En cours (Brouillon)'}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-right space-x-2">
                              <button
                                onClick={() => setDetailSession(inv)}
                                className="btn-secondary text-[11px] py-1 px-2.5 inline-flex items-center gap-1"
                              >
                                <Eye size={13} /> Détails
                              </button>
                              {inv.statut === 'en_cours' && canManage && (
                                <button
                                  onClick={() => handleValiderSession(inv)}
                                  className="btn-primary text-[11px] py-1 px-2.5 inline-flex items-center gap-1"
                                >
                                  <CheckCircle2 size={13} /> Valider
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <Pagination
                  page={historyTable.page}
                  totalPages={historyTable.totalPages}
                  totalItems={historyTable.totalItems}
                  pageSize={historyTable.pageSize}
                  onPageChange={historyTable.setPage}
                  onPageSizeChange={historyTable.setPageSize}
                />
              </>
            )}
          </div>
        )}

        {/* ── Modal Détails Session ──────────────────────────── */}
        {detailSession && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--color-cream-dark)' }}>
                <div>
                  <h3 className="font-bold text-base text-gray-900">
                    Détails de l’inventaire #{detailSession.id.slice(0, 8)}
                  </h3>
                  <p className="text-xs text-gray-500">
                    {format(new Date(detailSession.date), 'dd/MM/yyyy HH:mm', { locale: fr })} par {detailSession.utilisateurNom}
                  </p>
                </div>
                <button onClick={() => setDetailSession(null)} className="text-gray-400 hover:text-gray-600">
                  <X size={18} />
                </button>
              </div>

              <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b text-gray-500 bg-gray-50/50">
                        <th className="py-2 px-3">Produit</th>
                        <th className="py-2 px-3 text-center">Stock Théorique</th>
                        <th className="py-2 px-3 text-center">Stock Réel</th>
                        <th className="py-2 px-3 text-center">Écart</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {((detailSession.lignes as LigneInventaire[]) || []).map(l => (
                        <tr key={l.produitId}>
                          <td className="py-2.5 px-3">
                            <p className="font-semibold text-gray-900">{l.produitNom}</p>
                            <p className="text-[10px] font-mono text-gray-400">{l.produitRef}</p>
                          </td>
                          <td className="py-2.5 px-3 text-center font-semibold text-gray-700">
                            {l.stockTheorique}
                          </td>
                          <td className="py-2.5 px-3 text-center font-bold text-amber-900">
                            {l.stockReel}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span
                              className={clsx(
                                'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold',
                                l.ecart === 0
                                  ? 'bg-gray-100 text-gray-600'
                                  : l.ecart > 0
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-red-100 text-red-700'
                              )}
                            >
                              {l.ecart > 0 ? `+${l.ecart}` : l.ecart}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {detailSession.notes && (
                  <div className="bg-gray-50 p-3 rounded-xl border border-gray-200/60 text-xs">
                    <p className="font-semibold text-gray-700 mb-0.5">Notes :</p>
                    <p className="text-gray-600">{detailSession.notes}</p>
                  </div>
                )}
              </div>

              <div className="px-6 py-4 border-t flex justify-end gap-2 bg-gray-50/50" style={{ borderColor: 'var(--color-cream-dark)' }}>
                <button onClick={() => setDetailSession(null)} className="btn-secondary text-xs">
                  Fermer
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Scanner Modal ──────────────────────────────────── */}
        {showScanner && (
          <Scanner
            onScan={code => {
              const target = produits.find(
                p => p.codeBarres === code || p.reference.toLowerCase() === code.toLowerCase()
              );
              if (target) {
                addToInventaire(target);
                setShowScanner(false);
              } else {
                toast.error(`Aucun produit trouvé pour le code-barres : ${code}`);
              }
            }}
            onClose={() => setShowScanner(false)}
          />
        )}
      </div>
  );
}
