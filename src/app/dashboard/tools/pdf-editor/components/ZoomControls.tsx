// SPDX-License-Identifier: Apache-2.0
/**
 * ZoomControls Component
 *
 * Zoom bar with in/out buttons, fit-to-width, fit-to-page, and actual size.
 */

'use client';

import { ZoomIn, ZoomOut, Maximize2, ScanLine, Fullscreen } from 'lucide-react';

interface ZoomControlsProps {
  zoom: number;
  zoomLabel: string;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitWidth: () => void;
  onFitPage: () => void;
  onActualSize: () => void;
  presets: readonly number[];
  onSetZoom: (zoom: number) => void;
}

export default function ZoomControls({
  zoom,
  zoomLabel,
  onZoomIn,
  onZoomOut,
  onFitWidth,
  onFitPage,
  onActualSize,
  presets,
  onSetZoom,
}: ZoomControlsProps) {
  return (
    <div className="flex items-center gap-1">
      {/* Zoom Out */}
      <button
        onClick={onZoomOut}
        disabled={zoom <= 0.25}
        className="rounded-md p-1.5 text-dash-text-muted hover:bg-dash-surface-hover hover:text-dash-text disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        title="Zoom Out (Ctrl+−)"
      >
        <ZoomOut className="h-4 w-4" />
      </button>

      {/* Zoom Level Dropdown */}
      <div className="relative">
        <select
          value={zoom}
          onChange={(e) => onSetZoom(Number(e.target.value))}
          className="appearance-none rounded-md border border-dash-border bg-dash-surface px-2 py-1 text-xs font-mono text-dash-text cursor-pointer hover:bg-dash-surface-hover min-w-[60px] text-center"
          title="Zoom Level"
        >
          {presets.map((p) => (
            <option key={p} value={p}>
              {Math.round(p * 100)}%
            </option>
          ))}
        </select>
      </div>

      {/* Zoom In */}
      <button
        onClick={onZoomIn}
        disabled={zoom >= 4.0}
        className="rounded-md p-1.5 text-dash-text-muted hover:bg-dash-surface-hover hover:text-dash-text disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        title="Zoom In (Ctrl++)"
      >
        <ZoomIn className="h-4 w-4" />
      </button>

      <div className="w-px h-4 bg-dash-border mx-1" />

      {/* Fit Width */}
      <button
        onClick={onFitWidth}
        className="rounded-md p-1.5 text-dash-text-muted hover:bg-dash-surface-hover hover:text-dash-text transition-colors"
        title="Fit Width"
      >
        <ScanLine className="h-4 w-4" />
      </button>

      {/* Fit Page */}
      <button
        onClick={onFitPage}
        className="rounded-md p-1.5 text-dash-text-muted hover:bg-dash-surface-hover hover:text-dash-text transition-colors"
        title="Fit Page (Ctrl+0)"
      >
        <Maximize2 className="h-4 w-4" />
      </button>

      {/* Actual Size */}
      <button
        onClick={onActualSize}
        className="rounded-md p-1.5 text-dash-text-muted hover:bg-dash-surface-hover hover:text-dash-text transition-colors text-[10px] font-bold font-mono"
        title="Actual Size (Ctrl+1)"
      >
        1:1
      </button>
    </div>
  );
}
