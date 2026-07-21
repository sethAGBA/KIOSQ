import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Printer, ArrowLeft, Search, Plus, Minus, Trash2, Tag } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import JsBarcode from 'jsbarcode';
import { useAppStore } from '@/store/appStore';
import { formatPrice } from '@/lib/format';
import { parametresApi, USE_API } from '@/lib/api';
import type { Produit } from '@/types';

interface LabelItem {
  produitId: string;
  produit: Produit;
  quantite: number;
}

// ── Étiquette individuelle ────────────────────────────────
function BarcodeLabel({ produit, nomEntreprise }: { produit: Produit; nomEntreprise: string }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const barcodeValue = produit.codeBarres || produit.reference;

  useEffect(() => {
    if (svgRef.current) {
      try {
        JsBarcode(svgRef.current, barcodeValue, {
          format: 'CODE128',
          width: 1.5,
          height: 38,
          displayValue: true,
          fontSize: 9,
          margin: 2,
        });
      } catch {
        // Valeur invalide pour CODE128 — on skip
      }
    }
  }, [barcodeValue]);

  return (
    <div
      className="flex flex-col items-center justify-between bg-white border border-gray-300 rounded p-2"
      style={{ width: '62mm', height: '38mm', boxSizing: 'border-box' }}
    >
      {nomEntreprise && (
        <p className="text-[9px] font-black uppercase tracking-wide text-center w-full truncate">
          {nomEntreprise}
        </p>
      )}
      <p className="text-[10px] font-bold text-center line-clamp-2 w-full leading-tight">
        {produit.designation}
      </p>
      <svg ref={svgRef} className="max-w-full" />
      <p className="text-sm font-black">{formatPrice(produit.prixVente)}</p>
    </div>
  );
}

