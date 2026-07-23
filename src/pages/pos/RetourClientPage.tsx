import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Search, RotateCcw, CheckCircle2,
  Receipt, X, ChevronRight, AlertCircle,
} from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { useAppStore } from '@/store/appStore';
import { facturesApi, USE_API } from '@/lib/api';
import { formatPrice, formatDate } from '@/lib/format';
import type { Facture } from '@/types';

// ── Types ─────────────────────────────────────────────────
type RemboursementMode = 'especes' | 'credit_reduc' | 'avoir';

interface LigneRetour {
  index: number;
  designation: string;
  quantiteAchetee: number;
  quantiteRetour: number;
  prixUnitaire: number;
}

// ── Step type ─────────────────────────────────────────────
type Step = 'search' | 'select' | 'confirm';

// ── Helpers ───────────────────────────────────────────────
function statutLabel(s: string) {
  return (
    { payee: 'Payée', partielle: 'Partielle', en_retard: 'En retard', annulee: 'Annulée', brouillon: 'Brouillon', envoyee: 'Envoyée' }[s] ?? s
  );
}
function statutClass(s: string) {
  return (
    {
      payee:     'bg-green-100  text-green-700',
      partielle: 'bg-amber-100  text-amber-700',
      en_retard: 'bg-red-100    text-red-700',
      annulee:   'bg-red-100    text-red-700',
    }[s] ?? 'bg-gray-100 text-gray-600'
  );
}

// ── Stepper ───────────────────────────────────────────────
const STEPS: { id: Step; label: string }[] = [
  { id: 'search',  label: 'Rechercher la vente' },
  { id: 'select',  label: 'Sélectionner les articles' },
  { id: 'confirm', label: 'Confirmer le retour' },
];

