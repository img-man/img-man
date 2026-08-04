// SPDX-License-Identifier: Apache-2.0
'use client';

/**
 * PDF Sign Tool
 * Upload a PDF and add a hand-drawn signature to a specific page.
 * Entirely client-side via pdf-lib + canvas-based signature pad.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  X,
  Upload,
  Download,
  Loader2,
  FileSignature,
  Library,
  PenTool,
  ZoomIn,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { ToolOutputActions } from '@/components/dashboard/ToolOutputActions';

const AssetPicker = dynamic(
  () => import('@/components/dashboard/asset-picker'),
  { ssr: false },
);

/* ─── Signature Pad Component ─────────────────────────────── */

function SignaturePad({
  onSave,
  onCancel,
}: {
  onSave: (dataUrl: string) => void;
  onCancel: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // Transparent background — do NOT fill with white
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    return {
      x: ((clientX - rect.left) / rect.width) * canvas.width,
      y: ((clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    setDrawing(true);
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawing) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const endDraw = () => setDrawing(false);

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl border border-dash-border bg-dash-surface p-5 shadow-2xl space-y-3">
        <h3 className="text-sm font-semibold text-dash-text">Draw Signature</h3>
        <canvas
          ref={canvasRef}
          width={400}
          height={200}
          className="w-full rounded-lg border border-dash-border cursor-crosshair touch-none"
          style={{
            background:
              'repeating-conic-gradient(#e5e7eb 0% 25%, #fff 0% 50%) 50% / 16px 16px',
          }}
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={endDraw}
        />
        <div className="flex gap-2">
          <button
            onClick={handleClear}
            className="rounded-lg border border-dash-border px-3 py-1.5 text-xs font-medium text-dash-text-muted hover:bg-dash-surface-hover"
          >
            Clear
          </button>
          <div className="flex-1" />
          <button
            onClick={onCancel}
            className="rounded-lg border border-dash-border px-3 py-1.5 text-xs font-medium text-dash-text-muted hover:bg-dash-surface-hover"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              const dataUrl = canvasRef.current?.toDataURL('image/png') ?? '';
              onSave(dataUrl);
            }}
            className="rounded-lg bg-[var(--im-primary)] px-4 py-1.5 text-xs font-semibold text-[var(--im-primary-fg)] hover:brightness-110"
          >
            Add Signature
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Types ───────────────────────────────────────────────── */

interface SignState {
  file: File | null;
  fileName: string;
  totalPages: number;
  signatureDataUrl: string | null;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  showSignaturePad: boolean;
  processing: boolean;
  error: string | null;
  pagePreviewUrl: string | null;
  resultBlob: Blob | null;
  resultName: string;
}

/* ─── Main Sign Modal ─────────────────────────────────────── */

export default function PdfSignModal({ onClose }: { onClose: () => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [state, setState] = useState<SignState>({
    file: null,
    fileName: '',
    totalPages: 0,
    signatureDataUrl: null,
    page: 1,
    x: 50,
    y: 50,
    width: 200,
    height: 100,
    showSignaturePad: false,
    processing: false,
    error: null,
    pagePreviewUrl: null,
    resultBlob: null,
    resultName: '',
  });

  /* ─── Load PDF ─────────────────────────────────────────── */

  const pdfBytesRef = useRef<ArrayBuffer | null>(null);

  const renderPagePreview = useCallback(
    async (fileBytes: ArrayBuffer, pageNum: number) => {
      try {
        const pdfjs = await import('pdfjs-dist');
        pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
        const doc = await pdfjs.getDocument({ data: new Uint8Array(fileBytes) })
          .promise;
        const page = await doc.getPage(pageNum);
        const viewport = page.getViewport({ scale: 0.5 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d')!;
        await page.render({ canvasContext: ctx, viewport } as never).promise;
        const url = canvas.toDataURL('image/png');
        setState((s) => ({ ...s, pagePreviewUrl: url }));
        doc.destroy();
      } catch {
        // Preview is optional — fail silently
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
        pdfBytesRef.current = bytes;
        const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
        setState((s) => ({
          ...s,
          file,
          fileName: file.name,
          totalPages: doc.getPageCount(),
          page: 1,
          error: null,
          pagePreviewUrl: null,
        }));
        renderPagePreview(bytes, 1);
      } catch {
        setState((s) => ({ ...s, error: 'Failed to read PDF.' }));
      }
    },
    [renderPagePreview],
  );

  // Re-render preview when page changes
  useEffect(() => {
    if (pdfBytesRef.current && state.page > 0) {
      renderPagePreview(pdfBytesRef.current, state.page);
    }
  }, [state.page, renderPagePreview]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) loadPdf(file);
    },
    [loadPdf],
  );

  /* ─── Sign & Download ─────────────────────────────────── */

  const handleSign = useCallback(async () => {
    if (!state.file || !state.signatureDataUrl) return;
    setState((s) => ({ ...s, processing: true, error: null }));
    try {
      const { PDFDocument } = await import('pdf-lib');
      const bytes = await state.file.arrayBuffer();
      const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const pages = doc.getPages();
      const pageIdx = state.page - 1;
      if (pageIdx < 0 || pageIdx >= pages.length)
        throw new Error('Invalid page');
      const page = pages[pageIdx];
      const { height: pageH } = page.getSize();

      const base64 = state.signatureDataUrl.split(',')[1];
      const sigBytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      const embedded = await doc.embedPng(sigBytes);

      page.drawImage(embedded, {
        x: state.x,
        y: pageH - state.y - state.height,
        width: state.width,
        height: state.height,
      });

      const pdfBytes = await doc.save();
      const blob = new Blob([pdfBytes as unknown as BlobPart], {
        type: 'application/pdf',
      });
      const baseName = state.fileName.replace(/\.pdf$/i, '');
      setState((s) => ({
        ...s,
        resultBlob: blob,
        resultName: `${baseName}_signed.pdf`,
      }));
    } catch (err) {
      setState((s) => ({
        ...s,
        error: `Signing failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      }));
    } finally {
      setState((s) => ({ ...s, processing: false }));
    }
  }, [state]);

  /* ─── Render ───────────────────────────────────────────── */

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div
        className="relative w-full max-w-2xl rounded-2xl border border-dash-border bg-dash-surface shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-dash-border px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-dash-text">Sign PDF</h2>
            <p className="text-xs text-dash-text-muted mt-0.5">
              Add your signature to any page of a PDF document
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
          {/* Upload / File Info */}
          {!state.file ? (
            <div className="flex gap-2">
              <div
                className="flex flex-1 items-center justify-center rounded-xl border-2 border-dashed border-dash-border bg-dash-muted hover:border-[var(--im-primary)]/60 hover:bg-[var(--im-primary-light)] h-28 cursor-pointer transition-colors"
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => fileInputRef.current?.click()}
                data-testid="pdf-sign-drop"
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
                data-testid="pdf-sign-browse"
              >
                <Library className="h-5 w-5" />
                <span className="text-xs font-medium">Browse Library</span>
              </button>
            </div>
          ) : (
            <>
              {/* File info card */}
              <div className="flex items-center gap-3 rounded-lg border border-dash-border bg-dash-muted/50 px-4 py-3">
                <FileSignature className="h-5 w-5 text-emerald-500 shrink-0" />
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
                      signatureDataUrl: null,
                      error: null,
                    }))
                  }
                  className="rounded-lg p-1.5 text-dash-text-muted hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* PDF Page Preview */}
              {state.pagePreviewUrl && (
                <div className="relative rounded-lg border border-dash-border bg-gray-100 dark:bg-gray-900 p-2 flex items-center justify-center max-h-64 overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={state.pagePreviewUrl}
                    alt={`Page ${state.page} preview`}
                    className="max-h-60 object-contain rounded"
                  />
                  {state.signatureDataUrl && (
                    <div className="absolute text-[10px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded top-3 right-3">
                      Signature will be placed on this page
                    </div>
                  )}
                </div>
              )}

              {/* Signature section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-medium text-dash-text2">
                    Signature
                  </label>
                  <button
                    onClick={() =>
                      setState((s) => ({ ...s, showSignaturePad: true }))
                    }
                    className="flex items-center gap-1.5 rounded-lg border border-dash-border px-3 py-1.5 text-xs font-medium text-dash-text-muted hover:bg-dash-surface-hover hover:text-dash-text transition-colors"
                  >
                    <PenTool className="h-3.5 w-3.5" />
                    {state.signatureDataUrl
                      ? 'Redraw Signature'
                      : 'Draw Signature'}
                  </button>
                </div>

                {state.signatureDataUrl && (
                  <div className="rounded-lg border border-dash-border bg-white p-3 flex items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={state.signatureDataUrl}
                      alt="Your signature"
                      className="max-h-20 object-contain"
                    />
                  </div>
                )}
              </div>

              {/* Placement controls */}
              <div className="grid grid-cols-5 gap-3">
                <div>
                  <label className="block text-xs font-medium text-dash-text2 mb-1">
                    Page
                  </label>
                  <select
                    value={state.page}
                    onChange={(e) =>
                      setState((s) => ({ ...s, page: +e.target.value }))
                    }
                    className="w-full rounded-lg border border-dash-border bg-dash-muted px-2 py-2 text-sm text-dash-text outline-none focus:border-[var(--im-primary)] focus:ring-2 focus:ring-[var(--im-primary)]/20"
                  >
                    {Array.from({ length: state.totalPages }, (_, i) => (
                      <option key={i + 1} value={i + 1}>
                        {i + 1}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-dash-text2 mb-1">
                    X (px)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={state.x}
                    onChange={(e) =>
                      setState((s) => ({ ...s, x: +e.target.value || 0 }))
                    }
                    className="w-full rounded-lg border border-dash-border bg-dash-muted px-2 py-2 text-sm text-dash-text outline-none focus:border-[var(--im-primary)] focus:ring-2 focus:ring-[var(--im-primary)]/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-dash-text2 mb-1">
                    Y (px)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={state.y}
                    onChange={(e) =>
                      setState((s) => ({ ...s, y: +e.target.value || 0 }))
                    }
                    className="w-full rounded-lg border border-dash-border bg-dash-muted px-2 py-2 text-sm text-dash-text outline-none focus:border-[var(--im-primary)] focus:ring-2 focus:ring-[var(--im-primary)]/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-dash-text2 mb-1">
                    Width
                  </label>
                  <input
                    type="number"
                    min={10}
                    value={state.width}
                    onChange={(e) =>
                      setState((s) => ({ ...s, width: +e.target.value || 10 }))
                    }
                    className="w-full rounded-lg border border-dash-border bg-dash-muted px-2 py-2 text-sm text-dash-text outline-none focus:border-[var(--im-primary)] focus:ring-2 focus:ring-[var(--im-primary)]/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-dash-text2 mb-1">
                    Height
                  </label>
                  <input
                    type="number"
                    min={10}
                    value={state.height}
                    onChange={(e) =>
                      setState((s) => ({ ...s, height: +e.target.value || 10 }))
                    }
                    className="w-full rounded-lg border border-dash-border bg-dash-muted px-2 py-2 text-sm text-dash-text outline-none focus:border-[var(--im-primary)] focus:ring-2 focus:ring-[var(--im-primary)]/20"
                  />
                </div>
              </div>
            </>
          )}

          {/* Error */}
          {state.error && (
            <p className="text-xs text-red-500" data-testid="pdf-sign-error">
              {state.error}
            </p>
          )}

          {/* Action button */}
          {state.resultBlob ? (
            <ToolOutputActions
              blob={state.resultBlob}
              fileName={state.resultName}
              mimeType="application/pdf"
            />
          ) : (
            <button
              onClick={handleSign}
              disabled={
                !state.file || !state.signatureDataUrl || state.processing
              }
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--im-primary)] px-4 py-2.5 text-sm font-semibold text-[var(--im-primary-fg)] shadow-sm transition hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="pdf-sign-btn"
            >
              {state.processing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Signing…
                </>
              ) : (
                <>
                  <FileSignature className="h-4 w-4" />
                  Sign PDF
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Signature Pad Overlay */}
      {state.showSignaturePad && (
        <SignaturePad
          onSave={(dataUrl) =>
            setState((s) => ({
              ...s,
              signatureDataUrl: dataUrl,
              showSignaturePad: false,
            }))
          }
          onCancel={() => setState((s) => ({ ...s, showSignaturePad: false }))}
        />
      )}

      {/* Asset Picker Overlay */}
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
