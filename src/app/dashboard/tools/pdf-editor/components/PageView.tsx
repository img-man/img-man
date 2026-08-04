// SPDX-License-Identifier: Apache-2.0
/**
 * PageView Component
 *
 * Renders a single PDF page with a Fabric.js overlay canvas.
 * This is the dual-layer architecture: PDF.js canvas (read) + Fabric.js canvas (write).
 */

'use client';

import { useRef, useEffect, useState, useCallback, memo } from 'react';
import { Loader2 } from 'lucide-react';
import { PageRenderer } from '../engine/page-renderer';
import { useFabricCanvas } from '../hooks/useFabricCanvas';
import type { Annotation, ToolType, PageMeta } from '../types';

interface PageViewProps {
  pageNumber: number;
  pageMeta: PageMeta;
  zoom: number;
  renderer: PageRenderer;
  annotations: Annotation[];
  activeTool: ToolType;
  onAnnotationAdded: (annotation: Annotation) => void;
  onAnnotationModified: (
    annotationId: string,
    updates: Partial<Annotation>,
  ) => void;
  onAnnotationRemoved?: (annotationId: string) => void;
  onSelectionChanged: (ids: string[]) => void;
  isVisible: boolean;
}

function PageViewInner({
  pageNumber,
  pageMeta,
  zoom,
  renderer,
  annotations,
  activeTool,
  onAnnotationAdded,
  onAnnotationModified,
  onAnnotationRemoved,
  onSelectionChanged,
  isVisible,
}: PageViewProps) {
  const pdfCanvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isRendering, setIsRendering] = useState(true);
  const [renderError, setRenderError] = useState<string | null>(null);
  const prevAnnotationIdsRef = useRef<string>('');

  const {
    initCanvas,
    disposeCanvas,
    isReady: fabricReady,
    addAnnotationToCanvas,
    removeFromCanvas,
    clearCanvas,
    setToolMode,
    resizeCanvas,
  } = useFabricCanvas(
    pageNumber,
    onAnnotationAdded,
    onAnnotationModified,
    onSelectionChanged,
    onAnnotationRemoved,
  );

  // Compute dimensions
  const cssWidth = pageMeta.width * zoom;
  const cssHeight = pageMeta.height * zoom;

  // Render PDF page
  useEffect(() => {
    if (!isVisible || !pdfCanvasRef.current) return;

    let cancelled = false;

    const renderPage = async () => {
      setIsRendering(true);
      setRenderError(null);

      try {
        await renderer.renderPage(pageNumber, zoom, pdfCanvasRef.current!);
        if (!cancelled) {
          setIsRendering(false);
        }
      } catch (err) {
        if (!cancelled) {
          // RenderingCancelled is expected when zoom changes rapidly
          const msg = err instanceof Error ? err.message : '';
          if (!msg.includes('Rendering cancelled')) {
            setRenderError(`Failed to render page ${pageNumber}`);
          }
          setIsRendering(false);
        }
      }
    };

    renderPage();

    return () => {
      cancelled = true;
      renderer.cancelRender(pageNumber);
    };
  }, [pageNumber, zoom, renderer, isVisible]);

  // Initialize Fabric.js canvas
  useEffect(() => {
    if (!isVisible || !fabricCanvasRef.current) return;

    const init = async () => {
      await initCanvas(fabricCanvasRef.current!, cssWidth, cssHeight);
    };
    init();

    return () => {
      disposeCanvas();
    };
  }, [isVisible]); // Only re-init when visibility changes

  // Resize Fabric canvas when zoom changes
  useEffect(() => {
    if (fabricReady) {
      resizeCanvas(cssWidth, cssHeight);
    }
  }, [cssWidth, cssHeight, fabricReady, resizeCanvas]);

  // Sync tool mode
  useEffect(() => {
    if (fabricReady) {
      setToolMode(activeTool);
    }
  }, [activeTool, fabricReady, setToolMode]);

  // Sync annotations to Fabric canvas
  useEffect(() => {
    if (!fabricReady) return;

    const currentIds = annotations.map((a) => a.id).join(',');
    if (currentIds === prevAnnotationIdsRef.current) return;
    prevAnnotationIdsRef.current = currentIds;

    // Rebuild all annotations on the canvas
    clearCanvas();
    for (const ann of annotations) {
      addAnnotationToCanvas(ann, zoom);
    }
  }, [annotations, fabricReady, zoom, clearCanvas, addAnnotationToCanvas]);

  return (
    <div
      ref={containerRef}
      className="relative mx-auto shadow-lg"
      style={{ width: cssWidth, height: cssHeight }}
      data-page={pageNumber}
    >
      {/* Layer 1: PDF.js render (background, read-only) */}
      <canvas
        ref={pdfCanvasRef}
        className="absolute inset-0"
        style={{ width: cssWidth, height: cssHeight }}
      />

      {/* Layer 2: Fabric.js canvas (foreground, interactive) */}
      <canvas
        ref={fabricCanvasRef}
        className="absolute inset-0"
        style={{ width: cssWidth, height: cssHeight }}
      />

      {/* Loading overlay */}
      {isRendering && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-gray-900/80 z-10">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-[var(--im-primary)]" />
            <span className="text-xs text-dash-text-muted">
              Rendering page {pageNumber}...
            </span>
          </div>
        </div>
      )}

      {/* Error overlay */}
      {renderError && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-50 dark:bg-red-950/30 z-10">
          <span className="text-xs text-red-500">{renderError}</span>
        </div>
      )}
    </div>
  );
}

const PageView = memo(PageViewInner);
export default PageView;
