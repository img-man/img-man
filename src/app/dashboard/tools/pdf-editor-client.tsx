// SPDX-License-Identifier: Apache-2.0
'use client';

/**
 * PDF Editor Tool
 * Upload a PDF, add text blocks, images, and signatures, then save.
 * Uses pdf-lib for reading/writing and a canvas drawing pad for signatures.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  X,
  Upload,
  Download,
  Loader2,
  FileEdit,
  Library,
  Plus,
  Trash2,
  Type,
  Image as ImageIcon,
  PenTool,
  ChevronDown,
} from 'lucide-react';
import dynamic from 'next/dynamic';

const AssetPicker = dynamic(() => import('@/components/dashboard/asset-picker'), { ssr: false });

/* ─── Types ───────────────────────────────────────────────── */

interface TextAnnotation {
  kind: 'text';
  id: string;
  page: number;
  x: number;
  y: number;
  text: string;
  fontSize: number;
  color: string;
}

interface ImageAnnotation {
  kind: 'image';
  id: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  file: File;
  previewUrl: string;
}

interface SignatureAnnotation {
  kind: 'signature';
  id: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  dataUrl: string;
}

type Annotation = TextAnnotation | ImageAnnotation | SignatureAnnotation;

interface EditorState {
  file: File | null;
  fileName: string;
  totalPages: number;
  pageWidth: number;
  pageHeight: number;
  annotations: Annotation[];
  activeTool: 'text' | 'image' | 'signature' | null;
  selectedPage: number;
  showSignaturePad: boolean;
  processing: boolean;
  error: string | null;
}

let _annotId = 0;
function genId() {
  return `ann-${++_annotId}-${Date.now()}`;
}

/* ─── Signature Pad Component ─────────────────────────────── */

