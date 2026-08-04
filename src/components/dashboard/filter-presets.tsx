// SPDX-License-Identifier: Apache-2.0
'use client';

import { useState, useCallback, useMemo, useRef } from 'react';
import { Sparkles, Save, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  type PhotoAdjustments,
  DEFAULT_ADJUSTMENTS,
  adjustmentsToCSSFilter,
} from './photo-adjustments';

// ── Filter Preset Types ───────────────────────────────────────────

export interface FilterPreset {
  id: string;
  name: string;
  category: FilterCategory;
  adjustments: Partial<PhotoAdjustments>;
  isCustom?: boolean;
}

export type FilterCategory =
  | 'vivid'
  | 'muted'
  | 'bw'
  | 'vintage'
  | 'cinematic'
  | 'film'
  | 'moody'
  | 'clean';

export const FILTER_CATEGORIES: { id: FilterCategory; label: string }[] = [
  { id: 'vivid', label: 'Vivid' },
  { id: 'muted', label: 'Muted' },
  { id: 'bw', label: 'B&W' },
  { id: 'vintage', label: 'Vintage' },
  { id: 'cinematic', label: 'Cinematic' },
  { id: 'film', label: 'Film' },
  { id: 'moody', label: 'Moody' },
  { id: 'clean', label: 'Clean' },
];

// ── Built-in Presets ──────────────────────────────────────────────

export const BUILTIN_PRESETS: FilterPreset[] = [
  // Vivid
  {
    id: 'vivid-pop',
    name: 'Pop',
    category: 'vivid',
    adjustments: { saturation: 40, contrast: 20, vibrance: 30 },
  },
  {
    id: 'vivid-punch',
    name: 'Punch',
    category: 'vivid',
    adjustments: { saturation: 60, contrast: 35, clarity: 25, vibrance: 40 },
  },
  {
    id: 'vivid-tropical',
    name: 'Tropical',
    category: 'vivid',
    adjustments: { saturation: 50, temperature: 20, vibrance: 35, brightness: 10 },
  },

  // Muted
  {
    id: 'muted-soft',
    name: 'Soft',
    category: 'muted',
    adjustments: { saturation: -30, contrast: -15, brightness: 10 },
  },
  {
    id: 'muted-pastel',
    name: 'Pastel',
    category: 'muted',
    adjustments: { saturation: -40, brightness: 20, highlights: 25, contrast: -20 },
  },
  {
    id: 'muted-faded',
    name: 'Faded',
    category: 'muted',
    adjustments: { saturation: -25, blacks: 30, contrast: -10 },
  },

  // B&W
  {
    id: 'bw-classic',
    name: 'Classic',
    category: 'bw',
    adjustments: { saturation: -100, contrast: 10 },
  },
  {
    id: 'bw-high-contrast',
    name: 'High Contrast',
    category: 'bw',
    adjustments: { saturation: -100, contrast: 50, clarity: 30 },
  },
  {
    id: 'bw-noir',
    name: 'Noir',
    category: 'bw',
    adjustments: { saturation: -100, contrast: 40, blacks: -20, vignette: 40 },
  },

  // Vintage
  {
    id: 'vintage-retro',
    name: 'Retro',
    category: 'vintage',
    adjustments: { saturation: -20, temperature: 30, grain: 20, contrast: -10, blacks: 15 },
  },
  {
    id: 'vintage-polaroid',
    name: 'Polaroid',
    category: 'vintage',
    adjustments: { saturation: -15, temperature: 25, brightness: 10, vignette: 25, tint: -10 },
  },
  {
    id: 'vintage-sepia',
    name: 'Sepia',
    category: 'vintage',
    adjustments: { saturation: -60, temperature: 50, contrast: -10, brightness: 5 },
  },

  // Cinematic
  {
    id: 'cinematic-teal-orange',
    name: 'Teal & Orange',
    category: 'cinematic',
    adjustments: { temperature: 15, tint: -15, contrast: 20, saturation: 10, shadows: -15 },
  },
  {
    id: 'cinematic-blockbuster',
    name: 'Blockbuster',
    category: 'cinematic',
    adjustments: { contrast: 30, saturation: -10, clarity: 20, vignette: 30, temperature: 5 },
  },
  {
    id: 'cinematic-drama',
    name: 'Drama',
    category: 'cinematic',
    adjustments: { contrast: 25, shadows: -20, highlights: -15, clarity: 35, dehaze: 20 },
  },

  // Film
  {
    id: 'film-kodak',
    name: 'Kodak',
    category: 'film',
    adjustments: { temperature: 15, saturation: 10, grain: 15, contrast: 5, blacks: 10 },
  },
  {
    id: 'film-fuji',
    name: 'Fuji',
    category: 'film',
    adjustments: { temperature: -10, saturation: 15, grain: 10, tint: 5, vibrance: 20 },
  },
  {
    id: 'film-portra',
    name: 'Portra',
    category: 'film',
    adjustments: { saturation: -10, temperature: 10, grain: 12, brightness: 5, blacks: 15 },
  },

  // Moody
  {
    id: 'moody-dark',
    name: 'Dark',
    category: 'moody',
    adjustments: { brightness: -25, contrast: 20, saturation: -15, vignette: 35 },
  },
  {
    id: 'moody-mist',
    name: 'Mist',
    category: 'moody',
    adjustments: { brightness: -10, contrast: -15, saturation: -20, dehaze: -30, blacks: 20 },
  },
  {
    id: 'moody-cold',
    name: 'Cold',
    category: 'moody',
    adjustments: { temperature: -40, saturation: -15, contrast: 15, shadows: -10 },
  },

  // Clean
  {
    id: 'clean-bright',
    name: 'Bright',
    category: 'clean',
    adjustments: { brightness: 15, contrast: 5, clarity: 10, saturation: 5 },
  },
  {
    id: 'clean-crisp',
    name: 'Crisp',
    category: 'clean',
    adjustments: { clarity: 30, contrast: 15, sharpen: 25 },
  },
  {
    id: 'clean-airy',
    name: 'Airy',
    category: 'clean',
    adjustments: { brightness: 20, contrast: -10, highlights: 20, saturation: -10 },
  },
];

