// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── DS-4.4: Filter Presets Unit Tests ─────────────────────────────

import {
  BUILTIN_PRESETS,
  FILTER_CATEGORIES,
  applyPresetAtIntensity,
  presetToCSSFilter,
  type FilterPreset,
  type FilterCategory,
} from '@/components/dashboard/filter-presets';

import {
  DEFAULT_ADJUSTMENTS,
  adjustmentsToCSSFilter,
  type PhotoAdjustments,
} from '@/components/dashboard/photo-adjustments';

describe('DS-4.4 Filter Presets — Preset Data', () => {
  it('has 24 built-in presets (3 per category × 8)', () => {
    expect(BUILTIN_PRESETS).toHaveLength(24);
  });

  it('defines all 8 filter categories', () => {
    expect(FILTER_CATEGORIES).toHaveLength(8);
    const ids = FILTER_CATEGORIES.map((c) => c.id);
    expect(ids).toEqual([
      'vivid',
      'muted',
      'bw',
      'vintage',
      'cinematic',
      'film',
      'moody',
      'clean',
    ]);
  });

  it('every category has exactly 3 presets', () => {
    const categories: FilterCategory[] = [
      'vivid',
      'muted',
      'bw',
      'vintage',
      'cinematic',
      'film',
      'moody',
      'clean',
    ];
    for (const cat of categories) {
      const count = BUILTIN_PRESETS.filter((p) => p.category === cat).length;
      expect(count).toBe(3);
    }
  });

  it('every preset has a unique id', () => {
    const ids = BUILTIN_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every preset has a non-empty name', () => {
    for (const p of BUILTIN_PRESETS) {
      expect(p.name.length).toBeGreaterThan(0);
    }
  });

  it('every preset has at least one adjustment', () => {
    for (const p of BUILTIN_PRESETS) {
      expect(Object.keys(p.adjustments).length).toBeGreaterThan(0);
    }
  });

  it('no built-in preset is marked custom', () => {
    for (const p of BUILTIN_PRESETS) {
      expect(p.isCustom).toBeFalsy();
    }
  });
});

describe('DS-4.4 Filter Presets — applyPresetAtIntensity()', () => {
  const vivid: FilterPreset = {
    id: 'test-vivid',
    name: 'Test',
    category: 'vivid',
    adjustments: { saturation: 40, contrast: 20 },
  };

  it('at intensity=0 returns default adjustments', () => {
    const result = applyPresetAtIntensity(vivid, 0);
    expect(result.saturation).toBe(DEFAULT_ADJUSTMENTS.saturation);
    expect(result.contrast).toBe(DEFAULT_ADJUSTMENTS.contrast);
  });

  it('at intensity=100 returns full preset values', () => {
    const result = applyPresetAtIntensity(vivid, 100);
    expect(result.saturation).toBe(DEFAULT_ADJUSTMENTS.saturation + 40);
    expect(result.contrast).toBe(DEFAULT_ADJUSTMENTS.contrast + 20);
  });

  it('at intensity=50 returns half-way values', () => {
    const result = applyPresetAtIntensity(vivid, 50);
    expect(result.saturation).toBe(DEFAULT_ADJUSTMENTS.saturation + 20);
    expect(result.contrast).toBe(DEFAULT_ADJUSTMENTS.contrast + 10);
  });

  it('preserves unmentioned adjustments as defaults', () => {
    const result = applyPresetAtIntensity(vivid, 100);
    expect(result.brightness).toBe(DEFAULT_ADJUSTMENTS.brightness);
    expect(result.temperature).toBe(DEFAULT_ADJUSTMENTS.temperature);
    expect(result.grain).toBe(DEFAULT_ADJUSTMENTS.grain);
  });
});