function SignaturePad({ onSave, onCancel }: { onSave: (dataUrl: string) => void; onCancel: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
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
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
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
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={endDraw}
        />
        <div className="flex gap-2">
          <button onClick={handleClear} className="rounded-lg border border-dash-border px-3 py-1.5 text-xs font-medium text-dash-text-muted hover:bg-dash-surface-hover">
            Clear
          </button>
          <div className="flex-1" />
          <button onClick={onCancel} className="rounded-lg border border-dash-border px-3 py-1.5 text-xs font-medium text-dash-text-muted hover:bg-dash-surface-hover">
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

/* ─── Main Editor Modal ───────────────────────────────────── */

export default function PdfEditorModal({ onClose }: { onClose: () => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imgInputRef = useRef<HTMLInputElement>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [state, setState] = useState<EditorState>({
    file: null,
    fileName: '',
    totalPages: 0,
    pageWidth: 595,
    pageHeight: 842,
    annotations: [],
    activeTool: null,
    selectedPage: 1,
    showSignaturePad: false,
    processing: false,
    error: null,
  });

  const loadPdf = useCallback(async (file: File) => {
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
        fileName: file.name,
        totalPages: doc.getPageCount(),
        pageWidth: Math.round(width),
        pageHeight: Math.round(height),
        annotations: [],
        selectedPage: 1,
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

  const addTextAnnotation = useCallback(() => {
    setState((s) => ({
      ...s,
      annotations: [
        ...s.annotations,
        {
          kind: 'text',
          id: genId(),
          page: s.selectedPage,
          x: 50,
          y: 50,
          text: 'New text',
          fontSize: 14,
          color: '#000000',
        },
      ],
    }));
  }, []);

  const addImageAnnotation = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') return;
      setState((s) => ({
        ...s,
        annotations: [
          ...s.annotations,
          {
            kind: 'image',
            id: genId(),
            page: s.selectedPage,
            x: 50,
            y: 50,
            width: 150,
            height: 150,
            file,
            previewUrl: result,
          },
        ],
      }));
    };
    reader.onerror = () => {
      setState((s) => ({ ...s, error: 'Failed to read image file.' }));
    };
    reader.readAsDataURL(file);
  }, []);

  const addSignature = useCallback((dataUrl: string) => {
    setState((s) => ({
      ...s,
      showSignaturePad: false,
      annotations: [
        ...s.annotations,
        {
          kind: 'signature',
          id: genId(),
          page: s.selectedPage,
          x: 50,
          y: 50,
          width: 200,
          height: 100,
          dataUrl,
        },
      ],
    }));
  }, []);

  const removeAnnotation = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      annotations: s.annotations.filter((a) => a.id !== id),
    }));
  }, []);

  const updateAnnotation = useCallback((id: string, updates: Partial<Annotation>) => {
    setState((s) => ({
      ...s,
      annotations: s.annotations.map((a) => (a.id === id ? { ...a, ...updates } as Annotation : a)),
    }));
  }, []);

  const handleApply = useCallback(async () => {
    if (!state.file) return;
    setState((s) => ({ ...s, processing: true, error: null }));
    try {
      const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
      const bytes = await state.file.arrayBuffer();
      const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const pages = doc.getPages();
      const font = await doc.embedFont(StandardFonts.Helvetica);

      for (const ann of state.annotations) {
        const pageIdx = ann.page - 1;
        if (pageIdx < 0 || pageIdx >= pages.length) continue;
        const page = pages[pageIdx];
        const { height: pageH } = page.getSize();

        if (ann.kind === 'text') {
          const hexColor = ann.color.replace('#', '');
          const r = parseInt(hexColor.substring(0, 2), 16) / 255;
          const g = parseInt(hexColor.substring(2, 4), 16) / 255;
          const b = parseInt(hexColor.substring(4, 6), 16) / 255;
          page.drawText(ann.text, {
            x: ann.x,
            y: pageH - ann.y - ann.fontSize,
            size: ann.fontSize,
            font,
            color: rgb(r, g, b),
          });
        } else if (ann.kind === 'image') {
          const imgBytes = await ann.file.arrayBuffer();
          let embedded;
          if (ann.file.type === 'image/png') {
            embedded = await doc.embedPng(imgBytes);
          } else {
            embedded = await doc.embedJpg(imgBytes);
          }
          page.drawImage(embedded, {
            x: ann.x,
            y: pageH - ann.y - ann.height,
            width: ann.width,
            height: ann.height,
          });
        } else if (ann.kind === 'signature') {
          // Convert data URL to PNG bytes
          const base64 = ann.dataUrl.split(',')[1];
          const sigBytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
          const embedded = await doc.embedPng(sigBytes);
          page.drawImage(embedded, {
            x: ann.x,
            y: pageH - ann.y - ann.height,
            width: ann.width,
            height: ann.height,
          });
        }
      }

      const pdfBytes = await doc.save();
      const blob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const baseName = state.fileName.replace(/\.pdf$/i, '');
      a.download = `${baseName}_edited.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setState((s) => ({ ...s, error: `Save failed: ${err instanceof Error ? err.message : 'Unknown error'}` }));
    } finally {
      setState((s) => ({ ...s, processing: false }));
    }
  }, [state]);

  const pageAnnotations = state.annotations.filter((a) => a.page === state.selectedPage);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div
        className="relative w-full max-w-3xl rounded-2xl border border-dash-border bg-dash-surface shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-dash-border px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-dash-text">PDF Editor</h2>
            <p className="text-xs text-dash-text-muted mt-0.5">Add text, images, and signatures to your PDF</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-dash-text-muted hover:bg-dash-surface-hover hover:text-dash-text transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {!state.file ? (
            <div className="flex gap-2">
              <div
                className="flex flex-1 items-center justify-center rounded-xl border-2 border-dashed border-dash-border bg-dash-muted hover:border-[var(--im-primary)]/60 hover:bg-[var(--im-primary-light)] h-28 cursor-pointer transition-colors"
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => fileInputRef.current?.click()}
                data-testid="pdf-editor-drop"
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
                data-testid="pdf-editor-browse"
              >
                <Library className="h-5 w-5" />
                <span className="text-xs font-medium">Browse Library</span>
              </button>
            </div>
          ) : (
            <>
              {/* File info */}
              <div className="flex items-center gap-3 rounded-lg border border-dash-border bg-dash-muted/50 px-4 py-3">
                <FileEdit className="h-5 w-5 text-fuchsia-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-dash-text truncate">{state.fileName}</p>
                  <p className="text-xs text-dash-text-muted">
                    {state.totalPages} page{state.totalPages > 1 ? 's' : ''} · {state.pageWidth} × {state.pageHeight} pt
                  </p>
                </div>
                <button
                  onClick={() => setState((s) => ({ ...s, file: null, fileName: '', totalPages: 0, annotations: [], error: null }))}
                  className="rounded-lg p-1.5 text-dash-text-muted hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Page selector + toolbar */}
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-dash-text2 mb-1">Page</label>
                  <div className="relative">
                    <select
                      value={state.selectedPage}
                      onChange={(e) => setState((s) => ({ ...s, selectedPage: +e.target.value }))}
                      className="w-full appearance-none rounded-lg border border-dash-border bg-dash-muted px-3 py-2 pr-8 text-sm text-dash-text cursor-pointer"
                      data-testid="pdf-editor-page"
                    >
                      {Array.from({ length: state.totalPages }, (_, i) => (
                        <option key={i + 1} value={i + 1}>Page {i + 1}</option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-dash-text-muted" />
                  </div>
                </div>

                {/* Add buttons */}
                <div className="flex gap-1.5 mt-4">
                  <button
                    onClick={addTextAnnotation}
                    className="flex items-center gap-1.5 rounded-lg border border-dash-border bg-dash-muted px-3 py-2 text-xs font-medium text-dash-text hover:bg-dash-surface-hover transition-colors"
                    title="Add text"
                  >
                    <Type className="h-3.5 w-3.5" />
                    <Plus className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => imgInputRef.current?.click()}
                    className="flex items-center gap-1.5 rounded-lg border border-dash-border bg-dash-muted px-3 py-2 text-xs font-medium text-dash-text hover:bg-dash-surface-hover transition-colors"
                    title="Add image"
                  >
                    <ImageIcon className="h-3.5 w-3.5" />
                    <Plus className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => setState((s) => ({ ...s, showSignaturePad: true }))}
                    className="flex items-center gap-1.5 rounded-lg border border-dash-border bg-dash-muted px-3 py-2 text-xs font-medium text-dash-text hover:bg-dash-surface-hover transition-colors"
                    title="Add signature"
                  >
                    <PenTool className="h-3.5 w-3.5" />
                    <Plus className="h-3 w-3" />
                  </button>
                  <input
                    ref={imgInputRef}
                    type="file"
                    accept="image/png,image/jpeg"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) addImageAnnotation(f);
                      e.target.value = '';
                    }}
                  />
                </div>
              </div>

              {/* Annotations list */}
              {pageAnnotations.length > 0 ? (
                <div className="space-y-2" data-testid="pdf-editor-annotations">
                  <p className="text-xs font-medium text-dash-text2">
                    Annotations on page {state.selectedPage} ({pageAnnotations.length})
                  </p>
                  {pageAnnotations.map((ann) => (
                    <div key={ann.id} className="rounded-lg border border-dash-border bg-dash-muted/50 p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-semibold uppercase text-dash-text-muted tracking-wider">
                          {ann.kind}
                        </span>
                        <div className="flex-1" />
                        <button
                          onClick={() => removeAnnotation(ann.id)}
                          className="rounded p-1 text-dash-text-muted hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>

                      {ann.kind === 'text' && (
                        <div className="grid grid-cols-2 gap-2">
                          <div className="col-span-2">
                            <input
                              type="text"
                              value={ann.text}
                              onChange={(e) => updateAnnotation(ann.id, { text: e.target.value })}
                              className="w-full rounded-md border border-dash-border bg-dash-muted px-2 py-1 text-xs text-dash-text"
                              placeholder="Text content"
                            />
                          </div>
                          <div className="flex items-center gap-1.5">
                            <label className="text-[10px] text-dash-text-muted shrink-0">X:</label>
                            <input type="number" value={ann.x} onChange={(e) => updateAnnotation(ann.id, { x: +e.target.value })}
                              className="w-full rounded-md border border-dash-border bg-dash-muted px-2 py-1 text-xs text-dash-text" />
                          </div>
                          <div className="flex items-center gap-1.5">
                            <label className="text-[10px] text-dash-text-muted shrink-0">Y:</label>
                            <input type="number" value={ann.y} onChange={(e) => updateAnnotation(ann.id, { y: +e.target.value })}
                              className="w-full rounded-md border border-dash-border bg-dash-muted px-2 py-1 text-xs text-dash-text" />
                          </div>
                          <div className="flex items-center gap-1.5">
                            <label className="text-[10px] text-dash-text-muted shrink-0">Size:</label>
                            <input type="number" value={ann.fontSize} min={6} max={120}
                              onChange={(e) => updateAnnotation(ann.id, { fontSize: +e.target.value })}
                              className="w-full rounded-md border border-dash-border bg-dash-muted px-2 py-1 text-xs text-dash-text" />
                          </div>
                          <div className="flex items-center gap-1.5">
                            <label className="text-[10px] text-dash-text-muted shrink-0">Color:</label>
                            <input type="color" value={ann.color}
                              onChange={(e) => updateAnnotation(ann.id, { color: e.target.value })}
                              className="h-6 w-full rounded border border-dash-border cursor-pointer" />
                          </div>
                        </div>
                      )}

                      {(ann.kind === 'image' || ann.kind === 'signature') && (
                        <div className="grid grid-cols-2 gap-2">
                          {ann.kind === 'image' && ann.previewUrl && (
                            <div className="col-span-2">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={ann.previewUrl} alt="Preview" className="h-12 rounded border border-dash-border object-contain" />
                            </div>
                          )}
                          {ann.kind === 'signature' && (
                            <div className="col-span-2">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={ann.dataUrl} alt="Signature" className="h-12 rounded border border-dash-border object-contain bg-white" />
                            </div>
                          )}
                          <div className="flex items-center gap-1.5">
                            <label className="text-[10px] text-dash-text-muted shrink-0">X:</label>
                            <input type="number" value={ann.x} onChange={(e) => updateAnnotation(ann.id, { x: +e.target.value })}
                              className="w-full rounded-md border border-dash-border bg-dash-muted px-2 py-1 text-xs text-dash-text" />
                          </div>
                          <div className="flex items-center gap-1.5">
                            <label className="text-[10px] text-dash-text-muted shrink-0">Y:</label>
                            <input type="number" value={ann.y} onChange={(e) => updateAnnotation(ann.id, { y: +e.target.value })}
                              className="w-full rounded-md border border-dash-border bg-dash-muted px-2 py-1 text-xs text-dash-text" />
                          </div>
                          <div className="flex items-center gap-1.5">
                            <label className="text-[10px] text-dash-text-muted shrink-0">W:</label>
                            <input type="number" value={ann.width} min={10}
                              onChange={(e) => updateAnnotation(ann.id, { width: +e.target.value })}
                              className="w-full rounded-md border border-dash-border bg-dash-muted px-2 py-1 text-xs text-dash-text" />
                          </div>
                          <div className="flex items-center gap-1.5">
                            <label className="text-[10px] text-dash-text-muted shrink-0">H:</label>
                            <input type="number" value={ann.height} min={10}
                              onChange={(e) => updateAnnotation(ann.id, { height: +e.target.value })}
                              className="w-full rounded-md border border-dash-border bg-dash-muted px-2 py-1 text-xs text-dash-text" />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/30 px-4 py-3">
                  <p className="text-xs text-blue-700 dark:text-blue-400">
                    Use the toolbar above to add text, images, or signatures to page {state.selectedPage}.
                    Set X/Y coordinates in PDF points (0,0 = top-left of the visible page area).
                  </p>
                </div>
              )}
            </>
          )}

          {state.error && <p className="text-xs text-red-500" data-testid="pdf-editor-error">{state.error}</p>}

          <button
            onClick={handleApply}
            disabled={!state.file || state.annotations.length === 0 || state.processing}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--im-primary)] px-4 py-2.5 text-sm font-semibold text-[var(--im-primary-fg)] shadow-sm transition hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="pdf-editor-btn"
          >
            {state.processing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Apply &amp; Download
              </>
            )}
          </button>
        </div>
      </div>

      {/* Signature Pad */}
      {state.showSignaturePad && (
        <SignaturePad
          onSave={addSignature}
          onCancel={() => setState((s) => ({ ...s, showSignaturePad: false }))}
        />
      )}

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
