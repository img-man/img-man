// SPDX-License-Identifier: Apache-2.0
'use client';

/**
 * PDF Compress Tool
 * Upload a PDF, re-save with compression and optional metadata stripping.
 * Entirely client-side via pdf-lib.
 */

import { useState, useCallback, useRef } from 'react';
import {
  X,
  Upload,
  Download,
  Loader2,
  Minimize2 as CompressIcon,
  Library,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { ToolOutputActions } from '@/components/dashboard/ToolOutputActions';

const AssetPicker = dynamic(
  () => import('@/components/dashboard/asset-picker'),
  { ssr: false },
);

interface CompressState {
  file: File | null;
  fileName: string;
  originalSize: number;
  totalPages: number;
  stripMetadata: boolean;
  useObjectStreams: boolean;
  quality: number; // 1-100, controls image re-encoding quality
  dpiScale: number; // 0.5, 0.75, 1.0 — controls resolution
  reencodeImages: boolean;
  processing: boolean;
  progress: string;
  resultSize: number | null;
  error: string | null;
  resultBlob: Blob | null;
  resultName: string;
}

export default function PdfCompressModal({ onClose }: { onClose: () => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [state, setState] = useState<CompressState>({
    file: null,
    fileName: '',
    originalSize: 0,
    totalPages: 0,
    stripMetadata: true,
    useObjectStreams: true,
    quality: 60,
    dpiScale: 0.75,
    reencodeImages: true,
    processing: false,
    progress: '',
    resultSize: null,
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
        originalSize: file.size,
        totalPages: doc.getPageCount(),
        resultSize: null,
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

  const handleCompress = useCallback(async () => {
    if (!state.file) return;
    setState((s) => ({
      ...s,
      processing: true,
      error: null,
      progress: 'Preparing…',
      resultSize: null,
    }));
    try {
      const { PDFDocument } = await import('pdf-lib');

      if (state.reencodeImages) {
        // Strategy: render each page via pdfjs-dist as an image, then re-embed as JPEG
        // This provides actual compression since all content becomes a JPEG
        const pdfjs = await import('pdfjs-dist');
        pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

        const srcBytes = await state.file.arrayBuffer();
        const srcPdfDoc = await pdfjs.getDocument({
          data: new Uint8Array(srcBytes),
        }).promise;
        const newDoc = await PDFDocument.create();
        const pageCount = srcPdfDoc.numPages;

        for (let i = 1; i <= pageCount; i++) {
          setState((s) => ({
            ...s,
            progress: `Compressing page ${i}/${pageCount}…`,
          }));
          const page = await srcPdfDoc.getPage(i);
          const viewport = page.getViewport({ scale: state.dpiScale });
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext('2d')!;
          await page.render({ canvasContext: ctx, viewport } as never).promise;

          // Convert canvas to JPEG blob at specified quality
          const blob = await new Promise<Blob | null>((res) =>
            canvas.toBlob(res, 'image/jpeg', state.quality / 100),
          );
          if (!blob) continue;
          const jpegBytes = new Uint8Array(await blob.arrayBuffer());
          const img = await newDoc.embedJpg(jpegBytes);

          // Create page at original dimensions (72 DPI points)
          const origViewport = page.getViewport({ scale: 1.0 });
          const newPage = newDoc.addPage([
            origViewport.width,
            origViewport.height,
          ]);
          newPage.drawImage(img, {
            x: 0,
            y: 0,
            width: origViewport.width,
            height: origViewport.height,
          });
        }

        srcPdfDoc.destroy();

        if (state.stripMetadata) {
          newDoc.setTitle('');
          newDoc.setAuthor('');
          newDoc.setSubject('');
          newDoc.setKeywords([]);
          newDoc.setProducer('');
          newDoc.setCreator('');
        }

        setState((s) => ({ ...s, progress: 'Saving…' }));
        const pdfBytes = await newDoc.save({
          useObjectStreams: state.useObjectStreams,
        });
        setState((s) => ({ ...s, resultSize: pdfBytes.length }));

        const blobOut = new Blob([pdfBytes as unknown as BlobPart], {
          type: 'application/pdf',
        });
        const baseName = state.fileName.replace(/\.pdf$/i, '');
        setState((s) => ({
          ...s,
          resultBlob: blobOut,
          resultName: `${baseName}_compressed.pdf`,
        }));
      } else {
        // Lightweight: only strip metadata and use object streams
        const bytes = await state.file.arrayBuffer();
        const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });

        if (state.stripMetadata) {
          doc.setTitle('');
          doc.setAuthor('');
          doc.setSubject('');
          doc.setKeywords([]);
          doc.setProducer('');
          doc.setCreator('');
        }

        const pdfBytes = await doc.save({
          useObjectStreams: state.useObjectStreams,
        });

        setState((s) => ({ ...s, resultSize: pdfBytes.length }));

        const blobOut = new Blob([pdfBytes as unknown as BlobPart], {
          type: 'application/pdf',
        });
        const baseName = state.fileName.replace(/\.pdf$/i, '');
        setState((s) => ({
          ...s,
          resultBlob: blobOut,
          resultName: `${baseName}_compressed.pdf`,
        }));
      }
    } catch (err) {
      setState((s) => ({
        ...s,
        error: `Compression failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      }));
    } finally {
      setState((s) => ({ ...s, processing: false, progress: '' }));
    }
  }, [state]);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

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
              Compress PDF
            </h2>
            <p className="text-xs text-dash-text-muted mt-0.5">
              Reduce PDF file size by optimizing and stripping metadata
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
          {/* Source selection */}
          {!state.file ? (
            <div className="flex gap-2">
              <div
                className="flex flex-1 items-center justify-center rounded-xl border-2 border-dashed border-dash-border bg-dash-muted hover:border-[var(--im-primary)]/60 hover:bg-[var(--im-primary-light)] h-28 cursor-pointer transition-colors"
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => fileInputRef.current?.click()}
                data-testid="pdf-compress-drop"
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
                data-testid="pdf-compress-browse"
              >
                <Library className="h-5 w-5" />
                <span className="text-xs font-medium">Browse Library</span>
              </button>
            </div>
          ) : (
            <>
              {/* File info */}
              <div className="flex items-center gap-3 rounded-lg border border-dash-border bg-dash-muted/50 px-4 py-3">
                <CompressIcon className="h-5 w-5 text-cyan-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-dash-text truncate">
                    {state.fileName}
                  </p>
                  <p className="text-xs text-dash-text-muted">
                    {state.totalPages} page{state.totalPages > 1 ? 's' : ''} ·{' '}
                    {formatSize(state.originalSize)}
                  </p>
                </div>
                <button
                  onClick={() =>
                    setState((s) => ({
                      ...s,
                      file: null,
                      fileName: '',
                      originalSize: 0,
                      totalPages: 0,
                      resultSize: null,
                      error: null,
                    }))
                  }
                  className="rounded-lg p-1.5 text-dash-text-muted hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Options */}
              <div className="space-y-3">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={state.reencodeImages}
                    onChange={(e) =>
                      setState((s) => ({
                        ...s,
                        reencodeImages: e.target.checked,
                      }))
                    }
                    className="h-4 w-4 rounded border-dash-border accent-[var(--im-primary)]"
                    data-testid="pdf-compress-reencode"
                  />
                  <span className="text-sm text-dash-text">
                    Re-encode pages as images (best compression)
                  </span>
                </label>

                {state.reencodeImages && (
                  <div className="ml-6 space-y-3 border-l-2 border-dash-border pl-4">
                    <div>
                      <label className="block text-xs font-medium text-dash-text2 mb-1">
                        Image Quality: {state.quality}%
                        <span className="text-dash-text-muted ml-1">
                          (
                          {state.quality <= 30
                            ? 'Low — smallest file'
                            : state.quality <= 60
                              ? 'Medium — balanced'
                              : 'High — best visual'}
                          )
                        </span>
                      </label>
                      <input
                        type="range"
                        min={10}
                        max={95}
                        value={state.quality}
                        onChange={(e) =>
                          setState((s) => ({ ...s, quality: +e.target.value }))
                        }
                        className="w-full accent-[var(--im-primary)]"
                        data-testid="pdf-compress-quality"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-dash-text2 mb-1">
                        Resolution Scale
                      </label>
                      <div className="flex gap-2">
                        {[
                          { val: 0.5, label: '50%', desc: 'Smallest' },
                          { val: 0.75, label: '75%', desc: 'Balanced' },
                          { val: 1.0, label: '100%', desc: 'Full' },
                        ].map((opt) => (
                          <button
                            key={opt.val}
                            onClick={() =>
                              setState((s) => ({ ...s, dpiScale: opt.val }))
                            }
                            className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                              state.dpiScale === opt.val
                                ? 'border-[var(--im-primary)] bg-[var(--im-primary)]/10 text-[var(--im-primary)]'
                                : 'border-dash-border bg-dash-muted text-dash-text-muted hover:bg-dash-surface-hover'
                            }`}
                          >
                            {opt.label}
                            <span className="block text-[10px] opacity-70 mt-0.5">
                              {opt.desc}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <p className="text-[10px] text-dash-text-muted">
                      Pages are rendered as JPEG images at the chosen quality
                      and resolution. Text will no longer be selectable.
                    </p>
                  </div>
                )}

                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={state.stripMetadata}
                    onChange={(e) =>
                      setState((s) => ({
                        ...s,
                        stripMetadata: e.target.checked,
                      }))
                    }
                    className="h-4 w-4 rounded border-dash-border accent-[var(--im-primary)]"
                    data-testid="pdf-compress-strip"
                  />
                  <span className="text-sm text-dash-text">
                    Strip metadata (title, author, etc.)
                  </span>
                </label>
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={state.useObjectStreams}
                    onChange={(e) =>
                      setState((s) => ({
                        ...s,
                        useObjectStreams: e.target.checked,
                      }))
                    }
                    className="h-4 w-4 rounded border-dash-border accent-[var(--im-primary)]"
                    data-testid="pdf-compress-streams"
                  />
                  <span className="text-sm text-dash-text">
                    Use object streams (better compression)
                  </span>
                </label>
              </div>

              {/* Result */}
              {state.resultSize !== null && (
                <div className="rounded-lg border border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/30 px-4 py-3">
                  <p className="text-sm text-green-700 dark:text-green-400">
                    Compressed: {formatSize(state.originalSize)} →{' '}
                    {formatSize(state.resultSize)} (
                    {state.resultSize < state.originalSize
                      ? `${((1 - state.resultSize / state.originalSize) * 100).toFixed(1)}% smaller`
                      : 'no reduction'}
                    )
                  </p>
                </div>
              )}
            </>
          )}

          {/* Error */}
          {state.error && (
            <p
              className="text-xs text-red-500"
              data-testid="pdf-compress-error"
            >
              {state.error}
            </p>
          )}

          {/* Compress button */}
          {state.resultBlob ? (
            <ToolOutputActions
              blob={state.resultBlob}
              fileName={state.resultName}
              mimeType="application/pdf"
            />
          ) : (
            <button
              onClick={handleCompress}
              disabled={!state.file || state.processing}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--im-primary)] px-4 py-2.5 text-sm font-semibold text-[var(--im-primary-fg)] shadow-sm transition hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="pdf-compress-btn"
            >
              {state.processing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {state.progress || 'Compressing…'}
                </>
              ) : (
                <>
                  <CompressIcon className="h-4 w-4" />
                  Compress PDF
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