// ── Helper: Apply a preset at a given intensity ───────────────────

/**
 * Merge a preset's partial adjustments into defaults at a given
 * intensity (0–100). intensity=100 means full preset values.
 */
export function applyPresetAtIntensity(
  preset: FilterPreset,
  intensity: number,
): PhotoAdjustments {
  const ratio = intensity / 100;
  const result = { ...DEFAULT_ADJUSTMENTS };
  for (const [key, value] of Object.entries(preset.adjustments)) {
    const k = key as keyof PhotoAdjustments;
    result[k] = DEFAULT_ADJUSTMENTS[k] + (value as number) * ratio;
  }
  return result;
}

/**
 * Get the CSS filter string for a preset at full intensity (for thumbnail preview).
 */
export function presetToCSSFilter(preset: FilterPreset): string {
  return adjustmentsToCSSFilter(applyPresetAtIntensity(preset, 100));
}

// ── Component Props ───────────────────────────────────────────────

export interface FilterPresetsPanelProps {
  currentAdjustments: PhotoAdjustments;
  onApplyPreset: (adjustments: PhotoAdjustments) => void;
  imageSrc: string;
  customPresets?: FilterPreset[];
  onSaveAsPreset?: (preset: FilterPreset) => void;
}

// ── Component ─────────────────────────────────────────────────────

