// SPDX-License-Identifier: Apache-2.0
/**
 * PDF Compare/Diff Engine — Sprint 12
 *
 * Provides text-level and visual comparison between two PDF documents.
 * Supports page-level diffing, text change detection, and summary statistics.
 *
 * Architecture:
 * 1. Extract text blocks from both PDFs (via text-extractor bridge)
 * 2. Align pages between the two documents
 * 3. Compute diff (LCS-based) for text changes
 * 4. Optionally generate visual pixel-diff overlays
 *
 * @see agent-docs/plans/PDF_EDITOR_MASTER_PLAN.md — Phase 5 (Compare PDFs)
 */

/* ──────────────────────── Types ──────────────────────── */

export type ChangeType = 'added' | 'removed' | 'modified' | 'unchanged';
export type CompareMode = 'text' | 'visual' | 'overlay';

export interface TextBlock {
  /** Page (1-based) */
  page: number;
  /** Content string */
  text: string;
  /** X coordinate (PDF points) */
  x: number;
  /** Y coordinate (PDF points) */
  y: number;
  /** Width in PDF points */
  width: number;
  /** Height in PDF points */
  height: number;
}

export interface DiffChange {
  id: string;
  type: ChangeType;
  /** Page number in left (source) document */
  leftPage: number | null;
  /** Page number in right (target) document */
  rightPage: number | null;
  /** Original text (null if added) */
  leftText: string | null;
  /** New text (null if removed) */
  rightText: string | null;
  /** Bounding box in left doc */
  leftBounds: { x: number; y: number; width: number; height: number } | null;
  /** Bounding box in right doc */
  rightBounds: { x: number; y: number; width: number; height: number } | null;
}

export interface PageAlignment {
  /** Left document page (null if page only in right) */
  leftPage: number | null;
  /** Right document page (null if page only in left) */
  rightPage: number | null;
  /** Similarity score 0–1 */
  similarity: number;
}

export interface CompareResult {
  /** Unique session ID */
  sessionId: string;
  /** Timestamp of comparison */
  timestamp: number;
  /** Left document info */
  leftDocument: { name: string; pageCount: number };
  /** Right document info */
  rightDocument: { name: string; pageCount: number };
  /** Page alignment map */
  pageAlignments: PageAlignment[];
  /** All detected changes */
  changes: DiffChange[];
  /** Summary statistics */
  summary: CompareSummary;
}

export interface CompareSummary {
  totalChanges: number;
  additions: number;
  removals: number;
  modifications: number;
  unchangedBlocks: number;
  /** Overall similarity percentage 0–100 */
  similarityPercent: number;
  /** Pages that only appear in left */
  leftOnlyPages: number[];
  /** Pages that only appear in right */
  rightOnlyPages: number[];
  /** Pages that are identical */
  identicalPages: number[];
}

export interface CompareOptions {
  /** Compare mode */
  mode: CompareMode;
  /** Ignore whitespace differences */
  ignoreWhitespace: boolean;
  /** Ignore case differences */
  ignoreCase: boolean;
  /** Similarity threshold (0–1) for fuzzy matching */
  fuzzyThreshold: number;
  /** Highlight color for additions */
  addedColor: string;
  /** Highlight color for removals */
  removedColor: string;
  /** Highlight color for modifications */
  modifiedColor: string;
}

/* ──────────────────────── Defaults ──────────────────────── */

export const DEFAULT_COMPARE_OPTIONS: CompareOptions = {
  mode: 'text',
  ignoreWhitespace: false,
  ignoreCase: false,
  fuzzyThreshold: 0.8,
  addedColor: '#22c55e',
  removedColor: '#ef4444',
  modifiedColor: '#f59e0b',
};

export const SIMILARITY_THRESHOLD_IDENTICAL = 0.99;
export const SIMILARITY_THRESHOLD_SIMILAR = 0.6;
export const MAX_PAGES_FOR_COMPARE = 200;

/* ──────────────────────── ID Generation ──────────────────────── */

