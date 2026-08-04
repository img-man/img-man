// SPDX-License-Identifier: Apache-2.0
import { NextRequest, NextResponse } from 'next/server';
import { runAiJob } from '@/lib/ai-pipeline';
import { applyAiImageEdit } from '@/lib/ai-image-edits';
import { getSignedDownloadUrl, uploadBuffer } from '@/lib/storage';

/**
 * POST /api/ai/enhance
 * Body: { assetId: string }
 *
 * DS-5.1 — AI Auto Enhance ("Magic Enhance")
 * One-click auto-adjustment of exposure, color, sharpness using the active org AI provider.
 * Credit cost: 1
 */
export async function POST(req: NextRequest) {
  try {
    const { assetId } = await req.json();
    if (!assetId) {
      return NextResponse.json({ error: 'assetId required' }, { status: 400 });
    }

    const jobResult = await runAiJob(
      { type: 'enhance', assetId, input: {} },
      async ({ asset, orgId }) => {
        if (!asset) throw new Error('Asset not found');

        // 1. Get signed URL
        const imageUrl = await getSignedDownloadUrl(asset.storageKey, 60 * 10, undefined, orgId);

        // 2. Build prompt
        const enhancePrompt = [
          'Enhance this image with professional-grade auto-adjustments.',
          'Optimize exposure (fix under/overexposure), improve dynamic range.',
          'Boost color vibrancy and saturation to natural, pleasing levels.',
          'Sharpen fine details and edges without introducing artifacts.',
          'Correct white balance if the image has a color cast.',
          'Reduce any visible noise or compression artifacts.',
          'The result should look like a professionally edited photo while remaining true to the original scene.',
          'Keep the same resolution and aspect ratio.',
        ].join(' ');

        // 3. Run provider-aware enhancement
        const imageResult = await applyAiImageEdit({
          capability: 'image.edit',
          height: asset.height,
          imageUrl,
          mimeType: asset.mimeType,
          orgId,
          prompt: enhancePrompt,
          width: asset.width,
        });

        // 5. Upload variant
        const ext = imageResult.mimeType.split('/')[1] || 'png';
        const variantKey = `variants/${orgId}/${asset._id}/enhanced.${ext}`;
        await uploadBuffer(variantKey, imageResult.imageData, imageResult.mimeType, {
          source: 'ai-enhance',
          originalAsset: asset._id.toString(),
        }, undefined, orgId);

        // 6. Update asset variants
        const variantEntry = {
          key: 'enhanced',
          storageKey: variantKey,
          width: asset.width ?? 0,
          height: asset.height ?? 0,
          format: ext,
          sizeBytes: imageResult.imageData.length,
        };
        asset.variants = (asset.variants ?? []).filter(
          (v: { key: string }) => v.key !== 'enhanced',
        );
        asset.variants.push(variantEntry);
        await asset.save();

        return {
          variantKey,
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
