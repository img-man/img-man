// SPDX-License-Identifier: Apache-2.0
/**
 * Tool Registry contract smoke test (D54).
 *
 * The SDK in `@img-man/sdk` defines the canonical 5-tool subset
 * (`DEFAULT_TOOLS`). The MCP server in `@img-man/mcp-server` advertises a
 * superset of 8 tools. This test enforces the contract that:
 *
 *   1. Every SDK tool is present in the MCP server with the same `name`.
 *   2. The MCP server's input schema for each shared tool has the same
 *      `required` set as the SDK definition (param drift is the most common
 *      cause of agent failures).
 *   3. The MCP server only adds tools \u2014 it never *removes* one that the
 *      SDK promises will exist.
 */

import { describe, expect, it } from 'vitest';

import { DEFAULT_TOOLS } from '../../../packages/imageman-sdk/src/agent/tools';
import { TOOLS as MCP_TOOLS } from '../../../packages/imageman-mcp-server/src/tools';

describe('Tool Registry contract (D54 \u2014 SDK \u2194 MCP)', () => {
  it('MCP advertises every SDK tool', () => {
    const mcpNames = new Set(MCP_TOOLS.map((t) => t.name));
    for (const sdkTool of DEFAULT_TOOLS) {
      expect(
        mcpNames.has(sdkTool.name),
        `MCP server is missing SDK tool ${sdkTool.name}`,
      ).toBe(true);
    }
  });

  it('shared tools agree on required input parameters', () => {
    for (const sdkTool of DEFAULT_TOOLS) {
      const mcpTool = MCP_TOOLS.find((t) => t.name === sdkTool.name);
      if (!mcpTool) continue;
      const sdkRequired = [...(sdkTool.inputSchema.required ?? [])].sort();
      const mcpRequired = [...(mcpTool.inputSchema.required ?? [])].sort();
      expect(mcpRequired, `required-param drift in ${sdkTool.name}`).toEqual(sdkRequired);
    }
  });

  it('MCP only adds tools (never removes one the SDK promises)', () => {
    const sdkNames = new Set(DEFAULT_TOOLS.map((t) => t.name));
    const removed = [...sdkNames].filter((n) => !MCP_TOOLS.some((t) => t.name === n));
    expect(removed).toEqual([]);
  });

  it('every MCP tool declares an inputSchema and a description', () => {
    for (const t of MCP_TOOLS) {
      expect(t.description, `${t.name} missing description`).toBeTruthy();
      expect(t.inputSchema, `${t.name} missing inputSchema`).toBeTruthy();
      expect(t.inputSchema.type).toBe('object');
    }
  });
});
