// SPDX-License-Identifier: Apache-2.0
/**
 * Performance Engine — Phase 6, Week 24
 *
 * Provides:
 * - Virtual page rendering management (buffer-based)
 * - Memory management helpers
 * - IndexedDB page cache management
 * - Performance metrics tracking
 * - Keyboard shortcut registry & matching
 * - Onboarding tour state management
 * - Error recovery classification
 *
 * Note: Actual DOM operations and rendering are handled by React hooks.
 * This engine manages the pure state and decision logic.
 */

import type {
  VirtualPage,
  PerformanceMetrics,
  KeyboardShortcut,
  OnboardingStep,
  ErrorRecoveryInfo,
} from '../types';
import {
  PAGE_RENDER_BUFFER,
  MAX_CACHED_PAGES,
  MEMORY_WARNING_MB,
  KEYBOARD_SHORTCUTS_ADVANCED,
  ONBOARDING_STEPS,
  MAX_FILE_SIZE_MB,
} from '../constants';

/* ══════════════════════════════════════════════════════════════════════════
   Virtual page rendering
   ══════════════════════════════════════════════════════════════════════════ */

/** Create the virtual page list for a document. */
export function createVirtualPages(totalPages: number): VirtualPage[] {
  return Array.from({ length: totalPages }, (_, i) => ({
    pageNumber: i + 1,
    rendered: false,
  }));
}

/**
 * Determine which pages should be rendered based on current viewport.
 * Returns page numbers that should be in the buffer.
 */
export function getVisiblePageRange(
  currentPage: number,
  totalPages: number,
  buffer: number = PAGE_RENDER_BUFFER,
): { start: number; end: number } {
  const start = Math.max(1, currentPage - buffer);
  const end = Math.min(totalPages, currentPage + buffer);
  return { start, end };
}

/** Get pages that need rendering (not yet rendered + in range). */
export function getPagesToRender(
  pages: VirtualPage[],
  range: { start: number; end: number },
): number[] {
  return pages
    .filter(
      (p) =>
        p.pageNumber >= range.start && p.pageNumber <= range.end && !p.rendered,
    )
    .map((p) => p.pageNumber);
}

/** Mark pages as rendered. */
export function markPagesRendered(
  pages: VirtualPage[],
  renderedPages: number[],
): VirtualPage[] {
  const set = new Set(renderedPages);
  return pages.map((p) =>
    set.has(p.pageNumber)
      ? { ...p, rendered: true, lastRenderedAt: new Date() }
      : p,
  );
}

/** Evict pages outside the buffer to free memory. */
export function evictDistantPages(
  pages: VirtualPage[],
  currentPage: number,
  maxCached: number = MAX_CACHED_PAGES,
): { pages: VirtualPage[]; evicted: number[] } {
  const rendered = pages.filter((p) => p.rendered);
  if (rendered.length <= maxCached) {
    return { pages, evicted: [] };
  }

  // Sort by distance from current page (farthest first)
  const sorted = [...rendered].sort(
    (a, b) =>
      Math.abs(b.pageNumber - currentPage) -
      Math.abs(a.pageNumber - currentPage),
  );

  const toEvict = sorted.slice(maxCached).map((p) => p.pageNumber);
  const evictSet = new Set(toEvict);

  return {
    pages: pages.map((p) =>
      evictSet.has(p.pageNumber)
        ? { ...p, rendered: false, canvas: undefined }
        : p,
    ),
    evicted: toEvict,
  };
}

/** Count currently rendered pages. */
export function countRenderedPages(pages: VirtualPage[]): number {
  return pages.filter((p) => p.rendered).length;
}

/* ══════════════════════════════════════════════════════════════════════════
   Performance metrics
   ══════════════════════════════════════════════════════════════════════════ */

/** Create initial performance metrics. */
export function createPerformanceMetrics(
  totalPages: number,
): PerformanceMetrics {
  return {
    renderTime: 0,
    memoryUsage: 0,
    pagesCached: 0,
    totalPages,
  };
}

/** Update metrics after a render cycle. */
export function updateMetrics(
  metrics: PerformanceMetrics,
  updates: Partial<PerformanceMetrics>,
): PerformanceMetrics {
  return { ...metrics, ...updates };
}

/** Check if memory usage is above the warning threshold. */
export function isMemoryWarning(memoryMB: number): boolean {
  return memoryMB > MEMORY_WARNING_MB;
}

/** Estimate memory usage from rendered page count + average size. */
export function estimateMemoryUsage(
  renderedPages: number,
  avgPageSizeKB: number = 200,
): number {
  return Math.round((renderedPages * avgPageSizeKB) / 1024); // MB
}

/* ══════════════════════════════════════════════════════════════════════════
   Keyboard shortcuts
   ══════════════════════════════════════════════════════════════════════════ */

/** Get all keyboard shortcuts. */
export function getAllShortcuts(): KeyboardShortcut[] {
  return KEYBOARD_SHORTCUTS_ADVANCED.map((s) => ({
    key: s.key,
    ctrlKey: 'ctrlKey' in s ? s.ctrlKey : undefined,
    shiftKey: 'shiftKey' in s ? s.shiftKey : undefined,
    altKey: undefined,
    action: s.action,
    label: s.label,
    category: s.category,
  })) as KeyboardShortcut[];
}

/** Get shortcuts grouped by category. */
export function getShortcutsByCategory(): Record<string, KeyboardShortcut[]> {
  const shortcuts = getAllShortcuts();
  const groups: Record<string, KeyboardShortcut[]> = {};
  for (const s of shortcuts) {
    if (!groups[s.category]) groups[s.category] = [];
    groups[s.category].push(s);
  }
  return groups;
}

