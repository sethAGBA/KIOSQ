import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, ShoppingCart, FileText, ArrowUpRight, X, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { useAppStore } from '@/store/appStore';
import { useAuthStore } from '@/store/authStore';
import { commandesApi } from '@/lib/api';
import { formatPrice, formatDate, statutColor, statutLabel } from '@/lib/format';
import type { Commande, LigneCommande } from '@/types';

const STATUTS_COMMANDE = ['tous', 'brouillon', 'confirme', 'en_preparation', 'expedie', 'livre', 'annule'] as const;
const STATUTS_DEVIS    = ['tous', 'brouillon', 'envoye', 'accepte', 'refuse', 'expire'] as const;

type FormType = 'commande' | 'devis';

interface LigneForm {
  produitId: string;
  produitRef: string;
  produitNom: string;
  quantite: number;
  prixUnitaire: number;
  remise: number;
  total: number;
}

const newLigne = (): LigneForm => ({
  produitId: '', produitRef: '', produitNom: '', quantite: 1, prixUnitaire: 0, remise: 0, total: 0,
});

export default function CommandesPage() {
  const { commandes, clients, produits, addCommande } = useAppStore();
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const [tab, setTab] = useState<'commande' | 'devis'>('commande');
  const [search, setSearch] = useState('');
  const [statutFilter, setStatutFilter] = useState('tous');
  const [showModal, setShowModal] = useState(false);
  const [formType, setFormType] = useState<FormType>('commande');
  const [loading, setLoading] = useState(false);

  const [formClientId, setFormClientId] = useState('');
  const [formTva, setFormTva] = useState(18);
  const [formRemiseGlobale, setFormRemiseGlobale] = useState(0);
  const [formAcompte, setFormAcompte] = useState(0);
  const [formNotes, setFormNotes] = useState('');
  const [formDateLivraison, setFormDateLivraison] = useState('');
  const [formDateValidite, setFormDateValidite] = useState('');
  const [lignes, setLignes] = useState<LigneForm[]>([newLigne()]);

  const canCreate = user?.role === 'admin' || user?.role === 'commercial' || user?.role === 'gestionnaire';

  const filtered = useMemo(() => {
    return commandes.filter((c) => {
      const matchTab = c.type === tab;
      const matchSearch =
        c.numero.toLowerCase().includes(search.toLowerCase()) ||
        c.clientNom.toLowerCase().includes(search.toLowerCase());
      const matchStatut = statutFilter === 'tous' || c.statut === statutFilter;
      return matchTab && matchSearch && matchStatut;
    });
  }, [commandes, tab, search, statutFilter]);

  const statuts = tab === 'commande' ? STATUTS_COMMANDE : STATUTS_DEVIS;

  const kpis = useMemo(() => {
    const cmds = commandes.filter(c => c.type === 'commande');
    const dvs  = commandes.filter(c => c.type === 'devis');
    return {
      totalCmds: cmds.length,
      caTotalCmds: cmds.reduce((s, c) => s + c.totalTTC, 0),
      totalDvs: dvs.length,
      caTotalDvs: dvs.reduce((s, c) => s + c.totalTTC, 0),
      enAttente: cmds.filter(c => ['confirme', 'en_preparation'].includes(c.statut)).length,
    };
  }, [commandes]);

  // ── Calculs totaux ────────────────────────────────────
  const totalHT = useMemo(() =>
    lignes.reduce((s, l) => s + l.total, 0) * (1 - formRemiseGlobale / 100),
    [lignes, formRemiseGlobale]
  );
  const totalTTC = useMemo(() => totalHT * (1 + formTva / 100), [totalHT, formTva]);
  const resteAPayer = totalTTC - formAcompte;

  const updateLigne = (index: number, patch: Partial<LigneForm>) => {
    setLignes(prev => prev.map((l, i) => {
      if (i !== index) return l;
      const updated = { ...l, ...patch };
      updated.total = updated.quantite * updated.prixUnitaire * (1 - updated.remise / 100);
      return updated;
    }));
  };

  const selectProduit = (index: number, produitId: string) => {
    const p = produits.find(x => x.id === produitId);
    if (!p) return updateLigne(index, { produitId: '' });
    updateLigne(index, {
      produitId: p.id,
      produitRef: p.reference,
      produitNom: p.designation,
      prixUnitaire: p.prixVente,
    });
  };

  const openModal = (type: FormType) => {
    setFormType(type);
    setFormClientId('');
    setFormTva(18);
    setFormRemiseGlobale(0);
    setFormAcompte(0);
    setFormNotes('');
    setFormDateLivraison('');
    setFormDateValidite('');
    setLignes([newLigne()]);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formClientId) return toast.error('Sélectionnez un client');
    const validLignes = lignes.filter(l => l.produitId && l.quantite > 0);
    if (validLignes.length === 0) return toast.error('Ajoutez au moins un produit');

    setLoading(true);
    try {
      const payload = {
        type: formType,
        clientId: formClientId,
        lignes: validLignes,
        totalHT,
        remiseGlobale: formRemiseGlobale,
        tva: formTva,
        totalTTC,
        acompte: formAcompte,
        notes: formNotes || undefined,
        dateLivraison: formDateLivraison || undefined,
        dateValidite: formDateValidite || undefined,
      };

      const created = await commandesApi.create(payload).catch(() => null);
      if (created) {
        addCommande(created);
      } else {
        const client = clients.find(c => c.id === formClientId);
        addCommande({
          ...payload,
          id: `cmd-${Date.now()}`,
          numero: `${formType === 'devis' ? 'DEV' : 'CMD'}-${new Date().getFullYear()}-${String(commandes.length + 1).padStart(3, '0')}`,
          clientNom: client?.nom ?? '',
          commercial: user?.nom ?? '',
          statut: 'brouillon',
          resteAPayer,
          dateCommande: new Date(),
          createdBy: user?.id ?? '',
          createdAt: new Date(),
          updatedAt: new Date(),
        } as Commande);
      }
      toast.success(formType === 'devis' ? 'Devis créé' : 'Commande créée');
      setShowModal(false);
    } catch {
      toast.error('Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-mono tracking-widest uppercase mb-1" style={{ color: 'var(--color-ink-muted)' }}>Ventes</p>
          <h1 className="text-3xl font-bold" style={{ color: 'var(--color-ink)', fontFamily: 'var(--font-display)' }}>Commandes & Devis</h1>
        </div>
        {canCreate && (
          <div className="flex gap-2">
            <button className="btn-secondary" onClick={() => openModal('devis')}>
              <FileText size={15} /> Nouveau devis
            </button>
            <button className="btn-primary" onClick={() => openModal('commande')}>
              <Plus size={15} /> Nouvelle commande
            </button>
          </div>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <p className="label">Commandes</p>
          <p className="text-xl font-bold" style={{ color: 'var(--color-ink)' }}>{kpis.totalCmds}</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-ink-muted)' }}>{formatPrice(kpis.caTotalCmds)}</p>
        </div>
        <div className="card p-4">
          <p className="label">Devis</p>
          <p className="text-xl font-bold" style={{ color: 'var(--color-ink)' }}>{kpis.totalDvs}</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-ink-muted)' }}>{formatPrice(kpis.caTotalDvs)} potentiel</p>
        </div>
        <div className="card p-4">
          <p className="label">En cours</p>
          <p className="text-xl font-bold" style={{ color: '#2563eb' }}>{kpis.enAttente}</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-ink-muted)' }}>confirmé / en prépa</p>
        </div>
        <div className="card p-4">
          <p className="label">CA total</p>
          <p className="text-xl font-bold" style={{ color: 'var(--color-gold)' }}>
            {formatPrice(commandes.filter(c => c.type === 'commande').reduce((s, c) => s + c.totalTTC, 0))}
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-ink-muted)' }}>toutes commandes</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ backgroundColor: 'var(--color-cream-dark)' }}>
        {(['commande', 'devis'] as const).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setStatutFilter('tous'); }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all capitalize"
            style={tab === t
              ? { backgroundColor: 'white', color: 'var(--color-ink)', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }
              : { color: 'var(--color-ink-muted)' }
            }
          >
            {t === 'commande' ? <ShoppingCart size={14} /> : <FileText size={14} />}
            {t === 'commande' ? 'Commandes' : 'Devis'}
            <span className="text-xs font-mono px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'var(--color-cream-dark)' }}>
              {commandes.filter(c => c.type === t).length}
            </span>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-ink-muted)' }} />
          <input className="input pl-9" placeholder="Numéro, client…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2 flex-wrap">
          {statuts.map((s) => (
            <button
              key={s}
              onClick={() => setStatutFilter(s)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize"
              style={
                statutFilter === s
                  ? { backgroundColor: 'var(--color-gold)', color: 'white' }
                  : { backgroundColor: 'var(--color-cream-dark)', color: 'var(--color-ink-muted)' }
              }
            >
              {s === 'tous' ? 'Tous' : statutLabel(s)}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <table className="table-auto w-full">
          <thead>
            <tr>
              <th>Numéro</th>
              <th>Client</th>
              <th>Total HT</th>
              <th>TVA</th>
              <th>Total TTC</th>
              <th>Acompte</th>
              <th>Reste</th>
              <th>Statut</th>
              <th>Date</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={10} className="text-center py-10" style={{ color: 'var(--color-ink-muted)' }}>Aucun résultat</td></tr>
            ) : filtered.map((c) => (
              <tr key={c.id} className="cursor-pointer" onClick={() => navigate(`/commandes/${c.id}`)}>
                <td><span className="font-mono text-xs font-medium" style={{ color: 'var(--color-ink)' }}>{c.numero}</span></td>
                <td style={{ color: 'var(--color-ink)' }}>{c.clientNom}</td>
                <td>{formatPrice(c.totalHT)}</td>
                <td style={{ color: 'var(--color-ink-muted)' }}>{c.tva}%</td>
                <td className="font-semibold" style={{ color: 'var(--color-ink)' }}>{formatPrice(c.totalTTC)}</td>
                <td style={{ color: '#16a34a' }}>{formatPrice(c.acompte)}</td>
                <td>
                  {c.resteAPayer > 0
                    ? <span className="font-semibold" style={{ color: '#d97706' }}>{formatPrice(c.resteAPayer)}</span>
                    : <span className="badge badge-success">soldé</span>}
                </td>
                <td><span className={clsx('badge', statutColor(c.statut))}>{statutLabel(c.statut)}</span></td>
                <td style={{ color: 'var(--color-ink-muted)' }}>{formatDate(c.createdAt)}</td>
                <td><ArrowUpRight size={14} style={{ color: 'var(--color-gold)' }} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal Create */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl max-h-[95vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-5 border-b" style={{ borderColor: 'var(--color-cream-dark)' }}>
              <div className="flex items-center gap-3">
                {formType === 'commande' ? <ShoppingCart size={18} style={{ color: 'var(--color-gold)' }} /> : <FileText size={18} style={{ color: 'var(--color-gold)' }} />}
                <h3 className="font-semibold text-lg" style={{ color: 'var(--color-ink)', fontFamily: 'var(--font-display)' }}>
                  {formType === 'devis' ? 'Nouveau devis' : 'Nouvelle commande'}
                </h3>
              </div>
              <button onClick={() => setShowModal(false)} style={{ color: 'var(--color-ink-muted)' }}><X size={18} /></button>
            </div>

            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
              {/* Client */}
              <div>
                <label className="label">Client *</label>
                <select
                  required
                  className="input"
                  value={formClientId}
                  onChange={e => setFormClientId(e.target.value)}
                >
                  <option value="">Sélectionner un client…</option>
                  {clients.filter(c => c.actif).map(c => (
                    <option key={c.id} value={c.id}>{c.nom}</option>
                  ))}
                </select>
              </div>

              {/* Lignes */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="label">Produits *</label>
                  <button
                    type="button"
                    onClick={() => setLignes(prev => [...prev, newLigne()])}
                    className="text-xs font-medium flex items-center gap-1"
                    style={{ color: 'var(--color-gold)' }}
                  >
                    <Plus size={13} /> Ajouter une ligne
                  </button>
                </div>
                <div className="space-y-2">
                  {lignes.map((l, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-end p-3 rounded-xl" style={{ backgroundColor: 'var(--color-cream)' }}>
                      <div className="col-span-5">
                        <label className="label text-[10px]">Produit</label>
                        <select
                          className="input text-sm"
                          value={l.produitId}
                          onChange={e => selectProduit(i, e.target.value)}
                        >
                          <option value="">Sélectionner…</option>
                          {produits.filter(p => p.actif).map(p => (
                            <option key={p.id} value={p.id}>{p.designation}</option>
                          ))}
                        </select>
                      </div>
                      <div className="col-span-2">
                        <label className="label text-[10px]">Qté</label>
                        <input
                          type="number"
                          min="1"
                          className="input text-sm"
                          value={l.quantite}
                          onChange={e => updateLigne(i, { quantite: +e.target.value })}
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="label text-[10px]">P.U. (F)</label>
                        <input
                          type="number"
                          min="0"
                          className="input text-sm"
                          value={l.prixUnitaire}
                          onChange={e => updateLigne(i, { prixUnitaire: +e.target.value })}
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="label text-[10px]">Remise %</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          className="input text-sm"
                          value={l.remise}
                          onChange={e => updateLigne(i, { remise: +e.target.value })}
                        />
                      </div>
                      <div className="col-span-1 flex items-center justify-end pb-1">
                        {lignes.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setLignes(prev => prev.filter((_, j) => j !== i))}
                            className="p-1 rounded-lg text-red-400 hover:bg-red-50 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                      {l.total > 0 && (
                        <div className="col-span-12 text-right text-xs font-semibold" style={{ color: 'var(--color-gold)' }}>
                          Sous-total: {formatPrice(l.total)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Conditions financières */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="label">TVA (%)</label>
                  <input type="number" min="0" max="100" className="input" value={formTva}
                    onChange={e => setFormTva(+e.target.value)} />
                </div>
                <div>
                  <label className="label">Remise globale (%)</label>
                  <input type="number" min="0" max="100" className="input" value={formRemiseGlobale}
                    onChange={e => setFormRemiseGlobale(+e.target.value)} />
                </div>
                <div>
                  <label className="label">Acompte (F)</label>
                  <input type="number" min="0" className="input" value={formAcompte}
                    onChange={e => setFormAcompte(+e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {formType === 'commande' ? (
                  <div>
                    <label className="label">Date de livraison</label>
                    <input type="date" className="input" value={formDateLivraison}
                      onChange={e => setFormDateLivraison(e.target.value)} />
                  </div>
                ) : (
                  <div>
                    <label className="label">Date de validité</label>
                    <input type="date" className="input" value={formDateValidite}
                      onChange={e => setFormDateValidite(e.target.value)} />
                  </div>
                )}
                <div>
                  <label className="label">Notes</label>
                  <input className="input" placeholder="Notes internes…" value={formNotes}
                    onChange={e => setFormNotes(e.target.value)} />
                </div>
              </div>

              {/* Récap totaux */}
              <div className="p-4 rounded-xl space-y-2" style={{ backgroundColor: 'var(--color-cream)' }}>
                <div className="flex justify-between text-sm">
                  <span style={{ color: 'var(--color-ink-muted)' }}>Total HT</span>
                  <span style={{ color: 'var(--color-ink)' }}>{formatPrice(totalHT)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span style={{ color: 'var(--color-ink-muted)' }}>TVA ({formTva}%)</span>
                  <span style={{ color: 'var(--color-ink)' }}>{formatPrice(totalTTC - totalHT)}</span>
                </div>
                <div className="flex justify-between font-bold text-base pt-2" style={{ borderTop: '1px solid var(--color-cream-dark)', color: 'var(--color-ink)' }}>
                  <span>Total TTC</span>
                  <span style={{ color: 'var(--color-gold)' }}>{formatPrice(totalTTC)}</span>
                </div>
                {formAcompte > 0 && (
                  <div className="flex justify-between text-sm">
                    <span style={{ color: 'var(--color-ink-muted)' }}>Reste à payer</span>
                    <span className="font-semibold" style={{ color: '#d97706' }}>{formatPrice(resteAPayer)}</span>
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Annuler</button>
                <button type="submit" disabled={loading} className="btn-primary flex-1">
                  {loading ? 'Enregistrement…' : `Créer le ${formType === 'devis' ? 'devis' : 'commande'}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
