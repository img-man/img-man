// SPDX-License-Identifier: Apache-2.0
/**
 * Tests — PDF Split
 * Tests for pdf-split-client.tsx component
 */
import { describe, it, expect } from 'vitest';

describe('PDF Split Client', () => {
  it('module exports a default component', async () => {
    const mod = await import('@/app/dashboard/tools/pdf-split-client');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });

  it('component name is PdfSplitModal', async () => {
    const mod = await import('@/app/dashboard/tools/pdf-split-client');
    expect(mod.default.name).toBe('PdfSplitModal');
  });
});
