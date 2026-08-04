// SPDX-License-Identifier: Apache-2.0
/**
 * POST /api/v1/assets/[id]/process — Trigger AI processing for an asset
 *
 * After uploading a file directly to GCS via a signed URL, call this endpoint
 * to trigger:
 * 1. Thumbnail generation (400px + 200px base64)
 * 2. Auto AI tagging (if org has auto_tag enabled)
 * 3. Face detection (if org has face_detect enabled)
 *
 * This is fire-and-forget — the endpoint returns immediately with a 202 Accepted.
 * Poll the asset later to see results, or configure a webhook URL on the org.
 *
 * Auth: API Key (write)
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { authenticateApiRequest, isErrorResponse, addCorsHeaders } from '@/lib/api-auth';
import { Asset, Organization, AiJob } from '@/models';
import { getSignedDownloadUrl, getGcsBucket } from '@/lib/storage';

interface RouteContext {
 params: Promise<{ id: string }>;
}

export async function OPTIONS(req: NextRequest) {
 const res = new NextResponse(null, { status: 204 });
 return addCorsHeaders(res, req.headers.get('origin'), []);
}

export async function POST(req: NextRequest, ctx: RouteContext) {
 const { id } = await ctx.params;
 const auth = await authenticateApiRequest(req, 'write');
 if (isErrorResponse(auth)) return auth;

 await connectToDatabase();

 const asset = await Asset.findOne({
 _id: id,
 orgId: auth.orgId,
 isDeleted: { $ne: true },
 });

 if (!asset) {
 const res = NextResponse.json(
 { error: 'Asset not found', code: 'NOT_FOUND' },
 { status: 404 },
 );
 return addCorsHeaders(res, req.headers.get('origin'), auth.allowedDomains);
 }

 // Only process images
 if (!asset.mimeType.startsWith('image/')) {
 const res = NextResponse.json(
 { error: 'Only image assets can be processed', code: 'INVALID_TYPE' },
 { status: 400 },
 );
 return addCorsHeaders(res, req.headers.get('origin'), auth.allowedDomains);
 }

 // Fire-and-forget: thumbnail generation + AI processing
 void processAsset(
 auth.orgId,
 String(asset._id),
 asset.storageKey,
 asset.mimeType,
 asset.width,
 asset.height,
 );

 const res = NextResponse.json(
 {
 message: 'Processing started',
 assetId: String(asset._id),
 processing: {
 thumbnails: true,
 autoTag: true,
 faceDetect: true,
 },
 },
 { status: 202 },
 );
 return addCorsHeaders(res, req.headers.get('origin'), auth.allowedDomains);
}

/**
 * Run all processing steps for an asset:
 * 1. Generate thumbnails (non-blocking)
 * 2. Auto-AI based on org config (non-blocking)
 * 3. Dispatch webhook on completion
 */
async function processAsset(
 orgId: string,
 assetId: string,
 storageKey: string,
 mimeType: string,
 width?: number,
 height?: number,
) {
 try {
 // Run thumbnail generation and AI in parallel
 await Promise.allSettled([
 generateThumbnails(assetId, storageKey, mimeType, orgId),
 autoAiOnUpload(orgId, assetId, storageKey, mimeType, width, height),
 ]);
 } catch (err) {
 console.error(`[Process] Failed to process asset ${assetId}:`, err);
 }
}

/**
 * Generate thumbnails for an asset.
 * - 400px WebP uploaded to GCS (thumbnailStorageKey)
 * - 200px WebP base64 saved inline in MongoDB (thumbnailBase64)
 */
