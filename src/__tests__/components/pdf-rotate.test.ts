// SPDX-License-Identifier: Apache-2.0
/**
 * Tests — PDF Rotate
 * Tests for pdf-rotate-client.tsx component
 */
import { describe, it, expect } from 'vitest';

describe('PDF Rotate Client', () => {
  it('module exports a default component', async () => {
    const mod = await import('@/app/dashboard/tools/pdf-rotate-client');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });

  it('component name is PdfRotateModal', async () => {
    const mod = await import('@/app/dashboard/tools/pdf-rotate-client');
    expect(mod.default.name).toBe('PdfRotateModal');
  });
});
