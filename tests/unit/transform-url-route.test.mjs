import assert from 'node:assert/strict';
import test from 'node:test';

import { GET, parseTransformParams } from '../../src/app/api/transforms/url/route.js';

test('parseTransformParams parses ints and optional values from search params', () => {
  const params = parseTransformParams(
    new URLSearchParams({
      assetId: 'asset_123',
      width: '800',
      height: '600',
      format: 'webp',
      quality: '85',
      fit: 'contain',
      version: '2',
    }),
  );

  assert.deepEqual(params, {
    assetId: 'asset_123',
    width: 800,
    height: 600,
    format: 'webp',
    quality: 85,
    fit: 'contain',
    version: '2',
  });
});

test('transform URL route returns a stable url and cache key for valid params', async () => {
  const response = await GET(
    new Request(
      'http://localhost:3000/api/transforms/url?assetId=asset_123&width=800&height=600&format=webp&quality=85',
    ),
  );

  assert.equal(response.status, 200);

  const json = await response.json();
  assert.equal(json.ok, true);
  assert.match(json.url, /^http:\/\/localhost:3000\/t\/asset_123\/[a-f0-9]{8}\.webp$/);
  assert.match(json.cacheKey, /^[a-f0-9]{8}$/);
  assert.equal(json.params.width, 800);
  assert.equal(json.params.height, 600);
});

test('transform URL route returns 400 for invalid input', async () => {
  const response = await GET(
    new Request('http://localhost:3000/api/transforms/url?assetId=bad value&width=0'),
  );

  assert.equal(response.status, 400);

  const json = await response.json();
  assert.equal(json.ok, false);
  assert.match(json.error, /invalid|out of range/i);
});

test('transform URL route keeps png quality out of the cache key', async () => {
  const a = await GET(
    new Request('http://localhost:3000/api/transforms/url?assetId=asset_1&format=png&quality=50'),
  );
  const b = await GET(
    new Request('http://localhost:3000/api/transforms/url?assetId=asset_1&format=png&quality=90'),
  );

  const jsonA = await a.json();
  const jsonB = await b.json();

  assert.equal(jsonA.cacheKey, jsonB.cacheKey);
  assert.match(jsonA.url, /\.png$/);
});
