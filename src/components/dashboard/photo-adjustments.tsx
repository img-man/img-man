// SPDX-License-Identifier: Apache-2.0
'use client';

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  RotateCcw,
  Sun,
  Contrast,
  Droplets,
  Thermometer,
  Sparkles,
  Eye,
  CircleDot,
  CloudFog,
  Grip,
  ChevronDown,
  ChevronRight,
  Eclipse,
  Scan,
  UserRound,
  Waves,
} from 'lucide-react';

// ── Adjustment Parameters ─────────────────────────────────────────

export interface PhotoAdjustments {
  brightness: number;    // -100 to +100
  contrast: number;      // -100 to +100
  exposure: number;      // -2.0 to +2.0 EV
  highlights: number;    // -100 to +100
  shadows: number;       // -100 to +100
  whites: number;        // -100 to +100
  blacks: number;        // -100 to +100
  blackPoint: number;    // 0 to 100 (crush blacks)
  whitePoint: number;    // 0 to 100 (clip whites)
  tone: number;          // -100 to +100 (overall tone curve)
  saturation: number;    // -100 to +100
  vibrance: number;      // -100 to +100
  temperature: number;   // -100 to +100 (warm ↔ cool)
  tint: number;          // -100 to +100 (green ↔ magenta)
  skinTone: number;      // -100 to +100 (orange-red skin hue shift)
  blueTone: number;      // -100 to +100 (blue channel intensity)
  sharpen: number;       // 0 to 100
  clarity: number;       // 0 to 100
  vignette: number;      // -100 to +100
  grain: number;         // 0 to 100
  dehaze: number;        // 0 to 100
}

export const DEFAULT_ADJUSTMENTS: PhotoAdjustments = {
  brightness: 0,
  contrast: 0,
  exposure: 0,
  highlights: 0,
  shadows: 0,
  whites: 0,
  blacks: 0,
  blackPoint: 0,
  whitePoint: 0,
  tone: 0,
  saturation: 0,
  vibrance: 0,
  temperature: 0,
  tint: 0,
  skinTone: 0,
  blueTone: 0,
  sharpen: 0,
  clarity: 0,
  vignette: 0,
  grain: 0,
  dehaze: 0,
};

// ── CSS Filter Generation ─────────────────────────────────────────

/**
 * Convert PhotoAdjustments → CSS `filter` string for real-time preview.
 * This is intentionally approximate; the server-side Sharp pipeline
 * will produce the final result.
 */
