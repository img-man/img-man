// SPDX-License-Identifier: Apache-2.0
import { NextRequest, NextResponse } from 'next/server';
import { runAiJob } from '@/lib/ai-pipeline';
import { applyAiImageEdit } from '@/lib/ai-image-edits';
import { getSignedDownloadUrl, uploadBuffer } from '@/lib/storage';

/**
 * POST /api/ai/color-fix
 * Body: { assetId: string }
 *
 * DS-5.10 — AI Color Correction
 * Auto white-balance and color cast removal.
 * Shows determination of any color casts and corrects them.
 * Credit cost: 1
 */
export async function POST(req: NextRequest) {
  try {
    const { assetId } = await req.json();
    if (!assetId) {
      return NextResponse.json({ error: 'assetId required' }, { status: 400 });
    }

    const jobResult = await runAiJob(
      { type: 'color_fix', assetId, input: {} },
      async ({ asset, orgId }) => {
        if (!asset) throw new Error('Asset not found');

        const imageUrl = await getSignedDownloadUrl(asset.storageKey, 60 * 10, undefined, orgId);

        const colorFixPrompt = [
          'Fix the colors in this image by performing professional auto white-balance correction.',
          'Detect and remove any color cast (blue, yellow, green, magenta, or orange tint).',
          'Ensure whites appear truly white and neutral grays appear neutral.',
          'Correct any mixed lighting issues (e.g., daylight + tungsten).',
          'Adjust color temperature to produce natural, accurate-looking colors.',
          'Do NOT alter the artistic intent — if the scene is naturally warm (sunset) or cool (overcast), preserve that character while removing only unnatural casts.',
          'Maintain original exposure, contrast, and sharpness.',
          'Preserve original image resolution and aspect ratio.',
        ].join(' ');

        const imageResult = await applyAiImageEdit({
          capability: 'image.edit',
          height: asset.height,
          imageUrl,
          mimeType: asset.mimeType,
          orgId,
          prompt: colorFixPrompt,
          width: asset.width,
        });

        const ext = imageResult.mimeType.split('/')[1] || 'png';
        const variantKey = `variants/${orgId}/${asset._id}/color-fixed.${ext}`;
        await uploadBuffer(variantKey, imageResult.imageData, imageResult.mimeType, {
          source: 'ai-color-fix',
          originalAsset: asset._id.toString(),
        }, undefined, orgId);

        const variantEntry = {
          key: 'color-fixed',
          storageKey: variantKey,
          width: asset.width ?? 0,
          height: asset.height ?? 0,
          format: ext,
          sizeBytes: imageResult.imageData.length,
        };
        asset.variants = (asset.variants ?? []).filter(
          (v: { key: string }) => v.key !== 'color-fixed',
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
