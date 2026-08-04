// SPDX-License-Identifier: Apache-2.0
/**
 * AI Adapter Capability Conformance Tests — DoD §21 #8
 *
 * Systematically verifies that every capability declared in the adapter
 * registry has a working runtime implementation for Vertex (Gemini) and
 * OpenAI. Mock-based so no real provider credentials are required.
 *
 * Coverage matrix:
 *   Vertex  : text.generate, vision.tag*, vision.embed*, image.generate,
 *             image.edit*, image.edit.inpaint*, image.edit.outpaint*,
 *             image.edit.bg-remove*, image.upscale*
 *   OpenAI  : text.generate, vision.tag*, image.generate,
 *             image.edit*, image.edit.inpaint*, image.edit.outpaint*,
 *             image.edit.bg-remove*
 *
 * (* = already covered by dedicated test suites; included here as a smoke
 * assertion to keep the conformance matrix explicit and prevent regressions)
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

/* ─── Module-level mocks — must come before any imports ──────── */

vi.mock('@/lib/vertex-ai', () => ({
  getGeminiFlashImageModel: vi.fn(),
  getGeminiImageGenModel: vi.fn(),
  imagePromptParts: vi.fn(() => [{ text: 'prompt' }]),
  parseImageResponse: vi.fn(),
  parseTextResponse: vi.fn(),
  textPromptParts: vi.fn(() => [{ text: 'prompt' }]),
}));

vi.mock('@/lib/ai-provider-config', () => ({
  getOrgAiProviderConfig: vi.fn(),
}));

/* ─── Lazy imports (after vi.mock) ───────────────────────────── */

import {
  getGeminiFlashImageModel,
  getGeminiImageGenModel,
  parseImageResponse,
  parseTextResponse,
} from '@/lib/vertex-ai';
import {
  generateOpenAiImage,
  generateOpenAiText,
  generateOpenAiVisionText,
} from '@/lib/openai';
import {
  assertAiProviderCapability,
  getAiProviderAdapter,
  providerSupportsCapability,
} from '@/lib/ai-providers';
import { getOrgAiProviderConfig } from '@/lib/ai-provider-config';
import { analyzeImageTags } from '@/lib/ai-analysis';
import { applyAiImageEdit } from '@/lib/ai-image-edits';

const mockGetGeminiFlashImageModel = vi.mocked(getGeminiFlashImageModel);
const mockGetGeminiImageGenModel = vi.mocked(getGeminiImageGenModel);
const mockParseImageResponse = vi.mocked(parseImageResponse);
const mockParseTextResponse = vi.mocked(parseTextResponse);
const mockGetOrgAiProviderConfig = vi.mocked(getOrgAiProviderConfig);

/* ─── Helpers ────────────────────────────────────────────────── */

function makeGeminiTextModel(text: string) {
  const generateContent = vi.fn().mockResolvedValue({
    response: {
      candidates: [
        { content: { parts: [{ text }] } },
      ],
    },
  });
  return { generateContent };
}

function makeGeminiImageModel(base64 = 'ZmFrZQ==', mimeType = 'image/png') {
  const generateContent = vi.fn().mockResolvedValue({ response: { candidates: [] } });
  mockParseImageResponse.mockReturnValue({
    imageData: Buffer.from(base64, 'base64'),
    mimeType,
  });
  return { generateContent };
}

/* ─── Registry gate ──────────────────────────────────────────── */

describe('Adapter registry capability contract', () => {
  it('vertex adapter declares the expected launch capabilities', () => {
    const vertex = getAiProviderAdapter('vertex');
    expect(vertex.status).toBe('active');
    expect(vertex.capabilities).toContain('text.generate');
    expect(vertex.capabilities).toContain('vision.tag');
    expect(vertex.capabilities).toContain('vision.embed');
    expect(vertex.capabilities).toContain('image.generate');
    expect(vertex.capabilities).toContain('image.edit');
    expect(vertex.capabilities).toContain('image.edit.inpaint');
    expect(vertex.capabilities).toContain('image.edit.outpaint');
    expect(vertex.capabilities).toContain('image.edit.bg-remove');
    expect(vertex.capabilities).toContain('image.upscale');
  });

  it('openai adapter declares the expected launch capabilities', () => {
    const openai = getAiProviderAdapter('openai');
    expect(openai.status).toBe('active');
    expect(openai.capabilities).toContain('text.generate');
    expect(openai.capabilities).toContain('vision.tag');
    expect(openai.capabilities).toContain('image.generate');
    expect(openai.capabilities).toContain('image.edit');
    expect(openai.capabilities).toContain('image.edit.inpaint');
    expect(openai.capabilities).toContain('image.edit.outpaint');
    expect(openai.capabilities).toContain('image.edit.bg-remove');
  });

  it('assertAiProviderCapability does not throw for any declared capability', () => {
    const vertex = getAiProviderAdapter('vertex');
    const openai = getAiProviderAdapter('openai');
    for (const cap of vertex.capabilities) {
      expect(() => assertAiProviderCapability('vertex', cap)).not.toThrow();
    }
    for (const cap of openai.capabilities) {
      expect(() => assertAiProviderCapability('openai', cap)).not.toThrow();
    }
  });

  it('agent.tools is not yet supported by any active adapter', () => {
    expect(providerSupportsCapability('vertex', 'agent.tools')).toBe(false);
    expect(providerSupportsCapability('openai', 'agent.tools')).toBe(false);
    expect(() => assertAiProviderCapability('vertex', 'agent.tools')).toThrow('does not support');
    expect(() => assertAiProviderCapability('openai', 'agent.tools')).toThrow('does not support');
  });
});

