// SPDX-License-Identifier: Apache-2.0
/**
 * Tests for sanitization-engine.ts — Phase 4
 *
 * Covers inspectMetadata, createBlankMetadata, describeSanitizationActions,
 * estimateSanitizationWork, previewSanitization, createDefaultSanitizationOptions,
 * buildSanitizationResult, formatSanitizationSummary
 */

import { describe, it, expect } from 'vitest';
import {
  METADATA_KEYS,
  SENSITIVE_XMP_NAMESPACES,
  inspectMetadata,
  createBlankMetadata,
  describeSanitizationActions,
  estimateSanitizationWork,
  previewSanitization,
  createDefaultSanitizationOptions,
  buildSanitizationResult,
  formatSanitizationSummary,
} from '@/app/dashboard/tools/pdf-editor/engine/sanitization-engine';
import type {
  PdfMetadata,
  SanitizationOptions,
} from '@/app/dashboard/tools/pdf-editor/types';

/* ──────────────── Helper ──────────────── */

function makeMetadata(overrides: Partial<PdfMetadata> = {}): PdfMetadata {
  return {
    title: '',
    author: '',
    subject: '',
    keywords: '',
    creator: '',
    producer: '',
    creationDate: undefined,
    modificationDate: undefined,
    custom: {},
    ...overrides,
  };
}

function allOptions(): SanitizationOptions {
  return {
    stripMetadata: true,
    removeHiddenLayers: true,
    removeJavaScript: true,
    removeAttachments: true,
    removeAnnotations: true,
    flattenTransparency: true,
  };
}

/* ──────────────── Constants ──────────────── */

describe('constants', () => {
  it('has standard metadata keys', () => {
    expect(METADATA_KEYS).toContain('Title');
    expect(METADATA_KEYS).toContain('Author');
    expect(METADATA_KEYS.length).toBe(8);
  });

  it('has sensitive XMP namespaces', () => {
    expect(SENSITIVE_XMP_NAMESPACES.length).toBeGreaterThan(0);
    expect(SENSITIVE_XMP_NAMESPACES[0]).toContain('adobe');
  });
});

/* ──────────────── Inspect Metadata ──────────────── */

describe('inspectMetadata', () => {
  it('returns all false for blank metadata', () => {
    const result = inspectMetadata(makeMetadata());
    expect(result.totalFields).toBe(0);
    expect(result.hasTitle).toBe(false);
    expect(result.hasAuthor).toBe(false);
    expect(result.customCount).toBe(0);
  });

  it('counts fields correctly', () => {
    const result = inspectMetadata(
      makeMetadata({
        title: 'Test',
        author: 'Me',
        keywords: 'a, b',
        custom: { key1: 'val1', key2: 'val2' },
      }),
    );
    expect(result.hasTitle).toBe(true);
    expect(result.hasAuthor).toBe(true);
    expect(result.hasKeywords).toBe(true);
    expect(result.customCount).toBe(2);
    expect(result.totalFields).toBe(5); // title + author + keywords + 2 custom
  });

  it('detects dates', () => {
    const result = inspectMetadata(
      makeMetadata({
        creationDate: new Date(),
        modificationDate: new Date(),
      }),
    );
    expect(result.hasCreationDate).toBe(true);
    expect(result.hasModificationDate).toBe(true);
    expect(result.totalFields).toBe(2);
  });
});

/* ──────────────── Blank Metadata ──────────────── */

describe('createBlankMetadata', () => {
  it('creates metadata with all empty fields', () => {
    const blank = createBlankMetadata();
    expect(blank.title).toBe('');
    expect(blank.author).toBe('');
    expect(blank.creationDate).toBeUndefined();
    expect(Object.keys(blank.custom)).toHaveLength(0);
  });
});

/* ──────────────── Describe Actions ──────────────── */

describe('describeSanitizationActions', () => {
  it('returns empty array when all options disabled', () => {
    const opts: SanitizationOptions = {
      stripMetadata: false,
      removeHiddenLayers: false,
      removeJavaScript: false,
      removeAttachments: false,
      removeAnnotations: false,
      flattenTransparency: false,
    };
    expect(describeSanitizationActions(opts)).toHaveLength(0);
  });

  it('returns one action per enabled option', () => {
    const actions = describeSanitizationActions(allOptions());
    expect(actions).toHaveLength(6);
  });

  it('includes metadata action when enabled', () => {
    const opts = createDefaultSanitizationOptions();
    const actions = describeSanitizationActions(opts);
    if (opts.stripMetadata) {
      expect(actions.some((a) => a.toLowerCase().includes('metadata'))).toBe(
        true,
      );
    }
  });
});