let _changeCounter = 0;
let _sessionCounter = 0;

/** Reset counters (for testing) */
export function resetCompareCounters(): void {
  _changeCounter = 0;
  _sessionCounter = 0;
}

/* ──────────────────────── Text Normalization ──────────────────────── */

/**
 * Normalise a text string according to compare options.
 */
export function normalizeText(
  text: string,
  options: Pick<CompareOptions, 'ignoreWhitespace' | 'ignoreCase'>,
): string {
  let result = text;
  if (options.ignoreWhitespace) {
    result = result.replace(/\s+/g, ' ').trim();
  }
  if (options.ignoreCase) {
    result = result.toLowerCase();
  }
  return result;
}

/* ──────────────────────── LCS-based Text Diff ──────────────────────── */

/**
 * Compute Longest Common Subsequence length between two arrays.
 */
function lcsLength(a: string[], b: string[]): number {
  const m = a.length;
  const n = b.length;
  // Space-optimized: only keep two rows
  let prev = new Array(n + 1).fill(0);
  let curr = new Array(n + 1).fill(0);
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        curr[j] = prev[j - 1] + 1;
      } else {
        curr[j] = Math.max(prev[j], curr[j - 1]);
      }
    }
    [prev, curr] = [curr, prev.fill(0)];
  }
  return prev[n] ?? 0;
}

/**
 * Split text into sentence-like tokens for diff comparison.
 */
export function tokenize(text: string): string[] {
  return text.split(/(?<=[.!?;])\s+|\n+/).filter((t) => t.length > 0);
}

/**
 * Calculate similarity ratio (0–1) between two strings using LCS.
 */
export function textSimilarity(
  a: string,
  b: string,
  options: Pick<CompareOptions, 'ignoreWhitespace' | 'ignoreCase'> = {
    ignoreWhitespace: false,
    ignoreCase: false,
  },
): number {
  const na = normalizeText(a, options);
  const nb = normalizeText(b, options);
  if (na.length === 0 && nb.length === 0) return 1;
  if (na.length === 0 || nb.length === 0) return 0;
  if (na === nb) return 1;

  const tokA = tokenize(na);
  const tokB = tokenize(nb);
  const maxLen = Math.max(tokA.length, tokB.length);
  if (maxLen === 0) return 1;

  const lcs = lcsLength(tokA, tokB);
  return lcs / maxLen;
}

/* ──────────────────────── Page Alignment ──────────────────────── */

/**
 * Align pages between two documents based on text similarity.
 * Uses greedy best-match alignment.
 */
export function alignPages(
  leftPages: TextBlock[][],
  rightPages: TextBlock[][],
  options: Pick<CompareOptions, 'ignoreWhitespace' | 'ignoreCase'>,
): PageAlignment[] {
  const alignments: PageAlignment[] = [];
  const usedRight = new Set<number>();

  // Build full text per page
  const leftTexts = leftPages.map((blocks) =>
    blocks.map((b) => b.text).join(' '),
  );
  const rightTexts = rightPages.map((blocks) =>
    blocks.map((b) => b.text).join(' '),
  );

  // For each left page, find the best matching right page
  for (let li = 0; li < leftTexts.length; li++) {
    let bestRi = -1;
    let bestSim = 0;

    for (let ri = 0; ri < rightTexts.length; ri++) {
      if (usedRight.has(ri)) continue;
      const sim = textSimilarity(leftTexts[li], rightTexts[ri], options);
      if (sim > bestSim) {
        bestSim = sim;
        bestRi = ri;
      }
    }

    if (bestRi >= 0 && bestSim >= SIMILARITY_THRESHOLD_SIMILAR) {
      usedRight.add(bestRi);
      alignments.push({
        leftPage: li + 1,
        rightPage: bestRi + 1,
        similarity: bestSim,
      });
    } else {
      alignments.push({
        leftPage: li + 1,
        rightPage: null,
        similarity: 0,
      });
    }
  }

  // Add right-only pages
  for (let ri = 0; ri < rightTexts.length; ri++) {
    if (!usedRight.has(ri)) {
      alignments.push({
        leftPage: null,
        rightPage: ri + 1,
        similarity: 0,
      });
    }
  }

  return alignments;
}

