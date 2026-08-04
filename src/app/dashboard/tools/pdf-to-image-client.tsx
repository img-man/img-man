// SPDX-License-Identifier: Apache-2.0
'use client';

/**
 * PDF Page Extraction Tool
 * Upload a PDF and extract each page as a separate single-page PDF.
 * Uses pdf-lib for page extraction and does not perform PNG/JPEG rasterization.
 * Note: This tool is intended for splitting PDFs into individual pages,
 *       not for converting pages into image formats.
 */

import { useState, useCallback, useRef } from 'react';
import {
  X,
  Upload,
  Download,
  Loader2,
  FileImage,
  Library,
} from 'lucide-react';
import dynamic from 'next/dynamic';

const AssetPicker = dynamic(() => import('@/components/dashboard/asset-picker'), { ssr: false });

interface PdfToImageState {
  file: File | null;
  fileName: string;
  totalPages: number;
  processing: boolean;
  error: string | null;
}

export default function PdfToImageModal({ onClose }: { onClose: () => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [state, setState] = useState<PdfToImageState>({
    file: null,
    fileName: '',
    totalPages: 0,
    processing: false,
    error: null,
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

  const handleConvert = useCallback(async () => {
    if (!state.file) return;
    setState((s) => ({ ...s, processing: true, error: null }));
    try {
      const { PDFDocument } = await import('pdf-lib');
      const srcBytes = await state.file.arrayBuffer();
      const srcDoc = await PDFDocument.load(srcBytes, { ignoreEncryption: true });
      const baseName = state.fileName.replace(/\.pdf$/i, '');

      for (let i = 0; i < srcDoc.getPageCount(); i++) {
        // Create a single-page PDF for each page
        const singleDoc = await PDFDocument.create();
        const [page] = await singleDoc.copyPages(srcDoc, [i]);
        singleDoc.addPage(page);
        const singleBytes = await singleDoc.save();

        // Convert PDF bytes to data URL and render via embed/iframe workaround
        // Since we can't use pdfjs-dist, we'll create an object URL and use
        // a canvas-based approach with an embedded PDF viewer is not possible,
        // so we download individual single-page PDFs as a fallback
        const blob = new Blob([singleBytes as unknown as BlobPart], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        // Each page is extracted as a separate single-page PDF.
        // For full raster image conversion, a PDF rendering engine will be added in a future update.
        a.download = `${baseName}_page${i + 1}.pdf`;
        a.click();
        URL.revokeObjectURL(url);

        // Small delay between downloads to avoid browser blocking
        if (i < srcDoc.getPageCount() - 1) {
          await new Promise((resolve) => setTimeout(resolve, 300));
        }
      }
    } catch (err) {
      setState((s) => ({ ...s, error: `Conversion failed: ${err instanceof Error ? err.message : 'Unknown error'}` }));
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
            <h2 className="text-base font-semibold text-dash-text">PDF Page Splitter</h2>
            <p className="text-xs text-dash-text-muted mt-0.5">Extract each page of a PDF as a separate single-page PDF</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-dash-text-muted hover:bg-dash-surface-hover hover:text-dash-text transition-colors">
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
                data-testid="pdf-to-image-drop"
              >
                <div className="flex flex-col items-center gap-1.5 text-dash-text-muted">
                  <Upload className="h-5 w-5" />
                  <p className="text-xs font-medium">Drop a PDF or click to upload</p>
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
                data-testid="pdf-to-image-browse"
              >
                <Library className="h-5 w-5" />
                <span className="text-xs font-medium">Browse Library</span>
              </button>
            </div>
          ) : (
            <>
              {/* File info */}
              <div className="flex items-center gap-3 rounded-lg border border-dash-border bg-dash-muted/50 px-4 py-3">
                <FileImage className="h-5 w-5 text-green-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-dash-text truncate">{state.fileName}</p>
                  <p className="text-xs text-dash-text-muted">{state.totalPages} page{state.totalPages > 1 ? 's' : ''}</p>
                </div>
                <button
                  onClick={() => setState((s) => ({ ...s, file: null, fileName: '', totalPages: 0, error: null }))}
                  className="rounded-lg p-1.5 text-dash-text-muted hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Info */}
              <div className="rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 px-4 py-3">
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  Each page will be downloaded as a separate single-page PDF file.
                  Full raster image conversion (PNG/JPEG) will be available in a future update.
                </p>
              </div>
            </>
          )}

          {state.error && <p className="text-xs text-red-500" data-testid="pdf-to-image-error">{state.error}</p>}

          <button
            onClick={handleConvert}
            disabled={!state.file || state.processing}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--im-primary)] px-4 py-2.5 text-sm font-semibold text-[var(--im-primary-fg)] shadow-sm transition hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="pdf-to-image-btn"
          >
            {state.processing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Converting…
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Extract Pages
              </>
            )}
          </button>
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
