// SPDX-License-Identifier: Apache-2.0
import { NextRequest, NextResponse } from 'next/server';
import { runAiJob } from '@/lib/ai-pipeline';
import { requirePermission } from '@/lib/auth-context';
import { refinePrompt } from '@/lib/prompt-refiner';
import { getOrgAiProviderConfig } from '@/lib/ai-provider-config';
import { generateOpenAiImage } from '@/lib/openai';
import { applyAiImageEdit } from '@/lib/ai-image-edits';
import {
 getGeminiImageGenModel,
 parseImageResponse,
 textPromptParts,
} from '@/lib/vertex-ai';
import { uploadBuffer, getGcsBucket } from '@/lib/storage';
import { Asset } from '@/models';
import { DEFAULT_GEN_MODEL, resolveModelForProviderCapability } from '@/lib/ai-models';
import { ensureDesignImagesFolder } from '@/lib/design-images-folder';

/**
 * POST /api/ai/generate
 * Body: { prompt, width?, height?, style?, name?, model? }
 *
 * AI image generation — creates a new image from a text prompt
 * and saves it as a new Asset in the user's library.
 */

const STYLE_PROMPTS: Record<string, string> = {
 photorealistic:
 'Photorealistic style with natural lighting, accurate shadows, and fine details.',
 illustration:
 'Digital illustration style with clean lines and vibrant colors.',
 icon: 'Clean, minimal icon design suitable for UI/UX, flat design aesthetic.',
 '3d-render':
 '3D rendered scene with realistic materials, global illumination, and depth of field.',
 watercolor:
 'Watercolor painting style with soft edges, color bleeding, and paper texture.',
 minimalist: 'Minimalist design with simple shapes, limited color palette, and lots of white space.',
};

