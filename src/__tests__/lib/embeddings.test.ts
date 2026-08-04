// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, vi, beforeEach } from 'vitest';

/* ── Set env BEFORE any module loads ──────────────────────── */

vi.hoisted(() => {
  process.env.GCP_PROJECT_ID = 'test-project';
  process.env.GCP_VERTEX_LOCATION = 'us-central1';
});

/* ── Hoisted mocks (available inside vi.mock factories) ───── */

const mockGetAccessToken = vi.fn();

vi.mock('google-auth-library', () => {
  class MockGoogleAuth {
    async getClient() {
      return { getAccessToken: mockGetAccessToken };
    }
  }
  return { GoogleAuth: MockGoogleAuth };
});

/* ── Mock fetch ────────────────────────────────────────────── */

const mockFetch = vi.fn();
global.fetch = mockFetch;

/* ── Import after mocks ───────────────────────────────────── */

import {
  generateImageEmbedding,
  generateTextEmbedding,
  generateMultimodalEmbedding,
  cosineSimilarity,
  EMBEDDING_CONFIG,
} from '@/lib/embeddings';

/* ── Helpers ───────────────────────────────────────────────── */

function make768(): number[] {
  return Array.from({ length: 768 }, (_, i) => Math.sin(i * 0.1));
}

function mockSuccessResponse(
  imageEmbedding?: number[],
  textEmbedding?: number[],
) {
  const pred: Record<string, number[]> = {};
  if (imageEmbedding) pred.imageEmbedding = imageEmbedding;
  if (textEmbedding) pred.textEmbedding = textEmbedding;
  return {
    ok: true,
    json: async () => ({ predictions: [pred] }),
    text: async () => 'OK',
  };
}

/* ── Tests ─────────────────────────────────────────────────── */

