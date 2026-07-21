import { CheckCircle, Receipt, RotateCcw } from 'lucide-react';
import { formatPrice } from '@/lib/format';
import type { Facture } from '@/types';

interface SaleSuccessModalProps {
  facture: Facture;
  montantRecu?: number;
  onNouvelleVente: () => void;
  onVoirTicket: () => void;
}

export function SaleSuccessModal({ facture, montantRecu, onNouvelleVente, onVoirTicket }: SaleSuccessModalProps) {
  const paiement = facture.paiements?.[0];
  const modeLabel: Record<string, string> = {
    especes: 'Espèces', virement: 'Virement', cheque: 'Chèque',
    mobile_money: 'Mobile Money', carte: 'Carte', autre: 'Autre',
  };
  const actualRecu = montantRecu || (paiement?.montant ?? facture.montantPaye);
  const rendu = paiement?.mode === 'especes' && actualRecu > facture.totalTTC
    ? actualRecu - facture.totalTTC : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
        style={{ border: '1px solid #bbf7d0' }}
      >
        {/* ── En-tête verte ── */}
        <div className="flex flex-col items-center justify-center pt-10 pb-6 px-8 gap-4"
          style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)' }}
        >
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center shadow-lg"
            style={{ backgroundColor: '#22c55e' }}
          >
            <CheckCircle size={40} color="white" strokeWidth={2.5} />
          </div>
          <div className="text-center">
            <p className="text-xs font-mono uppercase tracking-widest mb-1" style={{ color: '#16a34a' }}>
              Vente enregistrée
            </p>
            <h2 className="text-2xl font-bold" style={{ color: '#14532d', fontFamily: 'var(--font-display)' }}>
              Encaissement réussi !
            </h2>
            <p className="text-sm mt-1" style={{ color: '#15803d' }}>
              Le stock a été mis à jour automatiquement.
            </p>
          </div>
        </div>

        {/* ── Récap rapide ── */}
        <div className="px-8 py-5 space-y-2.5" style={{ backgroundColor: 'var(--color-cream)' }}>
          <div className="flex justify-between text-sm">
            <span style={{ color: 'var(--color-ink-muted)' }}>Ticket</span>
            <span className="font-mono font-bold" style={{ color: 'var(--color-ink)' }}>
              {facture.numero}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span style={{ color: 'var(--color-ink-muted)' }}>Client</span>
            <span style={{ color: 'var(--color-ink)' }}>{facture.clientNom}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span style={{ color: 'var(--color-ink-muted)' }}>Mode</span>
            <span
              className="px-2 py-0.5 rounded text-[10px] uppercase font-bold"
              style={{
                backgroundColor: paiement?.mode === 'especes' ? '#dcfce7' :
                  paiement?.mode === 'mobile_money' ? '#dbeafe' : '#f3f4f6',
                color: paiement?.mode === 'especes' ? '#16a34a' :
                  paiement?.mode === 'mobile_money' ? '#1d4ed8' : '#374151',
              }}
            >
              {modeLabel[paiement?.mode ?? ''] ?? '—'}
            </span>
          </div>
          {paiement?.mode === 'especes' && actualRecu > 0 && (
            <div className="flex justify-between text-sm" style={{ color: 'var(--color-ink-muted)' }}>
              <span>Montant reçu</span>
              <span className="font-semibold" style={{ color: 'var(--color-ink)' }}>{formatPrice(actualRecu)}</span>
            </div>
          )}
          <div
            className="flex justify-between text-base font-bold pt-2 mt-1"
            style={{ borderTop: '1px solid var(--color-cream-dark)', color: 'var(--color-ink)' }}
          >
            <span>Total encaissé</span>
            <span style={{ color: 'var(--color-gold)' }}>{formatPrice(facture.totalTTC)}</span>
          </div>
          {rendu > 0 && (
            <div
              className="flex justify-between text-lg font-bold px-4 py-3 rounded-xl mt-1"
              style={{ backgroundColor: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0' }}
            >
              <span>🪙 Monnaie à rendre</span>
              <span className="text-xl">{formatPrice(rendu)}</span>
            </div>
          )}
          {facture.resteAPayer > 0 && (
            <div
              className="flex justify-between text-sm font-bold px-3 py-2 rounded-xl"
              style={{ backgroundColor: '#fef2f2', color: '#dc2626' }}
            >
              <span>⚠️ Reste à payer (crédit)</span>
              <span>{formatPrice(facture.resteAPayer)}</span>
            </div>
          )}
        </div>

        {/* ── Actions ── */}
        <div className="px-8 py-6 flex gap-3 bg-white">
          <button
            onClick={onVoirTicket}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all btn-secondary"
          >
            <Receipt size={16} /> Voir le ticket
          </button>
          <button
            onClick={onNouvelleVente}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm text-white transition-all btn-primary"
          >
            <RotateCcw size={16} /> Nouvelle vente
          </button>
        </div>
      </div>
    </div>
  );
}
