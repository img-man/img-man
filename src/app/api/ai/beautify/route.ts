// SPDX-License-Identifier: Apache-2.0
import { NextRequest, NextResponse } from 'next/server';
import { runAiJob } from '@/lib/ai-pipeline';
import { applyAiImageEdit } from '@/lib/ai-image-edits';
import { getSignedDownloadUrl, uploadBuffer } from '@/lib/storage';

/**
 * POST /api/ai/beautify
 * Body: { assetId: string, strength?: 'light' | 'medium' | 'strong' }
 *
 * Auto-enhance image using the active org AI provider.
 * Adjusts color balance, exposure, contrast, sharpness, and vibrance.
 * Stores the result as a variant.
 */
export async function POST(req: NextRequest) {
 try {
 const { assetId, strength = 'medium' } = await req.json();
 if (!assetId) {
 return NextResponse.json({ error: 'assetId required' }, { status: 400 });
 }

 const strengthMap: Record<string, string> = {
 light: 'Apply subtle, natural-looking enhancements. Make minimal adjustments to exposure, white balance, and sharpness. Keep the image very close to the original.',
 medium: 'Apply balanced photo enhancement. Improve exposure, white balance, contrast, and sharpness moderately. Boost colors naturally without oversaturation. The result should look professionally edited.',
 strong: 'Apply strong photo enhancement. Significantly improve exposure, contrast, color vibrance, and sharpness. Make colors pop and details crisp. The result should look magazine-quality.',
 };

 const enhanceInstructions = strengthMap[strength] ?? strengthMap.medium;

 const jobResult = await runAiJob(
 { type: 'beautify', assetId, input: { strength } },
 async ({ asset, orgId }) => {
 if (!asset) throw new Error('Asset not found');

 // 1. Get signed URL for the original image
 const imageUrl = await getSignedDownloadUrl(asset.storageKey, 60 * 10, undefined, orgId);

 // 2. Run provider-aware enhancement
 const imageResult = await applyAiImageEdit({
 capability: 'image.edit',
 height: asset.height,
 imageUrl,
 mimeType: asset.mimeType,
 orgId,
 prompt: `Enhance this photo. ${enhanceInstructions} Fix any color cast issues, correct underexposure or overexposure, and improve overall clarity. Preserve the original composition, subject, and mood. Do not crop, zoom, or add/remove any elements. Return the enhanced version of the exact same image.`,
 width: asset.width,
 });

 // 4. Upload variant to GCS
 const format = imageResult.mimeType === 'image/png' ? 'png' : 'webp';
 const variantKey = `variants/${orgId}/${asset._id}/beautified-${strength}.${format}`;
 await uploadBuffer(
 variantKey,
 imageResult.imageData,
 imageResult.mimeType,
 { source: 'ai-beautify', strength, originalAsset: asset._id.toString() },
 undefined,
 orgId,
 );

 // 5. Update asset variants
 const variantEntry = {
 key: `beautified-${strength}`,
 storageKey: variantKey,
 width: asset.width ?? 0,
 height: asset.height ?? 0,
 format,
 sizeBytes: imageResult.imageData.length,
 };

 // Remove old beautified variant with same strength if exists
 asset.variants = (asset.variants ?? []).filter(
 (v: { key: string }) => v.key !== `beautified-${strength}`,
 );
 asset.variants.push(variantEntry);
 await asset.save();

 return {
 variantKey,
 format,
 provider: imageResult.provider,
 modelId: imageResult.modelId,
 strength,
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
