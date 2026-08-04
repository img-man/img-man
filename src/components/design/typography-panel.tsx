// SPDX-License-Identifier: Apache-2.0
'use client';

/**
 * DS-2.2 Advanced Typography Controls Panel
 * DS-2.4 Text Container & Auto-Resize Mode
 *
 * Renders controls for letter spacing, line height, text transform,
 * text decoration, text shadow, text stroke, and container resize mode.
 * Fits into the right properties panel of the design editor.
 */

import { useState, useCallback } from 'react';
import {
  CaseSensitive,
  CaseUpper,
  CaseLower,
  Type,
  ALargeSmall,
  Minus,
  Strikethrough,
  Underline,
  MoveHorizontal,
  MoveVertical,
  Maximize2,
  ArrowUpDown,
  ArrowLeftRight,
  RectangleHorizontal,
} from 'lucide-react';
import {
  type TypographyExtras,
  type TextResizeMode,
  DEFAULT_TYPOGRAPHY,
  TEXT_PRESETS,
  type TextPreset,
} from './text-helpers';

/* ─── Types ──────────────────────────────────────────────── */

export interface TypographyPanelProps {
  typography: TypographyExtras;
  resizeMode: TextResizeMode;
  onChange: (patch: Partial<TypographyExtras>) => void;
  onResizeModeChange: (mode: TextResizeMode) => void;
  onApplyPreset?: (preset: TextPreset) => void;
}

/* ─── Constants ──────────────────────────────────────────── */

const TRANSFORM_OPTIONS: {
  value: TypographyExtras['textTransform'];
  label: string;
  icon: typeof CaseUpper;
}[] = [
  { value: 'none', label: 'None', icon: Type },
  { value: 'uppercase', label: 'UPPER', icon: CaseUpper },
  { value: 'lowercase', label: 'lower', icon: CaseLower },
  { value: 'capitalize', label: 'Title', icon: CaseSensitive },
];

const DECORATION_OPTIONS: {
  value: TypographyExtras['textDecorationStyle'];
  label: string;
  icon: typeof Underline;
}[] = [
  { value: 'none', label: 'None', icon: Minus },
  { value: 'underline', label: 'Underline', icon: Underline },
  { value: 'line-through', label: 'Strikethrough', icon: Strikethrough },
  { value: 'overline', label: 'Overline', icon: ALargeSmall },
];

const RESIZE_MODES: { value: TextResizeMode; label: string; icon: typeof Maximize2; desc: string }[] = [
  { value: 'fixed', label: 'Fixed', icon: RectangleHorizontal, desc: 'Fixed width & height' },
  { value: 'auto-width', label: 'Auto W', icon: ArrowLeftRight, desc: 'Width grows with text' },
  { value: 'auto-height', label: 'Auto H', icon: ArrowUpDown, desc: 'Height grows with text' },
];

/* ─── Component ──────────────────────────────────────────── */

