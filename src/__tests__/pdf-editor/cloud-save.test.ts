// SPDX-License-Identifier: Apache-2.0
/**
 * Tests for cloud-save.ts — Phase 3
 *
 * Covers serializeAnnotations, deserializeAnnotations, buildSavePayload,
 * restoreFromPayload, pruneVersions, recentFiles localStorage, base64 utils,
 * storage paths, countAnnotations
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  serializeAnnotations,
  deserializeAnnotations,
  buildSavePayload,
  restoreFromPayload,
  getPdfStoragePath,
  getAnnotationsStoragePath,
  getVersionStoragePath,
  getVersionAnnotationsPath,
  createVersionRecord,
  pruneVersions,
  addToRecentFiles,
  getRecentFiles,
  removeFromRecentFiles,
  clearRecentFiles,
  uint8ArrayToBase64,
  base64ToUint8Array,
  countAnnotations,
} from '@/app/dashboard/tools/pdf-editor/engine/cloud-save';
import type {
  Annotation,
  TextAnnotation,
  PdfVersion,
  PageMeta,
} from '@/app/dashboard/tools/pdf-editor/types';

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

/* ──────────────── Helper ──────────────── */

function makeAnn(id: string, page: number): TextAnnotation {
  return {
    id,
    kind: 'text',
    page,
    x: 100,
    y: 100,
    width: 200,
    height: 30,
    rotation: 0,
    opacity: 1,
    locked: false,
    visible: true,
    text: 'Test',
    fontSize: 12,
    fontFamily: 'Arial',
    fontWeight: 'normal',
    fontStyle: 'normal',
    textDecoration: 'none',
    textAlign: 'left',
    color: '#000000',
    backgroundColor: 'transparent',
    lineHeight: 1.5,
  };
}

/* ──────────────────────── Serialize / Deserialize ──────────────────────── */

describe('serializeAnnotations & deserializeAnnotations', () => {
  it('should roundtrip annotations through Record', () => {
    const map = new Map<number, Annotation[]>();
    map.set(1, [makeAnn('a', 1), makeAnn('b', 1)]);
    map.set(2, [makeAnn('c', 2)]);

    const record = serializeAnnotations(map);
    expect(typeof record).toBe('object');

    const restored = deserializeAnnotations(record);
    expect(restored.get(1)?.length).toBe(2);
    expect(restored.get(2)?.length).toBe(1);
    expect(restored.get(1)?.[0].id).toBe('a');
  });

  it('should handle empty map', () => {
    const record = serializeAnnotations(new Map());
    const restored = deserializeAnnotations(record);
    expect(restored.size).toBe(0);
  });
});

/* ──────────────────────── Build / Restore Payload ──────────────────────── */

describe('buildSavePayload & restoreFromPayload', () => {
  it('should roundtrip a full save payload', () => {
    const map = new Map<number, Annotation[]>();
    map.set(1, [makeAnn('a', 1)]);

    const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // %PDF
    const pageMetadata: PageMeta[] = [
      { width: 612, height: 792, rotation: 0, index: 0 },
    ];

    const payload = buildSavePayload(pdfBytes, map, pageMetadata, 'test.pdf');
    expect(payload.fileName).toBe('test.pdf');
    expect(payload.pdfBase64.length).toBeGreaterThan(0);
    expect(Object.keys(payload.annotations).length).toBeGreaterThan(0);

    const restored = restoreFromPayload(payload);
    expect(restored.pdfBytes).toBeInstanceOf(Uint8Array);
    expect(restored.pdfBytes.length).toBe(4);
    expect(restored.annotations.get(1)?.length).toBe(1);
    expect(restored.pageMetadata.length).toBe(1);
  });
});

/* ──────────────────────── Storage Paths ──────────────────────── */

describe('storage paths', () => {
  it('should generate correct PDF storage path', () => {
    const path = getPdfStoragePath('org123', 'doc456');
    expect(path).toContain('org123');
    expect(path).toContain('doc456');
    expect(path).toContain('.pdf');
  });

  it('should generate correct annotations path', () => {
    const path = getAnnotationsStoragePath('org123', 'doc456');
    expect(path).toContain('org123');
    expect(path).toContain('doc456');
  });

  it('should generate version storage path', () => {
    const path = getVersionStoragePath('org123', 'doc456', 'v1');
    expect(path).toContain('v1');
  });

  it('should generate version annotations path', () => {
    const path = getVersionAnnotationsPath('org123', 'doc456', 'v1');
    expect(path).toContain('v1');
  });
});

