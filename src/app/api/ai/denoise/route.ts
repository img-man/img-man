// SPDX-License-Identifier: Apache-2.0
import { NextRequest, NextResponse } from 'next/server';
import { runAiJob } from '@/lib/ai-pipeline';
import { applyAiImageEdit } from '@/lib/ai-image-edits';
import { getSignedDownloadUrl, uploadBuffer } from '@/lib/storage';

const VALID_STRENGTHS = ['light', 'medium', 'heavy'] as const;
type DenoiseStrength = (typeof VALID_STRENGTHS)[number];

const STRENGTH_PROMPTS: Record<DenoiseStrength, string> = {
  light:
    'Apply light noise reduction. Remove subtle grain and sensor noise while preserving all fine details, textures, and edges. The result should look cleaner but virtually indistinguishable from the original in terms of detail.',
  medium:
    'Apply medium noise reduction. Remove visible grain, sensor noise, and minor compression artifacts. Preserve important details and textures but allow slight softening of uniform areas. The result should look significantly cleaner.',
  heavy:
    'Apply aggressive noise reduction. Remove heavy grain, noise, and compression artifacts. Smooth noisy areas substantially while attempting to preserve key subject edges and major textures. The result should be dramatically cleaner, suitable for very noisy/low-light images.',
};

/**
 * POST /api/ai/denoise
 * Body: { assetId: string, strength: 'light' | 'medium' | 'heavy' }
 *
 * DS-5.2 — AI Denoise
 * AI-powered noise reduction with selectable strength.
 * Credit cost: 2
 */
export async function POST(req: NextRequest) {
  try {
    const { assetId, strength = 'medium' } = await req.json();
    if (!assetId) {
      return NextResponse.json({ error: 'assetId required' }, { status: 400 });
    }
    if (!VALID_STRENGTHS.includes(strength)) {
      return NextResponse.json(
        { error: `strength must be one of: ${VALID_STRENGTHS.join(', ')}` },
        { status: 400 },
      );
    }

    const jobResult = await runAiJob(
      { type: 'denoise', assetId, input: { strength } },
      async ({ asset, orgId }) => {
        if (!asset) throw new Error('Asset not found');

        // 1. Get signed URL
        const imageUrl = await getSignedDownloadUrl(asset.storageKey, 60 * 10, undefined, orgId);

        // 2. Build prompt
        const denoisePrompt = [
          STRENGTH_PROMPTS[strength as DenoiseStrength],
          'Keep the same resolution and aspect ratio.',
          'Do not change the color palette, composition, or content of the image.',
        ].join(' ');

        // 3. Run provider-aware denoising
        const imageResult = await applyAiImageEdit({
          capability: 'image.edit',
          height: asset.height,
          imageUrl,
          mimeType: asset.mimeType,
          orgId,
          prompt: denoisePrompt,
          width: asset.width,
        });

        // 5. Upload variant
        const ext = imageResult.mimeType.split('/')[1] || 'png';
        const variantKey = `variants/${orgId}/${asset._id}/denoised-${strength}.${ext}`;
        await uploadBuffer(variantKey, imageResult.imageData, imageResult.mimeType, {
          source: 'ai-denoise',
          strength,
          originalAsset: asset._id.toString(),
        }, undefined, orgId);

        // 6. Update asset variants
        const variantKeyName = `denoised-${strength}`;
        const variantEntry = {
          key: variantKeyName,
          storageKey: variantKey,
          width: asset.width ?? 0,
          height: asset.height ?? 0,
          format: ext,
          sizeBytes: imageResult.imageData.length,
        };
        asset.variants = (asset.variants ?? []).filter(
          (v: { key: string }) => v.key !== variantKeyName,
        );
        asset.variants.push(variantEntry);
        await asset.save();

        return {
          variantKey,
          strength,
          width: asset.width ?? 0,
          height: asset.height ?? 0,
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
