// SPDX-License-Identifier: Apache-2.0
/**
 * GET /api/v1/assets/[id] — Get single asset with metadata + signed URL
 * PATCH /api/v1/assets/[id] — Update asset metadata/tags
 * DELETE /api/v1/assets/[id] — Soft-delete asset
 *
 * Auth: API Key (read for GET, write for PATCH, delete for DELETE)
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { authenticateApiRequest, isErrorResponse, addCorsHeaders } from '@/lib/api-auth';
import { Asset } from '@/models';
import { getSignedDownloadUrl } from '@/lib/storage';

interface RouteContext {
 params: Promise<{ id: string }>;
}

export async function OPTIONS(req: NextRequest) {
 const res = new NextResponse(null, { status: 204 });
 return addCorsHeaders(res, req.headers.get('origin'), []);
}

export async function GET(req: NextRequest, ctx: RouteContext) {
 const { id } = await ctx.params;
 const auth = await authenticateApiRequest(req, 'read');
 if (isErrorResponse(auth)) return auth;

 await connectToDatabase();

 const asset = await Asset.findOne({
 _id: id,
 orgId: auth.orgId,
 isDeleted: { $ne: true },
 }).lean();

 if (!asset) {
 return NextResponse.json(
 { error: 'Asset not found', code: 'NOT_FOUND' },
 { status: 404 },
 );
 }

 const [url, thumbnailUrl] = await Promise.all([
 getSignedDownloadUrl(asset.storageKey, 3600, undefined, String(auth.orgId)),
 asset.thumbnailStorageKey
 ? getSignedDownloadUrl(asset.thumbnailStorageKey, 3600, undefined, String(auth.orgId))
 : Promise.resolve(null),
 ]);

 const res = NextResponse.json({
 asset: {
 _id: String(asset._id),
 name: asset.name,
 mimeType: asset.mimeType,
 width: asset.width,
 height: asset.height,
 sizeBytes: asset.sizeBytes,
 url,
 thumbnailUrl,
 tags: asset.tags,
 userTags: asset.userTags,
 variants: asset.variants,
 customMetadata: asset.customMetadata,
 folderId: asset.folderId ? String(asset.folderId) : null,
 createdAt: asset.createdAt,
 updatedAt: asset.updatedAt,
 },
 });
 return addCorsHeaders(res, req.headers.get('origin'), auth.allowedDomains);
}

export async function PATCH(req: NextRequest, ctx: RouteContext) {
 const { id } = await ctx.params;
 const auth = await authenticateApiRequest(req, 'write');
 if (isErrorResponse(auth)) return auth;

 await connectToDatabase();

 const body = await req.json();
 const update: Record<string, unknown> = {};

 if (typeof body.name === 'string' && body.name.trim()) {
 update.name = body.name.trim();
 }
 if (body.folderId !== undefined) {
 update.folderId = body.folderId || null;
 }
 if (Array.isArray(body.tags)) {
 update.tags = body.tags;
 }
 if (Array.isArray(body.userTags)) {
 update.userTags = body.userTags;
 }
 if (body.customMetadata && typeof body.customMetadata === 'object') {
 update.customMetadata = body.customMetadata;
 }

 if (Object.keys(update).length === 0) {
 return NextResponse.json(
 { error: 'No valid fields to update', code: 'VALIDATION_ERROR' },
 { status: 400 },
 );
 }

 const asset = await Asset.findOneAndUpdate(
 { _id: id, orgId: auth.orgId, isDeleted: { $ne: true } },
 { $set: update },
 { new: true },
 ).lean();

 if (!asset) {
 return NextResponse.json(
 { error: 'Asset not found', code: 'NOT_FOUND' },
 { status: 404 },
 );
 }

 const res = NextResponse.json({ asset });
 return addCorsHeaders(res, req.headers.get('origin'), auth.allowedDomains);
}

export async function DELETE(req: NextRequest, ctx: RouteContext) {
 const { id } = await ctx.params;
 const auth = await authenticateApiRequest(req, 'delete');
 if (isErrorResponse(auth)) return auth;

 await connectToDatabase();

 const asset = await Asset.findOneAndUpdate(
 { _id: id, orgId: auth.orgId, isDeleted: { $ne: true } },
 { $set: { isDeleted: true, deletedAt: new Date() } },
 { new: true },
 ).lean();

 if (!asset) {
 return NextResponse.json(
 { error: 'Asset not found', code: 'NOT_FOUND' },
 { status: 404 },
 );
 }

 const res = NextResponse.json({ message: 'Asset deleted', id });
 return addCorsHeaders(res, req.headers.get('origin'), auth.allowedDomains);
}
