// SPDX-License-Identifier: Apache-2.0
import { NextRequest, NextResponse } from 'next/server';
import { runAiJob } from '@/lib/ai-pipeline';
import { applyAiImageEdit } from '@/lib/ai-image-edits';
import { getSignedDownloadUrl, uploadBuffer } from '@/lib/storage';

/**
 * POST /api/ai/object-move
 * Body: {
 *   assetId: string,
 *   description: string,        — What object to move
 *   fromRegion: { x, y, w, h }, — Source region (pixels)
 *   toRegion: { x, y, w, h },   — Destination region (pixels)
 *   maskBase64?: string,         — Optional mask (white = object to move)
 * }
 *
 * DS-5.5 — AI Object Relocation
 * Moves an object from one position to another within the image.
 * AI inpaints the empty region left behind and blends the object
 * into its new position.
 * Credit cost: 5
 */

interface Region {
  x: number;
  y: number;
  w: number;
  h: number;
}

export async function POST(req: NextRequest) {
  try {
    const { assetId, description, fromRegion, toRegion, maskBase64 } =
      await req.json();

    if (!assetId) {
      return NextResponse.json({ error: 'assetId required' }, { status: 400 });
    }
    if (!description) {
      return NextResponse.json(
        { error: 'description required — describe the object to move' },
        { status: 400 },
      );
    }
    if (!fromRegion || !toRegion) {
      return NextResponse.json(
        { error: 'Both fromRegion and toRegion are required ({ x, y, w, h })' },
        { status: 400 },
      );
    }

    const jobResult = await runAiJob(
      {
        type: 'object_move',
        assetId,
        input: { description, fromRegion, toRegion, hasMask: !!maskBase64 },
      },
      async ({ asset, orgId }) => {
        if (!asset) throw new Error('Asset not found');

        const imgW = asset.width ?? 1000;
        const imgH = asset.height ?? 1000;
        const from = fromRegion as Region;
        const to = toRegion as Region;

        // 1. Get signed URL
        const imageUrl = await getSignedDownloadUrl(asset.storageKey, 60 * 10, undefined, orgId);

        // 2. Build and run provider-aware relocation prompt
        const normalizedMaskBase64 = maskBase64
          ? maskBase64.replace(/^data:image\/\w+;base64,/, '')
          : undefined;
        const mimeMatch = maskBase64?.match(/^data:(image\/\w+);base64,/);
        const maskMime = mimeMatch ? mimeMatch[1] : 'image/png';

        const prompt = [
          `Move "${description}" in this ${imgW}x${imgH} image:`,
          ``,
          `FROM region: top-left (${from.x}, ${from.y}), size ${from.w}x${from.h} pixels`,
          `TO region: top-left (${to.x}, ${to.y}), size ${to.w}x${to.h} pixels`,
          ``,
          normalizedMaskBase64
            ? 'The second image is a mask where white areas indicate the exact object to move.'
            : '',
          `Instructions:`,
          `1. Extract "${description}" from the source region.`,
          `2. Inpaint the source region — fill it with a natural continuation of the surrounding background, seamlessly.`,
          `3. Place the object at the destination region — scale if needed to fit the target area.`,
          `4. Blend the relocated object naturally: match lighting, shadows, and perspective of the destination area.`,
          `5. The final image should look photorealistic — no visible seams or artifacts.`,
          `6. Keep the same resolution (${imgW}x${imgH}) and aspect ratio.`,
          `7. Do not alter any parts of the image other than the source and destination regions.`,
        ]
          .filter(Boolean)
          .join('\n');

        const imageResult = await applyAiImageEdit({
          capability: 'image.edit.inpaint',
          height: imgH,
          imageUrl,
          maskBase64: normalizedMaskBase64,
          maskMimeType: maskMime,
          mimeType: asset.mimeType,
          orgId,
          prompt,
          width: imgW,
        });

        // 4. Upload variant
        const ext = imageResult.mimeType.split('/')[1] || 'png';
        const safeDesc = description
          .replace(/[^a-z0-9]/gi, '-')
          .slice(0, 25)
          .toLowerCase();
        const variantKey = `variants/${orgId}/${asset._id}/moved-${safeDesc}.${ext}`;
        await uploadBuffer(
          variantKey,
          imageResult.imageData,
          imageResult.mimeType,
          {
            source: 'ai-object-move',
            description,
            fromRegion: JSON.stringify(from),
            toRegion: JSON.stringify(to),
            originalAsset: asset._id.toString(),
          },
          undefined,
          orgId,
        );

        // 5. Update asset variants
        const variantKeyName = `moved-${safeDesc}`;
        const variantEntry = {
          key: variantKeyName,
          storageKey: variantKey,
          width: imgW,
          height: imgH,
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
          description,
          fromRegion: from,
          toRegion: to,
          width: imgW,
          height: imgH,
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
