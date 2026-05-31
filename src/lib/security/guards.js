/**
 * Security helpers for the ImageMan community core. Pure, dependency-free
 * utilities used across the request boundary.
 */

/**
 * Constant-time string comparison to avoid leaking length/position via timing.
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
export function constantTimeEquals(a, b) {
  const sa = String(a);
  const sb = String(b);
  let mismatch = sa.length ^ sb.length;
  const max = Math.max(sa.length, sb.length);
  for (let i = 0; i < max; i += 1) {
    mismatch |= (sa.charCodeAt(i) || 0) ^ (sb.charCodeAt(i) || 0);
  }
  return mismatch === 0;
}

/**
 * Extract a bearer token from an Authorization header value.
 * @param {string|null|undefined} headerValue
 * @returns {string|null}
 */
export function parseBearerToken(headerValue) {
  if (typeof headerValue !== 'string') return null;
  const match = /^Bearer\s+(\S+)$/i.exec(headerValue.trim());
  return match ? match[1] : null;
}

const SECRET_KEYS = /(pass(word)?|secret|token|api[_-]?key|authorization|cookie)/i;

/**
 * Recursively redact secret-looking values from an object for safe logging.
 * @param {unknown} value
 * @param {{ mask?: string }} [opts]
 * @returns {unknown}
 */
export function redactSecrets(value, opts = {}) {
  const mask = opts.mask ?? '[redacted]';
  if (Array.isArray(value)) {
    return value.map((v) => redactSecrets(v, opts));
  }
  if (value && typeof value === 'object') {
    /** @type {Record<string, unknown>} */
    const out = {};
    for (const [key, val] of Object.entries(value)) {
      out[key] = SECRET_KEYS.test(key) ? mask : redactSecrets(val, opts);
    }
    return out;
  }
  return value;
}

/**
 * Validate a public asset identifier (URL-safe, bounded length).
 * @param {unknown} assetId
 * @returns {string}
 */
export function assertSafeAssetId(assetId) {
  if (typeof assetId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(assetId)) {
    throw new Error(`invalid asset id: ${String(assetId)}`);
  }
  return assetId;
}
