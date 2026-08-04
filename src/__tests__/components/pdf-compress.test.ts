// SPDX-License-Identifier: Apache-2.0
/**
 * Tests — PDF Compress
 * Tests for pdf-compress-client.tsx component
 */
import { describe, it, expect } from 'vitest';

describe('PDF Compress Client', () => {
  it('module exports a default component', async () => {
    const mod = await import('@/app/dashboard/tools/pdf-compress-client');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });

  it('component name is PdfCompressModal', async () => {
    const mod = await import('@/app/dashboard/tools/pdf-compress-client');
    expect(mod.default.name).toBe('PdfCompressModal');
  });
});
