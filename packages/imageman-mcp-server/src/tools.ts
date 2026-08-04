// SPDX-License-Identifier: Apache-2.0
/**
 * img-man MCP server — public tool list (D50).
 *
 * The 5 canonical SDK tools (`asset.search`, `asset.get`, `asset.tag`,
 * `transform.url`, `ai.image.generate`) are imported by reference from
 * `@img-man/sdk` so they cannot drift. This file adds 3 more tools to round
 * out the v0.16.0 surface (D50 = "first 8"):
 *
 *   - imageman.asset.list        (read)
 *   - imageman.transform.bgRemove (write)
 *   - imageman.ai.image.edit      (write)
 *
 * The application's REST runtime at /api/v1/agent/tools/:name/invoke is the
 * one true execution path; this server is a thin stdio adapter.
 */

export interface JsonSchemaProperty {
  type: string | string[];
  description?: string;
  enum?: readonly (string | number | boolean | null)[];
  items?: JsonSchemaProperty;
  properties?: Record<string, JsonSchemaProperty>;
  required?: readonly string[];
  default?: unknown;
  minimum?: number;
  maximum?: number;
  format?: string;
}

export interface ToolDescriptor {
  name: string;
  description: string;
  effect: 'read' | 'write' | 'destructive';
  inputSchema: {
    type: 'object';
    properties: Record<string, JsonSchemaProperty>;
    required?: readonly string[];
    additionalProperties?: boolean;
  };
}

/** The 8 tools the MCP server advertises in D50. */
export const TOOLS: readonly ToolDescriptor[] = [
  {
    name: 'imageman.asset.search',
    description: 'Search assets by free-text query (semantic + tag fallback).',
    effect: 'read',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Free-text search query.' },
        limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
        folderId: { type: 'string' },
      },
      required: ['query'],
      additionalProperties: false,
    },
  },
  {
    name: 'imageman.asset.get',
    description: 'Fetch full metadata and a short-lived signed URL for one asset.',
    effect: 'read',
    inputSchema: {
      type: 'object',
      properties: { assetId: { type: 'string' } },
      required: ['assetId'],
      additionalProperties: false,
    },
  },
  {
    name: 'imageman.asset.list',
    description: 'List assets in a folder / by tag, paginated.',
    effect: 'read',
    inputSchema: {
      type: 'object',
      properties: {
        folderId: { type: 'string' },
        tag: { type: 'string' },
        cursor: { type: 'string' },
        limit: { type: 'integer', minimum: 1, maximum: 200, default: 50 },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'imageman.asset.tag',
    description: 'Add tags to an asset. Existing tags are preserved.',
    effect: 'write',
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
  },
  {
    name: 'imageman.transform.url',
    description: 'Build a deterministic, cacheable transform URL for an asset.',
    effect: 'read',
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
  },
  {
    name: 'imageman.transform.bgRemove',
    description: 'Background-remove an asset via the active AI provider; saves a new asset.',
    effect: 'write',
    inputSchema: {
      type: 'object',
      properties: {
        assetId: { type: 'string' },
        folderId: { type: 'string' },
      },
      required: ['assetId'],
      additionalProperties: false,
    },
  },
  {
    name: 'imageman.ai.image.generate',
    description: 'Generate a new image from a text prompt and save it to the org library.',
    effect: 'write',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string' },
        width: { type: 'integer', minimum: 64, maximum: 4096, default: 1024 },
        height: { type: 'integer', minimum: 64, maximum: 4096, default: 1024 },
        style: { type: 'string' },
        folderId: { type: 'string' },
      },
      required: ['prompt'],
      additionalProperties: false,
    },
  },
  {
    name: 'imageman.ai.image.edit',
    description: 'Edit an existing image (inpaint/outpaint/style) and save the result.',
    effect: 'write',
    inputSchema: {
      type: 'object',
      properties: {
        assetId: { type: 'string' },
        prompt: { type: 'string' },
        mode: { type: 'string', enum: ['inpaint', 'outpaint', 'style'] },
        maskAssetId: { type: 'string' },
      },
      required: ['assetId', 'prompt'],
      additionalProperties: false,
    },
  },
];