// ── Page principale ───────────────────────────────────────
export default function EtiquettesPage() {
  const { produits } = useAppStore();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [selectedItems, setSelectedItems] = useState<LabelItem[]>([]);
  const [nomEntreprise, setNomEntreprise] = useState('');

  const printRef = useRef<HTMLDivElement>(null);

  // Charger le nom de l'entreprise depuis la config
  useEffect(() => {
    if (USE_API) {
      parametresApi.get()
        .then(data => setNomEntreprise(data.nom ?? ''))
        .catch(() => {});
    } else {
      try {
        const stored = localStorage.getItem('kiosq_config');
        if (stored) setNomEntreprise(JSON.parse(stored).nom ?? '');
      } catch { /* utilise chaîne vide */ }
    }
  }, []);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: 'Etiquettes_Produits',
  });

  const filteredProduits = produits.filter(
    (p) =>
      p.designation.toLowerCase().includes(search.toLowerCase()) ||
      p.reference.toLowerCase().includes(search.toLowerCase()),
  );

  const addItem = (p: Produit) => {
    setSelectedItems((prev) => {
      const existing = prev.find((item) => item.produitId === p.id);
      if (existing) {
        return prev.map((item) =>
          item.produitId === p.id ? { ...item, quantite: item.quantite + 1 } : item,
        );
      }
      return [...prev, { produitId: p.id, produit: p, quantite: 1 }];
    });
  };

  const updateQty = useCallback((id: string, delta: number) => {
    setSelectedItems((prev) =>
      prev.map((item) =>
        item.produitId === id ? { ...item, quantite: Math.max(1, item.quantite + delta) } : item,
      ),
    );
  }, []);

  const setQty = useCallback((id: string, value: string) => {
    const qty = parseInt(value) || 1;
    setSelectedItems((prev) =>
      prev.map((item) =>
        item.produitId === id ? { ...item, quantite: Math.max(1, qty) } : item,
      ),
    );
  }, []);

  const removeItem = useCallback((id: string) => {
    setSelectedItems((prev) => prev.filter((item) => item.produitId !== id));
  }, []);

  const totalEtiquettes = selectedItems.reduce((s, i) => s + i.quantite, 0);

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <button
            onClick={() => navigate('/produits')}
            className="flex items-center gap-1 text-sm mb-2 transition-colors"
            style={{ color: 'var(--color-ink-muted)' }}
          >
            <ArrowLeft size={15} />
            Retour aux produits
          </button>
          <p className="text-[10px] font-mono tracking-widest uppercase mb-1" style={{ color: 'var(--color-ink-muted)' }}>
            Catalogue
          </p>
          <h1 className="text-3xl font-bold" style={{ color: 'var(--color-ink)', fontFamily: 'var(--font-display)' }}>
            Générateur d'Étiquettes
          </h1>
        </div>
        <button
          onClick={() => handlePrint()}
          disabled={selectedItems.length === 0}
          className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Printer size={15} />
          Imprimer{totalEtiquettes > 0 ? ` (${totalEtiquettes})` : ''}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Colonne gauche : Catalogue ── */}
        <div className="card space-y-4 h-fit">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold" style={{ color: 'var(--color-ink)', fontFamily: 'var(--font-display)' }}>
              Catalogue
            </h3>
            <span
              className="text-[10px] font-mono px-2 py-0.5 rounded uppercase"
              style={{ backgroundColor: 'var(--color-cream)', color: 'var(--color-ink-muted)' }}
            >
              {produits.length} réfs
            </span>
          </div>

          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-ink-muted)' }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un produit…"
              className="input pl-9 text-sm"
            />
          </div>

          <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
            {filteredProduits.length === 0 ? (
              <p className="text-center py-8 text-sm" style={{ color: 'var(--color-ink-muted)' }}>
                Aucun produit trouvé
              </p>
            ) : (
              filteredProduits.map((p) => (
                <button
                  key={p.id}
                  onClick={() => addItem(p)}
                  className="w-full text-left p-3 rounded-xl border transition-all group"
                  style={{ borderColor: 'var(--color-cream-dark)' }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-gold)';
                    (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-gold-pale)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-cream-dark)';
                    (e.currentTarget as HTMLElement).style.backgroundColor = '';
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-bold truncate" style={{ color: 'var(--color-ink)' }}>
                        {p.designation}
                      </p>
                      <p className="text-[10px] font-mono" style={{ color: 'var(--color-ink-muted)' }}>
                        {p.reference}
                      </p>
                    </div>
                    <Plus size={14} style={{ color: 'var(--color-ink-muted)', flexShrink: 0 }} />
                  </div>
                  <p className="text-xs font-black mt-1" style={{ color: 'var(--color-gold)' }}>
                    {formatPrice(p.prixVente)}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>

        {/* ── Colonne droite : Sélection ── */}
        <div className="lg:col-span-2 space-y-4">
          <div className="card min-h-[400px]">
            <h3
              className="font-semibold mb-6 flex items-center gap-2"
              style={{ color: 'var(--color-ink)', fontFamily: 'var(--font-display)' }}
            >
              <Tag size={17} style={{ color: 'var(--color-gold)' }} />
              Étiquettes à générer
              {selectedItems.length > 0 && (
                <span className="ml-auto text-xs font-normal" style={{ color: 'var(--color-ink-muted)' }}>
                  {selectedItems.length} produit(s) · {totalEtiquettes} étiquette(s)
                </span>
              )}
            </h3>

            {selectedItems.length === 0 ? (
              <div
                className="flex flex-col items-center justify-center h-56 opacity-30"
                style={{ color: 'var(--color-ink-muted)' }}
              >
                <Tag size={44} className="mb-3" />
                <p className="text-sm">Cliquez sur un produit à gauche pour l'ajouter</p>
              </div>
            ) : (
              <div className="space-y-3">
                {selectedItems.map((item) => (
                  <div
                    key={item.produitId}
                    className="flex items-center gap-4 p-4 rounded-2xl border"
                    style={{ backgroundColor: 'var(--color-cream)', borderColor: 'var(--color-cream-dark)' }}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate" style={{ color: 'var(--color-ink)' }}>
                        {item.produit.designation}
                      </p>
                      <p className="text-[10px] font-mono" style={{ color: 'var(--color-ink-muted)' }}>
                        {item.produit.reference}
                        {item.produit.codeBarres && ` · ${item.produit.codeBarres}`}
                      </p>
                    </div>

                    {/* Contrôle quantité */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateQty(item.produitId, -1)}
                        className="p-1.5 rounded-lg transition-colors"
                        style={{ backgroundColor: 'var(--color-cream-dark)' }}
                      >
                        <Minus size={13} />
                      </button>
                      <input
                        type="number"
                        min="1"
                        value={item.quantite}
                        onChange={(e) => setQty(item.produitId, e.target.value)}
                        className="w-16 text-center text-sm font-black border rounded-lg py-1"
                        style={{ borderColor: 'var(--color-cream-dark)' }}
                      />
                      <button
                        onClick={() => updateQty(item.produitId, 1)}
                        className="p-1.5 rounded-lg transition-colors"
                        style={{ backgroundColor: 'var(--color-cream-dark)' }}
                      >
                        <Plus size={13} />
                      </button>
                    </div>

                    <button
                      onClick={() => removeItem(item.produitId)}
                      className="p-2 rounded-lg transition-colors hover:text-red-500"
                      style={{ color: 'var(--color-ink-muted)' }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Aperçu */}
          {selectedItems.length > 0 && (
            <div className="card">
              <h4 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-ink)' }}>
                Aperçu étiquettes
              </h4>
              <div className="flex flex-wrap gap-3">
                {selectedItems.slice(0, 6).map((item) => (
                  <BarcodeLabel
                    key={item.produitId}
                    produit={item.produit}
                    nomEntreprise={nomEntreprise}
                  />
                ))}
                {selectedItems.length > 6 && (
                  <div
                    className="flex items-center justify-center rounded border text-sm font-medium"
                    style={{
                      width: '62mm',
                      height: '38mm',
                      borderColor: 'var(--color-cream-dark)',
                      color: 'var(--color-ink-muted)',
                      backgroundColor: 'var(--color-cream)',
                    }}
                  >
                    +{selectedItems.length - 6} de plus…
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Zone d'impression masquée ── */}
      <div className="fixed -left-[9999px] top-0 pointer-events-none">
        <div ref={printRef} style={{ padding: '10mm' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4mm' }}>
            {selectedItems.flatMap((item) =>
              Array.from({ length: item.quantite }).map((_, i) => (
                <BarcodeLabel
                  key={`${item.produitId}-${i}`}
                  produit={item.produit}
                  nomEntreprise={nomEntreprise}
                />
              )),
            )}
          </div>
        </div>
      </div>

      {/* Styles impression */}
      <style>{`
        @media print {
          @page { size: A4; margin: 10mm; }
          body * { visibility: hidden; }
          .print-zone, .print-zone * { visibility: visible; }
        }
      `}</style>
    </div>
  );
}