export function adjustmentsToCSSFilter(adj: PhotoAdjustments): string {
  const parts: string[] = [];

  // Brightness: CSS brightness(1) = normal. Map -100..+100 → 0.5..1.5
  const brightnessVal = 1 + adj.brightness / 200;
  // Exposure: acts like a brightness multiplier. Map -2..+2 → 0.25..4 (exponential)
  const exposureMultiplier = Math.pow(2, adj.exposure);
  const combinedBrightness = brightnessVal * exposureMultiplier;
  if (Math.abs(combinedBrightness - 1) > 0.001) {
    parts.push(`brightness(${combinedBrightness.toFixed(3)})`);
  }

  // Contrast: CSS contrast(1) = normal. Map -100..+100 → 0.5..1.5
  // Add clarity as extra local contrast
  const contrastVal = 1 + adj.contrast / 200 + adj.clarity / 400;
  if (Math.abs(contrastVal - 1) > 0.001) {
    parts.push(`contrast(${contrastVal.toFixed(3)})`);
  }

  // Saturation + vibrance: CSS saturate(1) = normal. Map -100..+100 → 0..2
  const satVal = 1 + adj.saturation / 100 + adj.vibrance / 200;
  if (Math.abs(satVal - 1) > 0.001) {
    parts.push(`saturate(${Math.max(0, satVal).toFixed(3)})`);
  }

  // Temperature → warm/cool using sepia + hue-rotate approximation
  if (adj.temperature > 0) {
    // Warm: slight sepia + hue rotate towards orange
    const warmth = adj.temperature / 100;
    parts.push(`sepia(${(warmth * 0.3).toFixed(3)})`);
    parts.push(`hue-rotate(${Math.round(-warmth * 10)}deg)`);
  } else if (adj.temperature < 0) {
    // Cool: slight tint towards blue via hue-rotate
    parts.push(`hue-rotate(${Math.round(-(adj.temperature / 100) * 20)}deg)`);
  }

  // Tint → green/magenta via hue-rotate
  if (adj.tint !== 0) {
    parts.push(`hue-rotate(${Math.round(adj.tint * 0.3)}deg)`);
  }

  // Highlights/Shadows/Whites/Blacks: approximate brightness modifiers
  // These are coarse approximations since CSS filters don't have tone curve control
  const toneShift =
    (adj.highlights + adj.whites) / 800 - (adj.shadows + adj.blacks) / 800;
  if (Math.abs(toneShift) > 0.001) {
    parts.push(`brightness(${(1 + toneShift).toFixed(3)})`);
  }

  // Black Point: crush blacks (reduce visibility of dark tones)
  if (adj.blackPoint > 0) {
    const bp = adj.blackPoint / 100;
    // Simulated by slightly increasing brightness and adding contrast
    parts.push(`brightness(${(1 + bp * 0.05).toFixed(3)})`);
    parts.push(`contrast(${(1 + bp * 0.1).toFixed(3)})`);
  }

  // White Point: clip whites (increase brightness ceiling)
  if (adj.whitePoint > 0) {
    const wp = adj.whitePoint / 100;
    parts.push(`brightness(${(1 + wp * 0.15).toFixed(3)})`);
  }

  // Tone: overall tone curve shift (negative = darker midtones, positive = lighter)
  if (adj.tone !== 0) {
    const toneFactor = 1 + adj.tone / 300;
    parts.push(`brightness(${toneFactor.toFixed(3)})`);
  }

  // Skin Tone: shift hue towards warmer/cooler skin tones
  if (adj.skinTone !== 0) {
    // Positive = warmer/more orange, Negative = cooler/less orange
    const skinShift = adj.skinTone / 100;
    parts.push(`hue-rotate(${Math.round(skinShift * -5)}deg)`);
    if (skinShift > 0) {
      parts.push(`sepia(${(skinShift * 0.08).toFixed(3)})`);
    }
  }

  // Blue Tone: adjust blue channel intensity
  if (adj.blueTone !== 0) {
    const blueShift = adj.blueTone / 100;
    // Positive = more blue, Negative = less blue (warmer)
    parts.push(`hue-rotate(${Math.round(blueShift * 12)}deg)`);
  }

  // Dehaze: increases contrast and saturation slightly
  if (adj.dehaze > 0) {
    const dh = adj.dehaze / 100;
    parts.push(`contrast(${(1 + dh * 0.15).toFixed(3)})`);
    parts.push(`saturate(${(1 + dh * 0.1).toFixed(3)})`);
  }

  // Sharpen: we use CSS unsharp-mask-like via drop-shadow (very approximate)
  // Real sharpen needs canvas convolution; for preview we skip or use blur inverse
  // We'll add sharpening via SVG filter later; for now just note it

  return parts.length > 0 ? parts.join(' ') : 'none';
}

/**
 * Generate CSS/SVG for vignette overlay
 */
export function vignetteStyle(amount: number): { background: string; pointerEvents: 'none' } {
  if (amount === 0) return { background: 'none', pointerEvents: 'none' };
  // Negative = lighten edges, positive = darken edges
  const intensity = Math.abs(amount) / 100;
  const color = amount > 0 ? '0,0,0' : '255,255,255';
  return {
    background: `radial-gradient(ellipse at center, transparent 40%, rgba(${color},${(intensity * 0.7).toFixed(2)}) 100%)`,
    pointerEvents: 'none',
  };
}

/**
 * Generate grain overlay CSS
 */
export function grainOpacity(amount: number): number {
  return amount / 200; // 0..100 → 0..0.5
}

// ── Slider Definition ─────────────────────────────────────────────

interface SliderDef {
  key: keyof PhotoAdjustments;
  label: string;
  min: number;
  max: number;
  step: number;
  icon: typeof Sun;
  category: 'light' | 'color' | 'detail' | 'effects';
}

