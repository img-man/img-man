// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';

import { buildTransformUrl } from '@/lib/transform-url';

describe('buildTransformUrl (D51)', () => {
  it('produces identical URLs for identical params (deterministic)', () => {
    const a = buildTransformUrl(
      { assetId: 'asset_123', width: 800, height: 600, format: 'webp', quality: 85 },
      { baseUrl: 'https://cdn.example' },
    );
    const b = buildTransformUrl(
      { assetId: 'asset_123', height: 600, width: 800, quality: 85, format: 'webp' },
      { baseUrl: 'https://cdn.example' },
    );
    expect(a.url).toBe(b.url);
    expect(a.cacheKey).toBe(b.cacheKey);
  });

  it('changes the cache key when a meaningful param changes', () => {
    const a = buildTransformUrl({ assetId: 'a', width: 800 });
    const b = buildTransformUrl({ assetId: 'a', width: 801 });
    expect(a.cacheKey).not.toBe(b.cacheKey);
  });

  it('treats PNG quality as a no-op (same cache key for any quality on png)', () => {
    const a = buildTransformUrl({ assetId: 'a', format: 'png', quality: 50 });
    const b = buildTransformUrl({ assetId: 'a', format: 'png', quality: 90 });
    expect(a.cacheKey).toBe(b.cacheKey);
    expect(a.url.endsWith('.png')).toBe(true);
  });

  it('encodes the format as the file extension', () => {
    expect(buildTransformUrl({ assetId: 'a', format: 'avif' }).url.endsWith('.avif')).toBe(true);
    expect(buildTransformUrl({ assetId: 'a' }).url.endsWith('.webp')).toBe(true); // default
  });

  it('places the cacheKey under /t/{assetId}/', () => {
    const { url, cacheKey } = buildTransformUrl(
      { assetId: 'asset_xyz', width: 200 },
      { baseUrl: 'https://cdn.example/' },
    );
    expect(url).toBe(`https://cdn.example/t/asset_xyz/${cacheKey}.webp`);
  });

  it('rejects invalid assetId, width, format, fit, quality', () => {
    expect(() => buildTransformUrl({ assetId: '' })).toThrow();
    expect(() => buildTransformUrl({ assetId: 'has space' })).toThrow();
    expect(() => buildTransformUrl({ assetId: 'a', width: 0 })).toThrow();
    expect(() => buildTransformUrl({ assetId: 'a', width: 9999 })).toThrow();
    // @ts-expect-error testing runtime guard
    expect(() => buildTransformUrl({ assetId: 'a', format: 'gif' })).toThrow();
    // @ts-expect-error testing runtime guard
    expect(() => buildTransformUrl({ assetId: 'a', fit: 'inside' })).toThrow();
    expect(() => buildTransformUrl({ assetId: 'a', quality: 101 })).toThrow();
  });

  it('version param invalidates cache', () => {
    const a = buildTransformUrl({ assetId: 'a', width: 100 });
    const b = buildTransformUrl({ assetId: 'a', width: 100, version: 2 });
    expect(a.cacheKey).not.toBe(b.cacheKey);
  });
});