/* ──────────────────────── Diff Change Detection ──────────────────────── */

/**
 * Compare text blocks on two aligned pages and produce diff changes.
 */
export function diffPageBlocks(
  leftBlocks: TextBlock[],
  rightBlocks: TextBlock[],
  leftPage: number,
  rightPage: number,
  options: Pick<
    CompareOptions,
    'ignoreWhitespace' | 'ignoreCase' | 'fuzzyThreshold'
  >,
): DiffChange[] {
  const changes: DiffChange[] = [];
  const matched = new Set<number>();

  for (const lb of leftBlocks) {
    const normLeft = normalizeText(lb.text, options);
    let bestIdx = -1;
    let bestSim = 0;

    for (let ri = 0; ri < rightBlocks.length; ri++) {
      if (matched.has(ri)) continue;
      const normRight = normalizeText(rightBlocks[ri].text, options);
      const sim =
        normLeft === normRight
          ? 1
          : textSimilarity(lb.text, rightBlocks[ri].text, options);
      if (sim > bestSim) {
        bestSim = sim;
        bestIdx = ri;
      }
    }

    if (bestIdx >= 0 && bestSim >= options.fuzzyThreshold) {
      matched.add(bestIdx);
      const rb = rightBlocks[bestIdx];

      if (bestSim >= SIMILARITY_THRESHOLD_IDENTICAL) {
        // Unchanged block
        _changeCounter++;
        changes.push({
          id: `change-${_changeCounter}`,
          type: 'unchanged',
          leftPage,
          rightPage,
          leftText: lb.text,
          rightText: rb.text,
          leftBounds: { x: lb.x, y: lb.y, width: lb.width, height: lb.height },
          rightBounds: { x: rb.x, y: rb.y, width: rb.width, height: rb.height },
        });
      } else {
        // Modified block
        _changeCounter++;
        changes.push({
          id: `change-${_changeCounter}`,
          type: 'modified',
          leftPage,
          rightPage,
          leftText: lb.text,
          rightText: rb.text,
          leftBounds: { x: lb.x, y: lb.y, width: lb.width, height: lb.height },
          rightBounds: { x: rb.x, y: rb.y, width: rb.width, height: rb.height },
        });
      }
    } else {
      // Removed (only in left)
      _changeCounter++;
      changes.push({
        id: `change-${_changeCounter}`,
        type: 'removed',
        leftPage,
        rightPage: null,
        leftText: lb.text,
        rightText: null,
        leftBounds: { x: lb.x, y: lb.y, width: lb.width, height: lb.height },
        rightBounds: null,
      });
    }
  }

  // Add right-only blocks (additions)
  for (let ri = 0; ri < rightBlocks.length; ri++) {
    if (!matched.has(ri)) {
      const rb = rightBlocks[ri];
      _changeCounter++;
      changes.push({
        id: `change-${_changeCounter}`,
        type: 'added',
        leftPage: null,
        rightPage,
        leftText: null,
        rightText: rb.text,
        leftBounds: null,
        rightBounds: { x: rb.x, y: rb.y, width: rb.width, height: rb.height },
      });
    }
  }

  return changes;
}

/* ──────────────────────── Summary Builder ──────────────────────── */

/**
 * Build summary statistics from changes and alignments.
 */
