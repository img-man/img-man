// SPDX-License-Identifier: Apache-2.0
'use client';

/**
 * PDF Flatten Tool
 * Upload a PDF and flatten form fields / annotations.
 * Entirely client-side via pdf-lib.
 */

import { useState, useCallback, useRef } from 'react';
import {
  X,
  Upload,
  Download,
  Loader2,
  Layers,
  Library,
} from 'lucide-react';
import dynamic from 'next/dynamic';

const AssetPicker = dynamic(() => import('@/components/dashboard/asset-picker'), { ssr: false });

interface FlattenState {
  file: File | null;
  fileName: string;
  totalPages: number;
  formFieldCount: number;
  processing: boolean;
  error: string | null;
}

export default function PdfFlattenModal({ onClose }: { onClose: () => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [state, setState] = useState<FlattenState>({
    file: null,
    fileName: '',
    totalPages: 0,
    formFieldCount: 0,
    processing: false,
    error: null,
  });

  const loadPdf = useCallback(async (file: File) => {
    if (file.type !== 'application/pdf') return;
    try {
      const { PDFDocument } = await import('pdf-lib');
      const bytes = await file.arrayBuffer();
      const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const form = doc.getForm();
      const fields = form.getFields();
      setState((s) => ({
        ...s,
        file,
        fileName: file.name,
        totalPages: doc.getPageCount(),
        formFieldCount: fields.length,
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

  const handleFlatten = useCallback(async () => {
    if (!state.file) return;
    setState((s) => ({ ...s, processing: true, error: null }));
    try {
      const { PDFDocument } = await import('pdf-lib');
      const bytes = await state.file.arrayBuffer();
      const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });

      const form = doc.getForm();
      form.flatten();

      const pdfBytes = await doc.save();
      const blob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const baseName = state.fileName.replace(/\.pdf$/i, '');
      a.download = `${baseName}_flattened.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setState((s) => ({ ...s, error: `Flatten failed: ${err instanceof Error ? err.message : 'Unknown error'}` }));
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
            <h2 className="text-base font-semibold text-dash-text">Flatten PDF</h2>
            <p className="text-xs text-dash-text-muted mt-0.5">Flatten form fields and annotations into the document</p>
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
                data-testid="pdf-flatten-drop"
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
                data-testid="pdf-flatten-browse"
              >
                <Library className="h-5 w-5" />
                <span className="text-xs font-medium">Browse Library</span>
              </button>
            </div>
          ) : (
            <>
              {/* File info */}
              <div className="flex items-center gap-3 rounded-lg border border-dash-border bg-dash-muted/50 px-4 py-3">
                <Layers className="h-5 w-5 text-yellow-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-dash-text truncate">{state.fileName}</p>
                  <p className="text-xs text-dash-text-muted">
                    {state.totalPages} page{state.totalPages > 1 ? 's' : ''} · {state.formFieldCount} form field{state.formFieldCount !== 1 ? 's' : ''}
                  </p>
                </div>
                <button
                  onClick={() => setState((s) => ({ ...s, file: null, fileName: '', totalPages: 0, formFieldCount: 0, error: null }))}
                  className="rounded-lg p-1.5 text-dash-text-muted hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Info banner */}
              <div className="rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/30 px-4 py-3">
                <p className="text-xs text-blue-700 dark:text-blue-400">
                  Flattening will merge all form fields and interactive elements into the page content.
                  The resulting PDF will no longer have editable fields.
                </p>
              </div>
            </>
          )}

          {state.error && <p className="text-xs text-red-500" data-testid="pdf-flatten-error">{state.error}</p>}

          <button
            onClick={handleFlatten}
            disabled={!state.file || state.processing}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--im-primary)] px-4 py-2.5 text-sm font-semibold text-[var(--im-primary-fg)] shadow-sm transition hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="pdf-flatten-btn"
          >
            {state.processing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Flattening…
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Flatten &amp; Download
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