function StepBar({ current }: { current: Step }) {
  const idx = STEPS.findIndex(s => s.id === current);
  return (
    <div className="flex items-center gap-0 mb-8">
      {STEPS.map((step, i) => (
        <div key={step.id} className="flex items-center">
          <div className="flex items-center gap-2">
            <div
              className={clsx(
                'w-7 h-7 rounded-full flex items-center justify-center text-xs font-black transition-colors',
                i < idx  ? 'bg-green-500 text-white' :
                i === idx ? 'text-white'               : 'bg-gray-100 text-gray-400',
              )}
              style={i === idx ? { backgroundColor: 'var(--color-gold)' } : undefined}
            >
              {i < idx ? <CheckCircle2 size={14} /> : i + 1}
            </div>
            <span
              className={clsx('text-xs font-semibold hidden sm:block', i === idx ? 'text-ink' : 'text-ink-muted')}
            >
              {step.label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <ChevronRight size={16} className="mx-2 text-gray-300 shrink-0" />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────
export default function RetourClientPage() {
  const navigate = useNavigate();
  const { factures, produits, updateProduit, updateFacture } = useAppStore();

  // ── State ─────────────────────────────────────────────
  const [step, setStep]           = useState<Step>('search');
  const [search, setSearch]       = useState('');
  const [selected, setSelected]   = useState<Facture | null>(null);
  const [lignes, setLignes]       = useState<LigneRetour[]>([]);
  const [motif, setMotif]         = useState('');
  const [mode, setMode]           = useState<RemboursementMode>('especes');
  const [loading, setLoading]     = useState(false);

  // ── Filtered list (step 1) ────────────────────────────
  const filtered = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return factures
      .filter(f => f.statut !== 'annulee')
      .filter(f =>
        f.numero.toLowerCase().includes(q) ||
        f.clientNom.toLowerCase().includes(q)
      )
      .slice(0, 12);
  }, [factures, search]);

  // ── Total retour ──────────────────────────────────────
  const totalRetour = useMemo(
    () => lignes.reduce((acc, l) => acc + l.quantiteRetour * l.prixUnitaire, 0),
    [lignes]
  );
  const hasItems = lignes.some(l => l.quantiteRetour > 0);

  // ── Step 1 → 2: pick invoice ──────────────────────────
  const handleSelectFacture = (f: Facture) => {
    setSelected(f);
    setLignes(
      f.lignes.map((l, i) => ({
        index:          i,
        designation:    l.designation,
        quantiteAchetee: l.quantite,
        quantiteRetour: 0,
        prixUnitaire:   l.prixUnitaire,
      }))
    );
    setStep('select');
  };

  // ── Quantity helpers ──────────────────────────────────
  const dec = (i: number) =>
    setLignes(prev => prev.map(l => l.index === i ? { ...l, quantiteRetour: Math.max(0, l.quantiteRetour - 1) } : l));
  const inc = (i: number) =>
    setLignes(prev => prev.map(l => l.index === i ? { ...l, quantiteRetour: Math.min(l.quantiteAchetee, l.quantiteRetour + 1) } : l));
  const setAll = (i: number) =>
    setLignes(prev => prev.map(l => l.index === i ? { ...l, quantiteRetour: l.quantiteAchetee } : l));

  // ── Submit retour ─────────────────────────────────────
  const handleConfirm = async () => {
    if (!selected) return;
    if (!motif.trim()) { toast.error('Veuillez indiquer un motif de retour'); return; }
    if (!hasItems)     { toast.error('Sélectionnez au moins un article à retourner'); return; }

    const itemsToReturn = lignes
      .filter(l => l.quantiteRetour > 0)
      .map(l => ({
        designation:  l.designation,
        quantite:     l.quantiteRetour,
        prixUnitaire: l.prixUnitaire,
      }));

    setLoading(true);
    try {
      if (USE_API) {
        const updated = await facturesApi.retour(selected.id, {
          lignesRetour:      itemsToReturn,
          motif:             motif.trim(),
          remboursementMode: mode,
        });
        // restore stock locally
        itemsToReturn.forEach(item => {
          const ref  = item.designation.split(' — ')[0]?.trim();
          const prod = produits.find(p => p.reference === ref);
          if (prod) updateProduit(prod.id, { stockActuel: prod.stockActuel + item.quantite });
        });
        updateFacture(selected.id, updated);
      } else {
        // local-only fallback
        itemsToReturn.forEach(item => {
          const ref  = item.designation.split(' — ')[0]?.trim();
          const prod = produits.find(p => p.reference === ref);
          if (prod) updateProduit(prod.id, { stockActuel: prod.stockActuel + item.quantite });
        });
        const note = `[Retour Client le ${new Date().toLocaleDateString('fr-FR')}] ${itemsToReturn.map(i => `${i.quantite}× ${i.designation}`).join(', ')}. Mode: ${mode}. Motif: ${motif.trim()}`;
        updateFacture(selected.id, { notes: [selected.notes, note].filter(Boolean).join('\n') });
      }

      toast.success('Retour enregistré — stock mis à jour !');
      // reset
      setStep('search');
      setSearch('');
      setSelected(null);
      setLignes([]);
      setMotif('');
      setMode('especes');
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de l'enregistrement du retour");
    } finally {
      setLoading(false);
    }
  };

  // ── Render ────────────────────────────────────────────
  return (
    <div className="space-y-6 max-w-3xl mx-auto">

      {/* Header */}
      <div>
        <button
          onClick={() => navigate('/pos/historique')}
          className="flex items-center gap-1.5 text-sm mb-3 transition-colors"
          style={{ color: 'var(--color-ink-muted)' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-gold)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-ink-muted)')}
        >
          <ArrowLeft size={15} /> Historique des ventes
        </button>
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: 'var(--color-gold)', color: 'white' }}
          >
            <RotateCcw size={18} />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--color-ink)', fontFamily: 'var(--font-display)' }}>
              Retour Client
            </h1>
            <p className="text-xs" style={{ color: 'var(--color-ink-muted)' }}>
              Recherchez une vente, sélectionnez les articles et confirmez le retour
            </p>
          </div>
        </div>
      </div>

      {/* Step bar */}
      <StepBar current={step} />

      {/* ── STEP 1: SEARCH ──────────────────────────────── */}
      {step === 'search' && (
        <div className="card space-y-5">
          <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--color-ink)' }}>
            <Search size={16} style={{ color: 'var(--color-gold)' }} />
            Rechercher la vente à retourner
          </div>

          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-ink-muted)' }} />
            <input
              autoFocus
              type="text"
              className="input pl-9"
              placeholder="Numéro de ticket (TIC-…, FAC-…) ou nom du client…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X size={14} style={{ color: 'var(--color-ink-muted)' }} />
              </button>
            )}
          </div>

          {search.trim() === '' && (
            <div className="py-10 text-center space-y-2">
              <Receipt size={36} className="mx-auto" style={{ color: 'var(--color-cream-dark)' }} />
              <p className="text-sm font-medium" style={{ color: 'var(--color-ink-muted)' }}>
                Tapez un numéro de ticket ou le nom du client
              </p>
            </div>
          )}

          {search.trim() !== '' && filtered.length === 0 && (
            <div className="py-10 text-center space-y-2">
              <AlertCircle size={32} className="mx-auto text-amber-400" />
              <p className="text-sm font-medium" style={{ color: 'var(--color-ink-muted)' }}>
                Aucune vente trouvée pour «&nbsp;{search}&nbsp;»
              </p>
              <p className="text-xs" style={{ color: 'var(--color-ink-muted)' }}>
                Vérifiez le numéro de ticket ou le nom du client. Les ventes annulées n'apparaissent pas.
              </p>
            </div>
          )}

          {filtered.length > 0 && (
            <div className="divide-y rounded-xl overflow-hidden border" style={{ borderColor: 'var(--color-cream-dark)' }}>
              {filtered.map(f => (
                <button
                  key={f.id}
                  onClick={() => handleSelectFacture(f)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left transition-colors hover:bg-cream/60 group"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: 'var(--color-cream)' }}
                    >
                      <Receipt size={16} style={{ color: 'var(--color-gold)' }} />
                    </div>
                    <div>
                      <p className="text-sm font-bold font-mono" style={{ color: 'var(--color-ink)' }}>{f.numero}</p>
                      <p className="text-xs" style={{ color: 'var(--color-ink-muted)' }}>
                        {f.clientNom} · {formatDate(f.dateFacture)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right hidden sm:block">
                      <p className="text-sm font-bold" style={{ color: 'var(--color-ink)' }}>{formatPrice(f.totalTTC)}</p>
                      <p className="text-[10px]" style={{ color: 'var(--color-ink-muted)' }}>{f.lignes.length} article(s)</p>
                    </div>
                    <span className={clsx('px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide', statutClass(f.statut))}>
                      {statutLabel(f.statut)}
                    </span>
                    <ChevronRight size={15} className="text-ink-muted group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── STEP 2: SELECT ITEMS ────────────────────────── */}
      {step === 'select' && selected && (
        <div className="space-y-4">

          {/* Invoice summary banner */}
          <div
            className="flex items-center justify-between p-4 rounded-2xl"
            style={{ backgroundColor: 'var(--color-cream)', border: '1px solid var(--color-cream-dark)' }}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'white' }}>
                <Receipt size={16} style={{ color: 'var(--color-gold)' }} />
              </div>
              <div>
                <p className="font-bold font-mono text-sm" style={{ color: 'var(--color-ink)' }}>{selected.numero}</p>
                <p className="text-xs" style={{ color: 'var(--color-ink-muted)' }}>
                  {selected.clientNom} · {formatDate(selected.dateFacture)} · {formatPrice(selected.totalTTC)}
                </p>
              </div>
            </div>
            <button
              onClick={() => { setStep('search'); setSelected(null); setLignes([]); }}
              className="p-1.5 hover:bg-white/60 rounded-lg transition-colors"
            >
              <X size={14} style={{ color: 'var(--color-ink-muted)' }} />
            </button>
          </div>

          {/* Lines table */}
          <div className="card p-0 overflow-hidden">
            <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--color-cream-dark)', backgroundColor: 'var(--color-cream)' }}>
              <p className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--color-ink-muted)' }}>
                Articles de la vente
              </p>
              <p className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--color-gold)' }}>
                Total retour : {formatPrice(totalRetour)}
              </p>
            </div>
            <table className="w-full text-left text-sm">
              <thead style={{ backgroundColor: 'var(--color-cream)' }}>
                <tr>
                  <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--color-ink-muted)' }}>Produit</th>
                  <th className="px-3 py-3 text-center text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--color-ink-muted)' }}>Acheté</th>
                  <th className="px-3 py-3 text-center text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--color-ink-muted)' }}>À retourner</th>
                  <th className="px-5 py-3 text-right text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--color-ink-muted)' }}>Montant</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'var(--color-cream-dark)' }}>
                {lignes.map(l => (
                  <tr key={l.index} className="hover:bg-cream/30 transition-colors">
                    <td className="px-5 py-3">
                      <p className="font-semibold" style={{ color: 'var(--color-ink)' }}>{l.designation}</p>
                      <p className="text-[10px] font-mono" style={{ color: 'var(--color-ink-muted)' }}>{formatPrice(l.prixUnitaire)} / unité</p>
                    </td>
                    <td className="px-3 py-3 text-center font-bold" style={{ color: 'var(--color-ink-muted)' }}>{l.quantiteAchetee}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button type="button" onClick={() => dec(l.index)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-base transition-colors"
                          style={{ backgroundColor: 'var(--color-cream)', color: 'var(--color-ink)' }}>−</button>
                        <span className="w-6 text-center font-black text-sm" style={{ color: l.quantiteRetour > 0 ? 'var(--color-gold)' : 'var(--color-ink-muted)' }}>
                          {l.quantiteRetour}
                        </span>
                        <button type="button" onClick={() => inc(l.index)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-base transition-colors"
                          style={{ backgroundColor: 'var(--color-cream)', color: 'var(--color-ink)' }}>+</button>
                        {l.quantiteRetour < l.quantiteAchetee && (
                          <button type="button" onClick={() => setAll(l.index)}
                            className="text-[10px] font-bold underline transition-colors ml-1"
                            style={{ color: 'var(--color-ink-muted)' }}
                            onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-gold)')}
                            onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-ink-muted)')}
                          >tout</button>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right font-bold" style={{ color: l.quantiteRetour > 0 ? 'var(--color-gold)' : 'var(--color-ink-muted)' }}>
                      {formatPrice(l.quantiteRetour * l.prixUnitaire)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between items-center pt-1">
            <button onClick={() => { setStep('search'); setSelected(null); setLignes([]); }} className="btn-secondary text-sm">
              <ArrowLeft size={14} /> Retour
            </button>
            <button
              onClick={() => { if (!hasItems) { toast.error('Sélectionnez au moins un article'); return; } setStep('confirm'); }}
              className="btn-primary text-sm"
            >
              Continuer <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 3: CONFIRM ─────────────────────────────── */}
      {step === 'confirm' && selected && (
        <div className="space-y-5">

          {/* Recap banner */}
          <div
            className="flex items-center justify-between p-4 rounded-2xl"
            style={{ backgroundColor: 'var(--color-cream)', border: '1px solid var(--color-cream-dark)' }}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'white' }}>
                <Receipt size={16} style={{ color: 'var(--color-gold)' }} />
              </div>
              <div>
                <p className="font-bold font-mono text-sm" style={{ color: 'var(--color-ink)' }}>{selected.numero}</p>
                <p className="text-xs" style={{ color: 'var(--color-ink-muted)' }}>{selected.clientNom}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase font-black tracking-widest" style={{ color: 'var(--color-ink-muted)' }}>Montant retour</p>
              <p className="text-lg font-black" style={{ color: 'var(--color-gold)' }}>{formatPrice(totalRetour)}</p>
            </div>
          </div>

          {/* Summary of items to return */}
          <div className="card space-y-3">
            <p className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--color-ink-muted)' }}>
              Articles retournés
            </p>
            <div className="space-y-2">
              {lignes.filter(l => l.quantiteRetour > 0).map(l => (
                <div key={l.index} className="flex items-center justify-between py-2 border-b last:border-0" style={{ borderColor: 'var(--color-cream-dark)' }}>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--color-ink)' }}>{l.designation}</p>
                    <p className="text-xs" style={{ color: 'var(--color-ink-muted)' }}>
                      {l.quantiteRetour} × {formatPrice(l.prixUnitaire)}
                    </p>
                  </div>
                  <p className="font-bold text-sm" style={{ color: 'var(--color-gold)' }}>
                    {formatPrice(l.quantiteRetour * l.prixUnitaire)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Motif + remboursement mode */}
          <div className="card space-y-5">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-black tracking-widest pl-1" style={{ color: 'var(--color-ink-muted)' }}>
                Motif du retour *
              </label>
              <textarea
                value={motif}
                onChange={e => setMotif(e.target.value)}
                className="input min-h-[90px] resize-none py-3 text-sm"
                placeholder="Ex: Produit défectueux, mauvaise taille, erreur de commande…"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] uppercase font-black tracking-widest pl-1" style={{ color: 'var(--color-ink-muted)' }}>
                Mode de remboursement
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {([
                  { id: 'especes'      as RemboursementMode, label: 'Espèces / Cash',   desc: 'Remboursement immédiat en liquide' },
                  { id: 'credit_reduc' as RemboursementMode, label: 'Déduction de dette', desc: 'Appliqué sur la créance client'    },
                  { id: 'avoir'        as RemboursementMode, label: 'Avoir',             desc: 'Crédit pour achat futur',  disabled: true },
                ] as { id: RemboursementMode; label: string; desc: string; disabled?: boolean }[]).map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    disabled={opt.disabled}
                    onClick={() => !opt.disabled && setMode(opt.id)}
                    className={clsx(
                      'flex flex-col items-start gap-1 px-4 py-3 rounded-xl border-2 text-left transition-all',
                      opt.disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer',
                      mode === opt.id && !opt.disabled
                        ? 'border-gold bg-gold/5'
                        : 'border-cream-dark hover:border-gold/40',
                    )}
                  >
                    <div className="flex items-center gap-2 w-full">
                      <div className={clsx('w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0',
                        mode === opt.id && !opt.disabled ? 'border-gold' : 'border-gray-300')}>
                        {mode === opt.id && !opt.disabled && (
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--color-gold)' }} />
                        )}
                      </div>
                      <span className="text-sm font-bold" style={{ color: 'var(--color-ink)' }}>{opt.label}</span>
                    </div>
                    <p className="text-[10px] pl-6" style={{ color: 'var(--color-ink-muted)' }}>{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center pt-1">
            <button onClick={() => setStep('select')} className="btn-secondary text-sm">
              <ArrowLeft size={14} /> Modifier la sélection
            </button>
            <button
              onClick={handleConfirm}
              disabled={loading || !motif.trim()}
              className="btn-primary text-sm"
            >
              {loading ? (
                <span className="flex items-center gap-2"><span className="animate-spin">⏳</span> Traitement…</span>
              ) : (
                <span className="flex items-center gap-2"><CheckCircle2 size={15} /> Valider le retour</span>
              )}
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
