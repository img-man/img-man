// SPDX-License-Identifier: Apache-2.0
'use client';

/**
 * DS-7.3 — Image-to-SVG Vectorization Tool
 * Client-side edge-threshold tracing using Canvas.
 * Produces an SVG from a raster image by tracing contours.
 */

import { useState, useCallback, useRef } from 'react';
import { X, Upload, Download, Loader2, Image as ImageIcon, Library } from 'lucide-react';
import dynamic from 'next/dynamic';

const AssetPicker = dynamic(() => import('@/components/dashboard/asset-picker'), { ssr: false });

interface VectorizeConfig {
  threshold: number;   // luminance threshold 0-255
  smoothing: number;   // simplification tolerance
  colorCount: number;  // 1 = monochrome, >1 = posterize layers
  invert: boolean;
}

export interface VectorizeModalProps {
  onClose: () => void;
}

/* ── Tracing Helpers (exported for tests) ── */

/** Convert image data to binary luminance map */
export function toBinaryMap(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  threshold: number,
  invert: boolean,
): boolean[] {
  const map: boolean[] = new Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    const lum = data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114;
    const on = lum < threshold;
    map[i] = invert ? !on : on;
  }
  return map;
}

/** Simple contour trace (march from top-left, follow boundary clockwise) */
export function traceContours(
  binary: boolean[],
  width: number,
  height: number,
): Array<Array<{ x: number; y: number }>> {
  const visited = new Uint8Array(width * height);
  const contours: Array<Array<{ x: number; y: number }>> = [];

  // Directions: right, down, left, up
  const dx = [1, 0, -1, 0];
  const dy = [0, 1, 0, -1];

  const isOn = (x: number, y: number) =>
    x >= 0 && x < width && y >= 0 && y < height && binary[y * width + x];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (!binary[idx] || visited[idx]) continue;

      // Check if boundary pixel (at least one neighbor is off/oob)
      let isBoundary = false;
      for (let d = 0; d < 4; d++) {
        if (!isOn(x + dx[d], y + dy[d])) { isBoundary = true; break; }
      }
      if (!isBoundary) continue;

      // March boundary
      const contour: Array<{ x: number; y: number }> = [];
      let cx = x;
      let cy = y;
      let dir = 0;
      const maxSteps = width * height * 2;
      let steps = 0;

      do {
        const ci = cy * width + cx;
        visited[ci] = 1;
        contour.push({ x: cx, y: cy });

        // Turn right, then try forward, left, back
        const nextDir = (dir + 3) % 4; // right first
        let found = false;
        for (let t = 0; t < 4; t++) {
          const nd = (nextDir + t) % 4;
          const nx = cx + dx[nd];
          const ny = cy + dy[nd];
          if (isOn(nx, ny)) {
            cx = nx;
            cy = ny;
            dir = nd;
            found = true;
            break;
          }
        }
        if (!found) break;
        steps++;
      } while ((cx !== x || cy !== y) && steps < maxSteps);

      if (contour.length >= 4) contours.push(contour);
    }
  }
  return contours;
}

/** Douglas-Peucker line simplification */
export function simplify(
  points: Array<{ x: number; y: number }>,
  tolerance: number,
): Array<{ x: number; y: number }> {
  if (points.length <= 2) return points;

  const first = points[0];
  const last = points[points.length - 1];
  let maxDist = 0;
  let maxIdx = 0;

  for (let i = 1; i < points.length - 1; i++) {
    const d = pointLineDistance(points[i], first, last);
    if (d > maxDist) {
      maxDist = d;
      maxIdx = i;
    }
  }

  if (maxDist > tolerance) {
    const left = simplify(points.slice(0, maxIdx + 1), tolerance);
    const right = simplify(points.slice(maxIdx), tolerance);
    return [...left.slice(0, -1), ...right];
  }
  return [first, last];
}

