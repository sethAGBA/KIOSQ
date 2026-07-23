import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search, Package, AlertTriangle, TrendingDown, X, Edit, Trash2, Tag } from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { useAppStore } from '@/store/appStore';
import { useAuthStore } from '@/store/authStore';
import { produitsApi, USE_API } from '@/lib/api';
import { formatPrice } from '@/lib/format';
import type { Produit } from '@/types';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { useTableControls } from '@/hooks/useTableControls';
import { SortableHeader } from '@/components/ui/SortableHeader';
import { Pagination } from '@/components/ui/Pagination';


const EMPTY_FORM = {
  reference: '',
  designation: '',
  description: '',
  categorieId: '',
  fournisseurId: '',
  unite: 'pièce',
  marque: '',
  prixAchat: 0,
  prixVente: 0,
  prixVenteGros: 0,
  stockActuel: 0,
  stockMinimum: 5,
  stockMaximum: undefined as number | undefined,
  datePeremption: '',
  emplacement: '',
  codeBarres: '',
  magasinId: '',
};

export default function ProduitsPage() {
  const { produits, categories, fournisseurs, magasins, addProduit, updateProduit, deleteProduit } = useAppStore();
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('tous');
  const [stockFilter, setStockFilter] = useState<'tous' | 'alerte' | 'rupture'>('tous');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Produit | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);

  const canEdit = user?.role === 'admin' || user?.role === 'gestionnaire';
  const isAdmin = user?.role === 'admin';

  // Auto-open edit modal via ?edit=<id> (from ProduitDetailPage)
  useEffect(() => {
    const editId = searchParams.get('edit');
    if (editId) {
      const p = produits.find(x => x.id === editId);
      if (p) openEdit(p, { stopPropagation: () => {} } as React.MouseEvent);
      setSearchParams({}, { replace: true });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [produits]);

  const filtered = useMemo(() => {
    return produits.filter((p) => {
      const matchSearch =
        p.designation.toLowerCase().includes(search.toLowerCase()) ||
        p.reference.toLowerCase().includes(search.toLowerCase()) ||
        p.marque?.toLowerCase().includes(search.toLowerCase());
      const matchCat = catFilter === 'tous' || p.categorieId === catFilter;
      const matchStock =
        stockFilter === 'tous' ? true :
        stockFilter === 'rupture' ? p.stockActuel === 0 :
        p.stockActuel <= p.stockMinimum;
      return matchSearch && matchCat && matchStock;
    });
  }, [produits, search, catFilter, stockFilter]);

  const table = useTableControls(filtered, { defaultSort: 'designation', defaultDirection: 'asc' });

  const enAlerte = produits.filter((p) => p.stockActuel <= p.stockMinimum && p.stockActuel > 0).length;
  const enRupture = produits.filter((p) => p.stockActuel === 0).length;
  const valeurStock = produits.reduce((s, p) => s + p.stockActuel * p.prixAchat, 0);

  const generateRef = () => {
    const ts = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).substring(2, 5).toUpperCase();
    return `ART-${ts}${rand}`;
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, reference: generateRef() });
    setShowModal(true);
  };

  const openEdit = (p: Produit, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditing(p);
    setForm({
      reference: p.reference,
      designation: p.designation,
      description: p.description ?? '',
      categorieId: p.categorieId ?? '',
      fournisseurId: p.fournisseurId ?? '',
      unite: p.unite,
      marque: p.marque ?? '',
      prixAchat: p.prixAchat,
      prixVente: p.prixVente,
      prixVenteGros: p.prixVenteGros ?? 0,
      stockActuel: p.stockActuel,
      stockMinimum: p.stockMinimum,
      stockMaximum: p.stockMaximum,
      datePeremption: p.datePeremption ? new Date(p.datePeremption).toISOString().split('T')[0] : '',
      emplacement: p.emplacement ?? '',
      codeBarres: p.codeBarres ?? '',
      magasinId: p.magasinId ?? '',
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        ...form,
        categorieId:   form.categorieId   || undefined,
        fournisseurId: form.fournisseurId || undefined,
        marque:        form.marque        || undefined,
        description:   form.description   || undefined,
        emplacement:   form.emplacement   || undefined,
        codeBarres:    form.codeBarres    || undefined,
        magasinId:     form.magasinId     || undefined,
        datePeremption:form.datePeremption? new Date(form.datePeremption) : undefined,
        prixVenteGros: form.prixVenteGros > 0 ? form.prixVenteGros : undefined,
        stockMaximum:  form.stockMaximum  || undefined,
      };

      if (editing) {
        if (USE_API) {
          const updated = await produitsApi.update(editing.id, payload);
          updateProduit(editing.id, updated);
        } else {
          const cat = categories.find(c => c.id === form.categorieId);
          const four = fournisseurs.find(f => f.id === form.fournisseurId);
          updateProduit(editing.id, { ...payload, categorie: cat?.nom, fournisseur: four?.nom, updatedAt: new Date() });
        }
        toast.success('Produit modifié');
      } else {
        if (USE_API) {
          const created = await produitsApi.create(payload);
          addProduit(created);
        } else {
          const cat = categories.find(c => c.id === form.categorieId);
          const four = fournisseurs.find(f => f.id === form.fournisseurId);
          addProduit({
            ...payload,
            id: `p-${Date.now()}`,
            categorie: cat?.nom,
            fournisseur: four?.nom,
            actif: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          } as Produit);
        }
        toast.success('Produit créé');
      }
      setShowModal(false);
    } catch (err: any) {
      toast.error(err.message || 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (p: Produit, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Supprimer le produit "${p.designation}" ?`)) return;
    try {
      if (USE_API) {
        await produitsApi.remove(p.id);
      }
      deleteProduit(p.id);
      toast.success('Produit supprimé');
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la suppression');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-mono tracking-widest uppercase mb-1" style={{ color: 'var(--color-ink-muted)' }}>Catalogue</p>
          <h1 className="text-3xl font-bold" style={{ color: 'var(--color-ink)', fontFamily: 'var(--font-display)' }}>Produits & Stock</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="btn-secondary"
            onClick={() => navigate('/produits/etiquettes')}
            title="Générer des étiquettes"
          >
            <Tag size={15} /> Étiquettes
          </button>
          {canEdit && (
            <button className="btn-primary" onClick={openCreate}>
              <Plus size={15} /> Nouveau produit
            </button>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <p className="label">Références</p>
          <p className="text-xl font-bold" style={{ color: 'var(--color-ink)' }}>{produits.length}</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-ink-muted)' }}>{produits.filter(p => p.actif).length} actives</p>
        </div>
        <div className="card p-4">
          <p className="label">Valeur stock</p>
          <p className="text-xl font-bold" style={{ color: 'var(--color-gold)' }}>{formatPrice(valeurStock)}</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-ink-muted)' }}>au prix d'achat</p>
        </div>
        <div className="card p-4 border-l-2" style={{ borderLeftColor: '#f59e0b' }}>
          <p className="label">En alerte</p>
          <p className="text-xl font-bold" style={{ color: '#d97706' }}>{enAlerte}</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-ink-muted)' }}>stock ≤ minimum</p>
        </div>
        <div className="card p-4 border-l-2" style={{ borderLeftColor: '#ef4444' }}>
          <p className="label">En rupture</p>
          <p className="text-xl font-bold" style={{ color: '#dc2626' }}>{enRupture}</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-ink-muted)' }}>stock = 0</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-ink-muted)' }} />
          <input className="input pl-9" placeholder="Rechercher…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <SearchableSelect
          className="w-48"
          options={categories.map(c => ({ value: c.id, label: c.nom }))}
          value={catFilter === 'tous' ? '' : catFilter}
          onChange={val => setCatFilter(val || 'tous')}
          emptyLabel="Toutes catégories"
          placeholder="Filtrer par catégorie…"
        />
        <div className="flex gap-2">
          {(['tous', 'alerte', 'rupture'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setStockFilter(f)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize"
              style={
                stockFilter === f
                  ? { backgroundColor: f === 'rupture' ? '#ef4444' : f === 'alerte' ? '#f59e0b' : 'var(--color-gold)', color: 'white' }
                  : { backgroundColor: 'var(--color-cream-dark)', color: 'var(--color-ink-muted)' }
              }
            >
              {f === 'tous' ? 'Tous' : f === 'alerte' ? '⚠ Alerte' : '🚫 Rupture'}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <table className="table-auto w-full">
          <thead>
            <tr>
              <SortableHeader column="reference" label="Référence" sort={table.sort} onSort={table.setSort} />
              <SortableHeader column="designation" label="Désignation" sort={table.sort} onSort={table.setSort} />
              <SortableHeader column="categorie" label="Catégorie" sort={table.sort} onSort={table.setSort} />
              <SortableHeader column="fournisseur" label="Fournisseur" sort={table.sort} onSort={table.setSort} />
              <SortableHeader column="prixAchat" label="Prix achat" sort={table.sort} onSort={table.setSort} align="right" />
              <SortableHeader column="prixVente" label="Prix vente" sort={table.sort} onSort={table.setSort} align="right" />
              <SortableHeader column="stockActuel" label="Stock" sort={table.sort} onSort={table.setSort} align="right" />
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-ink-muted)' }}>Statut</th>
              {canEdit && <th></th>}
            </tr>
          </thead>
          <tbody>
            {table.paginatedData.length === 0 ? (
              <tr><td colSpan={canEdit ? 9 : 8} className="text-center py-10" style={{ color: 'var(--color-ink-muted)' }}>Aucun produit trouvé</td></tr>
            ) : table.paginatedData.map((p) => {
              const isRupture = p.stockActuel === 0;
              const isAlerte = !isRupture && p.stockActuel <= p.stockMinimum;
              return (
                <tr key={p.id} className="cursor-pointer" onClick={() => navigate(`/produits/${p.id}`)}>
                  <td><span className="font-mono text-xs font-medium" style={{ color: 'var(--color-ink)' }}>{p.reference}</span></td>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--color-gold-pale)', color: 'var(--color-gold)' }}>
                        <Package size={13} />
                      </div>
                      <div>
                        <p className="text-sm font-medium" style={{ color: 'var(--color-ink)' }}>{p.designation}</p>
                        {p.marque && <p className="text-xs" style={{ color: 'var(--color-ink-muted)' }}>{p.marque}</p>}
                      </div>
                    </div>
                  </td>
                  <td><span className="badge badge-neutral">{p.categorie ?? '—'}</span></td>
                  <td style={{ color: 'var(--color-ink-muted)' }}>{p.fournisseur ?? '—'}</td>
                  <td style={{ color: 'var(--color-ink)' }}>{formatPrice(p.prixAchat)}</td>
                  <td>
                    <span className="font-semibold block" style={{ color: 'var(--color-gold)' }}>{formatPrice(p.prixVente)}</span>
                    {p.prixVenteGros ? (
                      <span className="text-[10px] text-purple-700 font-mono block">Gros: {formatPrice(p.prixVenteGros)}</span>
                    ) : null}
                  </td>
                  <td>
                    <div className="flex items-center gap-1.5">
                      {isRupture ? <TrendingDown size={13} className="text-red-500" /> : isAlerte ? <AlertTriangle size={13} className="text-amber-500" /> : null}
                      <span className={clsx('font-semibold text-sm', isRupture ? 'text-red-600' : isAlerte ? 'text-amber-600' : '')}
                        style={!isRupture && !isAlerte ? { color: 'var(--color-ink)' } : {}}>
                        {p.stockActuel}
                      </span>
                      <span className="text-xs" style={{ color: 'var(--color-ink-muted)' }}>{p.unite}</span>
                    </div>
                  </td>
                  <td>
                    {isRupture ? <span className="badge badge-danger">Rupture</span>
                      : isAlerte ? <span className="badge badge-warning">Alerte</span>
                      : <span className="badge badge-success">OK</span>}
                  </td>
                  {canEdit && (
                    <td onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => openEdit(p, e)}
                          className="p-1.5 rounded-lg transition-colors hover:bg-gold/10"
                          style={{ color: 'var(--color-ink-muted)' }}
                          title="Modifier"
                        >
                          <Edit size={13} />
                        </button>
                        {isAdmin && (
                          <button
                            onClick={(e) => handleDelete(p, e)}
                            className="p-1.5 rounded-lg transition-colors hover:bg-red-50"
                            style={{ color: 'var(--color-ink-muted)' }}
                            title="Supprimer"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
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

      {/* Modal Create / Edit */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-5 border-b" style={{ borderColor: 'var(--color-cream-dark)' }}>
              <h3 className="font-semibold text-lg" style={{ color: 'var(--color-ink)', fontFamily: 'var(--font-display)' }}>
                {editing ? 'Modifier le produit' : 'Nouveau produit'}
              </h3>
              <button onClick={() => setShowModal(false)} style={{ color: 'var(--color-ink-muted)' }}><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Référence *</label>
                  <div className="flex gap-2">
                    <input
                      required
                      className="input flex-1"
                      placeholder="ART-001"
                      value={form.reference}
                      onChange={e => setForm(f => ({ ...f, reference: e.target.value }))}
                    />
                    <button
                      type="button"
                      onClick={() => setForm(f => ({ ...f, reference: generateRef() }))}
                      className="px-3 rounded-lg text-xs font-bold transition-colors"
                      style={{ backgroundColor: 'var(--color-cream)', color: 'var(--color-gold)' }}
                      title="Générer automatiquement"
                    >
                      AUTO
                    </button>
                  </div>
                </div>
                <div>
                  <label className="label">Unité *</label>
                  <SearchableSelect
                    required
                    options={['pièce', 'boîte', 'ramette', 'kg', 'litre', 'mètre', 'paquet', 'carton'].map(u => ({ value: u, label: u }))}
                    value={form.unite}
                    onChange={val => setForm(f => ({ ...f, unite: val }))}
                    emptyLabel="Sélectionner…"
                    placeholder="Rechercher une unité…"
                  />
                </div>
              </div>

              <div>
                <label className="label">Désignation *</label>
                <input
                  required
                  className="input"
                  placeholder="Nom du produit"
                  value={form.designation}
                  onChange={e => setForm(f => ({ ...f, designation: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Catégorie</label>
                  <SearchableSelect
                    options={categories.map(c => ({ value: c.id, label: c.nom }))}
                    value={form.categorieId}
                    onChange={val => setForm(f => ({ ...f, categorieId: val }))}
                    emptyLabel="— Aucune —"
                    placeholder="Rechercher une catégorie…"
                  />
                </div>
                <div>
                  <label className="label">Fournisseur</label>
                  <SearchableSelect
                    options={fournisseurs.map(fourn => ({ value: fourn.id, label: fourn.nom }))}
                    value={form.fournisseurId}
                    onChange={val => setForm(f => ({ ...f, fournisseurId: val }))}
                    emptyLabel="— Aucun —"
                    placeholder="Rechercher un fournisseur…"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Marque / Fabricant</label>
                  <input
                    className="input"
                    placeholder="Ex: Dell, Samsung…"
                    value={form.marque}
                    onChange={e => setForm(f => ({ ...f, marque: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="label">Magasin (affectation)</label>
                  <SearchableSelect
                    options={magasins.map(m => ({ value: m.id, label: m.nom }))}
                    value={form.magasinId}
                    onChange={val => setForm(f => ({ ...f, magasinId: val }))}
                    emptyLabel="— Aucun (Global) —"
                    placeholder="Sélectionner un magasin…"
                  />
                  <p className="text-[9px] mt-1" style={{ color: 'var(--color-ink-muted)' }}>Laisser vide pour rendre cet article disponible globalement.</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Code-barres</label>
                  <div className="flex gap-2">
                    <input
                      className="input flex-1"
                      placeholder="Ex: 361427204..."
                      value={form.codeBarres}
                      onChange={e => setForm(f => ({ ...f, codeBarres: e.target.value }))}
                    />
                    <button
                      type="button"
                      onClick={() => toast('Fonction de scan caméra à implémenter', { icon: '📷' })}
                      className="p-3 bg-cream hover:bg-gold/10 text-gold rounded-xl transition-colors" title="Scanner"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>
                    </button>
                  </div>
                </div>
                <div>
                  <label className="label">Emplacement</label>
                  <input
                    className="input"
                    placeholder="Ex: Rayon A1"
                    value={form.emplacement}
                    onChange={e => setForm(f => ({ ...f, emplacement: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="label">Prix achat (F)</label>
                  <input type="number" min="0" className="input" value={form.prixAchat}
                    onChange={e => setForm(f => ({ ...f, prixAchat: +e.target.value }))} />
                </div>
                <div>
                  <label className="label">Prix vente (F)</label>
                  <input type="number" min="0" className="input" value={form.prixVente}
                    onChange={e => setForm(f => ({ ...f, prixVente: +e.target.value }))} />
                </div>
                <div>
                  <label className="label">Prix gros (F)</label>
                  <input type="number" min="0" className="input" value={form.prixVenteGros}
                    onChange={e => setForm(f => ({ ...f, prixVenteGros: +e.target.value }))} />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-4">
                <div>
                  <label className="label">Stock actuel</label>
                  <input type="number" min="0" className="input" value={form.stockActuel}
                    onChange={e => setForm(f => ({ ...f, stockActuel: +e.target.value }))} />
                </div>
                <div>
                  <label className="label">Stock min.</label>
                  <input type="number" min="0" className="input" value={form.stockMinimum}
                    onChange={e => setForm(f => ({ ...f, stockMinimum: +e.target.value }))} />
                </div>
                <div>
                  <label className="label">Stock max.</label>
                  <input type="number" min="0" className="input" value={form.stockMaximum ?? ''}
                    onChange={e => setForm(f => ({ ...f, stockMaximum: e.target.value ? +e.target.value : undefined }))} />
                </div>
                <div>
                  <label className="label">Date péremption</label>
                  <input type="date" className="input" value={form.datePeremption}
                    onChange={e => setForm(f => ({ ...f, datePeremption: e.target.value }))} />
                </div>
              </div>

              <div>
                <label className="label">Description (optionnel)</label>
                <textarea
                  className="input resize-none"
                  rows={2}
                  placeholder="Description du produit…"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Annuler</button>
                <button type="submit" disabled={loading} className="btn-primary flex-1">
                  {loading ? 'Enregistrement…' : editing ? 'Mettre à jour' : 'Créer le produit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
