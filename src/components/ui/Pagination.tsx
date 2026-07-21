import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface PaginationProps {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
}

export function Pagination({
  page,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100],
}: PaginationProps) {
  if (totalItems === 0) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalItems);

  // Generate visible page numbers
  const getPages = () => {
    const pages: (number | '...')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (page > 3) pages.push('...');
      for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) {
        pages.push(i);
      }
      if (page < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  const btnBase = 'inline-flex items-center justify-center w-8 h-8 rounded-lg text-sm font-medium transition-all';
  const btnActive = 'text-white';
  const btnInactive = 'hover:bg-black/5';
  const btnDisabled = 'opacity-30 cursor-not-allowed';

  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3 border-t flex-wrap" style={{ borderColor: 'var(--color-cream-dark)' }}>
      {/* Left: count + page size */}
      <div className="flex items-center gap-3">
        <span className="text-xs" style={{ color: 'var(--color-ink-muted)' }}>
          {from}–{to} sur {totalItems} résultat{totalItems > 1 ? 's' : ''}
        </span>
        {onPageSizeChange && (
          <select
            value={pageSize}
            onChange={e => onPageSizeChange(Number(e.target.value))}
            className="text-xs border rounded-lg px-2 py-1"
            style={{
              borderColor: 'var(--color-cream-dark)',
              color: 'var(--color-ink)',
              background: 'white',
            }}
          >
            {pageSizeOptions.map(s => (
              <option key={s} value={s}>{s} / page</option>
            ))}
          </select>
        )}
      </div>

      {/* Right: page buttons */}
      <div className="flex items-center gap-1">
        {/* First page */}
        <button
          onClick={() => onPageChange(1)}
          disabled={page === 1}
          className={`${btnBase} ${page === 1 ? btnDisabled : btnInactive}`}
          style={{ color: 'var(--color-ink-muted)' }}
          title="Première page"
        >
          <ChevronsLeft size={14} />
        </button>
        {/* Prev */}
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className={`${btnBase} ${page === 1 ? btnDisabled : btnInactive}`}
          style={{ color: 'var(--color-ink-muted)' }}
          title="Page précédente"
        >
          <ChevronLeft size={14} />
        </button>

        {/* Page numbers */}
        {getPages().map((p, i) =>
          p === '...' ? (
            <span key={`ellipsis-${i}`} className="text-xs px-1" style={{ color: 'var(--color-ink-muted)' }}>…</span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p as number)}
              className={`${btnBase} ${p === page ? btnActive : btnInactive}`}
              style={p === page
                ? { background: 'var(--color-gold)', color: 'white' }
                : { color: 'var(--color-ink)' }
              }
            >
              {p}
            </button>
          )
        )}

        {/* Next */}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          className={`${btnBase} ${page === totalPages ? btnDisabled : btnInactive}`}
          style={{ color: 'var(--color-ink-muted)' }}
          title="Page suivante"
        >
          <ChevronRight size={14} />
        </button>
        {/* Last page */}
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={page === totalPages}
          className={`${btnBase} ${page === totalPages ? btnDisabled : btnInactive}`}
          style={{ color: 'var(--color-ink-muted)' }}
          title="Dernière page"
        >
          <ChevronsRight size={14} />
        </button>
      </div>
    </div>
  );
}
