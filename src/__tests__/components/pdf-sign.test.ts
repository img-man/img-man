// SPDX-License-Identifier: Apache-2.0
/**
 * Tests — PDF Sign
 * Tests for pdf-sign-client.tsx component
 */
import { describe, it, expect } from 'vitest';

describe('PDF Sign Client', () => {
  it('module exports a default component', async () => {
    const mod = await import('@/app/dashboard/tools/pdf-sign-client');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });

  it('component has the correct name', async () => {
    const mod = await import('@/app/dashboard/tools/pdf-sign-client');
    expect(mod.default.name).toMatch(/^Pdf/);
  });
});