const SLIDER_DEFS: SliderDef[] = [
  // Light
  { key: 'exposure', label: 'Exposure', min: -2, max: 2, step: 0.05, icon: Sun, category: 'light' },
  { key: 'brightness', label: 'Brightness', min: -100, max: 100, step: 1, icon: Sun, category: 'light' },
  { key: 'tone', label: 'Tone', min: -100, max: 100, step: 1, icon: Eclipse, category: 'light' },
  { key: 'contrast', label: 'Contrast', min: -100, max: 100, step: 1, icon: Contrast, category: 'light' },
  { key: 'highlights', label: 'Highlights', min: -100, max: 100, step: 1, icon: Sun, category: 'light' },
  { key: 'shadows', label: 'Shadows', min: -100, max: 100, step: 1, icon: Sun, category: 'light' },
  { key: 'whites', label: 'Whites', min: -100, max: 100, step: 1, icon: Sun, category: 'light' },
  { key: 'blacks', label: 'Blacks', min: -100, max: 100, step: 1, icon: Sun, category: 'light' },
  { key: 'blackPoint', label: 'Black Point', min: 0, max: 100, step: 1, icon: Scan, category: 'light' },
  { key: 'whitePoint', label: 'White Point', min: 0, max: 100, step: 1, icon: Scan, category: 'light' },

  // Color
  { key: 'saturation', label: 'Saturation', min: -100, max: 100, step: 1, icon: Droplets, category: 'color' },
  { key: 'vibrance', label: 'Vibrance', min: -100, max: 100, step: 1, icon: Droplets, category: 'color' },
  { key: 'temperature', label: 'Temperature', min: -100, max: 100, step: 1, icon: Thermometer, category: 'color' },
  { key: 'tint', label: 'Tint', min: -100, max: 100, step: 1, icon: CircleDot, category: 'color' },
  { key: 'skinTone', label: 'Skin Tone', min: -100, max: 100, step: 1, icon: UserRound, category: 'color' },
  { key: 'blueTone', label: 'Blue Tone', min: -100, max: 100, step: 1, icon: Waves, category: 'color' },

  // Detail
  { key: 'sharpen', label: 'Sharpen', min: 0, max: 100, step: 1, icon: Sparkles, category: 'detail' },
  { key: 'clarity', label: 'Clarity', min: 0, max: 100, step: 1, icon: Eye, category: 'detail' },
  { key: 'dehaze', label: 'Dehaze', min: 0, max: 100, step: 1, icon: CloudFog, category: 'detail' },

  // Effects
  { key: 'vignette', label: 'Vignette', min: -100, max: 100, step: 1, icon: CircleDot, category: 'effects' },
  { key: 'grain', label: 'Grain', min: 0, max: 100, step: 1, icon: Grip, category: 'effects' },
];

const CATEGORIES = [
  { id: 'light' as const, label: 'Light', icon: Sun },
  { id: 'color' as const, label: 'Color', icon: Droplets },
  { id: 'detail' as const, label: 'Detail', icon: Sparkles },
  { id: 'effects' as const, label: 'Effects', icon: CircleDot },
];

// ── Component Props ───────────────────────────────────────────────

export interface PhotoAdjustmentsPanelProps {
  adjustments: PhotoAdjustments;
  onChange: (adj: PhotoAdjustments) => void;
  onReset: () => void;
  onSaveAsCopy: () => void;
  onOverwrite: () => void;
  saving?: boolean;
  showBeforeAfter: boolean;
  onToggleBeforeAfter: (show: boolean) => void;
}

// ── Individual Slider ─────────────────────────────────────────────

function AdjustmentSlider({
  def,
  value,
  onChange,
}: {
  def: SliderDef;
  value: number;
  onChange: (key: keyof PhotoAdjustments, value: number) => void;
}) {
  const isDefault = value === DEFAULT_ADJUSTMENTS[def.key];
  const pct =
    def.min >= 0
      ? (value / def.max) * 100
      : ((value - def.min) / (def.max - def.min)) * 100;

  return (
    <div className="group flex items-center gap-2 px-3 py-1 hover:bg-white/5 transition-colors rounded">
      <span className="w-[72px] shrink-0 text-[11px] text-white/60 group-hover:text-white/80 transition-colors">
        {def.label}
      </span>
      <div className="relative flex-1">
        <input
          type="range"
          min={def.min}
          max={def.max}
          step={def.step}
          value={value}
          onChange={(e) => onChange(def.key, +e.target.value)}
          className="photo-adj-slider w-full"
        />
        {/* Center marker for bipolar sliders */}
        {def.min < 0 && (
          <div
            className="pointer-events-none absolute top-1/2 h-2 w-px bg-white/30 -translate-y-1/2"
            style={{ left: `${((0 - def.min) / (def.max - def.min)) * 100}%` }}
          />
        )}
      </div>
      <button
        onClick={() => onChange(def.key, DEFAULT_ADJUSTMENTS[def.key])}
        className={`w-10 shrink-0 rounded px-1 py-0.5 text-center text-[10px] font-mono transition-colors ${
          isDefault
            ? 'text-white/30'
            : 'text-white/70 hover:bg-white/10 hover:text-white'
        }`}
        title="Reset to default"
      >
        {typeof value === 'number' && def.step < 1
          ? value.toFixed(1)
          : Math.round(value)}
      </button>
    </div>
  );
}

