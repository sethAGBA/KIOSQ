import { useState, useRef, useEffect, useId } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  sub?: string; // optional subtitle shown in grey
}

interface SearchableSelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  emptyLabel?: string;   // label shown when value is ''
  required?: boolean;
  disabled?: boolean;
  className?: string;
  id?: string;
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Rechercher…',
  emptyLabel = '— Aucun —',
  required = false,
  disabled = false,
  className = '',
  id,
}: SearchableSelectProps) {
  const uid = useId();
  const finalId = id ?? uid;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlighted, setHighlighted] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selected = options.find(o => o.value === value);

  const filtered = query.trim()
    ? options.filter(o =>
        o.label.toLowerCase().includes(query.toLowerCase()) ||
        o.sub?.toLowerCase().includes(query.toLowerCase())
      )
    : options;

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setHighlighted(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  // Scroll highlighted item into view
  useEffect(() => {
    const li = listRef.current?.children[highlighted] as HTMLElement | undefined;
    li?.scrollIntoView({ block: 'nearest' });
  }, [highlighted]);

  const choose = (val: string) => {
    onChange(val);
    setOpen(false);
    setQuery('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted(h => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted(h => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[highlighted]) choose(filtered[highlighted].value);
    } else if (e.key === 'Escape') {
      setOpen(false);
      setQuery('');
    }
  };

  return (
    <div ref={containerRef} className={`relative ${className}`} id={finalId}>
      {/* Trigger button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(o => !o)}
        className="input w-full flex items-center justify-between gap-2 text-left cursor-pointer"
        style={{ paddingRight: '2rem' }}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="truncate" style={{ color: selected ? 'var(--color-ink)' : 'var(--color-ink-muted)' }}>
          {selected ? selected.label : emptyLabel}
        </span>
        {value && !required && (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); choose(''); }}
            className="ml-auto shrink-0"
            style={{ color: 'var(--color-ink-muted)' }}
            tabIndex={-1}
          >
            <X size={13} />
          </button>
        )}
        <ChevronDown
          size={14}
          className="shrink-0 transition-transform duration-150"
          style={{
            color: 'var(--color-ink-muted)',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        />
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          className="absolute z-50 w-full mt-1 rounded-xl shadow-xl overflow-hidden"
          style={{
            background: 'white',
            border: '1px solid var(--color-cream-dark)',
            minWidth: '14rem',
          }}
        >
          {/* Search input */}
          <div className="p-2 border-b" style={{ borderColor: 'var(--color-cream-dark)' }}>
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-ink-muted)' }} />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={e => { setQuery(e.target.value); setHighlighted(0); }}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                className="input pl-8 py-1.5 text-sm w-full"
                style={{ fontSize: '0.8125rem' }}
              />
            </div>
          </div>

          {/* Options list */}
          <ul
            ref={listRef}
            role="listbox"
            className="overflow-y-auto"
            style={{ maxHeight: '13rem' }}
          >
            {!required && (
              <li
                role="option"
                aria-selected={value === ''}
                onClick={() => choose('')}
                onMouseEnter={() => setHighlighted(-1)}
                className="px-3 py-2 cursor-pointer text-sm"
                style={{
                  color: 'var(--color-ink-muted)',
                  background: highlighted === -1 ? 'var(--color-cream)' : 'transparent',
                }}
              >
                {emptyLabel}
              </li>
            )}
            {filtered.length === 0 ? (
              <li className="px-3 py-3 text-center text-sm" style={{ color: 'var(--color-ink-muted)' }}>
                Aucun résultat
              </li>
            ) : (
              filtered.map((opt, i) => (
                <li
                  key={opt.value}
                  role="option"
                  aria-selected={opt.value === value}
                  onClick={() => choose(opt.value)}
                  onMouseEnter={() => setHighlighted(i)}
                  className="px-3 py-2 cursor-pointer"
                  style={{
                    background: i === highlighted
                      ? 'var(--color-cream)'
                      : opt.value === value
                      ? 'var(--color-gold-pale)'
                      : 'transparent',
                  }}
                >
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--color-ink)' }}>{opt.label}</p>
                  {opt.sub && <p className="text-xs truncate" style={{ color: 'var(--color-ink-muted)' }}>{opt.sub}</p>}
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
