import { useState, useRef, useEffect } from 'react';
import { Search, Package, Check } from 'lucide-react';
import clsx from 'clsx';
import type { Produit } from '@/types';

interface ProductSearchProps {
  produits: Produit[];
  selectedId: string;
  onSelect: (produit: Produit) => void;
  placeholder?: string;
  required?: boolean;
}

export default function ProductSearch({
  produits,
  selectedId,
  onSelect,
  placeholder = 'Rechercher un produit…',
  required = false,
}: ProductSearchProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedProduit = produits.find(p => p.id === selectedId);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = produits
    .filter(
      p =>
        p.designation.toLowerCase().includes(search.toLowerCase()) ||
        p.reference.toLowerCase().includes(search.toLowerCase())
    )
    .slice(0, 10);

  const handleSelect = (p: Produit) => {
    onSelect(p);
    setSearch('');
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={containerRef}>
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
          <Search size={15} />
        </div>
        <input
          ref={inputRef}
          type="text"
          className="input pl-9 pr-10 text-xs"
          placeholder={selectedProduit ? selectedProduit.designation : placeholder}
          value={isOpen ? search : selectedProduit?.designation || ''}
          onChange={e => {
            setSearch(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => {
            setIsOpen(true);
            setSearch('');
          }}
          required={required && !selectedId}
          readOnly={!isOpen && !!selectedId}
        />
        {selectedId && !isOpen && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-amber-600">
            <Check size={16} />
          </div>
        )}
      </div>

      {isOpen && (
        <div className="absolute z-[60] mt-1 w-full bg-white border rounded-xl shadow-2xl max-h-64 overflow-auto animate-in fade-in zoom-in-95 duration-200" style={{ borderColor: 'var(--color-cream-dark)' }}>
          {filtered.length > 0 ? (
            <div className="p-1 space-y-0.5">
              {filtered.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleSelect(p)}
                  className={clsx(
                    'w-full text-left p-2.5 rounded-lg flex items-center gap-3 transition-colors',
                    selectedId === p.id ? 'bg-amber-50 text-amber-900' : 'hover:bg-gray-50'
                  )}
                >
                  <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center text-amber-700 shrink-0">
                    <Package size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-xs truncate">{p.designation}</p>
                    <div className="flex items-center justify-between mt-0.5">
                      <p className="text-[10px] font-mono text-gray-400 uppercase">{p.reference}</p>
                      <p className="text-[10px] font-bold text-amber-700">
                        Stock: {p.stockActuel} {p.unite}
                      </p>
                    </div>
                  </div>
                  {selectedId === p.id && <Check size={14} className="text-amber-600 shrink-0" />}
                </button>
              ))}
            </div>
          ) : (
            <div className="p-4 text-center text-gray-400 text-xs font-medium">
              Aucun produit trouvé
            </div>
          )}
        </div>
      )}
    </div>
  );
}
