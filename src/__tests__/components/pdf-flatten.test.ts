// SPDX-License-Identifier: Apache-2.0
/**
 * Tests — PDF Flatten
 * Tests for pdf-flatten-client.tsx component
 */
import { describe, it, expect } from 'vitest';

describe('PDF Flatten Client', () => {
  it('module exports a default component', async () => {
    const mod = await import('@/app/dashboard/tools/pdf-flatten-client');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });

  it('component name is PdfFlattenModal', async () => {
    const mod = await import('@/app/dashboard/tools/pdf-flatten-client');
    expect(mod.default.name).toBe('PdfFlattenModal');
  });
});
