// SPDX-License-Identifier: Apache-2.0
/**
 * Tests — PDF Unlock
 * Tests for pdf-unlock-client.tsx component
 */
import { describe, it, expect } from 'vitest';

describe('PDF Unlock Client', () => {
  it('module exports a default component', async () => {
    const mod = await import('@/app/dashboard/tools/pdf-unlock-client');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });

  it('component has the correct name', async () => {
    const mod = await import('@/app/dashboard/tools/pdf-unlock-client');
    expect(mod.default.name).toMatch(/^Pdf/);
  });
});
