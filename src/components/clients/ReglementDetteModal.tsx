import { useState } from 'react';
import { X, Check } from 'lucide-react';
import type { Client } from '@/types';

interface Props {
  client: Client;
  onClose: () => void;
  onSubmit: (montant: number, modePaiement: string) => Promise<void>;
}

export default function ReglementDetteModal({ client, onClose, onSubmit }: Props) {
  const [montant, setMontant] = useState(client.soldeCredit);
  const [mode, setMode] = useState('especes');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (montant <= 0 || montant > client.soldeCredit) return;
    
    setLoading(true);
    try {
      await onSubmit(montant, mode);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between px-6 py-5 border-b" style={{ borderColor: 'var(--color-cream-dark)' }}>
          <h3 className="font-semibold" style={{ color: 'var(--color-ink)', fontFamily: 'var(--font-display)' }}>
            Régler dette - {client.nom}
          </h3>
          <button onClick={onClose} style={{ color: 'var(--color-ink-muted)' }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="label">Montant à régler (Max: {client.soldeCredit} F)</label>
            <input 
              type="number" 
              className="input font-bold" 
              value={montant}
              onChange={e => setMontant(+e.target.value)}
              min={1}
              max={client.soldeCredit}
              required
            />
          </div>

          <div>
            <label className="label">Mode de paiement</label>
            <select className="input" value={mode} onChange={e => setMode(e.target.value)}>
              <option value="especes">Espèces</option>
              <option value="mobile_money">Mobile Money</option>
              <option value="virement">Virement</option>
              <option value="cheque">Chèque</option>
              <option value="carte">Carte Bancaire</option>
            </select>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              Annuler
            </button>
            <button 
              type="submit" 
              disabled={loading || montant <= 0 || montant > client.soldeCredit} 
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              {loading ? 'Traitement...' : <><Check size={16} /> Confirmer</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
