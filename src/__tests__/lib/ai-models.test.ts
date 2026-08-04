// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import {
  getDefaultEditModelForProvider,
  getDefaultModelForProviderCapability,
  getModelsForProviderCapability,
  resolveModelForProviderCapability,
} from '@/lib/ai-models';

describe('AI model registry', () => {
  it('returns provider-scoped generation models', () => {
    expect(getModelsForProviderCapability('vertex', 'generate').map((model) => model.id)).toEqual([
      'gemini-flash',
      'gemini-pro',
      'imagen4-fast',
      'imagen3-edit',
    ]);
    expect(getModelsForProviderCapability('openai', 'generate').map((model) => model.id)).toEqual([
      'gpt-image-1',
    ]);
    expect(getModelsForProviderCapability('openai', 'analyze').map((model) => model.id)).toEqual([
      'gpt-4.1-mini-vision',
    ]);
  });

  it('returns provider-specific defaults', () => {
    expect(getDefaultModelForProviderCapability('vertex', 'edit')?.id).toBe('imagen3-edit');
    expect(getDefaultModelForProviderCapability('openai', 'generate')?.modelId).toBe('gpt-image-1');
    expect(getDefaultModelForProviderCapability('openai', 'analyze')?.modelId).toBe('gpt-4.1-mini');
  });

  it('exposes openai as an edit-capable provider', () => {
    expect(getModelsForProviderCapability('openai', 'edit').map((model) => model.id)).toEqual([
      'gpt-image-1',
    ]);
    expect(getDefaultModelForProviderCapability('openai', 'edit')?.modelId).toBe('gpt-image-1');
    expect(getDefaultEditModelForProvider('openai').id).toBe('gpt-image-1');
    expect(getDefaultEditModelForProvider('vertex').id).toBe('imagen3-edit');
  });

  it('falls back when a model belongs to a different provider or capability', () => {
    expect(
      resolveModelForProviderCapability('openai', 'generate', 'gemini-pro')?.id,
    ).toBe('gpt-image-1');
    expect(
      resolveModelForProviderCapability('vertex', 'edit', 'gemini-flash')?.id,
    ).toBe('imagen3-edit');
  });
});