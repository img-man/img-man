// SPDX-License-Identifier: Apache-2.0
'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  Loader2,
  FileEdit,
  Download,
  AlertCircle,
} from 'lucide-react';

/* ─── Types ──────────────────────────────────────────────── */

interface PdfViewerProps {
  /** Signed GCS URL for the PDF */
  src: string;
  /** File name */
  name: string;
  /** Pre-extracted page count (optional) */
  pageCount?: number;
  /** Asset ID — for "Edit PDF" navigation */
  assetId: string;
}

/* ─── PDF.js loader (lazy) ───────────────────────────────── */

let pdfjsLib: typeof import('pdfjs-dist') | null = null;

const PDFJS_CMAP_URL = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@5.5.207/cmaps/';
const PDFJS_WORKER_SRC = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

async function getPdfjs() {
  if (pdfjsLib) return pdfjsLib;
  pdfjsLib = await import('pdfjs-dist');
  if (typeof window !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_SRC;
  }
  return pdfjsLib;
}

/* ─── Zoom presets ───────────────────────────────────────── */

const ZOOM_LEVELS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];
const DEFAULT_ZOOM_INDEX = 2; // 1x

/* ─── Component ──────────────────────────────────────────── */

export function PdfViewer({ src, name, pageCount, assetId }: PdfViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfDocRef = useRef<any>(null);
  const renderTaskRef = useRef<{ cancel: () => void } | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(pageCount ?? 0);
  const [zoomIdx, setZoomIdx] = useState(DEFAULT_ZOOM_INDEX);
  const [fitMode, setFitMode] = useState<'width' | 'custom'>('width');

  const zoom = ZOOM_LEVELS[zoomIdx];

  /* ─── Load PDF document ─────────────────────────────── */
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const pdfjs = await getPdfjs();
        const loadingTask = pdfjs.getDocument({
          url: src,
          cMapUrl: PDFJS_CMAP_URL,
          cMapPacked: true,
          enableXfa: true,
        });
        const doc = await loadingTask.promise;
        if (cancelled) return;
        pdfDocRef.current = doc;
        setTotalPages(doc.numPages);
        setCurrentPage(1);
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        console.error('[PdfViewer] Failed to load PDF:', err);
        setError(
          'Failed to load PDF. The file may be corrupted or access has expired.',
        );
        setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [src]);

  /* ─── Render current page ───────────────────────────── */
  const renderPage = useCallback(async () => {
    const doc = pdfDocRef.current;
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!doc || !canvas || !container) return;

    try {
      // Cancel any in-progress render
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
        renderTaskRef.current = null;
      }

      const page = await doc.getPage(currentPage);
      const viewport = page.getViewport({ scale: 1 });

      // Determine the render scale
      let scale: number;
      if (fitMode === 'width') {
        const containerWidth = container.clientWidth - 32; // padding
        scale = containerWidth / viewport.width;
      } else {
        scale = zoom;
      }

      const scaledViewport = page.getViewport({ scale });
      canvas.width = scaledViewport.width;
      canvas.height = scaledViewport.height;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const renderTask = page.render({
        canvasContext: ctx,
        viewport: scaledViewport,
      });
      renderTaskRef.current = renderTask;
      await renderTask.promise;
      renderTaskRef.current = null;
    } catch (err) {
      // RenderingCancelled is expected when switching pages quickly
      if ((err as Error)?.message?.includes('Rendering cancelled')) return;
      console.error('[PdfViewer] Render error:', err);
    }
  }, [currentPage, zoom, fitMode]);

  useEffect(() => {
    if (!loading && !error) {
      renderPage();
    }
  }, [loading, error, renderPage]);

  // Re-render on container resize
  useEffect(() => {
    if (fitMode !== 'width') return;
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => renderPage());
    observer.observe(container);
    return () => observer.disconnect();
  }, [fitMode, renderPage]);

  /* ─── Navigation ────────────────────────────────────── */
  const goPrev = () => setCurrentPage((p) => Math.max(1, p - 1));
  const goNext = () => setCurrentPage((p) => Math.min(totalPages, p + 1));

  const handleZoomIn = () => {
    setFitMode('custom');
    setZoomIdx((i) => Math.min(ZOOM_LEVELS.length - 1, i + 1));
  };
  const handleZoomOut = () => {
    setFitMode('custom');
    setZoomIdx((i) => Math.max(0, i - 1));
  };
  const toggleFitMode = () => {
    setFitMode((m) => (m === 'width' ? 'custom' : 'width'));
  };

  /* ─── Keyboard shortcuts ────────────────────────────── */
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        goPrev();
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        goNext();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalPages]);

  /* ─── Render ────────────────────────────────────────── */

  if (loading) {
    return (
      <div className="flex w-full flex-col items-center gap-3 py-12">
        <Loader2 className="h-8 w-8 animate-spin text-dash-text-muted" />
        <p className="text-xs text-dash-text-muted">Loading PDF…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex w-full flex-col items-center gap-3 rounded-xl bg-red-50 py-8 dark:bg-red-950/30">
        <AlertCircle className="h-10 w-10 text-red-400" />
        <p className="max-w-[85%] text-center text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
        {src && (
          <a
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-red-100 px-4 py-2 text-xs font-medium text-red-700 transition hover:bg-red-200 dark:bg-red-900/40 dark:text-red-300"
          >
            <Download className="h-3.5 w-3.5" />
            Download instead
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-2">
      {/* Toolbar */}
      <div className="flex items-center justify-between rounded-lg bg-dash-surface2 px-3 py-1.5">
        {/* Page navigation */}
        <div className="flex items-center gap-1">
          <button
            onClick={goPrev}
            disabled={currentPage <= 1}
            className="rounded p-1 text-dash-text-muted transition hover:bg-dash-surface-hover hover:text-dash-text disabled:opacity-30"
            title="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[4rem] text-center text-xs font-medium text-dash-text">
            {currentPage} / {totalPages}
          </span>
          <button
            onClick={goNext}
            disabled={currentPage >= totalPages}
            className="rounded p-1 text-dash-text-muted transition hover:bg-dash-surface-hover hover:text-dash-text disabled:opacity-30"
            title="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Zoom controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={handleZoomOut}
            disabled={fitMode === 'width' || zoomIdx <= 0}
            className="rounded p-1 text-dash-text-muted transition hover:bg-dash-surface-hover hover:text-dash-text disabled:opacity-30"
            title="Zoom out"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <span className="min-w-[3rem] text-center text-[10px] font-medium text-dash-text-muted">
            {fitMode === 'width' ? 'Fit' : `${Math.round(zoom * 100)}%`}
          </span>
          <button
            onClick={handleZoomIn}
            disabled={fitMode === 'custom' && zoomIdx >= ZOOM_LEVELS.length - 1}
            className="rounded p-1 text-dash-text-muted transition hover:bg-dash-surface-hover hover:text-dash-text disabled:opacity-30"
            title="Zoom in"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={toggleFitMode}
            className="ml-1 rounded p-1 text-dash-text-muted transition hover:bg-dash-surface-hover hover:text-dash-text"
            title={
              fitMode === 'width' ? 'Switch to manual zoom' : 'Fit to width'
            }
          >
            {fitMode === 'width' ? (
              <Maximize2 className="h-3.5 w-3.5" />
            ) : (
              <Minimize2 className="h-3.5 w-3.5" />
            )}
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          <a
            href={`/dashboard/tools?tool=pdf-editor&assetId=${assetId}`}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium text-dash-text-muted transition hover:bg-dash-surface-hover hover:text-dash-text"
            title="Edit PDF"
          >
            <FileEdit className="h-3 w-3" />
            Edit
          </a>
        </div>
      </div>

      {/* Canvas area */}
      <div
        ref={containerRef}
        className="max-h-96 overflow-auto rounded-lg border border-dash-border bg-gray-100 p-4 dark:bg-gray-900"
      >
        <canvas ref={canvasRef} className="mx-auto rounded shadow-sm" />
      </div>

      {/* File name */}
      <p className="max-w-full truncate text-center text-[11px] font-medium text-dash-text2">
        {name}
      </p>
    </div>
  );
}
