// SPDX-License-Identifier: Apache-2.0
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/ai-provider-config', () => ({
  getOrgAiProviderConfig: vi.fn(),
}));

vi.mock('@/lib/openai', () => ({
  generateOpenAiVisionText: vi.fn(),
}));

vi.mock('@/lib/vertex-ai', () => ({
  getGeminiFlashImageModel: vi.fn(),
}));

import { analyzeImageTags } from '@/lib/ai-analysis';
import { detectImageFaces } from '@/lib/ai-analysis';
import { generateImageAnalysisText } from '@/lib/ai-analysis';
import { getOrgAiProviderConfig } from '@/lib/ai-provider-config';
import { generateOpenAiVisionText } from '@/lib/openai';
import { getGeminiFlashImageModel } from '@/lib/vertex-ai';

const mockGetOrgAiProviderConfig = vi.mocked(getOrgAiProviderConfig);
const mockGenerateOpenAiVisionText = vi.mocked(generateOpenAiVisionText);
const mockGetGeminiFlashImageModel = vi.mocked(getGeminiFlashImageModel);

describe('analyzeImageTags', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses OpenAI vision analysis with a data URL when only base64 is available', async () => {
    mockGetOrgAiProviderConfig.mockResolvedValue({
      provider: 'openai',
      openAiApiKey: 'sk-openai-test',
    });
    mockGenerateOpenAiVisionText.mockResolvedValue(
      '{"tags":["launch","banner"],"description":"Launch banner graphic."}',
    );

    const result = await analyzeImageTags({
      imageBase64: 'ZmFrZS1pbWFnZS1kYXRh',
      mimeType: 'image/png',
      orgId: 'org1',
    });

    expect(result.provider).toBe('openai');
    expect(result.modelId).toBe('gpt-4.1-mini');
    expect(result.tags).toEqual(['launch', 'banner']);
    expect(result.description).toBe('Launch banner graphic.');
    expect(mockGenerateOpenAiVisionText).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: 'sk-openai-test',
        imageUrl: 'data:image/png;base64,ZmFrZS1pbWFnZS1kYXRh',
        model: 'gpt-4.1-mini',
        orgId: 'org1',
      }),
    );
    expect(mockGetGeminiFlashImageModel).not.toHaveBeenCalled();
  });

  it('uses Vertex analysis with a signed image URL when that is the available source', async () => {
    const generateContent = vi.fn().mockResolvedValue({
      response: {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: '{"tags":["portrait"],"description":"Portrait photo."}',
                },
              ],
            },
          },
        ],
      },
    });

    mockGetOrgAiProviderConfig.mockResolvedValue({
      provider: 'vertex',
      vertexApiKey: 'vertex-key',
    });
    mockGetGeminiFlashImageModel.mockResolvedValue({
      generateContent,
    } as never);

    const result = await analyzeImageTags({
      imageUrl: 'https://storage.example.com/signed-image',
      mimeType: 'image/jpeg',
      orgId: 'org1',
    });

    expect(result.provider).toBe('vertex');
    expect(result.modelId).toBe('gemini-2.5-flash-image');
    expect(result.tags).toEqual(['portrait']);
    expect(result.description).toBe('Portrait photo.');
    expect(mockGetGeminiFlashImageModel).toHaveBeenCalledWith('org1', 'gemini-2.5-flash-image');
    expect(generateContent).toHaveBeenCalledWith({
      contents: [
        {
          role: 'user',
          parts: [
            {
              fileData: {
                fileUri: 'https://storage.example.com/signed-image',
                mimeType: 'image/jpeg',
              },
            },
            {
              text: expect.stringContaining('Analyze this image'),
            },
          ],
        },
      ],
    });
  });

  it('uses OpenAI vision analysis to detect faces from inline image data', async () => {
    mockGetOrgAiProviderConfig.mockResolvedValue({
      provider: 'openai',
      openAiApiKey: 'sk-openai-test',
    });
    mockGenerateOpenAiVisionText.mockResolvedValue(
      '{"faces":[{"confidence":0.91,"boundingBox":{"x":12,"y":18,"w":44,"h":52},"emotion":"happy"}]}',
    );

    const result = await detectImageFaces({
      imageBase64: 'ZmFrZS1mYWNlLWltYWdl',
      imageHeight: 768,
      imageWidth: 1024,
      mimeType: 'image/png',
      orgId: 'org1',
    });

    expect(result.provider).toBe('openai');
    expect(result.modelId).toBe('gpt-4.1-mini');
    expect(result.faces).toEqual([
      {
        faceHash: 'face_1',
        confidence: 0.91,
        boundingBox: { x: 12, y: 18, w: 44, h: 52 },
        emotion: 'happy',
      },
    ]);
    expect(mockGenerateOpenAiVisionText).toHaveBeenCalledWith(
      expect.objectContaining({
        imageUrl: 'data:image/png;base64,ZmFrZS1mYWNlLWltYWdl',
        model: 'gpt-4.1-mini',
        orgId: 'org1',
      }),
    );
  });
});

describe('generateImageAnalysisText', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns raw OpenAI output for prompts that expect a JSON array payload', async () => {
    mockGetOrgAiProviderConfig.mockResolvedValue({
      provider: 'openai',
      openAiApiKey: 'sk-openai-test',
    });
    mockGenerateOpenAiVisionText.mockResolvedValue(
      '[{"aspectRatio":"1:1","label":"centered"}]',
    );

    const result = await generateImageAnalysisText({
      imageBase64: 'ZmFrZS1pbWFnZS1kYXRh',
      mimeType: 'image/png',
      orgId: 'org1',
      prompt: 'Return crop suggestions as a JSON array.',
    });

    expect(result.provider).toBe('openai');
    expect(result.text).toBe('[{"aspectRatio":"1:1","label":"centered"}]');
    expect(mockGenerateOpenAiVisionText).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: 'sk-openai-test',
        imageUrl: 'data:image/png;base64,ZmFrZS1pbWFnZS1kYXRh',
        orgId: 'org1',
        prompt: 'Return crop suggestions as a JSON array.',
      }),
    );
  });
});