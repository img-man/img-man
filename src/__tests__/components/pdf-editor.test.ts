// SPDX-License-Identifier: Apache-2.0
/**
 * Tests — PDF Editor
 * Tests for pdf-editor-client.tsx component
 */
import { describe, it, expect } from 'vitest';

describe('PDF Editor Client', () => {
  it('module exports a default component', async () => {
    const mod = await import('@/app/dashboard/tools/pdf-editor-client');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });

  it('component name is PdfEditorModal', async () => {
    const mod = await import('@/app/dashboard/tools/pdf-editor-client');
    expect(mod.default.name).toBe('PdfEditorModal');
  });
});
