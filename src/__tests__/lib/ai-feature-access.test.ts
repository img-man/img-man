// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import {
  areAiFeaturesEnabled,
  areAllAiFeaturesDisabled,
  isAiFeatureEnabled,
} from '@/lib/ai-feature-access';

describe('ai-feature-access helpers', () => {
  it('treats missing config as enabled by default', () => {
    expect(areAllAiFeaturesDisabled(null)).toBe(false);
    expect(isAiFeatureEnabled(null, 'generate')).toBe(true);
    expect(areAiFeaturesEnabled(null, ['generate'])).toBe(true);
  });

  it('detects when every configured feature is disabled', () => {
    const config = {
      generate: { mode: 'disabled' },
      edit: { mode: 'disabled' },
    };

    expect(areAllAiFeaturesDisabled(config)).toBe(true);
    expect(areAiFeaturesEnabled(config, [])).toBe(false);
  });

  it('checks targeted features independently', () => {
    const config = {
      generate: { mode: 'disabled' },
      edit: { mode: 'enabled' },
      bg_remove: { mode: 'auto' },
    };

    expect(isAiFeatureEnabled(config, 'generate')).toBe(false);
    expect(isAiFeatureEnabled(config, 'edit')).toBe(true);
    expect(areAiFeaturesEnabled(config, ['generate', 'edit'])).toBe(true);
    expect(areAiFeaturesEnabled(config, ['generate'])).toBe(false);
  });
});