describe('DS-4.4 Filter Presets — presetToCSSFilter()', () => {
  it('returns a valid CSS filter string for a preset', () => {
    const preset: FilterPreset = {
      id: 'test',
      name: 'Test',
      category: 'vivid',
      adjustments: { saturation: 40, brightness: 20 },
    };
    const css = presetToCSSFilter(preset);
    expect(css).toContain('saturate(');
    expect(css).toContain('brightness(');
  });

  it('B&W preset has saturate(0)', () => {
    const bwClassic = BUILTIN_PRESETS.find((p) => p.id === 'bw-classic')!;
    const css = presetToCSSFilter(bwClassic);
    // saturation -100 → saturate(0.000)
    expect(css).toContain('saturate(0.000)');
  });

  it('default-only preset returns "none"', () => {
    const noop: FilterPreset = {
      id: 'noop',
      name: 'Noop',
      category: 'clean',
      adjustments: {},
    };
    expect(presetToCSSFilter(noop)).toBe('none');
  });
});

// ── DS-4.6: Markup & Annotation Unit Tests ─────────────────────────

import {
  annotationToSVG,
  exportAnnotationsSVG,
  type Annotation,
  type PenAnnotation,
  type LineAnnotation,
  type RectAnnotation,
  type EllipseAnnotation,
  type TextAnnotation,
  MARKUP_TOOLS,
  MARKUP_COLORS,
  MARKUP_STROKE_WIDTHS,
} from '@/components/dashboard/markup-annotations';

describe('DS-4.6 Markup — Constants', () => {
  it('defines 8 annotation tools', () => {
    expect(MARKUP_TOOLS).toHaveLength(8);
  });

  it('defines at least 8 color swatches', () => {
    expect(MARKUP_COLORS.length).toBeGreaterThanOrEqual(8);
  });

  it('defines at least 4 stroke widths', () => {
    expect(MARKUP_STROKE_WIDTHS.length).toBeGreaterThanOrEqual(4);
  });

  it('all tool entries have tool, label, and icon', () => {
    for (const tool of MARKUP_TOOLS) {
      expect(tool.tool).toBeTruthy();
      expect(tool.label).toBeTruthy();
      expect(tool.icon).toBeDefined();
    }
  });
});