// ── Main Panel Component ──────────────────────────────────────────

export default function PhotoAdjustmentsPanel({
  adjustments,
  onChange,
  onReset,
  onSaveAsCopy,
  onOverwrite,
  saving = false,
  showBeforeAfter,
  onToggleBeforeAfter,
}: PhotoAdjustmentsPanelProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const toggleCategory = useCallback((id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleChange = useCallback(
    (key: keyof PhotoAdjustments, value: number) => {
      onChange({ ...adjustments, [key]: value });
    },
    [adjustments, onChange],
  );

  const isModified = useMemo(
    () =>
      (Object.keys(adjustments) as (keyof PhotoAdjustments)[]).some(
        (k) => adjustments[k] !== DEFAULT_ADJUSTMENTS[k],
      ),
    [adjustments],
  );

  return (
    <div className="flex h-full flex-col text-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <h3 className="text-xs font-semibold tracking-wide uppercase text-white/80">
          Adjustments
        </h3>
        {isModified && (
          <button
            onClick={onReset}
            className="flex items-center gap-1 rounded px-2 py-0.5 text-[10px] text-white/50 hover:bg-white/10 hover:text-white/80 transition-colors"
          >
            <RotateCcw size={10} />
            Reset All
          </button>
        )}
      </div>

      {/* Slider Categories */}
      <div className="flex-1 overflow-y-auto py-2">
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const isOpen = !collapsed.has(cat.id);
          const sliders = SLIDER_DEFS.filter((s) => s.category === cat.id);

          return (
            <div key={cat.id} className="mb-1">
              <button
                onClick={() => toggleCategory(cat.id)}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-[11px] font-medium text-white/70 hover:bg-white/5 transition-colors"
              >
                {isOpen ? (
                  <ChevronDown size={12} />
                ) : (
                  <ChevronRight size={12} />
                )}
                <Icon size={12} className="text-white/50" />
                <span>{cat.label}</span>
                {/* Show count of modified sliders */}
                {(() => {
                  const modified = sliders.filter(
                    (s) => adjustments[s.key] !== DEFAULT_ADJUSTMENTS[s.key],
                  ).length;
                  return modified > 0 ? (
                    <span className="ml-auto rounded-full bg-blue-500/30 px-1.5 text-[9px] text-blue-300">
                      {modified}
                    </span>
                  ) : null;
                })()}
              </button>
              {isOpen && (
                <div className="pb-1">
                  {sliders.map((def) => (
                    <AdjustmentSlider
                      key={def.key}
                      def={def}
                      value={adjustments[def.key]}
                      onChange={handleChange}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Before/After + Save buttons */}
      <div className="border-t border-white/10 p-3 space-y-2">
        {/* Before/After */}
        <button
          onMouseDown={() => onToggleBeforeAfter(true)}
          onMouseUp={() => onToggleBeforeAfter(false)}
          onMouseLeave={() => onToggleBeforeAfter(false)}
          className={`w-full rounded-lg border px-3 py-1.5 text-[11px] font-medium transition-colors ${
            showBeforeAfter
              ? 'border-blue-400 bg-blue-500/20 text-blue-300'
              : 'border-white/10 text-white/60 hover:bg-white/5 hover:text-white/80'
          }`}
        >
          {showBeforeAfter ? 'Showing Original' : 'Hold to see Original'}
        </button>

        {/* Save options */}
        <div className="flex gap-2">
          <button
            onClick={onSaveAsCopy}
            disabled={!isModified || saving}
            className="flex-1 rounded-lg border border-white/10 px-3 py-1.5 text-[11px] font-medium text-white/70 hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Save as Copy
          </button>
          <button
            onClick={onOverwrite}
            disabled={!isModified || saving}
            className="flex-1 rounded-lg bg-blue-600 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Saving…' : 'Apply'}
          </button>
        </div>
      </div>
    </div>
  );
}
