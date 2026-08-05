// SPDX-License-Identifier: Apache-2.0
/**
 * GET /i/:id — Public asset renderer
 *
 * This endpoint is the canonical, img-man-domain URL for an asset. It is
 * deliberately lightweight: when no transform parameters are present we issue
 * a 302 redirect to a freshly signed GCS URL so the heavy lifting (bytes) is
 * served directly by the bucket / CDN — not by our app server.
 *
 * When transform query params are present (w, h, format, q, fit) we stream a
 * resized variant through sharp.
 *
 * Security model:
 * - Public assets keep the old behaviour: the stable img-man URL can be
 *   shared and fast-redirects to a short-lived signed storage URL.
 * - Private assets require an authenticated user from the same organization
 *   and are streamed through the app so the raw storage URL is not exposed.
 *
 * Query params:
 *   w       Target width  (px, optional)
 *   h       Target height (px, optional)
 *   format  jpeg | png | webp | avif (optional)
 *   q       Quality 1-100 (default 85)
 *   fit     sharp fit mode (default 'inside')
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { getSession } from '@/lib/session';
import { Asset, User } from '@/models';
import { getSignedDownloadUrl } from '@/lib/storage';
import {
  recordAssetAccess,
  buildTransformKey,
  hashIp,
  trimReferer,
  type AssetAccessRecord,
} from '@/lib/asset-analytics';

interface RouteContext {
  params: Promise<{ id: string }>;
}

const ALLOWED_FORMATS = new Set(['jpeg', 'jpg', 'png', 'webp', 'avif']);
const ALLOWED_FITS = new Set(['cover', 'contain', 'fill', 'inside', 'outside']);
const MAX_DIMENSION = 4096;
const MAX_BLUR = 100;
const MAX_ROTATION = 360;

function parsePositiveInt(value: string | null, max: number): number {
  if (!value) return 0;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(Math.round(n), max);
}

function normalizeAssetSourceUrl(req: NextRequest, sourceUrl: string) {
  const resolvedUrl = new URL(sourceUrl, req.nextUrl.origin);

  return resolvedUrl.pathname === '/api/storage/download'
    ? new URL(
        `${resolvedUrl.pathname}${resolvedUrl.search}`,
        req.nextUrl.origin,
      ).toString()
    : resolvedUrl.toString();
}

async function getSignedAssetUrl(
  req: NextRequest,
  storageKey: string,
  orgId: string,
  expiresInSeconds: number,
) {
  const sourceUrl = await getSignedDownloadUrl(
    storageKey,
    expiresInSeconds,
    undefined,
    orgId,
  );

  return normalizeAssetSourceUrl(req, sourceUrl);
}

async function resolvePublicAssetRedirectUrl(
  req: NextRequest,
  asset: {
    storageKey: string;
    thumbnailStorageKey?: string | null;
    orgId: unknown;
  },
) {
  const orgId = String(asset.orgId);
  const primaryUrl = await getSignedAssetUrl(req, asset.storageKey, orgId, 60 * 60);

  if (!asset.thumbnailStorageKey) {
    return primaryUrl;
  }

  try {
    const probe = await fetch(primaryUrl, {
      method: 'HEAD',
      cache: 'no-store',
      redirect: 'follow',
    });

    if (probe.status === 404) {
      return getSignedAssetUrl(req, asset.thumbnailStorageKey, orgId, 60 * 60);
    }
  } catch (error) {
    console.warn('[/i/:id] failed to probe public asset URL, using primary URL:', error);
  }

  return primaryUrl;
}

async function loadAssetBuffer(
  req: NextRequest,
  asset: {
    storageKey: string;
    thumbnailStorageKey?: string | null;
    mimeType: string;
    orgId: unknown;
  },
) {
  async function fetchObjectBuffer(storageKey: string, fallbackMimeType: string) {
    const absoluteUrl = await getSignedAssetUrl(
      req,
      storageKey,
      String(asset.orgId),
      10 * 60,
    );

    const upstream = await fetch(absoluteUrl, {
      cache: 'no-store',
      redirect: 'follow',
    });

    if (!upstream.ok) {
      const error = new Error(`Failed to fetch asset bytes (${upstream.status})`);
      (error as Error & { status?: number }).status = upstream.status;
      throw error;
    }

    return {
      buffer: Buffer.from(await upstream.arrayBuffer()),
      mimeType: upstream.headers.get('content-type') || fallbackMimeType,
    };
  }

  try {
    return await fetchObjectBuffer(asset.storageKey, asset.mimeType);
  } catch (error) {
    const status = (error as Error & { status?: number }).status;
    if (status !== 404 || !asset.thumbnailStorageKey) {
      throw error;
    }

    return fetchObjectBuffer(asset.thumbnailStorageKey, 'image/webp');
  }
}

export async function GET(req: NextRequest, ctx: RouteContext) {
  const startedAt = Date.now();
  const { id } = await ctx.params;
  const { searchParams } = req.nextUrl;

  await connectToDatabase();
  const asset = await Asset.findOne({
    _id: id,
    isDeleted: { $ne: true },
  })
    .select('storageKey thumbnailStorageKey mimeType orgId originalName isPublic')
    .lean();

  if (!asset) {
    return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
  }

  // ─── Analytics helpers (no-op when org has not opted in) ────────
  const refererHeader = req.headers.get('referer');
  const xff = req.headers.get('x-forwarded-for');
  const ip = (xff?.split(',')[0]?.trim()) || req.headers.get('x-real-ip') || null;
  const country = req.headers.get('x-vercel-ip-country') || req.headers.get('cf-ipcountry') || null;
  const city = req.headers.get('x-vercel-ip-city') || null;
  const region = req.headers.get('x-vercel-ip-country-region') || null;
  const ua = req.headers.get('user-agent');

  const trackAccess = (record: Omit<AssetAccessRecord, 'country' | 'city' | 'region' | 'referer' | 'userAgent' | 'ipHash' | 'latencyMs'> & { transformKey?: string | null }) => {
    void recordAssetAccess({
      assetId: id,
      orgId: String(asset.orgId),
      record: {
        ...record,
        country,
        city,
        region,
        referer: trimReferer(refererHeader),
        userAgent: ua ? ua.slice(0, 200) : null,
        ipHash: hashIp(ip),
        latencyMs: Date.now() - startedAt,
      },
    });
  };

  const isPublicAsset = asset.isPublic !== false;

  if (!isPublicAsset) {
    const session = await getSession();
    if (!session?.user?.email) {
      const signInUrl = new URL('/signin', req.nextUrl.origin);
      signInUrl.searchParams.set('callbackUrl', req.nextUrl.href);
      return NextResponse.redirect(signInUrl, 302);
    }

    const user = await User.findOne({ email: session.user.email })
      .select('orgId')
      .lean();

    if (!user?.orgId || String(user.orgId) !== String(asset.orgId)) {
      trackAccess({ status: 404, failed: true, transformKey: 'forbidden' });
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }
  }

  const w = parsePositiveInt(searchParams.get('w'), MAX_DIMENSION);
  const h = parsePositiveInt(searchParams.get('h'), MAX_DIMENSION);
  const formatParam = (searchParams.get('format') || '').toLowerCase();
  const format = ALLOWED_FORMATS.has(formatParam) ? formatParam : '';
  const fitParam = (searchParams.get('fit') || '').toLowerCase();
  const fit = ALLOWED_FITS.has(fitParam) ? fitParam : 'inside';
  const q = parsePositiveInt(searchParams.get('q'), 100) || 85;
  const blur = parsePositiveInt(searchParams.get('blur'), MAX_BLUR);
  const rotation = parsePositiveInt(searchParams.get('rotation'), MAX_ROTATION);
  const grayscale = ['1', 'true', 'yes', 'on'].includes(
    (searchParams.get('grayscale') || '').toLowerCase(),
  );

  const hasTransform =
    (w > 0 ||
      h > 0 ||
      format ||
      blur > 0 ||
      rotation > 0 ||
      grayscale) &&
    asset.mimeType.startsWith('image/');

  const transformKey = buildTransformKey({
    w: w || null,
    h: h || null,
    format: format || null,
    fit: hasTransform ? fit : null,
    q: hasTransform ? q : null,
    blur: blur || null,
    rotation: rotation || null,
    grayscale: grayscale || null,
  });

  // ─── Fast path: no transform → 302 to signed GCS URL ─────────
  if (isPublicAsset && !hasTransform) {
    const signedUrl = await resolvePublicAssetRedirectUrl(req, asset);
    const res = NextResponse.redirect(signedUrl, 302);
    // Short cache so repeated hits are cheap, but signed URL stays fresh.
    res.headers.set('Cache-Control', 'public, max-age=300, s-maxage=300');
    trackAccess({ status: 302, failed: false, transformKey });
    return res;
  }

  // ─── Protected / transformed path: fetch bytes via signed or proxied URL ──
  let source;
  try {
    source = await loadAssetBuffer(req, asset);
  } catch (error) {
    console.error('[/i/:id] failed to load asset bytes:', error);
    trackAccess({ status: 502, failed: true, transformKey });
    return NextResponse.json({ error: 'Failed to load asset' }, { status: 502 });
  }

  let outBuffer: Uint8Array = source.buffer;
  let outMime = source.mimeType;

  if (hasTransform) {
    try {
      const sharp = (await import('sharp')).default;
      let pipeline = sharp(source.buffer);

      if (w > 0 || h > 0) {
        pipeline = pipeline.resize(w || null, h || null, {
          fit: fit as 'cover' | 'contain' | 'fill' | 'inside' | 'outside',
          withoutEnlargement: true,
        });
      }

      if (rotation > 0) {
        pipeline = pipeline.rotate(rotation);
      }

      if (blur > 0) {
        pipeline = pipeline.blur(Math.max(blur, 0.3));
      }

      if (grayscale) {
        pipeline = pipeline.grayscale();
      }

      const targetFormat = format || '';
      if (targetFormat === 'webp') {
        pipeline = pipeline.webp({ quality: q });
        outMime = 'image/webp';
      } else if (targetFormat === 'png') {
        pipeline = pipeline.png();
        outMime = 'image/png';
      } else if (targetFormat === 'avif') {
        pipeline = pipeline.avif({ quality: q });
        outMime = 'image/avif';
      } else if (targetFormat === 'jpeg' || targetFormat === 'jpg') {
        pipeline = pipeline.jpeg({ quality: q });
        outMime = 'image/jpeg';
      }

      outBuffer = await pipeline.toBuffer();
    } catch (err) {
      console.error('[/i/:id] transform failed, returning original:', err);
    }
  }

  trackAccess({
    status: 200,
    failed: false,
    transformKey,
    bytesServed: outBuffer.byteLength,
  });

  return new NextResponse(new Uint8Array(outBuffer), {
    headers: {
      'Content-Type': outMime,
      'Content-Length': String(outBuffer.byteLength),
      'Cache-Control': isPublicAsset
        ? 'public, max-age=3600, s-maxage=3600'
        : 'private, no-store, max-age=0',
      ...(isPublicAsset ? {} : { Vary: 'Cookie, Authorization' }),
    },
  });
}
