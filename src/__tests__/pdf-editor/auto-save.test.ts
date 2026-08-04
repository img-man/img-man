// SPDX-License-Identifier: Apache-2.0
/**
 * Tests for auto-save.ts
 *
 * Covers computeFileHash, saveDraft, loadDraft, deleteDraft, hasDraft, listDrafts, clearAllDrafts
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Annotation } from '@/app/dashboard/tools/pdf-editor/types';
import {
  computeFileHash,
  saveDraft,
  loadDraft,
  deleteDraft,
  hasDraft,
  listDrafts,
  clearAllDrafts,
} from '@/app/dashboard/tools/pdf-editor/engine/auto-save';
import { AUTO_SAVE_STORAGE_KEY } from '@/app/dashboard/tools/pdf-editor/constants';

/* ──────────────── Mock localStorage ──────────────── */

const store: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    store[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete store[key];
  }),
  clear: vi.fn(() => {
    for (const key of Object.keys(store)) {
      delete store[key];
    }
  }),
  get length() {
    return Object.keys(store).length;
  },
  key: vi.fn((i: number) => Object.keys(store)[i] ?? null),
};

beforeEach(() => {
  for (const key of Object.keys(store)) {
    delete store[key];
  }
  vi.stubGlobal('localStorage', localStorageMock);
});

/* ──────────────── computeFileHash ──────────────── */

describe('computeFileHash', () => {
  it('should return consistent hash for same bytes', () => {
    const bytes = new Uint8Array([1, 2, 3, 4, 5]);
    const hash1 = computeFileHash(bytes);
    const hash2 = computeFileHash(bytes);
    expect(hash1).toBe(hash2);
  });

  it('should return different hashes for different bytes', () => {
    const bytes1 = new Uint8Array([1, 2, 3, 4, 5]);
    const bytes2 = new Uint8Array([5, 4, 3, 2, 1]);
    expect(computeFileHash(bytes1)).not.toBe(computeFileHash(bytes2));
  });

  it('should return a hex string', () => {
    const bytes = new Uint8Array([10, 20, 30]);
    const hash = computeFileHash(bytes);
    expect(hash).toMatch(/^[0-9a-f]+$/);
  });

  it('should handle empty bytes', () => {
    const bytes = new Uint8Array(0);
    const hash = computeFileHash(bytes);
    expect(hash).toBeTruthy();
  });
});

/* ──────────────── saveDraft / loadDraft ──────────────── */

describe('saveDraft and loadDraft', () => {
  it('should save and load a draft', () => {
    const annotations = new Map<number, Annotation[]>();
    annotations.set(1, [
      {
        id: 'ann1',
        kind: 'highlight',
        page: 1,
        x: 10,
        y: 20,
        width: 100,
        height: 30,
        color: '#FF0',
        opacity: 0.5,
      },
    ]);

    saveDraft('hash123', 'test.pdf', 50000, 3, annotations, [], 2, 1.5);

    expect(hasDraft('hash123')).toBe(true);
    const draft = loadDraft('hash123');
    expect(draft).not.toBeNull();
    expect(draft!.currentPage).toBe(2);
    expect(draft!.zoom).toBe(1.5);
    expect(draft!.annotations).toBeInstanceOf(Map);
    expect(draft!.annotations.get(1)).toHaveLength(1);
  });

  it('should return null for missing draft', () => {
    expect(loadDraft('nonexistent')).toBeNull();
  });

  it('should overwrite existing draft with same hash', () => {
    const anns1 = new Map<number, Annotation[]>();
    anns1.set(1, [
      {
        id: 'a',
        kind: 'text',
        page: 1,
        x: 0,
        y: 0,
        width: 100,
        height: 20,
        content: 'hello',
        fontSize: 12,
        fontFamily: 'Arial',
        color: '#000',
      },
    ]);
    saveDraft('hash1', 'test.pdf', 50000, 1, anns1, [], 1, 1.0);

    const anns2 = new Map<number, Annotation[]>();
    anns2.set(1, [
      {
        id: 'b',
        kind: 'text',
        page: 1,
        x: 0,
        y: 0,
        width: 100,
        height: 20,
        content: 'world',
        fontSize: 12,
        fontFamily: 'Arial',
        color: '#000',
      },
    ]);
    saveDraft('hash1', 'test.pdf', 50000, 1, anns2, [], 3, 2.0);

    const draft = loadDraft('hash1');
    expect(draft!.currentPage).toBe(3);
    expect(draft!.zoom).toBe(2.0);
  });
});

/* ──────────────── deleteDraft ──────────────── */

describe('deleteDraft', () => {
  it('should delete an existing draft', () => {
    saveDraft('hash1', 'test.pdf', 50000, 1, new Map(), [], 1, 1.0);
    expect(hasDraft('hash1')).toBe(true);

    deleteDraft('hash1');
    expect(hasDraft('hash1')).toBe(false);
    expect(loadDraft('hash1')).toBeNull();
  });

  it('should not throw when deleting non-existent draft', () => {
    expect(() => deleteDraft('nope')).not.toThrow();
  });
});

/* ──────────────── listDrafts / clearAllDrafts ──────────────── */

describe('listDrafts and clearAllDrafts', () => {
  it('should list all saved drafts', () => {
    saveDraft('hash1', 'file1.pdf', 50000, 1, new Map(), [], 1, 1.0);
    saveDraft('hash2', 'file2.pdf', 50000, 1, new Map(), [], 1, 1.0);

    const drafts = listDrafts();
    expect(drafts.length).toBeGreaterThanOrEqual(2);
  });

  it('should clear all drafts', () => {
    saveDraft('hash1', 'file1.pdf', 50000, 1, new Map(), [], 1, 1.0);
    saveDraft('hash2', 'file2.pdf', 50000, 1, new Map(), [], 1, 1.0);

    clearAllDrafts();
    expect(hasDraft('hash1')).toBe(false);
    expect(hasDraft('hash2')).toBe(false);
  });
});
