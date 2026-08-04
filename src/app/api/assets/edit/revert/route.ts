// SPDX-License-Identifier: Apache-2.0
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { connectToDatabase } from '@/lib/db';
import { Asset, User } from '@/models';
import { getGcsBucket, getSignedDownloadUrl } from '@/lib/storage';
import sharp from 'sharp';
import { canPerform, type Role } from '@/lib/permissions';

/**
 * POST /api/assets/edit/revert
 * Reverts an asset to its original version (before any overwrites).
 *
 * Body: { assetId: string }
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
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const { assetId } = await req.json();
  if (!assetId) {
    return NextResponse.json({ error: 'Missing assetId' }, { status: 400 });
  }

  const asset = await Asset.findOne({
    _id: assetId,
    orgId: user.orgId,
    isDeleted: { $ne: true },
  });

  if (!asset) {
    return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
  }

  if (!asset.originalStorageKey) {
    return NextResponse.json(
      { error: 'No original version to revert to' },
      { status: 400 },
    );
  }

  try {
    const bucket = await getGcsBucket(String(user.orgId));

    // Download the original backup
    const [originalBuffer] = await bucket.file(asset.originalStorageKey).download();

    // Overwrite current storage key with original
    await bucket.file(asset.storageKey).save(originalBuffer, {
      contentType: asset.mimeType,
      metadata: { cacheControl: 'public, max-age=31536000' },
    });

    // Regenerate thumbnail from original
    const metadata = await sharp(originalBuffer).metadata();
    const thumbBuffer = await sharp(originalBuffer)
      .resize(200, 200, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 60 })
      .toBuffer();
    const thumbnailBase64 = `data:image/webp;base64,${thumbBuffer.toString('base64')}`;

    // Capture the backup key before clearing it
    const backupKey = asset.originalStorageKey!;

    // Update asset: remove originalStorageKey, clear edits, update dims/thumb
    asset.originalStorageKey = undefined;
    asset.edits = [];
    asset.width = metadata.width;
    asset.height = metadata.height;
    asset.sizeBytes = originalBuffer.length;
    asset.thumbnailBase64 = thumbnailBase64;
    await asset.save();

    // Clean up the backup file
    try {
      await bucket.file(backupKey).delete();
    } catch {
      // Non-fatal: backup file may already be gone
    }

    const url = await getSignedDownloadUrl(asset.storageKey, 60 * 60, undefined, String(user.orgId));

    console.log(`[Edit] Reverted asset ${assetId} to original`);

    return NextResponse.json({
      success: true,
      asset: { _id: assetId, url, width: metadata.width, height: metadata.height },
    });
  } catch (err) {
    console.error('[Edit] Revert error:', err);
    return NextResponse.json(
      { error: 'Failed to revert to original' },
      { status: 500 },
    );
  }
}
