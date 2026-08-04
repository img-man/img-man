// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it, vi } from 'vitest';

import { createServer, TOOLS } from '../../../packages/imageman-mcp-server/src/index';

const baseConfig = (fetchImpl: typeof fetch) => ({
  baseUrl: 'https://example.test',
  apiKey: 'im_test_123',
  fetchImpl,
});

describe('mcp-server (D50)', () => {
  it('advertises 8 tools', () => {
    expect(TOOLS).toHaveLength(8);
    const names = TOOLS.map((t) => t.name).sort();
    expect(names).toEqual(
      [
        'imageman.ai.image.edit',
        'imageman.ai.image.generate',
        'imageman.asset.get',
        'imageman.asset.list',
        'imageman.asset.search',
        'imageman.asset.tag',
        'imageman.transform.bgRemove',
        'imageman.transform.url',
      ].sort(),
    );
  });

  it('responds to initialize with protocol info', async () => {
    const server = createServer(baseConfig(vi.fn() as unknown as typeof fetch));
    const res = await server.handleRequest({ jsonrpc: '2.0', id: 1, method: 'initialize' });
    expect(res?.result).toMatchObject({
      protocolVersion: expect.any(String),
      serverInfo: { name: 'imageman-mcp' },
      capabilities: { tools: {} },
    });
  });

  it('lists tools via tools/list', async () => {
    const server = createServer(baseConfig(vi.fn() as unknown as typeof fetch));
    const res = await server.handleRequest({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
    const result = res?.result as { tools: { name: string; inputSchema: unknown }[] };
    expect(result.tools).toHaveLength(8);
    expect(result.tools[0]).toHaveProperty('inputSchema');
  });

  it('forwards tools/call to the img-man agent endpoint with bearer auth', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ assets: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const server = createServer(baseConfig(fetchImpl as unknown as typeof fetch));
    const res = await server.handleRequest({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: { name: 'imageman.asset.search', arguments: { query: 'hi' } },
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(String(url)).toBe('https://example.test/api/v1/agent/tools/imageman.asset.search/invoke');
    expect((init as RequestInit).method).toBe('POST');
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers.authorization).toBe('Bearer im_test_123');
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      arguments: { query: 'hi' },
    });
    const result = res?.result as { content: { type: string; text: string }[]; isError: boolean };
    expect(result.isError).toBe(false);
    expect(JSON.parse(result.content[0].text)).toEqual({ assets: [] });
  });

  it('returns RPC error -32601 for unknown tool', async () => {
    const server = createServer(baseConfig(vi.fn() as unknown as typeof fetch));
    const res = await server.handleRequest({
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: { name: 'imageman.nope', arguments: {} },
    });
    expect(res?.error?.code).toBe(-32601);
  });

  it('returns RPC error when upstream tool call fails', async () => {
    const fetchImpl = vi.fn(async () => new Response('bad key', { status: 401 }));
    const server = createServer(baseConfig(fetchImpl as unknown as typeof fetch));
    const res = await server.handleRequest({
      jsonrpc: '2.0',
      id: 5,
      method: 'tools/call',
      params: { name: 'imageman.asset.get', arguments: { assetId: 'a' } },
    });
    expect(res?.error?.code).toBe(-32000);
    expect(res?.error?.message).toMatch(/401/);
  });

  it('ignores unknown notifications (no id)', async () => {
    const server = createServer(baseConfig(vi.fn() as unknown as typeof fetch));
    const res = await server.handleRequest({
      jsonrpc: '2.0',
      method: 'notifications/initialized',
    });
    expect(res).toBeNull();
  });
});
