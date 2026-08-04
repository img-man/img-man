// SPDX-License-Identifier: Apache-2.0
import { NextRequest, NextResponse } from 'next/server';
import { getActorFromRequest, isActorErrorResponse } from '@/lib/actor-auth';
import { connectToDatabase } from '@/lib/db';
import { Asset } from '@/models';
import { getGcsBucket, getSignedDownloadUrl } from '@/lib/storage';

/**
 * POST /api/assets/thumbnail
 * Body: { assetId }
 * Generates a 400px thumbnail for the asset and stores it in GCS.
 * Uses Sharp for server-side image resizing.
 *
 * Auth: NextAuth session OR Bearer token (`imgt_…` / `img_…`).
 */
export async function POST(req: NextRequest) {
 const actor = await getActorFromRequest(req, 'write');
 if (isActorErrorResponse(actor)) return actor;

 await connectToDatabase();

 const { assetId } = await req.json();
 if (!assetId) {
 return NextResponse.json({ error: 'assetId required' }, { status: 400 });
 }

 const asset = await Asset.findOne({ _id: assetId, orgId: actor.orgId });
 if (!asset) {
 return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
 }

 // Skip if not an image
 if (!asset.mimeType.startsWith('image/')) {
 return NextResponse.json(
 { error: 'Thumbnails only for images' },
 { status: 400 },
 );
 }

 // Skip if thumbnail already exists
 if (asset.thumbnailStorageKey) {
 const thumbnailUrl = await getSignedDownloadUrl(
 asset.thumbnailStorageKey,
 60 * 60,
	undefined,
	actor.orgId,
 );
 return NextResponse.json({ thumbnailUrl, alreadyExists: true });
 }

 try {
 const sharp = (await import('sharp')).default;

 // Download original from GCS
 const bucket = await getGcsBucket(actor.orgId);
 const [buffer] = await bucket.file(asset.storageKey).download();

 // Generate two thumbnails in parallel:
 // 1. 400px for GCS (high quality, for detail views)
 // 2. 200px base64 for MongoDB (inline grid display, zero GCS calls)
 const [thumbnailBuffer, inlineBuffer] = await Promise.all([
 sharp(buffer)
 .resize(400, 400, { fit: 'inside', withoutEnlargement: true })
 .webp({ quality: 80 })
 .toBuffer(),
 sharp(buffer)
 .resize(200, 200, { fit: 'inside', withoutEnlargement: true })
 .webp({ quality: 60 })
 .toBuffer(),
 ]);

 // Upload 400px thumbnail to GCS
 const thumbnailKey = `thumbnails/${asset.storageKey.replace(/\.[^.]+$/, '')}.webp`;
 const file = bucket.file(thumbnailKey);
 await file.save(thumbnailBuffer, {
 metadata: { contentType: 'image/webp' },
 });

 // Store inline base64 in MongoDB (typically 5-20KB)
 const base64 = `data:image/webp;base64,${inlineBuffer.toString('base64')}`;
 console.log(
 `[Thumbnail] Generated inline base64: ${(inlineBuffer.length / 1024).toFixed(1)}KB for asset ${String(asset._id)}`,
 );

 // Update asset record
 asset.thumbnailStorageKey = thumbnailKey;
 asset.thumbnailBase64 = base64;
 await asset.save();

 const thumbnailUrl = await getSignedDownloadUrl(thumbnailKey, 60 * 60, undefined, actor.orgId);

 return NextResponse.json({ thumbnailUrl, storageKey: thumbnailKey, base64Size: inlineBuffer.length });
 } catch (err) {
 console.error('Thumbnail generation failed:', err);
 return NextResponse.json(
 { error: 'Failed to generate thumbnail' },
 { status: 500 },
 );
 }
}
