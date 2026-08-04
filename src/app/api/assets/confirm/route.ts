// SPDX-License-Identifier: Apache-2.0
import { NextRequest, NextResponse } from 'next/server';
import { getActorFromRequest, isActorErrorResponse } from '@/lib/actor-auth';
import { connectToDatabase } from '@/lib/db';
import { Asset, Organization, AiJob } from '@/models';
import { canPerform } from '@/lib/permissions';
import { trackBandwidth } from '@/lib/bandwidth';
import { getGcsBucket } from '@/lib/storage';
import { BLOCKED_EXTENSIONS } from '@/lib/file-types';

/**
 * POST /api/assets/confirm
 * Body: { storageKey, name, originalName, mimeType, sizeBytes, width?, height?,
 *         duration?, fileCategory?, pageCount?, thumbnailBase64?, folderId? }
 * Creates the Asset document after successful upload to GCS.
 * Also tracks upload bandwidth and increments org storage usage.
 *
 * Auth: NextAuth session OR Bearer token (`imgt_…` / `img_…`).
 */
export async function POST(req: NextRequest) {
  const actor = await getActorFromRequest(req, 'write');
  if (isActorErrorResponse(actor)) return actor;

  await connectToDatabase();

  // RBAC: require upload permission (editor+)
  if (!canPerform(actor.role, 'upload')) {
    return NextResponse.json(
      { error: 'Insufficient permissions' },
      { status: 403 },
    );
  }

  const body = await req.json();
  const {
    storageKey,
    name,
    originalName,
    mimeType,
    sizeBytes,
    width,
    height,
    duration,
    fileCategory,
    pageCount,
    thumbnailBase64: clientThumbnailBase64,
    folderId,
  } = body;

  if (!storageKey || !originalName || !mimeType || !sizeBytes) {
    return NextResponse.json(
      {
        error: 'storageKey, originalName, mimeType, and sizeBytes are required',
      },
      { status: 400 },
    );
  }

  // Server-side blocked extension check (defense-in-depth)
  const ext = originalName.split('.').pop()?.toLowerCase() ?? '';
  if (BLOCKED_EXTENSIONS.has(ext)) {
    return NextResponse.json(
      { error: `File extension .${ext} is blocked for security reasons` },
      { status: 400 },
    );
  }

  const orgIdStr = actor.orgId;

  const [asset] = await Promise.all([
    Asset.create({
      orgId: actor.orgId,
      folderId: folderId || undefined,
      uploadedById: actor.userId || undefined,
      name: name || originalName,
      originalName,
      storageKey,
      mimeType,
      sizeBytes,
      width,
      height,
      duration: duration || undefined,
      pageCount: pageCount || undefined,
      fileCategory: fileCategory || 'other',
      // If client sent a video thumbnail, store it inline immediately
      thumbnailBase64: clientThumbnailBase64 || undefined,
    }),
    // Track upload bandwidth
    trackBandwidth(orgIdStr, 'upload', sizeBytes),
    // Increment org storage usage
    Organization.updateOne(
      { _id: actor.orgId },
      { $inc: { 'usage.storageBytes': sizeBytes } },
    ),
  ]);

  // Fire-and-forget: generate thumbnails in background (non-blocking)
  void generateThumbnails(
    (asset._id as unknown as string).toString(),
    storageKey,
    mimeType,
    orgIdStr,
  );

  // Fire-and-forget: auto-AI processing based on org config (non-blocking)
  if (mimeType.startsWith('image/')) {
    void autoAiOnUpload(
      orgIdStr,
      actor.userId || orgIdStr,
      (asset._id as unknown as string).toString(),
      storageKey,
      mimeType,
      asset.width,
      asset.height,
    );
    // Fire-and-forget: generate embedding + perceptual hash + dominant colors (non-blocking)
    void generateAssetIntelligence(
      (asset._id as unknown as string).toString(),
      storageKey,
      mimeType,
      orgIdStr,
    );
  }

  return NextResponse.json({ asset }, { status: 201 });
}