describe('DS-4.6 Markup — annotationToSVG()', () => {
  const basePen: PenAnnotation = {
    id: '1',
    tool: 'pen',
    color: '#ff0000',
    strokeWidth: 3,
    opacity: 1,
    points: [
      [10, 20],
      [30, 40],
      [50, 60],
    ],
  };

  it('renders pen annotation as SVG path', () => {
    const svg = annotationToSVG(basePen);
    expect(svg).toContain('<path');
    expect(svg).toContain('d="M 10,20 L 30,40 L 50,60"');
    expect(svg).toContain('stroke="#ff0000"');
    expect(svg).toContain('stroke-width="3"');
  });

  it('returns empty string for pen with < 2 points', () => {
    const single: PenAnnotation = {
      ...basePen,
      points: [[10, 20]],
    };
    expect(annotationToSVG(single)).toBe('');
  });

  it('renders highlighter as SVG path (same as pen)', () => {
    const hl: PenAnnotation = {
      ...basePen,
      tool: 'highlighter',
      opacity: 0.4,
    };
    const svg = annotationToSVG(hl);
    expect(svg).toContain('<path');
    expect(svg).toContain('opacity="0.4"');
  });

  it('renders line annotation', () => {
    const line: LineAnnotation = {
      id: '2',
      tool: 'line',
      color: '#00ff00',
      strokeWidth: 2,
      opacity: 1,
      x1: 0,
      y1: 0,
      x2: 100,
      y2: 100,
    };
    const svg = annotationToSVG(line);
    expect(svg).toContain('<line');
    expect(svg).toContain('x1="0"');
    expect(svg).toContain('x2="100"');
    expect(svg).toContain('stroke="#00ff00"');
  });

  it('renders arrow annotation with line and arrowhead polygon', () => {
    const arrow: LineAnnotation = {
      id: '3',
      tool: 'arrow',
      color: '#0000ff',
      strokeWidth: 4,
      opacity: 1,
      x1: 0,
      y1: 0,
      x2: 100,
      y2: 0,
    };
    const svg = annotationToSVG(arrow);
    expect(svg).toContain('<line');
    expect(svg).toContain('<polygon');
    expect(svg).toContain('fill="#0000ff"');
  });

  it('arrow arrowhead points toward x2,y2', () => {
    const arrow: LineAnnotation = {
      id: '4',
      tool: 'arrow',
      color: '#000',
      strokeWidth: 4,
      opacity: 1,
      x1: 0,
      y1: 0,
      x2: 100,
      y2: 0,
    };
    const svg = annotationToSVG(arrow);
    // polygon should contain the endpoint "100,0"
    expect(svg).toContain('100,0');
  });

  it('renders rect annotation', () => {
    const rect: RectAnnotation = {
      id: '5',
      tool: 'rect',
      color: '#ff0',
      strokeWidth: 2,
      opacity: 1,
      x: 10,
      y: 20,
      w: 100,
      h: 50,
    };
    const svg = annotationToSVG(rect);
    expect(svg).toContain('<rect');
    expect(svg).toContain('width="100"');
    expect(svg).toContain('height="50"');
    expect(svg).toContain('fill="none"');
  });

  it('renders pixelate annotation as filled rect', () => {
    const pix: RectAnnotation = {
      id: '6',
      tool: 'pixelate',
      color: '#999',
      strokeWidth: 2,
      opacity: 0.6,
      x: 0,
      y: 0,
      w: 50,
      h: 50,
    };
    const svg = annotationToSVG(pix);
    expect(svg).toContain('<rect');
    expect(svg).toContain('fill="#999"');
    // pixelate should NOT have stroke (it's a fill-only rect)
    expect(svg).not.toContain('stroke=');
  });

  it('renders ellipse annotation', () => {
    const ellipse: EllipseAnnotation = {
      id: '7',
      tool: 'ellipse',
      color: '#f0f',
      strokeWidth: 3,
      opacity: 1,
      cx: 50,
      cy: 50,
      rx: 40,
      ry: 20,
    };
    const svg = annotationToSVG(ellipse);
    expect(svg).toContain('<ellipse');
    expect(svg).toContain('cx="50"');
    expect(svg).toContain('rx="40"');
  });

  it('renders text annotation', () => {
    const text: TextAnnotation = {
      id: '8',
      tool: 'text',
      color: '#000',
      strokeWidth: 0,
      opacity: 1,
      x: 10,
      y: 30,
      text: 'Hello World',
      fontSize: 16,
      fontFamily: 'sans-serif',
    };
    const svg = annotationToSVG(text);
    expect(svg).toContain('<text');
    expect(svg).toContain('Hello World');
    expect(svg).toContain('font-size="16"');
  });
});

describe('DS-4.6 Markup — exportAnnotationsSVG()', () => {
  it('wraps annotations in SVG root element', () => {
    const annotations: Annotation[] = [
      {
        id: '1',
        tool: 'rect',
        color: '#f00',
        strokeWidth: 2,
        opacity: 1,
        x: 10,
        y: 20,
        w: 50,
        h: 30,
      } as RectAnnotation,
    ];
    const svg = exportAnnotationsSVG(annotations, 800, 600);
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('width="800"');
    expect(svg).toContain('height="600"');
    expect(svg).toContain('viewBox="0 0 800 600"');
    expect(svg).toContain('<rect');
  });

  it('handles empty annotations array', () => {
    const svg = exportAnnotationsSVG([], 1920, 1080);
    expect(svg).toContain('width="1920"');
    expect(svg).toContain('</svg>');
  });

  it('includes all annotations in output', () => {
    const annotations: Annotation[] = [
      {
        id: '1',
        tool: 'line',
        color: '#f00',
        strokeWidth: 2,
        opacity: 1,
        x1: 0,
        y1: 0,
        x2: 100,
        y2: 100,
      } as LineAnnotation,
      {
        id: '2',
        tool: 'rect',
        color: '#00f',
        strokeWidth: 1,
        opacity: 1,
        x: 20,
        y: 30,
        w: 60,
        h: 40,
      } as RectAnnotation,
    ];
    const svg = exportAnnotationsSVG(annotations, 400, 300);
    expect(svg).toContain('<line');
    expect(svg).toContain('<rect');
  });
});

