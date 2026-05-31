import { test } from 'node:test';
import assert from 'node:assert/strict';

import * as sdk from '../../packages/imageman-sdk/src/index.js';
import { createMcpRegistry, listMcpTools } from '../../packages/imageman-mcp-server/src/index.js';

test('sdk barrel re-exports edition contracts', () => {
  assert.ok(Array.isArray(sdk.IMAGE_MAN_EDITIONS));
  assert.equal(typeof sdk.createCommunityEntitlements, 'function');
  assert.equal(typeof sdk.normalizeEntitlements, 'function');
  assert.equal(typeof sdk.isCommunityEdition, 'function');
  assert.ok(sdk.DEFAULT_FEATURE_FLAGS);
});

test('mcp registry advertises expected tools', () => {
  const names = listMcpTools().map((t) => t.name).sort();
  assert.deepEqual(names, ['build-transform-url', 'suggest-tags']);
});

test('mcp build-transform-url tool works', async () => {
  const r = createMcpRegistry({ baseUrl: 'https://cdn.example.com' });
  const url = await r.invoke('build-transform-url', { assetId: 'abc', width: 100, format: 'webp' });
  assert.ok(url.startsWith('https://cdn.example.com/t/abc/'));
});

test('mcp suggest-tags tool works', async () => {
  const r = createMcpRegistry();
  const tags = await r.invoke('suggest-tags', { filename: 'red-car.png' });
  assert.ok(tags.includes('red'));
  assert.ok(tags.includes('car'));
});
