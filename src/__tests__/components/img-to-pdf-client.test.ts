// SPDX-License-Identifier: Apache-2.0
/**
 * DS-7.2 Images to PDF Client Tests
 * Tests for img-to-pdf-client.tsx exports
 */
import { describe, it, expect } from 'vitest';

describe('DS-7.2 Images to PDF Client', () => {
  it('module exports a default component', async () => {
    const mod = await import('@/app/dashboard/tools/img-to-pdf-client');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });

  it('component name is ImgToPdfModal', async () => {
    const mod = await import('@/app/dashboard/tools/img-to-pdf-client');
    expect(mod.default.name).toBe('ImgToPdfModal');
  });
});
