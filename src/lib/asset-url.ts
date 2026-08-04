// SPDX-License-Identifier: Apache-2.0
/**
 * Asset URL helpers — build ImageMan-domain public URLs for assets so that we
 * never expose raw GCS signed URLs to end users. The public URL fast-redirects
 * to a freshly signed GCS URL (or, when transform params are present, streams
 * a resized variant) via the `/i/[id]` route.
 */

export interface AssetTransformOptions {
  /** Target width in px (preserves aspect ratio with `fit: inside`). */
  w?: number;
  /** Target height in px. */
  h?: number;
  /** Output format. */
  format?: 'jpeg' | 'jpg' | 'png' | 'webp' | 'avif';
  /** Encoder quality 1-100 (default 85). */
  q?: number;
  /** Fit mode forwarded to sharp. */
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
  /** Blur intensity forwarded to sharp. */
  blur?: number;
  /** Rotation in degrees. */
  rotation?: number;
  /** Toggle grayscale output. */
  grayscale?: boolean;
}

function getAppBaseUrl(): string {
  const configuredBase = (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXTAUTH_URL ??
    ''
  ).replace(/\/$/, '');

  if (!configuredBase) {
    return '';
  }

  try {
    const parsed = new URL(configuredBase);
    const hostname = parsed.hostname.toLowerCase();

    // Local dev can run on a different port than the stale env value. Keep
    // asset URLs same-origin so CSP img-src 'self' still works.
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '[::1]' ||
      hostname === '::1'
    ) {
      return '';
    }
  } catch {
    return configuredBase;
  }

  return configuredBase;
}

/**
 * Build a stable, ImageMan-domain URL for an asset. Optionally pass transform
 * options that the renderer route will apply on the fly.
 *
 *   getPublicAssetUrl('abc123')
 *     -> https://app.imageman.io/i/abc123
 *   getPublicAssetUrl('abc123', { w: 400, format: 'webp' })
 *     -> https://app.imageman.io/i/abc123?w=400&format=webp
 */
export function getPublicAssetUrl(
  assetId: string,
  opts?: AssetTransformOptions,
): string {
  const base = getAppBaseUrl();
  const path = `/i/${encodeURIComponent(assetId)}`;
  const params = new URLSearchParams();

  if (opts?.w && Number.isFinite(opts.w) && opts.w > 0) {
    params.set('w', String(Math.round(opts.w)));
  }
  if (opts?.h && Number.isFinite(opts.h) && opts.h > 0) {
    params.set('h', String(Math.round(opts.h)));
  }
  if (opts?.format) {
    params.set('format', opts.format);
  }
  if (opts?.q && Number.isFinite(opts.q) && opts.q > 0 && opts.q <= 100) {
    params.set('q', String(Math.round(opts.q)));
  }
  if (opts?.fit) {
    params.set('fit', opts.fit);
  }
  if (opts?.blur && Number.isFinite(opts.blur) && opts.blur > 0) {
    params.set('blur', String(Math.round(opts.blur)));
  }
  if (
    opts?.rotation != null &&
    Number.isFinite(opts.rotation) &&
    opts.rotation >= 0
  ) {
    params.set('rotation', String(Math.round(opts.rotation)));
  }
  if (opts?.grayscale) {
    params.set('grayscale', '1');
  }

  const qs = params.toString();
  const fullPath = qs ? `${path}?${qs}` : path;
  return base ? `${base}${fullPath}` : fullPath;
}
