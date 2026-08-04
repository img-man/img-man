// SPDX-License-Identifier: Apache-2.0
/**
 * PATCH /api/v1/folders/[id] — Update folder (name, accessMode, allowedMembers/Groups)
 * DELETE /api/v1/folders/[id] — Delete folder
 *
 * Auth: API Key (write)
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { authenticateApiRequest, isErrorResponse, addCorsHeaders, applyFolderScope } from '@/lib/api-auth';
import { Folder, Asset } from '@/models';
import { propagateAccessMode } from '@/lib/folder-access';

interface RouteContext {
 params: Promise<{ id: string }>;
}

export async function OPTIONS(req: NextRequest) {
 const res = new NextResponse(null, { status: 204 });
 return addCorsHeaders(res, req.headers.get('origin'), []);
}

export async function PATCH(req: NextRequest, ctx: RouteContext) {
 const { id } = await ctx.params;
 const auth = await authenticateApiRequest(req, 'write');
 if (isErrorResponse(auth)) return auth;

 await connectToDatabase();

 // Verify folder is within scope
 if (auth.folderScope) {
 const scopeFilter: Record<string, unknown> = { orgId: auth.orgId, _id: id };
 const scopeErr = await applyFolderScope(auth, scopeFilter, 'folder');
 if (scopeErr) return scopeErr;
 const allowed = scopeFilter._id;
 if (allowed && typeof allowed === 'object' && '$in' in allowed) {
 const ids = (allowed as { $in: string[] }).$in;
 if (!ids.includes(id)) {
 return NextResponse.json(
 { error: 'Folder is outside API key scope', code: 'SCOPE_ERROR' },
 { status: 403 },
 );
 }
 }
 }

 const body = await req.json();
 const update: Record<string, unknown> = {};

 if (typeof body.name === 'string' && body.name.trim()) {
 update.name = body.name.trim();
 }

 // Access mode updates
 if (body.accessMode !== undefined) {
 if (!['restricted', 'flexible'].includes(body.accessMode)) {
 return NextResponse.json(
 { error: 'accessMode must be "restricted" or "flexible"', code: 'VALIDATION_ERROR' },
 { status: 400 },
 );
 }
 update.accessMode = body.accessMode;
 update.accessModeInherited = false;
 }
 if (body.allowedMemberIds !== undefined) {
 update.allowedMemberIds = body.allowedMemberIds;
 }
 if (body.allowedGroupIds !== undefined) {
 update.allowedGroupIds = body.allowedGroupIds;
 }

 if (Object.keys(update).length === 0) {
 return NextResponse.json(
 { error: 'No valid fields to update', code: 'VALIDATION_ERROR' },
 { status: 400 },
 );
 }

 const folder = await Folder.findOneAndUpdate(
 { _id: id, orgId: auth.orgId },
 { $set: update },
 { new: true },
 ).lean();

 if (!folder) {
 return NextResponse.json(
 { error: 'Folder not found', code: 'NOT_FOUND' },
 { status: 404 },
 );
 }

 // Cascade if requested
 const hasAccessUpdate = body.accessMode !== undefined || body.allowedMemberIds !== undefined || body.allowedGroupIds !== undefined;
 if (hasAccessUpdate && body.cascade) {
 await propagateAccessMode(
 auth.orgId,
 folder as unknown as Parameters<typeof propagateAccessMode>[1],
 true,
 );
 }

 const res = NextResponse.json({
 folder: {
 ...folder,
 _id: String(folder._id),
 accessMode: (folder as Record<string, unknown>).accessMode ?? 'flexible',
 allowedMemberIds: ((folder as Record<string, unknown>).allowedMemberIds as string[] ?? []).map(String),
 allowedGroupIds: ((folder as Record<string, unknown>).allowedGroupIds as string[] ?? []).map(String),
 },
 });
 return addCorsHeaders(res, req.headers.get('origin'), auth.allowedDomains);
}

export async function DELETE(req: NextRequest, ctx: RouteContext) {
 const { id } = await ctx.params;
 const auth = await authenticateApiRequest(req, 'write');
 if (isErrorResponse(auth)) return auth;

 await connectToDatabase();

 // Verify folder is within scope
 if (auth.folderScope) {
 const scopeFilter: Record<string, unknown> = { orgId: auth.orgId, _id: id };
 const scopeErr = await applyFolderScope(auth, scopeFilter, 'folder');
 if (scopeErr) return scopeErr;
 const allowed = scopeFilter._id;
 if (allowed && typeof allowed === 'object' && '$in' in allowed) {
 const ids = (allowed as { $in: string[] }).$in;
 if (!ids.includes(id)) {
 return NextResponse.json(
 { error: 'Folder is outside API key scope', code: 'SCOPE_ERROR' },
 { status: 403 },
 );
 }
 }
 }

 const folder = await Folder.findOne({ _id: id, orgId: auth.orgId }).lean();
 if (!folder) {
 return NextResponse.json(
 { error: 'Folder not found', code: 'NOT_FOUND' },
 { status: 404 },
 );
 }

 // Check if folder has assets
 const assetCount = await Asset.countDocuments({
 folderId: id,
 orgId: auth.orgId,
 isDeleted: { $ne: true },
 });
 if (assetCount > 0) {
 return NextResponse.json(
 {
 error: `Folder contains ${assetCount} asset(s). Move or delete them first.`,
 code: 'FOLDER_NOT_EMPTY',
 },
 { status: 409 },
 );
 }

 // Check for child folders
 const childCount = await Folder.countDocuments({
 parentId: id,
 orgId: auth.orgId,
 });
 if (childCount > 0) {
 return NextResponse.json(
 {
 error: `Folder contains ${childCount} subfolder(s). Delete them first.`,
 code: 'FOLDER_NOT_EMPTY',
 },
 { status: 409 },
 );
 }

 await Folder.deleteOne({ _id: id });

 const res = NextResponse.json({ message: 'Folder deleted', id });
 return addCorsHeaders(res, req.headers.get('origin'), auth.allowedDomains);
}
