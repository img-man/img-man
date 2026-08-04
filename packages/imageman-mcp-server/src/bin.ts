#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
/**
 * img-man MCP stdio entrypoint.
 *
 * Reads line-delimited JSON-RPC requests from stdin, writes responses to
 * stdout. Logs to stderr only.
 */

import * as readline from 'node:readline';

import { createServer, type JsonRpcRequest } from './index.js';

function fail(msg: string): never {
  process.stderr.write(`[imageman-mcp] ${msg}\n`);
  process.exit(1);
}

const baseUrl = process.env.IMGMAN_BASE_URL;
const apiKey = process.env.IMGMAN_API_KEY;
if (!baseUrl) fail('IMGMAN_BASE_URL env var is required');
if (!apiKey) fail('IMGMAN_API_KEY env var is required');

const server = createServer({ baseUrl: baseUrl!, apiKey: apiKey! });

const rl = readline.createInterface({ input: process.stdin });

rl.on('line', (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  let req: JsonRpcRequest;
  try {
    req = JSON.parse(trimmed) as JsonRpcRequest;
  } catch {
    process.stderr.write(`[imageman-mcp] failed to parse line: ${trimmed.slice(0, 200)}\n`);
    return;
  }
  void server.handleRequest(req).then((res) => {
    if (res) process.stdout.write(`${JSON.stringify(res)}\n`);
  });
});

rl.on('close', () => process.exit(0));

process.stderr.write(`[imageman-mcp] connected to ${baseUrl}\n`);
