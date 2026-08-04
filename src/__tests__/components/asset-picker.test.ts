// SPDX-License-Identifier: Apache-2.0
/**
 * Asset Picker Component Tests
 * Tests for the shared AssetPicker component structure
 */
import { describe, it, expect } from 'vitest';

describe('AssetPicker component', () => {
  it('exports a default component', async () => {
    const mod = await import('@/components/dashboard/asset-picker');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });

  it('component is named AssetPicker', async () => {
    const mod = await import('@/components/dashboard/asset-picker');
    expect(mod.default.name).toBe('AssetPicker');
  });
});
