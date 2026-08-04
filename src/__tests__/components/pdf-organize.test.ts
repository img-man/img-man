// SPDX-License-Identifier: Apache-2.0
/**
 * Tests — PDF Organize
 * Tests for pdf-organize-client.tsx component
 */
import { describe, it, expect } from 'vitest';

describe('PDF Organize Client', () => {
  it('module exports a default component', async () => {
    const mod = await import('@/app/dashboard/tools/pdf-organize-client');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });

  it('component has the correct name', async () => {
    const mod = await import('@/app/dashboard/tools/pdf-organize-client');
    expect(mod.default.name).toMatch(/^Pdf/);
  });
});
