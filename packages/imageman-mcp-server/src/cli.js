#!/usr/bin/env node
/**
 * Minimal CLI entry for the ImageMan MCP server.
 *
 * `imageman-mcp list` prints the advertised tools as JSON. A full stdio
 * transport can be layered on top of {@link createMcpRegistry} without changing
 * the tool contract.
 */

import { listMcpTools } from './index.js';

const command = process.argv[2] ?? 'list';

if (command === 'list') {
  process.stdout.write(`${JSON.stringify(listMcpTools(), null, 2)}\n`);
} else {
  process.stderr.write(`unknown command: ${command}\n`);
  process.exitCode = 1;
}