/** Match a keyboard event to a shortcut action. */
export function matchShortcut(event: {
  key: string;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}): string | null {
  for (const shortcut of KEYBOARD_SHORTCUTS_ADVANCED) {
    const hasCtrl = 'ctrlKey' in shortcut && shortcut.ctrlKey;
    const hasShift = 'shiftKey' in shortcut && shortcut.shiftKey;
    const ctrlMatch = hasCtrl ? event.ctrlKey : !event.ctrlKey;
    const shiftMatch = hasShift ? event.shiftKey : !event.shiftKey;
    const altMatch = !event.altKey; // No shortcuts use alt key currently
    const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();

    if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
      return shortcut.action;
    }
  }
  return null;
}

/** Format a shortcut for display (e.g., "Ctrl+S"). */
export function formatShortcut(shortcut: KeyboardShortcut): string {
  const parts: string[] = [];
  if (shortcut.ctrlKey) parts.push('Ctrl');
  if (shortcut.shiftKey) parts.push('Shift');
  if (shortcut.altKey) parts.push('Alt');

  // Pretty-print the key
  const keyLabel =
    shortcut.key === ' '
      ? 'Space'
      : shortcut.key === 'Delete'
        ? 'Del'
        : shortcut.key === 'Backspace'
          ? '⌫'
          : shortcut.key === 'ArrowLeft'
            ? '←'
            : shortcut.key === 'ArrowRight'
              ? '→'
              : shortcut.key === 'ArrowUp'
                ? '↑'
                : shortcut.key === 'ArrowDown'
                  ? '↓'
                  : shortcut.key.length === 1
                    ? shortcut.key.toUpperCase()
                    : shortcut.key;

  parts.push(keyLabel);
  return parts.join('+');
}

/* ══════════════════════════════════════════════════════════════════════════
   Onboarding tour
   ══════════════════════════════════════════════════════════════════════════ */

/** Get all onboarding steps. */
export function getOnboardingSteps(): OnboardingStep[] {
  return ONBOARDING_STEPS.map((s) => ({
    id: s.id,
    title: s.title,
    description: s.description,
    target: s.target,
    position: s.position,
    completed: false,
  }));
}

/** Mark a step as completed. */
export function completeOnboardingStep(
  steps: OnboardingStep[],
  stepId: string,
): OnboardingStep[] {
  return steps.map((s) => (s.id === stepId ? { ...s, completed: true } : s));
}

/** Get the next incomplete step. */
export function getNextStep(steps: OnboardingStep[]): OnboardingStep | null {
  return steps.find((s) => !s.completed) ?? null;
}

/** Check if all onboarding steps are completed. */
export function isOnboardingComplete(steps: OnboardingStep[]): boolean {
  return steps.every((s) => s.completed);
}

/** Get onboarding progress percentage. */
export function getOnboardingProgress(steps: OnboardingStep[]): number {
  if (steps.length === 0) return 100;
  const completed = steps.filter((s) => s.completed).length;
  return Math.round((completed / steps.length) * 100);
}

/* ══════════════════════════════════════════════════════════════════════════
   Error recovery
   ══════════════════════════════════════════════════════════════════════════ */

/** Classify a PDF loading error and provide recovery information. */
export function classifyError(
  error: Error | string,
  fileSizeMB?: number,
): ErrorRecoveryInfo {
  const message = typeof error === 'string' ? error : error.message;
  const lowerMsg = message.toLowerCase();

  if (lowerMsg.includes('password') || lowerMsg.includes('encrypted')) {
    return {
      type: 'encrypted',
      message: 'This PDF is password-protected.',
      recoverable: true,
      suggestion: 'Enter the document password to proceed.',
    };
  }

  if (fileSizeMB && fileSizeMB > MAX_FILE_SIZE_MB) {
    return {
      type: 'oversized',
      message: `File size (${fileSizeMB}MB) exceeds the ${MAX_FILE_SIZE_MB}MB limit.`,
      recoverable: false,
      suggestion: 'Try compressing the PDF or splitting it into smaller parts.',
    };
  }

  if (
    lowerMsg.includes('network') ||
    lowerMsg.includes('fetch') ||
    lowerMsg.includes('timeout')
  ) {
    return {
      type: 'network',
      message: 'A network error occurred while loading the document.',
      recoverable: true,
      suggestion: 'Check your internet connection and try again.',
    };
  }

  if (
    lowerMsg.includes('invalid') ||
    lowerMsg.includes('corrupt') ||
    lowerMsg.includes('malformed')
  ) {
    return {
      type: 'corrupted',
      message: 'This PDF appears to be corrupted or invalid.',
      recoverable: false,
      suggestion: 'Try re-downloading the file or using a different PDF.',
    };
  }

  if (lowerMsg.includes('version') || lowerMsg.includes('unsupported')) {
    return {
      type: 'unsupported',
      message: 'This PDF version or feature is not supported.',
      recoverable: false,
      suggestion:
        'Try saving the PDF in a compatible format (PDF 1.7 or lower).',
    };
  }

  // Generic fallback
  return {
    type: 'corrupted',
    message: message || 'An unexpected error occurred.',
    recoverable: false,
    suggestion: 'Try uploading a different PDF file.',
  };
}

/** Check if a file size is acceptable. */
export function isFileSizeAcceptable(fileSizeMB: number): boolean {
  return fileSizeMB <= MAX_FILE_SIZE_MB;
}

/** Get a human-readable file size string. */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
