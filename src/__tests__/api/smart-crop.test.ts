// SPDX-License-Identifier: Apache-2.0
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/ai-pipeline', () => ({
  runAiJob: vi.fn(),
}));

vi.mock('@/lib/storage', () => ({
  getSignedDownloadUrl: vi.fn(),
}));

vi.mock('@/lib/ai-analysis', () => ({
  generateImageAnalysisText: vi.fn(),
}));

import { POST } from '@/app/api/ai/smart-crop/route';
import { generateImageAnalysisText } from '@/lib/ai-analysis';
import { runAiJob } from '@/lib/ai-pipeline';
import { getSignedDownloadUrl } from '@/lib/storage';

const mockRunAiJob = vi.mocked(runAiJob);
const mockGenerateImageAnalysisText = vi.mocked(generateImageAnalysisText);
const mockGetSignedDownloadUrl = vi.mocked(getSignedDownloadUrl);

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest(new URL('http://localhost:3000/api/ai/smart-crop'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  } as never);
}

describe('POST /api/ai/smart-crop', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSignedDownloadUrl.mockResolvedValue('https://storage.example.com/smart-crop-source');
    mockRunAiJob.mockImplementation(async (_job, handler) => {
      const result = await handler({
        asset: {
          mimeType: 'image/jpeg',
          storageKey: 'assets/org1/photo.jpg',
          width: 1200,
          height: 800,
        },
        orgId: 'org1',
      } as never);

      return {
        jobId: 'job-smart-crop',
        status: 'completed',
        result,
      };
    });
  });

  it('uses the shared provider-aware image analysis helper for crop suggestions', async () => {
    mockGenerateImageAnalysisText.mockResolvedValue({
      provider: 'openai',
      modelId: 'gpt-4.1-mini',
      text: JSON.stringify([
        {
          aspectRatio: '1:1',
          label: 'centered',
          x: 120,
          y: 80,
          width: 640,
          height: 640,
          confidence: 0.92,
        },
      ]),
    });

    const response = await POST(makeRequest({ assetId: 'asset1', aspectRatios: ['1:1'] }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(mockGenerateImageAnalysisText).toHaveBeenCalledWith(
      expect.objectContaining({
        imageUrl: 'https://storage.example.com/smart-crop-source',
        mimeType: 'image/jpeg',
        orgId: 'org1',
        prompt: expect.stringContaining('Aspect ratios: 1:1'),
      }),
    );
    expect(data.result).toEqual(
      expect.objectContaining({
        imageWidth: 1200,
        imageHeight: 800,
        suggestions: [
          expect.objectContaining({
            aspectRatio: '1:1',
            label: 'centered',
            confidence: 0.92,
          }),
        ],
      }),
    );
  });

  it('falls back to centered crops when the AI output is not valid JSON', async () => {
    mockGenerateImageAnalysisText.mockResolvedValue({
      provider: 'openai',
      modelId: 'gpt-4.1-mini',
      text: 'not-json',
    });

    const response = await POST(makeRequest({ assetId: 'asset1', aspectRatios: ['16:9'] }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.result.suggestions).toEqual([
      {
        aspectRatio: '16:9',
        label: 'centered',
        x: 0,
        y: 63,
        width: 1200,
        height: 675,
        confidence: 0.5,
      },
    ]);
  });
});