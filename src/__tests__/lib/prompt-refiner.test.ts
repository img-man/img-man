// SPDX-License-Identifier: Apache-2.0
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGenerateOpenAiText, mockGetVertexAiClient } = vi.hoisted(() => ({
  mockGenerateOpenAiText: vi.fn(),
  mockGetVertexAiClient: vi.fn(),
}));

vi.mock('@/lib/openai', () => ({
  generateOpenAiText: mockGenerateOpenAiText,
}));

vi.mock('@/lib/vertex-ai', () => ({
  getVertexAiClient: mockGetVertexAiClient,
}));

import { refinePrompt } from '@/lib/prompt-refiner';

describe('refinePrompt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses OpenAI when the provider override is openai', async () => {
    mockGenerateOpenAiText.mockResolvedValue('refined openai prompt');

    const result = await refinePrompt({
      mode: 'generate',
      prompt: 'sunlit product photo',
      providerOverride: 'openai',
      openAiApiKey: 'sk-test',
      orgId: 'org1',
    });

    expect(result).toBe('refined openai prompt');
    expect(mockGenerateOpenAiText).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: 'sk-test',
        orgId: 'org1',
      }),
    );
    expect(mockGetVertexAiClient).not.toHaveBeenCalled();
  });

  it('falls back to the original prompt when OpenAI refinement fails', async () => {
    mockGenerateOpenAiText.mockRejectedValue(new Error('OpenAI unavailable'));

    const result = await refinePrompt({
      mode: 'generate',
      prompt: 'minimal poster',
      providerOverride: 'openai',
      openAiApiKey: 'sk-test',
    });

    expect(result).toBe('minimal poster');
  });
});