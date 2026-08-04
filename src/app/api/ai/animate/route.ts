// SPDX-License-Identifier: Apache-2.0
import { NextRequest, NextResponse } from 'next/server';
import { runAiJob } from '@/lib/ai-pipeline';
import { applyAiImageEdit } from '@/lib/ai-image-edits';
import { getSignedDownloadUrl, uploadBuffer } from '@/lib/storage';

/**
 * POST /api/ai/animate
 * Body: { assetId: string, style?: string, intensity?: number }
 *
 * AI Animate — Convert a still image into an animated/motion-style version.
 * Uses Vertex AI to generate a stylised "in-motion" frame with motion blur,
 * cinemagraph-style effects, or anime-motion rendering.
 *
 * style: 'cinemagraph' | 'motion-blur' | 'parallax' | 'anime-motion' (default 'cinemagraph')
 * intensity: 0–100 (default 50)
 * Credit cost: 4
 *
 * Auth: Enforced by runAiJob -> requirePermission('ai') which verifies
 * session, org membership, credit balance, and rate limits.
 */
export async function POST(req: NextRequest) {
  try {
    const { assetId, style = 'cinemagraph', intensity = 50 } = await req.json();
    if (!assetId) {
      return NextResponse.json({ error: 'assetId required' }, { status: 400 });
    }

    const validStyles = ['cinemagraph', 'motion-blur', 'parallax', 'anime-motion'];
    const safeStyle = validStyles.includes(style) ? style : 'cinemagraph';
    const numIntensity = Math.min(100, Math.max(0, Number(intensity) || 50));

    const jobResult = await runAiJob(
      { type: 'animate', assetId, input: { style: safeStyle, intensity: numIntensity } },
      async ({ asset, orgId }) => {
        if (!asset) throw new Error('Asset not found');

        const imageUrl = await getSignedDownloadUrl(asset.storageKey, 60 * 10, undefined, orgId);

        const intensityDesc =
          numIntensity <= 30
            ? 'subtle, barely perceptible motion'
            : numIntensity <= 70
              ? 'moderate, natural-looking motion'
              : 'dramatic, pronounced motion effect';

        const stylePrompts: Record<string, string> = {
          cinemagraph:
            'Create a cinemagraph-style image where the main subject is frozen still, but surrounding elements (hair, water, fabric, smoke, leaves) show natural motion blur as if they are gently moving.',
          'motion-blur':
            'Apply a professional motion blur effect to this image. The main subject should have directional motion blur suggesting fast movement. Background should show speed streaks.',
          parallax:
            'Create a 2.5D parallax-style depth effect. The foreground subject should appear to pop forward while the background recedes with a subtle zoom-blur effect, creating depth separation.',
          'anime-motion':
            'Transform this image into an anime-style action frame with Japanese manga speed lines, dynamic motion effects, and anime-style rendering. Hair and clothing should show exaggerated wind movement.',
        };

        const animatePrompt = [
          stylePrompts[safeStyle],
          `Apply ${intensityDesc} (intensity ${numIntensity}/100).`,
          'Preserve the original subjects, colors, and composition.',
          'The result should be a high-quality still image that conveys motion and energy.',
          'Keep the same image dimensions and aspect ratio.',
        ].join(' ');

        const imageResult = await applyAiImageEdit({
          capability: 'image.edit',
          height: asset.height,
          imageUrl,
          mimeType: asset.mimeType,
          orgId,
          prompt: animatePrompt,
          width: asset.width,
        });

        const ext = imageResult.mimeType.split('/')[1] || 'png';
        const variantKey = `variants/${orgId}/${asset._id}/animated-${safeStyle}.${ext}`;
        await uploadBuffer(variantKey, imageResult.imageData, imageResult.mimeType, {
          source: 'ai-animate',
          style: safeStyle,
          intensity: String(numIntensity),
          originalAsset: asset._id.toString(),
        }, undefined, orgId);

        const variantEntry = {
          key: `animated-${safeStyle}`,
          storageKey: variantKey,
          width: asset.width ?? 0,
          height: asset.height ?? 0,
          format: ext,
          sizeBytes: imageResult.imageData.length,
        };
        asset.variants = (asset.variants ?? []).filter(
          (v: { key: string }) => v.key !== `animated-${safeStyle}`,
        );
        asset.variants.push(variantEntry);
        await asset.save();

        return {
          variantKey,
          width: asset.width ?? 0,
          height: asset.height ?? 0,
          format: ext,
          intensity: numIntensity,
          provider: imageResult.provider,
          modelId: imageResult.modelId,
          style: safeStyle,
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
