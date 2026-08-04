// SPDX-License-Identifier: Apache-2.0
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/ai-provider-config', () => ({
  getOrgAiProviderConfig: vi.fn(),
}));

vi.mock('@/lib/openai', () => ({
  editOpenAiImage: vi.fn(),
}));

vi.mock('@/lib/vertex-ai', () => ({
  getGeminiImageGenModel: vi.fn(),
  imagePromptParts: vi.fn(() => []),
  parseImageResponse: vi.fn(),
}));

import { applyAiImageEdit } from '@/lib/ai-image-edits';
import { getOrgAiProviderConfig } from '@/lib/ai-provider-config';
import { editOpenAiImage } from '@/lib/openai';
import { getGeminiImageGenModel, parseImageResponse } from '@/lib/vertex-ai';

const mockGetOrgAiProviderConfig = vi.mocked(getOrgAiProviderConfig);
const mockEditOpenAiImage = vi.mocked(editOpenAiImage);
const mockGetGeminiImageGenModel = vi.mocked(getGeminiImageGenModel);
const mockParseImageResponse = vi.mocked(parseImageResponse);

describe('applyAiImageEdit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses OpenAI when the active provider supports the requested edit capability', async () => {
    mockGetOrgAiProviderConfig.mockResolvedValue({
      provider: 'openai',
      openAiApiKey: 'sk-openai-test',
    });
    mockEditOpenAiImage.mockResolvedValue({
      imageData: Buffer.from('edited-image'),
      mimeType: 'image/png',
      textResponse: 'background removed',
    });

    const result = await applyAiImageEdit({
      capability: 'image.edit.bg-remove',
      imageUrl: 'https://storage.example.com/source-image',
      mimeType: 'image/jpeg',
      orgId: 'org1',
      prompt: 'Remove the background.',
      width: 800,
      height: 600,
    });

    expect(result.provider).toBe('openai');
    expect(result.modelId).toBe('gpt-image-1');
    expect(result.mimeType).toBe('image/png');
    expect(mockEditOpenAiImage).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: 'sk-openai-test',
        capability: 'image.edit.bg-remove',
        imageUrl: 'https://storage.example.com/source-image',
        mimeType: 'image/jpeg',
        model: 'gpt-image-1',
        orgId: 'org1',
        prompt: 'Remove the background.',
      }),
    );
    expect(mockGetGeminiImageGenModel).not.toHaveBeenCalled();
  });

  it('supports the generic image.edit capability for provider-aware photo enhancement flows', async () => {
    mockGetOrgAiProviderConfig.mockResolvedValue({
      provider: 'openai',
      openAiApiKey: 'sk-openai-test',
    });
    mockEditOpenAiImage.mockResolvedValue({
      imageData: Buffer.from('beautified-image'),
      mimeType: 'image/webp',
      textResponse: 'photo enhanced',
    });

    const result = await applyAiImageEdit({
      capability: 'image.edit',
      imageUrl: 'https://storage.example.com/source-image',
      mimeType: 'image/jpeg',
      orgId: 'org1',
      prompt: 'Enhance this photo naturally.',
      width: 800,
      height: 600,
    });

    expect(result.provider).toBe('openai');
    expect(result.modelId).toBe('gpt-image-1');
    expect(mockEditOpenAiImage).toHaveBeenCalledWith(
      expect.objectContaining({
        capability: 'image.edit',
        model: 'gpt-image-1',
        prompt: 'Enhance this photo naturally.',
      }),
    );
  });

  it('forwards optional mask data to the OpenAI edit helper', async () => {
    mockGetOrgAiProviderConfig.mockResolvedValue({
      provider: 'openai',
      openAiApiKey: 'sk-openai-test',
    });
    mockEditOpenAiImage.mockResolvedValue({
      imageData: Buffer.from('masked-edit'),
      mimeType: 'image/png',
    });

    await applyAiImageEdit({
      capability: 'image.edit.inpaint',
      imageUrl: 'https://storage.example.com/source-image',
      maskBase64: 'ZmFrZS1tYXNr',
      maskMimeType: 'image/png',
      mimeType: 'image/jpeg',
      orgId: 'org1',
      prompt: 'Remove the bench from the masked region.',
    });

    expect(mockEditOpenAiImage).toHaveBeenCalledWith(
      expect.objectContaining({
        capability: 'image.edit.inpaint',
        maskBase64: 'ZmFrZS1tYXNr',
        maskMimeType: 'image/png',
      }),
    );
  });

  it('falls back to Vertex when the active provider does not support the requested capability', async () => {
    const generateContent = vi.fn().mockResolvedValue({ response: { candidates: [] } });

    mockGetOrgAiProviderConfig.mockResolvedValue({
      provider: 'openai',
      openAiApiKey: 'sk-openai-test',
    });
    mockGetGeminiImageGenModel.mockResolvedValue({ generateContent } as never);
    mockParseImageResponse.mockReturnValue({
      imageData: Buffer.from('upscaled-image'),
      mimeType: 'image/png',
    });

    const result = await applyAiImageEdit({
      capability: 'image.upscale',
      imageUrl: 'https://storage.example.com/source-image',
      mimeType: 'image/jpeg',
      orgId: 'org1',
      prompt: 'Upscale this image.',
    });

    expect(result.provider).toBe('vertex');
    expect(result.modelId).toBe('gemini-2.5-flash-image');
    expect(mockEditOpenAiImage).not.toHaveBeenCalled();
    expect(mockGetGeminiImageGenModel).toHaveBeenCalledWith('org1', 'gemini-2.5-flash-image');
  });
});