async function generateThumbnails(
 assetId: string,
 storageKey: string,
 mimeType: string,
 orgId: string,
) {
 if (!mimeType.startsWith('image/')) return;

 try {
 const sharp = (await import('sharp')).default;
 const bucket = await getGcsBucket(orgId);

 const [originalBuffer] = await bucket.file(storageKey).download();

 const [thumbBuffer, inlineBuffer] = await Promise.all([
 sharp(originalBuffer)
 .resize(400, 400, { fit: 'inside', withoutEnlargement: true })
 .webp({ quality: 80 })
 .toBuffer(),
 sharp(originalBuffer)
 .resize(200, 200, { fit: 'inside', withoutEnlargement: true })
 .webp({ quality: 60 })
 .toBuffer(),
 ]);

 const thumbKey = `thumbnails/${storageKey.replace(/\.[^.]+$/, '')}.webp`;
 await bucket.file(thumbKey).save(thumbBuffer, {
 metadata: { contentType: 'image/webp' },
 });

 const base64 = `data:image/webp;base64,${inlineBuffer.toString('base64')}`;
 await Asset.updateOne(
 { _id: assetId },
 { $set: { thumbnailStorageKey: thumbKey, thumbnailBase64: base64 } },
 );

 console.log(`[Process] Thumbnail created for asset ${assetId}`);
 } catch (err) {
 console.error('[Process] Thumbnail generation failed (non-fatal):', err);
 }
}

/**
 * Auto-run AI features based on organization config.
 * Runs auto-tag and face detection if enabled.
 */
async function autoAiOnUpload(
 orgId: string,
 assetId: string,
 storageKey: string,
 mimeType: string,
 width?: number,
 height?: number,
) {
 try {
 const org = await Organization.findById(orgId)
 .select('aiFeatureConfig')
 .lean();
 if (!org) return;

 const config = (org as unknown as {
 aiFeatureConfig?: Map<string, { mode: string; minRole: number }> | Record<string, { mode: string; minRole: number }>;
 }).aiFeatureConfig;

 if (!config) return;

 const featureMap: Record<string, { mode: string; minRole: number }> =
 config instanceof Map ? Object.fromEntries(config) : config;

 const { analyzeImageTags, detectImageFaces } = await import('@/lib/ai-analysis');

 // ── Auto-tag ──────────────────────────────────────────────
 if (featureMap.auto_tag?.mode === 'auto') {
 try {
 const job = await AiJob.create({
 orgId,
 assetId,
 userId: `api-process:${orgId}`,
 type: 'auto_tag',
 status: 'processing',
 startedAt: new Date(),
 });

 const imageUrl = await getSignedDownloadUrl(storageKey, 60 * 10, undefined, orgId);
 const { parsed, tags } = await analyzeImageTags({
 imageUrl,
 mimeType,
 orgId,
 });

 await Asset.updateOne(
 { _id: assetId },
 {
 $set: {
 tags,
 originalAiTags: tags,
 aiTagsGenerated: true,
 },
 },
 );

 job.status = 'completed';
 job.result = parsed;
 job.completedAt = new Date();
 await job.save();

 console.log(`[Process] Auto-tagged asset ${assetId} with ${tags.length} tags`);
 } catch (err) {
 console.error('[Process] Auto-tag failed (non-fatal):', err);
 }
 }

 // ── Auto face-detect ──────────────────────────────────────
 if (featureMap.face_detect?.mode === 'auto') {
 try {
 const job = await AiJob.create({
 orgId,
 assetId,
 userId: `api-process:${orgId}`,
 type: 'face_detect',
 status: 'processing',
 startedAt: new Date(),
 });

 const imageUrl = await getSignedDownloadUrl(storageKey, 60 * 10, undefined, orgId);
 const { faces } = await detectImageFaces({
 imageUrl,
 imageHeight: height ?? 1000,
 imageWidth: width ?? 1000,
 mimeType,
 orgId,
 });

 await Asset.updateOne({ _id: assetId }, { $set: { faces } });

 job.status = 'completed';
 job.result = { facesDetected: faces.length, faces };
 job.completedAt = new Date();
 await job.save();

 console.log(`[Process] Face-detected asset ${assetId}: ${faces.length} faces`);
 } catch (err) {
 console.error('[Process] Face-detect failed (non-fatal):', err);
 }
 }
 } catch (err) {
 console.error('[Process] autoAiOnUpload failed (non-fatal):', err);
 }
}
