// SPDX-License-Identifier: Apache-2.0
'use client';

import { Download } from 'lucide-react';

/* ─── Types ──────────────────────────────────────────────────────────── */
export type ExportFormat = 'png' | 'jpeg' | 'webp' | 'svg' | 'pdf';

interface ExportDialogProps {
  open: boolean;
  onClose: () => void;
  /** Canvas dimensions for the scale preview label */
  designWidth: number;
  designHeight: number;
  /** Export settings (controlled from parent) */
  format: ExportFormat;
  onFormatChange: (f: ExportFormat) => void;
  scale: number;
  onScaleChange: (s: number) => void;
  quality: number;
  onQualityChange: (q: number) => void;
  transparent: boolean;
  onTransparentChange: (t: boolean) => void;
  /** Triggers the actual export */
  onExport: () => void;
}

/* ─── Component ──────────────────────────────────────────────────────── */
export default function ExportDialog({
  open,
  onClose,
  designWidth,
  designHeight,
  format,
  onFormatChange,
  scale,
  onScaleChange,
  quality,
  onQualityChange,
  transparent,
  onTransparentChange,
  onExport,
}: ExportDialogProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-[400px] rounded-xl border border-dash-border bg-dash-surface p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-4 text-sm font-semibold text-dash-text">
          Export Design
        </h3>

        {/* Format selector */}
        <label className="mb-1 block text-[11px] font-medium text-dash-text2">
          Format
        </label>
        <div className="mb-4 flex gap-1.5">
          {(['png', 'jpeg', 'webp', 'svg', 'pdf'] as const).map((f) => (
            <button
              key={f}
              onClick={() => onFormatChange(f)}
              className={`flex-1 rounded-lg border px-2 py-1.5 text-[11px] font-medium uppercase transition-colors ${
                format === f
                  ? 'border-[var(--im-primary)] bg-[var(--im-primary)]/10 text-[var(--im-primary)]'
                  : 'border-dash-border text-dash-text2 hover:bg-dash-muted'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Scale selector (raster only) */}
        {format !== 'svg' && format !== 'pdf' && (
          <>
            <label className="mb-1 block text-[11px] font-medium text-dash-text2">
              Scale ({designWidth * scale}×{designHeight * scale}px)
            </label>
            <div className="mb-4 flex gap-1.5">
              {[1, 2, 3, 4].map((s) => (
                <button
                  key={s}
                  onClick={() => onScaleChange(s)}
                  className={`flex-1 rounded-lg border px-2 py-1.5 text-[11px] font-medium transition-colors ${
                    scale === s
                      ? 'border-[var(--im-primary)] bg-[var(--im-primary)]/10 text-[var(--im-primary)]'
                      : 'border-dash-border text-dash-text2 hover:bg-dash-muted'
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>
          </>
        )}

        {/* Quality slider (JPEG/WebP) */}
        {(format === 'jpeg' || format === 'webp') && (
          <>
            <label className="mb-1 block text-[11px] font-medium text-dash-text2">
              Quality: {quality}%
            </label>
            <input
              type="range"
              min={10}
              max={100}
              step={5}
              value={quality}
              onChange={(e) => onQualityChange(Number(e.target.value))}
              className="mb-4 w-full accent-[var(--im-primary)]"
            />
          </>
        )}

        {/* Transparent background (PNG/WebP) */}
        {(format === 'png' || format === 'webp') && (
          <label className="mb-4 flex items-center gap-2 text-[11px] text-dash-text2">
            <input
              type="checkbox"
              checked={transparent}
              onChange={(e) => onTransparentChange(e.target.checked)}
              className="accent-[var(--im-primary)]"
            />
            Transparent background
          </label>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-dash-border px-4 py-1.5 text-xs font-medium text-dash-text2 hover:bg-dash-muted transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onExport}
            className="rounded-lg bg-[var(--im-primary)] px-4 py-1.5 text-xs font-medium text-[var(--im-primary-fg)] hover:bg-[var(--im-primary)]/90 transition-colors"
          >
            <Download size={12} className="mr-1.5 inline" />
            Export {format.toUpperCase()}
          </button>
        </div>
      </div>
    </div>
  );
}
