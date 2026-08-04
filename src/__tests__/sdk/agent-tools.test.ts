// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TOOLS,
  ToolRegistry,
  aiImageGenerateTool,
  assetGetTool,
  assetSearchTool,
  assetTagTool,
  transformUrlTool,
} from '@img-man/sdk';

describe('Agent Tool Registry contract', () => {
  it('ships exactly the five canonical tools as the default set', () => {
    expect(DEFAULT_TOOLS.map((t) => t.name)).toEqual([
      'imageman.asset.search',
      'imageman.asset.get',
      'imageman.asset.tag',
      'imageman.transform.url',
      'imageman.ai.image.generate',
    ]);
  });

  it('every tool has a namespaced name, scopes and effect class', () => {
    for (const tool of DEFAULT_TOOLS) {
      expect(tool.name.startsWith('imageman.')).toBe(true);
      expect(tool.scopes.length).toBeGreaterThan(0);
      expect(['read', 'write', 'destructive']).toContain(tool.effect);
      expect(tool.inputSchema.type).toBe('object');
      expect(tool.outputSchema.type).toBe('object');
    }
  });

  it('write-class tools require an asset.write or ai.* scope', () => {
    const writers = DEFAULT_TOOLS.filter((t) => t.effect !== 'read');
    for (const tool of writers) {
      const hasWriteScope = tool.scopes.some(
        (s) => s.endsWith('.write') || s.startsWith('ai.'),
      );
      expect(hasWriteScope, `tool ${tool.name} missing write scope`).toBe(true);
    }
  });

  it('input schemas declare their required fields', () => {
    expect(assetSearchTool.inputSchema.required).toContain('query');
    expect(assetGetTool.inputSchema.required).toContain('assetId');
    expect(assetTagTool.inputSchema.required).toEqual(['assetId', 'tags']);
    expect(transformUrlTool.inputSchema.required).toContain('assetId');
    expect(aiImageGenerateTool.inputSchema.required).toContain('prompt');
  });
});

describe('ToolRegistry behaviour', () => {
  it('register / get / list / remove', () => {
    const reg = new ToolRegistry();
    reg.register(assetSearchTool);
    expect(reg.list()).toHaveLength(1);
    expect(reg.get('imageman.asset.search')).toBe(assetSearchTool);
    expect(reg.remove('imageman.asset.search')).toBe(true);
    expect(reg.list()).toHaveLength(0);
  });

  it('throws on duplicate register and accepts override()', () => {
    const reg = new ToolRegistry([assetSearchTool]);
    expect(() => reg.register(assetSearchTool)).toThrow(/already registered/);

    const replacement = { ...assetSearchTool, description: 'overridden' };
    reg.override(replacement);
    expect(reg.get('imageman.asset.search')?.description).toBe('overridden');
  });

  it('forSurface filters by tool surface declarations', () => {
    const reg = new ToolRegistry([
      { ...assetGetTool, surfaces: ['mcp', 'api'] },
      { ...assetTagTool, surfaces: ['agent-ui'] },
      { ...transformUrlTool /* no surfaces -> available everywhere */ },
    ]);

    expect(reg.forSurface('mcp').map((t) => t.name)).toEqual([
      'imageman.asset.get',
      'imageman.transform.url',
    ]);
    expect(reg.forSurface('agent-ui').map((t) => t.name)).toEqual([
      'imageman.asset.tag',
      'imageman.transform.url',
    ]);
    expect(reg.forSurface('api').map((t) => t.name)).toEqual([
      'imageman.asset.get',
      'imageman.transform.url',
    ]);
  });
});
