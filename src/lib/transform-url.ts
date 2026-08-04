// SPDX-License-Identifier: Apache-2.0
/**
 * Deterministic transform URL builder (D51).
 *
 * Goals:
 *   - Same params => same URL, byte for byte. The CDN/cache key is the URL itself.
 *   - Stable across runs and processes (no ordering randomness, no timestamps).
 *   - Cheap to compute server-side and on the SDK.
 *
 * URL shape:
 *   `${baseUrl}/t/${assetId}/${cacheKey}.${ext}`
 *
 * `cacheKey` is a short, deterministic hash of the canonicalized params so it
 * collides only when two requests would actually produce identical bytes.
 */

export type TransformFormat = 'webp' | 'jpeg' | 'png' | 'avif';
export type TransformFit = 'cover' | 'contain' | 'fill';

export interface TransformParams {
  assetId: string;
  width?: number;
  height?: number;
  format?: TransformFormat;
  /** 1\u2013100. Ignored for `png`. */
  quality?: number;
  fit?: TransformFit;
  /** Optional version stamp \u2014 bump to force a CDN re-fetch. */
  version?: number | string;
}

export interface TransformUrl {
  url: string;
  /** Deterministic, opaque cache key embedded in the URL path. */
  cacheKey: string;
}

const DEFAULTS = {
  format: 'webp' as TransformFormat,
  quality: 85,
  fit: 'cover' as TransformFit,
};

/**
 * Build a deterministic transform URL.
 * Throws on missing/invalid `assetId` or out-of-range numeric params.
 */
export function buildTransformUrl(
  params: TransformParams,
  options: { baseUrl?: string } = {},
): TransformUrl {
  const baseUrl = (options.baseUrl ?? '').replace(/\/+$/, '');
  if (!params.assetId || typeof params.assetId !== 'string') {
    throw new Error('buildTransformUrl: assetId is required');
  }
  if (!/^[A-Za-z0-9_-]+$/.test(params.assetId)) {
    throw new Error('buildTransformUrl: assetId contains invalid characters');
  }

  const canonical = canonicalizeParams(params);
  const cacheKey = hashCacheKey(canonical);
  const ext = canonical.format ?? DEFAULTS.format;
  const url = `${baseUrl}/t/${params.assetId}/${cacheKey}.${ext}`;
  return { url, cacheKey };
}

interface CanonicalParams {
  width?: number;
  height?: number;
  format?: TransformFormat;
  quality?: number;
  fit?: TransformFit;
  version?: string;
}

function canonicalizeParams(params: TransformParams): CanonicalParams {
  const out: CanonicalParams = {};

  if (params.width !== undefined) {
    if (!Number.isInteger(params.width) || params.width < 1 || params.width > 8192) {
      throw new Error('buildTransformUrl: width out of range');
    }
    out.width = params.width;
  }
  if (params.height !== undefined) {
    if (!Number.isInteger(params.height) || params.height < 1 || params.height > 8192) {
      throw new Error('buildTransformUrl: height out of range');
    }
    out.height = params.height;
  }
  if (params.format !== undefined) {
    if (!isFormat(params.format)) {
      throw new Error(`buildTransformUrl: unknown format ${params.format}`);
    }
    out.format = params.format;
  } else {
    out.format = DEFAULTS.format;
  }
  if (params.quality !== undefined) {
    if (!Number.isInteger(params.quality) || params.quality < 1 || params.quality > 100) {
      throw new Error('buildTransformUrl: quality out of range');
    }
    // PNG ignores quality; drop it so two requests that only differ by quality
    // for a PNG share a cache key.
    if (out.format !== 'png') out.quality = params.quality;
  } else if (out.format !== 'png') {
    out.quality = DEFAULTS.quality;
  }
  if (params.fit !== undefined) {
    if (!isFit(params.fit)) {
      throw new Error(`buildTransformUrl: unknown fit ${params.fit}`);
    }
    out.fit = params.fit;
  } else if (out.width !== undefined || out.height !== undefined) {
    out.fit = DEFAULTS.fit;
  }
  if (params.version !== undefined) {
    out.version = String(params.version);
  }

  return out;
}

function isFormat(v: string): v is TransformFormat {
  return v === 'webp' || v === 'jpeg' || v === 'png' || v === 'avif';
}
function isFit(v: string): v is TransformFit {
  return v === 'cover' || v === 'contain' || v === 'fill';
}

/**
 * Stable, dependency-free 32-bit FNV-1a over the canonical key. Returned as
 * 8 lowercase hex chars. Not cryptographic \u2014 only a cache key.
 */
function hashCacheKey(canon: CanonicalParams): string {
  const keys = Object.keys(canon).sort() as (keyof CanonicalParams)[];
  const parts: string[] = [];
  for (const k of keys) {
    const v = canon[k];
    if (v === undefined) continue;
    parts.push(`${k}=${v}`);
  }
  const input = parts.join('&');
  let hash = 0x811c9dc5; // FNV offset basis
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  // Force unsigned then hex-pad.
  return (hash >>> 0).toString(16).padStart(8, '0');
}
