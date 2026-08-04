// SPDX-License-Identifier: Apache-2.0
/**
 * Tests — OCR Scanner
 * Tests for pdf-ocr-client.tsx component
 */
import { describe, it, expect } from 'vitest';

describe('PDF OCR Client', () => {
  it('module exports a default component', async () => {
    const mod = await import('@/app/dashboard/tools/pdf-ocr-client');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });

  it('component name is PdfOcrModal', async () => {
    const mod = await import('@/app/dashboard/tools/pdf-ocr-client');
    expect(mod.default.name).toBe('PdfOcrModal');
  });
});
