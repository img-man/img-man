// SPDX-License-Identifier: Apache-2.0
'use client';

/**
 * PDF Organize Tool
 * Reorder, remove, or rearrange pages in a PDF.
 * Entirely client-side via pdf-lib.
 */

import { useState, useCallback, useRef } from 'react';
import {
  X,
  Upload,
  Download,
  Loader2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  Library,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { ToolOutputActions } from '@/components/dashboard/ToolOutputActions';

const AssetPicker = dynamic(
  () => import('@/components/dashboard/asset-picker'),
  { ssr: false },
);

interface OrganizeState {
  file: File | null;
  fileName: string;
  totalPages: number;
  pages: number[];
  processing: boolean;
  error: string | null;
  resultBlob: Blob | null;
  resultName: string;
}

export default function PdfOrganizeModal({ onClose }: { onClose: () => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [state, setState] = useState<OrganizeState>({
    file: null,
    fileName: '',
    totalPages: 0,
    pages: [],
    processing: false,
    error: null,
    resultBlob: null,
    resultName: '',
  });

  /* ── Load & validate PDF ─────────────────────────────────── */

  const loadPdf = useCallback(async (file: File) => {
    if (file.type !== 'application/pdf') return;
    try {
      const { PDFDocument } = await import('pdf-lib');
      const bytes = await file.arrayBuffer();
      const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const count = doc.getPageCount();
      setState((s) => ({
        ...s,
        file,
        fileName: file.name,
        totalPages: count,
        pages: Array.from({ length: count }, (_, i) => i),
        error: null,
      }));
    } catch {
      setState((s) => ({ ...s, error: 'Failed to read PDF.' }));
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) loadPdf(file);
    },
    [loadPdf],
  );

  /* ── Page manipulation helpers ───────────────────────────── */

  const moveUp = useCallback((index: number) => {
    if (index <= 0) return;
    setState((s) => {
      const next = [...s.pages];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return { ...s, pages: next };
    });
  }, []);

  const moveDown = useCallback((index: number) => {
    setState((s) => {
      if (index >= s.pages.length - 1) return s;
      const next = [...s.pages];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return { ...s, pages: next };
    });
  }, []);

  const removePage = useCallback((index: number) => {
    setState((s) => {
      if (s.pages.length <= 1) return s;
      const next = [...s.pages];
      next.splice(index, 1);
      return { ...s, pages: next };
    });
  }, []);

  const resetPages = useCallback(() => {
    setState((s) => ({
      ...s,
      pages: Array.from({ length: s.totalPages }, (_, i) => i),
    }));
  }, []);

  /* ── Save & Download ─────────────────────────────────────── */

  const handleSave = useCallback(async () => {
    if (!state.file || state.pages.length === 0) return;
    setState((s) => ({ ...s, processing: true, error: null }));
    try {
      const { PDFDocument } = await import('pdf-lib');
      const srcBytes = await state.file.arrayBuffer();
      const srcDoc = await PDFDocument.load(srcBytes, {
        ignoreEncryption: true,
      });
      const newDoc = await PDFDocument.create();
      const copiedPages = await newDoc.copyPages(srcDoc, state.pages);
      copiedPages.forEach((page) => newDoc.addPage(page));
      const pdfBytes = await newDoc.save();

      const blob = new Blob([pdfBytes as unknown as BlobPart], {
        type: 'application/pdf',
      });
      const baseName = state.fileName.replace(/\.pdf$/i, '');
      setState((s) => ({
        ...s,
        resultBlob: blob,
        resultName: `${baseName}_organized.pdf`,
      }));
    } catch (err) {
      setState((s) => ({
        ...s,
        error: `Failed to save PDF: ${err instanceof Error ? err.message : 'Unknown error'}`,
      }));
    } finally {
      setState((s) => ({ ...s, processing: false }));
    }
  }, [state]);

  /* ── Render ──────────────────────────────────────────────── */

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div
        className="relative w-full max-w-2xl rounded-2xl border border-dash-border bg-dash-surface shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-dash-border px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-dash-text">
              Organize PDF
            </h2>
            <p className="text-xs text-dash-text-muted mt-0.5">
              Reorder, remove, or rearrange pages in your PDF
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-dash-text-muted hover:bg-dash-surface-hover hover:text-dash-text transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* ── Source selection ─────────────────────────────── */}
          {!state.file ? (
            <div className="flex gap-2">
              {/* Drop zone */}
              <div
                className="flex flex-1 items-center justify-center rounded-xl border-2 border-dashed border-dash-border bg-dash-muted hover:border-[var(--im-primary)]/60 hover:bg-[var(--im-primary-light)] h-28 cursor-pointer transition-colors"
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => fileInputRef.current?.click()}
                data-testid="pdf-organize-drop"
              >
                <div className="flex flex-col items-center gap-1.5 text-dash-text-muted">
                  <Upload className="h-5 w-5" />
                  <p className="text-xs font-medium">
                    Drop a PDF or click to upload
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) loadPdf(f);
                    e.target.value = '';
                  }}
                />
              </div>

              {/* Browse library */}
              <button
                onClick={() => setShowPicker(true)}
                className="flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-dash-border bg-dash-muted hover:border-[var(--im-primary)]/60 hover:bg-[var(--im-primary-light)] h-28 w-36 cursor-pointer transition-colors text-dash-text-muted"
                data-testid="pdf-organize-browse"
              >
                <Library className="h-5 w-5" />
                <span className="text-xs font-medium">Browse Library</span>
              </button>
            </div>
          ) : (
            <>
              {/* ── File info card ──────────────────────────── */}
              <div className="flex items-center gap-3 rounded-lg border border-dash-border bg-dash-muted/50 px-4 py-3">
                <ArrowUpDown className="h-5 w-5 text-violet-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-dash-text truncate">
                    {state.fileName}
                  </p>
                  <p className="text-xs text-dash-text-muted">
                    {state.pages.length} of {state.totalPages} pages selected
                  </p>
                </div>
                <button
                  onClick={() =>
                    setState((s) => ({
                      ...s,
                      file: null,
                      fileName: '',
                      totalPages: 0,
                      pages: [],
                      error: null,
                    }))
                  }
                  className="rounded-lg p-1.5 text-dash-text-muted hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* ── Page list ───────────────────────────────── */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-dash-text-muted">
                    Pages ({state.pages.length})
                  </p>
                  <button
                    onClick={resetPages}
                    className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-dash-text-muted hover:bg-dash-surface-hover hover:text-dash-text transition-colors"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Reset
                  </button>
                </div>

                <div className="space-y-1 max-h-60 overflow-y-auto">
                  {state.pages.map((pageIdx, listIdx) => (
                    <div
                      key={`${listIdx}-${pageIdx}`}
                      className="flex items-center gap-2 rounded-lg border border-dash-border bg-dash-muted/50 px-3 py-2"
                    >
                      <span className="text-sm font-medium text-dash-text min-w-0 flex-1 truncate">
                        Page {pageIdx + 1}
                      </span>

                      {/* Move up */}
                      <button
                        onClick={() => moveUp(listIdx)}
                        disabled={listIdx === 0}
                        className="rounded p-1 text-dash-text-muted hover:bg-dash-surface-hover hover:text-dash-text disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        aria-label={`Move page ${pageIdx + 1} up`}
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>

                      {/* Move down */}
                      <button
                        onClick={() => moveDown(listIdx)}
                        disabled={listIdx === state.pages.length - 1}
                        className="rounded p-1 text-dash-text-muted hover:bg-dash-surface-hover hover:text-dash-text disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        aria-label={`Move page ${pageIdx + 1} down`}
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>

                      {/* Remove page */}
                      <button
                        onClick={() => removePage(listIdx)}
                        disabled={state.pages.length <= 1}
                        className="rounded p-1 text-dash-text-muted hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        aria-label={`Remove page ${pageIdx + 1}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ── Error ───────────────────────────────────────── */}
          {state.error && (
            <p
              className="text-xs text-red-500"
              data-testid="pdf-organize-error"
            >
              {state.error}
            </p>
          )}

          {/* ── Action button ───────────────────────────────── */}
          {state.resultBlob ? (
            <ToolOutputActions
              blob={state.resultBlob}
              fileName={state.resultName}
              mimeType="application/pdf"
            />
          ) : (
            <button
              onClick={handleSave}
              disabled={
                !state.file || state.pages.length === 0 || state.processing
              }
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--im-primary)] px-4 py-2.5 text-sm font-semibold text-[var(--im-primary-fg)] shadow-sm transition hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="pdf-organize-btn"
            >
              {state.processing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processing…
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Save &amp; Download
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* ── Asset picker overlay ────────────────────────────── */}
      {showPicker && (
        <AssetPicker
          accept="application/pdf"
          multiple={false}
          onClose={() => setShowPicker(false)}
          onSelect={(files) => {
            setShowPicker(false);
            if (files[0]) loadPdf(files[0]);
          }}
        />
      )}
    </div>
  );
}