/**
 * Generate thumbnails for an asset after creation.
 * - 400px WebP uploaded to GCS (thumbnailStorageKey)
 * - 200px WebP base64 saved inline in MongoDB (thumbnailBase64)
 * Non-fatal: failures are logged but don't break the upload flow.
 */
async function generateThumbnails(
  assetId: string,
  storageKey: string,
  mimeType: string,
  orgId: string,
) {
  // Only generate thumbnails for images
  if (!mimeType.startsWith('image/')) return;

  try {
    const sharp = (await import('sharp')).default;
    const bucket = await getGcsBucket(orgId);

    // Download original from GCS
    const [originalBuffer] = await bucket.file(storageKey).download();

    // Generate both thumbnail sizes in parallel
    const [thumbBuffer, inlineBuffer] = await Promise.all([
      sharp(originalBuffer)
        .resize(400, 400, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer(),
      sharp(originalBuffer)
        .resize(200, 200, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 60 })
        .toBuffer(),
    ]);

    // Upload 400px thumbnail to GCS
    const thumbKey = `thumbnails/${storageKey.replace(/\.[^.]+$/, '')}.webp`;
    await bucket.file(thumbKey).save(thumbBuffer, {
      metadata: { contentType: 'image/webp' },
    });

    // Save both references to MongoDB
    const base64 = `data:image/webp;base64,${inlineBuffer.toString('base64')}`;
    await Asset.updateOne(
      { _id: assetId },
      { $set: { thumbnailStorageKey: thumbKey, thumbnailBase64: base64 } },
    );

    console.log(`[Confirm] Thumbnail created for asset ${assetId}`);
  } catch (err) {
    console.error('[Confirm] Thumbnail generation failed (non-fatal):', err);
  }
}

/**
 * Auto-run AI features on upload based on org's aiFeatureConfig.
 * Checks for 'auto' mode on each feature and queues jobs accordingly.
 * Non-fatal: failures are logged but don't break the upload flow.
 */