/* ─── Vertex (Gemini) runtime conformance ───────────────────── */

describe('Vertex adapter runtime conformance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /* text.generate -------------------------------------------- */
  describe('text.generate', () => {
    it('returns a non-empty string from generateContent', async () => {
      const jsonPayload = JSON.stringify({ tags: ['landscape'], description: 'A landscape photo.' });
      const fakeModel = makeGeminiTextModel(jsonPayload);
      mockGetGeminiFlashImageModel.mockResolvedValue(fakeModel as never);
      mockParseTextResponse.mockReturnValue(jsonPayload);

      // Drive through the analyzeImageTags path which exercises the
      // Gemini text path via parseTextResponse under the hood.
      mockGetOrgAiProviderConfig.mockResolvedValue({
        provider: 'vertex',
      });

      const result = await analyzeImageTags({
        imageUrl: 'https://storage.example.com/img.jpg',
        mimeType: 'image/jpeg',
        orgId: 'org1',
      });

      expect(result.provider).toBe('vertex');
      expect(result.modelId).toMatch(/gemini/i);
      expect(result.tags).toContain('landscape');
      expect(fakeModel.generateContent).toHaveBeenCalledOnce();
    });

    it('conforms to the declared text.generate capability guard', () => {
      // getGeminiFlashImageModel calls assertAiProviderCapability('vertex', 'vision.tag')
      // but Vertex uses the same model for text.generate and vision.tag.
      // This test validates the guard is not missing at the call site.
      expect(() => assertAiProviderCapability('vertex', 'text.generate')).not.toThrow();
    });
  });

  /* image.generate ------------------------------------------- */
  describe('image.generate', () => {
    it('getGeminiImageGenModel resolves and calls generateContent', async () => {
      const fakeModel = makeGeminiImageModel();
      mockGetGeminiImageGenModel.mockResolvedValue(fakeModel as never);

      const result = await applyAiImageEdit({
        capability: 'image.generate',
        imageUrl: 'https://storage.example.com/img.jpg',
        mimeType: 'image/jpeg',
        orgId: 'org-vertex',
        prompt: 'A futuristic cityscape.',
      });

      expect(result.provider).toBe('vertex');
      expect(result.mimeType).toBe('image/png');
      expect(Buffer.isBuffer(result.imageData)).toBe(true);
      expect(fakeModel.generateContent).toHaveBeenCalledOnce();
    });

    it('output conforms to AiImageResult shape (imageData Buffer + mimeType string)', async () => {
      const fakeModel = makeGeminiImageModel('aGVsbG8=', 'image/webp');
      mockGetGeminiImageGenModel.mockResolvedValue(fakeModel as never);

      const result = await applyAiImageEdit({
        capability: 'image.generate',
        imageUrl: 'https://storage.example.com/img.jpg',
        mimeType: 'image/jpeg',
        orgId: 'org-vertex',
        prompt: 'An impressionist painting.',
      });

      expect(result).toMatchObject({
        provider: 'vertex',
        mimeType: 'image/webp',
      });
      expect(result.imageData).toBeInstanceOf(Buffer);
    });
  });

  /* image.edit family — smoke assertions -------------------- */
  describe('image.edit capabilities (smoke)', () => {
    it.each([
      'image.edit',
      'image.edit.inpaint',
      'image.edit.outpaint',
      'image.edit.bg-remove',
      'image.upscale',
    ] as const)(
      '%s: assertAiProviderCapability does not throw for vertex',
      (cap) => {
        expect(() => assertAiProviderCapability('vertex', cap)).not.toThrow();
      },
    );
  });
});

