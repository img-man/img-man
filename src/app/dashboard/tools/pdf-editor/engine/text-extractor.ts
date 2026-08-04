// SPDX-License-Identifier: Apache-2.0
/**
 * Text Extractor Engine — Phase 3, Week 9
 *
 * Extracts text blocks from PDF pages using PDF.js text content API.
 * Maps PDF internal font names to web-safe equivalents for in-place editing.
 * Provides find/replace functionality across all extracted text blocks.
 */

import type { ExtractedTextBlock, FindMatch, PageMeta } from '../types';
import { FONT_SUBSTITUTION_MAP, FALLBACK_FONT } from '../constants';

/* ──────────────────────── Font Mapping ──────────────────────── */

/**
 * Map a PDF internal font name to a web-safe font family.
 * Strips common suffixes and checks the substitution table.
 */
export function mapFontName(pdfFontName: string): string {
  if (!pdfFontName) return FALLBACK_FONT;

  // Direct lookup
  if (FONT_SUBSTITUTION_MAP[pdfFontName]) {
    return FONT_SUBSTITUTION_MAP[pdfFontName];
  }

  // Strip common prefixes (e.g., "AAAAAB+" used for subset fonts)
  const stripped = pdfFontName.replace(/^[A-Z]{6}\+/, '');
  if (FONT_SUBSTITUTION_MAP[stripped]) {
    return FONT_SUBSTITUTION_MAP[stripped];
  }

  // Remove hyphens/spaces and try again
  const normalized = stripped.replace(/[-\s]/g, '');
  for (const [key, value] of Object.entries(FONT_SUBSTITUTION_MAP)) {
    if (key.replace(/[-\s]/g, '') === normalized) {
      return value;
    }
  }

  // Return the stripped name if it looks reasonable, else fallback
  return stripped || FALLBACK_FONT;
}

/**
 * Infer font weight from PDF font name.
 */
export function inferFontWeight(pdfFontName: string): 'normal' | 'bold' {
  const lower = pdfFontName.toLowerCase();
  return /bold|heavy|black/i.test(lower) ? 'bold' : 'normal';
}

/**
 * Infer font style from PDF font name.
 */
export function inferFontStyle(pdfFontName: string): 'normal' | 'italic' {
  const lower = pdfFontName.toLowerCase();
  return /italic|oblique/i.test(lower) ? 'italic' : 'normal';
}

/* ──────────────────────── Text Extraction ──────────────────────── */

let _blockCounter = 0;

/**
 * Extract text blocks from a single PDF.js page.
 *
 * Uses the PDF.js `getTextContent()` API which returns individual text items
 * with position/transform/font information. Groups adjacent items into blocks.
 *
 * @param pdfPage - PDF.js page proxy (from `pdfDoc.getPage(n)`)
 * @param pageNumber - 1-based page number
 * @returns Array of extracted text blocks
 */
export async function extractTextFromPage(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pdfPage: any,
  pageNumber: number,
): Promise<ExtractedTextBlock[]> {
  const textContent = await pdfPage.getTextContent();
  const viewport = pdfPage.getViewport({ scale: 1.0 });
  const blocks: ExtractedTextBlock[] = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const item of textContent.items as any[]) {
    if (!item.str || item.str.trim() === '') continue;

    // item.transform = [scaleX, skewY, skewX, scaleY, translateX, translateY]
    const tx = item.transform;
    const fontSize = Math.abs(tx[3]) || Math.abs(tx[0]) || 12;
    const x = tx[4];
    // PDF.js uses bottom-left origin; convert to top-left
    const y = viewport.height - tx[5] - fontSize;
    const width = item.width || item.str.length * fontSize * 0.6;
    const height = fontSize * 1.2;

    const fontName: string = item.fontName || '';
    const direction = item.dir === 'rtl' ? ('rtl' as const) : ('ltr' as const);

    blocks.push({
      id: `tb-${++_blockCounter}-${pageNumber}`,
      page: pageNumber,
      text: item.str,
      x,
      y,
      width,
      height,
      fontName,
      fontFamily: mapFontName(fontName),
      fontSize,
      color: '#000000', // PDF.js doesn't reliably expose color; default to black
      fontWeight: inferFontWeight(fontName),
      fontStyle: inferFontStyle(fontName),
      direction,
    });
  }

  return blocks;
}

/**
 * Extract text blocks from all pages.
 *
 * @param pdfDoc - PDF.js document proxy
 * @param totalPages - Total number of pages
 * @returns Map of page number → text blocks
 */
export async function extractAllText(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pdfDoc: any,
  totalPages: number,
): Promise<Map<number, ExtractedTextBlock[]>> {
  const result = new Map<number, ExtractedTextBlock[]>();

  for (let i = 1; i <= totalPages; i++) {
    const page = await pdfDoc.getPage(i);
    const blocks = await extractTextFromPage(page, i);
    result.set(i, blocks);
  }

  return result;
}

/* ──────────────────────── Merge Adjacent Items ──────────────────────── */

