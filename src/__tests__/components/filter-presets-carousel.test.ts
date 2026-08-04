// SPDX-License-Identifier: Apache-2.0
/**
 * Filter Presets, Intensity Slider & Photo Adjustments Tests
 * Tests for filter presets, intensity slider, and photo adjustments.
 */
import { describe, it, expect } from 'vitest';

import {
  BUILTIN_PRESETS,
  FILTER_CATEGORIES,
  applyPresetAtIntensity,
  presetToCSSFilter,
  type FilterPreset,
} from '@/components/dashboard/filter-presets';
import {
  DEFAULT_ADJUSTMENTS,
  adjustmentsToCSSFilter,
  type PhotoAdjustments,
} from '@/components/dashboard/photo-adjustments';

// ── 11.1 Filter Presets Carousel ──────────────────────────────────

describe('Filter Preset Carousel', () => {
  it('exports BUILTIN_PRESETS with at least 20 presets', () => {
    expect(BUILTIN_PRESETS.length).toBeGreaterThanOrEqual(20);
  });

  it('exports 8 FILTER_CATEGORIES', () => {
    expect(FILTER_CATEGORIES).toHaveLength(8);
    const ids = FILTER_CATEGORIES.map((c) => c.id);
    expect(ids).toContain('vivid');
    expect(ids).toContain('muted');
    expect(ids).toContain('bw');
    expect(ids).toContain('vintage');
    expect(ids).toContain('cinematic');
    expect(ids).toContain('film');
    expect(ids).toContain('moody');
    expect(ids).toContain('clean');
  });

  it('every preset belongs to a valid category', () => {
    const validCategories = FILTER_CATEGORIES.map((c) => c.id);
    for (const preset of BUILTIN_PRESETS) {
      expect(validCategories).toContain(preset.category);
    }
  });

  it('every preset has a unique id', () => {
    const ids = BUILTIN_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every preset has a non-empty name', () => {
    for (const preset of BUILTIN_PRESETS) {
      expect(preset.name.length).toBeGreaterThan(0);
    }
  });

  it('every preset has at least one adjustment', () => {
    for (const preset of BUILTIN_PRESETS) {
      expect(Object.keys(preset.adjustments).length).toBeGreaterThan(0);
    }
  });

  it('every category has at least 2 presets', () => {
    for (const cat of FILTER_CATEGORIES) {
      const count = BUILTIN_PRESETS.filter((p) => p.category === cat.id).length;
      expect(count).toBeGreaterThanOrEqual(2);
    }
  });

  it('presetToCSSFilter returns a non-empty string', () => {
    const css = presetToCSSFilter(BUILTIN_PRESETS[0]);
    expect(typeof css).toBe('string');
    expect(css.length).toBeGreaterThan(0);
  });
});

// ── 11.2 Preset Intensity Slider ──────────────────────────────────

describe('Preset Intensity Slider', () => {
  const samplePreset: FilterPreset = {
    id: 'test-preset',
    name: 'Test',
    category: 'vivid',
    adjustments: { brightness: 50, contrast: -30, saturation: 60 },
  };

  it('applies full intensity (100%) correctly', () => {
    const result = applyPresetAtIntensity(samplePreset, 100);
    expect(result.brightness).toBe(DEFAULT_ADJUSTMENTS.brightness + 50);
    expect(result.contrast).toBe(DEFAULT_ADJUSTMENTS.contrast + -30);
    expect(result.saturation).toBe(DEFAULT_ADJUSTMENTS.saturation + 60);
  });

  it('applies zero intensity (0%) = defaults', () => {
    const result = applyPresetAtIntensity(samplePreset, 0);
    expect(result.brightness).toBe(DEFAULT_ADJUSTMENTS.brightness);
    expect(result.contrast).toBe(DEFAULT_ADJUSTMENTS.contrast);
    expect(result.saturation).toBe(DEFAULT_ADJUSTMENTS.saturation);
  });

  it('applies 50% intensity = half adjustment values', () => {
    const result = applyPresetAtIntensity(samplePreset, 50);
    expect(result.brightness).toBe(DEFAULT_ADJUSTMENTS.brightness + 25);
    expect(result.contrast).toBe(DEFAULT_ADJUSTMENTS.contrast + -15);
    expect(result.saturation).toBe(DEFAULT_ADJUSTMENTS.saturation + 30);
  });

  it('preserves all default adjustment keys', () => {
    const result = applyPresetAtIntensity(samplePreset, 100);
    for (const key of Object.keys(DEFAULT_ADJUSTMENTS)) {
      expect(result).toHaveProperty(key);
    }
  });

  it('non-specified adjustments remain at defaults', () => {
    const result = applyPresetAtIntensity(samplePreset, 100);
    // sharpen, vignette, grain, etc. should remain at defaults
    expect(result.sharpen).toBe(DEFAULT_ADJUSTMENTS.sharpen);
    expect(result.vignette).toBe(DEFAULT_ADJUSTMENTS.vignette);
    expect(result.grain).toBe(DEFAULT_ADJUSTMENTS.grain);
    expect(result.dehaze).toBe(DEFAULT_ADJUSTMENTS.dehaze);
  });

  it('handles edge-case intensity of 1', () => {
    const result = applyPresetAtIntensity(samplePreset, 1);
    expect(result.brightness).toBeCloseTo(
      DEFAULT_ADJUSTMENTS.brightness + 0.5,
      1,
    );
  });

  it('all BUILTIN presets produce valid adjustments at 100%', () => {
    for (const preset of BUILTIN_PRESETS) {
      const result = applyPresetAtIntensity(preset, 100);
      expect(typeof result.brightness).toBe('number');
      expect(typeof result.contrast).toBe('number');
      expect(typeof result.saturation).toBe('number');
      expect(Number.isNaN(result.brightness)).toBe(false);
    }
  });
});

// ── Photo Adjustments ─────────────────────────────────────────────

describe('Photo Adjustments', () => {
  it('DEFAULT_ADJUSTMENTS has 21 parameters', () => {
    const keys = Object.keys(DEFAULT_ADJUSTMENTS);
    expect(keys.length).toBeGreaterThanOrEqual(21);
  });

  it('DEFAULT_ADJUSTMENTS values are all 0', () => {
    for (const value of Object.values(DEFAULT_ADJUSTMENTS)) {
      expect(value).toBe(0);
    }
  });

  it('adjustmentsToCSSFilter returns a non-empty string', () => {
    const css = adjustmentsToCSSFilter(DEFAULT_ADJUSTMENTS);
    expect(typeof css).toBe('string');
    expect(css.length).toBeGreaterThan(0);
  });

  it('adjustmentsToCSSFilter reflects brightness changes', () => {
    const adj = { ...DEFAULT_ADJUSTMENTS, brightness: 50 };
    const css = adjustmentsToCSSFilter(adj);
    expect(css).toContain('brightness');
  });

  it('adjustmentsToCSSFilter reflects saturation changes', () => {
    const adj = { ...DEFAULT_ADJUSTMENTS, saturation: -50 };
    const css = adjustmentsToCSSFilter(adj);
    expect(css).toContain('saturate');
  });

  it('adjustmentsToCSSFilter reflects contrast changes', () => {
    const adj = { ...DEFAULT_ADJUSTMENTS, contrast: 30 };
    const css = adjustmentsToCSSFilter(adj);
    expect(css).toContain('contrast');
  });
});

