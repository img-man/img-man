// SPDX-License-Identifier: Apache-2.0
import { NextRequest, NextResponse } from 'next/server';
import { runAiJob } from '@/lib/ai-pipeline';
import { applyAiImageEdit } from '@/lib/ai-image-edits';
import { getSignedDownloadUrl, uploadBuffer } from '@/lib/storage';

/**
 * POST /api/ai/bokeh
 * Body: { assetId: string, intensity?: number }
 *
 * DS-5.6 — AI Depth of Field (Bokeh / "Portrait Blur")
 * Separates subject from background, applies adjustable blur.
 * intensity: 0–100 (default 50)
 * Credit cost: 2
 */
export async function POST(req: NextRequest) {
  try {
    const { assetId, intensity = 50 } = await req.json();
    if (!assetId) {
      return NextResponse.json({ error: 'assetId required' }, { status: 400 });
    }

    const numIntensity = Number(intensity);
    if (isNaN(numIntensity) || numIntensity < 0 || numIntensity > 100) {
      return NextResponse.json(
        { error: 'intensity must be a number between 0 and 100' },
        { status: 400 },
      );
    }

    const jobResult = await runAiJob(
      { type: 'bokeh', assetId, input: { intensity: numIntensity } },
      async ({ asset, orgId }) => {
        if (!asset) throw new Error('Asset not found');

        const imageUrl = await getSignedDownloadUrl(asset.storageKey, 60 * 10, undefined, orgId);

        const blurDesc =
          numIntensity <= 30
            ? 'subtle, gentle background blur'
            : numIntensity <= 70
              ? 'moderate, natural-looking background blur'
              : 'strong, pronounced background blur with very shallow depth of field';

        const bokehPrompt = [
          'Apply a professional portrait-style depth of field (bokeh) effect to this image.',
          `Accurately detect the main subject(s) in the foreground and keep them perfectly sharp.`,
          `Apply ${blurDesc} (intensity ${numIntensity}/100) to the background.`,
          'Create smooth, circular bokeh highlights in out-of-focus areas.',
          'Ensure natural edge transitions between the sharp subject and blurred background.',
          'The boundary should be seamless — no visible halo or artifact around the subject.',
          'Preserve the original colors, exposure, and resolution of the subject.',
          'Keep the same image dimensions and aspect ratio.',
        ].join(' ');

        const imageResult = await applyAiImageEdit({
          capability: 'image.edit',
          height: asset.height,
          imageUrl,
          mimeType: asset.mimeType,
          orgId,
          prompt: bokehPrompt,
          width: asset.width,
        });

        const ext = imageResult.mimeType.split('/')[1] || 'png';
        const variantKey = `variants/${orgId}/${asset._id}/bokeh-${numIntensity}.${ext}`;
        await uploadBuffer(variantKey, imageResult.imageData, imageResult.mimeType, {
          source: 'ai-bokeh',
          intensity: String(numIntensity),
          originalAsset: asset._id.toString(),
        }, undefined, orgId);

        const variantEntry = {
          key: `bokeh-${numIntensity}`,
          storageKey: variantKey,
          width: asset.width ?? 0,
          height: asset.height ?? 0,
          format: ext,
          sizeBytes: imageResult.imageData.length,
        };
        asset.variants = (asset.variants ?? []).filter(
          (v: { key: string }) => v.key !== `bokeh-${numIntensity}`,
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
          intensity: numIntensity,
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