export async function POST(req: NextRequest) {
 try {
 const body = await req.json();
 const {
 prompt,
 width = 1024,
 height = 1024,
 style = 'photorealistic',
 name,
 model: modelId,
 sourceAssetId,
 } = body;

 const isEdit = !!sourceAssetId;

 if (!prompt || typeof prompt !== 'string') {
 return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
 }

 if (prompt.length > 2000) {
 return NextResponse.json(
 { error: 'Prompt must be 2000 characters or less' },
 { status: 400 },
 );
 }

 if (width > 4096 || height > 4096 || width < 64 || height < 64) {
 return NextResponse.json(
 { error: 'Dimensions must be between 64 and 4096' },
 { status: 400 },
 );
 }

 const ctx = await requirePermission('ai');
 const aiProviderConfig = await getOrgAiProviderConfig(ctx.orgId);
 const activeGenerationProvider =
 aiProviderConfig.provider === 'openai' ? 'openai' : 'vertex';
 const modelConfig =
 resolveModelForProviderCapability(
 activeGenerationProvider,
 isEdit ? 'edit' : 'generate',
 typeof modelId === 'string' ? modelId : undefined,
 ) ?? DEFAULT_GEN_MODEL;

 const jobResult = await runAiJob(
 {
 type: isEdit ? 'edit' : 'generate',
 input: { prompt, width, height, style, name, model: modelConfig.id, sourceAssetId },
 },
 async ({ orgId, userId }) => {
 // If editing, fetch source image from GCS
 let sourceImageBase64: string | null = null;
 let sourceMimeType = 'image/png';
 let sourceStorageKey: string | null = null;
 if (sourceAssetId) {
 const sourceAsset = await Asset.findOne({ _id: sourceAssetId, orgId });
 if (!sourceAsset) throw new Error('Source asset not found');
 sourceStorageKey = sourceAsset.storageKey;
 sourceMimeType = sourceAsset.mimeType;
 if (activeGenerationProvider !== 'openai') {
 // Vertex path inlines the bytes directly into the request.
 const srcBucket = await getGcsBucket(orgId);
 const [srcBuffer] = await srcBucket.file(sourceAsset.storageKey).download();
 sourceImageBase64 = srcBuffer.toString('base64');
 }
 }

 // Refine user prompt with Gemini Flash for better results
 const refinedPrompt = await refinePrompt({
 mode: isEdit ? 'edit' : 'generate',
 prompt,
 style: isEdit ? undefined : style,
 width,
 height,
 orgId,
 providerOverride: activeGenerationProvider,
 openAiApiKey: aiProviderConfig.openAiApiKey,
 });

 // Build enriched prompt
 const styleHint = isEdit ? '' : (STYLE_PROMPTS[style] ?? '');
 const fullPrompt = isEdit
 ? `Edit this image: ${refinedPrompt}`
 : [
 refinedPrompt,
 styleHint,
 `Generate the image at ${width}x${height} pixels.`,
 'High quality, detailed output.',
 ]
 .filter(Boolean)
 .join(' ');

 let imageResult;

 if (activeGenerationProvider === 'openai' && isEdit && sourceStorageKey) {
  const { getSignedDownloadUrl } = await import('@/lib/storage');
  const signedSourceUrl = await getSignedDownloadUrl(
   sourceStorageKey,
   60 * 10,
   undefined,
   orgId,
  );
  imageResult = await applyAiImageEdit({
   capability: 'image.edit',
   orgId,
   imageUrl: signedSourceUrl,
   mimeType: sourceMimeType,
   prompt: fullPrompt,
   width,
   height,
  });
 } else if (activeGenerationProvider === 'openai') {
  imageResult = await generateOpenAiImage({
   orgId,
   apiKey: aiProviderConfig.openAiApiKey,
    model: modelConfig.modelId,
   prompt: fullPrompt,
   width,
   height,
  });
 } else {
  const model = await getGeminiImageGenModel(orgId, modelConfig.modelId);
  const contents = sourceImageBase64
  ? [
  {
  role: 'user' as const,
  parts: [
  { inlineData: { mimeType: sourceMimeType, data: sourceImageBase64 } },
  { text: fullPrompt },
  ],
  },
  ]
  : [
  {
  role: 'user' as const,
  parts: textPromptParts(fullPrompt),
  },
  ];

  const result = await model.generateContent({ contents });
  imageResult = parseImageResponse(result);
 }

 if (!imageResult) {
 throw new Error('AI did not generate an image');
 }

 // Determine file extension and name
 const ext = imageResult.mimeType.split('/')[1] || 'png';
 const assetName = name || `ai-${isEdit ? 'edited' : 'generated'}-${Date.now()}`;
 const storageKey = `assets/${orgId}/design-images/${assetName}-${Date.now()}.${ext}`;

 // Ensure "Design Images" folder exists for this org
 const designFolderId = await ensureDesignImagesFolder(orgId, userId);

 // Upload to GCS
 await uploadBuffer(
 storageKey,
 imageResult.imageData,
 imageResult.mimeType,
 { source: isEdit ? 'ai-edit' : 'ai-generate', prompt: prompt.slice(0, 200) },
 undefined,
 orgId,
 );

 // Create new Asset record in Design Images folder
 const newAsset = await Asset.create({
 orgId,
 folderId: designFolderId,
 uploadedById: userId,
 name: `${assetName}.${ext}`,
 originalName: `${assetName}.${ext}`,
 storageKey,
 mimeType: imageResult.mimeType,
 sizeBytes: imageResult.imageData.length,
 width,
 height,
 tags: isEdit ? ['ai-edited'] : ['ai-generated', style],
 aiTagsGenerated: false,
 customMetadata: {
 aiPrompt: prompt.slice(0, 500),
 aiStyle: isEdit ? 'edit' : style,
 ...(sourceAssetId && { sourceAssetId }),
 },
 });

 // Generate thumbnails (400px GCS + 200px base64 MongoDB)
 try {
 const sharp = (await import('sharp')).default;
 const [thumbBuffer, inlineBuffer] = await Promise.all([
 sharp(imageResult.imageData)
 .resize(400, 400, { fit: 'inside', withoutEnlargement: true })
 .webp({ quality: 80 })
 .toBuffer(),
 sharp(imageResult.imageData)
 .resize(200, 200, { fit: 'inside', withoutEnlargement: true })
 .webp({ quality: 60 })
 .toBuffer(),
 ]);

 const thumbKey = `thumbnails/${storageKey.replace(/\.[^.]+$/, '')}.webp`;
 const gcsBucket = await getGcsBucket(orgId);
 await gcsBucket.file(thumbKey).save(thumbBuffer, {
 metadata: { contentType: 'image/webp' },
 });

 const base64 = `data:image/webp;base64,${inlineBuffer.toString('base64')}`;
 newAsset.thumbnailStorageKey = thumbKey;
 newAsset.thumbnailBase64 = base64;
 await newAsset.save();
 console.log(`[AI Generate] Thumbnail created for asset ${String(newAsset._id)}`);
 } catch (thumbErr) {
 console.error('[AI Generate] Thumbnail generation failed (non-fatal):', thumbErr);
 }

 return {
 assetId: newAsset._id.toString(),
 storageKey,
 name: newAsset.name,
 format: ext,
 width,
 height,
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
