import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Search, Plus, Minus, X,
  Package, User, CreditCard, Smartphone,
  Landmark, Banknote, Tag, RotateCcw, ShoppingCart,
  History, ClipboardList, Clock, ChevronRight,
} from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { useAppStore } from '@/store/appStore';
import { useAuthStore } from '@/store/authStore';
import { formatPrice } from '@/lib/format';
import { posApi, commandesApi, USE_API } from '@/lib/api';
import type { ModePaiement, Facture } from '@/types';
import { ReceiptModal } from '@/components/pos/ReceiptModal';
import { SaleSuccessModal } from '@/components/pos/SaleSuccessModal';

interface LigneCart {
  produitId: string;
  produitRef: string;
  produitNom: string;
  prixUnitaire: number;
  prixVente: number;
  prixVenteGros?: number;
  typePrix: 'detail' | 'gros';
  quantite: number;
  remise: number;
  total: number;
}

// ── File d'attente ────────────────────────────────────────
interface PanierEnAttente {
  id: string;
  label: string;               // ex: "Client Diallo" ou "Panier #2"
  cart: LigneCart[];
  selectedClient: any | null;
  remiseTTC: number;
  remisePercent: number;
  appliquerTVA: boolean;
  commandeSource: { id: string; numero: string } | null;
  savedAt: Date;
}

const MODES: { value: ModePaiement; label: string; Icon: React.FC<{ size?: number }> }[] = [
  { value: 'especes',      label: 'Espèces',      Icon: Banknote },
  { value: 'mobile_money', label: 'Mobile Money', Icon: Smartphone },
  { value: 'carte',        label: 'Carte',         Icon: CreditCard },
  { value: 'virement',     label: 'Virement',      Icon: Landmark },
];