/**
 * Merge adjacent text items that share the same font/size/line
 * into larger blocks for cleaner editing experience.
 */
export function mergeAdjacentBlocks(
  blocks: ExtractedTextBlock[],
  lineThreshold = 2,
): ExtractedTextBlock[] {
  if (blocks.length === 0) return [];

  // Sort by y then x
  const sorted = [...blocks].sort((a, b) => {
    const yDiff = a.y - b.y;
    return Math.abs(yDiff) < lineThreshold ? a.x - b.x : yDiff;
  });

  const merged: ExtractedTextBlock[] = [];
  let current = { ...sorted[0] };

  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i];

    // Same line, same font/size, adjacent horizontally
    const sameLine = Math.abs(next.y - current.y) < lineThreshold;
    const sameFont =
      next.fontFamily === current.fontFamily &&
      next.fontSize === current.fontSize;
    const adjacent =
      next.x <= current.x + current.width + current.fontSize * 0.5;

    if (sameLine && sameFont && adjacent) {
      // Merge
      current.text += next.text;
      current.width = next.x + next.width - current.x;
      current.height = Math.max(current.height, next.height);
    } else {
      merged.push(current);
      current = { ...next };
    }
  }
  merged.push(current);

  return merged;
}

/* ──────────────────────── Find & Replace ──────────────────────── */

/**
 * Search across all text blocks for matches.
 *
 * @param textBlocks - Map of page → text blocks
 * @param query - Search string
 * @param caseSensitive - Whether to match case
 * @param useRegex - Whether query is a regex pattern
 * @returns Array of all matches across all pages
 */
export function findInTextBlocks(
  textBlocks: Map<number, ExtractedTextBlock[]>,
  query: string,
  caseSensitive = false,
  useRegex = false,
): FindMatch[] {
  if (!query) return [];

  const matches: FindMatch[] = [];

  let regex: RegExp;
  try {
    const flags = caseSensitive ? 'g' : 'gi';
    regex = useRegex
      ? new RegExp(query, flags)
      : new RegExp(escapeRegex(query), flags);
  } catch {
    return []; // Invalid regex
  }

  for (const [page, blocks] of textBlocks) {
    for (const block of blocks) {
      let match: RegExpExecArray | null;
      regex.lastIndex = 0;

      while ((match = regex.exec(block.text)) !== null) {
        matches.push({
          page,
          blockId: block.id,
          startIndex: match.index,
          endIndex: match.index + match[0].length,
          matchedText: match[0],
        });

        // Prevent infinite loop on zero-length matches
        if (match[0].length === 0) {
          regex.lastIndex++;
        }
      }
    }
  }

  return matches;
}

/**
 * Replace a single match in a text block.
 * Returns the updated text or null if block not found.
 */
export function replaceMatch(
  textBlocks: Map<number, ExtractedTextBlock[]>,
  match: FindMatch,
  replacement: string,
): string | null {
  const blocks = textBlocks.get(match.page);
  if (!blocks) return null;

  const block = blocks.find((b) => b.id === match.blockId);
  if (!block) return null;

  const before = block.text.slice(0, match.startIndex);
  const after = block.text.slice(match.endIndex);
  block.text = before + replacement + after;

  return block.text;
}

/**
 * Replace all matches with the given replacement text.
 * Processes in reverse order to preserve indices.
 * Returns the count of replacements made.
 */
export function replaceAllMatches(
  textBlocks: Map<number, ExtractedTextBlock[]>,
  matches: FindMatch[],
  replacement: string,
): number {
  // Process in reverse order to preserve indices
  const sorted = [...matches].sort((a, b) => {
    if (a.page !== b.page) return b.page - a.page;
    if (a.blockId !== b.blockId) return a.blockId > b.blockId ? -1 : 1;
    return b.startIndex - a.startIndex;
  });

  let count = 0;
  for (const match of sorted) {
    if (replaceMatch(textBlocks, match, replacement) !== null) {
      count++;
    }
  }

  return count;
}

/* ──────────────────────── Helpers ──────────────────────── */

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Get plain text from all blocks on a page (for search purposes).
 */
export function getPagePlainText(blocks: ExtractedTextBlock[]): string {
  return blocks.map((b) => b.text).join(' ');
}

/**
 * Estimate reflow: recalculate text block width after content change.
 * Simple heuristic based on character count × average char width.
 */
export function reflowTextBlock(
  block: ExtractedTextBlock,
  maxWidth?: number,
): ExtractedTextBlock {
  const avgCharWidth = block.fontSize * 0.6;
  const newWidth = block.text.length * avgCharWidth;

  if (maxWidth && newWidth > maxWidth) {
    // Text needs to wrap — increase height, cap width
    const lines = Math.ceil(newWidth / maxWidth);
    return {
      ...block,
      width: maxWidth,
      height: lines * block.fontSize * 1.2,
    };
  }

  return {
    ...block,
    width: Math.max(newWidth, block.fontSize), // min 1 char wide
  };
}
