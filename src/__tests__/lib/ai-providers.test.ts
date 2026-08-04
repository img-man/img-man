// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import {
  assertAiProviderCapability,
  getAiProviderAdapter,
  getDefaultAiModelForCapability,
  getSupportedAiCapabilities,
  listAiProviderAdapters,
  providerSupportsCapability,
} from '@/lib/ai-providers';
import { AI_CAPABILITIES } from '@/types/providers';

describe('AI provider registry', () => {
  it('exports the launch capability contract', () => {
    expect(getSupportedAiCapabilities()).toEqual(AI_CAPABILITIES);
    expect(AI_CAPABILITIES).toEqual([
      'text.generate',
      'vision.tag',
      'vision.embed',
      'image.generate',
      'image.edit',
      'image.edit.inpaint',
      'image.edit.outpaint',
      'image.edit.bg-remove',
      'image.upscale',
      'agent.tools',
    ]);
  });

  it('registers Vertex as the active Gemini-backed adapter', () => {
    const vertex = getAiProviderAdapter('vertex');

    expect(vertex.status).toBe('active');
    expect(vertex.label).toContain('Vertex');
    expect(vertex.capabilities).toContain('vision.tag');
    expect(vertex.capabilities).toContain('vision.embed');
    expect(vertex.capabilities).toContain('image.generate');
    expect(providerSupportsCapability('vertex', 'image.upscale')).toBe(true);
    expect(getDefaultAiModelForCapability('vertex', 'vision.embed')).toBe(
      'multimodalembedding@001',
    );
  });

  it('registers OpenAI as an active adapter for text, vision analysis, image generation, and generic image editing', () => {
    const openai = getAiProviderAdapter('openai');

    expect(openai.status).toBe('active');
    expect(openai.capabilities).toContain('text.generate');
    expect(openai.capabilities).toContain('vision.tag');
    expect(openai.capabilities).toContain('image.generate');
    expect(openai.capabilities).toContain('image.edit');
    expect(openai.capabilities).toContain('image.edit.inpaint');
    expect(providerSupportsCapability('openai', 'agent.tools')).toBe(false);
    expect(getDefaultAiModelForCapability('openai', 'vision.tag')).toBe('gpt-4.1-mini');
    expect(getDefaultAiModelForCapability('openai', 'image.edit')).toBe('gpt-image-1');
  });

  it('throws for unsupported provider capabilities', () => {
    expect(() => assertAiProviderCapability('vertex', 'agent.tools')).toThrow(
      'does not support',
    );
    expect(() => getDefaultAiModelForCapability('openai', 'image.upscale')).toThrow(
      'does not support',
    );
  });

  it('lists all provider adapters in provider order', () => {
    expect(listAiProviderAdapters().map((adapter) => adapter.id)).toEqual([
      'vertex',
      'openai',
      'openrouter',
      'groq',
    ]);
  });

  it('registers OpenRouter and Groq as planned (capability-empty) placeholders', () => {
    for (const id of ['openrouter', 'groq'] as const) {
      const adapter = getAiProviderAdapter(id);
      expect(adapter.status).toBe('planned');
      expect(adapter.capabilities).toEqual([]);
      // Settings UI should render them, but no capability call should resolve.
      expect(providerSupportsCapability(id, 'image.generate')).toBe(false);
      expect(() => assertAiProviderCapability(id, 'image.generate')).toThrow(
        'does not support',
      );
    }
  });
});
