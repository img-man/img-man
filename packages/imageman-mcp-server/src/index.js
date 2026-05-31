/**
 * ImageMan MCP server (community edition).
 *
 * Builds a tool registry of safe, read-oriented tools that an MCP host can call.
 * The transport layer (stdio/http) is intentionally decoupled: this module only
 * assembles the toolset so it can be unit-tested without a running host.
 */

import { createToolRegistry } from '../../../src/lib/agent/tool-registry.js';
import { buildTransformUrl } from '../../../src/lib/transform-url.js';
import { normalizeTagLabel, createNullVisionProvider } from '../../../src/lib/ai/provider.js';

/**
 * Create the community MCP tool registry.
 * @param {{ baseUrl?: string }} [options]
 */
export function createMcpRegistry(options = {}) {
  const baseUrl = options.baseUrl ?? 'http://localhost:3000';
  const vision = createNullVisionProvider();
  const registry = createToolRegistry();

  registry.register({
    name: 'build-transform-url',
    description: 'Build a deterministic CDN transform URL for an asset.',
    input: {
      assetId: { type: 'string', required: true },
      width: { type: 'number' },
      height: { type: 'number' },
      format: { type: 'string' },
      quality: { type: 'number' },
      fit: { type: 'string' },
    },
    async handler(args) {
      const { url } = buildTransformUrl(args, { baseUrl });
      return url;
    },
  });

  registry.register({
    name: 'suggest-tags',
    description: 'Suggest normalized tags for an asset from its filename/alt text.',
    input: {
      filename: { type: 'string' },
      altText: { type: 'string' },
    },
    async handler(args) {
      const tags = await vision.tagImage(args);
      return tags.map((t) => normalizeTagLabel(t.label));
    },
  });

  return registry;
}

/**
 * List the tools advertised by the community MCP server.
 * @param {{ baseUrl?: string }} [options]
 */
export function listMcpTools(options = {}) {
  return createMcpRegistry(options).list();
}
