// SPDX-License-Identifier: Apache-2.0
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { connectToDatabase } from '@/lib/db';
import { Asset, User } from '@/models';
import { getGcsBucket, getSignedDownloadUrl } from '@/lib/storage';
import sharp from 'sharp';
import { canPerform, type Role } from '@/lib/permissions';

/**
 * POST /api/assets/crop
 * Applies crop (+ optional rotation & flip) to an asset, saves as new asset.
 *
 * Body: { assetId, crop: { x, y, w, h }, rotation?: 0|90|180|270, flipH?: boolean, flipV?: boolean }
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
 const { assetId, crop, rotation = 0, flipH = false, flipV = false } = body;

 if (!assetId || !crop) {
 return NextResponse.json({ error: 'Missing assetId or crop' }, { status: 400 });
 }
 if (!crop.w || !crop.h || crop.w < 1 || crop.h < 1) {
 return NextResponse.json({ error: 'Invalid crop dimensions' }, { status: 400 });
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

 // 2. Apply transforms with Sharp
 let pipeline = sharp(buffer);

 // Rotate first (if any)
 if (rotation && [90, 180, 270].includes(rotation)) {
 pipeline = pipeline.rotate(rotation);
 }

 // Flip
 if (flipH) pipeline = pipeline.flop(); // horizontal flip
 if (flipV) pipeline = pipeline.flip(); // vertical flip

 // Crop
 pipeline = pipeline.extract({
 left: Math.max(0, Math.round(crop.x)),
 top: Math.max(0, Math.round(crop.y)),
 width: Math.round(crop.w),
 height: Math.round(crop.h),
 });

 const croppedBuffer = await pipeline.toBuffer();
 const metadata = await sharp(croppedBuffer).metadata();

 // 3. Upload cropped version as a new asset
 const ext = asset.name.split('.').pop() || 'png';
 const baseName = asset.name.replace(/\.[^.]+$/, '');
 const newName = `${baseName}_cropped.${ext}`;
 const storageKey = `orgs/${user.orgId}/assets/${Date.now()}_${newName}`;

 const file = bucket.file(storageKey);
 await file.save(croppedBuffer, {
 contentType: asset.mimeType,
 metadata: { cacheControl: 'public, max-age=31536000' },
 });

 // 4. Generate thumbnail for cropped version
 const thumbBuffer = await sharp(croppedBuffer)
 .resize(200, 200, { fit: 'inside', withoutEnlargement: true })
 .webp({ quality: 60 })
 .toBuffer();
 const thumbnailBase64 = `data:image/webp;base64,${thumbBuffer.toString('base64')}`;

 // 5. Create new asset record
 const newAsset = await Asset.create({
 orgId: user.orgId,
 folderId: asset.folderId || null,
 uploadedById: user._id,
 name: newName,
 originalName: newName,
 storageKey,
 thumbnailBase64,
 mimeType: asset.mimeType,
 sizeBytes: croppedBuffer.length,
 width: metadata.width ?? crop.w,
 height: metadata.height ?? crop.h,
 tags: asset.tags ?? [],
 userTags: asset.userTags ?? [],
 });

 const url = await getSignedDownloadUrl(storageKey, 60 * 60, undefined, String(user.orgId));

 console.log(
 `[Crop] Created cropped asset ${newAsset._id} (${metadata.width}×${metadata.height}) from ${assetId}`,
 );

 return NextResponse.json({
 success: true,
 asset: { ...newAsset.toObject(), url },
 });
 } catch (err) {
 console.error('[Crop] Error:', err);
 return NextResponse.json(
 { error: 'Failed to crop image' },
 { status: 500 },
 );
 }
}
