// SPDX-License-Identifier: Apache-2.0
import { NextRequest, NextResponse } from 'next/server';
import { runAiJob } from '@/lib/ai-pipeline';
import { applyAiImageEdit } from '@/lib/ai-image-edits';
import { getSignedDownloadUrl, uploadBuffer } from '@/lib/storage';

/**
 * POST /api/ai/expand
 * Body: { assetId, targetWidth, targetHeight, direction?, prompt? }
 *
 * AI-powered outpainting — expands image to target dimensions
 * by generating content for the new areas.
 */
export async function POST(req: NextRequest) {
 try {
 const body = await req.json();
 const { assetId, targetWidth, targetHeight, direction, prompt } = body;

 if (!assetId || !targetWidth || !targetHeight) {
 return NextResponse.json(
 { error: 'assetId, targetWidth, and targetHeight are required' },
 { status: 400 },
 );
 }

 if (targetWidth > 8192 || targetHeight > 8192) {
 return NextResponse.json(
 { error: 'Target dimensions cannot exceed 8192px' },
 { status: 400 },
 );
 }

 const jobResult = await runAiJob(
 {
 type: 'expand',
 assetId,
 input: { targetWidth, targetHeight, direction, prompt },
 },
 async ({ asset, orgId }) => {
 if (!asset) throw new Error('Asset not found');

 const origW = asset.width ?? 1000;
 const origH = asset.height ?? 1000;

 if (targetWidth <= origW && targetHeight <= origH) {
 throw new Error('Target dimensions must be larger than original');
 }

 // 1. Get signed URL
 const imageUrl = await getSignedDownloadUrl(asset.storageKey, 60 * 10, undefined, orgId);

 // 2. Build the prompt
 const directionHint = direction
 ? `Expand primarily to the ${direction}.`
 : 'Expand equally on all sides.';
 const styleHint = prompt
 ? `Style guidance: ${prompt}`
 : 'Match the existing style, colors, and lighting seamlessly.';

 const expandPrompt = [
 `This image is currently ${origW}x${origH} pixels.`,
 `Expand it to ${targetWidth}x${targetHeight} pixels by generating new content in the expanded areas.`,
 directionHint,
 styleHint,
 'The new areas should blend naturally with the original image.',
 'Maintain the same perspective, lighting, and artistic style.',
 'Return the full expanded image.',
 ].join(' ');

 // 3. Run provider-aware outpainting
 const imageResult = await applyAiImageEdit({
 capability: 'image.edit.outpaint',
 height: targetHeight,
 imageUrl,
 mimeType: asset.mimeType,
 orgId,
 prompt: expandPrompt,
 width: targetWidth,
 });

 // 5. Upload variant
 const ext = imageResult.mimeType.split('/')[1] || 'png';
 const variantKey = `variants/${orgId}/${asset._id}/expanded-${targetWidth}x${targetHeight}.${ext}`;
 await uploadBuffer(
 variantKey,
 imageResult.imageData,
 imageResult.mimeType,
 {
 source: 'ai-expand',
 targetWidth: String(targetWidth),
 targetHeight: String(targetHeight),
 },
 undefined,
 orgId,
 );

 // 6. Update asset variants
 const variantEntry = {
 key: `expanded-${targetWidth}x${targetHeight}`,
 storageKey: variantKey,
 width: targetWidth,
 height: targetHeight,
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
 width: targetWidth,
 height: targetHeight,
 format: ext,
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
