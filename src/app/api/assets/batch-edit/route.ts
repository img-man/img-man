// SPDX-License-Identifier: Apache-2.0
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { connectToDatabase } from '@/lib/db';
import { Asset, User } from '@/models';
import { getGcsBucket } from '@/lib/storage';
import sharp from 'sharp';
import { canPerform, type Role } from '@/lib/permissions';

/**
 * POST /api/assets/batch-edit
 * Apply the same photo adjustments to multiple assets.
 *
 * Body: {
 *   assetIds: string[],          // max 20
 *   adjustments: Record<string, number>,
 *   mode: 'copy' | 'overwrite'   // default 'copy'
 * }
 *
 * Each asset is processed independently. Partial failures are tolerated.
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await connectToDatabase();
  const user = await User.findOne({ email: session.user.email }).lean();
  if (!user?.orgId) {
    return NextResponse.json({ error: 'No organization' }, { status: 400 });
  }

  if (!canPerform((user.role as Role) ?? 'viewer', 'edit')) {
    return NextResponse.json(
      { error: 'Insufficient permissions' },
      { status: 403 },
    );
  }

  const body = await req.json();
  const { assetIds, adjustments, mode = 'copy' } = body;

  if (!Array.isArray(assetIds) || assetIds.length === 0) {
    return NextResponse.json(
      { error: 'No asset IDs provided' },
      { status: 400 },
    );
  }
  if (assetIds.length > 20) {
    return NextResponse.json(
      { error: 'Maximum 20 assets per batch edit' },
      { status: 400 },
    );
  }
  if (!adjustments || typeof adjustments !== 'object') {
    return NextResponse.json(
      { error: 'adjustments object is required' },
      { status: 400 },
    );
  }

  const bucket = await getGcsBucket(String(user.orgId));
  const results: {
    assetId: string;
    success: boolean;
    error?: string;
    newAssetId?: string;
  }[] = [];

  // Process assets sequentially to avoid OOM with large images
  for (const assetId of assetIds) {
    try {
      const asset = await Asset.findOne({
        _id: assetId,
        orgId: user.orgId,
        isDeleted: { $ne: true },
      }).lean();

      if (!asset) {
        results.push({ assetId, success: false, error: 'Not found' });
        continue;
      }

      if (!asset.mimeType?.startsWith('image/')) {
        results.push({ assetId, success: false, error: 'Not an image' });
        continue;
      }

      // Download from GCS
      const [buffer] = await bucket.file(asset.storageKey).download();

      // Build Sharp pipeline
      let pipeline = sharp(buffer);

      // Apply brightness (map -100..100 → 0.0..2.0 multiplier)
      if (adjustments.brightness && adjustments.brightness !== 0) {
        const factor = 1 + adjustments.brightness / 100;
        pipeline = pipeline.modulate({ brightness: factor });
      }

      // Apply saturation (map -100..100 → 0.0..2.0)
      if (adjustments.saturation && adjustments.saturation !== 0) {
        const factor = 1 + adjustments.saturation / 100;
        pipeline = pipeline.modulate({ saturation: factor });
      }

      // Apply contrast via linear
      if (adjustments.contrast && adjustments.contrast !== 0) {
        const a = 1 + adjustments.contrast / 100;
        const b = 128 * (1 - a);
        pipeline = pipeline.linear(a, b);
      }

      // Apply sharpen
      if (adjustments.sharpen && adjustments.sharpen > 0) {
        const sigma = 0.5 + (adjustments.sharpen / 100) * 2;
        pipeline = pipeline.sharpen({ sigma });
      }

      // Apply blur (dehaze inverted — higher dehaze = sharpen more, but we also support blur)
      if (adjustments.blur && adjustments.blur > 0) {
        const sigma = 0.3 + (adjustments.blur / 100) * 10;
        pipeline = pipeline.blur(sigma);
      }

      // Grayscale (for B&W presets, saturation=-100 triggers)
      if (adjustments.saturation && adjustments.saturation <= -95) {
        pipeline = pipeline.greyscale();
      }

      const resultBuffer = await pipeline.toBuffer();
      const metadata = await sharp(resultBuffer).metadata();

      // Generate thumbnail
      const thumbBuffer = await sharp(resultBuffer)
        .resize(200, 200, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 60 })
        .toBuffer();
      const thumbnailBase64 = `data:image/webp;base64,${thumbBuffer.toString('base64')}`;

      const editRecord = {
        adjustments,
        cropSettings: null,
        annotations: [],
        timestamp: new Date(),
        userId: user._id,
        mode,
      };

      if (mode === 'overwrite') {
        // Store original if first edit
        if (!asset.originalStorageKey) {
          const backupKey = `${asset.storageKey}.original`;
          await bucket.file(asset.storageKey).copy(bucket.file(backupKey));
          await Asset.updateOne(
            { _id: assetId },
            {
              $set: { originalStorageKey: backupKey },
              $push: { edits: editRecord },
            },
          );
        } else {
          await Asset.updateOne(
            { _id: assetId },
            { $push: { edits: editRecord } },
          );
        }

        // Write edited version
        await bucket.file(asset.storageKey).save(resultBuffer, {
          metadata: { contentType: asset.mimeType },
        });

        await Asset.updateOne(
          { _id: assetId },
          {
            $set: {
              sizeBytes: resultBuffer.length,
              width: metadata.width,
              height: metadata.height,
              thumbnailBase64,
            },
          },
        );

        results.push({ assetId, success: true });
      } else {
        // Copy mode: create new asset
        const ext = asset.name.split('.').pop() || 'png';
        const baseName = asset.name.replace(/\.[^.]+$/, '');
        const newName = `${baseName}_edited.${ext}`;
        const newStorageKey = `orgs/${user.orgId}/assets/${Date.now()}_${newName}`;

        await bucket.file(newStorageKey).save(resultBuffer, {
          metadata: { contentType: asset.mimeType },
        });

        const newAsset = await Asset.create({
          orgId: user.orgId,
          folderId: asset.folderId || null,
          uploadedById: user._id,
          name: newName,
          originalName: newName,
          storageKey: newStorageKey,
          thumbnailBase64,
          mimeType: asset.mimeType,
          sizeBytes: resultBuffer.length,
          width: metadata.width,
          height: metadata.height,
          tags: asset.tags ?? [],
          userTags: asset.userTags ?? [],
          edits: [editRecord],
          isCopy: true,
          copyOfAssetId: assetId,
        });

        results.push({
          assetId,
          success: true,
          newAssetId: (newAsset._id as unknown as string).toString(),
        });
      }
    } catch (err) {
      console.error(`[BatchEdit] Failed for ${assetId}:`, err);
      results.push({
        assetId,
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  const succeeded = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  console.log(
    `[BatchEdit] Completed: ${succeeded} succeeded, ${failed} failed`,
  );

  return NextResponse.json({
    results,
    summary: { total: assetIds.length, succeeded, failed },
  });
}
