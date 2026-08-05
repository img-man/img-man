// SPDX-License-Identifier: Apache-2.0
/**
 * Image Transformation API Route
 *
 * GET /api/transform/{orgSlug}/{transforms}/{...storageKey}
 *
 * Processes images on-the-fly with caching. Works like ImageKit/Cloudinary:
 * - Parses transform params from the URL
 * - Checks transform cache (GCS + MongoDB)
 * - On cache miss: fetches original → processes → caches → returns
 * - Sets aggressive cache headers for CDN
 */

import { NextResponse, type NextRequest } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { Organization, Asset, NamedTransform } from '@/models/index';
import { getGcsBucket } from '@/lib/storage';
import {
 parseTransforms,
 flattenSteps,
 hasTransforms,
 type TransformStep,
} from '@/lib/transforms/parser';
import {
 processImage,
 negotiateFormat,
 formatToMime,
} from '@/lib/transforms/processor';
import {
 generateCacheKey,
 getCachedTransform,
 readCachedBuffer,
 cacheTransform,
} from '@/lib/transforms/cache';

/* ─── Route Handler ──────────────────────────────────────────── */

export async function GET(
 req: NextRequest,
 { params }: { params: Promise<{ path: string[] }> },
) {
 try {
 const { path } = await params;

 // Minimum: orgSlug / transforms / at-least-one-key-segment
 if (!path || path.length < 3) {
 return NextResponse.json(
 {
 error: 'Invalid transform URL',
 usage: '/api/transform/{orgSlug}/{transforms}/{storageKey}',
 },
 { status: 400 },
 );
 }

 const orgSlug = decodeURIComponent(path[0]);
 const transformString = decodeURIComponent(path[1]);
 const storageKey = path
 .slice(2)
 .map(decodeURIComponent)
 .join('/');

 if (!orgSlug || !storageKey) {
 return NextResponse.json(
 { error: 'Missing orgSlug or storageKey' },
 { status: 400 },
 );
 }

 await connectToDatabase();

 /* ── Resolve Organization ────────────────────────────────── */
 const org = await Organization.findOne({ slug: orgSlug }).lean();
 if (!org) {
 return NextResponse.json(
 { error: 'Organization not found' },
 { status: 404 },
 );
 }

 /* ── Resolve Asset ───────────────────────────────────────── */
 const asset = await Asset.findOne({
 orgId: org._id,
 storageKey,
 isDeleted: false,
 }).lean();

 if (!asset) {
 return NextResponse.json(
 { error: 'Asset not found' },
 { status: 404 },
 );
 }

 /* ── Parse Transforms ────────────────────────────────────── */
 let config = parseTransforms(transformString);

 // Resolve named transforms
 const resolvedSteps: TransformStep[] = [];
 for (const step of config.steps) {
 if (step.named) {
 const named = await NamedTransform.findOne({
 orgId: org._id,
 name: step.named,
 }).lean();
 if (named) {
 const namedConfig = parseTransforms(named.transforms);
 resolvedSteps.push(...namedConfig.steps);
 }
 // Remove named key, keep any other params in this step
 const { named: _, ...rest } = step;
 if (Object.keys(rest).length > 0) resolvedSteps.push(rest);
 } else {
 resolvedSteps.push(step);
 }
 }
 config = { steps: resolvedSteps, raw: config.raw };

 /* ── If no transforms, redirect to original ──────────────── */
 if (!hasTransforms(config) || transformString === '_') {
 // Serve original directly from GCS
 return await serveFromGcs(storageKey, asset.mimeType, String(org._id));
 }

 /* ── Negotiate output format ─────────────────────────────── */
 const flat = flattenSteps(config);
 const acceptHeader = req.headers.get('accept') ?? '';
 const hasAlpha = asset.mimeType === 'image/png' || asset.mimeType === 'image/webp';
 const outputFormat = negotiateFormat(
 flat.format,
 acceptHeader,
 hasAlpha,
 );

 /* ── Check Cache ─────────────────────────────────────────── */
 const cacheKey = generateCacheKey(
 String(org._id),
 storageKey,
 `${transformString}:fmt-${outputFormat}`,
 );

 const cached = await getCachedTransform(cacheKey);
 if (cached) {
 const buffer = await readCachedBuffer(cached.storagePath);
 if (buffer) {
 console.log(
 `[Transform] Cache HIT: ${cacheKey.slice(0, 8)}… (${cached.sizeBytes} bytes)`,
 );
 return new NextResponse(new Uint8Array(buffer), {
 status: 200,
 headers: buildHeaders(outputFormat, cached.sizeBytes),
 });
 }
 // Cache record exists but GCS file gone — fall through to regenerate
 }

 /* ── Cache Miss: Fetch Original → Process → Cache ────────── */
 console.log(
 `[Transform] Cache MISS: ${cacheKey.slice(0, 8)}… — processing ${storageKey}`,
 );

 const originalBuffer = await downloadFromGcs(storageKey, String(org._id));
 if (!originalBuffer) {
 return NextResponse.json(
 { error: 'Failed to fetch original image from storage' },
 { status: 500 },
 );
 }

 const result = await processImage(
 originalBuffer,
 config.steps,
 outputFormat,
 flat.quality,
 );

 // Cache the result asynchronously (don't block response)
 cacheTransform({
 orgId: String(org._id),
 originalAssetId: String(asset._id),
 transformString: `${transformString}:fmt-${outputFormat}`,
 cacheKey,
 buffer: result.buffer,
 format: outputFormat,
 width: result.width,
 height: result.height,
 }).catch((err) => {
 console.error('[Transform] Cache write failed:', err);
 });

 return new NextResponse(new Uint8Array(result.buffer), {
 status: 200,
 headers: buildHeaders(outputFormat, result.sizeBytes),
 });
 } catch (err) {
 console.error('[Transform] Error:', err);
 return NextResponse.json(
 { error: 'Transform processing failed' },
 { status: 500 },
 );
 }
}

/* ─── Helpers ────────────────────────────────────────────────── */

function buildHeaders(
 format: string,
 sizeBytes: number,
): Record<string, string> {
 return {
 'Content-Type': formatToMime(format as 'jpeg' | 'png' | 'webp' | 'avif'),
 'Content-Length': String(sizeBytes),
 'Cache-Control': 'public, max-age=31536000, immutable',
 'X-ImgMan-Transform': 'processed',
 'X-ImgMan-Cache': 'miss',
 Vary: 'Accept',
 };
}

async function downloadFromGcs(storageKey: string, orgId: string): Promise<Buffer | null> {
 try {
 const [buffer] = await (await getGcsBucket(orgId)).file(storageKey).download();
 return buffer;
 } catch (err) {
 console.error('[Transform] GCS download failed:', err);
 return null;
 }
}

async function serveFromGcs(
 storageKey: string,
 mimeType: string,
 orgId: string,
): Promise<NextResponse> {
 const buffer = await downloadFromGcs(storageKey, orgId);
 if (!buffer) {
 return NextResponse.json(
 { error: 'Failed to fetch original' },
 { status: 500 },
 );
 }

 return new NextResponse(new Uint8Array(buffer), {
 status: 200,
 headers: {
 'Content-Type': mimeType,
 'Content-Length': String(buffer.length),
 'Cache-Control': 'public, max-age=31536000, immutable',
 'X-ImgMan-Transform': 'original',
 },
 });
}
