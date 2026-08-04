// SPDX-License-Identifier: Apache-2.0
import { NextRequest, NextResponse } from 'next/server';
import { runAiJob } from '@/lib/ai-pipeline';
import { applyAiImageEdit } from '@/lib/ai-image-edits';
import { getSignedDownloadUrl, uploadBuffer } from '@/lib/storage';

/**
 * POST /api/ai/retouch
 * Body: {
 * assetId: string,
 * features?: string[] — Optional list of retouching features to apply.
 * Defaults to all: skin_smoothing, blemish_removal,
 * teeth_whitening, red_eye_removal, skin_tone_evening.
 * intensity?: 'subtle' | 'moderate' | 'full' — Defaults to 'moderate'
 * }
 *
 * Portrait retouching using the active org AI provider.
 * Stores the result as a variant on the original asset.
 */

const ALL_FEATURES = [
 'skin_smoothing',
 'blemish_removal',
 'teeth_whitening',
 'red_eye_removal',
 'skin_tone_evening',
] as const;

type RetouchFeature = (typeof ALL_FEATURES)[number];

const FEATURE_DESCRIPTIONS: Record<RetouchFeature, string> = {
 skin_smoothing: 'Smooth skin texture while preserving natural pores and fine details',
 blemish_removal: 'Remove blemishes, acne, spots, and skin imperfections',
 teeth_whitening: 'Subtly whiten teeth if visible, keeping a natural look',
 red_eye_removal: 'Fix red-eye if present in the photo',
 skin_tone_evening: 'Even out skin tone and reduce discoloration',
};

const INTENSITY_LABELS: Record<string, string> = {
 subtle: 'Make very subtle, barely noticeable improvements. Keep the result extremely natural.',
 moderate:
 'Apply moderate retouching that is noticeable but still looks natural and not over-processed.',
 full: 'Apply thorough professional-grade retouching while still keeping the portrait realistic.',
};

export async function POST(req: NextRequest) {
 try {
 const { assetId, features, intensity = 'moderate' } = await req.json();
 if (!assetId) {
 return NextResponse.json({ error: 'assetId required' }, { status: 400 });
 }

 // Validate intensity
 if (!['subtle', 'moderate', 'full'].includes(intensity)) {
 return NextResponse.json(
 { error: 'intensity must be subtle, moderate, or full' },
 { status: 400 },
 );
 }

 // Validate features list
 const selectedFeatures: RetouchFeature[] = features
 ? features.filter((f: string) => ALL_FEATURES.includes(f as RetouchFeature))
 : [...ALL_FEATURES];

 if (selectedFeatures.length === 0) {
 return NextResponse.json(
 { error: `Invalid features. Valid options: ${ALL_FEATURES.join(', ')}` },
 { status: 400 },
 );
 }

 const jobResult = await runAiJob(
 { type: 'retouch', assetId, input: { features: selectedFeatures, intensity } },
 async ({ asset, orgId }) => {
 if (!asset) throw new Error('Asset not found');

 // 1. Get signed URL for the original image
 const imageUrl = await getSignedDownloadUrl(asset.storageKey, 60 * 10, undefined, orgId);

 // 2. Build feature-specific prompt sections
 const featureInstructions = selectedFeatures
 .map((f) => `- ${FEATURE_DESCRIPTIONS[f]}`)
 .join('\n');

 const intensityInstruction = INTENSITY_LABELS[intensity] ?? INTENSITY_LABELS.moderate;

 const prompt = `Professionally retouch this portrait photo. Apply the following enhancements:
${featureInstructions}

${intensityInstruction}

CRITICAL RULES:
- Preserve the person's identity and unique features. Do NOT change facial structure, eye color, hair, or body shape.
- Do NOT alter the background, clothing, or lighting direction.
- Maintain the original resolution, aspect ratio, and color temperature.
- The result must look like a professional photograph, not an AI-generated image.`;

 // 3. Run provider-aware retouching
 const imageResult = await applyAiImageEdit({
 capability: 'image.edit',
 height: asset.height,
 imageUrl,
 mimeType: asset.mimeType,
 orgId,
 prompt,
 width: asset.width,
 });

 // 5. Upload variant to GCS
 const format = imageResult.mimeType === 'image/png' ? 'png' : 'webp';
 const variantKeyName = `retouched-${intensity}`;
 const variantKey = `variants/${orgId}/${asset._id}/${variantKeyName}.${format}`;
 await uploadBuffer(
 variantKey,
 imageResult.imageData,
 imageResult.mimeType,
 {
 source: 'ai-retouch',
 features: selectedFeatures.join(','),
 intensity,
 originalAsset: asset._id.toString(),
 },
 undefined,
 orgId,
 );

 // 6. Update asset variants
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
 features: selectedFeatures,
 intensity,
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
