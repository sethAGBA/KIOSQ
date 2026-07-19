import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Package, Edit, AlertTriangle, TrendingDown, Tag } from 'lucide-react';
import clsx from 'clsx';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { useAppStore } from '@/store/appStore';
import { useAuthStore } from '@/store/authStore';
import { produitsApi } from '@/lib/api';
import { formatPrice, formatDate } from '@/lib/format';

export default function ProduitDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { produits, categories, fournisseurs, updateProduit } = useAppStore();
  const { user } = useAuthStore();

  const produit = produits.find(p => p.id === id);
  const canEdit = user?.role === 'admin' || user?.role === 'gestionnaire';

  // Quick stock adjustment state
  const [adjustQty, setAdjustQty] = useState(0);
  const [adjustLoading, setAdjustLoading] = useState(false);

  if (!produit) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <p style={{ color: 'var(--color-ink-muted)' }}>Produit introuvable.</p>
      <button className="btn-secondary" onClick={() => navigate('/produits')}>Retour</button>
    </div>
  );

  const isRupture = produit.stockActuel === 0;
  const isAlerte  = !isRupture && produit.stockActuel <= produit.stockMinimum;
  const cat       = categories.find(c => c.id === produit.categorieId);
  const four      = fournisseurs.find(f => f.id === produit.fournisseurId);
  const marge     = produit.prixAchat > 0 ? ((produit.prixVente - produit.prixAchat) / produit.prixAchat) * 100 : 0;

  const handleAdjustStock = async () => {
    if (adjustQty === 0) return;
    const newStock = Math.max(0, produit.stockActuel + adjustQty);
    setAdjustLoading(true);
    try {
      const updated = await produitsApi.update(produit.id, { stockActuel: newStock }).catch(() => null);
      if (updated) {
        updateProduit(produit.id, updated);
      } else {
        updateProduit(produit.id, { stockActuel: newStock, updatedAt: new Date() });
      }
      toast.success(`Stock ajusté : ${newStock} ${produit.unite}(s)`);
      setAdjustQty(0);
    } catch {
      toast.error('Erreur lors de l\'ajustement');
    } finally {
      setAdjustLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Back */}
      <button
        className="flex items-center gap-2 text-sm transition-colors"
        style={{ color: 'var(--color-ink-muted)' }}
        onClick={() => navigate('/produits')}
      >
        <ArrowLeft size={15} /> Retour au catalogue
      </button>

      {/* Header card */}
      <div className="card p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: 'var(--color-gold-pale)', color: 'var(--color-gold)' }}
            >
              <Package size={26} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold" style={{ color: 'var(--color-ink)', fontFamily: 'var(--font-display)' }}>
                  {produit.designation}
                </h1>
                {isRupture ? <span className="badge badge-danger">Rupture</span>
                  : isAlerte ? <span className="badge badge-warning">Alerte stock</span>
                  : <span className="badge badge-success">En stock</span>}
                {!produit.actif && <span className="badge badge-neutral">Inactif</span>}
              </div>
              <div className="flex items-center gap-3 mt-1">
                <p className="text-sm font-mono" style={{ color: 'var(--color-ink-muted)' }}>{produit.reference}</p>
                {produit.marque && <span className="badge badge-neutral">{produit.marque}</span>}
              </div>
            </div>
          </div>
          {canEdit && (
            <button
              className="btn-secondary"
              onClick={() => navigate('/produits', { state: { editId: produit.id } })}
            >
              <Edit size={14} /> Modifier
            </button>
          )}
        </div>

        {/* Info grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6" style={{ borderTop: '1px solid var(--color-cream-dark)' }}>
          <div>
            <p className="label">Catégorie</p>
            <p className="text-sm font-medium" style={{ color: 'var(--color-ink)' }}>
              {cat?.nom ?? produit.categorie ?? '—'}
            </p>
          </div>
          <div>
            <p className="label">Fournisseur</p>
            <p className="text-sm font-medium" style={{ color: 'var(--color-ink)' }}>
              {four?.nom ?? produit.fournisseur ?? '—'}
            </p>
          </div>
          <div>
            <p className="label">Unité</p>
            <p className="text-sm font-medium" style={{ color: 'var(--color-ink)' }}>{produit.unite}</p>
          </div>
          {produit.emplacement && (
            <div>
              <p className="label">Emplacement</p>
              <p className="text-sm flex items-center gap-1 font-medium" style={{ color: 'var(--color-ink)' }}>
                <Tag size={12} style={{ color: 'var(--color-gold)' }} />{produit.emplacement}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <p className="label">Prix d'achat</p>
          <p className="text-xl font-bold" style={{ color: 'var(--color-ink)' }}>{formatPrice(produit.prixAchat)}</p>
        </div>
        <div className="card p-4">
          <p className="label">Prix de vente</p>
          <p className="text-xl font-bold" style={{ color: 'var(--color-gold)' }}>{formatPrice(produit.prixVente)}</p>
          {produit.prixVenteGros && (
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-ink-muted)' }}>
              Gros: {formatPrice(produit.prixVenteGros)}
            </p>
          )}
        </div>
        <div className="card p-4">
          <p className="label">Marge</p>
          <p className="text-xl font-bold" style={{ color: marge >= 20 ? '#16a34a' : marge >= 10 ? '#d97706' : '#dc2626' }}>
            {marge.toFixed(1)}%
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-ink-muted)' }}>
            {formatPrice(produit.prixVente - produit.prixAchat)} / unité
          </p>
        </div>
        <div className="card p-4">
          <p className="label">Valeur stock</p>
          <p className="text-xl font-bold" style={{ color: 'var(--color-ink)' }}>
            {formatPrice(produit.stockActuel * produit.prixAchat)}
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-ink-muted)' }}>au prix d'achat</p>
        </div>
      </div>

      {/* Stock section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Stock status */}
        <div className="card p-5">
          <h2 className="font-semibold text-sm mb-4" style={{ color: 'var(--color-ink)' }}>
            État du stock
          </h2>
          <div className="space-y-3">
            {[
              { label: 'Stock actuel', value: `${produit.stockActuel} ${produit.unite}(s)`,
                color: isRupture ? '#dc2626' : isAlerte ? '#d97706' : '#16a34a' },
              { label: 'Stock minimum', value: `${produit.stockMinimum} ${produit.unite}(s)`, color: 'var(--color-ink)' },
              { label: 'Stock maximum', value: produit.stockMaximum ? `${produit.stockMaximum} ${produit.unite}(s)` : '—', color: 'var(--color-ink)' },
            ].map(item => (
              <div key={item.label} className="flex justify-between items-center">
                <span className="text-sm" style={{ color: 'var(--color-ink-muted)' }}>{item.label}</span>
                <span className="text-sm font-semibold" style={{ color: item.color }}>{item.value}</span>
              </div>
            ))}
          </div>

          {/* Stock bar */}
          {produit.stockMinimum > 0 && (
            <div className="mt-4">
              <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-cream-dark)' }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, (produit.stockActuel / (produit.stockMaximum ?? produit.stockMinimum * 3)) * 100)}%`,
                    backgroundColor: isRupture ? '#dc2626' : isAlerte ? '#f59e0b' : 'var(--color-gold)',
                  }}
                />
              </div>
              {(isRupture || isAlerte) && (
                <div className="flex items-center gap-1.5 mt-2 text-xs" style={{ color: isRupture ? '#dc2626' : '#d97706' }}>
                  {isRupture ? <TrendingDown size={12} /> : <AlertTriangle size={12} />}
                  {isRupture ? 'Rupture de stock — réapprovisionner' : `Stock bas (min: ${produit.stockMinimum})`}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Adjust stock */}
        {canEdit && (
          <div className="card p-5">
            <h2 className="font-semibold text-sm mb-4" style={{ color: 'var(--color-ink)' }}>
              Ajustement de stock
            </h2>
            <p className="text-xs mb-3" style={{ color: 'var(--color-ink-muted)' }}>
              Entrez une valeur positive (entrée) ou négative (sortie).
            </p>
            <div className="flex gap-3">
              <input
                type="number"
                className="input flex-1"
                placeholder="Ex: +10 ou -5"
                value={adjustQty || ''}
                onChange={e => setAdjustQty(+e.target.value)}
              />
              <button
                className="btn-primary"
                disabled={adjustQty === 0 || adjustLoading}
                onClick={handleAdjustStock}
              >
                {adjustLoading ? '…' : 'Appliquer'}
              </button>
            </div>
            {adjustQty !== 0 && (
              <p className="text-xs mt-2" style={{ color: 'var(--color-ink-muted)' }}>
                Nouveau stock : <strong style={{ color: 'var(--color-ink)' }}>
                  {Math.max(0, produit.stockActuel + adjustQty)} {produit.unite}(s)
                </strong>
              </p>
            )}
          </div>
        )}
      </div>

      {/* Description */}
      {produit.description && (
        <div className="card p-5">
          <h2 className="font-semibold text-sm mb-2" style={{ color: 'var(--color-ink)' }}>Description</h2>
          <p className="text-sm" style={{ color: 'var(--color-ink-muted)' }}>{produit.description}</p>
        </div>
      )}

      {/* Meta */}
      <div className="card p-4">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <p className="label">Créé le</p>
            <p className="text-sm" style={{ color: 'var(--color-ink)' }}>{formatDate(produit.createdAt)}</p>
          </div>
          <div>
            <p className="label">Modifié le</p>
            <p className="text-sm" style={{ color: 'var(--color-ink)' }}>{formatDate(produit.updatedAt)}</p>
          </div>
          {produit.codeBarres && (
            <div>
              <p className="label">Code-barres</p>
              <p className="text-sm font-mono" style={{ color: 'var(--color-ink)' }}>{produit.codeBarres}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
