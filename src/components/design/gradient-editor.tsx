// SPDX-License-Identifier: Apache-2.0
'use client';

/**
 * DS-3.3 — Gradient & Pattern Fill Editor
 *
 * A standalone panel component + pure types/helpers for working with
 * gradient and pattern fills on design elements.
 *
 * Features:
 *  • Linear gradient: direction angle + color stops
 *  • Radial gradient: center + radius + color stops
 *  • Pattern fill: tile an image across the shape
 *  • Color stop editing: add / remove / reposition / recolor
 *  • SVG `<defs>` generation for inline gradient definitions
 */

import { useCallback, useState, useMemo } from 'react';
import { Plus, Trash2, RotateCw } from 'lucide-react';

/* ================================================================== */
/*  Types                                                              */
/* ================================================================== */

export interface GradientStop {
  offset: number; // 0–1
  color: string;
}

export interface LinearGradient {
  type: 'linear';
  angle: number; // degrees, 0 = left→right, 90 = top→bottom
  stops: GradientStop[];
}

export interface RadialGradient {
  type: 'radial';
  cx: number; // 0–1 relative
  cy: number; // 0–1 relative
  r: number; // 0–1 relative radius
  stops: GradientStop[];
}

export interface PatternFill {
  type: 'pattern';
  imageUrl: string;
  scaleX: number;
  scaleY: number;
}

export type GradientFill = LinearGradient | RadialGradient | PatternFill;

export type FillType = 'solid' | 'linear' | 'radial' | 'pattern';

export const FILL_TYPES: { value: FillType; label: string }[] = [
  { value: 'solid', label: 'Solid' },
  { value: 'linear', label: 'Linear Gradient' },
  { value: 'radial', label: 'Radial Gradient' },
  { value: 'pattern', label: 'Pattern' },
];

/* ================================================================== */
/*  Defaults                                                           */
/* ================================================================== */

export function defaultLinearGradient(): LinearGradient {
  return {
    type: 'linear',
    angle: 90,
    stops: [
      { offset: 0, color: '#6366f1' },
      { offset: 1, color: '#ec4899' },
    ],
  };
}

export function defaultRadialGradient(): RadialGradient {
  return {
    type: 'radial',
    cx: 0.5,
    cy: 0.5,
    r: 0.5,
    stops: [
      { offset: 0, color: '#6366f1' },
      { offset: 1, color: '#ec4899' },
    ],
  };
}

export function defaultPatternFill(): PatternFill {
  return {
    type: 'pattern',
    imageUrl: '',
    scaleX: 1,
    scaleY: 1,
  };
}

/* ================================================================== */
/*  SVG generation                                                     */
/* ================================================================== */

/**
 * Convert angle (degrees) to SVG `linearGradient` x1/y1/x2/y2 (0–1).
 */
export function angleToGradientCoords(angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  const x1 = 0.5 - Math.cos(rad) * 0.5;
  const y1 = 0.5 - Math.sin(rad) * 0.5;
  const x2 = 0.5 + Math.cos(rad) * 0.5;
  const y2 = 0.5 + Math.sin(rad) * 0.5;
  return { x1, y1, x2, y2 };
}

/**
 * Generate a unique gradient ID based on element ID.
 */
export function gradientId(elementId: string): string {
  return `grad-${elementId}`;
}

/**
 * Create SVG `<defs>` markup for a gradient fill.
 */
export function gradientDefsMarkup(
  fill: GradientFill,
  elementId: string,
): string {
  const id = gradientId(elementId);

  if (fill.type === 'linear') {
    const { x1, y1, x2, y2 } = angleToGradientCoords(fill.angle);
    const stops = fill.stops
      .map(
        (s) =>
          `<stop offset="${s.offset}" stop-color="${s.color}" />`,
      )
      .join('');
    return `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops}</linearGradient>`;
  }

  if (fill.type === 'radial') {
    const stops = fill.stops
      .map(
        (s) =>
          `<stop offset="${s.offset}" stop-color="${s.color}" />`,
      )
      .join('');
    return `<radialGradient id="${id}" cx="${fill.cx}" cy="${fill.cy}" r="${fill.r}">${stops}</radialGradient>`;
  }

  if (fill.type === 'pattern') {
    return `<pattern id="${id}" patternUnits="userSpaceOnUse" width="${64 * fill.scaleX}" height="${64 * fill.scaleY}"><image href="${fill.imageUrl}" width="${64 * fill.scaleX}" height="${64 * fill.scaleY}" /></pattern>`;
  }

  return '';
}

/**
 * Return the `fill` attribute value for an element with gradient fill.
 * Returns `url(#grad-<id>)` for gradient/pattern, or the solid color.
 */
