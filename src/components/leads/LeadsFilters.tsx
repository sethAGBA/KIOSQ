import { useState, useEffect, useRef } from 'react';
import { Search } from 'lucide-react';
import type { LeadsFilters } from '@/store/leadsStore';
import type { StatutLead } from '@/types';

interface LeadsFiltersProps {
  filters: LeadsFilters;
  onChange: (filters: Partial<LeadsFilters>) => void;
}

export default function LeadsFilters({ filters, onChange }: LeadsFiltersProps) {
  const [inputProduit, setInputProduit] = useState(filters.produit ?? '');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce produit search — 300ms
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onChange({ produit: inputProduit || undefined });
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [inputProduit]);

  const STATUTS: { value: StatutLead | ''; label: string }[] = [
    { value: '', label: 'Tous les statuts' },
    { value: 'nouveau', label: 'Nouveau' },
    { value: 'envoye',  label: 'Envoyé' },
    { value: 'ignore',  label: 'Ignoré' },
  ];

  return (
    <div className="flex flex-wrap items-center gap-3 mb-4">
      {/* Filtre statut */}
      <select
        value={filters.statut ?? ''}
        onChange={e => onChange({ statut: (e.target.value as StatutLead) || undefined })}
        className="input w-auto"
        style={{ minWidth: '160px' }}
      >
        {STATUTS.map(s => (
          <option key={s.value} value={s.value}>{s.label}</option>
        ))}
      </select>

      {/* Recherche produit */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-ink-muted)' }} />
        <input
          type="text"
          placeholder="Rechercher un produit…"
          value={inputProduit}
          onChange={e => setInputProduit(e.target.value)}
          className="input pl-8"
          style={{ minWidth: '220px' }}
        />
      </div>

      {/* Score minimum */}
      <div className="flex items-center gap-2">
        <span className="label mb-0" style={{ whiteSpace: 'nowrap' }}>Score min.</span>
        <input
          type="range"
          min={0} max={1} step={0.05}
          value={filters.score_min ?? 0}
          onChange={e => onChange({ score_min: Number(e.target.value) || undefined })}
          style={{ width: '100px', accentColor: 'var(--color-gold)' }}
        />
        <span className="text-xs font-mono" style={{ color: 'var(--color-ink-muted)', minWidth: '36px' }}>
          {filters.score_min ? `${Math.round((filters.score_min) * 100)}%` : 'Tous'}
        </span>
      </div>
    </div>
  );
}
