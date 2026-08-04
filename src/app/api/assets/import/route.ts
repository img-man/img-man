// SPDX-License-Identifier: Apache-2.0
import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth-context';
import { connectToDatabase } from '@/lib/db';
import { Asset, Organization } from '@/models';
import { uploadBuffer } from '@/lib/storage';
import { trackBandwidth } from '@/lib/bandwidth';
import crypto from 'crypto';

const MAX_URLS = 50; // max URLs per batch
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB per file

/**
 * POST /api/assets/import
 * Batch import assets from external URLs.
 * Body: { urls: string[], folderId?: string, autoTag?: boolean }
 */
export async function POST(req: NextRequest) {
 try {
 const ctx = await requirePermission('upload');
 await connectToDatabase();

 const body = await req.json();
 const { urls, folderId, autoTag = false } = body as {
 urls?: string[];
 folderId?: string;
 autoTag?: boolean;
 };

 if (!urls || !Array.isArray(urls) || urls.length === 0) {
 return NextResponse.json(
 { error: 'urls array is required and must not be empty' },
 { status: 400 },
 );
 }

 if (urls.length > MAX_URLS) {
 return NextResponse.json(
 { error: `Maximum ${MAX_URLS} URLs per batch` },
 { status: 400 },
 );
 }

 // Get org bucket
 const org = await Organization.findById(ctx.orgId).lean();
 const bucketOverride = org?.storageConfig?.bucket || undefined;

 const results: {
 url: string;
 status: 'success' | 'error';
 assetId?: string;
 name?: string;
 error?: string;
 }[] = [];

 let totalBytesImported = 0;

 // Process URLs sequentially to avoid overwhelming external servers
 for (const url of urls) {
 try {
 // Validate URL
 const parsed = new URL(url);
 if (!['http:', 'https:'].includes(parsed.protocol)) {
 results.push({ url, status: 'error', error: 'Invalid protocol' });
 continue;
 }

 // Download the file
 const response = await fetch(url, {
 headers: { 'User-Agent': 'ImageMan-Importer/1.0' },
 signal: AbortSignal.timeout(30000), // 30s timeout
 });

 if (!response.ok) {
 results.push({ url, status: 'error', error: `HTTP ${response.status}` });
 continue;
 }

 const contentType = response.headers.get('content-type') ?? 'application/octet-stream';
 const contentLength = Number(response.headers.get('content-length') ?? 0);

 // Validate file type (must be an image)
 if (!contentType.startsWith('image/')) {
 results.push({ url, status: 'error', error: `Not an image: ${contentType}` });
 continue;
 }

 if (contentLength > MAX_FILE_SIZE) {
 results.push({ url, status: 'error', error: 'File too large (max 50MB)' });
 continue;
 }

 // Read the response body
 const arrayBuffer = await response.arrayBuffer();
 const buffer = Buffer.from(arrayBuffer);

 if (buffer.length > MAX_FILE_SIZE) {
 results.push({ url, status: 'error', error: 'File too large (max 50MB)' });
 continue;
 }

 // Determine filename from URL
 const pathParts = parsed.pathname.split('/');
 const originalName = decodeURIComponent(pathParts[pathParts.length - 1] || 'imported-file');
 const ext = contentType.split('/')[1]?.split(';')[0] ?? 'bin';
 const uniqueId = crypto.randomBytes(8).toString('hex');
 const storageKey = `assets/${ctx.orgId}/${uniqueId}/${originalName.replace(/[^a-zA-Z0-9._-]/g, '_')}.${ext}`;

 // Upload to GCS
 await uploadBuffer(storageKey, buffer, contentType, undefined, bucketOverride, String(ctx.orgId));

 // Create Asset record
 const asset = await Asset.create({
 orgId: ctx.orgId,
 folderId: folderId || undefined,
 uploadedById: ctx.userId,
 name: originalName,
 originalName,
 storageKey,
 mimeType: contentType,
 sizeBytes: buffer.length,
 });

 totalBytesImported += buffer.length;

 results.push({
 url,
 status: 'success',
 assetId: (asset._id as unknown as string).toString(),
 name: originalName,
 });
 } catch (err: unknown) {
 const msg = err instanceof Error ? err.message : 'Unknown error';
 results.push({ url, status: 'error', error: msg });
 }
 }

 // Track bandwidth for all imported bytes
 if (totalBytesImported > 0) {
 await Promise.all([
 trackBandwidth(ctx.orgId, 'upload', totalBytesImported),
 Organization.updateOne(
 { _id: ctx.orgId },
 { $inc: { 'usage.storageBytes': totalBytesImported } },
 ),
 ]);
 }

 // Trigger auto-tag for successful imports if requested
 const successAssetIds = results
 .filter((r) => r.status === 'success' && r.assetId)
 .map((r) => r.assetId);

 const successCount = successAssetIds.length;
 const errorCount = results.length - successCount;

 return NextResponse.json(
 {
 imported: successCount,
 errors: errorCount,
 totalBytes: totalBytesImported,
 results,
 autoTagQueued: autoTag && successCount > 0,
 },
 { status: successCount > 0 ? 201 : 422 },
 );
 } catch (err: unknown) {
 const e = err as { status?: number; error?: string; message?: string };
 return NextResponse.json(
 { error: e.error ?? e.message ?? 'Server error' },
 { status: e.status ?? 500 },
 );
 }
}