export function buildCompareSummary(
  changes: DiffChange[],
  alignments: PageAlignment[],
): CompareSummary {
  let additions = 0;
  let removals = 0;
  let modifications = 0;
  let unchangedBlocks = 0;

  for (const change of changes) {
    switch (change.type) {
      case 'added':
        additions++;
        break;
      case 'removed':
        removals++;
        break;
      case 'modified':
        modifications++;
        break;
      case 'unchanged':
        unchangedBlocks++;
        break;
    }
  }

  const totalChanges = additions + removals + modifications;
  const totalBlocks = totalChanges + unchangedBlocks;
  const similarityPercent =
    totalBlocks > 0 ? Math.round((unchangedBlocks / totalBlocks) * 100) : 100;

  const leftOnlyPages = alignments
    .filter((a) => a.leftPage !== null && a.rightPage === null)
    .map((a) => a.leftPage!);

  const rightOnlyPages = alignments
    .filter((a) => a.rightPage !== null && a.leftPage === null)
    .map((a) => a.rightPage!);

  const identicalPages = alignments
    .filter((a) => a.similarity >= SIMILARITY_THRESHOLD_IDENTICAL)
    .map((a) => a.leftPage!)
    .filter((p) => p !== null);

  return {
    totalChanges,
    additions,
    removals,
    modifications,
    unchangedBlocks,
    similarityPercent,
    leftOnlyPages,
    rightOnlyPages,
    identicalPages,
  };
}

/* ──────────────────────── Full Compare Pipeline ──────────────────────── */

/**
 * Validate inputs before comparison.
 */
export function validateCompareInputs(
  leftPages: TextBlock[][],
  rightPages: TextBlock[][],
): { valid: boolean; error?: string } {
  if (leftPages.length === 0) {
    return { valid: false, error: 'Left document has no pages' };
  }
  if (rightPages.length === 0) {
    return { valid: false, error: 'Right document has no pages' };
  }
  if (leftPages.length > MAX_PAGES_FOR_COMPARE) {
    return {
      valid: false,
      error: `Left document exceeds ${MAX_PAGES_FOR_COMPARE} page limit`,
    };
  }
  if (rightPages.length > MAX_PAGES_FOR_COMPARE) {
    return {
      valid: false,
      error: `Right document exceeds ${MAX_PAGES_FOR_COMPARE} page limit`,
    };
  }
  return { valid: true };
}

/**
 * Run the full compare pipeline:
 * 1. Validate inputs
 * 2. Align pages
 * 3. Diff each aligned page pair
 * 4. Build summary
 */
export function comparePdfs(
  leftName: string,
  rightName: string,
  leftPages: TextBlock[][],
  rightPages: TextBlock[][],
  options: Partial<CompareOptions> = {},
): CompareResult {
  const opts = { ...DEFAULT_COMPARE_OPTIONS, ...options };
  resetCompareCounters();

  // 1. Validate
  const validation = validateCompareInputs(leftPages, rightPages);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // 2. Align pages
  const alignments = alignPages(leftPages, rightPages, opts);

  // 3. Diff each aligned pair
  const allChanges: DiffChange[] = [];
  for (const alignment of alignments) {
    if (alignment.leftPage !== null && alignment.rightPage !== null) {
      const lBlocks = leftPages[alignment.leftPage - 1] ?? [];
      const rBlocks = rightPages[alignment.rightPage - 1] ?? [];
      const pageChanges = diffPageBlocks(
        lBlocks,
        rBlocks,
        alignment.leftPage,
        alignment.rightPage,
        opts,
      );
      allChanges.push(...pageChanges);
    } else if (alignment.leftPage !== null) {
      // Entire page removed
      const lBlocks = leftPages[alignment.leftPage - 1] ?? [];
      for (const lb of lBlocks) {
        _changeCounter++;
        allChanges.push({
          id: `change-${_changeCounter}`,
          type: 'removed',
          leftPage: alignment.leftPage,
          rightPage: null,
          leftText: lb.text,
          rightText: null,
          leftBounds: { x: lb.x, y: lb.y, width: lb.width, height: lb.height },
          rightBounds: null,
        });
      }
    } else if (alignment.rightPage !== null) {
      // Entire page added
      const rBlocks = rightPages[alignment.rightPage - 1] ?? [];
      for (const rb of rBlocks) {
        _changeCounter++;
        allChanges.push({
          id: `change-${_changeCounter}`,
          type: 'added',
          leftPage: null,
          rightPage: alignment.rightPage,
          leftText: null,
          rightText: rb.text,
          leftBounds: null,
          rightBounds: { x: rb.x, y: rb.y, width: rb.width, height: rb.height },
        });
      }
    }
  }

  // 4. Build summary
  const summary = buildCompareSummary(allChanges, alignments);

  _sessionCounter++;
  return {
    sessionId: `compare-${Date.now()}-${_sessionCounter}`,
    timestamp: Date.now(),
    leftDocument: { name: leftName, pageCount: leftPages.length },
    rightDocument: { name: rightName, pageCount: rightPages.length },
    pageAlignments: alignments,
    changes: allChanges,
    summary,
  };
}

