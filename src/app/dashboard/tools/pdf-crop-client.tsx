// SPDX-License-Identifier: Apache-2.0
'use client';

/**
 * PDF Crop Tool
 * Upload a PDF and crop all pages by trimming specified margins.
 * Entirely client-side via pdf-lib.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  X,
  Upload,
  Download,
  Loader2,
  Crop,
  Library,
  Info,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { ToolOutputActions } from '@/components/dashboard/ToolOutputActions';

const AssetPicker = dynamic(
  () => import('@/components/dashboard/asset-picker'),
  { ssr: false },
);

interface CropState {
  file: File | null;
  fileBytes: ArrayBuffer | null;
  fileName: string;
  totalPages: number;
  pageWidth: number;
  pageHeight: number;
  top: number;
  right: number;
  bottom: number;
  left: number;
  processing: boolean;
  error: string | null;
  previewUrl: string | null;
  resultBlob: Blob | null;
  resultName: string;
}

export default function PdfCropModal({ onClose }: { onClose: () => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [state, setState] = useState<CropState>({
    file: null,
    fileBytes: null,
    fileName: '',
    totalPages: 0,
    pageWidth: 0,
    pageHeight: 0,
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    processing: false,
    error: null,
    previewUrl: null,
    resultBlob: null,
    resultName: '',
  });

  const renderPreview = useCallback(async (bytes: ArrayBuffer) => {
    try {
      const pdfjs = await import('pdfjs-dist');
      pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
      const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes) })
        .promise;
      const page = await doc.getPage(1);
      const viewport = page.getViewport({ scale: 0.8 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d')!;
      await page.render({ canvasContext: ctx, viewport } as never).promise;
      setState((s) => ({ ...s, previewUrl: canvas.toDataURL('image/png') }));
      doc.destroy();
    } catch {
      /* preview optional */
    }
  }, []);

  const loadPdf = useCallback(
    async (file: File) => {
      if (file.type !== 'application/pdf') return;
      try {
        const { PDFDocument } = await import('pdf-lib');
        const bytes = await file.arrayBuffer();
        const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
        const pages = doc.getPages();
        const firstPage = pages[0];
        const { width, height } = firstPage.getSize();
        setState((s) => ({
          ...s,
          file,
          fileBytes: bytes,
          fileName: file.name,
          totalPages: doc.getPageCount(),
          pageWidth: Math.round(width * 100) / 100,
          pageHeight: Math.round(height * 100) / 100,
          error: null,
          previewUrl: null,
        }));
        renderPreview(bytes);
      } catch {
        setState((s) => ({ ...s, error: 'Failed to read PDF.' }));
      }
    },
    [renderPreview],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) loadPdf(file);
    },
    [loadPdf],
  );

  const handleCrop = useCallback(async () => {
    if (!state.file) return;
    setState((s) => ({ ...s, processing: true, error: null }));
    try {
      const { PDFDocument } = await import('pdf-lib');
      const bytes = await state.file.arrayBuffer();
      const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const pages = doc.getPages();

      for (const page of pages) {
        const { width, height } = page.getSize();
        page.setCropBox(
          state.left,
          state.bottom,
          width - state.left - state.right,
          height - state.top - state.bottom,
        );
      }

      const pdfBytes = await doc.save();
      const blob = new Blob([pdfBytes as unknown as BlobPart], {
        type: 'application/pdf',
      });
      const baseName = state.fileName.replace(/\.pdf$/i, '');
      setState((s) => ({
        ...s,
        resultBlob: blob,
        resultName: `${baseName}_cropped.pdf`,
      }));
    } catch (err) {
      setState((s) => ({
        ...s,
        error: `Crop failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
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
            <h2 className="text-base font-semibold text-dash-text">Crop PDF</h2>
            <p className="text-xs text-dash-text-muted mt-0.5">
              Trim margins from all pages of a PDF document
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
                data-testid="pdf-crop-drop"
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
                data-testid="pdf-crop-browse"
              >
                <Library className="h-5 w-5" />
                <span className="text-xs font-medium">Browse Library</span>
              </button>
            </div>
          ) : (
            <>
              {/* File info card */}
              <div className="flex items-center gap-3 rounded-lg border border-dash-border bg-dash-muted/50 px-4 py-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-lime-100 dark:bg-lime-950/40">
                  <Crop className="h-5 w-5 text-lime-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-dash-text truncate">
                    {state.fileName}
                  </p>
                  <p className="text-xs text-dash-text-muted">
                    {state.totalPages} page{state.totalPages > 1 ? 's' : ''} ·{' '}
                    {state.pageWidth} × {state.pageHeight} pt
                  </p>
                </div>
                <button
                  onClick={() =>
                    setState((s) => ({
                      ...s,
                      file: null,
                      fileBytes: null,
                      previewUrl: null,
                      fileName: '',
                      totalPages: 0,
                      pageWidth: 0,
                      pageHeight: 0,
                      top: 0,
                      right: 0,
                      bottom: 0,
                      left: 0,
                      error: null,
                    }))
                  }
                  className="rounded-lg p-1.5 text-dash-text-muted hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Page size display */}
              <div className="rounded-lg border border-dash-border bg-dash-muted/30 px-4 py-2.5">
                <p className="text-xs font-medium text-dash-text2">
                  Current Page Size:{' '}
                  <span className="text-dash-text">
                    {state.pageWidth} × {state.pageHeight} pt
                  </span>
                  <span className="ml-2 text-dash-text-muted">
                    ({(state.pageWidth / 72).toFixed(2)} ×{' '}
                    {(state.pageHeight / 72).toFixed(2)} in)
                  </span>
                </p>
              </div>

              {/* Visual preview with crop overlay */}
              {state.previewUrl && (
                <div
                  className="relative flex items-center justify-center rounded-lg border border-dash-border bg-gray-100 dark:bg-gray-900 p-2"
                  style={{ maxHeight: '250px' }}
                >
                  <div className="relative inline-block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={state.previewUrl}
                      alt="Page 1 preview"
                      className="max-h-56 object-contain rounded"
                    />
                    {/* Crop overlay — shows the trimmed areas as red-tinted regions */}
                    {(state.top > 0 ||
                      state.bottom > 0 ||
                      state.left > 0 ||
                      state.right > 0) && (
                      <>
                        {state.top > 0 && (
                          <div
                            className="absolute top-0 left-0 right-0 bg-red-500/25 border-b border-red-500/50"
                            style={{
                              height: `${(state.top / state.pageHeight) * 100}%`,
                            }}
                          />
                        )}
                        {state.bottom > 0 && (
                          <div
                            className="absolute bottom-0 left-0 right-0 bg-red-500/25 border-t border-red-500/50"
                            style={{
                              height: `${(state.bottom / state.pageHeight) * 100}%`,
                            }}
                          />
                        )}
                        {state.left > 0 && (
                          <div
                            className="absolute top-0 left-0 bottom-0 bg-red-500/25 border-r border-red-500/50"
                            style={{
                              width: `${(state.left / state.pageWidth) * 100}%`,
                            }}
                          />
                        )}
                        {state.right > 0 && (
                          <div
                            className="absolute top-0 right-0 bottom-0 bg-red-500/25 border-l border-red-500/50"
                            style={{
                              width: `${(state.right / state.pageWidth) * 100}%`,
                            }}
                          />
                        )}
                      </>
                    )}
                  </div>
                  {(state.top > 0 ||
                    state.bottom > 0 ||
                    state.left > 0 ||
                    state.right > 0) && (
                    <div className="absolute bottom-2 right-2 bg-black/60 rounded px-2 py-0.5 text-[10px] text-white">
                      Red areas will be trimmed
                    </div>
                  )}
                </div>
              )}

              {/* Margin controls – 2×2 grid */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-dash-text2 mb-1">
                    Top (pt)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={state.top}
                    onChange={(e) =>
                      setState((s) => ({
                        ...s,
                        top: Math.max(0, +e.target.value),
                      }))
                    }
                    className="w-full rounded-lg border border-dash-border bg-dash-muted px-3 py-2 text-sm text-dash-text outline-none focus:border-[var(--im-primary)] focus:ring-2 focus:ring-[var(--im-primary)]/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-dash-text2 mb-1">
                    Right (pt)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={state.right}
                    onChange={(e) =>
                      setState((s) => ({
                        ...s,
                        right: Math.max(0, +e.target.value),
                      }))
                    }
                    className="w-full rounded-lg border border-dash-border bg-dash-muted px-3 py-2 text-sm text-dash-text outline-none focus:border-[var(--im-primary)] focus:ring-2 focus:ring-[var(--im-primary)]/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-dash-text2 mb-1">
                    Bottom (pt)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={state.bottom}
                    onChange={(e) =>
                      setState((s) => ({
                        ...s,
                        bottom: Math.max(0, +e.target.value),
                      }))
                    }
                    className="w-full rounded-lg border border-dash-border bg-dash-muted px-3 py-2 text-sm text-dash-text outline-none focus:border-[var(--im-primary)] focus:ring-2 focus:ring-[var(--im-primary)]/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-dash-text2 mb-1">
                    Left (pt)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={state.left}
                    onChange={(e) =>
                      setState((s) => ({
                        ...s,
                        left: Math.max(0, +e.target.value),
                      }))
                    }
                    className="w-full rounded-lg border border-dash-border bg-dash-muted px-3 py-2 text-sm text-dash-text outline-none focus:border-[var(--im-primary)] focus:ring-2 focus:ring-[var(--im-primary)]/20"
                  />
                </div>
              </div>

              {/* Info banner */}
              <div className="flex items-start gap-2.5 rounded-lg border border-lime-200 bg-lime-50 px-4 py-3 dark:border-lime-900/50 dark:bg-lime-950/20">
                <Info className="h-4 w-4 text-lime-600 dark:text-lime-400 mt-0.5 shrink-0" />
                <p className="text-xs text-lime-700 dark:text-lime-300">
                  Crops all pages by trimming the specified margins (in PDF
                  points). 1 inch ≈ 72 points.
                </p>
              </div>
            </>
          )}

          {state.error && (
            <p className="text-xs text-red-500" data-testid="pdf-crop-error">
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
              onClick={handleCrop}
              disabled={!state.file || state.processing}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--im-primary)] px-4 py-2.5 text-sm font-semibold text-[var(--im-primary-fg)] shadow-sm transition hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="pdf-crop-btn"
            >
              {state.processing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cropping…
                </>
              ) : (
                <>
                  <Crop className="h-4 w-4" />
                  Crop PDF
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
    </div>
  );
}