export default function FilterPresetsPanel({
  currentAdjustments,
  onApplyPreset,
  imageSrc,
  customPresets = [],
  onSaveAsPreset,
}: FilterPresetsPanelProps) {
  const [activeCategory, setActiveCategory] = useState<FilterCategory | 'all' | 'custom'>('all');
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [intensity, setIntensity] = useState(100);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [customName, setCustomName] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // All presets including custom
  const allPresets = useMemo(() => {
    const custom: FilterPreset[] = customPresets.map((p) => ({
      ...p,
      isCustom: true,
    }));
    return [...BUILTIN_PRESETS, ...custom];
  }, [customPresets]);

  // Filtered presets
  const filteredPresets = useMemo(() => {
    if (activeCategory === 'all') return allPresets;
    if (activeCategory === 'custom') return allPresets.filter((p) => p.isCustom);
    return allPresets.filter((p) => p.category === activeCategory);
  }, [activeCategory, allPresets]);

  // Apply preset with intensity
  const handleSelectPreset = useCallback(
    (preset: FilterPreset) => {
      setSelectedPresetId(preset.id);
      setIntensity(100);
      onApplyPreset(applyPresetAtIntensity(preset, 100));
    },
    [onApplyPreset],
  );

  // Update intensity for active preset
  const handleIntensityChange = useCallback(
    (newIntensity: number) => {
      setIntensity(newIntensity);
      const preset = allPresets.find((p) => p.id === selectedPresetId);
      if (preset) {
        onApplyPreset(applyPresetAtIntensity(preset, newIntensity));
      }
    },
    [selectedPresetId, allPresets, onApplyPreset],
  );

  // Save current adjustments as custom preset
  const handleSavePreset = useCallback(() => {
    if (!customName.trim() || !onSaveAsPreset) return;

    // Build partial adjustments (only non-default values)
    const partial: Partial<PhotoAdjustments> = {};
    for (const [key, value] of Object.entries(currentAdjustments)) {
      const k = key as keyof PhotoAdjustments;
      if (value !== DEFAULT_ADJUSTMENTS[k]) {
        partial[k] = value;
      }
    }

    const preset: FilterPreset = {
      id: `custom-${Date.now()}`,
      name: customName.trim(),
      category: 'clean', // default category for custom
      adjustments: partial,
      isCustom: true,
    };
    onSaveAsPreset(preset);
    setCustomName('');
    setShowSaveDialog(false);
  }, [customName, currentAdjustments, onSaveAsPreset]);

  // Scroll carousel
  const scrollLeft = useCallback(() => {
    scrollRef.current?.scrollBy({ left: -200, behavior: 'smooth' });
  }, []);
  const scrollRight = useCallback(() => {
    scrollRef.current?.scrollBy({ left: 200, behavior: 'smooth' });
  }, []);

  const isModified = useMemo(
    () =>
      (Object.keys(currentAdjustments) as (keyof PhotoAdjustments)[]).some(
        (k) => currentAdjustments[k] !== DEFAULT_ADJUSTMENTS[k],
      ),
    [currentAdjustments],
  );

  return (
    <div className="flex h-full flex-col text-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <h3 className="text-xs font-semibold tracking-wide uppercase text-white/80">
          Filters
        </h3>
        {onSaveAsPreset && isModified && (
          <button
            onClick={() => setShowSaveDialog((s) => !s)}
            className="flex items-center gap-1 rounded px-2 py-0.5 text-[10px] text-white/50 hover:bg-white/10 hover:text-white/80 transition-colors"
          >
            <Save size={10} />
            Save Preset
          </button>
        )}
      </div>

      {/* Save Custom Preset dialog */}
      {showSaveDialog && (
        <div className="border-b border-white/10 px-3 py-2 space-y-2">
          <input
            type="text"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            placeholder="Preset name…"
            className="w-full rounded-md border border-white/15 bg-white/5 px-2.5 py-1.5 text-[11px] text-white placeholder-white/30 outline-none focus:border-blue-400/50"
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && handleSavePreset()}
          />
          <div className="flex gap-2">
            <button
              onClick={() => setShowSaveDialog(false)}
              className="flex-1 rounded-md border border-white/10 px-2 py-1 text-[10px] text-white/50 hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              onClick={handleSavePreset}
              disabled={!customName.trim()}
              className="flex-1 rounded-md bg-blue-600 px-2 py-1 text-[10px] text-white disabled:opacity-30"
            >
              Save
            </button>
          </div>
        </div>
      )}

      {/* Category tabs — horizontal scroll */}
      <div className="flex gap-1 overflow-x-auto border-b border-white/10 px-3 py-2 scrollbar-none">
        <CatTab
          label="All"
          active={activeCategory === 'all'}
          onClick={() => setActiveCategory('all')}
        />
        {FILTER_CATEGORIES.map((cat) => (
          <CatTab
            key={cat.id}
            label={cat.label}
            active={activeCategory === cat.id}
            onClick={() => setActiveCategory(cat.id)}
          />
        ))}
        {customPresets.length > 0 && (
          <CatTab
            label="Custom"
            active={activeCategory === 'custom'}
            onClick={() => setActiveCategory('custom')}
          />
        )}
      </div>

      {/* Preset carousel */}
      <div className="relative flex-1 overflow-hidden">
        {/* Scroll arrows */}
        <button
          onClick={scrollLeft}
          className="absolute left-0 top-1/2 z-10 -translate-y-1/2 rounded-r-md bg-black/60 p-1 text-white/50 hover:text-white transition-colors"
        >
          <ChevronLeft size={14} />
        </button>
        <button
          onClick={scrollRight}
          className="absolute right-0 top-1/2 z-10 -translate-y-1/2 rounded-l-md bg-black/60 p-1 text-white/50 hover:text-white transition-colors"
        >
          <ChevronRight size={14} />
        </button>

        {/* Grid of preset thumbnails */}
        <div
          ref={scrollRef}
          className="grid auto-rows-max grid-cols-3 gap-2 overflow-y-auto p-3"
          style={{ maxHeight: '100%' }}
        >
          {/* "None" / Reset option */}
          <PresetCard
            name="None"
            imageSrc={imageSrc}
            filterCSS="none"
            isSelected={selectedPresetId === null}
            isCustom={false}
            onClick={() => {
              setSelectedPresetId(null);
              onApplyPreset(DEFAULT_ADJUSTMENTS);
            }}
          />
          {filteredPresets.map((preset) => (
            <PresetCard
              key={preset.id}
              name={preset.name}
              imageSrc={imageSrc}
              filterCSS={presetToCSSFilter(preset)}
              isSelected={selectedPresetId === preset.id}
              isCustom={!!preset.isCustom}
              onClick={() => handleSelectPreset(preset)}
            />
          ))}
        </div>
      </div>

      {/* Intensity slider (when a preset is selected) */}
      {selectedPresetId && (
        <div className="border-t border-white/10 px-3 py-3">
          <div className="mb-1 flex items-center justify-between text-[10px] text-white/50">
            <span>Intensity</span>
            <span className="font-mono">{intensity}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={intensity}
            onChange={(e) => handleIntensityChange(+e.target.value)}
            className="photo-adj-slider w-full"
          />
        </div>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────

function CatTab({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-medium transition-colors ${
        active
          ? 'bg-blue-500/20 text-blue-300'
          : 'text-white/40 hover:bg-white/5 hover:text-white/60'
      }`}
    >
      {label}
    </button>
  );
}

function PresetCard({
  name,
  imageSrc,
  filterCSS,
  isSelected,
  isCustom,
  onClick,
}: {
  name: string;
  imageSrc: string;
  filterCSS: string;
  isSelected: boolean;
  isCustom: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`group relative flex flex-col items-center gap-1 rounded-lg border p-1 transition-colors ${
        isSelected
          ? 'border-blue-400 bg-blue-500/10'
          : 'border-white/10 hover:border-white/20'
      }`}
    >
      {/* Thumbnail with filter preview */}
      <div className="relative aspect-square w-full overflow-hidden rounded-md bg-white/5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageSrc}
          alt={name}
          className="h-full w-full object-cover"
          style={{ filter: filterCSS }}
          loading="lazy"
        />
        {isCustom && (
          <div className="absolute right-0.5 top-0.5">
            <Sparkles size={8} className="text-amber-400" />
          </div>
        )}
      </div>
      <span
        className={`text-[9px] font-medium ${
          isSelected ? 'text-blue-300' : 'text-white/50 group-hover:text-white/70'
        }`}
      >
        {name}
      </span>
    </button>
  );
}
