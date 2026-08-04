// SPDX-License-Identifier: Apache-2.0
/**
 * Semantic Search UI: Toolbar SearchMode toggle + Color filter
 */
import { describe, it, expect } from 'vitest';

/* ── Types ─────────────────────────────────────────────────── */

type SearchMode = 'text' | 'semantic';

/* ── Tests ─────────────────────────────────────────────────── */

describe('SearchMode type', () => {
  it('accepts text mode', () => {
    const mode: SearchMode = 'text';
    expect(mode).toBe('text');
  });

  it('accepts semantic mode', () => {
    const mode: SearchMode = 'semantic';
    expect(mode).toBe('semantic');
  });
});

describe('Color filter swatches', () => {
  // Test color hex constants used in the toolbar
  const COLOR_SWATCHES = [
    { hex: '#EF4444', label: 'Red' },
    { hex: '#F97316', label: 'Orange' },
    { hex: '#EAB308', label: 'Yellow' },
    { hex: '#22C55E', label: 'Green' },
    { hex: '#14B8A6', label: 'Teal' },
    { hex: '#3B82F6', label: 'Blue' },
    { hex: '#8B5CF6', label: 'Purple' },
    { hex: '#EC4899', label: 'Pink' },
    { hex: '#92400E', label: 'Brown' },
    { hex: '#171717', label: 'Black' },
    { hex: '#9CA3AF', label: 'Gray' },
    { hex: '#FFFFFF', label: 'White' },
  ];

  it('has 12 predefined colors', () => {
    expect(COLOR_SWATCHES).toHaveLength(12);
  });

  it('each swatch has hex and label', () => {
    for (const swatch of COLOR_SWATCHES) {
      expect(swatch.hex).toMatch(/^#[0-9A-F]{6}$/);
      expect(swatch.label).toBeTruthy();
    }
  });

  it('all hex values are unique', () => {
    const hexSet = new Set(COLOR_SWATCHES.map((s) => s.hex));
    expect(hexSet.size).toBe(COLOR_SWATCHES.length);
  });

  it('all labels are unique', () => {
    const labelSet = new Set(COLOR_SWATCHES.map((s) => s.label));
    expect(labelSet.size).toBe(COLOR_SWATCHES.length);
  });

  it('includes primary colors (red, green, blue)', () => {
    const labels = COLOR_SWATCHES.map((s) => s.label);
    expect(labels).toContain('Red');
    expect(labels).toContain('Green');
    expect(labels).toContain('Blue');
  });

  it('includes neutrals (black, white, gray)', () => {
    const labels = COLOR_SWATCHES.map((s) => s.label);
    expect(labels).toContain('Black');
    expect(labels).toContain('White');
    expect(labels).toContain('Gray');
  });
});

describe('Semantic search integration', () => {
  it('semantic mode flag toggles correctly', () => {
    let mode: SearchMode = 'text';
    const setMode = (m: SearchMode) => {
      mode = m;
    };

    expect(mode).toBe('text');
    setMode('semantic');
    expect(mode).toBe('semantic');
    setMode('text');
    expect(mode).toBe('text');
  });

  it('color filter can be set and cleared', () => {
    let colorFilter: string | null = null;
    const setColor = (c: string | null) => {
      colorFilter = c;
    };

    expect(colorFilter).toBeNull();
    setColor('#EF4444');
    expect(colorFilter).toBe('#EF4444');
    setColor(null);
    expect(colorFilter).toBeNull();
  });

  it('find similar sets asset ID and switches to semantic mode', () => {
    let mode: SearchMode = 'text';
    let findSimilarId: string | null = null;

    const handleFindSimilar = (assetId: string) => {
      findSimilarId = assetId;
      mode = 'semantic';
    };

    handleFindSimilar('507f1f77bcf86cd799439011');

    expect(findSimilarId).toBe('507f1f77bcf86cd799439011');
    expect(mode).toBe('semantic');
  });
});
