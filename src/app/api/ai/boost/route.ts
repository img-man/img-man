// SPDX-License-Identifier: Apache-2.0
import { NextRequest, NextResponse } from 'next/server';
import { runAiJob } from '@/lib/ai-pipeline';
import { applyAiImageEdit } from '@/lib/ai-image-edits';
import { getSignedDownloadUrl, uploadBuffer } from '@/lib/storage';

/**
 * POST /api/ai/boost
 * Body: { assetId: string, mode?: string }
 *
 * AI Boost — Server-side intelligent image enhancement that goes beyond
 * simple CSS filter adjustments. Uses Vertex AI to intelligently:
 * - Recover lost detail in shadows & highlights
 * - Expand perceived dynamic range
 * - Intelligently sharpen while reducing noise
 * - Optimize color accuracy and vibrancy
 *
 * mode: 'auto' | 'vivid' | 'natural' | 'hdr' (default 'auto')
 * Credit cost: 2
 *
 * Auth: Enforced by runAiJob -> requirePermission('ai') which verifies
 * session, org membership, credit balance, and rate limits.
 */
export async function POST(req: NextRequest) {
  try {
    const { assetId, mode = 'auto' } = await req.json();
    if (!assetId) {
      return NextResponse.json({ error: 'assetId required' }, { status: 400 });
    }

    const validModes = ['auto', 'vivid', 'natural', 'hdr'];
    const safeMode = validModes.includes(mode) ? mode : 'auto';

    const jobResult = await runAiJob(
      { type: 'ai_boost', assetId, input: { mode: safeMode } },
      async ({ asset, orgId }) => {
        if (!asset) throw new Error('Asset not found');

        const imageUrl = await getSignedDownloadUrl(asset.storageKey, 60 * 10, undefined, orgId);

        const modePrompts: Record<string, string> = {
          auto:
            'Apply intelligent auto-boost: optimize exposure, recover shadow and highlight detail, sharpen key details while reducing noise, and enhance color accuracy. Produce a balanced, professional result.',
          vivid:
            'Apply vivid boost: significantly enhance color saturation and vibrancy, increase contrast for punchy tones, sharpen details aggressively, and make the image appear ultra-vibrant and eye-catching.',
          natural:
            'Apply natural boost: gently recover shadow and highlight detail, subtly sharpen while preserving grain/texture, correct any color cast, and make the image look naturally polished without appearing over-processed.',
          hdr:
            'Apply HDR-style boost: dramatically expand the dynamic range by recovering both deep shadows and blown highlights. Enhance local contrast for a tone-mapped look. Colors should be vivid but realistic. The result should look like a professional HDR merge.',
        };

        const boostPrompt = [
          modePrompts[safeMode],
          'Preserve the original composition, subjects, and aspect ratio.',
          'The result should be a high-quality enhanced version of the original image.',
          'Do not add any text, watermarks, or borders.',
          'Keep the same image dimensions.',
        ].join(' ');

        const imageResult = await applyAiImageEdit({
          capability: 'image.edit',
          height: asset.height,
          imageUrl,
          mimeType: asset.mimeType,
          orgId,
          prompt: boostPrompt,
          width: asset.width,
        });

        const ext = imageResult.mimeType.split('/')[1] || 'png';
        const variantKey = `variants/${orgId}/${asset._id}/boosted-${safeMode}.${ext}`;
        await uploadBuffer(variantKey, imageResult.imageData, imageResult.mimeType, {
          source: 'ai-boost',
          mode: safeMode,
          originalAsset: asset._id.toString(),
        }, undefined, orgId);

        const variantEntry = {
          key: `boosted-${safeMode}`,
          storageKey: variantKey,
          width: asset.width ?? 0,
          height: asset.height ?? 0,
          format: ext,
          sizeBytes: imageResult.imageData.length,
        };
        asset.variants = (asset.variants ?? []).filter(
          (v: { key: string }) => v.key !== `boosted-${safeMode}`,
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
          mode: safeMode,
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
