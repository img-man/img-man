// SPDX-License-Identifier: Apache-2.0
import { NextRequest, NextResponse } from 'next/server';
import { runAiJob } from '@/lib/ai-pipeline';
import { applyAiImageEdit } from '@/lib/ai-image-edits';
import { getSignedDownloadUrl, uploadBuffer } from '@/lib/storage';

/**
 * POST /api/ai/style-transfer
 * Body: { assetId: string, style: string, intensity?: number }
 *
 * DS-5.8 — AI Style Transfer Carousel
 * Applies artistic style transfer from a preset list.
 * intensity: 0–100 (default 70; low = subtle, high = heavy)
 * Credit cost: 4 (mid-range of spec's 3–6)
 */

export interface StylePreset {
  id: string;
  label: string;
  prompt: string;
}

export const STYLE_PRESETS: StylePreset[] = [
  {
    id: 'oil-painting',
    label: 'Oil Painting',
    prompt:
      'Transform this image into a classical oil painting style with visible brushstrokes, rich impasto texture, and deep, saturated colors reminiscent of the Old Masters.',
  },
  {
    id: 'watercolor',
    label: 'Watercolor',
    prompt:
      'Transform this image into a delicate watercolor painting with soft edges, transparent layered washes, gentle color bleeding, and white paper showing through.',
  },
  {
    id: 'sketch',
    label: 'Sketch',
    prompt:
      'Transform this image into a detailed pencil sketch with cross-hatching, fine line work, varying pressure strokes, and natural graphite shading on white paper.',
  },
  {
    id: 'anime',
    label: 'Anime',
    prompt:
      'Transform this image into anime/manga art style with clean bold outlines, flat cel-shaded colors, large expressive eyes on characters, and vibrant highlights.',
  },
  {
    id: 'ghibli',
    label: 'Ghibli',
    prompt:
      'Transform this image into Studio Ghibli animation style with soft dreamy colors, detailed environmental art, gentle lighting, whimsical atmosphere, and hand-painted look.',
  },
  {
    id: 'pop-art',
    label: 'Pop Art',
    prompt:
      'Transform this image into bold Pop Art style with Ben-Day dots, high contrast, limited color palette of primary/secondary colors, thick black outlines, like a Roy Lichtenstein or Andy Warhol piece.',
  },
  {
    id: 'cyberpunk',
    label: 'Cyberpunk',
    prompt:
      'Transform this image into cyberpunk aesthetic with neon glows (pink, cyan, purple), dark futuristic atmosphere, holographic reflections, rain-slick surfaces, and digital glitch elements.',
  },
  {
    id: 'retro-film',
    label: 'Retro Film',
    prompt:
      'Transform this image into a vintage retro film look with faded colors, film grain, light leaks, slightly washed-out highlights, warm amber tones, and nostalgic 1970s kodachrome feel.',
  },
  {
    id: 'pixel-art',
    label: 'Pixel Art',
    prompt:
      'Transform this image into pixel art / 16-bit retro game style with visible square pixels, limited color palette, clean geometric shapes, and no anti-aliasing.',
  },
  {
    id: 'impressionist',
    label: 'Impressionist',
    prompt:
      'Transform this image into French Impressionist painting style with short, visible brushstrokes, emphasis on light and color over line, vibrant dappled light, and the feel of Monet or Renoir.',
  },
];

const VALID_STYLE_IDS = STYLE_PRESETS.map((s) => s.id);

export async function POST(req: NextRequest) {
  try {
    const { assetId, style, intensity = 70 } = await req.json();
    if (!assetId) {
      return NextResponse.json({ error: 'assetId required' }, { status: 400 });
    }
    if (!style) {
      return NextResponse.json({ error: 'style required' }, { status: 400 });
    }
    if (!VALID_STYLE_IDS.includes(style)) {
      return NextResponse.json(
        { error: `Invalid style. Must be one of: ${VALID_STYLE_IDS.join(', ')}` },
        { status: 400 },
      );
    }

    const numIntensity = Number(intensity);
    if (isNaN(numIntensity) || numIntensity < 0 || numIntensity > 100) {
      return NextResponse.json(
        { error: 'intensity must be a number between 0 and 100' },
        { status: 400 },
      );
    }

    const preset = STYLE_PRESETS.find((s) => s.id === style)!;

    const jobResult = await runAiJob(
      { type: 'style_transfer', assetId, input: { style, intensity: numIntensity } },
      async ({ asset, orgId }) => {
        if (!asset) throw new Error('Asset not found');

        const imageUrl = await getSignedDownloadUrl(asset.storageKey, 60 * 10, undefined, orgId);

        const intensityMod =
          numIntensity <= 30
            ? 'Apply the style subtly — the original image should still be clearly recognizable with only a hint of the artistic effect.'
            : numIntensity <= 70
              ? 'Apply the style at a balanced level — clearly visible artistic transformation while maintaining the core composition.'
              : 'Apply the style heavily — strong artistic transformation that prioritizes the style over photorealism.';

        const fullPrompt = [
          preset.prompt,
          intensityMod,
          `Style intensity: ${numIntensity}/100.`,
          'Maintain the same subject, composition, and overall scene.',
          'Preserve original image dimensions and aspect ratio.',
        ].join(' ');

        const imageResult = await applyAiImageEdit({
          capability: 'image.edit',
          height: asset.height,
          imageUrl,
          mimeType: asset.mimeType,
          orgId,
          prompt: fullPrompt,
          width: asset.width,
        });

        const ext = imageResult.mimeType.split('/')[1] || 'png';
        const variantKey = `variants/${orgId}/${asset._id}/style-${style}.${ext}`;
        await uploadBuffer(variantKey, imageResult.imageData, imageResult.mimeType, {
          source: 'ai-style-transfer',
          style,
          intensity: String(numIntensity),
          originalAsset: asset._id.toString(),
        }, undefined, orgId);

        const variantName = `style-${style}`;
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
          style,
          width: asset.width ?? 0,
          height: asset.height ?? 0,
          format: ext,
          intensity: numIntensity,
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
