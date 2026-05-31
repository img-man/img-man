/**
 * Deterministic transform URL builder.
 * Same params => same URL. The URL itself is the cache key surface.
 */

const DEFAULTS = {
  format: 'webp',
  quality: 85,
  fit: 'cover',
};

const VALID_FORMATS = new Set(['webp', 'jpeg', 'png', 'avif']);
const VALID_FITS = new Set(['cover', 'contain', 'fill']);

/**
 * @typedef {'webp'|'jpeg'|'png'|'avif'} TransformFormat
 * @typedef {'cover'|'contain'|'fill'} TransformFit
 *
 * @typedef {Object} TransformParams
 * @property {string} assetId
 * @property {number=} width
 * @property {number=} height
 * @property {TransformFormat=} format
 * @property {number=} quality
 * @property {TransformFit=} fit
 * @property {number|string=} version
 */

/**
 * @param {TransformParams} params
 * @param {{ baseUrl?: string }} [options]
 */
export function buildTransformUrl(params, options = {}) {
  const baseUrl = String(options.baseUrl ?? '').replace(/\/+$/, '');

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

/**
 * @param {TransformParams} params
 */
function canonicalizeParams(params) {
  const out = {};

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
    if (!VALID_FORMATS.has(params.format)) {
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
    if (out.format !== 'png') {
      out.quality = params.quality;
    }
  } else if (out.format !== 'png') {
    out.quality = DEFAULTS.quality;
  }

  if (params.fit !== undefined) {
    if (!VALID_FITS.has(params.fit)) {
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

function hashCacheKey(canonical) {
  const keys = Object.keys(canonical).sort();
  const parts = [];

  for (const key of keys) {
    const value = canonical[key];
    if (value === undefined) {
      continue;
    }

    parts.push(`${key}=${value}`);
  }

  const input = parts.join('&');
  let hash = 0x811c9dc5;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(16).padStart(8, '0');
}
