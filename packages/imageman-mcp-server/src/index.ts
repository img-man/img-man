// SPDX-License-Identifier: Apache-2.0
/**
 * img-man MCP server (D50) — minimal JSON-RPC 2.0 over stdio.
 *
 * Implements just enough of the Model Context Protocol surface to advertise
 * the 8 img-man tools and forward `tools/call` invocations to a running
 * img-man instance via its public agent endpoint.
 *
 * The transport is **line-delimited JSON-RPC** (one message per line). MCP
 * clients that prefer the LSP-style `Content-Length:` framing can wrap this
 * binary; the framing-agnostic core is `handleRequest`.
 *
 * Logging uses **stderr only** so it cannot corrupt the stdio channel.
 */

import { TOOLS, type ToolDescriptor } from './tools.js';

export interface ImgManClientConfig {
  baseUrl: string;
  apiKey: string;
  /** Override fetch for testing. */
  fetchImpl?: typeof fetch;
}

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: number | string | null;
  method: string;
  params?: unknown;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number | string | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

const SERVER_INFO = {
  name: 'imageman-mcp',
  version: '0.1.0',
};

const PROTOCOL_VERSION = '2024-11-05';

/** Build an MCP-server handler bound to a given img-man instance. */
export function createServer(config: ImgManClientConfig) {
  const fetchImpl = config.fetchImpl ?? globalThis.fetch;
  if (!config.baseUrl) throw new Error('IMGMAN_BASE_URL is required');
  if (!config.apiKey) throw new Error('IMGMAN_API_KEY is required');
  if (!fetchImpl) throw new Error('No fetch implementation available');

  const baseUrl = config.baseUrl.replace(/\/+$/, '');

  async function callTool(name: string, args: unknown): Promise<unknown> {
    const tool = TOOLS.find((t) => t.name === name);
    if (!tool) throw rpcError(-32601, `Unknown tool: ${name}`);
    const res = await fetchImpl(`${baseUrl}/api/v1/agent/tools/${encodeURIComponent(name)}/invoke`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({ arguments: args ?? {} }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw rpcError(-32000, `img-man tool error ${res.status}: ${text || res.statusText}`);
    }
    return res.json();
  }

  async function handleRequest(req: JsonRpcRequest): Promise<JsonRpcResponse | null> {
    if (req.jsonrpc !== '2.0' || typeof req.method !== 'string') {
      return errorResponse(req.id ?? null, -32600, 'Invalid Request');
    }
    // Notifications (no id) get no response.
    const id = req.id ?? null;

    try {
      switch (req.method) {
        case 'initialize':
          return ok(id, {
            protocolVersion: PROTOCOL_VERSION,
            capabilities: { tools: {} },
            serverInfo: SERVER_INFO,
          });

        case 'initialized':
        case 'notifications/initialized':
          return req.id == null ? null : ok(id, {});

        case 'tools/list':
          return ok(id, { tools: TOOLS.map(toMcpTool) });

        case 'tools/call': {
          const params = (req.params ?? {}) as { name?: string; arguments?: unknown };
          if (!params.name) throw rpcError(-32602, 'Missing tool name');
          const result = await callTool(params.name, params.arguments);
          return ok(id, {
            content: [{ type: 'text', text: JSON.stringify(result) }],
            isError: false,
          });
        }

        case 'ping':
          return ok(id, {});

        default:
          if (req.id == null) return null; // unknown notification — ignore
          return errorResponse(id, -32601, `Method not found: ${req.method}`);
      }
    } catch (err) {
      const e = asRpcError(err);
      return errorResponse(id, e.code, e.message, e.data);
    }
  }

  return { handleRequest, callTool };
}

function toMcpTool(t: ToolDescriptor) {
  return {
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
  };
}

function ok(id: number | string | null, result: unknown): JsonRpcResponse {
  return { jsonrpc: '2.0', id, result };
}

function errorResponse(
  id: number | string | null,
  code: number,
  message: string,
  data?: unknown,
): JsonRpcResponse {
  return { jsonrpc: '2.0', id, error: { code, message, ...(data !== undefined ? { data } : {}) } };
}

interface RpcError {
  code: number;
  message: string;
  data?: unknown;
}
function rpcError(code: number, message: string, data?: unknown): RpcError & Error {
  const e = new Error(message) as RpcError & Error;
  e.code = code;
  if (data !== undefined) e.data = data;
  return e;
}
function asRpcError(err: unknown): RpcError {
  if (err && typeof err === 'object' && 'code' in err && 'message' in err) {
    return err as RpcError;
  }
  return { code: -32603, message: err instanceof Error ? err.message : 'Internal error' };
}

export { TOOLS };