describe('Embeddings Library', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAccessToken.mockResolvedValue({ token: 'test-token-123' });
  });

  /* ─ Constants ─ */

  describe('EMBEDDING_CONFIG', () => {
    it('exports correct model name', () => {
      expect(EMBEDDING_CONFIG.model).toBe('multimodalembedding@001');
    });

    it('exports 768 dimensions', () => {
      expect(EMBEDDING_CONFIG.dimensions).toBe(768);
    });

    it('exports 20MB max image size', () => {
      expect(EMBEDDING_CONFIG.maxImageBytes).toBe(20 * 1024 * 1024);
    });
  });

  /* ─ cosineSimilarity ─ */

  describe('cosineSimilarity', () => {
    it('returns 1.0 for identical vectors', () => {
      const v = [1, 2, 3, 4, 5];
      expect(cosineSimilarity(v, v)).toBeCloseTo(1.0, 5);
    });

    it('returns -1.0 for opposite vectors', () => {
      const a = [1, 0, 0];
      const b = [-1, 0, 0];
      expect(cosineSimilarity(a, b)).toBeCloseTo(-1.0, 5);
    });

    it('returns 0 for orthogonal vectors', () => {
      const a = [1, 0, 0];
      const b = [0, 1, 0];
      expect(cosineSimilarity(a, b)).toBeCloseTo(0, 5);
    });

    it('returns 0 for zero vectors', () => {
      expect(cosineSimilarity([0, 0, 0], [1, 2, 3])).toBe(0);
    });

    it('throws on dimension mismatch', () => {
      expect(() => cosineSimilarity([1, 2], [1, 2, 3])).toThrow(
        'Vector dimension mismatch',
      );
    });

    it('handles high-dimensional vectors (768)', () => {
      const a = make768();
      const sim = cosineSimilarity(a, a);
      expect(sim).toBeCloseTo(1.0, 5);
    });

    it('returns correct value for known vectors', () => {
      const a = [1, 2, 3];
      const b = [4, 5, 6];
      // dot = 4+10+18 = 32, |a|=sqrt(14), |b|=sqrt(77)
      const expected = 32 / (Math.sqrt(14) * Math.sqrt(77));
      expect(cosineSimilarity(a, b)).toBeCloseTo(expected, 5);
    });
  });

  /* ─ generateImageEmbedding ─ */

  describe('generateImageEmbedding', () => {
    it('returns 768-dim embedding on success', async () => {
      const vec = make768();
      mockFetch.mockResolvedValueOnce(mockSuccessResponse(vec));

      const result = await generateImageEmbedding('aGVsbG8=', 'image/jpeg');

      expect(result.embedding).toEqual(vec);
      expect(result.embedding).toHaveLength(768);
      expect(result.model).toBe('multimodalembedding@001');
      expect(result.generatedAt).toBeInstanceOf(Date);
    });

    it('sends correct request body', async () => {
      const vec = make768();
      mockFetch.mockResolvedValueOnce(mockSuccessResponse(vec));

      await generateImageEmbedding('base64data', 'image/png');

      expect(mockFetch).toHaveBeenCalledOnce();
      const call = mockFetch.mock.calls[0];
      expect(call[0]).toContain('multimodalembedding@001:predict');
      expect(call[0]).toContain('test-project');
      expect(call[0]).toContain('us-central1');

      const body = JSON.parse(call[1].body);
      expect(body.instances[0].image.bytesBase64Encoded).toBe('base64data');
    });

    it('includes Bearer token in headers', async () => {
      const vec = make768();
      mockFetch.mockResolvedValueOnce(mockSuccessResponse(vec));

      await generateImageEmbedding('aGVsbG8=', 'image/jpeg');

      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers.Authorization).toBe('Bearer test-token-123');
      expect(headers['Content-Type']).toBe('application/json');
    });

    it('throws on oversized image', async () => {
      // base64 at 30MB raw size → ~40MB base64
      const oversized = 'x'.repeat(30 * 1024 * 1024);
      await expect(
        generateImageEmbedding(oversized, 'image/jpeg'),
      ).rejects.toThrow('Image too large for embedding');
    });

    it('throws on API HTTP error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      });

      await expect(
        generateImageEmbedding('aGVsbG8=', 'image/jpeg'),
      ).rejects.toThrow('Vertex AI embedding API error (500)');
    });

    it('throws on API error in response body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          error: {
            code: 400,
            message: 'Bad request',
            status: 'INVALID_ARGUMENT',
          },
        }),
      });

      await expect(
        generateImageEmbedding('aGVsbG8=', 'image/jpeg'),
      ).rejects.toThrow('Vertex AI embedding error: Bad request');
    });

    it('throws on wrong dimension count', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          predictions: [{ imageEmbedding: [1, 2, 3] }],
        }),
      });

      await expect(
        generateImageEmbedding('aGVsbG8=', 'image/jpeg'),
      ).rejects.toThrow('Invalid embedding response: expected 768-dim vector');
    });

    it('throws on missing embedding in response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ predictions: [{}] }),
      });

      await expect(
        generateImageEmbedding('aGVsbG8=', 'image/jpeg'),
      ).rejects.toThrow('Invalid embedding response');
    });
  });

  /* ─ generateTextEmbedding ─ */

  describe('generateTextEmbedding', () => {
    it('returns 768-dim embedding on success', async () => {
      const vec = make768();
      mockFetch.mockResolvedValueOnce(mockSuccessResponse(undefined, vec));

      const result = await generateTextEmbedding('a happy dog');

      expect(result.embedding).toEqual(vec);
      expect(result.embedding).toHaveLength(768);
      expect(result.model).toBe('multimodalembedding@001');
    });

    it('sends correct request body with text instance', async () => {
      const vec = make768();
      mockFetch.mockResolvedValueOnce(mockSuccessResponse(undefined, vec));

      await generateTextEmbedding('sunset over ocean');

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.instances[0].text).toBe('sunset over ocean');
      expect(body.instances[0].image).toBeUndefined();
    });

    it('throws on empty text', async () => {
      await expect(generateTextEmbedding('')).rejects.toThrow(
        'Cannot generate embedding for empty text',
      );
    });

    it('throws on whitespace-only text', async () => {
      await expect(generateTextEmbedding('   ')).rejects.toThrow(
        'Cannot generate embedding for empty text',
      );
    });

    it('throws on API HTTP error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: async () => 'Rate limited',
      });

      await expect(generateTextEmbedding('test')).rejects.toThrow(
        'Vertex AI text embedding API error (429)',
      );
    });

    it('throws on wrong dimension count', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          predictions: [{ textEmbedding: [0.1, 0.2] }],
        }),
      });

      await expect(generateTextEmbedding('test')).rejects.toThrow(
        'Invalid text embedding response: expected 768-dim vector',
      );
    });
  });

  /* ─ generateMultimodalEmbedding ─ */

  describe('generateMultimodalEmbedding', () => {
    it('returns both image and text embeddings', async () => {
      const imgVec = make768();
      const txtVec = make768().map((v) => v * 0.5);
      mockFetch.mockResolvedValueOnce(mockSuccessResponse(imgVec, txtVec));

      const result = await generateMultimodalEmbedding(
        'aGVsbG8=',
        'image/jpeg',
        'a cat photo',
      );

      expect(result.image.embedding).toEqual(imgVec);
      expect(result.text.embedding).toEqual(txtVec);
      expect(result.image.model).toBe('multimodalembedding@001');
      expect(result.text.model).toBe('multimodalembedding@001');
      expect(result.image.generatedAt).toEqual(result.text.generatedAt);
    });

    it('sends both image and text in one request', async () => {
      const vec = make768();
      mockFetch.mockResolvedValueOnce(mockSuccessResponse(vec, vec));

      await generateMultimodalEmbedding('imgdata', 'image/png', 'description');

      expect(mockFetch).toHaveBeenCalledOnce();
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.instances[0].image.bytesBase64Encoded).toBe('imgdata');
      expect(body.instances[0].text).toBe('description');
    });

    it('throws on oversized image', async () => {
      const oversized = 'x'.repeat(30 * 1024 * 1024);
      await expect(
        generateMultimodalEmbedding(oversized, 'image/jpeg', 'test'),
      ).rejects.toThrow('Image too large for embedding');
    });

    it('throws when image embedding missing in response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          predictions: [{ textEmbedding: make768() }],
        }),
      });

      await expect(
        generateMultimodalEmbedding('aGVsbG8=', 'image/jpeg', 'test'),
      ).rejects.toThrow('Invalid image embedding in multimodal response');
    });

    it('throws when text embedding missing in response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          predictions: [{ imageEmbedding: make768() }],
        }),
      });

      await expect(
        generateMultimodalEmbedding('aGVsbG8=', 'image/jpeg', 'test'),
      ).rejects.toThrow('Invalid text embedding in multimodal response');
    });
  });
});
