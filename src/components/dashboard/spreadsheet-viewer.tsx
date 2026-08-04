// SPDX-License-Identifier: Apache-2.0
'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  Loader2,
  Search,
} from 'lucide-react';

interface SpreadsheetViewerProps {
  src: string;
  name: string;
}

type SpreadsheetRow = Array<string | number | boolean | null | undefined>;

const MAX_ROWS = 500;
const MAX_COLUMNS = 50;
const PAGE_SIZE = 25;

function normalizeCellValue(value: unknown): SpreadsheetRow[number] {
  if (value == null) {
    return null;
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'object') {
    const cellObject = value as {
      result?: unknown;
      text?: unknown;
      richText?: Array<{ text?: unknown }>;
    };

    if ('result' in cellObject) {
      return normalizeCellValue(cellObject.result);
    }

    if (typeof cellObject.text === 'string') {
      return cellObject.text;
    }

    if (Array.isArray(cellObject.richText)) {
      return cellObject.richText
        .map((segment) => (typeof segment.text === 'string' ? segment.text : ''))
        .join('');
    }
  }

  return String(value);
}

export function SpreadsheetViewer({ src, name }: SpreadsheetViewerProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [activeSheet, setActiveSheet] = useState('');
  const [sheetData, setSheetData] = useState<Record<string, SpreadsheetRow[]>>({});
  const [truncated, setTruncated] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        setPage(0);

        const response = await fetch(src);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const buffer = await response.arrayBuffer();
        const ExcelJS = await import('exceljs');
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer);

        const worksheets = workbook.worksheets.slice(0, 10);
        const nextSheetNames = worksheets.map((worksheet) => worksheet.name);
        const nextData: Record<string, SpreadsheetRow[]> = {};
        let didTruncate = false;

        worksheets.forEach((worksheet) => {
          const rows: SpreadsheetRow[] = [];

          worksheet.eachRow({ includeEmpty: false }, (row) => {
            if (rows.length >= MAX_ROWS) {
              didTruncate = true;
              return;
            }

            const values = Array.isArray(row.values) ? row.values.slice(1) : [];
            rows.push(values.map(normalizeCellValue).slice(0, MAX_COLUMNS));
          });

          nextData[worksheet.name] = rows;
        });

        if (cancelled) return;

        setSheetNames(nextSheetNames);
        setSheetData(nextData);
        setActiveSheet(nextSheetNames[0] ?? '');
        setTruncated(didTruncate);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load spreadsheet');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [src]);

  const rows = useMemo(() => {
    return sheetData[activeSheet] ?? [];
  }, [activeSheet, sheetData]);

  const headerRow = rows[0] ?? [];
  const bodyRows = rows.slice(1);

  const filteredRows = useMemo(() => {
    if (!search.trim()) return bodyRows;
    const query = search.trim().toLowerCase();
    return bodyRows.filter((row) =>
      row.some((cell) => String(cell ?? '').toLowerCase().includes(query)),
    );
  }, [bodyRows, search]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pagedRows = filteredRows.slice(
    safePage * PAGE_SIZE,
    safePage * PAGE_SIZE + PAGE_SIZE,
  );

  useEffect(() => {
    setPage(0);
  }, [search, activeSheet]);

  if (loading) {
    return (
      <div className="flex w-full flex-col items-center gap-3 rounded-xl bg-dash-muted px-6 py-12">
        <Loader2 className="h-8 w-8 animate-spin text-dash-text-muted" />
        <p className="text-sm text-dash-text-muted">Loading spreadsheet…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex w-full flex-col items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-6 py-12 dark:border-red-900/40 dark:bg-red-950/30">
        <AlertCircle className="h-8 w-8 text-red-500" />
        <p className="text-center text-sm text-red-600 dark:text-red-300">{error}</p>
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg bg-red-100 px-4 py-2 text-xs font-medium text-red-700 transition hover:bg-red-200 dark:bg-red-900/40 dark:text-red-300"
        >
          <Download className="h-3.5 w-3.5" />
          Download instead
        </a>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col rounded-xl border border-dash-border bg-dash-surface">
      <div className="flex flex-wrap items-center gap-2 border-b border-dash-border px-4 py-3">
        <div className="mr-auto flex min-w-0 items-center gap-2">
          <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
            <FileSpreadsheet className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-dash-text">{name}</p>
            <p className="text-[11px] text-dash-text-muted">
              {rows.length} row{rows.length === 1 ? '' : 's'} loaded
              {truncated ? ' · preview truncated' : ''}
            </p>
          </div>
        </div>

        <label className="flex items-center gap-2 rounded-lg border border-dash-border bg-dash-muted px-3 py-2 text-xs text-dash-text2">
          <Search className="h-3.5 w-3.5 text-dash-text-muted" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search sheet"
            className="w-28 bg-transparent outline-none placeholder:text-dash-text-muted"
          />
        </label>

        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-dash-border px-3 py-2 text-xs font-medium text-dash-text2 transition hover:bg-dash-muted hover:text-dash-text"
        >
          <Download className="h-3.5 w-3.5" />
          Download
        </a>
      </div>

      {sheetNames.length > 1 && (
        <div className="flex gap-2 overflow-x-auto border-b border-dash-border px-4 py-2">
          {sheetNames.map((sheetName) => (
            <button
              key={sheetName}
              onClick={() => setActiveSheet(sheetName)}
              className={`rounded-full px-3 py-1 text-xs transition ${
                activeSheet === sheetName
                  ? 'bg-primary/10 font-semibold text-primary'
                  : 'bg-dash-muted text-dash-text2'
              }`}
            >
              {sheetName}
            </button>
          ))}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-auto">
        <table className="min-w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-dash-surface shadow-sm">
            <tr className="border-b border-dash-border text-left text-xs text-dash-text2">
              {headerRow.map((header, index) => (
                <th key={`${String(header)}-${index}`} className="min-w-32 px-4 py-2 font-medium">
                  {String(header || `Column ${index + 1}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pagedRows.map((row, rowIndex) => (
              <tr key={`${activeSheet}-${rowIndex}`} className="border-b border-dash-border/50 align-top">
                {headerRow.map((_, columnIndex) => (
                  <td key={columnIndex} className="max-w-56 px-4 py-2 text-xs text-dash-text">
                    <div className="line-clamp-3 wrap-break-word">
                      {String(row[columnIndex] ?? '') || '—'}
                    </div>
                  </td>
                ))}
              </tr>
            ))}
            {pagedRows.length === 0 && (
              <tr>
                <td
                  colSpan={Math.max(1, headerRow.length)}
                  className="px-4 py-10 text-center text-sm text-dash-text-muted"
                >
                  No spreadsheet rows match the current filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t border-dash-border px-4 py-3 text-xs text-dash-text-muted">
        <span>
          Page {safePage + 1} of {totalPages}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage((current) => Math.max(0, current - 1))}
            disabled={safePage <= 0}
            className="rounded-lg border border-dash-border p-1.5 transition hover:bg-dash-muted disabled:opacity-40"
            aria-label="Previous page"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setPage((current) => Math.min(totalPages - 1, current + 1))}
            disabled={safePage >= totalPages - 1}
            className="rounded-lg border border-dash-border p-1.5 transition hover:bg-dash-muted disabled:opacity-40"
            aria-label="Next page"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default SpreadsheetViewer;
