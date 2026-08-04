// SPDX-License-Identifier: Apache-2.0
/**
 * Tests — PDF Password Protect
 * Tests for pdf-protect-client.tsx component
 */
import { describe, it, expect } from 'vitest';

describe('PDF Protect Client', () => {
  it('module exports a default component', async () => {
    const mod = await import('@/app/dashboard/tools/pdf-protect-client');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });

  it('component name is PdfProtectModal', async () => {
    const mod = await import('@/app/dashboard/tools/pdf-protect-client');
    expect(mod.default.name).toBe('PdfProtectModal');
  });
});
