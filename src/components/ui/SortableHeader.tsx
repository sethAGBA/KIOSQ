import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import type { SortState } from '@/hooks/useTableControls';

interface SortableHeaderProps {
  column: string;
  label: string;
  sort: SortState;
  onSort: (column: string) => void;
  className?: string;
  align?: 'left' | 'right' | 'center';
}

export function SortableHeader({ column, label, sort, onSort, className = '', align = 'left' }: SortableHeaderProps) {
  const isActive = sort.column === column;
  const direction = isActive ? sort.direction : null;

  return (
    <th
      className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider cursor-pointer select-none whitespace-nowrap transition-colors hover:bg-black/5 ${className}`}
      style={{
        color: isActive ? 'var(--color-gold)' : 'var(--color-ink-muted)',
        textAlign: align,
      }}
      onClick={() => onSort(column)}
    >
      <span className={`inline-flex items-center gap-1 ${align === 'right' ? 'flex-row-reverse' : ''}`}>
        {label}
        <span className="opacity-60">
          {direction === 'asc'
            ? <ArrowUp size={11} />
            : direction === 'desc'
            ? <ArrowDown size={11} />
            : <ArrowUpDown size={11} className="opacity-40" />}
        </span>
      </span>
    </th>
  );
}