/* ──────────────────────── Filtering Helpers ──────────────────────── */

/**
 * Filter changes by type.
 */
export function filterChangesByType(
  changes: DiffChange[],
  type: ChangeType,
): DiffChange[] {
  return changes.filter((c) => c.type === type);
}

/**
 * Filter changes by page number (either left or right).
 */
export function filterChangesByPage(
  changes: DiffChange[],
  page: number,
): DiffChange[] {
  return changes.filter((c) => c.leftPage === page || c.rightPage === page);
}

/**
 * Get human-readable change description.
 */
export function describeChange(change: DiffChange): string {
  switch (change.type) {
    case 'added':
      return `Added on page ${change.rightPage}: "${truncate(change.rightText ?? '', 60)}"`;
    case 'removed':
      return `Removed from page ${change.leftPage}: "${truncate(change.leftText ?? '', 60)}"`;
    case 'modified':
      return `Modified on page ${change.leftPage}→${change.rightPage}: "${truncate(change.leftText ?? '', 30)}" → "${truncate(change.rightText ?? '', 30)}"`;
    case 'unchanged':
      return `Unchanged on page ${change.leftPage}`;
  }
}

function truncate(str: string, maxLen: number): string {
  return str.length > maxLen ? str.slice(0, maxLen - 1) + '…' : str;
}

/**
 * Generate a formatted text report of the comparison.
 */
export function generateCompareReport(result: CompareResult): string {
  const lines: string[] = [
    `PDF Comparison Report`,
    `═══════════════════════════════════════`,
    `Left:  ${result.leftDocument.name} (${result.leftDocument.pageCount} pages)`,
    `Right: ${result.rightDocument.name} (${result.rightDocument.pageCount} pages)`,
    `Date:  ${new Date(result.timestamp).toISOString()}`,
    ``,
    `Summary`,
    `───────────────────────────────────────`,
    `Similarity: ${result.summary.similarityPercent}%`,
    `Total changes: ${result.summary.totalChanges}`,
    `  Additions: ${result.summary.additions}`,
    `  Removals: ${result.summary.removals}`,
    `  Modifications: ${result.summary.modifications}`,
    `  Unchanged blocks: ${result.summary.unchangedBlocks}`,
  ];

  if (result.summary.identicalPages.length > 0) {
    lines.push(`Identical pages: ${result.summary.identicalPages.join(', ')}`);
  }
  if (result.summary.leftOnlyPages.length > 0) {
    lines.push(
      `Pages only in left: ${result.summary.leftOnlyPages.join(', ')}`,
    );
  }
  if (result.summary.rightOnlyPages.length > 0) {
    lines.push(
      `Pages only in right: ${result.summary.rightOnlyPages.join(', ')}`,
    );
  }

  lines.push('', 'Changes', '───────────────────────────────────────');
  const nonUnchanged = result.changes.filter((c) => c.type !== 'unchanged');
  for (const change of nonUnchanged) {
    lines.push(`  [${change.type.toUpperCase()}] ${describeChange(change)}`);
  }

  if (nonUnchanged.length === 0) {
    lines.push('  Documents are identical.');
  }

  return lines.join('\n');
}
