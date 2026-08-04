// SPDX-License-Identifier: Apache-2.0
import { NextRequest, NextResponse } from 'next/server';
import { runAiJob } from '@/lib/ai-pipeline';
import { applyAiImageEdit } from '@/lib/ai-image-edits';
import { getSignedDownloadUrl, uploadBuffer } from '@/lib/storage';

/**
 * POST /api/ai/relight
 * Body: { assetId: string, angle?: number, intensity?: number, temperature?: number }
 *
 * DS-5.7 — AI Relight
 * Virtual lighting direction control with intensity and color temperature.
 * angle: 0–360 (degrees, 0 = top, 90 = right, 180 = bottom, 270 = left)
 * intensity: 0–100 (default 50)
 * temperature: 2700–6500 (Kelvin, default 5000 — daylight)
 * Credit cost: 3
 */
export async function POST(req: NextRequest) {
  try {
    const { assetId, angle = 45, intensity = 50, temperature = 5000 } = await req.json();
    if (!assetId) {
      return NextResponse.json({ error: 'assetId required' }, { status: 400 });
    }

    const numAngle = Number(angle);
    const numIntensity = Number(intensity);
    const numTemp = Number(temperature);

    if (isNaN(numAngle) || numAngle < 0 || numAngle > 360) {
      return NextResponse.json(
        { error: 'angle must be a number between 0 and 360' },
        { status: 400 },
      );
    }
    if (isNaN(numIntensity) || numIntensity < 0 || numIntensity > 100) {
      return NextResponse.json(
        { error: 'intensity must be a number between 0 and 100' },
        { status: 400 },
      );
    }
    if (isNaN(numTemp) || numTemp < 2700 || numTemp > 6500) {
      return NextResponse.json(
        { error: 'temperature must be between 2700 and 6500 (Kelvin)' },
        { status: 400 },
      );
    }

    // Map angle to direction label
    const directionLabel = getDirectionLabel(numAngle);
    // Map temperature to warmth description
    const warmth =
      numTemp < 3500 ? 'warm, golden/amber' : numTemp > 5500 ? 'cool, bluish daylight' : 'neutral daylight';

    const jobResult = await runAiJob(
      {
        type: 'relight',
        assetId,
        input: { angle: numAngle, intensity: numIntensity, temperature: numTemp },
      },
      async ({ asset, orgId }) => {
        if (!asset) throw new Error('Asset not found');

        const imageUrl = await getSignedDownloadUrl(asset.storageKey, 60 * 10, undefined, orgId);

        const intensityDesc =
          numIntensity <= 30
            ? 'subtle, soft light'
            : numIntensity <= 70
              ? 'moderate, natural-looking light'
              : 'dramatic, strong directional light with deep shadows';

        const relightPrompt = [
          'Relight this image with virtual directional lighting.',
          `Place the main light source from the ${directionLabel} (${numAngle}° from top).`,
          `Apply ${intensityDesc} (intensity ${numIntensity}/100).`,
          `Use ${warmth} color temperature (${numTemp}K).`,
          'Create natural shadows and highlights consistent with the new light direction.',
          'Maintain the subject detail and overall composition.',
          'The lighting should look physically realistic — not painted or artificial.',
          'Preserve original image resolution and aspect ratio.',
        ].join(' ');

        const imageResult = await applyAiImageEdit({
          capability: 'image.edit',
          height: asset.height,
          imageUrl,
          mimeType: asset.mimeType,
          orgId,
          prompt: relightPrompt,
          width: asset.width,
        });

        const ext = imageResult.mimeType.split('/')[1] || 'png';
        const variantKey = `variants/${orgId}/${asset._id}/relit-${numAngle}-${numIntensity}.${ext}`;
        await uploadBuffer(variantKey, imageResult.imageData, imageResult.mimeType, {
          source: 'ai-relight',
          angle: String(numAngle),
          intensity: String(numIntensity),
          temperature: String(numTemp),
          originalAsset: asset._id.toString(),
        }, undefined, orgId);

        const variantName = `relit-${numAngle}-${numIntensity}`;
        const variantEntry = {
          key: variantName,
          storageKey: variantKey,
          width: asset.width ?? 0,
          height: asset.height ?? 0,
          format: ext,
          sizeBytes: imageResult.imageData.length,
        };
        asset.variants = (asset.variants ?? []).filter(
          (v: { key: string }) => v.key !== variantName,
        );
        asset.variants.push(variantEntry);
        await asset.save();

        return {
          variantKey,
          width: asset.width ?? 0,
          height: asset.height ?? 0,
          format: ext,
          angle: numAngle,
          intensity: numIntensity,
          temperature: numTemp,
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

/* ─── Helpers ────────────────────────────────────────────── */

function getDirectionLabel(angle: number): string {
  if (angle <= 22 || angle > 337) return 'top';
  if (angle <= 67) return 'top-right';
  if (angle <= 112) return 'right';
  if (angle <= 157) return 'bottom-right';
  if (angle <= 202) return 'bottom';
  if (angle <= 247) return 'bottom-left';
  if (angle <= 292) return 'left';
  return 'top-left';
}
