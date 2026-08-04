// SPDX-License-Identifier: Apache-2.0
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { connectToDatabase } from '@/lib/db';
import { Asset, User } from '@/models';
import { getGcsBucket, getSignedDownloadUrl } from '@/lib/storage';

/**
 * POST /api/assets/resize
 * Body: { assetId, width, height, quality?, format?, saveMode: 'new' | 'replace' }
 * Resizes an image using Sharp and either saves as new asset or replaces the original.
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

 const body = await req.json();
 const { assetId, width, height, quality = 85, format, saveMode = 'new' } = body;

 if (!assetId || !width || !height) {
 return NextResponse.json(
 { error: 'assetId, width, and height required' },
 { status: 400 },
 );
 }

 if (width < 1 || width > 10000 || height < 1 || height > 10000) {
 return NextResponse.json(
 { error: 'Dimensions must be 1-10000' },
 { status: 400 },
 );
 }

 const asset = await Asset.findOne({ _id: assetId, orgId: user.orgId });
 if (!asset) {
 return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
 }

 if (!asset.mimeType.startsWith('image/')) {
 return NextResponse.json(
 { error: 'Resize only for images' },
 { status: 400 },
 );
 }

 try {
 const sharp = (await import('sharp')).default;
 const bucket = await getGcsBucket(String(user.orgId));

 // Download original
 const [buffer] = await bucket.file(asset.storageKey).download();

 // Determine output format
 const outputFormat = format || (asset.mimeType === 'image/png' ? 'png' : 'jpeg');
 const mimeMap: Record<string, string> = {
 jpeg: 'image/jpeg',
 jpg: 'image/jpeg',
 png: 'image/png',
 webp: 'image/webp',
 avif: 'image/avif',
 };
 const outputMime = mimeMap[outputFormat] || 'image/jpeg';
 const ext = outputFormat === 'jpg' ? 'jpeg' : outputFormat;

 // Resize
 let pipeline = sharp(buffer).resize(width, height, { fit: 'cover' });

 if (ext === 'jpeg' || ext === 'jpg') {
 pipeline = pipeline.jpeg({ quality });
 } else if (ext === 'png') {
 pipeline = pipeline.png();
 } else if (ext === 'webp') {
 pipeline = pipeline.webp({ quality });
 } else if (ext === 'avif') {
 pipeline = pipeline.avif({ quality });
 }

 const resizedBuffer = await pipeline.toBuffer();

 if (saveMode === 'replace') {
 // Replace original file in GCS
 const file = bucket.file(asset.storageKey);
 await file.save(resizedBuffer, {
 metadata: { contentType: outputMime },
 });

 // Update asset metadata
 asset.sizeBytes = resizedBuffer.length;
 asset.width = width;
 asset.height = height;
 asset.mimeType = outputMime;
 // Clear thumbnail so it gets regenerated
 asset.thumbnailStorageKey = undefined;
 await asset.save();

 const url = await getSignedDownloadUrl(asset.storageKey, 60 * 60, undefined, String(user.orgId));
 return NextResponse.json({ asset: { ...asset.toObject(), url }, mode: 'replaced' });
 } else {
 // Save as new asset
 const baseName = asset.name.replace(/\.[^.]+$/, '');
 const newName = `${baseName}_${width}x${height}.${ext}`;
 const newStorageKey = `uploads/${Date.now()}_${newName}`;

 const file = bucket.file(newStorageKey);
 await file.save(resizedBuffer, {
 metadata: { contentType: outputMime },
 });

 // Create new asset document
 const newAsset = await Asset.create({
 orgId: user.orgId,
 folderId: asset.folderId || undefined,
 uploadedById: user._id,
 name: newName,
 originalName: newName,
 storageKey: newStorageKey,
 mimeType: outputMime,
 sizeBytes: resizedBuffer.length,
 width,
 height,
 tags: [...asset.tags],
 userTags: [...asset.userTags],
 });

 const url = await getSignedDownloadUrl(newStorageKey, 60 * 60, undefined, String(user.orgId));
 return NextResponse.json(
 { asset: { ...newAsset.toObject(), url }, mode: 'new' },
 { status: 201 },
 );
 }
 } catch (err) {
 console.error('Resize failed:', err);
 return NextResponse.json(
 { error: 'Failed to resize image' },
 { status: 500 },
 );
 }
}
