// SPDX-License-Identifier: Apache-2.0
'use client';

/**
 * PDF Rotate Tool
 * Upload a PDF and rotate all or specific pages.
 * Entirely client-side via pdf-lib.
 */

import { useState, useCallback, useRef } from 'react';
import {
  X,
  Upload,
  Download,
  Loader2,
  RotateCw,
  Library,
  ChevronDown,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { ToolOutputActions } from '@/components/dashboard/ToolOutputActions';

const AssetPicker = dynamic(
  () => import('@/components/dashboard/asset-picker'),
  { ssr: false },
);

type RotationDegrees = 90 | 180 | 270;

interface RotateState {
  file: File | null;
  fileName: string;
  totalPages: number;
  rotation: RotationDegrees;
  applyTo: 'all' | 'custom';
  customRange: string;
  processing: boolean;
  error: string | null;
  resultBlob: Blob | null;
  resultName: string;
}

export default function PdfRotateModal({ onClose }: { onClose: () => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [state, setState] = useState<RotateState>({
    file: null,
    fileName: '',
    totalPages: 0,
    rotation: 90,
    applyTo: 'all',
    customRange: '',
    processing: false,
    error: null,
    resultBlob: null,
    resultName: '',
  });

  const loadPdf = useCallback(async (file: File) => {
    if (file.type !== 'application/pdf') return;
    try {
      const { PDFDocument } = await import('pdf-lib');
      const bytes = await file.arrayBuffer();
      const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const pages = doc.getPageCount();
      setState((s) => ({
        ...s,
        file,
        fileName: file.name,
        totalPages: pages,
        customRange: `1-${pages}`,
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

  const parsePageIndices = useCallback(
    (input: string): number[] | null => {
      const pages = new Set<number>();
      const parts = input
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      for (const part of parts) {
        const match = part.match(/^(\d+)(?:\s*-\s*(\d+))?$/);
        if (!match) return null;
        const start = parseInt(match[1], 10);
        const end = match[2] ? parseInt(match[2], 10) : start;
        if (start < 1 || end < start || end > state.totalPages) return null;
        for (let i = start; i <= end; i++) pages.add(i - 1);
      }
      return pages.size > 0 ? Array.from(pages) : null;
    },
    [state.totalPages],
  );

  const handleRotate = useCallback(async () => {
    if (!state.file) return;
    setState((s) => ({ ...s, processing: true, error: null }));
    try {
      const { PDFDocument, degrees } = await import('pdf-lib');
      const bytes = await state.file.arrayBuffer();
      const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const pages = doc.getPages();

      let targetIndices: number[];
      if (state.applyTo === 'all') {
        targetIndices = pages.map((_, i) => i);
      } else {
        const parsed = parsePageIndices(state.customRange);
        if (!parsed) {
          setState((s) => ({
            ...s,
            processing: false,
            error: 'Invalid page range.',
          }));
          return;
        }
        targetIndices = parsed;
      }

      for (const idx of targetIndices) {
        if (idx < pages.length) {
          const page = pages[idx];
          const currentRotation = page.getRotation().angle;
          page.setRotation(degrees(currentRotation + state.rotation));
        }
      }

      const pdfBytes = await doc.save();
      const blob = new Blob([pdfBytes as unknown as BlobPart], {
        type: 'application/pdf',
      });
      const baseName = state.fileName.replace(/\.pdf$/i, '');
      setState((s) => ({
        ...s,
        resultBlob: blob,
        resultName: `${baseName}_rotated.pdf`,
      }));
    } catch (err) {
      setState((s) => ({
        ...s,
        error: `Rotation failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      }));
    } finally {
      setState((s) => ({ ...s, processing: false }));
    }
  }, [state, parsePageIndices]);

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
              Rotate PDF
            </h2>
            <p className="text-xs text-dash-text-muted mt-0.5">
              Rotate all or specific pages in a PDF
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
                data-testid="pdf-rotate-drop"
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
                data-testid="pdf-rotate-browse"
              >
                <Library className="h-5 w-5" />
                <span className="text-xs font-medium">Browse Library</span>
              </button>
            </div>
          ) : (
            <>
              {/* File info */}
              <div className="flex items-center gap-3 rounded-lg border border-dash-border bg-dash-muted/50 px-4 py-3">
                <RotateCw className="h-5 w-5 text-teal-500 shrink-0" />
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

              {/* Rotation angle */}
              <div>
                <label className="block text-xs font-medium text-dash-text2 mb-1">
                  Rotation
                </label>
                <div className="relative">
                  <select
                    value={state.rotation}
                    onChange={(e) =>
                      setState((s) => ({
                        ...s,
                        rotation: Number(e.target.value) as RotationDegrees,
                      }))
                    }
                    className="w-full appearance-none rounded-lg border border-dash-border bg-dash-muted px-3 py-2 pr-8 text-sm text-dash-text cursor-pointer"
                    data-testid="pdf-rotate-degrees"
                  >
                    <option value={90}>90° Clockwise</option>
                    <option value={180}>180°</option>
                    <option value={270}>90° Counter-clockwise</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-dash-text-muted" />
                </div>
              </div>

              {/* Apply to */}
              <div>
                <label className="block text-xs font-medium text-dash-text2 mb-1">
                  Apply to
                </label>
                <div className="flex gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="applyTo"
                      checked={state.applyTo === 'all'}
                      onChange={() =>
                        setState((s) => ({ ...s, applyTo: 'all' }))
                      }
                      className="accent-[var(--im-primary)]"
                    />
                    <span className="text-sm text-dash-text">All pages</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="applyTo"
                      checked={state.applyTo === 'custom'}
                      onChange={() =>
                        setState((s) => ({ ...s, applyTo: 'custom' }))
                      }
                      className="accent-[var(--im-primary)]"
                    />
                    <span className="text-sm text-dash-text">Custom range</span>
                  </label>
                </div>
                {state.applyTo === 'custom' && (
                  <input
                    type="text"
                    value={state.customRange}
                    onChange={(e) =>
                      setState((s) => ({
                        ...s,
                        customRange: e.target.value,
                        error: null,
                      }))
                    }
                    className="mt-2 w-full rounded-lg border border-dash-border bg-dash-muted px-3 py-2 text-sm text-dash-text outline-none focus:border-[var(--im-primary)] focus:ring-2 focus:ring-[var(--im-primary)]/20"
                    placeholder={`e.g. 1-3, 5`}
                    data-testid="pdf-rotate-range"
                  />
                )}
              </div>
            </>
          )}

          {state.error && (
            <p className="text-xs text-red-500" data-testid="pdf-rotate-error">
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
              onClick={handleRotate}
              disabled={!state.file || state.processing}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--im-primary)] px-4 py-2.5 text-sm font-semibold text-[var(--im-primary-fg)] shadow-sm transition hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="pdf-rotate-btn"
            >
              {state.processing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Rotating…
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Rotate &amp; Download
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
