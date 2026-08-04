// SPDX-License-Identifier: Apache-2.0
'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Loader2,
  AlertCircle,
  Download,
  Search,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

/* ─── Types ──────────────────────────────────────────────── */

interface CsvViewerProps {
  /** Signed GCS URL */
  src: string;
  /** File name */
  name: string;
}

type SortDirection = 'asc' | 'desc' | null;
interface SortState {
  column: number;
  direction: SortDirection;
}

/** Max rows to parse (prevent memory issues with huge CSVs) */
const MAX_ROWS = 1000;
/** Max content size to fetch (5 MB) */
const MAX_FETCH_SIZE = 5 * 1024 * 1024;
/** Rows per page in paginated view */
const PAGE_SIZE = 50;

/* ─── Component ──────────────────────────────────────────── */

export function CsvViewer({ src, name }: CsvViewerProps) {
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [totalRows, setTotalRows] = useState(0);

  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortState>({ column: -1, direction: null });
  const [page, setPage] = useState(0);
  const tableRef = useRef<HTMLDivElement>(null);

  /* ─── Fetch & Parse ─────────────────────────────────── */
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(src);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const contentLength = Number(res.headers.get('content-length') ?? '0');
        let text: string;

        if (contentLength > MAX_FETCH_SIZE) {
          // Read partial
          const reader = res.body?.getReader();
          if (!reader) throw new Error('No readable body');
          const chunks: Uint8Array[] = [];
          let totalRead = 0;
          while (totalRead < MAX_FETCH_SIZE) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            totalRead += value.length;
          }
          reader.cancel();
          const merged = new Uint8Array(totalRead);
          let offset = 0;
          for (const chunk of chunks) {
            merged.set(chunk, offset);
            offset += chunk.length;
          }
          text = new TextDecoder().decode(merged);
          // Trim to last complete line
          const lastNewline = text.lastIndexOf('\n');
          if (lastNewline > 0) text = text.slice(0, lastNewline);
        } else {
          text = await res.text();
        }

        if (cancelled) return;

        // Dynamic import papaparse to reduce initial bundle
        const Papa = (await import('papaparse')).default;
        const result = Papa.parse<string[]>(text, {
          header: false,
          skipEmptyLines: true,
          preview: MAX_ROWS + 1, // +1 for header
        });

        if (result.errors.length > 0 && result.data.length === 0) {
          throw new Error(result.errors[0].message);
        }

        const allRows = result.data;
        if (allRows.length === 0) {
          throw new Error('CSV file is empty');
        }

        // First row = headers
        const h = allRows[0];
        const dataRows = allRows.slice(1);
        const wasTruncated = dataRows.length >= MAX_ROWS;

        if (!cancelled) {
          setHeaders(h);
          setRows(wasTruncated ? dataRows.slice(0, MAX_ROWS) : dataRows);
          setTruncated(wasTruncated);
          setTotalRows(dataRows.length);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load CSV');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [src]);

  /* ─── Search filter ─────────────────────────────────── */
  const filteredRows = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter((row) =>
      row.some((cell) => cell.toLowerCase().includes(q)),
    );
  }, [rows, search]);

  /* ─── Sort ──────────────────────────────────────────── */
  const sortedRows = useMemo(() => {
    if (sort.column < 0 || !sort.direction) return filteredRows;
    const col = sort.column;
    const dir = sort.direction === 'asc' ? 1 : -1;
    return [...filteredRows].sort((a, b) => {
      const va = a[col] ?? '';
      const vb = b[col] ?? '';
      // Try numeric comparison first
      const na = Number(va);
      const nb = Number(vb);
      if (!isNaN(na) && !isNaN(nb)) return (na - nb) * dir;
      return va.localeCompare(vb) * dir;
    });
  }, [filteredRows, sort]);

  /* ─── Pagination ────────────────────────────────────── */
  const totalPages = Math.ceil(sortedRows.length / PAGE_SIZE);
  const pageRows = sortedRows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Reset page when search or sort changes
  useEffect(() => {
    setPage(0);
  }, [search, sort]);

  /* ─── Sort handler ──────────────────────────────────── */
  const handleSort = useCallback((colIdx: number) => {
    setSort((prev) => {
      if (prev.column === colIdx) {
        if (prev.direction === 'asc')
          return { column: colIdx, direction: 'desc' };
        if (prev.direction === 'desc') return { column: -1, direction: null };
      }
      return { column: colIdx, direction: 'asc' };
    });
  }, []);

  /* ─── Loading state ─────────────────────────────────── */
  if (loading) {
    return (
      <div className="flex w-full flex-col items-center gap-3 rounded-xl bg-dash-muted py-10">
        <Loader2 className="h-8 w-8 animate-spin text-dash-text-muted" />
        <p className="text-xs text-dash-text-muted">Parsing CSV…</p>
      </div>
    );
  }

  /* ─── Error state ───────────────────────────────────── */
  if (error) {
    return (
      <div className="flex w-full flex-col items-center gap-3 rounded-xl bg-red-50 py-8 dark:bg-red-950/30">
        <AlertCircle className="h-10 w-10 text-red-400" />
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-red-100 px-4 py-2 text-xs font-medium text-red-700 transition hover:bg-red-200 dark:bg-red-900/40 dark:text-red-300"
        >
          <Download className="h-3.5 w-3.5" />
          Download instead
        </a>
      </div>
    );
  }

  /* ─── Render ────────────────────────────────────────── */
  return (
    <div className="flex w-full flex-col gap-2">
      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-dash-text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search rows…"
            className="h-8 w-full rounded-lg border border-dash-border bg-dash-surface pl-8 pr-3 text-xs text-dash-text placeholder:text-dash-text-muted outline-none focus:border-primary"
          />
        </div>
        <span className="shrink-0 text-[11px] tabular-nums text-dash-text-muted">
          {filteredRows.length.toLocaleString()} row
          {filteredRows.length !== 1 ? 's' : ''}
          {truncated && (
            <span
              className="ml-1 text-amber-500"
              title={`Showing first ${MAX_ROWS.toLocaleString()} rows`}
            >
              (truncated)
            </span>
          )}
        </span>
      </div>

      {/* Table */}
      <div
        ref={tableRef}
        className="max-h-72 overflow-auto rounded-lg border border-dash-border"
      >
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 z-10 bg-dash-surface border-b border-dash-border">
            <tr>
              <th className="w-10 px-2 py-2 text-center text-[10px] font-semibold text-dash-text-muted">
                #
              </th>
              {headers.map((h, i) => (
                <th
                  key={i}
                  onClick={() => handleSort(i)}
                  className="cursor-pointer select-none whitespace-nowrap px-3 py-2 font-semibold text-dash-text transition hover:bg-dash-surface-hover"
                >
                  <span className="inline-flex items-center gap-1">
                    {h || `Column ${i + 1}`}
                    {sort.column === i && sort.direction === 'asc' && (
                      <ArrowUp className="h-3 w-3 text-primary" />
                    )}
                    {sort.column === i && sort.direction === 'desc' && (
                      <ArrowDown className="h-3 w-3 text-primary" />
                    )}
                    {sort.column !== i && (
                      <ArrowUpDown className="h-3 w-3 text-dash-text-muted opacity-0 transition group-hover:opacity-100" />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-dash-border">
            {pageRows.length === 0 ? (
              <tr>
                <td
                  colSpan={headers.length + 1}
                  className="px-3 py-6 text-center text-dash-text-muted"
                >
                  {search ? 'No matching rows' : 'No data'}
                </td>
              </tr>
            ) : (
              pageRows.map((row, ri) => (
                <tr
                  key={page * PAGE_SIZE + ri}
                  className="transition hover:bg-dash-surface-hover"
                >
                  <td className="px-2 py-1.5 text-center text-[10px] tabular-nums text-dash-text-muted">
                    {page * PAGE_SIZE + ri + 1}
                  </td>
                  {headers.map((_, ci) => (
                    <td
                      key={ci}
                      className="max-w-[200px] truncate px-3 py-1.5 text-dash-text"
                      title={row[ci] ?? ''}
                    >
                      {row[ci] ?? ''}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-1">
          <span className="text-[11px] tabular-nums text-dash-text-muted">
            Page {page + 1} of {totalPages}
          </span>
          <div className="flex gap-1">
            <button
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
              className="rounded p-1 text-dash-text-muted transition hover:bg-dash-surface-hover disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
              className="rounded p-1 text-dash-text-muted transition hover:bg-dash-surface-hover disabled:opacity-30"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* File name */}
      <p className="max-w-full truncate text-center text-[11px] font-medium text-dash-text2">
        {name}
      </p>
    </div>
  );
}

export default CsvViewer;
