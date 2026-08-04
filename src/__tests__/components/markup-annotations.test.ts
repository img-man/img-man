// SPDX-License-Identifier: Apache-2.0
/**
 * Markup & Annotation Tools Tests
 * Tests for annotation tools, SVG export, and markup constants.
 */
import { describe, it, expect } from 'vitest';

import {
  MARKUP_TOOLS,
  MARKUP_COLORS,
  MARKUP_STROKE_WIDTHS,
  annotationToSVG,
  exportAnnotationsSVG,
  type Annotation,
  type AnnotationTool,
} from '@/components/dashboard/markup-annotations';

// ── 11.4 Markup / Annotation Tools ───────────────────────────────

describe('Markup & Annotations', () => {
  it('exports 8 MARKUP_TOOLS', () => {
    expect(MARKUP_TOOLS.length).toBe(8);
    const tools = MARKUP_TOOLS.map((t) => t.tool);
    expect(tools).toContain('pen');
    expect(tools).toContain('line');
    expect(tools).toContain('arrow');
    expect(tools).toContain('rect');
    expect(tools).toContain('ellipse');
    expect(tools).toContain('text');
    expect(tools).toContain('highlighter');
    expect(tools).toContain('pixelate');
  });

  it('every MARKUP_TOOL has a label and icon', () => {
    for (const tool of MARKUP_TOOLS) {
      expect(tool.label.length).toBeGreaterThan(0);
      expect(tool.icon).toBeDefined();
    }
  });

  it('exports MARKUP_COLORS with at least 6 colors', () => {
    expect(MARKUP_COLORS.length).toBeGreaterThanOrEqual(6);
    for (const color of MARKUP_COLORS) {
      // Each color should be a valid hex or named color
      expect(typeof color).toBe('string');
      expect(color.length).toBeGreaterThan(0);
    }
  });

  it('exports MARKUP_STROKE_WIDTHS with at least 3 widths', () => {
    expect(MARKUP_STROKE_WIDTHS.length).toBeGreaterThanOrEqual(3);
    for (const width of MARKUP_STROKE_WIDTHS) {
      expect(typeof width).toBe('number');
      expect(width).toBeGreaterThan(0);
    }
  });

  // 11.5 – Pixelate tool included
  it('includes pixelate tool for privacy redaction (11.5)', () => {
    const pixelate = MARKUP_TOOLS.find((t) => t.tool === 'pixelate');
    expect(pixelate).toBeDefined();
    expect(pixelate!.label).toBeTruthy();
  });
});

// ── Annotation → SVG ──────────────────────────────────────────────

describe('Annotation SVG Export', () => {
  const lineAnnotation: Annotation = {
    id: 'ann-1',
    tool: 'line' as AnnotationTool,
    points: [
      { x: 10, y: 20 },
      { x: 100, y: 200 },
    ],
    color: '#ff0000',
    strokeWidth: 2,
    timestamp: Date.now(),
  };

  const rectAnnotation: Annotation = {
    id: 'ann-2',
    tool: 'rect' as AnnotationTool,
    points: [
      { x: 0, y: 0 },
      { x: 50, y: 50 },
    ],
    color: '#00ff00',
    strokeWidth: 3,
    timestamp: Date.now(),
  };

  const textAnnotation: Annotation = {
    id: 'ann-3',
    tool: 'text' as AnnotationTool,
    points: [{ x: 30, y: 40 }],
    color: '#0000ff',
    strokeWidth: 1,
    text: 'Hello World',
    fontSize: 24,
    timestamp: Date.now(),
  };

  it('annotationToSVG returns SVG markup for line', () => {
    const svg = annotationToSVG(lineAnnotation);
    expect(typeof svg).toBe('string');
    expect(svg.length).toBeGreaterThan(0);
  });

  it('annotationToSVG returns SVG markup for rect', () => {
    const svg = annotationToSVG(rectAnnotation);
    expect(typeof svg).toBe('string');
    expect(svg.length).toBeGreaterThan(0);
  });

  it('annotationToSVG returns SVG markup for text', () => {
    const svg = annotationToSVG(textAnnotation);
    expect(typeof svg).toBe('string');
    expect(svg.length).toBeGreaterThan(0);
  });

  it('exportAnnotationsSVG wraps elements in an SVG root', () => {
    const svg = exportAnnotationsSVG(
      [lineAnnotation, rectAnnotation],
      800,
      600,
    );
    expect(svg).toContain('<svg');
    expect(svg).toContain('width="800"');
    expect(svg).toContain('height="600"');
    expect(svg).toContain('</svg>');
  });

  it('exportAnnotationsSVG handles empty annotations', () => {
    const svg = exportAnnotationsSVG([], 800, 600);
    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
  });

  it('annotationToSVG includes color attribute', () => {
    const svg = annotationToSVG(lineAnnotation);
    expect(svg).toContain('#ff0000');
  });

  it('annotationToSVG includes stroke-width', () => {
    const svg = annotationToSVG(rectAnnotation);
    expect(svg).toContain('3');
  });
});

