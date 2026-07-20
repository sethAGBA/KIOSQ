import { useState } from 'react';
import { X, AlertTriangle, ShieldAlert } from 'lucide-react';

interface Props {
  factureNumero: string;
  onClose: () => void;
  onConfirm: (motif: string) => Promise<void>;
}

export function CancellationModal({ factureNumero, onClose, onConfirm }: Props) {
  const [motif, setMotif] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!motif.trim()) return;

    setLoading(true);
    try {
      await onConfirm(motif.trim());
      onClose();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-ink/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-red-100 animate-in zoom-in-95 duration-200">
        <div className="p-6 border-b border-red-50 flex items-center justify-between bg-red-50/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-600 rounded-xl flex items-center justify-center shadow-lg shadow-red-200">
              <ShieldAlert className="text-white" size={20} />
            </div>
            <div>
              <h3 className="font-display text-xl font-bold text-red-700">Annuler la vente</h3>
              <p className="text-[10px] text-red-500 uppercase tracking-widest font-black">Action Irréversible</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-red-50 rounded-full transition-colors">
            <X size={20} className="text-red-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div className="bg-red-50 p-4 rounded-2xl border border-red-100 flex gap-4">
            <AlertTriangle className="text-red-600 shrink-0" size={24} />
            <p className="text-sm text-red-700 font-medium leading-relaxed">
              Vous êtes sur le point d'annuler la vente <span className="font-black">{factureNumero}</span>.
              Cette action est définitive et sera tracée dans le système. Le stock sera restauré.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] uppercase font-black text-ink-muted tracking-widest pl-1">Motif de l'annulation *</label>
            <textarea
              autoFocus
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              rows={3}
              className="w-full text-base font-medium bg-cream/10 border-2 border-cream-dark rounded-2xl p-4 focus:border-red-500 focus:ring-0 transition-all outline-none text-ink placeholder:text-ink-muted/30"
              placeholder="Ex: Erreur de saisie, Produit non disponible, etc..."
              required
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-4 bg-cream text-ink-muted font-display font-bold rounded-2xl hover:bg-cream-dark transition-all"
            >
              Garder la vente
            </button>
            <button
              type="submit"
              disabled={loading || !motif.trim()}
              className="flex-[2] py-4 bg-red-600 text-white font-display font-black rounded-2xl shadow-xl shadow-red-200 hover:bg-red-700 active:scale-[0.98] transition-all disabled:opacity-50 disabled:active:scale-100"
            >
              {loading ? "Annulation..." : "Confirmer l'annulation"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
