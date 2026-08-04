// SPDX-License-Identifier: Apache-2.0
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/ai-pipeline', () => ({
  runAiJob: vi.fn(),
}));

vi.mock('@/lib/storage', () => ({
  getSignedDownloadUrl: vi.fn(),
}));

vi.mock('@/lib/ai-provider-config', () => ({
  getOrgAiProviderConfig: vi.fn(),
}));

vi.mock('@/lib/openai', () => ({
  generateOpenAiVisionText: vi.fn(),
}));

vi.mock('@/lib/vertex-ai', () => ({
  getGeminiFlashImageModel: vi.fn(),
  parseTextResponse: vi.fn(),
  imagePromptParts: vi.fn().mockReturnValue([{ text: 'prompt' }]),
}));

import { POST } from '@/app/api/ai/caption/route';
import { runAiJob } from '@/lib/ai-pipeline';
import { getSignedDownloadUrl } from '@/lib/storage';
import { getOrgAiProviderConfig } from '@/lib/ai-provider-config';
import { generateOpenAiVisionText } from '@/lib/openai';
import { getGeminiFlashImageModel } from '@/lib/vertex-ai';

const mockRunAiJob = vi.mocked(runAiJob);
const mockGetSignedDownloadUrl = vi.mocked(getSignedDownloadUrl);
const mockGetOrgAiProviderConfig = vi.mocked(getOrgAiProviderConfig);
const mockGenerateOpenAiVisionText = vi.mocked(generateOpenAiVisionText);
const mockGetGeminiFlashImageModel = vi.mocked(getGeminiFlashImageModel);

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest(new URL('http://localhost:3000/api/ai/caption'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  } as never);
}

describe('POST /api/ai/caption', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockGetSignedDownloadUrl.mockResolvedValue('https://storage.example.com/caption-source');
    mockGetOrgAiProviderConfig.mockResolvedValue({
      provider: 'openai',
      openAiApiKey: 'sk-openai-test',
    });
    mockGenerateOpenAiVisionText.mockResolvedValue(
      JSON.stringify({
        shortDescription: 'Ocean sunset',
        detailedDescription: 'A warm sunset over calm ocean water.',
        hashtags: ['sunset', 'ocean'],
        altText: 'Warm sunset over calm ocean water',
      }),
    );
    mockGetGeminiFlashImageModel.mockResolvedValue({
      generateContent: vi.fn(),
    } as never);
  });

  it('uses the active OpenAI provider for caption analysis', async () => {
    const save = vi.fn();
    const asset = {
      _id: 'asset1',
      storageKey: 'assets/org1/photo.jpg',
      mimeType: 'image/jpeg',
      tags: ['existing'],
      save,
    };

    mockRunAiJob.mockImplementation(async (_jobInput, executor) => ({
      jobId: 'job1',
      status: 'completed',
      result: await executor({
        job: {} as never,
        asset: asset as never,
        orgId: 'org1',
        userId: 'user1',
      }),
    }));

    const response = await POST(makeRequest({ assetId: 'asset1' }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.results).toHaveLength(1);
    expect(data.results[0]).toEqual(
      expect.objectContaining({
        assetId: 'asset1',
        shortDescription: 'Ocean sunset',
        altText: 'Warm sunset over calm ocean water',
      }),
    );
    expect(mockGenerateOpenAiVisionText).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: 'sk-openai-test',
        imageUrl: 'https://storage.example.com/caption-source',
        model: 'gpt-4.1-mini',
        orgId: 'org1',
      }),
    );
    expect(mockGetGeminiFlashImageModel).not.toHaveBeenCalled();
    expect(asset.tags).toEqual(['existing', 'sunset', 'ocean']);
    expect(save).toHaveBeenCalled();
  });
});