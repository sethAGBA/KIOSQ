import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Send, CheckCircle, Printer, CreditCard, X } from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { useAppStore } from '@/store/appStore';
import { useAuthStore } from '@/store/authStore';
import { facturesApi } from '@/lib/api';
import { formatPrice, formatDate, statutColor, statutLabel } from '@/lib/format';
import type { ModePaiement } from '@/types';

const MODES_PAIEMENT: { value: ModePaiement; label: string }[] = [
  { value: 'especes',      label: 'Espèces' },
  { value: 'virement',     label: 'Virement bancaire' },
  { value: 'cheque',       label: 'Chèque' },
  { value: 'mobile_money', label: 'Mobile Money' },
  { value: 'carte',        label: 'Carte bancaire' },
  { value: 'autre',        label: 'Autre' },
];

export default function FactureDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { factures, updateFacture } = useAppStore();
  const { user } = useAuthStore();

  const facture = factures.find((f) => f.id === id);
  const canEdit = user?.role === 'admin' || user?.role === 'comptable' || user?.role === 'gestionnaire';

  const [showPayModal, setShowPayModal] = useState(false);
  const [payMontant, setPayMontant] = useState(0);
  const [payMode, setPayMode] = useState<ModePaiement>('especes');
  const [payRef, setPayRef] = useState('');
  const [payLoading, setPayLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);

  if (!facture) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <p style={{ color: 'var(--color-ink-muted)' }}>Facture introuvable.</p>
      <button className="btn-secondary" onClick={() => navigate('/facturation')}>Retour</button>
    </div>
  );

  const handleMarkPaid = async () => {
    if (!confirm('Marquer cette facture comme entièrement payée ?')) return;
    setStatusLoading(true);
    try {
      const updated = await facturesApi.update(facture.id, { statut: 'payee' }).catch(() => null);
      if (updated) {
        updateFacture(facture.id, updated);
      } else {
        updateFacture(facture.id, { statut: 'payee', montantPaye: facture.totalTTC, resteAPayer: 0 });
      }
      toast.success('Facture marquée comme payée');
    } catch {
      toast.error('Erreur lors de la mise à jour');
    } finally {
      setStatusLoading(false);
    }
  };

  const handleMarkSent = async () => {
    setStatusLoading(true);
    try {
      const updated = await facturesApi.update(facture.id, { statut: 'envoyee' }).catch(() => null);
      if (updated) {
        updateFacture(facture.id, updated);
      } else {
        updateFacture(facture.id, { statut: 'envoyee' });
      }
      toast.success('Facture marquée comme envoyée');
    } catch {
      toast.error('Erreur lors de la mise à jour');
    } finally {
      setStatusLoading(false);
    }
  };

  const openPayModal = () => {
    setPayMontant(facture.resteAPayer);
    setPayMode('especes');
    setPayRef('');
    setShowPayModal(true);
  };

  const handleRegisterPaiement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (payMontant <= 0) return toast.error('Montant invalide');
    if (payMontant > facture.resteAPayer) return toast.error('Montant supérieur au reste à payer');

    setPayLoading(true);
    try {
      const paiement = {
        montant: payMontant,
        mode: payMode,
        date: new Date().toISOString(),
        reference: payRef || undefined,
      };

      const updated = await facturesApi.addPaiement(facture.id, paiement as any).catch(() => null);
      if (updated) {
        updateFacture(facture.id, updated);
      } else {
        // Local fallback
        const newMontantPaye = facture.montantPaye + payMontant;
        const newReste = Math.max(0, facture.totalTTC - newMontantPaye);
        const newStatut = newReste === 0 ? 'payee' : 'partielle';
        updateFacture(facture.id, {
          montantPaye: newMontantPaye,
          resteAPayer: newReste,
          statut: newStatut,
          paiements: [...facture.paiements, {
            id: `pay-${Date.now()}`,
            montant: payMontant,
            mode: payMode,
            date: new Date(),
            reference: payRef || undefined,
          }],
        });
      }
      toast.success('Paiement enregistré');
      setShowPayModal(false);
    } catch {
      toast.error('Erreur lors de l\'enregistrement');
    } finally {
      setPayLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <button className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-ink-muted)' }} onClick={() => navigate('/facturation')}>
        <ArrowLeft size={15} /> Retour
      </button>

      {/* Actions bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold font-mono" style={{ color: 'var(--color-ink)' }}>{facture.numero}</h1>
          <span className={clsx('badge', statutColor(facture.statut))}>{statutLabel(facture.statut)}</span>
        </div>
        {canEdit && (
          <div className="flex gap-2 flex-wrap">
            <button className="btn-secondary" title="Imprimer"><Printer size={14} /> Imprimer</button>
            <button className="btn-secondary" title="Télécharger PDF"><Download size={14} /> PDF</button>
            {facture.statut === 'brouillon' && (
              <button className="btn-secondary" onClick={handleMarkSent} disabled={statusLoading}>
                <Send size={14} /> {statusLoading ? '…' : 'Marquer envoyée'}
              </button>
            )}
            {['envoyee', 'partielle', 'en_retard'].includes(facture.statut) && (
              <button className="btn-secondary" style={{ color: '#16a34a', borderColor: '#86efac' }} onClick={openPayModal}>
                <CreditCard size={14} /> Enregistrer paiement
              </button>
            )}
            {facture.statut !== 'payee' && facture.statut !== 'annulee' && (
              <button className="btn-primary" onClick={handleMarkPaid} disabled={statusLoading}>
                <CheckCircle size={14} /> {statusLoading ? '…' : 'Marquer payée'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Facture preview */}
      <div className="card p-8 shadow-md">
        {/* Header */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <p className="text-xs font-mono uppercase tracking-widest mb-1" style={{ color: 'var(--color-gold)' }}>Kiosq Commercial</p>
            <p className="text-sm" style={{ color: 'var(--color-ink-muted)' }}>contact@kiosq.com</p>
            <p className="text-sm" style={{ color: 'var(--color-ink-muted)' }}>+221 33 800 00 00</p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold" style={{ color: 'var(--color-gold)', fontFamily: 'var(--font-display)' }}>FACTURE</p>
            <p className="font-mono text-sm mt-1" style={{ color: 'var(--color-ink)' }}>{facture.numero}</p>
          </div>
        </div>

        {/* Client & dates */}
        <div className="grid grid-cols-2 gap-8 mb-8 p-5 rounded-xl" style={{ backgroundColor: 'var(--color-cream)' }}>
          <div>
            <p className="label">Facturer à</p>
            <p className="font-semibold" style={{ color: 'var(--color-ink)' }}>{facture.clientNom}</p>
            {facture.clientEmail && <p className="text-sm" style={{ color: 'var(--color-ink-muted)' }}>{facture.clientEmail}</p>}
            {facture.clientAdresse && <p className="text-sm" style={{ color: 'var(--color-ink-muted)' }}>{facture.clientAdresse}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="label">Date</p>
              <p className="text-sm font-medium" style={{ color: 'var(--color-ink)' }}>{formatDate(facture.dateFacture)}</p>
            </div>
            <div>
              <p className="label">Échéance</p>
              <p className="text-sm font-medium" style={{ color: facture.statut === 'en_retard' ? '#dc2626' : 'var(--color-ink)' }}>
                {formatDate(facture.dateEcheance)}
              </p>
            </div>
          </div>
        </div>

        {/* Lines */}
        <table className="table-auto w-full mb-6">
          <thead>
            <tr>
              <th>Désignation</th>
              <th className="text-right">Qté</th>
              <th className="text-right">P.U.</th>
              <th className="text-right">Remise</th>
              <th className="text-right">TVA</th>
              <th className="text-right">Total HT</th>
            </tr>
          </thead>
          <tbody>
            {facture.lignes.map((l, i) => (
              <tr key={i}>
                <td style={{ color: 'var(--color-ink)' }}>{l.designation}</td>
                <td className="text-right" style={{ color: 'var(--color-ink-muted)' }}>{l.quantite}</td>
                <td className="text-right">{formatPrice(l.prixUnitaire)}</td>
                <td className="text-right">{l.remise > 0 ? `${l.remise}%` : '—'}</td>
                <td className="text-right">{l.tva}%</td>
                <td className="text-right font-medium" style={{ color: 'var(--color-ink)' }}>{formatPrice(l.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex justify-end">
          <div className="w-64 space-y-2">
            <div className="flex justify-between text-sm">
              <span style={{ color: 'var(--color-ink-muted)' }}>Total HT</span>
              <span style={{ color: 'var(--color-ink)' }}>{formatPrice(facture.totalHT)}</span>
            </div>
            {facture.remiseGlobale > 0 && (
              <div className="flex justify-between text-sm">
                <span style={{ color: 'var(--color-ink-muted)' }}>Remise ({facture.remiseGlobale}%)</span>
                <span style={{ color: '#dc2626' }}>- {formatPrice(facture.totalHT * facture.remiseGlobale / 100)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span style={{ color: 'var(--color-ink-muted)' }}>TVA ({facture.tva}%)</span>
              <span style={{ color: 'var(--color-ink)' }}>{formatPrice(facture.totalTTC - facture.totalHT)}</span>
            </div>
            <div className="flex justify-between text-base font-bold pt-2" style={{ borderTop: '2px solid var(--color-gold)', color: 'var(--color-ink)' }}>
              <span>Total TTC</span>
              <span style={{ color: 'var(--color-gold)' }}>{formatPrice(facture.totalTTC)}</span>
            </div>
            {facture.montantPaye > 0 && (
              <div className="flex justify-between text-sm">
                <span style={{ color: '#16a34a' }}>Payé</span>
                <span style={{ color: '#16a34a' }}>- {formatPrice(facture.montantPaye)}</span>
              </div>
            )}
            {facture.resteAPayer > 0 && (
              <div className="flex justify-between text-sm font-bold">
                <span style={{ color: '#d97706' }}>Reste à payer</span>
                <span style={{ color: '#d97706' }}>{formatPrice(facture.resteAPayer)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Payments history */}
        {facture.paiements.length > 0 && (
          <div className="mt-8 pt-6" style={{ borderTop: '1px solid var(--color-cream-dark)' }}>
            <p className="label mb-3">Historique des paiements</p>
            <div className="space-y-2">
              {facture.paiements.map((p) => (
                <div key={p.id} className="flex items-center justify-between px-4 py-2.5 rounded-lg" style={{ backgroundColor: 'var(--color-cream)' }}>
                  <div className="flex items-center gap-3">
                    <CheckCircle size={14} style={{ color: '#16a34a' }} />
                    <div>
                      <p className="text-xs font-medium capitalize" style={{ color: 'var(--color-ink)' }}>
                        {MODES_PAIEMENT.find(m => m.value === p.mode)?.label ?? p.mode}
                      </p>
                      {p.reference && <p className="text-xs" style={{ color: 'var(--color-ink-muted)' }}>Réf: {p.reference}</p>}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold" style={{ color: '#16a34a' }}>{formatPrice(p.montant)}</p>
                    <p className="text-xs" style={{ color: 'var(--color-ink-muted)' }}>{formatDate(p.date)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Payment Modal */}
      {showPayModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
            <div className="px-6 py-5 border-b flex items-center justify-between" style={{ borderColor: 'var(--color-cream-dark)' }}>
              <h3 className="font-semibold text-base" style={{ color: 'var(--color-ink)', fontFamily: 'var(--font-display)' }}>
                Enregistrer un paiement
              </h3>
              <button onClick={() => setShowPayModal(false)} style={{ color: 'var(--color-ink-muted)' }}><X size={18} /></button>
            </div>
            <form onSubmit={handleRegisterPaiement} className="px-6 py-5 space-y-4">
              <div className="p-3 rounded-xl text-center" style={{ backgroundColor: 'var(--color-cream)' }}>
                <p className="text-xs" style={{ color: 'var(--color-ink-muted)' }}>Reste à payer</p>
                <p className="text-xl font-bold" style={{ color: 'var(--color-gold)' }}>{formatPrice(facture.resteAPayer)}</p>
              </div>
              <div>
                <label className="label">Montant (F) *</label>
                <input
                  required
                  type="number"
                  min="1"
                  max={facture.resteAPayer}
                  className="input"
                  value={payMontant || ''}
                  onChange={e => setPayMontant(+e.target.value)}
                  autoFocus
                />
                {payMontant > 0 && payMontant < facture.resteAPayer && (
                  <p className="text-xs mt-1" style={{ color: 'var(--color-ink-muted)' }}>
                    Reste après paiement : {formatPrice(facture.resteAPayer - payMontant)}
                  </p>
                )}
              </div>
              <div>
                <label className="label">Mode de paiement *</label>
                <select required className="input" value={payMode} onChange={e => setPayMode(e.target.value as ModePaiement)}>
                  {MODES_PAIEMENT.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Référence (optionnel)</label>
                <input className="input" placeholder="N° chèque, référence virement…" value={payRef}
                  onChange={e => setPayRef(e.target.value)} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowPayModal(false)} className="btn-secondary flex-1">Annuler</button>
                <button type="submit" disabled={payLoading} className="btn-primary flex-1">
                  {payLoading ? 'Enregistrement…' : 'Confirmer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
