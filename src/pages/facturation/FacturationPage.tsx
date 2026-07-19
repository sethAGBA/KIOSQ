import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Download, ArrowUpRight, Clock, X, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { useAppStore } from '@/store/appStore';
import { useAuthStore } from '@/store/authStore';
import { facturesApi } from '@/lib/api';
import { formatPrice, formatDate, statutColor, statutLabel } from '@/lib/format';
import type { Facture, LigneFacture } from '@/types';

const STATUTS = ['tous', 'brouillon', 'envoyee', 'payee', 'partielle', 'en_retard', 'annulee'] as const;

interface LigneForm {
  designation: string;
  quantite: number;
  prixUnitaire: number;
  remise: number;
  tva: number;
  total: number;
}

const newLigne = (tvaDefault = 18): LigneForm => ({
  designation: '', quantite: 1, prixUnitaire: 0, remise: 0, tva: tvaDefault, total: 0,
});

export default function FacturationPage() {
  const { factures, clients, commandes, addFacture } = useAppStore();
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [statutFilter, setStatutFilter] = useState('tous');
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);

  const [formClientId, setFormClientId] = useState('');
  const [formCommandeId, setFormCommandeId] = useState('');
  const [formTva, setFormTva] = useState(18);
  const [formRemiseGlobale, setFormRemiseGlobale] = useState(0);
  const [formDateEcheance, setFormDateEcheance] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [lignes, setLignes] = useState<LigneForm[]>([newLigne()]);

  const canCreate = user?.role === 'admin' || user?.role === 'comptable' || user?.role === 'gestionnaire';

  const filtered = useMemo(() => {
    return factures.filter((f) => {
      const matchSearch =
        f.numero.toLowerCase().includes(search.toLowerCase()) ||
        f.clientNom.toLowerCase().includes(search.toLowerCase());
      const matchStatut = statutFilter === 'tous' || f.statut === statutFilter;
      return matchSearch && matchStatut;
    });
  }, [factures, search, statutFilter]);

  const kpis = useMemo(() => ({
    totalFacture:  factures.reduce((s, f) => s + f.totalTTC, 0),
    totalPaye:     factures.reduce((s, f) => s + f.montantPaye, 0),
    totalEnAttente: factures.filter(f => ['envoyee', 'partielle', 'en_retard'].includes(f.statut)).reduce((s, f) => s + f.resteAPayer, 0),
    nbEnRetard:    factures.filter(f => f.statut === 'en_retard').length,
  }), [factures]);

  // ── Calculs totaux ─────────────────────────────────
  const totalHT  = useMemo(() => lignes.reduce((s, l) => s + l.total, 0) * (1 - formRemiseGlobale / 100), [lignes, formRemiseGlobale]);
  const totalTTC = useMemo(() => totalHT * (1 + formTva / 100), [totalHT, formTva]);

  const updateLigne = (index: number, patch: Partial<LigneForm>) => {
    setLignes(prev => prev.map((l, i) => {
      if (i !== index) return l;
      const updated = { ...l, ...patch };
      updated.total = updated.quantite * updated.prixUnitaire * (1 - updated.remise / 100);
      return updated;
    }));
  };

  // Prefill from commande when selected
  const handleSelectCommande = (cmdId: string) => {
    setFormCommandeId(cmdId);
    if (!cmdId) return;
    const cmd = commandes.find(c => c.id === cmdId);
    if (!cmd) return;
    setFormClientId(cmd.clientId);
    setFormTva(cmd.tva);
    setFormRemiseGlobale(cmd.remiseGlobale);
    setLignes(cmd.lignes.map(l => ({
      designation: `${l.produitRef} — ${l.produitNom}`,
      quantite: l.quantite,
      prixUnitaire: l.prixUnitaire,
      remise: l.remise,
      tva: cmd.tva,
      total: l.total,
    })));
  };

  const openModal = () => {
    setFormClientId('');
    setFormCommandeId('');
    setFormTva(18);
    setFormRemiseGlobale(0);
    setFormDateEcheance('');
    setFormNotes('');
    setLignes([newLigne()]);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formClientId) return toast.error('Sélectionnez un client');
    if (!formDateEcheance) return toast.error('Renseignez la date d\'échéance');
    const validLignes = lignes.filter(l => l.designation.trim() && l.quantite > 0);
    if (validLignes.length === 0) return toast.error('Ajoutez au moins une ligne');

    setLoading(true);
    try {
      const payload = {
        clientId: formClientId,
        commandeId: formCommandeId || undefined,
        lignes: validLignes,
        totalHT,
        remiseGlobale: formRemiseGlobale,
        tva: formTva,
        totalTTC,
        dateEcheance: formDateEcheance,
        notes: formNotes || undefined,
      };

      const created = await facturesApi.create(payload).catch(() => null);
      if (created) {
        addFacture(created);
      } else {
        const client = clients.find(c => c.id === formClientId);
        addFacture({
          ...payload,
          id: `fac-${Date.now()}`,
          numero: `FAC-${new Date().getFullYear()}-${String(factures.length + 1).padStart(3, '0')}`,
          clientNom: client?.nom ?? '',
          clientEmail: client?.email,
          clientAdresse: client?.adresse,
          statut: 'brouillon',
          montantPaye: 0,
          resteAPayer: totalTTC,
          paiements: [],
          dateFacture: new Date(),
          dateEcheance: new Date(formDateEcheance),
          createdBy: user?.id ?? '',
          createdAt: new Date(),
          updatedAt: new Date(),
        } as Facture);
      }
      toast.success('Facture créée');
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
          <p className="text-[10px] font-mono tracking-widest uppercase mb-1" style={{ color: 'var(--color-ink-muted)' }}>Comptabilité</p>
          <h1 className="text-3xl font-bold" style={{ color: 'var(--color-ink)', fontFamily: 'var(--font-display)' }}>Facturation</h1>
        </div>
        {canCreate && (
          <button className="btn-primary" onClick={openModal}>
            <Plus size={15} /> Nouvelle facture
          </button>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <p className="label">Total facturé</p>
          <p className="text-xl font-bold" style={{ color: 'var(--color-ink)' }}>{formatPrice(kpis.totalFacture)}</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-ink-muted)' }}>{factures.length} factures</p>
        </div>
        <div className="card p-4">
          <p className="label">Encaissé</p>
          <p className="text-xl font-bold" style={{ color: '#16a34a' }}>{formatPrice(kpis.totalPaye)}</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-ink-muted)' }}>paiements reçus</p>
        </div>
        <div className="card p-4">
          <p className="label">En attente</p>
          <p className="text-xl font-bold" style={{ color: '#d97706' }}>{formatPrice(kpis.totalEnAttente)}</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-ink-muted)' }}>à encaisser</p>
        </div>
        <div className="card p-4 border-l-2" style={{ borderLeftColor: '#ef4444' }}>
          <p className="label">En retard</p>
          <p className="text-xl font-bold" style={{ color: '#dc2626' }}>{kpis.nbEnRetard}</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-ink-muted)' }}>factures échues</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-ink-muted)' }} />
          <input className="input pl-9" placeholder="Numéro, client…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2 flex-wrap">
          {STATUTS.map((s) => (
            <button
              key={s}
              onClick={() => setStatutFilter(s)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={
                statutFilter === s
                  ? { backgroundColor: 'var(--color-gold)', color: 'white' }
                  : { backgroundColor: 'var(--color-cream-dark)', color: 'var(--color-ink-muted)' }
              }
            >
              {s === 'tous' ? 'Toutes' : statutLabel(s)}
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
              <th>Total TTC</th>
              <th>Payé</th>
              <th>Reste à payer</th>
              <th>Statut</th>
              <th>Date</th>
              <th>Échéance</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={9} className="text-center py-10" style={{ color: 'var(--color-ink-muted)' }}>Aucune facture trouvée</td></tr>
            ) : filtered.map((f) => {
              const isRetard = f.statut === 'en_retard';
              return (
                <tr key={f.id} className="cursor-pointer" onClick={() => navigate(`/facturation/${f.id}`)}>
                  <td>
                    <span className="font-mono text-xs font-medium" style={{ color: 'var(--color-ink)' }}>{f.numero}</span>
                  </td>
                  <td style={{ color: 'var(--color-ink)' }}>{f.clientNom}</td>
                  <td className="font-semibold" style={{ color: 'var(--color-ink)' }}>{formatPrice(f.totalTTC)}</td>
                  <td style={{ color: '#16a34a' }}>{formatPrice(f.montantPaye)}</td>
                  <td>
                    {f.resteAPayer > 0 ? (
                      <span className="flex items-center gap-1" style={{ color: isRetard ? '#dc2626' : '#d97706' }}>
                        {isRetard && <Clock size={12} />}
                        <span className="font-semibold">{formatPrice(f.resteAPayer)}</span>
                      </span>
                    ) : <span className="badge badge-success">soldé</span>}
                  </td>
                  <td><span className={clsx('badge', statutColor(f.statut))}>{statutLabel(f.statut)}</span></td>
                  <td style={{ color: 'var(--color-ink-muted)' }}>{formatDate(f.dateFacture)}</td>
                  <td style={{ color: isRetard ? '#dc2626' : 'var(--color-ink-muted)' }}>{formatDate(f.dateEcheance)}</td>
                  <td>
                    <div className="flex gap-1">
                      <button
                        onClick={(e) => e.stopPropagation()}
                        className="p-1.5 rounded-lg transition-colors"
                        style={{ color: 'var(--color-ink-muted)' }}
                        title="Télécharger PDF"
                      >
                        <Download size={13} />
                      </button>
                      <ArrowUpRight size={14} style={{ color: 'var(--color-gold)' }} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal Nouvelle facture */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl max-h-[95vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-5 border-b" style={{ borderColor: 'var(--color-cream-dark)' }}>
              <h3 className="font-semibold text-lg" style={{ color: 'var(--color-ink)', fontFamily: 'var(--font-display)' }}>
                Nouvelle facture
              </h3>
              <button onClick={() => setShowModal(false)} style={{ color: 'var(--color-ink-muted)' }}><X size={18} /></button>
            </div>

            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Client *</label>
                  <select
                    required
                    className="input"
                    value={formClientId}
                    onChange={e => setFormClientId(e.target.value)}
                  >
                    <option value="">Sélectionner…</option>
                    {clients.filter(c => c.actif).map(c => (
                      <option key={c.id} value={c.id}>{c.nom}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Commande liée (optionnel)</label>
                  <select
                    className="input"
                    value={formCommandeId}
                    onChange={e => handleSelectCommande(e.target.value)}
                  >
                    <option value="">Aucune</option>
                    {commandes.filter(c => c.type === 'commande').map(c => (
                      <option key={c.id} value={c.id}>{c.numero} — {c.clientNom}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Lignes */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="label">Lignes de facturation *</label>
                  <button
                    type="button"
                    onClick={() => setLignes(prev => [...prev, newLigne(formTva)])}
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
                        <label className="label text-[10px]">Désignation</label>
                        <input
                          required
                          className="input text-sm"
                          placeholder="Désignation du service/produit…"
                          value={l.designation}
                          onChange={e => updateLigne(i, { designation: e.target.value })}
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="label text-[10px]">Qté</label>
                        <input type="number" min="1" className="input text-sm" value={l.quantite}
                          onChange={e => updateLigne(i, { quantite: +e.target.value })} />
                      </div>
                      <div className="col-span-2">
                        <label className="label text-[10px]">P.U. (F)</label>
                        <input type="number" min="0" className="input text-sm" value={l.prixUnitaire}
                          onChange={e => updateLigne(i, { prixUnitaire: +e.target.value })} />
                      </div>
                      <div className="col-span-2">
                        <label className="label text-[10px]">Remise %</label>
                        <input type="number" min="0" max="100" className="input text-sm" value={l.remise}
                          onChange={e => updateLigne(i, { remise: +e.target.value })} />
                      </div>
                      <div className="col-span-1 flex items-center justify-end pb-1">
                        {lignes.length > 1 && (
                          <button type="button" onClick={() => setLignes(prev => prev.filter((_, j) => j !== i))}
                            className="p-1 rounded-lg text-red-400 hover:bg-red-50 transition-colors">
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

              {/* Conditions */}
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
                  <label className="label">Échéance *</label>
                  <input type="date" required className="input" value={formDateEcheance}
                    onChange={e => setFormDateEcheance(e.target.value)} />
                </div>
              </div>

              <div>
                <label className="label">Notes (optionnel)</label>
                <input className="input" placeholder="Notes pour la facture…" value={formNotes}
                  onChange={e => setFormNotes(e.target.value)} />
              </div>

              {/* Récap */}
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
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Annuler</button>
                <button type="submit" disabled={loading} className="btn-primary flex-1">
                  {loading ? 'Enregistrement…' : 'Créer la facture'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
