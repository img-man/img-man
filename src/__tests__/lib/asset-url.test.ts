// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, beforeEach } from 'vitest';
import { getPublicAssetUrl } from '@/lib/asset-url';

describe('getPublicAssetUrl', () => {
  beforeEach(() => {
    // Clear env so base URL comes from env or defaults to empty
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.NEXTAUTH_URL;
  });

  it('builds a basic URL without opts', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.imageman.io';
    const url = getPublicAssetUrl('abc123');
    expect(url).toBe('https://app.imageman.io/i/abc123');
  });

  it('returns a relative path when no base URL is set', () => {
    const url = getPublicAssetUrl('abc123');
    expect(url).toBe('/i/abc123');
  });

  it('returns a relative path when NEXT_PUBLIC_APP_URL points at localhost', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
    const url = getPublicAssetUrl('abc123');
    expect(url).toBe('/i/abc123');
  });

  it('returns a relative path when NEXTAUTH_URL points at 127.0.0.1', () => {
    process.env.NEXTAUTH_URL = 'http://127.0.0.1:3000';
    const url = getPublicAssetUrl('abc123');
    expect(url).toBe('/i/abc123');
  });

  it('URL-encodes the assetId', () => {
    const url = getPublicAssetUrl('asset with spaces');
    expect(url).toContain('asset%20with%20spaces');
  });

  it('appends width param', () => {
    const url = getPublicAssetUrl('img1', { w: 400 });
    expect(url).toContain('w=400');
  });

  it('appends height param', () => {
    const url = getPublicAssetUrl('img1', { h: 300 });
    expect(url).toContain('h=300');
  });

  it('rounds fractional width/height', () => {
    const url = getPublicAssetUrl('img1', { w: 400.7, h: 300.2 });
    expect(url).toContain('w=401');
    expect(url).toContain('h=300');
  });

  it('appends format param', () => {
    const url = getPublicAssetUrl('img1', { format: 'webp' });
    expect(url).toContain('format=webp');
  });

  it('appends quality param', () => {
    const url = getPublicAssetUrl('img1', { q: 80 });
    expect(url).toContain('q=80');
  });

  it('appends fit param', () => {
    const url = getPublicAssetUrl('img1', { fit: 'contain' });
    expect(url).toContain('fit=contain');
  });

  it('appends blur, rotation, and grayscale params', () => {
    const url = getPublicAssetUrl('img1', {
      blur: 12,
      rotation: 90,
      grayscale: true,
    });
    expect(url).toContain('blur=12');
    expect(url).toContain('rotation=90');
    expect(url).toContain('grayscale=1');
  });

  it('appends multiple params', () => {
    const url = getPublicAssetUrl('img1', { w: 640, h: 480, format: 'jpeg', q: 90, fit: 'cover' });
    expect(url).toContain('w=640');
    expect(url).toContain('h=480');
    expect(url).toContain('format=jpeg');
    expect(url).toContain('q=90');
    expect(url).toContain('fit=cover');
  });

  it('does not append w when zero or negative', () => {
    expect(getPublicAssetUrl('img1', { w: 0 })).not.toContain('w=');
    expect(getPublicAssetUrl('img1', { w: -1 })).not.toContain('w=');
  });

  it('does not append h when zero or negative', () => {
    expect(getPublicAssetUrl('img1', { h: 0 })).not.toContain('h=');
    expect(getPublicAssetUrl('img1', { h: -100 })).not.toContain('h=');
  });

  it('does not append q when out of 1-100 range', () => {
    expect(getPublicAssetUrl('img1', { q: 0 })).not.toContain('q=');
    expect(getPublicAssetUrl('img1', { q: 101 })).not.toContain('q=');
  });

  it('does not append blur when zero or negative', () => {
    expect(getPublicAssetUrl('img1', { blur: 0 })).not.toContain('blur=');
    expect(getPublicAssetUrl('img1', { blur: -5 })).not.toContain('blur=');
  });

  it('strips trailing slash from base URL', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.imageman.io/';
    const url = getPublicAssetUrl('img1');
    expect(url).not.toContain('//i/');
    expect(url).toBe('https://app.imageman.io/i/img1');
  });

  it('falls back to NEXTAUTH_URL when NEXT_PUBLIC_APP_URL not set', () => {
    process.env.NEXTAUTH_URL = 'https://fallback.example.com';
    const url = getPublicAssetUrl('img1');
    expect(url).toContain('fallback.example.com');
  });

  it('NEXT_PUBLIC_APP_URL takes precedence over NEXTAUTH_URL', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://primary.example.com';
    process.env.NEXTAUTH_URL = 'https://fallback.example.com';
    const url = getPublicAssetUrl('img1');
    expect(url).toContain('primary.example.com');
    expect(url).not.toContain('fallback.example.com');
  });

  it('does not append ? when no opts given', () => {
    const url = getPublicAssetUrl('img1');
    expect(url).not.toContain('?');
  });

  it('all valid fit modes are accepted', () => {
    const fits = ['cover', 'contain', 'fill', 'inside', 'outside'] as const;
    for (const fit of fits) {
      const url = getPublicAssetUrl('img1', { fit });
      expect(url, `fit=${fit} should appear in URL`).toContain(`fit=${fit}`);
    }
  });
});
