// SPDX-License-Identifier: Apache-2.0
'use client';

/**
 * PDF Page Extract Tool
 * Upload a PDF and extract specific pages into a new PDF.
 * Entirely client-side via pdf-lib.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  X,
  Upload,
  Download,
  Loader2,
  FileOutput,
  Library,
  Maximize2,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { ToolOutputActions } from '@/components/dashboard/ToolOutputActions';

const AssetPicker = dynamic(
  () => import('@/components/dashboard/asset-picker'),
  { ssr: false },
);

interface ExtractState {
  file: File | null;
  fileBytes: ArrayBuffer | null;
  fileName: string;
  totalPages: number;
  selectedPages: Set<number>;
  thumbnails: Map<number, string>;
  loadingThumbs: boolean;
  fullscreenPage: number | null;
  fullscreenUrl: string | null;
  processing: boolean;
  error: string | null;
  resultBlob: Blob | null;
  resultName: string;
}

export default function PdfPageExtractModal({
  onClose,
}: {
  onClose: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [state, setState] = useState<ExtractState>({
    file: null,
    fileBytes: null,
    fileName: '',
    totalPages: 0,
    selectedPages: new Set(),
    thumbnails: new Map(),
    loadingThumbs: false,
    fullscreenPage: null,
    fullscreenUrl: null,
    processing: false,
    error: null,
    resultBlob: null,
    resultName: '',
  });

  const renderThumbnails = useCallback(
    async (bytes: ArrayBuffer, pageCount: number) => {
      setState((s) => ({ ...s, loadingThumbs: true }));
      try {
        const pdfjs = await import('pdfjs-dist');
        pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
        const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes) })
          .promise;
        const thumbs = new Map<number, string>();
        for (let i = 1; i <= pageCount; i++) {
          const page = await doc.getPage(i);
          const viewport = page.getViewport({ scale: 0.3 });
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext('2d')!;
          await page.render({ canvasContext: ctx, viewport } as never).promise;
          thumbs.set(i, canvas.toDataURL('image/png'));
        }
        setState((s) => ({ ...s, thumbnails: thumbs }));
        doc.destroy();
      } catch {
        // Thumbnails are optional
      } finally {
        setState((s) => ({ ...s, loadingThumbs: false }));
      }
    },
    [],
  );

  const loadPdf = useCallback(
    async (file: File) => {
      if (file.type !== 'application/pdf') return;
      try {
        const { PDFDocument } = await import('pdf-lib');
        const bytes = await file.arrayBuffer();
        const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
        const count = doc.getPageCount();
        setState((s) => ({
          ...s,
          file,
          fileBytes: bytes,
          fileName: file.name,
          totalPages: count,
          selectedPages: new Set(Array.from({ length: count }, (_, i) => i)),
          thumbnails: new Map(),
          error: null,
        }));
        renderThumbnails(bytes, count);
      } catch {
        setState((s) => ({ ...s, error: 'Failed to read PDF.' }));
      }
    },
    [renderThumbnails],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) loadPdf(file);
    },
    [loadPdf],
  );

  const togglePage = useCallback((index: number) => {
    setState((s) => {
      const next = new Set(s.selectedPages);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return { ...s, selectedPages: next };
    });
  }, []);

  const selectAll = useCallback(() => {
    setState((s) => ({
      ...s,
      selectedPages: new Set(Array.from({ length: s.totalPages }, (_, i) => i)),
    }));
  }, []);

  const selectNone = useCallback(() => {
    setState((s) => ({ ...s, selectedPages: new Set() }));
  }, []);

  const openFullscreen = useCallback(
    async (pageNum: number) => {
      if (!state.fileBytes) return;
      try {
        const pdfjs = await import('pdfjs-dist');
        pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
        const doc = await pdfjs.getDocument({
          data: new Uint8Array(state.fileBytes),
        }).promise;
        const page = await doc.getPage(pageNum);
        const viewport = page.getViewport({ scale: 2.0 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d')!;
        await page.render({ canvasContext: ctx, viewport } as never).promise;
        const url = canvas.toDataURL('image/png');
        setState((s) => ({
          ...s,
          fullscreenPage: pageNum,
          fullscreenUrl: url,
        }));
        doc.destroy();
      } catch {
        // ignore
      }
    },
    [state.fileBytes],
  );

  const handleExtract = useCallback(async () => {
    if (!state.file || state.selectedPages.size === 0) {
      setState((s) => ({ ...s, error: 'Select at least one page.' }));
      return;
    }
    setState((s) => ({ ...s, processing: true, error: null }));
    try {
      const { PDFDocument } = await import('pdf-lib');
      const srcBytes = await state.file.arrayBuffer();
      const srcDoc = await PDFDocument.load(srcBytes, {
        ignoreEncryption: true,
      });
      const newDoc = await PDFDocument.create();

      const indices = Array.from(state.selectedPages).sort((a, b) => a - b);
      const pages = await newDoc.copyPages(srcDoc, indices);
      for (const page of pages) newDoc.addPage(page);

      const pdfBytes = await newDoc.save();
      const blob = new Blob([pdfBytes as unknown as BlobPart], {
        type: 'application/pdf',
      });
      const baseName = state.fileName.replace(/\.pdf$/i, '');
      setState((s) => ({
        ...s,
        resultBlob: blob,
        resultName: `${baseName}_extracted.pdf`,
      }));
    } catch (err) {
      setState((s) => ({
        ...s,
        error: `Extract failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      }));
    } finally {
      setState((s) => ({ ...s, processing: false }));
    }
  }, [state]);

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
              Extract Pages
            </h2>
            <p className="text-xs text-dash-text-muted mt-0.5">
              Select and extract specific pages from a PDF
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
          {!state.file ? (
            <div className="flex gap-2">
              <div
                className="flex flex-1 items-center justify-center rounded-xl border-2 border-dashed border-dash-border bg-dash-muted hover:border-[var(--im-primary)]/60 hover:bg-[var(--im-primary-light)] h-28 cursor-pointer transition-colors"
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => fileInputRef.current?.click()}
                data-testid="pdf-extract-drop"
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
              <button
                onClick={() => setShowPicker(true)}
                className="flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-dash-border bg-dash-muted hover:border-[var(--im-primary)]/60 hover:bg-[var(--im-primary-light)] h-28 w-36 cursor-pointer transition-colors text-dash-text-muted"
                data-testid="pdf-extract-browse"
              >
                <Library className="h-5 w-5" />
                <span className="text-xs font-medium">Browse Library</span>
              </button>
            </div>
          ) : (
            <>
              {/* File info */}
              <div className="flex items-center gap-3 rounded-lg border border-dash-border bg-dash-muted/50 px-4 py-3">
                <FileOutput className="h-5 w-5 text-violet-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-dash-text truncate">
                    {state.fileName}
                  </p>
                  <p className="text-xs text-dash-text-muted">
                    {state.totalPages} page{state.totalPages > 1 ? 's' : ''}
                  </p>
                </div>
                <button
                  onClick={() =>
                    setState((s) => ({
                      ...s,
                      file: null,
                      fileBytes: null,
                      fileName: '',
                      totalPages: 0,
                      selectedPages: new Set(),
                      thumbnails: new Map(),
                      error: null,
                    }))
                  }
                  className="rounded-lg p-1.5 text-dash-text-muted hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Page selector with thumbnails */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-dash-text2">
                    Select pages ({state.selectedPages.size} of{' '}
                    {state.totalPages})
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={selectAll}
                      className="text-[10px] font-semibold text-[var(--im-primary)] hover:underline"
                    >
                      All
                    </button>
                    <button
                      onClick={selectNone}
                      className="text-[10px] font-semibold text-dash-text-muted hover:underline"
                    >
                      None
                    </button>
                  </div>
                </div>
                {state.loadingThumbs && (
                  <div className="flex items-center gap-2 text-xs text-dash-text-muted py-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Generating previews…
                  </div>
                )}
                <div
                  className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2 max-h-64 overflow-y-auto"
                  data-testid="pdf-extract-pages"
                >
                  {Array.from({ length: state.totalPages }, (_, i) => {
                    const thumbUrl = state.thumbnails.get(i + 1);
                    return (
                      <div key={i} className="relative group">
                        <button
                          onClick={() => togglePage(i)}
                          className={`relative w-full rounded-lg border-2 transition-all overflow-hidden ${
                            state.selectedPages.has(i)
                              ? 'border-[var(--im-primary)] ring-2 ring-[var(--im-primary)]/20'
                              : 'border-dash-border hover:border-dash-text-muted'
                          }`}
                        >
                          {thumbUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={thumbUrl}
                              alt={`Page ${i + 1}`}
                              className="w-full h-auto"
                            />
                          ) : (
                            <div className="h-20 flex items-center justify-center bg-dash-muted">
                              <span className="text-lg font-bold text-dash-text-muted">
                                {i + 1}
                              </span>
                            </div>
                          )}
                          {state.selectedPages.has(i) && (
                            <div className="absolute top-1 right-1 h-4 w-4 rounded-full bg-[var(--im-primary)] flex items-center justify-center">
                              <svg
                                className="h-2.5 w-2.5 text-[var(--im-primary-fg)]"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={3}
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M5 13l4 4L19 7"
                                />
                              </svg>
                            </div>
                          )}
                        </button>
                        <button
                          onClick={() => openFullscreen(i + 1)}
                          className="absolute bottom-1 right-1 rounded bg-black/50 p-0.5 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                          title="View full size"
                        >
                          <Maximize2 className="h-3 w-3" />
                        </button>
                        <p className="text-[10px] text-center text-dash-text-muted mt-0.5">
                          {i + 1}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {state.error && (
            <p className="text-xs text-red-500" data-testid="pdf-extract-error">
              {state.error}
            </p>
          )}

          {state.resultBlob ? (
            <ToolOutputActions
              blob={state.resultBlob}
              fileName={state.resultName}
              mimeType="application/pdf"
            />
          ) : (
            <button
              onClick={handleExtract}
              disabled={
                !state.file ||
                state.selectedPages.size === 0 ||
                state.processing
              }
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--im-primary)] px-4 py-2.5 text-sm font-semibold text-[var(--im-primary-fg)] shadow-sm transition hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="pdf-extract-btn"
            >
              {state.processing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Extracting…
                </>
              ) : (
                <>
                  <FileOutput className="h-4 w-4" />
                  Extract Pages
                </>
              )}
            </button>
          )}
        </div>
      </div>

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

      {/* Fullscreen page preview overlay */}
      {state.fullscreenPage !== null && state.fullscreenUrl && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4"
          onClick={() =>
            setState((s) => ({
              ...s,
              fullscreenPage: null,
              fullscreenUrl: null,
            }))
          }
        >
          <div
            className="relative max-w-4xl max-h-[90vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 flex items-center justify-between bg-black/70 rounded-t-xl px-4 py-2 z-10">
              <span className="text-sm text-white font-medium">
                Page {state.fullscreenPage}
              </span>
              <button
                onClick={() =>
                  setState((s) => ({
                    ...s,
                    fullscreenPage: null,
                    fullscreenUrl: null,
                  }))
                }
                className="rounded-lg p-1.5 text-white/70 hover:text-white hover:bg-white/10"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={state.fullscreenUrl}
              alt={`Page ${state.fullscreenPage}`}
              className="w-full rounded-b-xl"
            />
          </div>
        </div>
      )}
    </div>
  );
}
