// SPDX-License-Identifier: Apache-2.0
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { ShareLink, Asset, Folder } from '@/models';
import { getSignedDownloadUrl } from '@/lib/storage';

interface RouteContext {
 params: Promise<{ token: string }>;
}

/**
 * GET /api/share/[token]/assets
 * Public endpoint — lists assets accessible through a share link.
 * Query params: ?folderId=xxx (for browsing sub-folders in folder shares)
 */
export async function GET(req: NextRequest, context: RouteContext) {
 try {
 const { token } = await context.params;
 const { searchParams } = new URL(req.url);
 const folderId = searchParams.get('folderId');

 await connectToDatabase();

 const link = await ShareLink.findOne({ token }).lean();

 if (!link || !link.isActive) {
 return NextResponse.json(
 { error: 'Share link not found or revoked' },
 { status: 404 },
 );
 }

 if (link.expiresAt && new Date() > link.expiresAt) {
 return NextResponse.json(
 { error: 'This share link has expired' },
 { status: 410 },
 );
 }

 // ─── Asset share ───────────────────────────────────────
 if (link.targetType === 'asset') {
 // Support multi-asset shares via targetIds[]
 const assetIds =
 link.targetIds?.length > 0
 ? link.targetIds
 : link.targetId
 ? [link.targetId]
 : [];

 const assets = await Asset.find({
 _id: { $in: assetIds },
 isDeleted: false,
 })
 .select(
 'name originalName storageKey thumbnailBase64 mimeType sizeBytes width height tags createdAt',
 )
 .lean();

 if (assets.length === 0) {
 return NextResponse.json(
 { error: 'Asset(s) not found' },
 { status: 404 },
 );
 }

 // Generate signed URLs for all assets
 const enrichedAssets = await Promise.all(
 assets.map(async (a) => ({
 id: (a._id as unknown as string).toString(),
 name: a.name,
 originalName: a.originalName,
 url:
 a.thumbnailBase64
 ? undefined
 : await getSignedDownloadUrl(
 a.storageKey,
 60 * 60,
 undefined,
 String(link.orgId),
 ),
 thumbnailBase64: a.thumbnailBase64,
 mimeType: a.mimeType,
 sizeBytes: a.sizeBytes,
 width: a.width,
 height: a.height,
 tags: a.tags,
 createdAt: a.createdAt,
 })),
 );

 // Single asset: return legacy format for backward compat
 if (enrichedAssets.length === 1) {
 return NextResponse.json({
 type: 'asset',
 permission: link.permission,
 asset: enrichedAssets[0],
 });
 }

 // Multi-asset: return array
 return NextResponse.json({
 type: 'assets',
 permission: link.permission,
 assets: enrichedAssets,
 });
 }

 // ─── Folder share ──────────────────────────────────────
 const browseFolderId =
 folderId ?? (link.targetId as unknown as string).toString();

 // Verify the browsed folder is within the shared scope
 if (folderId && link.includeNested) {
 const sharedFolder = await Folder.findById(link.targetId)
 .select('path')
 .lean();
 const browseFolder = await Folder.findById(folderId)
 .select('path')
 .lean();

 if (!sharedFolder || !browseFolder) {
 return NextResponse.json(
 { error: 'Folder not found' },
 { status: 404 },
 );
 }

 // Must be a descendant of the shared folder
 if (!browseFolder.path.startsWith(sharedFolder.path)) {
 return NextResponse.json(
 { error: 'Access denied — outside shared scope' },
 { status: 403 },
 );
 }
 } else if (
 folderId &&
 folderId !== (link.targetId as unknown as string).toString()
 ) {
 return NextResponse.json(
 { error: 'Nested browsing not enabled for this share' },
 { status: 403 },
 );
 }

 // Get sub-folders
 const folders = await Folder.find({
 parentId: browseFolderId,
 orgId: link.orgId,
 })
 .select('name')
 .sort({ name: 1 })
 .lean();

 // Get assets in folder
 const assets = await Asset.find({
 folderId: browseFolderId,
 orgId: link.orgId,
 isDeleted: false,
 })
 .select(
 'name originalName storageKey thumbnailBase64 mimeType sizeBytes width height tags createdAt',
 )
 .sort({ createdAt: -1 })
 .limit(100)
 .lean();

 // Generate signed URLs for assets
 const enrichedAssets = await Promise.all(
 assets.map(async (a) => ({
 id: (a._id as unknown as string).toString(),
 name: a.name,
 originalName: a.originalName,
 url:
 a.thumbnailBase64
 ? undefined
 : await getSignedDownloadUrl(
 a.storageKey,
 60 * 60,
 undefined,
 String(link.orgId),
 ),
 thumbnailBase64: a.thumbnailBase64,
 mimeType: a.mimeType,
 sizeBytes: a.sizeBytes,
 width: a.width,
 height: a.height,
 tags: a.tags,
 createdAt: a.createdAt,
 })),
 );

 // Get current folder info
 const currentFolder = await Folder.findById(browseFolderId)
 .select('name parentId path')
 .lean();

 return NextResponse.json({
 type: 'folder',
 permission: link.permission,
 currentFolder: currentFolder
 ? {
 id: (currentFolder._id as unknown as string).toString(),
 name: currentFolder.name,
 parentId: currentFolder.parentId
 ? (currentFolder.parentId as unknown as string).toString()
 : null,
 }
 : null,
 folders: folders.map((f) => ({
 id: (f._id as unknown as string).toString(),
 name: f.name,
 })),
 assets: enrichedAssets,
 });
 } catch (err: unknown) {
 const e = err as { status?: number; error?: string; message?: string };
 return NextResponse.json(
 { error: e.error ?? e.message ?? 'Server error' },
 { status: e.status ?? 500 },
 );
 }
}