function pointLineDistance(
  p: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Convert contours to SVG path data */
export function contoursToSvgPaths(
  contours: Array<Array<{ x: number; y: number }>>,
  tolerance: number,
): string[] {
  return contours.map((c) => {
    const simplified = simplify(c, tolerance);
    if (simplified.length < 2) return '';
    let d = `M ${simplified[0].x} ${simplified[0].y}`;
    for (let i = 1; i < simplified.length; i++) {
      d += ` L ${simplified[i].x} ${simplified[i].y}`;
    }
    d += ' Z';
    return d;
  }).filter(Boolean);
}

/** Build full SVG string */
export function buildSvg(
  width: number,
  height: number,
  paths: string[],
  fillColor: string = '#000',
): string {
  const pathEls = paths.map((d) => `  <path d="${d}" fill="${fillColor}" />`).join('\n');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">\n${pathEls}\n</svg>`;
}

export default function VectorizeModal({ onClose }: VectorizeModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [svgResult, setSvgResult] = useState<string | null>(null);
  const [config, setConfig] = useState<VectorizeConfig>({
    threshold: 128,
    smoothing: 2,
    colorCount: 1,
    invert: false,
  });
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);

  const loadImage = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return;
    setSourceFile(file);
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    setSourceUrl(URL.createObjectURL(file));
    setSvgResult(null);
    setError(null);
  }, [sourceUrl]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer.files[0]) loadImage(e.dataTransfer.files[0]);
    },
    [loadImage],
  );

  const handleVectorize = useCallback(async () => {
    if (!sourceUrl || !sourceFile) {
      setError('Please upload an image first.');
      return;
    }
    setProcessing(true);
    setError(null);
    try {
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = sourceUrl;
      });

      // Scale down if very large for performance
      const maxDim = 800;
      let w = img.naturalWidth;
      let h = img.naturalHeight;
      if (w > maxDim || h > maxDim) {
        const scale = maxDim / Math.max(w, h);
        w = Math.round(w * scale);
        h = Math.round(h * scale);
      }

      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, w, h);
      const imageData = ctx.getImageData(0, 0, w, h);

      const binary = toBinaryMap(imageData.data, w, h, config.threshold, config.invert);
      const contours = traceContours(binary, w, h);
      const paths = contoursToSvgPaths(contours, config.smoothing);
      const svg = buildSvg(w, h, paths);
      setSvgResult(svg);
    } catch (err) {
      setError(`Vectorization failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setProcessing(false);
    }
  }, [sourceUrl, sourceFile, config]);

  const downloadSvg = useCallback(() => {
    if (!svgResult) return;
    const blob = new Blob([svgResult], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'vectorized.svg';
    a.click();
    URL.revokeObjectURL(url);
  }, [svgResult]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div
        className="relative w-full max-w-2xl rounded-2xl border border-dash-border bg-dash-surface shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-dash-border px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-dash-text">Image → SVG Vectorizer</h2>
            <p className="text-xs text-dash-text-muted mt-0.5">
              Trace raster images to scalable vector graphics
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-dash-text-muted hover:bg-dash-surface-hover hover:text-dash-text transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Source selection */}
          <div className="flex gap-2">
            <div
              className="flex flex-1 items-center justify-center rounded-xl border-2 border-dashed border-dash-border bg-dash-muted hover:border-[var(--im-primary)]/60 h-24 cursor-pointer transition-colors"
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
              data-testid="vectorize-drop"
            >
              <div className="flex flex-col items-center gap-1 text-dash-text-muted">
                <Upload className="h-5 w-5" />
                <p className="text-xs font-medium">Upload image</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) loadImage(e.target.files[0]);
                  e.target.value = '';
                }}
              />
            </div>
            <button
              onClick={() => setShowPicker(true)}
              className="flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-dash-border bg-dash-muted hover:border-[var(--im-primary)]/60 hover:bg-[var(--im-primary-light)] h-24 w-36 cursor-pointer transition-colors text-dash-text-muted"
              data-testid="vectorize-browse"
            >
              <Library className="h-5 w-5" />
              <span className="text-xs font-medium">Browse Library</span>
            </button>
          </div>

          {/* Preview row */}
          {sourceUrl && (
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-dash-border p-2">
                <p className="text-[10px] font-medium text-dash-text-muted mb-1">Original</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={sourceUrl} alt="source" className="max-h-40 mx-auto object-contain" />
              </div>
              <div className="rounded-xl border border-dash-border p-2">
                <p className="text-[10px] font-medium text-dash-text-muted mb-1">SVG Preview</p>
                {svgResult ? (
                  <div
                    className="max-h-40 mx-auto overflow-hidden [&>svg]:max-w-full [&>svg]:max-h-40"
                    dangerouslySetInnerHTML={{ __html: svgResult }}
                    data-testid="vectorize-preview"
                  />
                ) : (
                  <div className="flex items-center justify-center h-32 text-dash-text-muted">
                    <ImageIcon className="h-8 w-8 opacity-30" />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Config */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-dash-text2 mb-1">
                Threshold: {config.threshold}
              </label>
              <input
                type="range"
                min={0}
                max={255}
                value={config.threshold}
                onChange={(e) => setConfig((c) => ({ ...c, threshold: +e.target.value }))}
                className="w-full"
                data-testid="vectorize-threshold"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-dash-text2 mb-1">
                Smoothing: {config.smoothing}
              </label>
              <input
                type="range"
                min={0}
                max={10}
                step={0.5}
                value={config.smoothing}
                onChange={(e) => setConfig((c) => ({ ...c, smoothing: +e.target.value }))}
                className="w-full"
                data-testid="vectorize-smoothing"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="vectorize-invert"
                checked={config.invert}
                onChange={(e) => setConfig((c) => ({ ...c, invert: e.target.checked }))}
                className="rounded"
                data-testid="vectorize-invert"
              />
              <label htmlFor="vectorize-invert" className="text-xs text-dash-text2">
                Invert black/white
              </label>
            </div>
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          {/* Hidden canvas for pixel processing */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={handleVectorize}
              disabled={!sourceFile || processing}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--im-primary)] px-4 py-2.5 text-sm font-semibold text-[var(--im-primary-fg)] shadow-sm transition hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="vectorize-btn"
            >
              {processing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Tracing…
                </>
              ) : (
                'Vectorize'
              )}
            </button>
            {svgResult && (
              <button
                onClick={downloadSvg}
                className="flex items-center gap-2 rounded-xl border border-dash-border px-4 py-2.5 text-sm font-medium text-dash-text hover:bg-dash-surface-hover transition-colors"
                data-testid="vectorize-download"
              >
                <Download className="h-4 w-4" />
                Download SVG
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Asset Picker overlay */}
      {showPicker && (
        <AssetPicker
          accept="image/*"
          multiple={false}
          onClose={() => setShowPicker(false)}
          onSelect={(files) => {
            setShowPicker(false);
            if (files[0]) loadImage(files[0]);
          }}
        />
      )}
    </div>
  );
}
