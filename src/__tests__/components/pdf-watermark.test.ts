// SPDX-License-Identifier: Apache-2.0
/**
 * Tests — PDF Watermark
 * Tests for pdf-watermark-client.tsx component
 */
import { describe, it, expect } from 'vitest';

describe('PDF Watermark Client', () => {
  it('module exports a default component', async () => {
    const mod = await import('@/app/dashboard/tools/pdf-watermark-client');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });

  it('component name is PdfWatermarkModal', async () => {
    const mod = await import('@/app/dashboard/tools/pdf-watermark-client');
    expect(mod.default.name).toBe('PdfWatermarkModal');
  });
});
