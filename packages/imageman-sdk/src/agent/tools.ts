// SPDX-License-Identifier: Apache-2.0
/**
 * First five canonical img-man tools.
 *
 * Each tool maps to an existing public REST endpoint under /api/v1.
 * Runtime mapping (HTTP method, path, auth) lives in the application;
 * this file is contract-only.
 */

import type { ImgManTool } from './index';

/** imageman.asset.search — semantic + tag search across an org's assets. */
export const assetSearchTool: ImgManTool<
  { query: string; limit?: number; folderId?: string },
  { assets: { id: string; name: string; url: string; mimeType: string; tags: string[] }[] }
> = {
  name: 'imageman.asset.search',
  description: 'Search assets by free-text query (semantic + tag fallback).',
  longDescription:
    'Returns up to `limit` assets matching the query within the caller org. '
    + 'Uses vector embeddings if available, otherwise tag/name match. '
    + 'Read-only.',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Free-text search query.' },
      limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
      folderId: { type: 'string', description: 'Restrict to a folder id.' },
    },
    required: ['query'],
    additionalProperties: false,
  },
  outputSchema: {
    type: 'object',
    properties: {
      assets: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            url: { type: 'string', format: 'uri' },
            mimeType: { type: 'string' },
            tags: { type: 'array', items: { type: 'string' } },
          },
          required: ['id', 'name', 'url', 'mimeType', 'tags'],
        },
      },
    },
    required: ['assets'],
  },
  scopes: ['asset.read'],
  effect: 'read',
  examples: [
    {
      input: { query: 'happy dog on grass', limit: 5 },
    },
  ],
};

/** imageman.asset.get — fetch metadata + signed URL for one asset. */
export const assetGetTool: ImgManTool<
  { assetId: string },
  {
    id: string;
    name: string;
    url: string;
    mimeType: string;
    width: number;
    height: number;
    sizeBytes: number;
    tags: string[];
  }
> = {
  name: 'imageman.asset.get',
  description: 'Fetch full metadata and a short-lived signed URL for one asset.',
  inputSchema: {
    type: 'object',
    properties: { assetId: { type: 'string' } },
    required: ['assetId'],
    additionalProperties: false,
  },
  outputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      url: { type: 'string', format: 'uri' },
      mimeType: { type: 'string' },
      width: { type: 'integer' },
      height: { type: 'integer' },
      sizeBytes: { type: 'integer' },
      tags: { type: 'array', items: { type: 'string' } },
    },
    required: ['id', 'name', 'url', 'mimeType', 'width', 'height', 'sizeBytes', 'tags'],
  },
  scopes: ['asset.read'],
  effect: 'read',
};

/** imageman.asset.tag — apply tags to an asset (additive). */
export const assetTagTool: ImgManTool<
  { assetId: string; tags: string[] },
  { id: string; tags: string[] }
> = {
  name: 'imageman.asset.tag',
  description: 'Add tags to an asset. Existing tags are preserved.',
  inputSchema: {
    type: 'object',
    properties: {
      assetId: { type: 'string' },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Tags to add. Lower-cased and de-duped server-side.',
      },
    },
    required: ['assetId', 'tags'],
    additionalProperties: false,
  },
  outputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      tags: { type: 'array', items: { type: 'string' } },
    },
    required: ['id', 'tags'],
  },
  scopes: ['asset.write'],
  effect: 'write',
};

/** imageman.transform.url — build a deterministic transform URL. */
export const transformUrlTool: ImgManTool<
  {
    assetId: string;
    width?: number;
    height?: number;
    format?: 'webp' | 'jpeg' | 'png' | 'avif';
    quality?: number;
    fit?: 'cover' | 'contain' | 'fill';
  },
  { url: string; cacheKey: string }
> = {
  name: 'imageman.transform.url',
  description: 'Build a deterministic, cacheable transform URL for an asset.',
  inputSchema: {
    type: 'object',
    properties: {
      assetId: { type: 'string' },
      width: { type: 'integer', minimum: 1, maximum: 8192 },
      height: { type: 'integer', minimum: 1, maximum: 8192 },
      format: { type: 'string', enum: ['webp', 'jpeg', 'png', 'avif'] },
      quality: { type: 'integer', minimum: 1, maximum: 100 },
      fit: { type: 'string', enum: ['cover', 'contain', 'fill'] },
    },
    required: ['assetId'],
    additionalProperties: false,
  },
  outputSchema: {
    type: 'object',
    properties: {
      url: { type: 'string', format: 'uri' },
      cacheKey: { type: 'string' },
    },
    required: ['url', 'cacheKey'],
  },
  scopes: ['transform.read'],
  effect: 'read',
};

/** imageman.ai.image.generate — text-to-image through the active AI provider. */
export const aiImageGenerateTool: ImgManTool<
  {
    prompt: string;
    width?: number;
    height?: number;
    style?: string;
    folderId?: string;
  },
  { assetId: string; url: string }
> = {
  name: 'imageman.ai.image.generate',
  description: 'Generate a new image from a text prompt and save it to the org library.',
  longDescription:
    'Routes through the org-active AI provider (Vertex / OpenAI / etc.) using the '
    + 'capability registry. The resulting image is uploaded to the org storage '
    + 'provider and returned as a normal Asset. Costs credits.',
  inputSchema: {
    type: 'object',
    properties: {
      prompt: { type: 'string' },
      width: { type: 'integer', minimum: 64, maximum: 4096, default: 1024 },
      height: { type: 'integer', minimum: 64, maximum: 4096, default: 1024 },
      style: { type: 'string', description: 'photorealistic, illustration, icon, ...' },
      folderId: { type: 'string', description: 'Optional destination folder id.' },
    },
    required: ['prompt'],
    additionalProperties: false,
  },
  outputSchema: {
    type: 'object',
    properties: {
      assetId: { type: 'string' },
      url: { type: 'string', format: 'uri' },
    },
    required: ['assetId', 'url'],
  },
  scopes: ['ai.image.generate', 'asset.write'],
  effect: 'write',
};

/** Default registry contents. White-label editions can override/remove. */
export const DEFAULT_TOOLS = [
  assetSearchTool,
  assetGetTool,
  assetTagTool,
  transformUrlTool,
  aiImageGenerateTool,
] as const;