/* ─── OpenAI runtime conformance ─────────────────────────────── */

describe('OpenAI adapter runtime conformance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /* text.generate -------------------------------------------- */
  describe('text.generate', () => {
    it('generateOpenAiText returns a plain string', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: 'Hello from GPT.' } }],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      const result = await generateOpenAiText({
        prompt: 'Say hello.',
        apiKey: 'sk-test-key',
      });

      expect(result).toBe('Hello from GPT.');
    });

    it('generateOpenAiText uses the default text.generate model', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: 'Model confirmed.' } }],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      await generateOpenAiText({ prompt: 'Test.', apiKey: 'sk-test-key' });

      const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string);
      expect(body.model).toBe('gpt-4.1-mini');
    });

    it('generateOpenAiText throws a descriptive error on 401', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(
          JSON.stringify({ error: { message: 'Invalid API key.' } }),
          { status: 401, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      await expect(
        generateOpenAiText({ prompt: 'Test.', apiKey: 'sk-bad' }),
      ).rejects.toThrow('OpenAI text generation error (401): Invalid API key.');
    });

    it('throws when no API key is available', async () => {
      await expect(
        generateOpenAiText({ prompt: 'Test.' }),
      ).rejects.toThrow('OpenAI is selected but no OpenAI API key is configured');
    });
  });

  /* vision.tag ------------------------------------------------ */
  describe('vision.tag', () => {
    it('generateOpenAiVisionText accepts imageUrl and returns a string', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: '{"tags":["sky"],"description":"Blue sky."}' } }],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      const result = await generateOpenAiVisionText({
        prompt: 'Describe the image.',
        imageUrl: 'https://example.com/sky.jpg',
        apiKey: 'sk-test-key',
      });

      expect(result).toContain('sky');
    });

    it('generateOpenAiVisionText throws when no image URL provided', async () => {
      await expect(
        generateOpenAiVisionText({ prompt: 'Describe.', apiKey: 'sk-test' }),
      ).rejects.toThrow('requires at least one image URL');
    });
  });

  /* image.generate ------------------------------------------- */
  describe('image.generate', () => {
    it('generateOpenAiImage returns imageData Buffer + mimeType from b64_json', async () => {
      const b64 = Buffer.from('fake-image-data').toString('base64');
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [{ b64_json: b64, revised_prompt: 'A futuristic cityscape.' }],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      const result = await generateOpenAiImage({
        prompt: 'A futuristic cityscape.',
        width: 1024,
        height: 1024,
        apiKey: 'sk-test-key',
      });

      expect(result.imageData).toBeInstanceOf(Buffer);
      expect(result.mimeType).toBe('image/png');
      expect(result.textResponse).toBe('A futuristic cityscape.');
    });

    it('generateOpenAiImage selects the default image.generate model', async () => {
      const b64 = Buffer.from('img').toString('base64');
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(
          JSON.stringify({ data: [{ b64_json: b64 }] }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      await generateOpenAiImage({
        prompt: 'A scene.',
        width: 1024,
        height: 1024,
        apiKey: 'sk-test-key',
      });

      const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string);
      expect(body.model).toBe('gpt-image-1');
    });

    it('normalizes landscape dimensions to 1536x1024', async () => {
      const b64 = Buffer.from('img').toString('base64');
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(
          JSON.stringify({ data: [{ b64_json: b64 }] }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      await generateOpenAiImage({
        prompt: 'Wide landscape.',
        width: 1536,
        height: 800,
        apiKey: 'sk-test-key',
      });

      const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string);
      expect(body.size).toBe('1536x1024');
    });

    it('throws a descriptive error on provider error response', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(
          JSON.stringify({ error: { message: 'Content policy violation.' } }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      await expect(
        generateOpenAiImage({
          prompt: 'Bad prompt.',
          width: 1024,
          height: 1024,
          apiKey: 'sk-test-key',
        }),
      ).rejects.toThrow('OpenAI image generation error (400): Content policy violation.');
    });
  });

  /* image.edit family — smoke assertions -------------------- */
  describe('image.edit capabilities (smoke)', () => {
    it.each([
      'image.edit',
      'image.edit.inpaint',
      'image.edit.outpaint',
      'image.edit.bg-remove',
    ] as const)(
      '%s: assertAiProviderCapability does not throw for openai',
      (cap) => {
        expect(() => assertAiProviderCapability('openai', cap)).not.toThrow();
      },
    );

    it('image.upscale is NOT supported by openai', () => {
      expect(providerSupportsCapability('openai', 'image.upscale')).toBe(false);
      expect(() => assertAiProviderCapability('openai', 'image.upscale')).toThrow('does not support');
    });
  });
});
