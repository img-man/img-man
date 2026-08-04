// SPDX-License-Identifier: Apache-2.0
import { NextRequest, NextResponse } from 'next/server';
import { runAiJob } from '@/lib/ai-pipeline';
import { refinePrompt } from '@/lib/prompt-refiner';
import { getOrgAiProviderConfig } from '@/lib/ai-provider-config';
import { generateOpenAiImage } from '@/lib/openai';
import {
  getGeminiImageGenModel,
  parseImageResponse,
  textPromptParts,
} from '@/lib/vertex-ai';
import { uploadBuffer, getGcsBucket } from '@/lib/storage';
import { Asset } from '@/models';
import { getDefaultModelForProviderCapability } from '@/lib/ai-models';
import { ensureDesignImagesFolder } from '@/lib/design-images-folder';

/**
 * POST /api/ai/generate-image
 * Body: { prompt, width?, height? }
 *
 * Lightweight image generation endpoint for the Design Studio.
 * Returns { imageUrl } — a signed URL to the generated image,
 * ready to be used as an <image> src on the SVG canvas.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prompt, width = 512, height = 512 } = body;

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json(
        { error: 'prompt is required' },
        { status: 400 },
      );
    }
    if (prompt.length > 2000) {
      return NextResponse.json(
        { error: 'Prompt must be 2000 characters or less' },
        { status: 400 },
      );
    }

    const clampedW = Math.min(2048, Math.max(64, Math.round(width)));
    const clampedH = Math.min(2048, Math.max(64, Math.round(height)));

    const jobResult = await runAiJob(
      {
        type: 'generate',
        input: {
          prompt,
          width: clampedW,
          height: clampedH,
          style: 'photorealistic',
          name: null,
          model: null,
        },
      },
      async ({ orgId, userId }) => {
        const aiProviderConfig = await getOrgAiProviderConfig(orgId);
        const modelConfig =
          getDefaultModelForProviderCapability(aiProviderConfig.provider, 'generate')
          ?? getDefaultModelForProviderCapability('vertex', 'generate');

        if (!modelConfig) {
          throw new Error('No image generation model is configured');
        }

        // Refine prompt
        const refinedPrompt = await refinePrompt({
          mode: 'generate',
          prompt,
          width: clampedW,
          height: clampedH,
          orgId,
          providerOverride: aiProviderConfig.provider,
          openAiApiKey: aiProviderConfig.openAiApiKey,
        });

        const fullPrompt = [
          refinedPrompt,
          `Generate the image at ${clampedW}x${clampedH} pixels.`,
          'High quality, detailed output.',
        ].join(' ');

        const imageResult = aiProviderConfig.provider === 'openai'
          ? await generateOpenAiImage({
            orgId,
            apiKey: aiProviderConfig.openAiApiKey,
            model: modelConfig.modelId,
            prompt: fullPrompt,
            width: clampedW,
            height: clampedH,
          })
          : parseImageResponse(
            await (await getGeminiImageGenModel(orgId, modelConfig.modelId)).generateContent({
              contents: [
                {
                  role: 'user' as const,
                  parts: textPromptParts(fullPrompt),
                },
              ],
            }),
          );

        if (!imageResult) {
          throw new Error('AI did not generate an image');
        }

        const ext = imageResult.mimeType.split('/')[1] || 'png';
        const storageKey = `assets/${orgId}/design-images/section-${Date.now()}.${ext}`;

        // Ensure "Design Images" folder exists for this org
        const designFolderId = await ensureDesignImagesFolder(orgId, userId);

        // Upload to GCS
        await uploadBuffer(
          storageKey,
          imageResult.imageData,
          imageResult.mimeType,
          { source: 'design-section', prompt: prompt.slice(0, 200) },
          undefined,
          orgId,
        );

        // Create Asset record so it shows in user's library under Design Images
        const newAsset = await Asset.create({
          orgId,
          folderId: designFolderId,
          uploadedById: userId,
          name: `section-${Date.now()}.${ext}`,
          originalName: `section-gen.${ext}`,
          storageKey,
          mimeType: imageResult.mimeType,
          sizeBytes: imageResult.imageData.length,
          width: clampedW,
          height: clampedH,
          tags: ['ai-generated', 'design-section'],
          aiTagsGenerated: false,
          customMetadata: {
            aiPrompt: prompt.slice(0, 500),
            source: 'design-section',
          },
        });

        // Generate inline thumbnail for quick display
        try {
          const sharp = (await import('sharp')).default;
          const inlineBuffer = await sharp(imageResult.imageData)
            .resize(400, 400, { fit: 'inside', withoutEnlargement: true })
            .webp({ quality: 75 })
            .toBuffer();

          const thumbKey = `thumbnails/${storageKey.replace(/\.[^.]+$/, '')}.webp`;
          const gcsBucket = await getGcsBucket(orgId);
          await gcsBucket.file(thumbKey).save(inlineBuffer, {
            metadata: { contentType: 'image/webp' },
          });
          newAsset.thumbnailStorageKey = thumbKey;
          newAsset.thumbnailBase64 = `data:image/webp;base64,${inlineBuffer.toString('base64')}`;
          await newAsset.save();
        } catch {
          // Non-fatal — thumbnail generation failed
        }

        // Return a proxy URL the canvas can use directly
        const imageUrl = `/api/assets/download?assetId=${String(newAsset._id)}&size=original&inline=1`;

        return { imageUrl, assetId: String(newAsset._id) };
      },
    );

    if (jobResult.status === 'completed' && jobResult.result) {
      return NextResponse.json({
        imageUrl: jobResult.result.imageUrl,
        assetId: jobResult.result.assetId,
      });
    }

    return NextResponse.json(
      { error: jobResult.error || 'Generation failed' },
      { status: 500 },
    );
  } catch (err: unknown) {
    const status = (err as { status?: number }).status ?? 500;
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status });
  }
}
