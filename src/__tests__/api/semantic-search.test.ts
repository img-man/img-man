// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, vi, beforeEach } from 'vitest';

/* ── Hoisted mocks ─────────────────────────────────────────── */

const { mockAggregate, mockFindOne, mockFindById, mockUpdateOne } = vi.hoisted(
  () => ({
    mockAggregate: vi.fn(),
    mockFindOne: vi.fn(),
    mockFindById: vi.fn(),
    mockUpdateOne: vi.fn(),
  }),
);

/* ── Mock deps ─────────────────────────────────────────────── */

vi.mock('@/lib/db', () => ({ connectToDatabase: vi.fn() }));
vi.mock('@/lib/session', () => ({ getSession: vi.fn() }));
vi.mock('@/lib/storage', () => ({
  getSignedDownloadUrl: vi.fn().mockResolvedValue('https://signed.url/img.jpg'),
  getGcsBucket: vi.fn().mockReturnValue({
    file: vi.fn().mockReturnValue({
      download: vi.fn().mockResolvedValue([Buffer.from('fakeimage')]),
    }),
  }),
}));
vi.mock('@/lib/embeddings', () => ({
  generateTextEmbedding: vi.fn(),
  generateImageEmbedding: vi.fn(),
}));

vi.mock('@/models', () => ({
  Asset: {
    aggregate: mockAggregate,
    findOne: vi.fn().mockImplementation(() => ({
      select: vi.fn().mockImplementation(() => ({
        lean: mockFindOne,
      })),
    })),
    findById: vi.fn().mockImplementation(() => ({
      select: vi.fn().mockImplementation(() => ({
        lean: mockFindById,
      })),
    })),
    updateOne: mockUpdateOne,
  },
  User: {
    findOne: vi.fn().mockImplementation(() => ({
      lean: vi.fn().mockResolvedValue({
        _id: 'user1',
        email: 'test@test.com',
        orgId: '507f1f77bcf86cd799439011',
      }),
    })),
  },
}));

import { getSession } from '@/lib/session';
import {
  generateTextEmbedding,
  generateImageEmbedding,
} from '@/lib/embeddings';

const mockGetSession = vi.mocked(getSession);
const mockGenText = vi.mocked(generateTextEmbedding);
const mockGenImage = vi.mocked(generateImageEmbedding);

/* ── Import route handler ──────────────────────────────────── */

import { POST } from '@/app/api/assets/semantic-search/route';
import { NextRequest } from 'next/server';

/* ── Helpers ───────────────────────────────────────────────── */

function make768(): number[] {
  return Array.from({ length: 768 }, (_, i) => Math.sin(i * 0.05));
}

