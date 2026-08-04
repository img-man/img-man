// SPDX-License-Identifier: Apache-2.0
import { NextRequest, NextResponse } from 'next/server';
import { runAiJob } from '@/lib/ai-pipeline';
import { applyAiImageEdit } from '@/lib/ai-image-edits';
import { getSignedDownloadUrl, uploadBuffer } from '@/lib/storage';

/**
 * POST /api/ai/sky-replace
 * Body: {
 *   assetId: string,
 *   skyPreset?: SkyPreset,
 *   customPrompt?: string
 * }
 *
 * DS-5.4 — AI Sky Replacement
 * Detects the sky region and replaces it with an AI-generated sky.
 * Preserves the foreground perfectly.
 * Credit cost: 3
 */

export const SKY_PRESETS = [
  { id: 'sunset', label: 'Sunset', prompt: 'a warm golden sunset sky with orange and pink clouds' },
  { id: 'sunrise', label: 'Sunrise', prompt: 'a vibrant sunrise sky with soft pink and purple hues on the horizon' },
  { id: 'dramatic-clouds', label: 'Dramatic Clouds', prompt: 'a dramatic sky with towering cumulonimbus clouds and volumetric lighting' },
  { id: 'clear-blue', label: 'Clear Blue', prompt: 'a crystal clear blue sky with minimal wispy cirrus clouds' },
  { id: 'night-stars', label: 'Night Stars', prompt: 'a clear night sky filled with thousands of visible stars and the Milky Way galaxy' },
  { id: 'aurora', label: 'Aurora', prompt: 'a night sky with vivid green and purple aurora borealis (northern lights) shimmering across the sky' },
  { id: 'overcast', label: 'Overcast', prompt: 'a moody overcast sky with layered grey clouds and soft diffused light' },
  { id: 'storm', label: 'Storm', prompt: 'a dramatic stormy sky with dark thunderclouds and visible lightning in the distance' },
] as const;

export type SkyPreset = (typeof SKY_PRESETS)[number]['id'];

export async function POST(req: NextRequest) {
  try {
    const { assetId, skyPreset, customPrompt } = await req.json();
    if (!assetId) {
      return NextResponse.json({ error: 'assetId required' }, { status: 400 });
    }
    if (!skyPreset && !customPrompt) {
      return NextResponse.json(
        { error: 'Either skyPreset or customPrompt is required' },
        { status: 400 },
      );
    }

    // Resolve sky description
    let skyDescription: string;
    if (customPrompt) {
      skyDescription = customPrompt;
    } else {
      const preset = SKY_PRESETS.find((p) => p.id === skyPreset);
      if (!preset) {
        return NextResponse.json(
          { error: `Invalid skyPreset. Use one of: ${SKY_PRESETS.map((p) => p.id).join(', ')}` },
          { status: 400 },
        );
      }
      skyDescription = preset.prompt;
    }

    const jobResult = await runAiJob(
      {
        type: 'sky_replace',
        assetId,
        input: { skyPreset: skyPreset || 'custom', customPrompt },
      },
      async ({ asset, orgId }) => {
        if (!asset) throw new Error('Asset not found');

        // 1. Get signed URL
        const imageUrl = await getSignedDownloadUrl(asset.storageKey, 60 * 10, undefined, orgId);

        // 2. Build prompt
        const skyPrompt = [
          `Replace ONLY the sky in this image with ${skyDescription}.`,
          'Instructions:',
          '- Detect the sky region precisely (everything above the horizon/buildings/trees).',
          '- Replace the sky with the described sky while matching the overall lighting direction.',
          '- Perfectly preserve ALL foreground elements (buildings, people, trees, ground, objects).',
          '- Blend the new sky naturally at the horizon line — no visible seams.',
          '- Adjust reflected light on foreground surfaces to match the new sky for realism.',
          '- Keep the same resolution, aspect ratio, and image quality.',
          '- The result should look photorealistic, as if the photo was taken under these sky conditions.',
        ].join('\n');

        // 3. Run provider-aware sky replacement
        const imageResult = await applyAiImageEdit({
          capability: 'image.edit',
          height: asset.height,
          imageUrl,
          mimeType: asset.mimeType,
          orgId,
          prompt: skyPrompt,
          width: asset.width,
        });

        // 5. Upload variant
        const ext = imageResult.mimeType.split('/')[1] || 'png';
        const skyLabel = (skyPreset || 'custom')
          .replace(/[^a-z0-9]/gi, '-')
          .toLowerCase();
        const variantKey = `variants/${orgId}/${asset._id}/sky-${skyLabel}.${ext}`;
        await uploadBuffer(variantKey, imageResult.imageData, imageResult.mimeType, {
          source: 'ai-sky-replace',
          skyPreset: skyPreset || 'custom',
          originalAsset: asset._id.toString(),
        }, undefined, orgId);

        // 6. Update asset variants
        const variantKeyName = `sky-${skyLabel}`;
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
          skyPreset: skyPreset || 'custom',
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
