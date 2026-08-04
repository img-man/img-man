// SPDX-License-Identifier: Apache-2.0
/**
 * Page Renderer Engine
 *
 * Renders PDF pages to HTML canvas elements using PDF.js.
 * Handles high-DPI scaling, page caching, and render cancellation.
 */

import { getPage, getPageViewport } from './pdf-loader';

/* ──────────────────────── Types ──────────────────────── */

export interface RenderResult {
  pageNumber: number;
  canvas: HTMLCanvasElement;
  width: number; // CSS pixels
  height: number; // CSS pixels
  scale: number;
}

interface RenderTask {
  pageNumber: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  task: any; // PDF.js RenderTask
}

/* ──────────────────────── Renderer Class ──────────────────────── */

/**
 * Manages rendering PDF pages to canvases.
 * Supports cancellation and DPI awareness.
 */
export class PageRenderer {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private document: any;
  private activeTasks: Map<number, RenderTask> = new Map();
  private dpr: number;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(document: any) {
    this.document = document;
    this.dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  }

  /**
   * Render a single page to a canvas element.
   *
   * @param pageNumber - 1-based page number
   * @param scale - Zoom level (1.0 = 100%)
   * @param canvas - Target canvas element (will be sized appropriately)
   * @returns The render result with dimensions
   */
  async renderPage(
    pageNumber: number,
    scale: number,
    canvas: HTMLCanvasElement,
  ): Promise<RenderResult> {
    // Cancel any existing render for this page
    this.cancelRender(pageNumber);

    const page = await getPage(this.document, pageNumber);
    const viewport = getPageViewport(page, scale);

    // Account for device pixel ratio for crisp rendering
    const outputScale = this.dpr;
    const cssWidth = viewport.width;
    const cssHeight = viewport.height;

    canvas.width = Math.floor(cssWidth * outputScale);
    canvas.height = Math.floor(cssHeight * outputScale);
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2D context');

    // Scale for DPI
    ctx.setTransform(outputScale, 0, 0, outputScale, 0, 0);

    const renderTask = page.render({
      canvasContext: ctx,
      viewport,
    });

    this.activeTasks.set(pageNumber, { pageNumber, task: renderTask });

    try {
      await renderTask.promise;
    } finally {
      this.activeTasks.delete(pageNumber);
    }

    return {
      pageNumber,
      canvas,
      width: cssWidth,
      height: cssHeight,
      scale,
    };
  }

  /**
   * Render a page at a low resolution for thumbnails.
   *
   * @param pageNumber - 1-based page number
   * @param thumbScale - Scale for thumbnail (e.g., 0.2 for 20%)
   * @returns A new canvas element with the rendered thumbnail
   */
  async renderThumbnail(
    pageNumber: number,
    thumbScale: number = 0.2,
  ): Promise<HTMLCanvasElement> {
    const page = await getPage(this.document, pageNumber);
    const viewport = getPageViewport(page, thumbScale);

    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2D context for thumbnail');

    await page.render({
      canvasContext: ctx,
      viewport,
    }).promise;

    return canvas;
  }

  /**
   * Cancel an in-progress render for a page.
   */
  cancelRender(pageNumber: number): void {
    const task = this.activeTasks.get(pageNumber);
    if (task) {
      try {
        task.task.cancel();
      } catch {
        // Render task may already be complete — ignore
      }
      this.activeTasks.delete(pageNumber);
    }
  }

  /**
   * Cancel all active renders.
   */
  cancelAll(): void {
    for (const [pageNum] of this.activeTasks) {
      this.cancelRender(pageNum);
    }
  }

  /**
   * Clean up resources.
   */
  destroy(): void {
    this.cancelAll();
    this.document = null;
  }
}
