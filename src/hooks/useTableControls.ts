import { useState, useMemo } from 'react';

export type SortDirection = 'asc' | 'desc' | null;

export interface SortState {
  column: string | null;
  direction: SortDirection;
}

export interface TableControls<T> {
  // Sorting
  sort: SortState;
  setSort: (column: string) => void;
  // Pagination
  page: number;
  setPage: (p: number) => void;
  pageSize: number;
  setPageSize: (s: number) => void;
  totalPages: number;
  totalItems: number;
  // Processed data
  paginatedData: T[];
}

function getNestedValue(obj: any, key: string): any {
  return key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

function compareValues(a: any, b: any): number {
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  if (typeof a === 'string' && typeof b === 'string') {
    return a.toLowerCase().localeCompare(b.toLowerCase(), 'fr');
  }
  if (a instanceof Date && b instanceof Date) {
    return a.getTime() - b.getTime();
  }
  if (typeof a === 'string' && !isNaN(Number(a))) {
    return Number(a) - Number(b);
  }
  return a < b ? -1 : a > b ? 1 : 0;
}

export function useTableControls<T>(
  data: T[],
  options?: { defaultSort?: string; defaultDirection?: SortDirection; defaultPageSize?: number }
): TableControls<T> {
  const [sort, setSortState] = useState<SortState>({
    column: options?.defaultSort ?? null,
    direction: options?.defaultDirection ?? null,
  });
  const [page, setPageState] = useState(1);
  const [pageSize, setPageSizeState] = useState(options?.defaultPageSize ?? 20);

  const setSort = (column: string) => {
    setSortState(prev => {
      if (prev.column !== column) return { column, direction: 'asc' };
      if (prev.direction === 'asc') return { column, direction: 'desc' };
      return { column: null, direction: null }; // third click = reset
    });
    setPageState(1);
  };

  const setPage = (p: number) => setPageState(p);
  const setPageSize = (s: number) => { setPageSizeState(s); setPageState(1); };

  const sortedData = useMemo(() => {
    if (!sort.column || !sort.direction) return data;
    return [...data].sort((a, b) => {
      const va = getNestedValue(a, sort.column!);
      const vb = getNestedValue(b, sort.column!);
      const cmp = compareValues(va, vb);
      return sort.direction === 'asc' ? cmp : -cmp;
    });
  }, [data, sort]);

  const totalItems = sortedData.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(page, totalPages);

  const paginatedData = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, safePage, pageSize]);

  return {
    sort,
    setSort,
    page: safePage,
    setPage,
    pageSize,
    setPageSize,
    totalPages,
    totalItems,
    paginatedData,
  };
}
