// SPDX-License-Identifier: Apache-2.0
import { NextRequest, NextResponse } from 'next/server';
import { runAiJob } from '@/lib/ai-pipeline';
import { applyAiImageEdit } from '@/lib/ai-image-edits';
import { getSignedDownloadUrl, uploadBuffer } from '@/lib/storage';

/**
 * POST /api/ai/remove-object
 * Body: {
 * assetId: string,
 * description: string, — Natural language description of what to remove
 * maskBase64?: string, — Optional: base64 mask image (white = area to remove)
 * }
 *
 * Uses Gemini 2.5 Flash Image to inpaint/remove objects from the image.
 * Stores the result as a variant.
 */
export async function POST(req: NextRequest) {
 try {
 const { assetId, description, maskBase64 } = await req.json();
 if (!assetId) {
 return NextResponse.json({ error: 'assetId required' }, { status: 400 });
 }
 if (!description) {
 return NextResponse.json(
 { error: 'description required — describe what to remove' },
 { status: 400 },
 );
 }

 const jobResult = await runAiJob(
 { type: 'remove_object', assetId, input: { description, hasMask: !!maskBase64 } },
 async ({ asset, orgId }) => {
 if (!asset) throw new Error('Asset not found');

 // 1. Get signed URL for the original image
 const imageUrl = await getSignedDownloadUrl(asset.storageKey, 60 * 10, undefined, orgId);

 // 2. Build the provider-aware inpaint request
 const base64Data = maskBase64
 ? maskBase64.replace(/^data:image\/\w+;base64,/, '')
 : undefined;
 const mimeMatch = maskBase64?.match(/^data:(image\/\w+);base64,/);
 const maskMime = mimeMatch ? mimeMatch[1] : 'image/png';
 const editPrompt = maskBase64
 ? `The second image is a mask where white areas indicate regions to remove. Remove "${description}" from the first image by inpainting the masked area. Fill the removed area with a natural continuation of the surrounding background. The result should look seamless and photorealistic. Do not alter any other parts of the image.`
 : `Remove "${description}" from this image. Replace the removed area with a natural continuation of the surrounding background or scenery. The result should look seamless and photorealistic, as if the object was never there. Do not alter any other parts of the image. Keep the same resolution and aspect ratio.`;

 const imageResult = await applyAiImageEdit({
 capability: 'image.edit.inpaint',
 height: asset.height,
 imageUrl,
 maskBase64: base64Data,
 maskMimeType: maskMime,
 mimeType: asset.mimeType,
 orgId,
 prompt: editPrompt,
 width: asset.width,
 });

 // 4. Upload variant to GCS
 const format = imageResult.mimeType === 'image/png' ? 'png' : 'webp';
 const safeDesc = description.replace(/[^a-z0-9]/gi, '-').slice(0, 30).toLowerCase();
 const variantKey = `variants/${orgId}/${asset._id}/removed-${safeDesc}.${format}`;
 await uploadBuffer(
 variantKey,
 imageResult.imageData,
 imageResult.mimeType,
 { source: 'ai-remove-object', description, originalAsset: asset._id.toString() },
 undefined,
 orgId,
 );

 // 5. Update asset variants
 const variantKeyName = `removed-${safeDesc}`;
 const variantEntry = {
 key: variantKeyName,
 storageKey: variantKey,
 width: asset.width ?? 0,
 height: asset.height ?? 0,
 format,
 sizeBytes: imageResult.imageData.length,
 };

 // Remove old variant with same key if exists
 asset.variants = (asset.variants ?? []).filter(
 (v: { key: string }) => v.key !== variantKeyName,
 );
 asset.variants.push(variantEntry);
 await asset.save();

 return {
 variantKey,
 variantKeyName,
 format,
 description,
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
