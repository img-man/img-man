import assert from 'node:assert/strict';
import test from 'node:test';

import { buildTransformUrl } from '../../src/lib/transform-url.js';

test('buildTransformUrl is deterministic for the same params', () => {
  const a = buildTransformUrl(
    { assetId: 'asset_123', width: 800, height: 600, format: 'webp', quality: 85 },
    { baseUrl: 'https://cdn.example' },
  );
  const b = buildTransformUrl(
    { assetId: 'asset_123', height: 600, width: 800, quality: 85, format: 'webp' },
    { baseUrl: 'https://cdn.example' },
  );

  assert.equal(a.url, b.url);
  assert.equal(a.cacheKey, b.cacheKey);
});

test('buildTransformUrl changes the cache key when meaningful params change', () => {
  const a = buildTransformUrl({ assetId: 'a', width: 800 });
  const b = buildTransformUrl({ assetId: 'a', width: 801 });

  assert.notEqual(a.cacheKey, b.cacheKey);
});

test('buildTransformUrl treats PNG quality as a no-op', () => {
  const a = buildTransformUrl({ assetId: 'a', format: 'png', quality: 50 });
  const b = buildTransformUrl({ assetId: 'a', format: 'png', quality: 90 });

  assert.equal(a.cacheKey, b.cacheKey);
  assert.match(a.url, /\.png$/);
});

test('buildTransformUrl encodes the format as the file extension', () => {
  assert.match(buildTransformUrl({ assetId: 'a', format: 'avif' }).url, /\.avif$/);
  assert.match(buildTransformUrl({ assetId: 'a' }).url, /\.webp$/);
});

test('buildTransformUrl places the cache key under /t/{assetId}/', () => {
  const { url, cacheKey } = buildTransformUrl(
    { assetId: 'asset_xyz', width: 200 },
    { baseUrl: 'https://cdn.example/' },
  );

  assert.equal(url, `https://cdn.example/t/asset_xyz/${cacheKey}.webp`);
});

test('buildTransformUrl rejects invalid assetId, width, format, fit, and quality', () => {
  assert.throws(() => buildTransformUrl({ assetId: '' }));
  assert.throws(() => buildTransformUrl({ assetId: 'has space' }));
  assert.throws(() => buildTransformUrl({ assetId: 'a', width: 0 }));
  assert.throws(() => buildTransformUrl({ assetId: 'a', width: 9999 }));
  assert.throws(() => buildTransformUrl({ assetId: 'a', format: 'gif' }));
  assert.throws(() => buildTransformUrl({ assetId: 'a', fit: 'inside' }));
  assert.throws(() => buildTransformUrl({ assetId: 'a', quality: 101 }));
});

test('buildTransformUrl version invalidates the cache key', () => {
  const a = buildTransformUrl({ assetId: 'a', width: 100 });
  const b = buildTransformUrl({ assetId: 'a', width: 100, version: 2 });

  assert.notEqual(a.cacheKey, b.cacheKey);
});

test('buildTransformUrl applies default cover fit only when dimensions are provided', () => {
  const withDimensions = buildTransformUrl({ assetId: 'a', width: 100, height: 200 });
  const withoutDimensions = buildTransformUrl({ assetId: 'a' });

  assert.notEqual(withDimensions.cacheKey, withoutDimensions.cacheKey);
});
