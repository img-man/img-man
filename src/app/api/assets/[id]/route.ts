// SPDX-License-Identifier: Apache-2.0
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { connectToDatabase } from '@/lib/db';
import { Asset, User } from '@/models';
import {
 createStorageProxyToken,
 getGcsBucket,
 getSignedDownloadUrl,
} from '@/lib/storage';
import { getPublicAssetUrl } from '@/lib/asset-url';
import { canPerform, type Role } from '@/lib/permissions';

interface RouteContext {
 params: Promise<{ id: string }>;
}

type AssetIntegrityStatus = 'ok' | 'thumbnail-fallback' | 'missing';

async function storageObjectExists(orgId: string, storageKey?: string | null) {
 if (!storageKey) {
 return false;
 }

 try {
 const bucket = await getGcsBucket(orgId);
 await bucket.file(storageKey).getMetadata();
 return true;
 } catch (error) {
 const code =
 typeof error === 'object' && error !== null && 'code' in error
 ? Number((error as { code?: number | string }).code)
 : NaN;
 const message = error instanceof Error ? error.message.toLowerCase() : '';

 if (
 code === 404 ||
 message.includes('no such object') ||
 message.includes('not found')
 ) {
 return false;
 }

 throw error;
 }
}

async function resolveAssetIntegrity(
 orgId: string,
 asset: {
 storageKey?: string | null;
 thumbnailStorageKey?: string | null;
 },
) {
 const [originalExists, thumbnailExists] = await Promise.all([
 storageObjectExists(orgId, asset.storageKey),
 storageObjectExists(orgId, asset.thumbnailStorageKey),
 ]);

 let integrityStatus: AssetIntegrityStatus = 'ok';
 if (!originalExists && thumbnailExists) {
 integrityStatus = 'thumbnail-fallback';
 } else if (!originalExists) {
 integrityStatus = 'missing';
 }

 return {
 integrityStatus,
 originalExists,
 thumbnailExists,
 };
}

async function deleteAssetFiles(
 orgId: string,
 asset: {
 storageKey?: string | null;
 thumbnailStorageKey?: string | null;
 originalStorageKey?: string | null;
 variants?: Array<{ storageKey?: string | null }>;
 },
) {
 const bucket = await getGcsBucket(orgId);
 const keys = new Set<string>();

 if (asset.storageKey) keys.add(asset.storageKey);
 if (asset.thumbnailStorageKey) keys.add(asset.thumbnailStorageKey);
 if (asset.originalStorageKey) keys.add(asset.originalStorageKey);
 for (const variant of asset.variants ?? []) {
 if (variant?.storageKey) {
 keys.add(variant.storageKey);
 }
 }

 await Promise.allSettled(
 Array.from(keys).map((key) => bucket.file(key).delete({ ignoreNotFound: true })),
 );
}

function getBrowserDownloadUrl(
 objectPath: string,
 orgId: string,
 fileName?: string | null,
) {
 const token = createStorageProxyToken({
 objectPath,
 orgId,
 expiresAt: Date.now() + 60 * 60 * 1000,
 fileName: fileName || objectPath.split('/').pop(),
 });

 return `/api/storage/download?token=${encodeURIComponent(token)}`;
}

/**
 * GET /api/assets/:id
 * Returns a single asset with both direct and browser-safe download URLs.
 */
export async function GET(_req: NextRequest, ctx: RouteContext) {
 const { id } = await ctx.params;

 const session = await getSession();
 if (!session?.user?.email) {
 return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
 }

 await connectToDatabase();
 const user = await User.findOne({ email: session.user.email }).lean();
 if (!user?.orgId) {
 return NextResponse.json({ error: 'No organization' }, { status: 400 });
 }

 const asset = await Asset.findOne({
 _id: id,
 orgId: user.orgId,
 isDeleted: { $ne: true },
 }).lean();
 if (!asset) {
 return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
 }

 const [url, thumbnailUrl, integrity] = await Promise.all([
 getSignedDownloadUrl(asset.storageKey, 60 * 60, undefined, String(user.orgId)),
 asset.thumbnailStorageKey
 ? getSignedDownloadUrl(asset.thumbnailStorageKey, 60 * 60, undefined, String(user.orgId))
 : Promise.resolve(null),
 resolveAssetIntegrity(String(user.orgId), asset),
 ]);

 const publicUrl = getPublicAssetUrl(String(asset._id));
 const downloadUrl = getBrowserDownloadUrl(
 asset.storageKey,
 String(user.orgId),
 asset.originalName ?? asset.name,
 );

 return NextResponse.json({
 asset: {
 ...asset,
 ...integrity,
 url,
 downloadUrl,
 thumbnailUrl,
 publicUrl,
 },
 });
}

