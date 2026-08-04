// SPDX-License-Identifier: Apache-2.0
'use client';

/**
 * PDF Page Numbers Tool
 * Upload a PDF and add page numbers to every page.
 * Entirely client-side via pdf-lib.
 */

import { useState, useCallback, useRef } from 'react';
import { X, Upload, Download, Loader2, Hash, Library } from 'lucide-react';
import dynamic from 'next/dynamic';
import { ToolOutputActions } from '@/components/dashboard/ToolOutputActions';

const AssetPicker = dynamic(
  () => import('@/components/dashboard/asset-picker'),
  { ssr: false },
);

type Position =
  | 'bottom-center'
  | 'bottom-left'
  | 'bottom-right'
  | 'top-center'
  | 'top-left'
  | 'top-right';
type Format = 'plain' | 'page-of' | 'dash';

interface PageNumbersState {
  file: File | null;
  fileName: string;
  totalPages: number;
  processing: boolean;
  error: string | null;
  position: Position;
  startNumber: number;
  fontSize: number;
  format: Format;
  resultBlob: Blob | null;
  resultName: string;
}

export default function PdfPageNumbersModal({
  onClose,
}: {
  onClose: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [state, setState] = useState<PageNumbersState>({
    file: null,
    fileName: '',
    totalPages: 0,
    processing: false,
    error: null,
    position: 'bottom-center',
    startNumber: 1,
    fontSize: 12,
    format: 'plain',
    resultBlob: null,
    resultName: '',
  });

  const loadPdf = useCallback(async (file: File) => {
    if (file.type !== 'application/pdf') return;
    try {
      const { PDFDocument } = await import('pdf-lib');
      const bytes = await file.arrayBuffer();
      const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      setState((s) => ({
        ...s,
        file,
        fileName: file.name,
        totalPages: doc.getPageCount(),
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

  const handleAddNumbers = useCallback(async () => {
    if (!state.file) return;
    setState((s) => ({ ...s, processing: true, error: null }));
    try {
      const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
      const bytes = await state.file.arrayBuffer();
      const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const font = await doc.embedFont(StandardFonts.Helvetica);
      const pages = doc.getPages();
      const total = pages.length;

      for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        const { width, height } = page.getSize();
        const num = state.startNumber + i;
        let text: string;
        if (state.format === 'page-of') text = `Page ${num} of ${total}`;
        else if (state.format === 'dash') text = `— ${num} —`;
        else text = `${num}`;

        const textWidth = font.widthOfTextAtSize(text, state.fontSize);
        let x: number, y: number;
        const margin = 40;
        if (state.position.includes('left')) x = margin;
        else if (state.position.includes('right'))
          x = width - textWidth - margin;
        else x = (width - textWidth) / 2;
        if (state.position.includes('bottom')) y = margin;
        else y = height - margin;

        page.drawText(text, {
          x,
          y,
          size: state.fontSize,
          font,
          color: rgb(0.3, 0.3, 0.3),
        });
      }

      const pdfBytes = await doc.save();
      const blob = new Blob([pdfBytes as unknown as BlobPart], {
        type: 'application/pdf',
      });
      const baseName = state.fileName.replace(/\.pdf$/i, '');
      setState((s) => ({
        ...s,
        resultBlob: blob,
        resultName: `${baseName}_numbered.pdf`,
      }));
    } catch (err) {
      setState((s) => ({
        ...s,
        error: `Page numbering failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
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
              Add Page Numbers
            </h2>
            <p className="text-xs text-dash-text-muted mt-0.5">
              Insert page numbers with customizable position and format
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
                data-testid="pdf-page-numbers-drop"
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
                data-testid="pdf-page-numbers-browse"
              >
                <Library className="h-5 w-5" />
                <span className="text-xs font-medium">Browse Library</span>
              </button>
            </div>
          ) : (
            <>
              {/* File info */}
              <div className="flex items-center gap-3 rounded-lg border border-dash-border bg-dash-muted/50 px-4 py-3">
                <Hash className="h-5 w-5 text-indigo-500 shrink-0" />
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
                      fileName: '',
                      totalPages: 0,
                      error: null,
                    }))
                  }
                  className="rounded-lg p-1.5 text-dash-text-muted hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Controls */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-dash-text2 mb-1">
                    Position
                  </label>
                  <select
                    value={state.position}
                    onChange={(e) =>
                      setState((s) => ({
                        ...s,
                        position: e.target.value as Position,
                      }))
                    }
                    className="w-full rounded-lg border border-dash-border bg-dash-muted px-3 py-2 text-sm text-dash-text outline-none focus:border-[var(--im-primary)] focus:ring-2 focus:ring-[var(--im-primary)]/20"
                  >
                    <option value="bottom-center">Bottom Center</option>
                    <option value="bottom-left">Bottom Left</option>
                    <option value="bottom-right">Bottom Right</option>
                    <option value="top-center">Top Center</option>
                    <option value="top-left">Top Left</option>
                    <option value="top-right">Top Right</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-dash-text2 mb-1">
                    Start Number
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={state.startNumber}
                    onChange={(e) =>
                      setState((s) => ({
                        ...s,
                        startNumber: Math.max(1, +e.target.value),
                      }))
                    }
                    className="w-full rounded-lg border border-dash-border bg-dash-muted px-3 py-2 text-sm text-dash-text outline-none focus:border-[var(--im-primary)] focus:ring-2 focus:ring-[var(--im-primary)]/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-dash-text2 mb-1">
                    Format
                  </label>
                  <select
                    value={state.format}
                    onChange={(e) =>
                      setState((s) => ({
                        ...s,
                        format: e.target.value as Format,
                      }))
                    }
                    className="w-full rounded-lg border border-dash-border bg-dash-muted px-3 py-2 text-sm text-dash-text outline-none focus:border-[var(--im-primary)] focus:ring-2 focus:ring-[var(--im-primary)]/20"
                  >
                    <option value="plain">Plain (1, 2, 3)</option>
                    <option value="page-of">Page 1 of 10</option>
                    <option value="dash">— 1 —</option>
                  </select>
                </div>
              </div>

              {/* Font size slider */}
              <div>
                <label className="block text-xs font-medium text-dash-text2 mb-1">
                  Font Size: {state.fontSize}
                </label>
                <input
                  type="range"
                  min={8}
                  max={24}
                  value={state.fontSize}
                  onChange={(e) =>
                    setState((s) => ({ ...s, fontSize: +e.target.value }))
                  }
                  className="w-full accent-[var(--im-primary)]"
                />
              </div>
            </>
          )}

          {state.error && (
            <p
              className="text-xs text-red-500"
              data-testid="pdf-page-numbers-error"
            >
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
              onClick={handleAddNumbers}
              disabled={!state.file || state.processing}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--im-primary)] px-4 py-2.5 text-sm font-semibold text-[var(--im-primary-fg)] shadow-sm transition hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="pdf-page-numbers-btn"
            >
              {state.processing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Applying…
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Add Numbers &amp; Download
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
