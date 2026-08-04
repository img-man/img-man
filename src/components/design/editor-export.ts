// SPDX-License-Identifier: Apache-2.0
/**
 * Pure-ish export pipeline for the Design Studio canvas.
 *
 * Extracted from `editor.tsx` (D33 surgical split). Keeping the
 * rasterization, SVG cleanup, and PDF window logic here makes the
 * format matrix independently testable for D38.
 */

export type DesignExportFormat = 'png' | 'jpeg' | 'webp' | 'svg' | 'pdf';

export interface DesignExportOptions {
  format: DesignExportFormat;
  /** Pixel scale for raster formats. 1 = native design size. */
  scale: number;
  /** JPEG/WebP quality 1–100. Ignored for PNG/SVG. */
  quality: number;
  /** When true, raster PNG/WebP exports omit the background fill. */
  transparent: boolean;
  /** Display name (without extension) for the downloaded file. */
  fileName?: string;
}

export interface DesignExportContext {
  width: number;
  height: number;
  background?: string;
}

const RASTER_MIME: Record<'png' | 'jpeg' | 'webp', string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};

/**
 * Trigger a download of the current `<svg>` canvas in the requested format.
 * Returns a promise that resolves once the download has been initiated and
 * any temporary object URLs revoked.
 */
export async function exportDesignFromSvg(
  svg: SVGSVGElement,
  ctx: DesignExportContext,
  options: DesignExportOptions,
): Promise<void> {
  const { format, scale, quality, transparent } = options;
  const baseName = options.fileName?.trim() || 'design';

  if (format === 'pdf') {
    const win = window.open('', '_blank');
    if (!win) throw new Error('PDF export blocked: popup window denied.');
    const svgStr = new XMLSerializer().serializeToString(svg);
    win.document.write(
      `<!DOCTYPE html><html><head><style>` +
        `@page{margin:0}body{margin:0}` +
        `svg{width:100vw;height:100vh;display:block}` +
        `</style></head><body>${svgStr}</body></html>`,
    );
    win.document.close();
    win.print();
    return;
  }

  if (format === 'svg') {
    const svgStr = serializeSvgForExport(svg);
    const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
    triggerDownload(blob, `${baseName}.svg`);
    return;
  }

  const mime = RASTER_MIME[format];
  const dataUrl = await rasterizeSvg(svg, ctx, {
    scale,
    quality: quality / 100,
    transparent,
    mime,
    forceFill: format === 'jpeg',
  });
  const a = document.createElement('a');
  a.download = `${baseName}.${format}`;
  a.href = dataUrl;
  a.click();
}

/** Serialize an SVG with editor-only markup (selection handles, snap guides) stripped. */
export function serializeSvgForExport(svg: SVGSVGElement): string {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone
    .querySelectorAll('[data-handle], [data-ui]')
    .forEach((n) => n.remove());
  return new XMLSerializer().serializeToString(clone);
}

interface RasterizeOptions {
  scale: number;
  /** 0–1 quality for JPEG/WebP. */
  quality: number;
  transparent: boolean;
  mime: string;
  /** JPEG must always have a background fill even if transparent=true. */
  forceFill: boolean;
}

function rasterizeSvg(
  svg: SVGSVGElement,
  ctx: DesignExportContext,
  options: RasterizeOptions,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const svgStr = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(ctx.width * options.scale));
        canvas.height = Math.max(1, Math.round(ctx.height * options.scale));
        const c2d = canvas.getContext('2d');
        if (!c2d) throw new Error('2D canvas context unavailable');
        if (options.forceFill || !options.transparent) {
          c2d.fillStyle = ctx.background || '#ffffff';
          c2d.fillRect(0, 0, canvas.width, canvas.height);
        }
        c2d.scale(options.scale, options.scale);
        c2d.drawImage(img, 0, 0);
        resolve(canvas.toDataURL(options.mime, options.quality));
      } catch (err) {
        reject(err);
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to rasterize SVG'));
    };
    img.src = url;
  });
}

function triggerDownload(blob: Blob, fileName: string): void {
  const a = document.createElement('a');
  a.download = fileName;
  a.href = URL.createObjectURL(blob);
  a.click();
  URL.revokeObjectURL(a.href);
}

/** All supported export formats in canonical UI order. */
export const DESIGN_EXPORT_FORMATS: readonly DesignExportFormat[] = [
  'png',
  'jpeg',
  'webp',
  'svg',
  'pdf',
] as const;