/* ──────────────── Estimate Work ──────────────── */

describe('estimateSanitizationWork', () => {
  it('returns 0 when nothing enabled', () => {
    const opts: SanitizationOptions = {
      stripMetadata: false,
      removeHiddenLayers: false,
      removeJavaScript: false,
      removeAttachments: false,
      removeAnnotations: false,
      flattenTransparency: false,
    };
    expect(estimateSanitizationWork(opts, makeMetadata(), 0)).toBe(0);
  });

  it('counts metadata fields when stripMetadata enabled', () => {
    const meta = makeMetadata({ title: 'T', author: 'A' });
    const opts: SanitizationOptions = {
      stripMetadata: true,
      removeHiddenLayers: false,
      removeJavaScript: false,
      removeAttachments: false,
      removeAnnotations: false,
      flattenTransparency: false,
    };
    expect(estimateSanitizationWork(opts, meta, 0)).toBe(2);
  });

  it('counts annotations when removeAnnotations enabled', () => {
    const opts: SanitizationOptions = {
      stripMetadata: false,
      removeHiddenLayers: false,
      removeJavaScript: false,
      removeAttachments: false,
      removeAnnotations: true,
      flattenTransparency: false,
    };
    expect(estimateSanitizationWork(opts, makeMetadata(), 15)).toBe(15);
  });
});

/* ──────────────── Preview ──────────────── */

describe('previewSanitization', () => {
  it('returns empty preview when nothing to sanitize', () => {
    const result = previewSanitization(
      allOptions(),
      makeMetadata(),
      0,
      false,
      0,
      0,
    );
    // Only transparency should be present (count=1, always shown when enabled)
    expect(result.some((r) => r.category === 'Metadata')).toBe(false);
    expect(result.some((r) => r.category === 'Transparency')).toBe(true);
  });

  it('includes metadata when fields exist', () => {
    const meta = makeMetadata({ title: 'Doc', author: 'Me' });
    const result = previewSanitization(allOptions(), meta, 0, false, 0, 0);
    const metaItem = result.find((r) => r.category === 'Metadata');
    expect(metaItem).toBeDefined();
    expect(metaItem!.count).toBe(2);
  });

  it('includes all categories when all data present', () => {
    const meta = makeMetadata({ title: 'T' });
    const result = previewSanitization(allOptions(), meta, 5, true, 3, 2);
    expect(result.some((r) => r.category === 'Metadata')).toBe(true);
    expect(result.some((r) => r.category === 'Hidden Layers')).toBe(true);
    expect(result.some((r) => r.category === 'JavaScript')).toBe(true);
    expect(result.some((r) => r.category === 'Attachments')).toBe(true);
    expect(result.some((r) => r.category === 'Annotations')).toBe(true);
    expect(result.some((r) => r.category === 'Transparency')).toBe(true);
  });
});

/* ──────────────── Build Result ──────────────── */

describe('buildSanitizationResult', () => {
  it('creates a successful result', () => {
    const result = buildSanitizationResult(['metadata', 'js'], 10000, 8000);
    expect(result.success).toBe(true);
    expect(result.removedItems).toEqual(['metadata', 'js']);
    expect(result.originalSize).toBe(10000);
    expect(result.sanitizedSize).toBe(8000);
  });
});

/* ──────────────── Format Summary ──────────────── */

describe('formatSanitizationSummary', () => {
  it('includes size reduction info', () => {
    const result = buildSanitizationResult(['a', 'b', 'c'], 100000, 80000);
    const summary = formatSanitizationSummary(result);
    expect(summary).toContain('completed');
    expect(summary).toContain('3');
    expect(summary).toContain('20%');
  });

  it('handles zero original size', () => {
    const result = buildSanitizationResult([], 0, 0);
    const summary = formatSanitizationSummary(result);
    expect(summary).toContain('0%');
  });
});

/* ──────────────── Defaults ──────────────── */

describe('createDefaultSanitizationOptions', () => {
  it('returns a valid options object', () => {
    const opts = createDefaultSanitizationOptions();
    expect(typeof opts.stripMetadata).toBe('boolean');
    expect(typeof opts.removeHiddenLayers).toBe('boolean');
    expect(typeof opts.removeJavaScript).toBe('boolean');
    expect(typeof opts.removeAttachments).toBe('boolean');
    expect(typeof opts.removeAnnotations).toBe('boolean');
    expect(typeof opts.flattenTransparency).toBe('boolean');
  });
});
