// SPDX-License-Identifier: Apache-2.0
/**
 * DS-7.1 PDF Merge Client Tests
 * Tests for pdf-merge-client.tsx component logic
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// pdf-merge-client is a React component with no exported pure helpers,
// so we test the expected structure and integration points.
describe('DS-7.1 PDF Merge Client', () => {
  it('module exports a default component', async () => {
    const mod = await import('@/app/dashboard/tools/pdf-merge-client');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });

  it('component name is PdfMergeModal', async () => {
    const mod = await import('@/app/dashboard/tools/pdf-merge-client');
    // React components named via function declarations
    expect(mod.default.name).toBe('PdfMergeModal');
  });
});