// ── DS-4.4 + DS-4.6: Specific Named Preset Tests ─────────────────

describe('DS-4.4 Filter Presets — Named Presets', () => {
  it('Vivid > Pop preset has correct adjustments', () => {
    const pop = BUILTIN_PRESETS.find((p) => p.id === 'vivid-pop')!;
    expect(pop.adjustments.saturation).toBe(40);
    expect(pop.adjustments.contrast).toBe(20);
    expect(pop.adjustments.vibrance).toBe(30);
  });

  it('B&W > Noir preset has saturation=-100 and vignette', () => {
    const noir = BUILTIN_PRESETS.find((p) => p.id === 'bw-noir')!;
    expect(noir.adjustments.saturation).toBe(-100);
    expect(noir.adjustments.vignette).toBe(40);
    expect(noir.adjustments.blacks).toBe(-20);
  });

  it('Cinematic > Teal & Orange preset has temperature and tint', () => {
    const teal = BUILTIN_PRESETS.find((p) => p.id === 'cinematic-teal-orange')!;
    expect(teal.adjustments.temperature).toBe(15);
    expect(teal.adjustments.tint).toBe(-15);
  });

  it('Vintage > Retro preset has grain effect', () => {
    const retro = BUILTIN_PRESETS.find((p) => p.id === 'vintage-retro')!;
    expect(retro.adjustments.grain).toBe(20);
    expect(retro.adjustments.temperature).toBe(30);
  });

  it('Film > Kodak preset has warm temperature and grain', () => {
    const kodak = BUILTIN_PRESETS.find((p) => p.id === 'film-kodak')!;
    expect(kodak.adjustments.temperature).toBe(15);
    expect(kodak.adjustments.grain).toBe(15);
  });

  it('Moody > Dark preset has negative brightness and vignette', () => {
    const dark = BUILTIN_PRESETS.find((p) => p.id === 'moody-dark')!;
    expect(dark.adjustments.brightness).toBe(-25);
    expect(dark.adjustments.vignette).toBe(35);
  });

  it('Clean > Crisp preset has clarity and sharpen', () => {
    const crisp = BUILTIN_PRESETS.find((p) => p.id === 'clean-crisp')!;
    expect(crisp.adjustments.clarity).toBe(30);
    expect(crisp.adjustments.sharpen).toBe(25);
  });

  it('Muted > Faded preset has reduced saturation and raised blacks', () => {
    const faded = BUILTIN_PRESETS.find((p) => p.id === 'muted-faded')!;
    expect(faded.adjustments.saturation).toBe(-25);
    expect(faded.adjustments.blacks).toBe(30);
  });
});

// ── DS-4.4 applyPresetAtIntensity — edge cases ───────────────────

describe('DS-4.4 applyPresetAtIntensity — edge cases', () => {
  it('handles negative adjustment values correctly', () => {
    const preset: FilterPreset = {
      id: 'test-neg',
      name: 'Neg',
      category: 'bw',
      adjustments: { saturation: -100, contrast: -50 },
    };
    const result = applyPresetAtIntensity(preset, 100);
    expect(result.saturation).toBe(DEFAULT_ADJUSTMENTS.saturation - 100);
    expect(result.contrast).toBe(DEFAULT_ADJUSTMENTS.contrast - 50);
  });

  it('handles intensity = 25', () => {
    const preset: FilterPreset = {
      id: 'test-quarter',
      name: 'Quarter',
      category: 'vivid',
      adjustments: { brightness: 40 },
    };
    const result = applyPresetAtIntensity(preset, 25);
    expect(result.brightness).toBe(DEFAULT_ADJUSTMENTS.brightness + 10); // 40 * 0.25
  });
});