/* ──────────────────────── Version Management ──────────────────────── */

describe('createVersionRecord', () => {
  it('should create a version record with correct fields', () => {
    const version = createVersionRecord(
      'doc1',
      'org1',
      'First save',
      1024,
      5,
      false,
    );
    expect(version.id).toMatch(/^v-/);
    expect(version.name).toBe('First save');
    expect(version.fileSize).toBe(1024);
    expect(version.annotationCount).toBe(5);
    expect(version.isAutoSave).toBe(false);
    expect(version.createdAt).toBeInstanceOf(Date);
  });
});

describe('pruneVersions', () => {
  it('should keep versions under the limit', () => {
    const versions: PdfVersion[] = Array.from({ length: 5 }, (_, i) =>
      createVersionRecord('doc1', 'org1', `Version ${i}`, 100, 0, false),
    );
    const { keep, prune } = pruneVersions(versions);
    expect(keep.length).toBe(5);
    expect(prune.length).toBe(0);
  });

  it('should prune auto-saves first when over limit', () => {
    const versions: PdfVersion[] = [];
    // Create 51 versions (over MAX_VERSIONS of 50)
    for (let i = 0; i < 51; i++) {
      versions.push(
        createVersionRecord('doc1', 'org1', `V${i}`, 100, 0, i % 2 === 0),
      );
    }
    const { keep, prune } = pruneVersions(versions);
    expect(keep.length).toBeLessThanOrEqual(50);
    expect(prune.length).toBeGreaterThan(0);
  });
});

/* ──────────────────────── Recent Files (localStorage) ──────────────────────── */

describe('recentFiles', () => {
  it('should add and retrieve recent files', () => {
    addToRecentFiles({
      id: 'doc1',
      name: 'My Document.pdf',
      lastOpenedAt: new Date(),
      thumbnailUrl: 'https://example.com/thumb.png',
    });
    const files = getRecentFiles();
    expect(files.length).toBe(1);
    expect(files[0].name).toBe('My Document.pdf');
  });

  it('should remove a recent file', () => {
    addToRecentFiles({
      id: 'doc1',
      name: 'Doc 1',
      lastOpenedAt: new Date(),
    });
    addToRecentFiles({
      id: 'doc2',
      name: 'Doc 2',
      lastOpenedAt: new Date(),
    });
    removeFromRecentFiles('doc1');
    const files = getRecentFiles();
    expect(files.length).toBe(1);
    expect(files[0].id).toBe('doc2');
  });

  it('should clear all recent files', () => {
    addToRecentFiles({
      id: 'doc1',
      name: 'Doc 1',
      lastOpenedAt: new Date(),
    });
    clearRecentFiles();
    expect(getRecentFiles().length).toBe(0);
  });
});

/* ──────────────────────── Base64 Utils ──────────────────────── */

describe('uint8ArrayToBase64 & base64ToUint8Array', () => {
  it('should roundtrip binary data', () => {
    const original = new Uint8Array([0, 1, 2, 255, 128, 64]);
    const base64 = uint8ArrayToBase64(original);
    expect(typeof base64).toBe('string');

    const restored = base64ToUint8Array(base64);
    expect(restored).toBeInstanceOf(Uint8Array);
    expect(restored.length).toBe(original.length);
    for (let i = 0; i < original.length; i++) {
      expect(restored[i]).toBe(original[i]);
    }
  });

  it('should handle empty array', () => {
    const base64 = uint8ArrayToBase64(new Uint8Array([]));
    const restored = base64ToUint8Array(base64);
    expect(restored.length).toBe(0);
  });
});

/* ──────────────────────── countAnnotations ──────────────────────── */

describe('countAnnotations', () => {
  it('should count across all pages', () => {
    const map = new Map<number, Annotation[]>();
    map.set(1, [makeAnn('a', 1), makeAnn('b', 1)]);
    map.set(2, [makeAnn('c', 2)]);
    expect(countAnnotations(map)).toBe(3);
  });

  it('should return 0 for empty map', () => {
    expect(countAnnotations(new Map())).toBe(0);
  });
});
