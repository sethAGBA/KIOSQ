import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Plus, Minus, X,
  Package, User, CreditCard, Smartphone,
  Landmark, Banknote, Tag, RotateCcw, ShoppingCart,
  History,
} from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { useAppStore } from '@/store/appStore';
import { useAuthStore } from '@/store/authStore';
import { formatPrice } from '@/lib/format';
import { posApi } from '@/lib/api';
import type { ModePaiement, Facture } from '@/types';
import { ReceiptModal } from '@/components/pos/ReceiptModal';
import { SaleSuccessModal } from '@/components/pos/SaleSuccessModal';

interface LigneCart {
  produitId: string;
  produitRef: string;
  produitNom: string;
  prixUnitaire: number;
  quantite: number;
  remise: number;
  total: number;
}

const MODES: { value: ModePaiement; label: string; Icon: React.FC<{ size?: number }> }[] = [
  { value: 'especes',      label: 'Espèces',      Icon: Banknote },
  { value: 'mobile_money', label: 'Mobile Money', Icon: Smartphone },
  { value: 'carte',        label: 'Carte',         Icon: CreditCard },
  { value: 'virement',     label: 'Virement',      Icon: Landmark },
];

export default function POSPage() {
  const navigate = useNavigate();
  const { produits, categories, clients, factures, addFacture, updateProduit } = useAppStore();
  const { user } = useAuthStore();

  // ── States ────────────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [cart, setCart] = useState<LigneCart[]>([]);
  
  // Client Search & Selection
  const [clientSearch, setClientSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [showClientDropdown, setShowClientDropdown] = useState(false);

  // Remise TTC (flat discount amount in F)
  const [remiseTTC, setRemiseTTC] = useState(0);
  // Remise globale en pourcentage
  const [remisePercent, setRemisePercent] = useState(0);
  // Option TVA
  const [appliquerTVA, setAppliquerTVA] = useState(false);
  const tvaTaux = 18;
  
  const [modePaiement, setModePaiement] = useState<ModePaiement>('especes');
  const [montantRecu, setMontantRecu] = useState(0);
  const [successFacture, setSuccessFacture] = useState<Facture | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showTicket, setShowTicket] = useState(false);
  const [loading, setLoading] = useState(false);

  // ── Catalogue filtré ──────────────────────────────────────
  const produitsFiltres = useMemo(() => produits.filter(p => {
    if (!p.actif) return false;
    if (catFilter && p.categorieId !== catFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return p.designation.toLowerCase().includes(q) || p.reference.toLowerCase().includes(q);
    }
    return true;
  }), [produits, search, catFilter]);

  // ── Clients filtrés pour la recherche ────────────────────
  const clientsFiltres = useMemo(() => {
    if (!clientSearch) return clients.filter(c => c.actif);
    const q = clientSearch.toLowerCase();
    return clients.filter(c => c.actif && (c.nom.toLowerCase().includes(q) || (c.code && c.code.toLowerCase().includes(q))));
  }, [clients, clientSearch]);

  // ── Calculs ───────────────────────────────────────────────
  const sousTotal = cart.reduce((s, l) => s + l.total, 0);
  const montantRemisePercent = sousTotal * (remisePercent / 100);
  const apresRemisePercent = sousTotal - montantRemisePercent;
  const apresRemiseFlat = Math.max(0, apresRemisePercent - remiseTTC);
  const montantTVA = appliquerTVA ? apresRemiseFlat * (tvaTaux / 100) : 0;
  const totalTTC = apresRemiseFlat + montantTVA;
  
  const renduMonnaie = modePaiement === 'especes' && montantRecu >= totalTTC
    ? montantRecu - totalTTC : 0;
  const totalArticles = cart.reduce((s, l) => s + l.quantite, 0);

  // ── Panier ────────────────────────────────────────────────
  const addToCart = (produitId: string) => {
    const p = produits.find(x => x.id === produitId);
    if (!p) return;
    if (p.stockActuel === 0) { toast.error(`${p.designation} est en rupture`); return; }
    setCart(prev => {
      const existing = prev.find(l => l.produitId === produitId);
      if (existing) {
        if (existing.quantite >= p.stockActuel) { toast.error(`Stock max : ${p.stockActuel}`); return prev; }
        return prev.map(l => l.produitId === produitId
          ? { ...l, quantite: l.quantite + 1, total: (l.quantite + 1) * l.prixUnitaire }
          : l);
      }
      return [...prev, { produitId: p.id, produitRef: p.reference, produitNom: p.designation, prixUnitaire: p.prixVente, quantite: 1, remise: 0, total: p.prixVente }];
    });
  };

  const updateQty = (produitId: string, qty: number) => {
    const p = produits.find(x => x.id === produitId);
    if (qty <= 0) return;
    if (p && qty > p.stockActuel) {
      toast.error(`Stock max : ${p.stockActuel}`);
      qty = p.stockActuel;
    }
    setCart(prev => prev.map(l => l.produitId === produitId
      ? { ...l, quantite: qty, total: qty * l.prixUnitaire }
      : l
    ));
  };

  const removeLine = (id: string) => setCart(p => p.filter(l => l.produitId !== id));
  const clearCart  = () => {
    setCart([]);
    setSelectedClient(null);
    setClientSearch('');
    setRemiseTTC(0);
    setRemisePercent(0);
    setAppliquerTVA(false);
    setMontantRecu(0);
  };

  // ── Encaisser ─────────────────────────────────────────────
  const handleEncaisser = async () => {
    if (cart.length === 0) { toast.error('Panier vide'); return; }
    if (modePaiement === 'especes' && montantRecu > 0 && montantRecu < totalTTC) {
      toast.error('Montant reçu insuffisant'); return;
    }
    setLoading(true);
    try {
      // Build canonical ligne format matching the server schema
      const lignesPayload = cart.map(l => ({
        produitId:    l.produitId,
        produitRef:   l.produitRef,
        produitNom:   l.produitNom,
        designation:  `${l.produitRef} — ${l.produitNom}`,
        quantite:     l.quantite,
        prixUnitaire: l.prixUnitaire,
        remise:       l.remise,
        tva:          appliquerTVA ? tvaTaux : 0,
        total:        l.total,
      }));

      // Try real API first
      let newFacture: Facture | null = null;
      try {
        newFacture = await posApi.enregistrerVente({
          clientId:      selectedClient?.id,
          clientNom:     selectedClient?.nom ?? 'Client anonyme',
          lignes:        lignesPayload,
          totalHT:       apresRemiseFlat,
          remiseGlobale: remisePercent,
          tva:           appliquerTVA ? tvaTaux : 0,
          totalTTC,
          modePaiement,
          montantRecu,
        });

        // Sync store with server response
        if (newFacture) {
          addFacture(newFacture);
          // Reflect stock deduction in local store
          cart.forEach(l => {
            const p = produits.find(x => x.id === l.produitId);
            if (p) updateProduit(p.id, { stockActuel: p.stockActuel - l.quantite });
          });
        }
      } catch (apiErr: any) {
        // If API returns a stock error, surface it immediately
        if (apiErr?.message?.includes('Stock insuffisant') || apiErr?.message?.includes('introuvable')) {
          toast.error(apiErr.message);
          return;
        }
        // Otherwise fall back to local mock mode
        console.warn('[POS] API unavailable, using local store:', apiErr?.message);
        const numero  = `TIC-${new Date().getFullYear()}-${String(factures.length + 1).padStart(4, '0')}`;
        newFacture = {
          id: `pos-${Date.now()}`,
          numero,
          clientId: selectedClient?.id || 'anonyme',
          clientNom: selectedClient?.nom ?? 'Client anonyme',
          clientEmail: selectedClient?.email,
          statut: 'payee',
          lignes: lignesPayload.map(l => ({
            designation: l.designation,
            quantite: l.quantite,
            prixUnitaire: l.prixUnitaire,
            remise: l.remise,
            tva: l.tva,
            total: l.total,
          })),
          totalHT: apresRemiseFlat,
          remiseGlobale: remisePercent,
          tva: appliquerTVA ? tvaTaux : 0,
          totalTTC,
          montantPaye: totalTTC, resteAPayer: 0,
          paiements: [{ id: `pay-${Date.now()}`, montant: totalTTC, mode: modePaiement, date: new Date() }],
          dateFacture: new Date(), dateEcheance: new Date(),
          createdBy: user?.id ?? '', createdAt: new Date(), updatedAt: new Date(),
        } as Facture;
        addFacture(newFacture);
        cart.forEach(l => {
          const p = produits.find(x => x.id === l.produitId);
          if (p) updateProduit(p.id, { stockActuel: p.stockActuel - l.quantite });
        });
      }

      setSuccessFacture(newFacture);
      setShowSuccess(true);
      toast.success('Vente encaissée !');
    } catch {
      toast.error("Erreur lors de l'encaissement");
    } finally {
      setLoading(false);
    }
  };

  const handleNouvelleVente = () => {
    clearCart();
    setSuccessFacture(null);
    setShowSuccess(false);
    setShowTicket(false);
    setModePaiement('especes');
  };

  return (
    <div className="flex gap-5 -m-6 h-[calc(100vh-3.5rem)] overflow-hidden relative" style={{ backgroundColor: 'var(--color-cream)' }}>
      
      {/* ══ GAUCHE : Catalogue ══ */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden px-6 pt-6 pb-4 gap-4 no-print">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-mono tracking-widest uppercase mb-0.5" style={{ color: 'var(--color-ink-muted)' }}>Vente directe</p>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--color-ink)', fontFamily: 'var(--font-display)' }}>
              Point de Vente
            </h1>
          </div>
          <button
            onClick={() => navigate('/pos/historique')}
            className="btn-secondary text-xs flex items-center gap-1.5 py-2 px-3 shadow-sm"
          >
            <History size={14} />
            Historique ventes
          </button>
        </div>

        {/* Recherche */}
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-ink-muted)' }} />
          <input
            className="input pl-9"
            placeholder="Chercher un produit par nom ou référence…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            autoFocus
          />
        </div>

        {/* Filtres catégories */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setCatFilter('')}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            style={!catFilter ? { backgroundColor: 'var(--color-gold)', color: 'white' } : { backgroundColor: 'white', color: 'var(--color-ink-muted)', border: '1px solid var(--color-cream-dark)' }}
          >
            Tous
          </button>
          {categories.map(c => (
            <button
              key={c.id}
              onClick={() => setCatFilter(c.id)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5"
              style={catFilter === c.id ? { backgroundColor: 'var(--color-gold)', color: 'white' } : { backgroundColor: 'white', color: 'var(--color-ink-muted)', border: '1px solid var(--color-cream-dark)' }}
            >
              <Tag size={11} />
              {c.nom}
            </button>
          ))}
        </div>

        {/* Grille produits */}
        <div className="flex-1 overflow-y-auto pr-1">
          {produitsFiltres.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'var(--color-cream-dark)' }}>
                <Package size={28} style={{ color: 'var(--color-ink-muted)' }} />
              </div>
              <p className="text-sm" style={{ color: 'var(--color-ink-muted)' }}>Aucun produit trouvé</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
              {produitsFiltres.map(p => {
                const inCart   = cart.find(l => l.produitId === p.id);
                const isRupture = p.stockActuel === 0;
                const isAlerte  = !isRupture && p.stockActuel <= p.stockMinimum;
                return (
                  <button
                    key={p.id}
                    onClick={() => addToCart(p.id)}
                    disabled={isRupture}
                    className={clsx(
                      'relative text-left p-4 rounded-xl border-2 flex flex-col gap-2 transition-all duration-150',
                      isRupture ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:shadow-md active:scale-95'
                    )}
                    style={{
                      backgroundColor: inCart ? 'var(--color-gold-pale)' : 'white',
                      borderColor: inCart ? 'var(--color-gold)' : 'var(--color-cream-dark)',
                    }}
                  >
                    {/* Badge quantité */}
                    {inCart && (
                      <span
                        className="absolute top-2.5 right-2.5 w-6 h-6 rounded-full text-white text-xs flex items-center justify-center font-bold shadow"
                        style={{ backgroundColor: 'var(--color-gold)' }}
                      >
                        {inCart.quantite}
                      </span>
                    )}
                    {/* Icône */}
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: inCart ? 'var(--color-gold)' : 'var(--color-cream-dark)', color: inCart ? 'white' : 'var(--color-ink-muted)' }}
                    >
                      <Package size={18} />
                    </div>
                    <div>
                      <p className="text-[10px] font-mono" style={{ color: 'var(--color-ink-muted)' }}>{p.reference}</p>
                      <p className="text-sm font-semibold leading-snug line-clamp-2 mt-0.5" style={{ color: 'var(--color-ink)' }}>{p.designation}</p>
                    </div>
                    <div className="flex items-end justify-between mt-auto">
                      <p className="text-base font-bold" style={{ color: 'var(--color-gold)' }}>{formatPrice(p.prixVente)}</p>
                      <span
                        className="text-[10px] font-mono px-1.5 py-0.5 rounded font-medium"
                        style={{
                          backgroundColor: isRupture ? '#fef2f2' : isAlerte ? '#fef3c7' : '#f0fdf4',
                          color: isRupture ? '#dc2626' : isAlerte ? '#d97706' : '#16a34a',
                        }}
                      >
                        {isRupture ? 'Rupture' : `${p.stockActuel}`}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ══ DROITE : Panier ══ */}
      <div
        className="flex flex-col w-[380px] shrink-0 border-l overflow-hidden no-print"
        style={{ backgroundColor: 'white', borderColor: 'var(--color-cream-dark)' }}
      >
        {/* Panier header */}
        <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--color-cream-dark)' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingCart size={16} style={{ color: 'var(--color-gold)' }} />
              <span className="font-semibold text-sm" style={{ color: 'var(--color-ink)' }}>Panier</span>
              {totalArticles > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold text-white" style={{ backgroundColor: 'var(--color-gold)' }}>
                  {totalArticles}
                </span>
              )}
            </div>
            {cart.length > 0 && (
              <button onClick={clearCart} className="text-xs flex items-center gap-1 px-2 py-1 rounded-lg transition-colors hover:bg-red-50" style={{ color: '#dc2626' }}>
                <RotateCcw size={11} /> Vider
              </button>
            )}
          </div>
          
          {/* Client Search with Autocomplete Dropdown */}
          <div className="mt-3 relative">
            <User size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-ink-muted)' }} />
            {selectedClient ? (
              <div className="flex items-center justify-between bg-var(--color-gold-pale) border border-var(--color-gold) rounded-lg p-2 text-xs">
                <span className="font-medium text-[var(--color-gold)]">Client: {selectedClient.nom}</span>
                <button onClick={() => setSelectedClient(null)} className="p-0.5 rounded hover:bg-gold/10">
                  <X size={12} className="text-red-500" />
                </button>
              </div>
            ) : (
              <div>
                <input
                  type="text"
                  className="input pl-8 text-xs"
                  placeholder="Rechercher / Sélectionner un client…"
                  value={clientSearch}
                  onChange={e => {
                    setClientSearch(e.target.value);
                    setShowClientDropdown(true);
                  }}
                  onFocus={() => setShowClientDropdown(true)}
                />
                {showClientDropdown && clientSearch && (
                  <div className="absolute left-0 right-0 mt-1 bg-white border border-var(--color-cream-dark) rounded-lg shadow-lg max-h-40 overflow-y-auto z-10 text-xs">
                    {clientsFiltres.length === 0 ? (
                      <div className="p-2 text-var(--color-ink-muted)">Aucun client trouvé</div>
                    ) : (
                      clientsFiltres.map(c => (
                        <button
                          key={c.id}
                          type="button"
                          className="w-full text-left px-3 py-2 hover:bg-var(--color-cream) border-b last:border-0 border-var(--color-cream-dark)"
                          onClick={() => {
                            setSelectedClient(c);
                            setClientSearch('');
                            setShowClientDropdown(false);
                          }}
                        >
                          <p className="font-semibold text-var(--color-ink)">{c.nom}</p>
                          <p className="text-[10px] text-var(--color-ink-muted)">{c.code || 'Pas de code'}</p>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Lignes panier */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 gap-2">
              <ShoppingCart size={28} style={{ color: 'var(--color-cream-dark)' }} />
              <p className="text-xs text-center" style={{ color: 'var(--color-ink-muted)' }}>Cliquez sur un produit<br />pour l'ajouter</p>
            </div>
          ) : cart.map(l => (
            <div
              key={l.produitId}
              className="flex items-center gap-2 p-3 rounded-xl"
              style={{ backgroundColor: 'var(--color-cream)', border: '1px solid var(--color-cream-dark)' }}
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold truncate" style={{ color: 'var(--color-ink)' }}>{l.produitNom}</p>
                <p className="text-[10px] font-mono mt-0.5" style={{ color: 'var(--color-ink-muted)' }}>{formatPrice(l.prixUnitaire)} / u</p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => updateQty(l.produitId, l.quantite - 1)}
                  className="w-6 h-6 rounded-lg flex items-center justify-center border transition-colors hover:bg-white"
                  style={{ borderColor: 'var(--color-cream-dark)', color: 'var(--color-ink-muted)' }}
                >
                  <Minus size={10} />
                </button>
                {/* Saisie quantité manuelle */}
                <input
                  type="number"
                  min="1"
                  className="w-12 text-center text-xs font-bold border rounded bg-white py-0.5"
                  style={{ borderColor: 'var(--color-cream-dark)' }}
                  value={l.quantite}
                  onChange={e => {
                    const val = parseInt(e.target.value) || 1;
                    updateQty(l.produitId, val);
                  }}
                />
                <button
                  onClick={() => updateQty(l.produitId, l.quantite + 1)}
                  className="w-6 h-6 rounded-lg flex items-center justify-center border transition-colors hover:bg-white"
                  style={{ borderColor: 'var(--color-cream-dark)', color: 'var(--color-ink-muted)' }}
                >
                  <Plus size={10} />
                </button>
              </div>
              <p className="text-sm font-bold w-20 text-right shrink-0" style={{ color: 'var(--color-gold)' }}>{formatPrice(l.total)}</p>
              <button onClick={() => removeLine(l.produitId)} className="p-1 rounded-lg hover:bg-red-50 transition-colors" style={{ color: '#dc2626' }}>
                <X size={13} />
              </button>
            </div>
          ))}
        </div>

        {/* ── Totaux + paiement ── */}
        <div className="px-4 py-4 border-t space-y-4" style={{ borderColor: 'var(--color-cream-dark)', backgroundColor: 'var(--color-cream)' }}>
          {/* Remises */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Remise TTC (Montant F)</label>
              <input
                type="number" min="0" className="input text-sm text-center font-semibold"
                value={remiseTTC || ''}
                onChange={e => setRemiseTTC(+e.target.value)}
                placeholder="0 F"
              />
            </div>
            <div>
              <label className="label">Remise %</label>
              <input
                type="number" min="0" max="100" className="input text-sm text-center font-semibold"
                value={remisePercent || ''}
                onChange={e => setRemisePercent(+e.target.value)}
                placeholder="0 %"
              />
            </div>
          </div>

          {/* Option TVA */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="appliquer-tva-cb"
              className="w-4 h-4 text-var(--color-gold) border-gray-300 rounded focus:ring-var(--color-gold)"
              checked={appliquerTVA}
              onChange={e => setAppliquerTVA(e.target.checked)}
            />
            <label htmlFor="appliquer-tva-cb" className="text-xs font-semibold cursor-pointer select-none text-var(--color-ink-light)">
              Appliquer la TVA (18%)
            </label>
          </div>

          {/* Totaux */}
          <div className="bg-white rounded-xl p-3 space-y-1.5" style={{ border: '1px solid var(--color-cream-dark)' }}>
            <div className="flex justify-between text-xs" style={{ color: 'var(--color-ink-muted)' }}>
              <span>Sous-total</span><span>{formatPrice(sousTotal)}</span>
            </div>
            {remisePercent > 0 && (
              <div className="flex justify-between text-xs font-medium" style={{ color: '#dc2626' }}>
                <span>Remise ({remisePercent}%)</span><span>-{formatPrice(montantRemisePercent)}</span>
              </div>
            )}
            {remiseTTC > 0 && (
              <div className="flex justify-between text-xs font-medium" style={{ color: '#dc2626' }}>
                <span>Remise fixe</span><span>-{formatPrice(remiseTTC)}</span>
              </div>
            )}
            {appliquerTVA && (
              <div className="flex justify-between text-xs" style={{ color: 'var(--color-ink-muted)' }}>
                <span>TVA (18%)</span><span>{formatPrice(montantTVA)}</span>
              </div>
            )}
            <div
              className="flex justify-between text-base font-bold pt-2 mt-1"
              style={{ borderTop: '1px solid var(--color-cream-dark)', color: 'var(--color-ink)' }}
            >
              <span>Total Net à payer</span>
              <span style={{ color: 'var(--color-gold)' }}>{formatPrice(totalTTC)}</span>
            </div>
          </div>

          {/* Mode paiement */}
          <div>
            <label className="label">Mode de paiement</label>
            <div className="grid grid-cols-2 gap-2">
              {MODES.map(m => (
                <button
                  key={m.value}
                  onClick={() => setModePaiement(m.value)}
                  className={clsx('py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 border-2 transition-all')}
                  style={modePaiement === m.value
                    ? { backgroundColor: 'var(--color-gold-pale)', borderColor: 'var(--color-gold)', color: 'var(--color-gold)' }
                    : { backgroundColor: 'white', borderColor: 'var(--color-cream-dark)', color: 'var(--color-ink-muted)' }
                  }
                >
                  <m.Icon size={14} />
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Montant reçu (espèces) */}
          {modePaiement === 'especes' && (
            <div>
              <label className="label">Montant reçu (F)</label>
              <input
                type="number" min="0" className="input text-sm font-semibold text-center"
                placeholder={String(Math.ceil(totalTTC))}
                value={montantRecu || ''}
                onChange={e => setMontantRecu(+e.target.value)}
              />
              {renduMonnaie > 0 && (
                <div
                  className="mt-2 flex justify-between px-3 py-2 rounded-lg text-sm font-bold"
                  style={{ backgroundColor: '#f0fdf4', color: '#16a34a' }}
                >
                  <span>Rendu monnaie</span>
                  <span>{formatPrice(renduMonnaie)}</span>
                </div>
              )}
            </div>
          )}

          {/* Bouton encaisser */}
          <button
            onClick={handleEncaisser}
            disabled={cart.length === 0 || loading}
            className="w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all"
            style={cart.length === 0
              ? { backgroundColor: 'var(--color-cream-dark)', color: 'var(--color-ink-muted)', cursor: 'not-allowed' }
              : { backgroundColor: 'var(--color-gold)', color: 'white' }
            }
          >
            <CreditCard size={16} />
            {loading ? 'Encaissement…' : `Encaisser — ${formatPrice(totalTTC)}`}
          </button>
        </div>
      </div>

      {/* ══ Modal succès post-vente (style stock-app) ══ */}
      {showSuccess && successFacture && (
        <SaleSuccessModal
          facture={successFacture}
          onNouvelleVente={handleNouvelleVente}
          onVoirTicket={() => { setShowSuccess(false); setShowTicket(true); }}
        />
      )}

      {/* ══ Modal reçu ══ */}
      {showTicket && successFacture && (
        <ReceiptModal
          facture={successFacture}
          onClose={() => { setShowTicket(false); setSuccessFacture(null); }}
        />
      )}


    </div>
  );
}