export function gradientFillAttr(
  fill: GradientFill | null | undefined,
  solidColor: string,
  elementId: string,
): string {
  if (!fill) return solidColor;
  return `url(#${gradientId(elementId)})`;
}

/**
 * Create a CSS background string for previewing a gradient in the UI.
 */
export function gradientToCSS(fill: GradientFill): string {
  if (fill.type === 'linear') {
    const stops = fill.stops
      .map((s) => `${s.color} ${Math.round(s.offset * 100)}%`)
      .join(', ');
    return `linear-gradient(${fill.angle}deg, ${stops})`;
  }
  if (fill.type === 'radial') {
    const stops = fill.stops
      .map((s) => `${s.color} ${Math.round(s.offset * 100)}%`)
      .join(', ');
    return `radial-gradient(circle at ${fill.cx * 100}% ${fill.cy * 100}%, ${stops})`;
  }
  if (fill.type === 'pattern') {
    return fill.imageUrl ? `url(${fill.imageUrl})` : '#999';
  }
  return '#ccc';
}

/* ================================================================== */
/*  Gradient stop helpers                                              */
/* ================================================================== */

export function addStop(
  stops: GradientStop[],
  offset: number,
  color: string,
): GradientStop[] {
  return [...stops, { offset, color }].sort((a, b) => a.offset - b.offset);
}

export function removeStop(
  stops: GradientStop[],
  index: number,
): GradientStop[] {
  if (stops.length <= 2) return stops; // need at least 2 stops
  return stops.filter((_, i) => i !== index);
}

export function updateStop(
  stops: GradientStop[],
  index: number,
  patch: Partial<GradientStop>,
): GradientStop[] {
  return stops
    .map((s, i) => (i === index ? { ...s, ...patch } : s))
    .sort((a, b) => a.offset - b.offset);
}

/* ================================================================== */
/*  Gradient Editor Panel (React component)                            */
/* ================================================================== */

export interface GradientEditorProps {
  value?: GradientFill | null;
  solidColor?: string;
  onChange: (fill: GradientFill | null) => void;
}

