// SPDX-License-Identifier: Apache-2.0
/**
 * Tests — PDF Page Numbers
 * Tests for pdf-page-numbers-client.tsx component
 */
import { describe, it, expect } from 'vitest';

describe('PDF Page Numbers Client', () => {
  it('module exports a default component', async () => {
    const mod = await import('@/app/dashboard/tools/pdf-page-numbers-client');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });

  it('component has the correct name', async () => {
    const mod = await import('@/app/dashboard/tools/pdf-page-numbers-client');
    expect(mod.default.name).toMatch(/^Pdf/);
  });
});
