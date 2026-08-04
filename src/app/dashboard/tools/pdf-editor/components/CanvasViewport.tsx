// SPDX-License-Identifier: Apache-2.0
/**
 * CanvasViewport Component
 *
 * Scrollable container that stacks PDF page views vertically (continuous mode)
 * or shows a single page (single-page mode).
 * Handles scroll-based page detection and virtual rendering.
 */

'use client';

import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import PageView from './PageView';
import { PageRenderer } from '../engine/page-renderer';
import { PAGE_GAP } from '../constants';
import type { Annotation, ToolType, PageMeta, ViewMode } from '../types';

interface CanvasViewportProps {
  totalPages: number;
  currentPage: number;
  onPageChange: (page: number) => void;
  zoom: number;
  viewMode: ViewMode;
  renderer: PageRenderer;
  pageMetadata: PageMeta[];
  annotations: Map<number, Annotation[]>;
  activeTool: ToolType;
  onAnnotationAdded: (annotation: Annotation) => void;
  onAnnotationModified: (
    annotationId: string,
    updates: Partial<Annotation>,
  ) => void;
  onAnnotationRemoved?: (annotationId: string) => void;
  onSelectionChanged: (ids: string[]) => void;
}

export default function CanvasViewport({
  totalPages,
  currentPage,
  onPageChange,
  zoom,
  viewMode,
  renderer,
  pageMetadata,
  annotations,
  activeTool,
  onAnnotationAdded,
  onAnnotationModified,
  onAnnotationRemoved,
  onSelectionChanged,
}: CanvasViewportProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [visiblePages, setVisiblePages] = useState<Set<number>>(
    () => new Set([currentPage]),
  );
  const isScrollingRef = useRef(false);
  const renderedVisiblePages = useMemo(
    () => (viewMode === 'single' ? new Set([currentPage]) : visiblePages),
    [currentPage, viewMode, visiblePages],
  );

  // Calculate which pages should be rendered (visible + buffer)
  const getVisibleRange = useCallback((): Set<number> => {
    if (viewMode === 'single') {
      return new Set([currentPage]);
    }

    const container = scrollRef.current;
    if (!container) return new Set([currentPage]);

    const { scrollTop, clientHeight } = container;
    const visible = new Set<number>();

    let cumulativeTop = 0;
    for (let i = 1; i <= totalPages; i++) {
      const meta = pageMetadata[i - 1];
      if (!meta) continue;

      const pageH = meta.height * zoom + PAGE_GAP;
      const pageTop = cumulativeTop;
      const pageBottom = cumulativeTop + pageH;

      // Check if page is in viewport (with buffer)
      const bufferPx = clientHeight; // 1 viewport height buffer
      if (
        pageBottom >= scrollTop - bufferPx &&
        pageTop <= scrollTop + clientHeight + bufferPx
      ) {
        visible.add(i);
      }

      cumulativeTop = pageBottom;
    }

    return visible;
  }, [viewMode, currentPage, totalPages, pageMetadata, zoom]);

  // Handle scroll events
  const handleScroll = useCallback(() => {
    if (viewMode === 'single') return;

    const container = scrollRef.current;
    if (!container) return;

    const newVisible = getVisibleRange();
    setVisiblePages(newVisible);

    // Detect which page is most visible
    const { scrollTop, clientHeight } = container;
    const viewportCenter = scrollTop + clientHeight / 2;

    let cumulativeTop = 0;
    for (let i = 1; i <= totalPages; i++) {
      const meta = pageMetadata[i - 1];
      if (!meta) continue;

      const pageH = meta.height * zoom + PAGE_GAP;
      const pageTop = cumulativeTop;
      const pageBottom = cumulativeTop + pageH;

      if (pageTop <= viewportCenter && pageBottom >= viewportCenter) {
        if (i !== currentPage && !isScrollingRef.current) {
          onPageChange(i);
        }
        break;
      }

      cumulativeTop = pageBottom;
    }
  }, [
    viewMode,
    getVisibleRange,
    totalPages,
    pageMetadata,
    zoom,
    currentPage,
    onPageChange,
  ]);

  // Scroll to page when currentPage changes externally
  useEffect(() => {
    if (viewMode === 'single') {
      return;
    }

    const container = scrollRef.current;
    if (!container) return;

    // Calculate scroll position for the target page
    let targetTop = 0;
    for (let i = 1; i < currentPage; i++) {
      const meta = pageMetadata[i - 1];
      if (!meta) continue;
      targetTop += meta.height * zoom + PAGE_GAP;
    }

    isScrollingRef.current = true;
    container.scrollTo({ top: targetTop, behavior: 'smooth' });

    // Reset the flag after scroll completes
    const timeout = setTimeout(() => {
      isScrollingRef.current = false;
    }, 500);

    return () => clearTimeout(timeout);
  }, [currentPage, viewMode]); // Only respond to page changes, not zoom

  // Update visible pages on zoom or viewMode change
  useEffect(() => {
    const timer = setTimeout(() => {
      setVisiblePages(getVisibleRange());
    }, 100);
    return () => clearTimeout(timer);
  }, [zoom, viewMode, getVisibleRange]);

  // Single page mode
  if (viewMode === 'single') {
    const pageMeta = pageMetadata[currentPage - 1];
    if (!pageMeta) return null;

    return (
      <div
        ref={scrollRef}
        className="flex-1 overflow-auto bg-gray-100 dark:bg-gray-900/50"
      >
        <div className="flex items-start justify-center p-6 min-h-full">
          <PageView
            key={currentPage}
            pageNumber={currentPage}
            pageMeta={pageMeta}
            zoom={zoom}
            renderer={renderer}
            annotations={annotations.get(currentPage) ?? []}
            activeTool={activeTool}
            onAnnotationAdded={onAnnotationAdded}
            onAnnotationModified={onAnnotationModified}
            onAnnotationRemoved={onAnnotationRemoved}
            onSelectionChanged={onSelectionChanged}
            isVisible={true}
          />
        </div>
      </div>
    );
  }

  // Continuous mode
  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-auto bg-gray-100 dark:bg-gray-900/50"
      onScroll={handleScroll}
    >
      <div className="flex flex-col items-center py-6">
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
          const pageMeta = pageMetadata[pageNum - 1];
          if (!pageMeta) return null;

          const isVisible = renderedVisiblePages.has(pageNum);
          const cssWidth = pageMeta.width * zoom;
          const cssHeight = pageMeta.height * zoom;

          return (
            <div
              key={pageNum}
              ref={undefined}
              style={{
                width: cssWidth,
                height: cssHeight,
                marginBottom: PAGE_GAP,
              }}
            >
              {isVisible ? (
                <PageView
                  pageNumber={pageNum}
                  pageMeta={pageMeta}
                  zoom={zoom}
                  renderer={renderer}
                  annotations={annotations.get(pageNum) ?? []}
                  activeTool={activeTool}
                  onAnnotationAdded={onAnnotationAdded}
                  onAnnotationModified={onAnnotationModified}
                  onAnnotationRemoved={onAnnotationRemoved}
                  onSelectionChanged={onSelectionChanged}
                  isVisible={true}
                />
              ) : (
                // Placeholder for non-visible pages (maintains scroll height)
                <div
                  className="w-full h-full bg-gray-200 dark:bg-gray-800 rounded shadow-sm"
                  style={{ width: cssWidth, height: cssHeight }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
