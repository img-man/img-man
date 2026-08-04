// SPDX-License-Identifier: Apache-2.0
import { NextRequest, NextResponse } from 'next/server';
import { runAiJob } from '@/lib/ai-pipeline';
import { applyAiImageEdit } from '@/lib/ai-image-edits';
import { getSignedDownloadUrl, uploadBuffer } from '@/lib/storage';

/**
 * POST /api/ai/upscale
 * Body: { assetId, scaleFactor: 2 | 4 }
 *
 * AI-powered image upscaling with detail enhancement.
 * Uses Gemini to intelligently increase resolution while preserving
 * detail and reducing noise.
 */
export async function POST(req: NextRequest) {
 try {
 const body = await req.json();
 const { assetId, scaleFactor = 2 } = body;

 if (!assetId) {
 return NextResponse.json({ error: 'assetId required' }, { status: 400 });
 }

 if (![2, 4].includes(scaleFactor)) {
 return NextResponse.json(
 { error: 'scaleFactor must be 2 or 4' },
 { status: 400 },
 );
 }

 const jobResult = await runAiJob(
 {
 type: 'upscale',
 assetId,
 input: { scaleFactor },
 },
 async ({ asset, orgId }) => {
 if (!asset) throw new Error('Asset not found');

 const origW = asset.width ?? 1000;
 const origH = asset.height ?? 1000;
 const targetW = origW * scaleFactor;
 const targetH = origH * scaleFactor;

 // Safety check — prevent absurdly large outputs
 if (targetW > 16384 || targetH > 16384) {
 throw new Error(
 `Upscaled dimensions ${targetW}x${targetH} exceed maximum of 16384px`,
 );
 }

 // 1. Get signed URL
 const imageUrl = await getSignedDownloadUrl(asset.storageKey, 60 * 10, undefined, orgId);

 // 2. Build prompt
 const upscalePrompt = [
 `Upscale this ${origW}x${origH} image to ${targetW}x${targetH} pixels (${scaleFactor}x).`,
 'Enhance fine details, textures, and edges while upscaling.',
 'Remove any noise or compression artifacts.',
 'Maintain the original color palette and artistic intent.',
 'The result should look like a native high-resolution capture, not an interpolated resize.',
 'Return the full upscaled image.',
 ].join(' ');

 // 3. Run provider-aware upscale (with Vertex fallback when needed)
 const imageResult = await applyAiImageEdit({
 capability: 'image.upscale',
 height: targetH,
 imageUrl,
 mimeType: asset.mimeType,
 orgId,
 prompt: upscalePrompt,
 width: targetW,
 });

 // 5. Upload variant
 const ext = imageResult.mimeType.split('/')[1] || 'png';
 const variantKey = `variants/${orgId}/${asset._id}/upscaled-${scaleFactor}x.${ext}`;
 await uploadBuffer(
 variantKey,
 imageResult.imageData,
 imageResult.mimeType,
 {
 source: 'ai-upscale',
 scaleFactor: String(scaleFactor),
 outputWidth: String(targetW),
 outputHeight: String(targetH),
 },
 undefined,
 orgId,
 );

 // 6. Update asset variants
 const variantEntry = {
 key: `upscaled-${scaleFactor}x`,
 storageKey: variantKey,
 width: targetW,
 height: targetH,
 format: ext,
 sizeBytes: imageResult.imageData.length,
 };

 asset.variants = (asset.variants ?? []).filter(
 (v: { key: string }) => v.key !== variantEntry.key,
 );
 asset.variants.push(variantEntry);
 await asset.save();

 return {
 variantKey,
 width: targetW,
 height: targetH,
 format: ext,
 provider: imageResult.provider,
 modelId: imageResult.modelId,
 sizeBytes: imageResult.imageData.length,
 scaleFactor,
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
