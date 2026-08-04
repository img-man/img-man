// SPDX-License-Identifier: Apache-2.0
import { NextRequest, NextResponse } from 'next/server';
import { runAiJob } from '@/lib/ai-pipeline';
import { applyAiImageEdit } from '@/lib/ai-image-edits';
import { getSignedDownloadUrl, uploadBuffer } from '@/lib/storage';

/**
 * POST /api/ai/bg-remove
 * Body: { assetId: string }
 *
 * Removes image background using Gemini 2.5 Flash Image.
 * Stores the result as a PNG variant with transparency.
 */
export async function POST(req: NextRequest) {
 try {
 const { assetId } = await req.json();
 if (!assetId) {
 return NextResponse.json({ error: 'assetId required' }, { status: 400 });
 }

 const jobResult = await runAiJob(
 { type: 'bg_remove', assetId },
 async ({ asset, orgId }) => {
 if (!asset) throw new Error('Asset not found');

 // 1. Get signed URL for the original image
 const imageUrl = await getSignedDownloadUrl(asset.storageKey, 60 * 10, undefined, orgId);

 // 2. Run provider-aware background removal
 const imageResult = await applyAiImageEdit({
 capability: 'image.edit.bg-remove',
 imageUrl,
 mimeType: asset.mimeType,
 orgId,
 prompt:
 'Remove the background from this image completely. Return a PNG with full transparency where the background was. Keep the main subject intact with clean, precise edges. Do not add any new elements.',
 width: asset.width,
 height: asset.height,
 });

 // 4. Upload variant to GCS
 const variantKey = `variants/${orgId}/${asset._id}/bg-removed.png`;
 await uploadBuffer(
 variantKey,
 imageResult.imageData,
 'image/png',
 { source: 'ai-bg-remove', originalAsset: asset._id.toString() },
 undefined,
 orgId,
 );

 // 5. Update asset variants
 const variantEntry = {
 key: 'bg-removed',
 storageKey: variantKey,
 width: asset.width ?? 0,
 height: asset.height ?? 0,
 format: 'png',
 sizeBytes: imageResult.imageData.length,
 };

 // Remove old bg-removed variant if exists, then add new one
 asset.variants = (asset.variants ?? []).filter(
 (v: { key: string }) => v.key !== 'bg-removed',
 );
 asset.variants.push(variantEntry);
 await asset.save();

 return {
 variantKey,
 format: 'png',
 provider: imageResult.provider,
 modelId: imageResult.modelId,
 sizeBytes: imageResult.imageData.length,
 };
 },
 );

 const status = jobResult.status === 'completed' ? 200 : 500;
 return NextResponse.json(jobResult, { status });
 } catch (err: unknown) {
 const status = (err as { status?: number }).status ?? 500;
 const message = err instanceof Error ? err.message : String(err);
 return NextResponse.json({ error: message }, { status });
 }
}
