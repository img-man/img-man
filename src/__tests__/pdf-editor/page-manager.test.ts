// SPDX-License-Identifier: Apache-2.0
/**
 * Tests for page-manager.ts
 *
 * Since page-manager relies on pdf-lib, we test the functions
 * with minimal real PDF bytes. pdf-lib can create PDFs in-memory.
 */

import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import {
  reorderPage,
  deletePage,
  insertBlankPage,
  duplicatePage,
  rotatePage,
  rotateAllPages,
  extractPages,
} from '@/app/dashboard/tools/pdf-editor/engine/page-manager';

/* ──────────────── Helpers ──────────────── */

async function createTestPdf(pageCount: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pageCount; i++) {
    doc.addPage([612, 792]);
  }
  return doc.save();
}

async function getPageCount(bytes: Uint8Array): Promise<number> {
  const doc = await PDFDocument.load(bytes);
  return doc.getPageCount();
}

/* ──────────────── reorderPage ──────────────── */

describe('reorderPage', () => {
  it('should move page from one position to another', async () => {
    const bytes = await createTestPdf(3);
    const result = await reorderPage(bytes, 0, 2);
    expect(result.pageMetadata).toHaveLength(3);
    const count = await getPageCount(result.bytes);
    expect(count).toBe(3);
  });

  it('should return same count when same position', async () => {
    const bytes = await createTestPdf(3);
    const result = await reorderPage(bytes, 1, 1);
    expect(result.pageMetadata).toHaveLength(3);
  });
});

/* ──────────────── deletePage ──────────────── */

describe('deletePage', () => {
  it('should delete a page (1-based)', async () => {
    const bytes = await createTestPdf(3);
    const result = await deletePage(bytes, 2);
    expect(result.pageMetadata).toHaveLength(2);
    const count = await getPageCount(result.bytes);
    expect(count).toBe(2);
  });

  it('should throw when trying to delete the only page', async () => {
    const bytes = await createTestPdf(1);
    await expect(deletePage(bytes, 1)).rejects.toThrow();
  });

  it('should throw for invalid page number', async () => {
    const bytes = await createTestPdf(3);
    await expect(deletePage(bytes, 0)).rejects.toThrow();
    await expect(deletePage(bytes, 5)).rejects.toThrow();
  });
});

/* ──────────────── insertBlankPage ──────────────── */

describe('insertBlankPage', () => {
  it('should insert a blank page after specified position', async () => {
    const bytes = await createTestPdf(2);
    const result = await insertBlankPage(bytes, 1, 'a4');
    expect(result.pageMetadata).toHaveLength(3);
    const count = await getPageCount(result.bytes);
    expect(count).toBe(3);
  });

  it('should insert at beginning when afterPage=0', async () => {
    const bytes = await createTestPdf(2);
    const result = await insertBlankPage(bytes, 0, 'letter');
    expect(result.pageMetadata).toHaveLength(3);
  });

  it('should insert at end when afterPage equals total', async () => {
    const bytes = await createTestPdf(2);
    const result = await insertBlankPage(bytes, 2, 'a4');
    expect(result.pageMetadata).toHaveLength(3);
  });
});

/* ──────────────── duplicatePage ──────────────── */

describe('duplicatePage', () => {
  it('should duplicate a page', async () => {
    const bytes = await createTestPdf(2);
    const result = await duplicatePage(bytes, 1);
    expect(result.pageMetadata).toHaveLength(3);
    const count = await getPageCount(result.bytes);
    expect(count).toBe(3);
  });

  it('should preserve page dimensions in duplicate', async () => {
    const bytes = await createTestPdf(1);
    const result = await duplicatePage(bytes, 1);
    expect(result.pageMetadata[0].width).toBe(result.pageMetadata[1].width);
    expect(result.pageMetadata[0].height).toBe(result.pageMetadata[1].height);
  });
});

/* ──────────────── rotatePage ──────────────── */

describe('rotatePage', () => {
  it('should rotate a specific page by 90 degrees', async () => {
    const bytes = await createTestPdf(2);
    const result = await rotatePage(bytes, 1, 90);
    expect(result.pageMetadata).toHaveLength(2);
  });

  it('should rotate by 180 degrees', async () => {
    const bytes = await createTestPdf(1);
    const result = await rotatePage(bytes, 1, 180);
    expect(result.pageMetadata).toHaveLength(1);
  });

  it('should throw for invalid page', async () => {
    const bytes = await createTestPdf(1);
    await expect(rotatePage(bytes, 0, 90)).rejects.toThrow();
  });
});

/* ──────────────── rotateAllPages ──────────────── */

describe('rotateAllPages', () => {
  it('should rotate all pages', async () => {
    const bytes = await createTestPdf(3);
    const result = await rotateAllPages(bytes, 90);
    expect(result.pageMetadata).toHaveLength(3);
  });
});

/* ──────────────── extractPages ──────────────── */

describe('extractPages', () => {
  it('should extract specified pages into a new PDF', async () => {
    const bytes = await createTestPdf(5);
    const result = await extractPages(bytes, [1, 3, 5]);
    const count = await getPageCount(result);
    expect(count).toBe(3);
  });

  it('should extract a single page', async () => {
    const bytes = await createTestPdf(3);
    const result = await extractPages(bytes, [2]);
    const count = await getPageCount(result);
    expect(count).toBe(1);
  });

  it('should throw for empty pages array', async () => {
    const bytes = await createTestPdf(3);
    await expect(extractPages(bytes, [])).rejects.toThrow();
  });
});
