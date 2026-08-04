// SPDX-License-Identifier: Apache-2.0
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { connectToDatabase } from '@/lib/db';
import { Asset, User } from '@/models';
import { getGcsBucket } from '@/lib/storage';

/**
 * GET /api/assets/download?assetId=xxx&size=original|small|medium|large|custom&w=400&h=300&format=jpeg
 * Returns the image as a downloadable file, optionally resized.
 */
export async function GET(req: NextRequest) {
 const session = await getSession();
 if (!session?.user?.email) {
 return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
 }

 await connectToDatabase();
 const user = await User.findOne({ email: session.user.email }).lean();
 if (!user?.orgId) {
 return NextResponse.json({ error: 'No organization' }, { status: 400 });
 }

 const { searchParams } = req.nextUrl;
 const assetId = searchParams.get('assetId');
 const size = searchParams.get('size') || 'original';
 const customW = Number(searchParams.get('w')) || 0;
 const customH = Number(searchParams.get('h')) || 0;
 const format = searchParams.get('format') || '';

 if (!assetId) {
 return NextResponse.json({ error: 'assetId required' }, { status: 400 });
 }

 const asset = await Asset.findOne({ _id: assetId, orgId: user.orgId }).lean();
 if (!asset) {
 return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
 }

 const bucket = await getGcsBucket(String(user.orgId));
 const [buffer] = await bucket.file(asset.storageKey).download();

 // Size presets
 const SIZES: Record<string, { w: number; h: number } | null> = {
 original: null, // no resize
 small: { w: 480, h: 480 },
 medium: { w: 1024, h: 1024 },
 large: { w: 1920, h: 1920 },
 custom: customW && customH ? { w: customW, h: customH } : null,
 };

 const targetSize = SIZES[size] ?? null;
 let outputBuffer = buffer;
 let outputMime = asset.mimeType;
 let outputExt = asset.originalName.split('.').pop() || 'jpg';

 // Resize if needed and it's an image
 if (targetSize && asset.mimeType.startsWith('image/')) {
 try {
 const sharp = (await import('sharp')).default;
 let pipeline = sharp(buffer).resize(targetSize.w, targetSize.h, {
 fit: 'inside',
 withoutEnlargement: true,
 });

 // Output format
 const outFmt = format || outputExt;
 if (outFmt === 'webp') {
 pipeline = pipeline.webp({ quality: 85 });
 outputMime = 'image/webp';
 outputExt = 'webp';
 } else if (outFmt === 'png') {
 pipeline = pipeline.png();
 outputMime = 'image/png';
 outputExt = 'png';
 } else if (outFmt === 'avif') {
 pipeline = pipeline.avif({ quality: 80 });
 outputMime = 'image/avif';
 outputExt = 'avif';
 } else {
 pipeline = pipeline.jpeg({ quality: 85 });
 outputMime = 'image/jpeg';
 outputExt = 'jpg';
 }

 outputBuffer = await pipeline.toBuffer();
 } catch (err) {
 console.error('Download resize failed, returning original:', err);
 }
 }

 // Build filename
 const baseName = asset.name.replace(/\.[^.]+$/, '');
 const sizeSuffix = size === 'original' ? '_original' : `_${size}`;
 const filename = `${baseName}${sizeSuffix}.${outputExt}`;

 // Use inline disposition when loaded as img src (e.g. Design Studio library)
 const inline = searchParams.get('inline') === '1';
 const disposition = inline
 ? `inline; filename="${filename}"`
 : `attachment; filename="${filename}"`;

 return new NextResponse(new Uint8Array(outputBuffer), {
 headers: {
 'Content-Type': outputMime,
 'Content-Disposition': disposition,
 'Content-Length': String(outputBuffer.length),
 'Cache-Control': 'private, max-age=3600',
 },
 });
}