export function GradientEditor({ value, solidColor, onChange }: GradientEditorProps) {
  const [selectedStopIdx, setSelectedStopIdx] = useState(0);

  // Determine current fill type
  const fillType: FillType = value ? value.type : 'solid';
  const fill = value;
  const isGradient = fill && (fill.type === 'linear' || fill.type === 'radial');
  const stops: GradientStop[] = isGradient
    ? (fill as LinearGradient | RadialGradient).stops
    : [];

  const cssPreview = useMemo(() => (fill ? gradientToCSS(fill) : solidColor || '#ccc'), [fill, solidColor]);

  const handleAddStop = useCallback(() => {
    if (!isGradient) return;
    const newStops = addStop(stops, 0.5, '#ffffff');
    onChange({ ...fill, stops: newStops } as GradientFill);
  }, [fill, stops, isGradient, onChange]);

  const handleRemoveStop = useCallback(
    (idx: number) => {
      if (!isGradient) return;
      const newStops = removeStop(stops, idx);
      onChange({ ...fill, stops: newStops } as GradientFill);
      if (selectedStopIdx >= newStops.length) setSelectedStopIdx(newStops.length - 1);
    },
    [fill, stops, isGradient, selectedStopIdx, onChange],
  );

  const handleStopChange = useCallback(
    (idx: number, patch: Partial<GradientStop>) => {
      if (!isGradient) return;
      const newStops = updateStop(stops, idx, patch);
      onChange({ ...fill, stops: newStops } as GradientFill);
    },
    [fill, stops, isGradient, onChange],
  );

  return (
    <div className="space-y-3" data-testid="gradient-editor">
      {/* Preview bar */}
      <div
        className="h-8 w-full rounded-md border border-dash-border"
        style={{ background: cssPreview }}
        data-testid="gradient-preview"
      />

      {/* Fill type selector */}
      <div className="flex gap-1">
        {(['solid', 'linear', 'radial'] as const).map((t) => (
          <button
            key={t}
            onClick={() => {
              if (fillType === t) return;
              if (t === 'solid') {
                onChange(null);
                return;
              }
              const defaultFill =
                t === 'linear' ? defaultLinearGradient() : defaultRadialGradient();
              onChange(defaultFill);
            }}
            className={`flex-1 rounded px-2 py-1 text-[10px] font-medium transition ${
              fillType === t
                ? 'bg-blue-600 text-white'
                : 'bg-dash-muted text-dash-text2 hover:bg-dash-surface-hover'
            }`}
            data-testid={`gradient-type-${t}`}
          >
            {t === 'solid' ? 'Solid' : t === 'linear' ? 'Linear' : 'Radial'}
          </button>
        ))}
      </div>

      {/* Angle control (linear only) */}
      {fill && fill.type === 'linear' && (
        <label className="flex items-center gap-2">
          <RotateCw size={12} className="text-dash-text-muted" />
          <span className="text-[10px] text-dash-text-muted">Angle</span>
          <input
            type="range"
            min={0}
            max={360}
            value={fill.angle}
            onChange={(e) =>
              onChange({ ...fill, angle: Number(e.target.value) })
            }
            className="flex-1"
            data-testid="gradient-angle-slider"
          />
          <span className="w-8 text-right text-[10px] text-dash-text2">
            {fill.angle}°
          </span>
        </label>
      )}

      {/* Radial center & radius */}
      {fill && fill.type === 'radial' && (
        <div className="grid grid-cols-3 gap-2">
          <label className="flex flex-col">
            <span className="text-[9px] text-dash-text-muted">CX</span>
            <input
              type="number"
              step={0.05}
              min={0}
              max={1}
              value={fill.cx}
              onChange={(e) => onChange({ ...fill, cx: +e.target.value })}
              className="rounded border border-dash-border bg-dash-muted px-1 py-0.5 text-[10px] text-dash-text"
              data-testid="gradient-cx"
            />
          </label>
          <label className="flex flex-col">
            <span className="text-[9px] text-dash-text-muted">CY</span>
            <input
              type="number"
              step={0.05}
              min={0}
              max={1}
              value={fill.cy}
              onChange={(e) => onChange({ ...fill, cy: +e.target.value })}
              className="rounded border border-dash-border bg-dash-muted px-1 py-0.5 text-[10px] text-dash-text"
              data-testid="gradient-cy"
            />
          </label>
          <label className="flex flex-col">
            <span className="text-[9px] text-dash-text-muted">R</span>
            <input
              type="number"
              step={0.05}
              min={0.01}
              max={1}
              value={fill.r}
              onChange={(e) => onChange({ ...fill, r: +e.target.value })}
              className="rounded border border-dash-border bg-dash-muted px-1 py-0.5 text-[10px] text-dash-text"
              data-testid="gradient-r"
            />
          </label>
        </div>
      )}

      {/* Color stops */}
      {isGradient && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-medium text-dash-text2">
              Color Stops
            </span>
            <button
              onClick={handleAddStop}
              className="flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] text-dash-text-muted hover:bg-dash-muted"
              data-testid="add-stop-btn"
            >
              <Plus size={10} /> Add
            </button>
          </div>

          {stops.map((stop, idx) => (
            <div
              key={idx}
              className={`flex items-center gap-2 rounded px-1.5 py-1 ${
                idx === selectedStopIdx ? 'bg-dash-muted' : ''
              }`}
              onClick={() => setSelectedStopIdx(idx)}
              data-testid={`gradient-stop-${idx}`}
            >
              <input
                type="color"
                value={stop.color}
                onChange={(e) => handleStopChange(idx, { color: e.target.value })}
                className="h-5 w-5 cursor-pointer rounded border border-dash-border"
              />
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(stop.offset * 100)}
                onChange={(e) =>
                  handleStopChange(idx, { offset: Number(e.target.value) / 100 })
                }
                className="flex-1"
              />
              <span className="w-7 text-right text-[9px] text-dash-text-muted">
                {Math.round(stop.offset * 100)}%
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveStop(idx);
                }}
                disabled={stops.length <= 2}
                className="text-dash-text-muted hover:text-red-500 disabled:opacity-30"
                data-testid={`remove-stop-${idx}`}
              >
                <Trash2 size={10} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Pattern fill controls */}
      {fill && fill.type === 'pattern' && (
        <div className="space-y-2">
          <label className="flex flex-col gap-0.5">
            <span className="text-[10px] text-dash-text-muted">Image URL</span>
            <input
              type="text"
              value={fill.imageUrl}
              onChange={(e) => onChange({ ...fill, imageUrl: e.target.value })}
              placeholder="https://..."
              className="rounded border border-dash-border bg-dash-muted px-2 py-1 text-[10px] text-dash-text"
              data-testid="pattern-url"
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-0.5">
              <span className="text-[9px] text-dash-text-muted">Scale X</span>
              <input
                type="number"
                step={0.1}
                min={0.1}
                value={fill.scaleX}
                onChange={(e) => onChange({ ...fill, scaleX: +e.target.value })}
                className="rounded border border-dash-border bg-dash-muted px-1 py-0.5 text-[10px] text-dash-text"
              />
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="text-[9px] text-dash-text-muted">Scale Y</span>
              <input
                type="number"
                step={0.1}
                min={0.1}
                value={fill.scaleY}
                onChange={(e) => onChange({ ...fill, scaleY: +e.target.value })}
                className="rounded border border-dash-border bg-dash-muted px-1 py-0.5 text-[10px] text-dash-text"
              />
            </label>
          </div>
        </div>
      )}
    </div>
  );
}

export default GradientEditor;
