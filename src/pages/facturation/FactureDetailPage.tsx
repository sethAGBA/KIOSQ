import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Send, CheckCircle, Printer } from 'lucide-react';
import clsx from 'clsx';
import { useAppStore } from '@/store/appStore';
import { formatPrice, formatDate, statutColor, statutLabel } from '@/lib/format';

export default function FactureDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { factures, updateFacture } = useAppStore();

  const facture = factures.find((f) => f.id === id);
  if (!facture) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <p style={{ color: 'var(--color-ink-muted)' }}>Facture introuvable.</p>
      <button className="btn-secondary" onClick={() => navigate('/facturation')}>Retour</button>
    </div>
  );

  const handleMarkPaid = () => {
    updateFacture(facture.id, { statut: 'payee', montantPaye: facture.totalTTC, resteAPayer: 0 });
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <button className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-ink-muted)' }} onClick={() => navigate('/facturation')}>
        <ArrowLeft size={15} /> Retour
      </button>

      {/* Actions bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold font-mono" style={{ color: 'var(--color-ink)' }}>{facture.numero}</h1>
          <span className={clsx('badge', statutColor(facture.statut))}>{statutLabel(facture.statut)}</span>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary"><Printer size={14} /> Imprimer</button>
          <button className="btn-secondary"><Download size={14} /> PDF</button>
          {facture.statut !== 'payee' && (
            <>
              <button className="btn-secondary"><Send size={14} /> Envoyer</button>
              <button className="btn-primary" onClick={handleMarkPaid}><CheckCircle size={14} /> Marquer payée</button>
            </>
          )}
        </div>
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
                      <p className="text-xs font-medium" style={{ color: 'var(--color-ink)' }}>{p.mode.replace('_', ' ')}</p>
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
    </div>
  );
}
