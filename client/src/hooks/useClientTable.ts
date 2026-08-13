import { useMemo, useState } from 'react';

export type SortDir = 'asc' | 'desc';

function readPath(row: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc == null || typeof acc !== 'object') return undefined;
    return (acc as Record<string, unknown>)[key];
  }, row);
}

function compareValues(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;

  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b);

  return String(a).localeCompare(String(b), undefined, {
    numeric: true,
    sensitivity: 'base',
  });
}

export interface UseClientTableOptions<T> {
  data: T[];
  /** Dot-paths used for search (OR match). */
  searchKeys?: string[];
  /** Custom search text builder (overrides searchKeys when provided). */
  getSearchText?: (row: T) => string;
  /** Dot-path → value for sorting; falls back to path read. */
  getSortValue?: (row: T, key: string) => unknown;
  initialSortKey?: string;
  initialSortDir?: SortDir;
  pageSize?: number;
  pageSizeOptions?: number[];
}

export function useClientTable<T>({
  data,
  searchKeys = [],
  getSearchText,
  getSortValue,
  initialSortKey,
  initialSortDir = 'asc',
  pageSize: initialPageSize = 10,
  pageSizeOptions = [5, 10, 20, 50],
}: UseClientTableOptions<T>) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<string | undefined>(initialSortKey);
  const [sortDir, setSortDir] = useState<SortDir>(initialSortDir);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  function setSearchAndReset(value: string) {
    setSearch(value);
    setPage(1);
  }

  function toggleSort(key: string) {
    if (sortKey === key) {
      setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setPage(1);
  }

  function changePageSize(size: number) {
    setPageSize(size);
    setPage(1);
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data;

    return data.filter((row) => {
      const text = getSearchText
        ? getSearchText(row)
        : searchKeys.map((key) => String(readPath(row, key) ?? '')).join(' ');
      return text.toLowerCase().includes(q);
    });
  }, [data, search, searchKeys, getSearchText]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const copy = [...filtered];
    copy.sort((left, right) => {
      const a =
        (getSortValue ? getSortValue(left, sortKey) : undefined) ?? readPath(left, sortKey);
      const b =
        (getSortValue ? getSortValue(right, sortKey) : undefined) ?? readPath(right, sortKey);
      const result = compareValues(a, b);
      return sortDir === 'asc' ? result : -result;
    });
    return copy;
  }, [filtered, sortKey, sortDir, getSortValue]);

  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);

  const rows = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, safePage, pageSize]);

  return {
    search,
    setSearch: setSearchAndReset,
    sortKey,
    sortDir,
    toggleSort,
    page: safePage,
    setPage,
    pageSize,
    setPageSize: changePageSize,
    pageSizeOptions,
    rows,
    filteredTotal: total,
    totalAll: data.length,
    totalPages,
    from: total === 0 ? 0 : (safePage - 1) * pageSize + 1,
    to: Math.min(safePage * pageSize, total),
  };
}
