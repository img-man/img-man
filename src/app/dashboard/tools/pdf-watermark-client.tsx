// SPDX-License-Identifier: Apache-2.0
'use client';

/**
 * PDF Watermark Tool
 * Upload a PDF and add a text watermark to every page.
 * Entirely client-side via pdf-lib.
 */

import { useState, useCallback, useRef } from 'react';
import { X, Upload, Download, Loader2, Droplets, Library } from 'lucide-react';
import dynamic from 'next/dynamic';
import { ToolOutputActions } from '@/components/dashboard/ToolOutputActions';

const AssetPicker = dynamic(
  () => import('@/components/dashboard/asset-picker'),
  { ssr: false },
);

interface WatermarkState {
  file: File | null;
  fileName: string;
  totalPages: number;
  text: string;
  fontSize: number;
  opacity: number;
  rotation: number;
  color: string;
  processing: boolean;
  error: string | null;
  resultBlob: Blob | null;
  resultName: string;
}

export default function PdfWatermarkModal({
  onClose,
}: {
  onClose: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [state, setState] = useState<WatermarkState>({
    file: null,
    fileName: '',
    totalPages: 0,
    text: 'CONFIDENTIAL',
    fontSize: 60,
    opacity: 0.3,
    rotation: -45,
    color: '#808080',
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

  const handleWatermark = useCallback(async () => {
    if (!state.file || !state.text.trim()) return;
    setState((s) => ({ ...s, processing: true, error: null }));
    try {
      const {
        PDFDocument,
        StandardFonts,
        rgb,
        degrees: deg,
      } = await import('pdf-lib');
      const bytes = await state.file.arrayBuffer();
      const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const font = await doc.embedFont(StandardFonts.Helvetica);
      const pages = doc.getPages();

      // Parse hex color to RGB components (0-1)
      const hexToRgb = (hex: string) => {
        const c = hex.replace('#', '');
        return {
          r: parseInt(c.substring(0, 2), 16) / 255,
          g: parseInt(c.substring(2, 4), 16) / 255,
          b: parseInt(c.substring(4, 6), 16) / 255,
        };
      };
      const { r, g, b } = hexToRgb(state.color);

      for (const page of pages) {
        const { width, height } = page.getSize();
        const textWidth = font.widthOfTextAtSize(state.text, state.fontSize);
        const x = (width - textWidth) / 2;
        const y = height / 2;
        page.drawText(state.text, {
          x,
          y,
          size: state.fontSize,
          font,
          color: rgb(r, g, b),
          opacity: state.opacity,
          rotate: deg(state.rotation),
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
        resultName: `${baseName}_watermarked.pdf`,
      }));
    } catch (err) {
      setState((s) => ({
        ...s,
        error: `Watermark failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
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
              Add Watermark
            </h2>
            <p className="text-xs text-dash-text-muted mt-0.5">
              Add a text watermark to every page of a PDF
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
                data-testid="pdf-watermark-drop"
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
                data-testid="pdf-watermark-browse"
              >
                <Library className="h-5 w-5" />
                <span className="text-xs font-medium">Browse Library</span>
              </button>
            </div>
          ) : (
            <>
              {/* File info */}
              <div className="flex items-center gap-3 rounded-lg border border-dash-border bg-dash-muted/50 px-4 py-3">
                <Droplets className="h-5 w-5 text-blue-500 shrink-0" />
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

              {/* Watermark text */}
              <div>
                <label className="block text-xs font-medium text-dash-text2 mb-1">
                  Watermark Text
                </label>
                <input
                  type="text"
                  value={state.text}
                  onChange={(e) =>
                    setState((s) => ({ ...s, text: e.target.value }))
                  }
                  className="w-full rounded-lg border border-dash-border bg-dash-muted px-3 py-2 text-sm text-dash-text outline-none focus:border-[var(--im-primary)] focus:ring-2 focus:ring-[var(--im-primary)]/20"
                  placeholder="CONFIDENTIAL"
                  data-testid="pdf-watermark-text"
                />
              </div>

              {/* Controls */}
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-medium text-dash-text2 mb-1">
                    Font Size: {state.fontSize}
                  </label>
                  <input
                    type="range"
                    min={12}
                    max={120}
                    value={state.fontSize}
                    onChange={(e) =>
                      setState((s) => ({ ...s, fontSize: +e.target.value }))
                    }
                    className="w-full accent-[var(--im-primary)]"
                    data-testid="pdf-watermark-size"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-dash-text2 mb-1">
                    Opacity: {Math.round(state.opacity * 100)}%
                  </label>
                  <input
                    type="range"
                    min={5}
                    max={100}
                    value={Math.round(state.opacity * 100)}
                    onChange={(e) =>
                      setState((s) => ({
                        ...s,
                        opacity: +e.target.value / 100,
                      }))
                    }
                    className="w-full accent-[var(--im-primary)]"
                    data-testid="pdf-watermark-opacity"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-dash-text2 mb-1">
                    Angle: {state.rotation}°
                  </label>
                  <input
                    type="range"
                    min={-90}
                    max={90}
                    value={state.rotation}
                    onChange={(e) =>
                      setState((s) => ({ ...s, rotation: +e.target.value }))
                    }
                    className="w-full accent-[var(--im-primary)]"
                    data-testid="pdf-watermark-angle"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-dash-text2 mb-1">
                    Color
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={state.color}
                      onChange={(e) =>
                        setState((s) => ({ ...s, color: e.target.value }))
                      }
                      className="h-8 w-10 rounded-lg border border-dash-border cursor-pointer bg-transparent"
                      data-testid="pdf-watermark-color"
                    />
                    <span className="text-[10px] text-dash-text-muted uppercase">
                      {state.color}
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}

          {state.error && (
            <p
              className="text-xs text-red-500"
              data-testid="pdf-watermark-error"
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
              onClick={handleWatermark}
              disabled={!state.file || !state.text.trim() || state.processing}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--im-primary)] px-4 py-2.5 text-sm font-semibold text-[var(--im-primary-fg)] shadow-sm transition hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="pdf-watermark-btn"
            >
              {state.processing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Applying…
                </>
              ) : (
                <>
                  <Droplets className="h-4 w-4" />
                  Add Watermark
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
