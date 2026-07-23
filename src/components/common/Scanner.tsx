import { useState } from 'react';
import { X, Camera, Barcode } from 'lucide-react';

interface ScannerProps {
  onScan: (decodedText: string) => void;
  onClose: () => void;
  title?: string;
}

export default function Scanner({
  onScan,
  onClose,
  title = 'Scanner un code-barres',
}: ScannerProps) {
  const [manualCode, setManualCode] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      onScan(manualCode.trim());
      setManualCode('');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white rounded-2xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="p-5 border-b border-gray-200 flex items-center justify-between bg-white text-gray-900">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-700">
              <Camera size={18} />
            </div>
            <h3 className="font-semibold text-sm">{title}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-full transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scanner Body */}
        <div className="p-6 space-y-5">
          <div className="relative bg-gray-900 rounded-xl p-8 text-center text-white space-y-3 overflow-hidden border border-gray-800">
            <div className="w-48 h-28 border-2 border-amber-400/70 rounded-lg mx-auto relative flex items-center justify-center">
              <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-amber-400" />
              <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-amber-400" />
              <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-amber-400" />
              <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-amber-400" />
              <Barcode size={48} className="text-amber-400/80 animate-pulse" />
            </div>
            <p className="text-[11px] text-gray-400 font-mono">
              Pointez votre lecteur optique ou saisissez le code ci-dessous
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <label className="label">Code-barres ou référence produit :</label>
            <div className="flex gap-2">
              <input
                type="text"
                autoFocus
                className="input text-xs font-mono font-semibold uppercase flex-1"
                placeholder="Ex: ELEC-001 ou 3700012345678"
                value={manualCode}
                onChange={e => setManualCode(e.target.value)}
              />
              <button type="submit" className="btn-primary text-xs px-4">
                Valider
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