function makeReq(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/assets/semantic-search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/* ── Tests ─────────────────────────────────────────────────── */

describe('POST /api/assets/semantic-search', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({
      user: { email: 'test@test.com', name: 'Test', image: null },
      expires: '2099-01-01',
    });
  });

  it('returns 401 without session', async () => {
    mockGetSession.mockResolvedValueOnce(null);
    const res = await POST(makeReq({ query: 'hello' }));
    expect(res.status).toBe(401);
  });

  it('returns 400 without query or assetId', async () => {
    const res = await POST(makeReq({}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Either "query"');
  });

  it('performs text query search successfully', async () => {
    const vec = make768();
    mockGenText.mockResolvedValueOnce({
      embedding: vec,
      model: 'multimodalembedding@001',
      generatedAt: new Date(),
    });

    mockAggregate.mockResolvedValueOnce([
      {
        _id: 'asset1',
        name: 'beach.jpg',
        mimeType: 'image/jpeg',
        score: 0.92,
        thumbnailBase64: 'data:image/...',
      },
    ]);

    const res = await POST(makeReq({ query: 'sunset beach' }));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.results).toHaveLength(1);
    expect(body.results[0].score).toBe(0.92);
    expect(body.mode).toBe('semantic_text');
    expect(body.total).toBe(1);
  });

  it('calls generateTextEmbedding for text queries', async () => {
    const vec = make768();
    mockGenText.mockResolvedValueOnce({
      embedding: vec,
      model: 'multimodalembedding@001',
      generatedAt: new Date(),
    });
    mockAggregate.mockResolvedValueOnce([]);

    await POST(makeReq({ query: 'happy dog' }));

    expect(mockGenText).toHaveBeenCalledWith('happy dog', '507f1f77bcf86cd799439011');
    expect(mockGenImage).not.toHaveBeenCalled();
  });

  it('returns visual_similarity mode for assetId queries', async () => {
    const vec = make768();
    mockFindOne.mockResolvedValueOnce({ embedding: vec });
    mockAggregate.mockResolvedValueOnce([]);

    const res = await POST(makeReq({ assetId: '507f1f77bcf86cd799439011' }));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.mode).toBe('visual_similarity');
  });

  it('generates signed URLs for assets without thumbnailBase64', async () => {
    const vec = make768();
    mockGenText.mockResolvedValueOnce({
      embedding: vec,
      model: 'multimodalembedding@001',
      generatedAt: new Date(),
    });

    mockAggregate.mockResolvedValueOnce([
      {
        _id: 'asset1',
        name: 'pic.jpg',
        mimeType: 'image/jpeg',
        storageKey: 'org/pic.jpg',
        score: 0.85,
      },
    ]);

    const res = await POST(makeReq({ query: 'mountain' }));
    expect(res.status).toBe(200);
  });

  it('caps limit at max 50', async () => {
    const vec = make768();
    mockGenText.mockResolvedValueOnce({
      embedding: vec,
      model: 'multimodalembedding@001',
      generatedAt: new Date(),
    });
    mockAggregate.mockResolvedValueOnce([]);

    await POST(makeReq({ query: 'test', limit: 100 }));

    // Verify aggregate was called — the limit in the pipeline should be capped
    expect(mockAggregate).toHaveBeenCalledOnce();
    const pipeline = mockAggregate.mock.calls[0][0];
    const limitStage = pipeline.find(
      (s: Record<string, unknown>) => '$limit' in s,
    );
    expect(limitStage.$limit).toBeLessThanOrEqual(50);
  });

  it('handles embedding API errors gracefully', async () => {
    mockGenText.mockRejectedValueOnce(new Error('Vertex AI went down'));

    const res = await POST(makeReq({ query: 'test' }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Semantic search failed');
    expect(body.details).toContain('Vertex AI went down');
  });

  it('passes color filter to post-match stage', async () => {
    const vec = make768();
    mockGenText.mockResolvedValueOnce({
      embedding: vec,
      model: 'multimodalembedding@001',
      generatedAt: new Date(),
    });
    mockAggregate.mockResolvedValueOnce([]);

    await POST(makeReq({ query: 'test', color: '#FF0000' }));

    const pipeline = mockAggregate.mock.calls[0][0];
    const matchStage = pipeline.find(
      (s: Record<string, unknown>) =>
        '$match' in s &&
        (s.$match as Record<string, unknown>).dominantColors !== undefined,
    );
    expect(matchStage).toBeDefined();
    expect((matchStage.$match as Record<string, unknown>).dominantColors).toBe(
      '#FF0000',
    );
  });

  it('passes mimeType filter to post-match stage', async () => {
    const vec = make768();
    mockGenText.mockResolvedValueOnce({
      embedding: vec,
      model: 'multimodalembedding@001',
      generatedAt: new Date(),
    });
    mockAggregate.mockResolvedValueOnce([]);

    await POST(makeReq({ query: 'test', mimeType: 'image/' }));

    const pipeline = mockAggregate.mock.calls[0][0];
    const matchStage = pipeline.find(
      (s: Record<string, unknown>) =>
        '$match' in s &&
        (s.$match as Record<string, unknown>).mimeType !== undefined,
    );
    expect(matchStage).toBeDefined();
  });
});
