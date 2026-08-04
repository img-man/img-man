// SPDX-License-Identifier: Apache-2.0
/**
 * DS-2.1 / DS-2.2 / DS-2.4 — Rich Text Editing Helpers
 *
 * Extended text properties, rich text span model, and container resize logic.
 */

/* ─── Rich text span model ─────────────────────────────────── */

/**
 * A span of formatted text within a single text element.
 * Enables per-character bold/italic/underline, per-range color, etc.
 */
export interface RichTextSpan {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  overline?: boolean;
  color?: string; // per-span override of element color
  fontSize?: number; // per-span override
  fontFamily?: string; // per-span override
}

/**
 * A paragraph in the rich text model (one "line" after Enter).
 */
export interface RichTextParagraph {
  spans: RichTextSpan[];
  align?: 'left' | 'center' | 'right';
}

/* ─── Extended text element properties ─────────────────────── */

/**
 * Additional properties for DS-2.2 Advanced Typography.
 * These extend the existing TextEl interface.
 */
export interface TypographyExtras {
  letterSpacing: number; // px, default 0
  lineHeight: number; // multiplier, default 1.2
  textTransform: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
  textShadowColor: string; // default 'transparent'
  textShadowOffsetX: number; // px, default 0
  textShadowOffsetY: number; // px, default 0
  textShadowBlur: number; // px, default 0
  textStrokeColor: string; // default 'transparent'
  textStrokeWidth: number; // px, default 0
  textDecorationStyle: 'none' | 'underline' | 'line-through' | 'overline';
}

/**
 * DS-2.4 Text container resize modes.
 */
export type TextResizeMode = 'fixed' | 'auto-width' | 'auto-height';

/**
 * Default values for typography extras.
 */
export const DEFAULT_TYPOGRAPHY: TypographyExtras = {
  letterSpacing: 0,
  lineHeight: 1.2,
  textTransform: 'none',
  textShadowColor: 'transparent',
  textShadowOffsetX: 0,
  textShadowOffsetY: 0,
  textShadowBlur: 0,
  textStrokeColor: 'transparent',
  textStrokeWidth: 0,
  textDecorationStyle: 'none',
};

/* ─── Rich text <-> plain text conversion ──────────────────── */

/**
 * Convert a plain text string + element-level formatting into paragraphs.
 */
export function plainToRichText(
  text: string,
  defaults?: Partial<RichTextSpan>,
): RichTextParagraph[] {
  return text.split('\n').map((line) => ({
    spans: [{ text: line || '\u00A0', ...defaults }],
  }));
}

/**
 * Convert rich text paragraphs back to plain text.
 */
export function richTextToPlain(paragraphs: RichTextParagraph[]): string {
  return paragraphs
    .map((p) => p.spans.map((s) => s.text).join(''))
    .join('\n');
}

/**
 * Check if a rich text model has any per-span formatting.
 */
export function hasRichFormatting(paragraphs: RichTextParagraph[]): boolean {
  for (const para of paragraphs) {
    if (para.spans.length > 1) return true;
    for (const span of para.spans) {
      if (span.bold || span.italic || span.underline || span.strikethrough || span.overline) {
        return true;
      }
      if (span.color || span.fontSize || span.fontFamily) return true;
    }
  }
  return false;
}

/* ─── Text Transform ──────────────────────────────────────── */

/**
 * Apply a text transform to a string.
 */
export function applyTextTransform(
  text: string,
  transform: TypographyExtras['textTransform'],
): string {
  switch (transform) {
    case 'uppercase':
      return text.toUpperCase();
    case 'lowercase':
      return text.toLowerCase();
    case 'capitalize':
      return text.replace(/\b\w/g, (c) => c.toUpperCase());
    default:
      return text;
  }
}

/* ─── Text Shadow CSS ─────────────────────────────────────── */

/**
 * Build a CSS text-shadow string from typography extras.
 * Returns 'none' if transparent / zero.
 */
export function textShadowCSS(t: TypographyExtras): string {
  if (
    t.textShadowColor === 'transparent' ||
    (t.textShadowOffsetX === 0 && t.textShadowOffsetY === 0 && t.textShadowBlur === 0)
  ) {
    return 'none';
  }
  return `${t.textShadowOffsetX}px ${t.textShadowOffsetY}px ${t.textShadowBlur}px ${t.textShadowColor}`;
}

/**
 * Build an SVG filter ID string for text shadow.
 * Returns null if no shadow.
 */
export function textShadowSVGFilter(
  t: TypographyExtras,
  filterId: string,
): string | null {
  if (
    t.textShadowColor === 'transparent' ||
    (t.textShadowOffsetX === 0 && t.textShadowOffsetY === 0 && t.textShadowBlur === 0)
  ) {
    return null;
  }
  return `<filter id="${filterId}" x="-50%" y="-50%" width="200%" height="200%">
  <feDropShadow dx="${t.textShadowOffsetX}" dy="${t.textShadowOffsetY}" stdDeviation="${t.textShadowBlur / 2}" flood-color="${t.textShadowColor}" flood-opacity="1"/>
</filter>`;
}

/* ─── Text Stroke (SVG Paint Order) ───────────────────────── */

