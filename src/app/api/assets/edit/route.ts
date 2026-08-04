// SPDX-License-Identifier: Apache-2.0
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { connectToDatabase } from '@/lib/db';
import { Asset, User } from '@/models';
import { getGcsBucket, getSignedDownloadUrl } from '@/lib/storage';
import sharp from 'sharp';
import { canPerform, type Role } from '@/lib/permissions';

/**
 * POST /api/assets/edit
 *
 * Applies photo adjustments, crop settings, and annotations to an asset.
 * Supports two modes:
 *   - "copy": Create a new asset with the edits applied (non-destructive)
 *   - "overwrite": Apply edits in-place (stores original for revert)
 *
 * Body: {
 *   assetId: string,
 *   adjustments: PhotoAdjustments,
 *   cropSettings?: CropSettings,
 *   annotations?: Annotation[],
 *   mode: 'copy' | 'overwrite'
 * }
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

  // RBAC: require edit permission (editor+)
  if (!canPerform((user.role as Role) ?? 'viewer', 'edit')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const body = await req.json();
  const {
    assetId,
    adjustments = {},
    cropSettings,
    annotations,
    mode = 'copy',
  } = body;

  if (!assetId) {
    return NextResponse.json({ error: 'Missing assetId' }, { status: 400 });
  }

  const asset = await Asset.findOne({
    _id: assetId,
    orgId: user.orgId,
    isDeleted: { $ne: true },
  }).lean();

  if (!asset) {
    return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
  }

  try {
    // 1. Download original from GCS
    const bucket = await getGcsBucket(String(user.orgId));
    const [buffer] = await bucket.file(asset.storageKey).download();

    // 2. Build Sharp pipeline from adjustment parameters
    let pipeline = sharp(buffer);

    // Apply brightness: map -100..+100 → 0.5..1.5 multiplier
    if (adjustments.brightness && adjustments.brightness !== 0) {
      const brightnessVal = 1 + adjustments.brightness / 200;
      pipeline = pipeline.modulate({ brightness: brightnessVal });
    }

    // Apply saturation: map -100..+100 → 0..2
    if (adjustments.saturation && adjustments.saturation !== 0) {
      const satVal = 1 + adjustments.saturation / 100;
      pipeline = pipeline.modulate({ saturation: Math.max(0, satVal) });
    }

    // B&W (saturation = -100)
    if (adjustments.saturation === -100) {
      pipeline = pipeline.greyscale();
    }

    // Apply contrast via linear transform
    if (adjustments.contrast && adjustments.contrast !== 0) {
      // Map -100..+100 → 0.5..1.5 for contrast (a), offset (b) stays 0
      const a = 1 + adjustments.contrast / 200;
      const b = 128 * (1 - a); // center on 128
      pipeline = pipeline.linear(a, b);
    }

    // Apply exposure via brightness multiplier
    if (adjustments.exposure && adjustments.exposure !== 0) {
      const exposureMultiplier = Math.pow(2, adjustments.exposure);
      pipeline = pipeline.modulate({ brightness: exposureMultiplier });
    }

    // Apply sharpen
    if (adjustments.sharpen && adjustments.sharpen > 0) {
      const sigma = 1 + (adjustments.sharpen / 100) * 2;
      pipeline = pipeline.sharpen(sigma);
    }

    // Apply crop settings
    if (cropSettings) {
      // Fine rotation
      if (cropSettings.rotation && cropSettings.rotation !== 0) {
        pipeline = pipeline.rotate(cropSettings.rotation, {
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        });
      }

      // Flip
      if (cropSettings.flipH) pipeline = pipeline.flop();
      if (cropSettings.flipV) pipeline = pipeline.flip();
    }

    // Apply vignette via Sharp compositing (dark radial gradient overlay)
    if (adjustments.vignette && adjustments.vignette !== 0) {
      const meta = await sharp(buffer).metadata();
      const w = meta.width || 800;
      const h = meta.height || 600;
      const intensity = Math.abs(adjustments.vignette) / 100;
      const opacity = Math.round(intensity * 0.7 * 255);
      const isLight = adjustments.vignette < 0;
      const rgb = isLight ? '255,255,255' : '0,0,0';

      const vignetteSvg = `<svg width="${w}" height="${h}">
        <defs>
          <radialGradient id="v" cx="50%" cy="50%" r="70%">
            <stop offset="40%" stop-color="rgba(${rgb},0)" />
            <stop offset="100%" stop-color="rgba(${rgb},${opacity/255})" />
          </radialGradient>
        </defs>
        <rect width="${w}" height="${h}" fill="url(#v)" />
      </svg>`;

      pipeline = pipeline.composite([
        {
          input: Buffer.from(vignetteSvg),
          gravity: 'centre',
        },
      ]);
    }

    // 3. Produce the result
    const resultBuffer = await pipeline.toBuffer();
    const metadata = await sharp(resultBuffer).metadata();

    // 4. Generate thumbnail
    const thumbBuffer = await sharp(resultBuffer)
      .resize(200, 200, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 60 })
      .toBuffer();
    const thumbnailBase64 = `data:image/webp;base64,${thumbBuffer.toString('base64')}`;

    // 5. Record the edit
    const editRecord = {
      adjustments,
      cropSettings: cropSettings || null,
      annotations: annotations || [],
      timestamp: new Date(),
      userId: user._id,
      mode,
    };

    if (mode === 'overwrite') {
      // Overwrite: replace the existing file, keep original for revert
      const storageKey = asset.storageKey;
      const file = bucket.file(storageKey);

      // Store original for first-time revert
      if (!asset.originalStorageKey) {
        // Copy original to a backup key before overwriting
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

      // Upload the edited version
      await file.save(resultBuffer, {
        contentType: asset.mimeType,
        metadata: { cacheControl: 'public, max-age=31536000' },
      });

      // Update asset metadata
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

      const url = await getSignedDownloadUrl(storageKey, 60 * 60, undefined, String(user.orgId));

      console.log(
        `[Edit] Overwrote asset ${assetId} (${metadata.width}×${metadata.height})`,
      );

      return NextResponse.json({
        success: true,
        mode: 'overwrite',
        asset: { _id: assetId, url, width: metadata.width, height: metadata.height },
      });
    } else {
      // Copy: create a new asset
      const ext = asset.name.split('.').pop() || 'png';
      const baseName = asset.name.replace(/\.[^.]+$/, '');
      const newName = `${baseName}_edited.${ext}`;
      const newStorageKey = `orgs/${user.orgId}/assets/${Date.now()}_${newName}`;

      const file = bucket.file(newStorageKey);
      await file.save(resultBuffer, {
        contentType: asset.mimeType,
        metadata: { cacheControl: 'public, max-age=31536000' },
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
      });

      const url = await getSignedDownloadUrl(newStorageKey, 60 * 60, undefined, String(user.orgId));

      console.log(
        `[Edit] Created edited copy ${newAsset._id} (${metadata.width}×${metadata.height}) from ${assetId}`,
      );

      return NextResponse.json({
        success: true,
        mode: 'copy',
        asset: { ...newAsset.toObject(), url },
      });
    }
  } catch (err) {
    console.error('[Edit] Error:', err);
    return NextResponse.json(
      { error: 'Failed to apply edits' },
      { status: 500 },
    );
  }
}

/**
 * POST /api/assets/edit/revert
 * Reverts an overwritten asset to its original.
 */