async function autoAiOnUpload(
  orgId: string,
  userId: string,
  assetId: string,
  storageKey: string,
  mimeType: string,
  width?: number,
  height?: number,
) {
  try {
    const org = await Organization.findById(orgId)
      .select('aiFeatureConfig')
      .lean();
    if (!org) return;

    // aiFeatureConfig is stored as a Map — convert to plain object
    const config = (
      org as unknown as {
        aiFeatureConfig?:
          | Map<string, { mode: string; minRole: number }>
          | Record<string, { mode: string; minRole: number }>;
      }
    ).aiFeatureConfig;

    if (!config) return;

    // Normalize Map to plain object
    const featureMap: Record<string, { mode: string; minRole: number }> =
      config instanceof Map ? Object.fromEntries(config) : config;

    const { analyzeImageTags, detectImageFaces } = await import('@/lib/ai-analysis');
    const { getGcsBucket: getBucket } = await import('@/lib/storage');

    // Download image once for both AI features
    let imageBase64: string | null = null;
    const needsAi =
      featureMap.auto_tag?.mode === 'auto' ||
      featureMap.face_detect?.mode === 'auto';
    if (needsAi) {
      try {
        const aiBucket = await getBucket(orgId);
        const [buffer] = await aiBucket.file(storageKey).download();
        imageBase64 = buffer.toString('base64');
      } catch (err) {
        console.error(
          '[AutoAI] Failed to download image for AI processing:',
          err,
        );
        return;
      }
    }

    // ── Auto-tag ──────────────────────────────────────────────────
    if (featureMap.auto_tag?.mode === 'auto' && imageBase64) {
      try {
        const job = await AiJob.create({
          orgId,
          assetId,
          userId,
          type: 'auto_tag',
          status: 'processing',
          startedAt: new Date(),
        });

        const { parsed, tags } = await analyzeImageTags({
          imageBase64,
          mimeType,
          orgId,
        });

        await Asset.updateOne(
          { _id: assetId },
          {
            $set: {
              tags,
              originalAiTags: tags,
              aiTagsGenerated: true,
            },
          },
        );

        job.status = 'completed';
        job.result = parsed;
        job.completedAt = new Date();
        await job.save();

        console.log(
          `[AutoAI] Auto-tagged asset ${assetId} with ${tags.length} tags`,
        );

      } catch (err) {
        console.error('[AutoAI] Auto-tag failed (non-fatal):', err);
        // Mark job as failed so it doesn't stay stuck in 'processing'
        try {
          await AiJob.updateOne(
            { orgId, assetId, type: 'auto_tag', status: 'processing' },
            {
              $set: {
                status: 'failed',
                error: err instanceof Error ? err.message : String(err),
                completedAt: new Date(),
              },
            },
          );
        } catch {
          /* ignore */
        }
      }
    }

    // ── Auto face-detect ──────────────────────────────────────────
    if (featureMap.face_detect?.mode === 'auto' && imageBase64) {
      try {
        const job = await AiJob.create({
          orgId,
          assetId,
          userId,
          type: 'face_detect',
          status: 'processing',
          startedAt: new Date(),
        });

        const { faces } = await detectImageFaces({
          imageBase64,
          imageHeight: height ?? 1000,
          imageWidth: width ?? 1000,
          mimeType,
          orgId,
        });

        await Asset.updateOne({ _id: assetId }, { $set: { faces } });

        job.status = 'completed';
        job.result = { facesDetected: faces.length, faces };
        job.completedAt = new Date();
        await job.save();

        console.log(
          `[AutoAI] Face-detected asset ${assetId}: ${faces.length} faces`,
        );

      } catch (err) {
        console.error('[AutoAI] Face-detect failed (non-fatal):', err);
        // Mark job as failed so it doesn't stay stuck in 'processing'
        try {
          await AiJob.updateOne(
            { orgId, assetId, type: 'face_detect', status: 'processing' },
            {
              $set: {
                status: 'failed',
                error: err instanceof Error ? err.message : String(err),
                completedAt: new Date(),
              },
            },
          );
        } catch {
          /* ignore */
        }
      }
    }
  } catch (err) {
    console.error('[AutoAI] autoAiOnUpload failed (non-fatal):', err);
  }
}

/**
 * Sprint 9: Generate embedding, perceptual hash, and dominant colors for an image.
 * This runs asynchronously after upload confirmation and updates the Asset document.
 * Non-fatal: failures are logged but don't break the upload flow.
 */
async function generateAssetIntelligence(
  assetId: string,
  storageKey: string,
  mimeType: string,
  orgId: string,
) {
  const isVertexServiceDisabledError = (error: unknown) =>
    error instanceof Error &&
    (error.message.includes('SERVICE_DISABLED') ||
      error.message.includes('aiplatform.googleapis.com/overview'));

  try {
    const { getGcsBucket: getBucket } = await import('@/lib/storage');
    const { generateImageEmbedding } = await import('@/lib/embeddings');
    const { extractExifData } = await import('@/lib/exif-extraction');

    // Download image from GCS
    const bucket = await getBucket(orgId);
    const [buffer] = await bucket.file(storageKey).download();

    // Run embedding generation, image analysis, and EXIF extraction in parallel
    const imageBase64 = buffer.toString('base64');

    const [embeddingResult, hashAndColors, exifData] = await Promise.all([
      generateImageEmbedding(imageBase64, mimeType, orgId).catch((err) => {
        if (isVertexServiceDisabledError(err)) {
          console.warn(
            `[Intelligence] Embedding skipped for ${assetId}: Vertex AI API is disabled for this project.`,
          );
        } else {
          console.error(`[Intelligence] Embedding failed for ${assetId}:`, err);
        }
        return null;
      }),
      extractHashAndColors(buffer).catch((err) => {
        console.error(`[Intelligence] Hash/colors failed for ${assetId}:`, err);
        return null;
      }),
      extractExifData(buffer).catch((err) => {
        console.error(
          `[Intelligence] EXIF extraction failed for ${assetId}:`,
          err,
        );
        return null;
      }),
    ]);

    // Build the update object with whatever succeeded
    const updateDoc: Record<string, unknown> = {};

    if (embeddingResult) {
      updateDoc.embedding = embeddingResult.embedding;
      updateDoc.embeddingModel = embeddingResult.model;
      updateDoc.embeddedAt = embeddingResult.generatedAt;
    }

    if (hashAndColors) {
      if (hashAndColors.perceptualHash) {
        updateDoc.perceptualHash = hashAndColors.perceptualHash;
      }
      if (hashAndColors.dominantColors?.length) {
        updateDoc.dominantColors = hashAndColors.dominantColors;
      }
    }

    if (exifData) {
      updateDoc.exif = exifData;
    }

    if (Object.keys(updateDoc).length > 0) {
      await Asset.updateOne({ _id: assetId }, { $set: updateDoc });
      console.log(
        `[Intelligence] Updated asset ${assetId}: ` +
          `embedding=${!!embeddingResult}, ` +
          `hash=${!!hashAndColors?.perceptualHash}, ` +
          `colors=${hashAndColors?.dominantColors?.length ?? 0}, ` +
          `exif=${!!exifData}, gps=${!!exifData?.gps}`,
      );
    }
  } catch (err) {
    console.error('[Intelligence] generateAssetIntelligence failed:', err);
  }
}