/**
 * SVG text stroke attributes for outlined text.
 */
export function textStrokeAttrs(t: TypographyExtras): Record<string, string> | null {
  if (t.textStrokeColor === 'transparent' || t.textStrokeWidth === 0) {
    return null;
  }
  return {
    stroke: t.textStrokeColor,
    strokeWidth: String(t.textStrokeWidth),
    paintOrder: 'stroke fill',
    strokeLinejoin: 'round',
  };
}

/* ─── Auto-resize calculations ────────────────────────────── */

/**
 * Measure text dimensions (approximation for canvas-free environments).
 * Works by counting characters × font-size ratios.
 * For production, prefer canvas.measureText() or DOM measurement.
 */
export function measureTextApprox(
  text: string,
  fontSize: number,
  fontFamily: string,
  letterSpacing: number,
  lineHeight: number,
): { width: number; height: number } {
  const lines = text.split('\n');
  // Average character width ≈ 0.6 × fontSize for proportional fonts
  const charWidth = fontSize * 0.6;
  const maxLineWidth = Math.max(
    ...lines.map(
      (line) => line.length * charWidth + (line.length - 1) * letterSpacing,
    ),
    20, // minimum width
  );
  const totalHeight = lines.length * fontSize * lineHeight;
  return { width: maxLineWidth, height: totalHeight };
}

/**
 * Calculate new element dimensions based on resize mode.
 */
export function autoResizeDimensions(
  text: string,
  fontSize: number,
  fontFamily: string,
  letterSpacing: number,
  lineHeight: number,
  currentWidth: number,
  currentHeight: number,
  mode: TextResizeMode,
): { width: number; height: number } {
  if (mode === 'fixed') {
    return { width: currentWidth, height: currentHeight };
  }

  const measured = measureTextApprox(text, fontSize, fontFamily, letterSpacing, lineHeight);

  if (mode === 'auto-width') {
    return {
      width: Math.max(measured.width + 16, 40), // padding + min
      height: measured.height + 8,
    };
  }

  // auto-height: keep width fixed, grow height
  // Approximate line wrapping
  const charWidth = fontSize * 0.6;
  const charsPerLine = Math.max(1, Math.floor((currentWidth - 16) / (charWidth + letterSpacing)));
  const lines = text.split('\n');
  let totalLines = 0;
  for (const line of lines) {
    totalLines += Math.max(1, Math.ceil(line.length / charsPerLine));
  }
  return {
    width: currentWidth,
    height: Math.max(totalLines * fontSize * lineHeight + 8, fontSize * lineHeight + 8),
  };
}

/* ─── Preset text styles ──────────────────────────────────── */

export interface TextPreset {
  id: string;
  name: string;
  fontSize: number;
  fontFamily: string;
  fontWeight: string;
  color: string;
  letterSpacing: number;
  lineHeight: number;
  textTransform: TypographyExtras['textTransform'];
}

export const TEXT_PRESETS: TextPreset[] = [
  {
    id: 'heading-1',
    name: 'Heading 1',
    fontSize: 48,
    fontFamily: 'Inter',
    fontWeight: 'bold',
    color: '#1a1a1a',
    letterSpacing: -1,
    lineHeight: 1.1,
    textTransform: 'none',
  },
  {
    id: 'heading-2',
    name: 'Heading 2',
    fontSize: 36,
    fontFamily: 'Inter',
    fontWeight: 'bold',
    color: '#1a1a1a',
    letterSpacing: -0.5,
    lineHeight: 1.15,
    textTransform: 'none',
  },
  {
    id: 'heading-3',
    name: 'Heading 3',
    fontSize: 28,
    fontFamily: 'Inter',
    fontWeight: '600',
    color: '#333333',
    letterSpacing: 0,
    lineHeight: 1.2,
    textTransform: 'none',
  },
  {
    id: 'subheading',
    name: 'Subheading',
    fontSize: 20,
    fontFamily: 'Inter',
    fontWeight: '500',
    color: '#555555',
    letterSpacing: 0.5,
    lineHeight: 1.3,
    textTransform: 'uppercase',
  },
  {
    id: 'body',
    name: 'Body',
    fontSize: 16,
    fontFamily: 'Inter',
    fontWeight: 'normal',
    color: '#1a1a1a',
    letterSpacing: 0,
    lineHeight: 1.5,
    textTransform: 'none',
  },
  {
    id: 'caption',
    name: 'Caption',
    fontSize: 12,
    fontFamily: 'Inter',
    fontWeight: 'normal',
    color: '#888888',
    letterSpacing: 0.3,
    lineHeight: 1.4,
    textTransform: 'none',
  },
  {
    id: 'display',
    name: 'Display',
    fontSize: 64,
    fontFamily: 'Playfair Display',
    fontWeight: 'bold',
    color: '#1a1a1a',
    letterSpacing: -2,
    lineHeight: 1.0,
    textTransform: 'none',
  },
  {
    id: 'mono',
    name: 'Monospace',
    fontSize: 14,
    fontFamily: 'JetBrains Mono',
    fontWeight: 'normal',
    color: '#1a1a1a',
    letterSpacing: 0,
    lineHeight: 1.6,
    textTransform: 'none',
  },
];
