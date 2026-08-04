// SPDX-License-Identifier: Apache-2.0
/**
 * Performance Engine — Phase 6 Tests
 *
 * Tests virtual page rendering, metrics, keyboard shortcuts,
 * onboarding tour, and error recovery.
 */

import { describe, it, expect } from 'vitest';
import {
  createVirtualPages,
  getVisiblePageRange,
  getPagesToRender,
  markPagesRendered,
  evictDistantPages,
  countRenderedPages,
  createPerformanceMetrics,
  updateMetrics,
  isMemoryWarning,
  estimateMemoryUsage,
  getAllShortcuts,
  getShortcutsByCategory,
  matchShortcut,
  formatShortcut,
  getOnboardingSteps,
  completeOnboardingStep,
  getNextStep,
  isOnboardingComplete,
  getOnboardingProgress,
  classifyError,
  isFileSizeAcceptable,
  formatFileSize,
} from '../../app/dashboard/tools/pdf-editor/engine/performance-engine';
import {
  PAGE_RENDER_BUFFER,
  MAX_CACHED_PAGES,
  MEMORY_WARNING_MB,
  MAX_FILE_SIZE_MB,
} from '../../app/dashboard/tools/pdf-editor/constants';

describe('Performance Engine (Phase 6)', () => {
  /* ═══════ Virtual page rendering ═══════ */
  describe('createVirtualPages', () => {
    it('creates pages array with correct length', () => {
      const pages = createVirtualPages(10);
      expect(pages).toHaveLength(10);
      expect(pages[0].pageNumber).toBe(1);
      expect(pages[9].pageNumber).toBe(10);
    });

    it('all pages start as unrendered', () => {
      const pages = createVirtualPages(5);
      expect(pages.every((p) => p.rendered === false)).toBe(true);
    });
  });

  describe('getVisiblePageRange', () => {
    it('returns buffered range around current page', () => {
      const range = getVisiblePageRange(5, 20);
      expect(range.start).toBe(5 - PAGE_RENDER_BUFFER);
      expect(range.end).toBe(5 + PAGE_RENDER_BUFFER);
    });

    it('clamps to page 1 at start', () => {
      const range = getVisiblePageRange(1, 20);
      expect(range.start).toBe(1);
    });

    it('clamps to totalPages at end', () => {
      const range = getVisiblePageRange(20, 20);
      expect(range.end).toBe(20);
    });

    it('supports custom buffer', () => {
      const range = getVisiblePageRange(10, 50, 5);
      expect(range.start).toBe(5);
      expect(range.end).toBe(15);
    });
  });

  describe('getPagesToRender', () => {
    it('returns unrendered pages within range', () => {
      const pages = createVirtualPages(10);
      const range = { start: 3, end: 7 };
      const toRender = getPagesToRender(pages, range);
      expect(toRender).toEqual([3, 4, 5, 6, 7]);
    });

    it('excludes already rendered pages', () => {
      let pages = createVirtualPages(10);
      pages = markPagesRendered(pages, [4, 5]);
      const toRender = getPagesToRender(pages, { start: 3, end: 7 });
      expect(toRender).toEqual([3, 6, 7]);
    });
  });

  describe('markPagesRendered', () => {
    it('marks specified pages as rendered', () => {
      const pages = createVirtualPages(5);
      const rendered = markPagesRendered(pages, [2, 3]);
      expect(rendered[1].rendered).toBe(true);
      expect(rendered[2].rendered).toBe(true);
      expect(rendered[0].rendered).toBe(false);
    });

    it('sets lastRenderedAt timestamp', () => {
      const pages = createVirtualPages(3);
      const rendered = markPagesRendered(pages, [1]);
      expect(rendered[0].lastRenderedAt).toBeDefined();
    });
  });

  describe('evictDistantPages', () => {
    it('evicts pages when count exceeds maxCached', () => {
      let pages = createVirtualPages(30);
      pages = markPagesRendered(
        pages,
        Array.from({ length: 30 }, (_, i) => i + 1),
      );
      const { pages: evicted, evicted: evictedList } = evictDistantPages(
        pages,
        15,
        MAX_CACHED_PAGES,
      );
      expect(countRenderedPages(evicted)).toBe(MAX_CACHED_PAGES);
      expect(evictedList.length).toBe(30 - MAX_CACHED_PAGES);
    });

    it('does not evict when under threshold', () => {
      let pages = createVirtualPages(10);
      pages = markPagesRendered(pages, [1, 2, 3]);
      const { evicted } = evictDistantPages(pages, 2, MAX_CACHED_PAGES);
      expect(evicted).toHaveLength(0);
    });

    it('evicts correct number of pages to reach maxCached', () => {
      let pages = createVirtualPages(10);
      pages = markPagesRendered(pages, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      const { pages: result, evicted } = evictDistantPages(pages, 5, 5);
      expect(evicted).toHaveLength(5);
      expect(countRenderedPages(result)).toBe(5);
    });
  });

  describe('countRenderedPages', () => {
    it('counts rendered pages', () => {
      let pages = createVirtualPages(10);
      expect(countRenderedPages(pages)).toBe(0);
      pages = markPagesRendered(pages, [1, 5, 10]);
      expect(countRenderedPages(pages)).toBe(3);
    });
  });

  /* ═══════ Performance metrics ═══════ */
  describe('performance metrics', () => {
    it('creates initial metrics', () => {
      const m = createPerformanceMetrics(20);
      expect(m.totalPages).toBe(20);
      expect(m.renderTime).toBe(0);
      expect(m.memoryUsage).toBe(0);
    });

    it('updates metrics immutably', () => {
      const m = createPerformanceMetrics(20);
      const updated = updateMetrics(m, { renderTime: 150, pagesCached: 5 });
      expect(updated.renderTime).toBe(150);
      expect(updated.pagesCached).toBe(5);
      expect(m.renderTime).toBe(0); // Original unchanged
    });

    it('detects memory warnings', () => {
      expect(isMemoryWarning(MEMORY_WARNING_MB + 1)).toBe(true);
      expect(isMemoryWarning(MEMORY_WARNING_MB - 1)).toBe(false);
    });

    it('estimates memory usage', () => {
      const mb = estimateMemoryUsage(10, 200); // 10 pages * 200KB
      expect(mb).toBe(Math.round((10 * 200) / 1024));
    });
  });

  /* ═══════ Keyboard shortcuts ═══════ */
  describe('keyboard shortcuts', () => {
    it('returns all shortcuts', () => {
      const shortcuts = getAllShortcuts();
      expect(shortcuts.length).toBeGreaterThan(0);
      for (const s of shortcuts) {
        expect(s.key).toBeTruthy();
        expect(s.action).toBeTruthy();
        expect(s.label).toBeTruthy();
        expect(s.category).toBeTruthy();
      }
    });

    it('groups by category', () => {
      const groups = getShortcutsByCategory();
      const categories = Object.keys(groups);
      expect(categories.length).toBeGreaterThan(0);
      for (const cat of categories) {
        expect(groups[cat].length).toBeGreaterThan(0);
      }
    });

    it('matches a shortcut from keyboard event', () => {
      const shortcuts = getAllShortcuts();
      // Find one with ctrlKey to test
      const withCtrl = shortcuts.find((s) => s.ctrlKey);
      if (withCtrl) {
        const result = matchShortcut({
          key: withCtrl.key,
          ctrlKey: true,
          shiftKey: !!withCtrl.shiftKey,
          altKey: false,
        });
        expect(result).toBe(withCtrl.action);
      }
    });

    it('returns null for unmatched key combo', () => {
      expect(
        matchShortcut({
          key: 'F99',
          ctrlKey: true,
          shiftKey: true,
          altKey: true,
        }),
      ).toBeNull();
    });

    it('formats shortcut for display', () => {
      const formatted = formatShortcut({
        key: 's',
        ctrlKey: true,
        shiftKey: false,
        altKey: undefined,
        action: 'save',
        label: 'Save',
        category: 'file',
      });
      expect(formatted).toBe('Ctrl+S');
    });

    it('formats shortcut with shift', () => {
      const formatted = formatShortcut({
        key: 'z',
        ctrlKey: true,
        shiftKey: true,
        altKey: undefined,
        action: 'redo',
        label: 'Redo',
        category: 'edit',
      });
      expect(formatted).toBe('Ctrl+Shift+Z');
    });

    it('formats special keys', () => {
      const formatted = formatShortcut({
        key: 'Delete',
        ctrlKey: false,
        shiftKey: false,
        altKey: undefined,
        action: 'delete',
        label: 'Delete',
        category: 'edit',
      });
      expect(formatted).toBe('Del');
    });
  });

  /* ═══════ Onboarding tour ═══════ */
  describe('onboarding', () => {
    it('returns onboarding steps', () => {
      const steps = getOnboardingSteps();
      expect(steps.length).toBeGreaterThan(0);
      expect(steps.every((s) => !s.completed)).toBe(true);
    });

    it('completes a step', () => {
      const steps = getOnboardingSteps();
      const updated = completeOnboardingStep(steps, steps[0].id);
      expect(updated[0].completed).toBe(true);
    });

    it('gets next incomplete step', () => {
      const steps = getOnboardingSteps();
      const next = getNextStep(steps);
      expect(next).not.toBeNull();
      expect(next?.id).toBe(steps[0].id);

      const completed = completeOnboardingStep(steps, steps[0].id);
      const nextAfter = getNextStep(completed);
      expect(nextAfter?.id).toBe(steps[1].id);
    });

    it('detects completion', () => {
      let steps = getOnboardingSteps();
      expect(isOnboardingComplete(steps)).toBe(false);
      for (const s of steps) {
        steps = completeOnboardingStep(steps, s.id);
      }
      expect(isOnboardingComplete(steps)).toBe(true);
    });

    it('tracks progress', () => {
      const steps = getOnboardingSteps();
      expect(getOnboardingProgress(steps)).toBe(0);
      const half = steps.slice(0, Math.ceil(steps.length / 2));
      let current = steps;
      for (const s of half) {
        current = completeOnboardingStep(current, s.id);
      }
      const progress = getOnboardingProgress(current);
      expect(progress).toBeGreaterThan(0);
      expect(progress).toBeLessThanOrEqual(100);
    });
  });

  /* ═══════ Error recovery ═══════ */
  describe('classifyError', () => {
    it('classifies encrypted errors', () => {
      const info = classifyError(new Error('This PDF is password protected'));
      expect(info.type).toBe('encrypted');
      expect(info.recoverable).toBe(true);
    });

    it('classifies oversized files', () => {
      const info = classifyError(
        new Error('file too big'),
        MAX_FILE_SIZE_MB + 10,
      );
      expect(info.type).toBe('oversized');
      expect(info.recoverable).toBe(false);
    });

    it('classifies network errors', () => {
      const info = classifyError('Network fetch failed');
      expect(info.type).toBe('network');
      expect(info.recoverable).toBe(true);
    });

    it('classifies corrupted files', () => {
      const info = classifyError(new Error('Invalid PDF structure'));
      expect(info.type).toBe('corrupted');
      expect(info.recoverable).toBe(false);
    });

    it('classifies unsupported versions', () => {
      const info = classifyError(new Error('Unsupported PDF version'));
      expect(info.type).toBe('unsupported');
      expect(info.recoverable).toBe(false);
    });

    it('falls back for unknown errors', () => {
      const info = classifyError(new Error('Something random happened'));
      expect(info.type).toBe('corrupted');
      expect(info.suggestion).toBeTruthy();
    });
  });

  describe('isFileSizeAcceptable', () => {
    it('accepts files under limit', () => {
      expect(isFileSizeAcceptable(50)).toBe(true);
    });

    it('rejects files over limit', () => {
      expect(isFileSizeAcceptable(MAX_FILE_SIZE_MB + 1)).toBe(false);
    });

    it('accepts files at exact limit', () => {
      expect(isFileSizeAcceptable(MAX_FILE_SIZE_MB)).toBe(true);
    });
  });

  describe('formatFileSize', () => {
    it('formats bytes', () => {
      expect(formatFileSize(500)).toBe('500 B');
    });

    it('formats kilobytes', () => {
      expect(formatFileSize(2048)).toBe('2.0 KB');
    });

    it('formats megabytes', () => {
      expect(formatFileSize(5 * 1024 * 1024)).toBe('5.0 MB');
    });
  });
});