/**
 * Extract perceptual hash and dominant colors from an image buffer.
 * Uses sharp for lightweight image analysis.
 */
async function extractHashAndColors(
  buffer: Buffer,
): Promise<{ perceptualHash: string | null; dominantColors: string[] }> {
  const sharp = (await import('sharp')).default;

  // ── Perceptual Hash (dHash - Difference Hash) ──────────────
  // Resize to 9x8 grayscale, compare adjacent pixels → 64-bit hash
  let perceptualHash: string | null = null;
  try {
    const hashBuffer = await sharp(buffer)
      .greyscale()
      .resize(9, 8, { fit: 'fill' })
      .raw()
      .toBuffer();

    // Compare each pixel with the one to its right
    let hash = '';
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const idx = row * 9 + col;
        hash += hashBuffer[idx] < hashBuffer[idx + 1] ? '1' : '0';
      }
    }
    // Convert binary string to hex for compact storage
    perceptualHash = '';
    for (let i = 0; i < 64; i += 4) {
      perceptualHash += parseInt(hash.substring(i, i + 4), 2).toString(16);
    }
  } catch (err) {
    console.error('[Intelligence] dHash generation failed:', err);
  }

  // ── Dominant Colors ────────────────────────────────────────
  // Use sharp stats to extract dominant channel values,
  // then sample a small palette using k-means-like quantization
  const dominantColors: string[] = [];
  try {
    // Resize to small image and extract raw pixel data for color analysis
    const smallBuf = await sharp(buffer)
      .resize(64, 64, { fit: 'cover' })
      .removeAlpha()
      .raw()
      .toBuffer();

    // Simple color quantization: bucket pixels into color groups
    const colorBuckets = new Map<string, number>();
    for (let i = 0; i < smallBuf.length; i += 3) {
      const r = Math.round(smallBuf[i] / 32) * 32;
      const g = Math.round(smallBuf[i + 1] / 32) * 32;
      const b = Math.round(smallBuf[i + 2] / 32) * 32;
      const key = `${r},${g},${b}`;
      colorBuckets.set(key, (colorBuckets.get(key) || 0) + 1);
    }

    // Sort by frequency and take top 5
    const sorted = [...colorBuckets.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    for (const [rgb] of sorted) {
      const [r, g, b] = rgb.split(',').map(Number);
      const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
      dominantColors.push(hex);
    }
  } catch (err) {
    console.error('[Intelligence] Dominant color extraction failed:', err);
  }

  return { perceptualHash, dominantColors };
}