export function TypographyPanel({
  typography: typo,
  resizeMode,
  onChange,
  onResizeModeChange,
  onApplyPreset,
}: TypographyPanelProps) {
  const [showPresets, setShowPresets] = useState(false);

  return (
    <div className="space-y-3" data-testid="typography-panel">
      {/* ── Text Presets ─────────────────────────────── */}
      {onApplyPreset && (
        <div>
          <button
            onClick={() => setShowPresets((s) => !s)}
            className="flex w-full items-center justify-between rounded border border-dash-border px-2 py-1.5 text-[11px] text-dash-text2 hover:bg-dash-muted transition-colors"
          >
            <span className="font-medium">Text Presets</span>
            <span className="text-[10px] text-dash-text-muted">
              {showPresets ? '▲' : '▼'}
            </span>
          </button>
          {showPresets && (
            <div className="mt-1 space-y-0.5 rounded border border-dash-border bg-dash-muted p-1 max-h-40 overflow-y-auto">
              {TEXT_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => onApplyPreset(preset)}
                  className="flex w-full items-center gap-2 rounded px-2 py-1 text-left hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors"
                  style={{
                    fontFamily: preset.fontFamily,
                    fontSize: Math.min(preset.fontSize * 0.4, 16),
                    fontWeight: preset.fontWeight,
                  }}
                >
                  <span className="truncate text-dash-text">{preset.name}</span>
                  <span className="ml-auto shrink-0 text-[9px] text-dash-text-muted">
                    {preset.fontSize}px
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Letter Spacing ───────────────────────────── */}
      <div>
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-medium text-dash-text-muted uppercase tracking-wider">
            Letter Spacing
          </label>
          <span className="text-[10px] text-dash-text-muted tabular-nums">
            {typo.letterSpacing}px
          </span>
        </div>
        <input
          type="range"
          min={-10}
          max={30}
          step={0.5}
          value={typo.letterSpacing}
          onChange={(e) => onChange({ letterSpacing: +e.target.value })}
          className="mt-0.5 w-full accent-blue-500"
          data-testid="letter-spacing-slider"
        />
      </div>

      {/* ── Line Height ──────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-medium text-dash-text-muted uppercase tracking-wider">
            Line Height
          </label>
          <span className="text-[10px] text-dash-text-muted tabular-nums">
            {typo.lineHeight.toFixed(2)}
          </span>
        </div>
        <input
          type="range"
          min={0.5}
          max={3}
          step={0.05}
          value={typo.lineHeight}
          onChange={(e) => onChange({ lineHeight: +e.target.value })}
          className="mt-0.5 w-full accent-blue-500"
          data-testid="line-height-slider"
        />
      </div>

      {/* ── Text Transform ───────────────────────────── */}
      <div>
        <label className="text-[10px] font-medium text-dash-text-muted uppercase tracking-wider">
          Text Transform
        </label>
        <div className="mt-1 flex gap-0.5" data-testid="text-transform-buttons">
          {TRANSFORM_OPTIONS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              onClick={() => onChange({ textTransform: value })}
              title={label}
              className={`flex flex-1 items-center justify-center rounded border py-1.5 text-[10px] transition-colors ${
                typo.textTransform === value
                  ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400'
                  : 'border-dash-border text-dash-text2 hover:bg-dash-muted'
              }`}
            >
              <Icon size={12} />
            </button>
          ))}
        </div>
      </div>

      {/* ── Text Decoration ──────────────────────────── */}
      <div>
        <label className="text-[10px] font-medium text-dash-text-muted uppercase tracking-wider">
          Decoration
        </label>
        <div className="mt-1 flex gap-0.5" data-testid="text-decoration-buttons">
          {DECORATION_OPTIONS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              onClick={() => onChange({ textDecorationStyle: value })}
              title={label}
              className={`flex flex-1 items-center justify-center rounded border py-1.5 text-[10px] transition-colors ${
                typo.textDecorationStyle === value
                  ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400'
                  : 'border-dash-border text-dash-text2 hover:bg-dash-muted'
              }`}
            >
              <Icon size={12} />
            </button>
          ))}
        </div>
      </div>

      {/* ── Text Shadow ──────────────────────────────── */}
      <div className="space-y-1.5">
        <label className="text-[10px] font-medium text-dash-text-muted uppercase tracking-wider">
          Text Shadow
        </label>
        <div className="grid grid-cols-2 gap-1.5">
          <label className="flex flex-col gap-0.5">
            <span className="text-[9px] text-dash-text-muted">Color</span>
            <input
              type="color"
              value={typo.textShadowColor === 'transparent' ? '#000000' : typo.textShadowColor}
              onChange={(e) => onChange({ textShadowColor: e.target.value })}
              className="h-7 w-full cursor-pointer rounded border border-dash-border"
              data-testid="shadow-color"
            />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-[9px] text-dash-text-muted">Blur</span>
            <input
              type="number"
              min={0}
              max={50}
              value={typo.textShadowBlur}
              onChange={(e) => onChange({ textShadowBlur: +e.target.value })}
              className="rounded border border-dash-border bg-dash-muted px-1.5 py-1 text-[11px] text-dash-text"
              data-testid="shadow-blur"
            />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-[9px] text-dash-text-muted">Offset X</span>
            <input
              type="number"
              min={-50}
              max={50}
              value={typo.textShadowOffsetX}
              onChange={(e) => onChange({ textShadowOffsetX: +e.target.value })}
              className="rounded border border-dash-border bg-dash-muted px-1.5 py-1 text-[11px] text-dash-text"
              data-testid="shadow-offset-x"
            />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-[9px] text-dash-text-muted">Offset Y</span>
            <input
              type="number"
              min={-50}
              max={50}
              value={typo.textShadowOffsetY}
              onChange={(e) => onChange({ textShadowOffsetY: +e.target.value })}
              className="rounded border border-dash-border bg-dash-muted px-1.5 py-1 text-[11px] text-dash-text"
              data-testid="shadow-offset-y"
            />
          </label>
        </div>
        {typo.textShadowColor !== 'transparent' &&
          (typo.textShadowOffsetX !== 0 || typo.textShadowOffsetY !== 0 || typo.textShadowBlur !== 0) && (
            <button
              onClick={() =>
                onChange({
                  textShadowColor: 'transparent',
                  textShadowOffsetX: 0,
                  textShadowOffsetY: 0,
                  textShadowBlur: 0,
                })
              }
              className="text-[10px] text-red-400 hover:text-red-300 transition-colors"
            >
              Clear Shadow
            </button>
          )}
      </div>

      {/* ── Text Stroke / Outline ────────────────────── */}
      <div className="space-y-1.5">
        <label className="text-[10px] font-medium text-dash-text-muted uppercase tracking-wider">
          Text Outline
        </label>
        <div className="grid grid-cols-2 gap-1.5">
          <label className="flex flex-col gap-0.5">
            <span className="text-[9px] text-dash-text-muted">Color</span>
            <input
              type="color"
              value={typo.textStrokeColor === 'transparent' ? '#000000' : typo.textStrokeColor}
              onChange={(e) => onChange({ textStrokeColor: e.target.value })}
              className="h-7 w-full cursor-pointer rounded border border-dash-border"
              data-testid="stroke-color"
            />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-[9px] text-dash-text-muted">Width</span>
            <input
              type="number"
              min={0}
              max={20}
              step={0.5}
              value={typo.textStrokeWidth}
              onChange={(e) => onChange({ textStrokeWidth: +e.target.value })}
              className="rounded border border-dash-border bg-dash-muted px-1.5 py-1 text-[11px] text-dash-text"
              data-testid="stroke-width"
            />
          </label>
        </div>
        {typo.textStrokeColor !== 'transparent' && typo.textStrokeWidth > 0 && (
          <button
            onClick={() =>
              onChange({ textStrokeColor: 'transparent', textStrokeWidth: 0 })
            }
            className="text-[10px] text-red-400 hover:text-red-300 transition-colors"
          >
            Clear Outline
          </button>
        )}
      </div>

      {/* ── Container Resize Mode (DS-2.4) ───────────── */}
      <div>
        <label className="text-[10px] font-medium text-dash-text-muted uppercase tracking-wider">
          Text Box
        </label>
        <div className="mt-1 flex gap-0.5" data-testid="resize-mode-buttons">
          {RESIZE_MODES.map(({ value, label, icon: Icon, desc }) => (
            <button
              key={value}
              onClick={() => onResizeModeChange(value)}
              title={desc}
              className={`flex flex-1 flex-col items-center gap-0.5 rounded border py-1.5 text-[9px] transition-colors ${
                resizeMode === value
                  ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400'
                  : 'border-dash-border text-dash-text2 hover:bg-dash-muted'
              }`}
            >
              <Icon size={12} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Reset Typography ─────────────────────────── */}
      <button
        onClick={() => onChange(DEFAULT_TYPOGRAPHY)}
        className="w-full rounded border border-dash-border py-1.5 text-[10px] text-dash-text-muted hover:bg-dash-muted transition-colors"
      >
        Reset Typography
      </button>
    </div>
  );
}

export { TRANSFORM_OPTIONS, DECORATION_OPTIONS, RESIZE_MODES };
export default TypographyPanel;