/**
 * PATCH /api/assets/:id
 * Body: { name?, folderId?, tags?, userTags?, customMetadata? }
 */
export async function PATCH(req: NextRequest, ctx: RouteContext) {
 const { id } = await ctx.params;

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
 const update: Record<string, unknown> = {};

 if (typeof body.name === 'string' && body.name.trim()) {
 update.name = body.name.trim();
 }
 if (body.folderId !== undefined) {
 update.folderId = body.folderId || null;
 }
 if (Array.isArray(body.tags)) {
 update.tags = body.tags.map((t: string) => t.trim()).filter(Boolean);
 }
 if (Array.isArray(body.userTags)) {
 update.userTags = body.userTags.map((t: string) => t.trim()).filter(Boolean);
 }
 if (body.customMetadata && typeof body.customMetadata === 'object') {
 update.customMetadata = body.customMetadata;
 }
 // Support updating variants (for resize save-as-new, thumbnail, etc.)
 if (Array.isArray(body.variants)) {
 update.variants = body.variants;
 }
 // Support updating faces
 if (Array.isArray(body.faces)) {
 update.faces = body.faces;
 }
 // Support thumbnail storage key
 if (typeof body.thumbnailStorageKey === 'string') {
 update.thumbnailStorageKey = body.thumbnailStorageKey;
 }
 if (typeof body.isPublic === 'boolean') {
 update.isPublic = body.isPublic;
 }

 if (Object.keys(update).length === 0) {
 return NextResponse.json(
 { error: 'No valid fields to update' },
 { status: 400 },
 );
 }

 const asset = await Asset.findOneAndUpdate(
 { _id: id, orgId: user.orgId },
 { $set: update },
 { new: true, strict: false },
 ).lean();

 if (!asset) {
 return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
 }

 const url = await getSignedDownloadUrl(asset.storageKey, 60 * 60, undefined, String(user.orgId));
 const publicUrl = getPublicAssetUrl(String(asset._id));
 const downloadUrl = getBrowserDownloadUrl(
 asset.storageKey,
 String(user.orgId),
 asset.originalName ?? asset.name,
 );

 return NextResponse.json({ asset: { ...asset, url, downloadUrl, publicUrl } });
}

/**
 * DELETE /api/assets/:id
 * Soft-deletes the asset (moves to trash) by default.
 * Pass ?permanent=1 to delete it immediately and remove storage objects.
 */
export async function DELETE(req: NextRequest, ctx: RouteContext) {
 const { id } = await ctx.params;

 const session = await getSession();
 if (!session?.user?.email) {
 return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
 }

 await connectToDatabase();
 const user = await User.findOne({ email: session.user.email }).lean();
 if (!user?.orgId) {
 return NextResponse.json({ error: 'No organization' }, { status: 400 });
 }

 // RBAC: require delete permission (editor+)
 if (!canPerform((user.role as Role) ?? 'viewer', 'delete')) {
 return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
 }

 const permanent = ['1', 'true', 'yes'].includes(
 (req.nextUrl.searchParams.get('permanent') || '').toLowerCase(),
 );

 if (permanent) {
 const asset = await Asset.findOneAndDelete({
 _id: id,
 orgId: user.orgId,
 isDeleted: { $ne: true },
 })
 .select('storageKey thumbnailStorageKey originalStorageKey variants')
 .lean();

 if (!asset) {
 return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
 }

 await deleteAssetFiles(String(user.orgId), asset);

 console.log(`[API] Asset ${id} permanently deleted`);
 return NextResponse.json({ success: true, deletedPermanently: true });
 }

 const asset = await Asset.findOneAndUpdate(
 { _id: id, orgId: user.orgId, isDeleted: { $ne: true } },
 { $set: { isDeleted: true, deletedAt: new Date() } },
 { new: true },
 ).lean();

 if (!asset) {
 return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
 }

 console.log(`[API] Asset ${id} moved to trash (soft-deleted)`);
 return NextResponse.json({ success: true, trashedAt: asset.deletedAt });
}
