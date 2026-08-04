// SPDX-License-Identifier: Apache-2.0
'use client';

import { useState, useCallback } from 'react';
import {
  RotateCw,
  RotateCcw,
  FlipHorizontal,
  FlipVertical,
  Square,
  Smartphone,
  Monitor,
  Maximize2,
  Lock,
  Unlock,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────

export interface CropSettings {
  aspectRatio: string | null; // null = freeform, '1:1', '4:3', etc.
  rotation: number;           // total degrees = rotate90Steps * 90 + straighten
  straighten: number;         // -45 to +45 degrees (fine rotation slider)
  rotate90Steps: number;      // count of 90° increments (CW positive)
  perspectiveH: number;       // -100 to +100 horizontal keystone
  perspectiveV: number;       // -100 to +100 vertical keystone
  flipH: boolean;
  flipV: boolean;
}

export const DEFAULT_CROP_SETTINGS: CropSettings = {
  aspectRatio: null,
  rotation: 0,
  straighten: 0,
  rotate90Steps: 0,
  perspectiveH: 0,
  perspectiveV: 0,
  flipH: false,
  flipV: false,
};

export interface AspectPreset {
  label: string;
  ratio: string | null;
  icon: typeof Square;
  w: number;
  h: number;
}

export const ASPECT_PRESETS: AspectPreset[] = [
  { label: 'Free', ratio: null, icon: Maximize2, w: 0, h: 0 },
  { label: '1:1', ratio: '1:1', icon: Square, w: 1, h: 1 },
  { label: '4:3', ratio: '4:3', icon: Monitor, w: 4, h: 3 },
  { label: '3:2', ratio: '3:2', icon: Monitor, w: 3, h: 2 },
  { label: '16:9', ratio: '16:9', icon: Monitor, w: 16, h: 9 },
  { label: '9:16', ratio: '9:16', icon: Smartphone, w: 9, h: 16 },
  { label: '5:4', ratio: '5:4', icon: Monitor, w: 5, h: 4 },
];

/**
 * Parse aspect ratio string to numeric ratio (w/h).
 * Returns null for freeform.
 */
export function parseAspectRatio(ratio: string | null): number | null {
  if (!ratio) return null;
  const [w, h] = ratio.split(':').map(Number);
  if (!w || !h) return null;
  return w / h;
}

/**
 * Generate CSS transform for rotation + perspective preview.
 */
export function cropTransformCSS(settings: CropSettings): string {
  const parts: string[] = [];

  if (settings.perspectiveH !== 0 || settings.perspectiveV !== 0) {
    parts.push('perspective(800px)');
    if (settings.perspectiveV !== 0) {
      parts.push(`rotateX(${(settings.perspectiveV / 100) * 15}deg)`);
    }
    if (settings.perspectiveH !== 0) {
      parts.push(`rotateY(${(settings.perspectiveH / 100) * 15}deg)`);
    }
  }

  if (settings.rotation !== 0) {
    parts.push(`rotate(${settings.rotation}deg)`);
  }
  if (settings.flipH) parts.push('scaleX(-1)');
  if (settings.flipV) parts.push('scaleY(-1)');

  return parts.join(' ');
}

// ── Component Props ───────────────────────────────────────────────

export interface CropPanelProps {
  settings: CropSettings;
  onChange: (settings: CropSettings) => void;
  onReset: () => void;
  onApply: () => void;
  onCancel: () => void;
  applying?: boolean;
}

// ── Component ─────────────────────────────────────────────────────

export default function CropPanel({
  settings,
  onChange,
  onReset,
  onApply,
  onCancel,
  applying = false,
}: CropPanelProps) {
  const [lockRatio, setLockRatio] = useState(!!settings.aspectRatio);

  const update = useCallback(
    (patch: Partial<CropSettings>) => {
      onChange({ ...settings, ...patch });
    },
    [settings, onChange],
  );

  return (
    <div className="flex h-full flex-col text-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <h3 className="text-xs font-semibold tracking-wide uppercase text-white/80">
          Crop & Transform
        </h3>
        <button
          onClick={onReset}
          className="rounded px-2 py-0.5 text-[10px] text-white/50 hover:bg-white/10 hover:text-white/80 transition-colors"
        >
          Reset
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-3 space-y-4">
        {/* Aspect Ratio Presets */}
        <div className="px-3">
          <label className="mb-2 block text-[10px] font-medium uppercase tracking-wider text-white/50">
            Aspect Ratio
          </label>
          <div className="grid grid-cols-4 gap-1.5">
            {ASPECT_PRESETS.map((preset) => {
              const Icon = preset.icon;
              const isActive = settings.aspectRatio === preset.ratio;
              return (
                <button
                  key={preset.label}
                  onClick={() => {
                    update({ aspectRatio: preset.ratio });
                    setLockRatio(!!preset.ratio);
                  }}
                  className={`flex flex-col items-center gap-0.5 rounded-lg border px-1.5 py-2 text-[10px] transition-colors ${
                    isActive
                      ? 'border-blue-400 bg-blue-500/20 text-blue-300'
                      : 'border-white/10 text-white/50 hover:border-white/20 hover:text-white/70'
                  }`}
                >
                  <Icon size={14} />
                  <span>{preset.label}</span>
                </button>
              );
            })}
            {/* Lock toggle */}
            <button
              onClick={() => setLockRatio((l) => !l)}
              className={`flex flex-col items-center gap-0.5 rounded-lg border px-1.5 py-2 text-[10px] transition-colors ${
                lockRatio
                  ? 'border-amber-400 bg-amber-500/20 text-amber-300'
                  : 'border-white/10 text-white/50 hover:border-white/20 hover:text-white/70'
              }`}
            >
              {lockRatio ? <Lock size={14} /> : <Unlock size={14} />}
              <span>{lockRatio ? 'Lock' : 'Free'}</span>
            </button>
          </div>
        </div>

        {/* Rotation Slider (-45 to +45) */}
        <div className="px-3">
          <label className="mb-2 block text-[10px] font-medium uppercase tracking-wider text-white/50">
            Straighten
          </label>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={-45}
              max={45}
              step={0.1}
              value={settings.straighten}
              onChange={(e) => {
                const straighten = +e.target.value;
                update({ straighten, rotation: settings.rotate90Steps * 90 + straighten });
              }}
              className="photo-adj-slider flex-1"
            />
            <span className="w-12 text-right text-[10px] font-mono text-white/60">
              {settings.straighten.toFixed(1)}°
            </span>
          </div>
          {/* Tick marks */}
          <div className="relative mt-1 h-2">
            {[-45, -30, -15, 0, 15, 30, 45].map((tick) => (
              <div
                key={tick}
                className={`absolute top-0 h-1.5 w-px ${tick === 0 ? 'bg-white/40' : 'bg-white/15'}`}
                style={{
                  left: `${((tick + 45) / 90) * 100}%`,
                }}
              />
            ))}
          </div>
        </div>

        {/* Quick Rotate + Flip */}
        <div className="px-3">
          <label className="mb-2 block text-[10px] font-medium uppercase tracking-wider text-white/50">
            Transform
          </label>
          <div className="flex gap-1.5">
            <TransformBtn
              icon={RotateCcw}
              label="Rotate 90° CCW"
              onClick={() => {
                const steps = settings.rotate90Steps - 1;
                update({ rotate90Steps: steps, rotation: steps * 90 + settings.straighten });
              }}
            />
            <TransformBtn
              icon={RotateCw}
              label="Rotate 90° CW"
              onClick={() => {
                const steps = settings.rotate90Steps + 1;
                update({ rotate90Steps: steps, rotation: steps * 90 + settings.straighten });
              }}
            />
            <TransformBtn
              icon={FlipHorizontal}
              label="Flip Horizontal"
              onClick={() => update({ flipH: !settings.flipH })}
              active={settings.flipH}
            />
            <TransformBtn
              icon={FlipVertical}
              label="Flip Vertical"
              onClick={() => update({ flipV: !settings.flipV })}
              active={settings.flipV}
            />
          </div>
        </div>

        {/* Perspective Correction */}
        <div className="px-3">
          <label className="mb-2 block text-[10px] font-medium uppercase tracking-wider text-white/50">
            Perspective
          </label>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-16 text-[10px] text-white/50">Vertical</span>
              <input
                type="range"
                min={-100}
                max={100}
                step={1}
                value={settings.perspectiveV}
                onChange={(e) => update({ perspectiveV: +e.target.value })}
                className="photo-adj-slider flex-1"
              />
              <span className="w-8 text-right text-[10px] font-mono text-white/50">
                {settings.perspectiveV}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-16 text-[10px] text-white/50">Horizontal</span>
              <input
                type="range"
                min={-100}
                max={100}
                step={1}
                value={settings.perspectiveH}
                onChange={(e) => update({ perspectiveH: +e.target.value })}
                className="photo-adj-slider flex-1"
              />
              <span className="w-8 text-right text-[10px] font-mono text-white/50">
                {settings.perspectiveH}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Apply / Cancel */}
      <div className="border-t border-white/10 p-3 flex gap-2">
        <button
          onClick={onCancel}
          className="flex-1 rounded-lg border border-white/10 px-3 py-1.5 text-[11px] font-medium text-white/70 hover:bg-white/10 hover:text-white transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={onApply}
          disabled={applying}
          className="flex-1 rounded-lg bg-blue-600 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-blue-500 disabled:opacity-30 transition-colors"
        >
          {applying ? 'Applying…' : 'Apply Crop'}
        </button>
      </div>
    </div>
  );
}

// ── Transform Button ──────────────────────────────────────────────

function TransformBtn({
  icon: Icon,
  label,
  onClick,
  active,
}: {
  icon: typeof RotateCw;
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`flex flex-1 items-center justify-center gap-1 rounded-lg border px-2 py-2 text-[10px] transition-colors ${
        active
          ? 'border-blue-400 bg-blue-500/20 text-blue-300'
          : 'border-white/10 text-white/50 hover:border-white/20 hover:text-white/70'
      }`}
    >
      <Icon size={14} />
    </button>
  );
}