export default function POSPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { produits, categories, clients, factures, addFacture, updateProduit, updateClient } = useAppStore();
  const { commandes, updateCommande } = useAppStore();
  const { user } = useAuthStore();

  // ── State de navigation depuis une commande ───────────────
  const commandeState = location.state as {
    commandeId?: string;
    commandeNumero?: string;
    statutPrecedent?: string;
    clientId?: string;
    clientNom?: string;
    lignes?: Array<{ produitId: string; produitRef: string; produitNom: string; quantite: number; prixUnitaire: number; remise: number; total: number }>;
    remiseGlobale?: number;
    tva?: number;
  } | null;

  // ── States ────────────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [cart, setCart] = useState<LigneCart[]>([]);
  const [tariffMode, setTariffMode] = useState<'detail' | 'gros'>('detail');
  const [commandeSource, setCommandeSource] = useState<{ id: string; numero: string } | null>(null);

  // ── File d'attente ────────────────────────────────────────
  const [waitingQueue, setWaitingQueue] = useState<PanierEnAttente[]>([]);
  const [showQueue, setShowQueue] = useState(false);
  const [showCmdQueue, setShowCmdQueue] = useState(false);

  const handleTariffModeChange = (mode: 'detail' | 'gros') => {
    setTariffMode(mode);
    if (cart.length > 0) {
      setCart(prev => prev.map(l => {
        if (mode === 'gros') {
          if (l.prixVenteGros && l.prixVenteGros > 0) {
            return { ...l, typePrix: 'gros', prixUnitaire: l.prixVenteGros, total: l.quantite * l.prixVenteGros };
          }
          return l;
        } else {
          return { ...l, typePrix: 'detail', prixUnitaire: l.prixVente, total: l.quantite * l.prixVente };
        }
      }));
    }
  };

  const toggleLineTypePrix = (produitId: string) => {
    setCart(prev => prev.map(l => {
      if (l.produitId !== produitId) return l;
      const targetType = l.typePrix === 'detail' ? 'gros' : 'detail';
      if (targetType === 'gros' && (!l.prixVenteGros || l.prixVenteGros <= 0)) {
        toast.error('Prix de gros non défini pour ce produit');
        return l;
      }
      const newPrice = targetType === 'gros' && l.prixVenteGros ? l.prixVenteGros : l.prixVente;
      return {
        ...l,
        typePrix: targetType,
        prixUnitaire: newPrice,
        total: l.quantite * newPrice,
      };
    }));
  };
  
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

  // ── Pré-chargement depuis une commande ────────────────────
  useEffect(() => {
    if (!commandeState?.commandeId || !commandeState.lignes) return;

    // Construire le panier depuis les lignes de la commande
    const lignesCart: LigneCart[] = commandeState.lignes.map(l => {
      const produit = produits.find(p => p.id === l.produitId);
      return {
        produitId:    l.produitId,
        produitRef:   l.produitRef,
        produitNom:   l.produitNom,
        prixUnitaire: l.prixUnitaire,
        prixVente:    produit?.prixVente ?? l.prixUnitaire,
        prixVenteGros: produit?.prixVenteGros,
        typePrix:     'detail',
        quantite:     l.quantite,
        remise:       l.remise,
        total:        l.total,
      };
    });
    setCart(lignesCart);

    // Pré-sélectionner le client
    if (commandeState.clientId) {
      const client = clients.find(c => c.id === commandeState.clientId);
      if (client) setSelectedClient(client);
    }

    // Appliquer remise globale si présente
    if (commandeState.remiseGlobale && commandeState.remiseGlobale > 0) {
      setRemisePercent(commandeState.remiseGlobale);
    }

    // Appliquer TVA si > 0
    if (commandeState.tva && commandeState.tva > 0) {
      setAppliquerTVA(true);
    }

    // Mémoriser la commande source pour l'afficher
    setCommandeSource({
      id: commandeState.commandeId,
      numero: commandeState.commandeNumero ?? commandeState.commandeId,
    });

    toast.success(`Commande ${commandeState.commandeNumero ?? ''} chargée en caisse`);
    // Nettoyer le state de navigation pour éviter le rechargement au refresh
    window.history.replaceState({}, '');
  // S'exécute une seule fois au montage
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // ── Commandes en attente de passage en caisse ─────────────
  const commandesEnAttenteCaisse = useMemo(() =>
    commandes.filter(c =>
      c.type === 'commande' &&
      ['confirme', 'en_preparation', 'expedie', 'livre', 'en_caisse'].includes(c.statut)
    ),
    [commandes]
  );

  // ── Calculs ───────────────────────────────────────────────
  const sousTotal = cart.reduce((s, l) => s + l.total, 0);
  const montantRemisePercent = sousTotal * (remisePercent / 100);
  const apresRemisePercent = sousTotal - montantRemisePercent;
  const apresRemiseFlat = Math.max(0, apresRemisePercent - remiseTTC);
  const montantTVA = appliquerTVA ? apresRemiseFlat * (tvaTaux / 100) : 0;
  const totalTTC = apresRemiseFlat + montantTVA;
  
  const renduMonnaie = modePaiement === 'especes' && montantRecu > 0 && montantRecu >= totalTTC
    ? montantRecu - totalTTC : 0;
  const resteApayer = montantRecu > 0 && montantRecu < totalTTC
    ? totalTTC - montantRecu : 0;
  const totalArticles = cart.reduce((s, l) => s + l.quantite, 0);

  // ── Panier ────────────────────────────────────────────────
  const addToCart = (produitId: string) => {
    const p = produits.find(x => x.id === produitId);
    if (!p) return;
    if (p.stockActuel === 0) { toast.error(`${p.designation} est en rupture`); return; }

    let useGros = tariffMode === 'gros';
    if (useGros && (!p.prixVenteGros || p.prixVenteGros <= 0)) {
      toast.error(`Prix de gros non défini pour ${p.designation}, tarif détail appliqué`);
      useGros = false;
    }
    const prixU = useGros && p.prixVenteGros ? p.prixVenteGros : p.prixVente;
    const typePrix: 'detail' | 'gros' = useGros ? 'gros' : 'detail';

    setCart(prev => {
      const existing = prev.find(l => l.produitId === produitId);
      if (existing) {
        if (existing.quantite >= p.stockActuel) { toast.error(`Stock max : ${p.stockActuel}`); return prev; }
        return prev.map(l => l.produitId === produitId
          ? { ...l, quantite: l.quantite + 1, total: (l.quantite + 1) * l.prixUnitaire }
          : l);
      }
      return [...prev, {
        produitId: p.id,
        produitRef: p.reference,
        produitNom: p.designation,
        prixUnitaire: prixU,
        prixVente: p.prixVente,
        prixVenteGros: p.prixVenteGros,
        typePrix,
        quantite: 1,
        remise: 0,
        total: prixU,
      }];
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
    // Libérer la commande source si elle était verrouillée
    if (commandeSource) {
      const prevStatut = commandeState?.statutPrecedent ?? 'confirme';
      if (USE_API) {
        commandesApi.update(commandeSource.id, { statut: prevStatut as any }).catch(() => {});
      }
    }
    setCommandeSource(null);
  };

  // ── Mettre le panier en attente ───────────────────────────
  const mettreEnAttente = () => {
    if (cart.length === 0) { toast.error('Le panier est vide'); return; }
    const label = selectedClient?.nom
      ?? commandeSource?.numero
      ?? `Panier #${waitingQueue.length + 1}`;
    const snapshot: PanierEnAttente = {
      id: `wait-${Date.now()}`,
      label,
      cart,
      selectedClient,
      remiseTTC,
      remisePercent,
      appliquerTVA,
      commandeSource,
      savedAt: new Date(),
    };
    setWaitingQueue(prev => [...prev, snapshot]);
    clearCart();
    toast.success(`"${label}" mis en attente`);
  };

  // ── Rappeler un panier en attente ─────────────────────────
  const rappelerPanier = (id: string) => {
    const snap = waitingQueue.find(w => w.id === id);
    if (!snap) return;
    // Si panier actif non vide, le remettre automatiquement en attente
    if (cart.length > 0) {
      const currentLabel = selectedClient?.nom ?? commandeSource?.numero ?? `Panier #${waitingQueue.length + 1}`;
      setWaitingQueue(prev => [
        ...prev.filter(w => w.id !== id),
        {
          id: `wait-${Date.now()}`,
          label: currentLabel,
          cart,
          selectedClient,
          remiseTTC,
          remisePercent,
          appliquerTVA,
          commandeSource,
          savedAt: new Date(),
        },
      ]);
    } else {
      setWaitingQueue(prev => prev.filter(w => w.id !== id));
    }
    // Restaurer le panier sélectionné
    setCart(snap.cart);
    setSelectedClient(snap.selectedClient);
    setRemiseTTC(snap.remiseTTC);
    setRemisePercent(snap.remisePercent);
    setAppliquerTVA(snap.appliquerTVA);
    setCommandeSource(snap.commandeSource);
    setMontantRecu(0);
    setShowQueue(false);
    toast.success(`"${snap.label}" rappelé`);
  };

  // ── Supprimer un panier en attente ────────────────────────
  const supprimerAttente = (id: string) => {
    setWaitingQueue(prev => prev.filter(w => w.id !== id));
    toast('Panier supprimé', { icon: '🗑️' });
  };

  // ── Encaisser ─────────────────────────────────────────────
  const handleEncaisser = async () => {
    if (cart.length === 0) { toast.error('Panier vide'); return; }
    
    const effectiveRecu = (montantRecu && montantRecu > 0) ? montantRecu : totalTTC;
    const reste = Math.max(0, totalTTC - effectiveRecu);

    if (reste > 0 && !selectedClient) {
      toast.error('Un client doit être sélectionné pour faire un paiement partiel (crédit).'); 
      return;
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
      if (USE_API) {
        newFacture = await posApi.enregistrerVente({
          clientId:      selectedClient?.id,
          clientNom:     selectedClient?.nom ?? 'Client anonyme',
          lignes:        lignesPayload,
          totalHT:       apresRemiseFlat,
          remiseGlobale: remisePercent,
          tva:           appliquerTVA ? tvaTaux : 0,
          totalTTC,
          modePaiement,
          montantRecu:   effectiveRecu,
        });

        // Sync store with server response
        if (newFacture) {
          addFacture(newFacture);
          // Reflect stock deduction in local store
          cart.forEach(l => {
            const p = produits.find(x => x.id === l.produitId);
            if (p) updateProduit(p.id, { stockActuel: p.stockActuel - l.quantite });
          });
          // Reflect client debt increase if partial payment
          if (newFacture.resteAPayer > 0 && selectedClient) {
            updateClient(selectedClient.id, { 
              soldeCredit: selectedClient.soldeCredit + newFacture.resteAPayer 
            });
          }
        }
      } else {
        const numero  = `TIC-${new Date().getFullYear()}-${String(factures.length + 1).padStart(4, '0')}`;
        const mPaye = totalTTC - reste;
        newFacture = {
          id: `pos-${Date.now()}`,
          numero,
          clientId: selectedClient?.id || 'anonyme',
          clientNom: selectedClient?.nom ?? 'Client anonyme',
          clientEmail: selectedClient?.email,
          statut: reste > 0 ? 'partielle' : 'payee',
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
          montantPaye: mPaye, 
          resteAPayer: reste,
          paiements: [{ id: `pay-${Date.now()}`, montant: mPaye, mode: modePaiement, date: new Date() }],
          dateFacture: new Date(), dateEcheance: new Date(),
          createdBy: user?.id ?? '', createdAt: new Date(), updatedAt: new Date(),
        } as Facture;
        addFacture(newFacture);
        cart.forEach(l => {
          const p = produits.find(x => x.id === l.produitId);
          if (p) updateProduit(p.id, { stockActuel: p.stockActuel - l.quantite });
        });
        if (reste > 0 && selectedClient) {
          updateClient(selectedClient.id, { soldeCredit: selectedClient.soldeCredit + reste });
        }
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
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-[10px] font-mono tracking-widest uppercase mb-0.5" style={{ color: 'var(--color-ink-muted)' }}>Vente directe</p>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--color-ink)', fontFamily: 'var(--font-display)' }}>
              Point de Vente
            </h1>
            {/* Badge commande source */}
            {commandeSource && (
              <div className="flex items-center gap-1.5 mt-1 px-2.5 py-1 rounded-lg text-xs font-semibold w-fit"
                style={{ backgroundColor: 'var(--color-gold-pale)', color: 'var(--color-gold)', border: '1px solid var(--color-gold)' }}>
                <ClipboardList size={12} />
                Commande {commandeSource.numero}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Mode Tarif Switch */}
            <div className="flex items-center bg-white p-1 rounded-xl border shadow-sm" style={{ borderColor: 'var(--color-cream-dark)' }}>
              <button
                type="button"
                onClick={() => handleTariffModeChange('detail')}
                className={clsx(
                  'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
                  tariffMode === 'detail'
                    ? 'bg-[var(--color-gold)] text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-800'
                )}
              >
                Détail
              </button>
              <button
                type="button"
                onClick={() => handleTariffModeChange('gros')}
                className={clsx(
                  'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
                  tariffMode === 'gros'
                    ? 'bg-purple-700 text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-800'
                )}
              >
                Vente en Gros
              </button>
            </div>
            <button
              onClick={() => navigate('/pos/historique')}
              className="btn-secondary text-xs flex items-center gap-1.5 py-2 px-3 shadow-sm"
            >
              <History size={14} />
              Historique
            </button>
          </div>
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
                const priceToShow = tariffMode === 'gros' && p.prixVenteGros && p.prixVenteGros > 0
                  ? p.prixVenteGros
                  : p.prixVente;

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
                      <div>
                        <p className="text-base font-bold" style={{ color: 'var(--color-gold)' }}>{formatPrice(priceToShow)}</p>
                        {p.prixVenteGros ? (
                          <p className="text-[10px] text-purple-700 font-medium">
                            Gros: {formatPrice(p.prixVenteGros)}
                          </p>
                        ) : null}
                      </div>
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
        className="flex flex-col w-[390px] xl:w-[420px] shrink-0 border-l h-full overflow-hidden no-print"
        style={{ backgroundColor: 'white', borderColor: 'var(--color-cream-dark)' }}
      >
        {/* Panier header + Client search */}
        <div className="p-4 border-b shrink-0 space-y-3" style={{ borderColor: 'var(--color-cream-dark)' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--color-gold-pale)', color: 'var(--color-gold)' }}>
                <ShoppingCart size={18} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm" style={{ color: 'var(--color-ink)' }}>Panier en cours</span>
                  {totalArticles > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold text-white shadow-sm" style={{ backgroundColor: 'var(--color-gold)' }}>
                      {totalArticles} {totalArticles > 1 ? 'articles' : 'article'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          <div className="flex items-center gap-2">
              {/* Bouton file d'attente */}
              <button
                onClick={() => setShowQueue(true)}
                className="relative text-xs font-medium flex items-center gap-1 px-2.5 py-1 rounded-lg transition-colors hover:bg-amber-50"
                style={{ color: 'var(--color-gold)' }}
                title="File d'attente"
              >
                <Clock size={13} />
                Attente
                {waitingQueue.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-white text-[9px] font-bold flex items-center justify-center"
                    style={{ backgroundColor: 'var(--color-gold)' }}>
                    {waitingQueue.length}
                  </span>
                )}
              </button>
            {cart.length > 0 && (
              <button
                onClick={clearCart}
                className="text-xs font-medium flex items-center gap-1 px-2.5 py-1 rounded-lg transition-colors hover:bg-red-50"
                style={{ color: '#dc2626' }}
              >
                <RotateCcw size={12} /> Vider
              </button>
            )}
          </div>
          </div>
          
          {/* Client Search with Autocomplete Dropdown */}
          <div className="relative">
            <User size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-ink-muted)' }} />
            {selectedClient ? (
              <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl p-2 text-xs">
                <div className="flex items-center gap-2">
                  <User size={14} className="text-amber-700" />
                  <span className="font-semibold text-amber-900">{selectedClient.nom}</span>
                </div>
                <button onClick={() => setSelectedClient(null)} className="p-1 rounded-lg hover:bg-amber-100 transition-colors">
                  <X size={13} className="text-amber-700" />
                </button>
              </div>
            ) : (
              <div>
                <input
                  type="text"
                  className="input pl-9 text-xs py-2 bg-gray-50/50"
                  placeholder="Rechercher / Sélectionner un client…"
                  value={clientSearch}
                  onChange={e => {
                    setClientSearch(e.target.value);
                    setShowClientDropdown(true);
                  }}
                  onFocus={() => setShowClientDropdown(true)}
                />
                {showClientDropdown && clientSearch && (
                  <div className="absolute left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-48 overflow-y-auto z-20 text-xs">
                    {clientsFiltres.length === 0 ? (
                      <div className="p-3 text-gray-400 text-center">Aucun client trouvé</div>
                    ) : (
                      clientsFiltres.map(c => (
                        <button
                          key={c.id}
                          type="button"
                          className="w-full text-left px-3 py-2.5 hover:bg-amber-50 border-b last:border-0 border-gray-100 transition-colors"
                          onClick={() => {
                            setSelectedClient(c);
                            setClientSearch('');
                            setShowClientDropdown(false);
                          }}
                        >
                          <p className="font-semibold text-gray-900">{c.nom}</p>
                          <p className="text-[10px] text-gray-500">{c.code || 'Pas de code'}</p>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Lignes panier - FLEX 1 MIN-H-0 FOR SMOOTH SCROLLING */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-2.5 custom-scrollbar">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[160px] gap-3 text-gray-400">
              <div className="w-14 h-14 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center">
                <ShoppingCart size={24} className="text-gray-300" />
              </div>
              <div className="text-center">
                <p className="text-xs font-semibold text-gray-600">Votre panier est vide</p>
                <p className="text-[11px] text-gray-400 mt-0.5">Cliquez sur un produit du catalogue pour l'ajouter</p>
              </div>
            </div>
          ) : cart.map(l => (
            <div
              key={l.produitId}
              className="flex flex-col gap-2 p-3 rounded-xl border transition-all hover:border-amber-300 shadow-sm"
              style={{ backgroundColor: 'var(--color-cream)', borderColor: 'var(--color-cream-dark)' }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold leading-snug line-clamp-2" style={{ color: 'var(--color-ink)' }}>{l.produitNom}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] font-mono text-gray-500">{l.produitRef}</span>
                    <button
                      type="button"
                      onClick={() => toggleLineTypePrix(l.produitId)}
                      className={clsx(
                        'text-[9px] px-1.5 py-0.5 rounded font-bold uppercase transition-colors shrink-0',
                        l.typePrix === 'gros'
                          ? 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                          : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                      )}
                      title="Changer le tarif (Détail / Gros)"
                    >
                      {l.typePrix === 'gros' ? 'Gros' : 'Détail'}
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => removeLine(l.produitId)}
                  className="p-1 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors shrink-0"
                  title="Supprimer du panier"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-gray-200/60">
                {/* Quantité boutons */}
                <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-gray-200 shadow-sm">
                  <button
                    onClick={() => updateQty(l.produitId, l.quantite - 1)}
                    className="w-6 h-6 rounded-md flex items-center justify-center hover:bg-gray-100 text-gray-600 transition-colors"
                  >
                    <Minus size={11} />
                  </button>
                  <input
                    type="number"
                    min="1"
                    className="w-10 text-center text-xs font-bold border-0 focus:ring-0 p-0 text-gray-900"
                    value={l.quantite}
                    onChange={e => {
                      const val = parseInt(e.target.value) || 1;
                      updateQty(l.produitId, val);
                    }}
                  />
                  <button
                    onClick={() => updateQty(l.produitId, l.quantite + 1)}
                    className="w-6 h-6 rounded-md flex items-center justify-center hover:bg-gray-100 text-gray-600 transition-colors"
                  >
                    <Plus size={11} />
                  </button>
                </div>

                {/* Prix unitaire & Total ligne */}
                <div className="text-right">
                  <p className="text-[10px] text-gray-400">{formatPrice(l.prixUnitaire)} / u</p>
                  <p className="text-sm font-extrabold" style={{ color: 'var(--color-gold)' }}>{formatPrice(l.total)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Totaux + paiement ── */}
        <div className="shrink-0 p-4 border-t space-y-3 max-h-[50vh] overflow-y-auto" style={{ borderColor: 'var(--color-cream-dark)', backgroundColor: 'var(--color-cream)' }}>
          {/* Remises */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label text-[10px]">Remise Fixe (F)</label>
              <input
                type="number" min="0" className="input text-xs text-center font-semibold py-1.5"
                value={remiseTTC || ''}
                onChange={e => setRemiseTTC(+e.target.value)}
                placeholder="0 F"
              />
            </div>
            <div>
              <label className="label text-[10px]">Remise %</label>
              <input
                type="number" min="0" max="100" className="input text-xs text-center font-semibold py-1.5"
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
              className="w-3.5 h-3.5 text-var(--color-gold) border-gray-300 rounded focus:ring-var(--color-gold)"
              checked={appliquerTVA}
              onChange={e => setAppliquerTVA(e.target.checked)}
            />
            <label htmlFor="appliquer-tva-cb" className="text-xs font-semibold cursor-pointer select-none text-var(--color-ink-light)">
              Appliquer la TVA (18%)
            </label>
          </div>

          {/* Totaux */}
          <div className="bg-white rounded-xl p-3 space-y-1.5 border border-gray-200">
            <div className="flex justify-between text-xs" style={{ color: 'var(--color-ink-muted)' }}>
              <span>Sous-total</span><span>{formatPrice(sousTotal)}</span>
            </div>
            {remisePercent > 0 && (
              <div className="flex justify-between text-xs font-medium text-red-600">
                <span>Remise ({remisePercent}%)</span><span>-{formatPrice(montantRemisePercent)}</span>
              </div>
            )}
            {remiseTTC > 0 && (
              <div className="flex justify-between text-xs font-medium text-red-600">
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
            <label className="label text-[10px] uppercase tracking-wider text-gray-500 mb-1">Mode de paiement</label>
            <div className="grid grid-cols-2 gap-1.5">
              {MODES.map(m => (
                <button
                  key={m.value}
                  onClick={() => setModePaiement(m.value)}
                  className={clsx('py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border transition-all')}
                  style={modePaiement === m.value
                    ? { backgroundColor: 'var(--color-gold-pale)', borderColor: 'var(--color-gold)', color: 'var(--color-gold)' }
                    : { backgroundColor: 'white', borderColor: 'var(--color-cream-dark)', color: 'var(--color-ink-muted)' }
                  }
                >
                  <m.Icon size={13} />
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Montant reçu */}
          <div>
            <label className="label text-[10px] uppercase tracking-wider text-gray-500 mb-1">Montant reçu (F)</label>
            <input
              type="number" min="0" className="input text-sm font-semibold text-center py-1.5"
              placeholder={String(Math.ceil(totalTTC))}
              value={montantRecu || ''}
              onChange={e => setMontantRecu(+e.target.value)}
            />
            {renduMonnaie > 0 && (
              <div
                className="mt-1.5 flex justify-between px-3 py-1.5 rounded-lg text-xs font-bold"
                style={{ backgroundColor: '#f0fdf4', color: '#16a34a' }}
              >
                <span>Rendu monnaie</span>
                <span>{formatPrice(renduMonnaie)}</span>
              </div>
            )}
            {resteApayer > 0 && (
              <div
                className="mt-1.5 flex justify-between px-3 py-1.5 rounded-lg text-xs font-semibold"
                style={{ backgroundColor: '#fef9ee', color: '#d97706', border: '1px solid #fde68a' }}
              >
                <span>⚠️ Reste (crédit client)</span>
                <span>{formatPrice(resteApayer)}</span>
              </div>
            )}
          </div>

          {/* Bouton mettre en attente */}
          {cart.length > 0 && (
            <button
              onClick={mettreEnAttente}
              className="w-full py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 border-2 transition-all"
              style={{ borderColor: 'var(--color-gold)', color: 'var(--color-gold)', backgroundColor: 'white' }}
            >
              <Clock size={15} />
              Mettre en attente
            </button>
          )}

          {/* Bouton encaisser */}
          <button
            onClick={handleEncaisser}
            disabled={cart.length === 0 || loading}
            className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-md active:scale-[0.99]"
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
          montantRecu={montantRecu}
          onNouvelleVente={handleNouvelleVente}
          onVoirTicket={() => { clearCart(); setShowSuccess(false); setShowTicket(true); }}
        />
      )}

      {/* ══ Modal reçu ══ */}
      {showTicket && successFacture && (
        <ReceiptModal
          facture={successFacture}
          onClose={() => { setShowTicket(false); setSuccessFacture(null); }}
        />
      )}

      {/* ══ Modal file d'attente ══ */}
      {showQueue && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowQueue(false)}>
          <div
            className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--color-cream-dark)' }}>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--color-gold-pale)', color: 'var(--color-gold)' }}>
                  <Clock size={16} />
                </div>
                <div>
                  <h3 className="font-bold text-sm" style={{ color: 'var(--color-ink)' }}>File d'attente</h3>
                  <p className="text-[10px]" style={{ color: 'var(--color-ink-muted)' }}>
                    {waitingQueue.length === 0 ? 'Aucun panier en attente' : `${waitingQueue.length} panier${waitingQueue.length > 1 ? 's' : ''} en attente`}
                  </p>
                </div>
              </div>
              <button onClick={() => setShowQueue(false)} style={{ color: 'var(--color-ink-muted)' }}><X size={18} /></button>
            </div>

            {/* Liste */}
            <div className="divide-y max-h-[60vh] overflow-y-auto" style={{ borderColor: 'var(--color-cream-dark)' }}>
              {waitingQueue.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2">
                  <Clock size={32} style={{ color: 'var(--color-ink-muted)', opacity: 0.3 }} />
                  <p className="text-sm" style={{ color: 'var(--color-ink-muted)' }}>Aucun panier en attente</p>
                  <p className="text-xs" style={{ color: 'var(--color-ink-muted)' }}>Cliquez sur "Mettre en attente" pour garer un panier</p>
                </div>
              ) : waitingQueue.map(snap => {
                const total = snap.cart.reduce((s, l) => s + l.total, 0);
                const nbArt = snap.cart.reduce((s, l) => s + l.quantite, 0);
                const mins = Math.floor((Date.now() - snap.savedAt.getTime()) / 60000);
                return (
                  <div key={snap.id} className="flex items-center gap-3 px-5 py-4 hover:bg-amber-50/50 transition-colors">
                    {/* Icône */}
                    <div className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center text-white font-bold text-sm"
                      style={{ backgroundColor: 'var(--color-gold)' }}>
                      {snap.label.charAt(0).toUpperCase()}
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate" style={{ color: 'var(--color-ink)' }}>{snap.label}</p>
                      <p className="text-xs" style={{ color: 'var(--color-ink-muted)' }}>
                        {nbArt} article{nbArt > 1 ? 's' : ''} · {formatPrice(total)}
                        {mins > 0 ? ` · il y a ${mins} min` : ' · À l\'instant'}
                      </p>
                    </div>
                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => supprimerAttente(snap.id)}
                        className="p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                        title="Supprimer"
                        style={{ color: '#dc2626' }}
                      >
                        <X size={14} />
                      </button>
                      <button
                        onClick={() => rappelerPanier(snap.id)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors text-white"
                        style={{ backgroundColor: 'var(--color-gold)' }}
                      >
                        Rappeler <ChevronRight size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer — mettre le panier actuel en attente depuis le modal */}
            {cart.length > 0 && (
              <div className="px-5 py-4 border-t" style={{ borderColor: 'var(--color-cream-dark)' }}>
                <button
                  onClick={() => { mettreEnAttente(); }}
                  className="w-full py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 border-2 transition-all"
                  style={{ borderColor: 'var(--color-gold)', color: 'var(--color-gold)', backgroundColor: 'white' }}
                >
                  <Clock size={15} />
                  Mettre le panier actuel en attente ({cart.reduce((s, l) => s + l.quantite, 0)} art.)
                </button>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
