import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Package, AlertTriangle, TrendingDown } from 'lucide-react';
import clsx from 'clsx';
import { useAppStore } from '@/store/appStore';
import { formatPrice } from '@/lib/format';

export default function ProduitsPage() {
  const { produits, categories } = useAppStore();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('tous');
  const [stockFilter, setStockFilter] = useState<'tous' | 'alerte' | 'rupture'>('tous');

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

  const enAlerte = produits.filter((p) => p.stockActuel <= p.stockMinimum && p.stockActuel > 0).length;
  const enRupture = produits.filter((p) => p.stockActuel === 0).length;
  const valeurStock = produits.reduce((s, p) => s + p.stockActuel * p.prixAchat, 0);

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-mono tracking-widest uppercase mb-1" style={{ color: 'var(--color-ink-muted)' }}>Catalogue</p>
          <h1 className="text-3xl font-bold" style={{ color: 'var(--color-ink)', fontFamily: 'var(--font-display)' }}>Produits & Stock</h1>
        </div>
        <button className="btn-primary" onClick={() => navigate('/produits/nouveau')}>
          <Plus size={15} /> Nouveau produit
        </button>
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
        <select
          className="input w-auto"
          value={catFilter}
          onChange={(e) => setCatFilter(e.target.value)}
        >
          <option value="tous">Toutes catégories</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
        </select>
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
              <th>Référence</th>
              <th>Désignation</th>
              <th>Catégorie</th>
              <th>Fournisseur</th>
              <th>Prix achat</th>
              <th>Prix vente</th>
              <th>Stock</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-10" style={{ color: 'var(--color-ink-muted)' }}>Aucun produit trouvé</td></tr>
            ) : filtered.map((p) => {
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
                  <td><span className="badge badge-neutral">{p.categorie}</span></td>
                  <td style={{ color: 'var(--color-ink-muted)' }}>{p.fournisseur ?? '—'}</td>
                  <td style={{ color: 'var(--color-ink)' }}>{formatPrice(p.prixAchat)}</td>
                  <td className="font-semibold" style={{ color: 'var(--color-gold)' }}>{formatPrice(p.prixVente)}</td>
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
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
