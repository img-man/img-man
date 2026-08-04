// SPDX-License-Identifier: Apache-2.0
/**
 * Tests — PDF Page Extract
 * Tests for pdf-page-extract-client.tsx component
 */
import { describe, it, expect } from 'vitest';

describe('PDF Page Extract Client', () => {
  it('module exports a default component', async () => {
    const mod = await import('@/app/dashboard/tools/pdf-page-extract-client');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });

  it('component name is PdfPageExtractModal', async () => {
    const mod = await import('@/app/dashboard/tools/pdf-page-extract-client');
    expect(mod.default.name).toBe('PdfPageExtractModal');
  });
});
