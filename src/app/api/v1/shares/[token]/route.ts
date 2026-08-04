// SPDX-License-Identifier: Apache-2.0
/**
 * V1 Single Share API
 * GET /api/v1/shares/[token] — Get share link details
 * PATCH /api/v1/shares/[token] — Update share link settings
 * DELETE /api/v1/shares/[token] — Revoke (deactivate) a share link
 *
 * Auth: API Key (read for GET, write for PATCH/DELETE)
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { authenticateApiRequest, isErrorResponse, addCorsHeaders } from '@/lib/api-auth';
import { ShareLink, Asset, Folder, OrgMembership, MemberGroup } from '@/models';

interface RouteContext {
 params: Promise<{ token: string }>;
}

export async function OPTIONS(req: NextRequest) {
 const res = new NextResponse(null, { status: 204 });
 return addCorsHeaders(res, req.headers.get('origin'), []);
}

/**
 * GET /api/v1/shares/[token]
 *
 * Get full details of a share link.
 */
export async function GET(req: NextRequest, ctx: RouteContext) {
 const { token } = await ctx.params;
 const auth = await authenticateApiRequest(req, 'read');
 if (isErrorResponse(auth)) return auth;

 await connectToDatabase();

 const link = await ShareLink.findOne({ token, orgId: auth.orgId }).lean();

 if (!link) {
 const res = NextResponse.json(
 { error: 'Share link not found', code: 'NOT_FOUND' },
 { status: 404 },
 );
 return addCorsHeaders(res, req.headers.get('origin'), auth.allowedDomains);
 }

 // Get target name
 let targetName = 'Unknown';
 if (link.targetType === 'root') {
 targetName = 'Entire Organization';
 } else if (link.targetType === 'asset') {
 const ids = link.targetIds?.length > 0
 ? link.targetIds
 : link.targetId ? [link.targetId] : [];
 if (ids.length === 1) {
 const asset = await Asset.findById(ids[0]).select('name').lean();
 targetName = asset?.name ?? 'Deleted asset';
 } else if (ids.length > 1) {
 targetName = `${ids.length} assets`;
 }
 } else {
 const folderId = link.targetIds?.[0] ?? link.targetId;
 const folder = await Folder.findById(folderId).select('name').lean();
 targetName = folder?.name ?? 'Deleted folder';
 }

 const res = NextResponse.json({
 share: {
 _id: String(link._id),
 token: link.token,
 targetType: link.targetType,
 targetId: link.targetId ? String(link.targetId) : null,
 targetIds: (link.targetIds ?? []).map((id: unknown) => String(id)),
 targetName,
 permission: link.permission,
 includeNested: link.includeNested,
 hasPassword: !!link.password,
 expiresAt: link.expiresAt,
 isActive: link.isActive,
 accessCount: link.accessCount,
 maxDownloads: link.maxDownloads ?? null,
 lastAccessedAt: link.lastAccessedAt,
 allowedEmails: link.allowedEmails ?? [],
 allowedMemberIds: (link.allowedMemberIds ?? []).map((id: unknown) => String(id)),
 allowedGroupIds: (link.allowedGroupIds ?? []).map((id: unknown) => String(id)),
 createdAt: link.createdAt,
 updatedAt: link.updatedAt,
 },
 });
 return addCorsHeaders(res, req.headers.get('origin'), auth.allowedDomains);
}

/**
 * PATCH /api/v1/shares/[token]
 *
 * Update share link settings. All fields are optional.
 *
 * Body: {
 * permission?: 'view' | 'edit' | 'admin',
 * expiresAt?: string | null, — ISO date or null for never
 * password?: string | null, — new password or null to remove
 * includeNested?: boolean,
 * maxDownloads?: number | null,
 * isActive?: boolean,
 * allowedEmails?: string[],
 * allowedMemberIds?: string[],
 * allowedGroupIds?: string[],
 * }
 */
export async function PATCH(req: NextRequest, ctx: RouteContext) {
 const { token } = await ctx.params;
 const auth = await authenticateApiRequest(req, 'write');
 if (isErrorResponse(auth)) return auth;

 await connectToDatabase();

 const link = await ShareLink.findOne({ token, orgId: auth.orgId });
 if (!link) {
 const res = NextResponse.json(
 { error: 'Share link not found', code: 'NOT_FOUND' },
 { status: 404 },
 );
 return addCorsHeaders(res, req.headers.get('origin'), auth.allowedDomains);
 }

 const body = await req.json();
 const {
 permission,
 expiresAt,
 password,
 includeNested,
 maxDownloads,
 isActive,
 allowedEmails,
 allowedMemberIds,
 allowedGroupIds,
 } = body as {
 permission?: string;
 expiresAt?: string | null;
 password?: string | null;
 includeNested?: boolean;
 maxDownloads?: number | null;
 isActive?: boolean;
 allowedEmails?: string[];
 allowedMemberIds?: string[];
 allowedGroupIds?: string[];
 };

 // Validate permission if provided
 if (permission !== undefined) {
 if (!['view', 'edit', 'admin'].includes(permission)) {
 const res = NextResponse.json(
 { error: 'permission must be "view", "edit", or "admin"', code: 'VALIDATION_ERROR' },
 { status: 400 },
 );
 return addCorsHeaders(res, req.headers.get('origin'), auth.allowedDomains);
 }
 link.permission = permission as 'view' | 'edit' | 'admin';
 }

 if (expiresAt !== undefined) {
 link.expiresAt = expiresAt ? new Date(expiresAt) : undefined;
 }

 if (password !== undefined) {
 if (password === null || password === '') {
 link.password = undefined;
 } else {
 const bcrypt = await import('bcryptjs');
 link.password = await bcrypt.hash(password.trim(), 10);
 }
 }

 if (includeNested !== undefined) link.includeNested = includeNested;
 if (maxDownloads !== undefined) link.maxDownloads = maxDownloads ?? undefined;
 if (isActive !== undefined) link.isActive = isActive;

 if (allowedEmails !== undefined) {
 link.allowedEmails = allowedEmails.map((e: string) => e.toLowerCase().trim());
 }

 // Validate and set allowedMemberIds
 if (allowedMemberIds !== undefined) {
 if (allowedMemberIds.length > 0) {
 const memberCount = await OrgMembership.countDocuments({
 _id: { $in: allowedMemberIds },
 orgId: auth.orgId,
 status: 'active',
 });
 if (memberCount !== allowedMemberIds.length) {
 const res = NextResponse.json(
 { error: 'One or more member IDs are invalid', code: 'VALIDATION_ERROR' },
 { status: 400 },
 );
 return addCorsHeaders(res, req.headers.get('origin'), auth.allowedDomains);
 }
 }
 link.allowedMemberIds = allowedMemberIds as unknown as typeof link.allowedMemberIds;
 }

 // Validate and set allowedGroupIds
 if (allowedGroupIds !== undefined) {
 if (allowedGroupIds.length > 0) {
 const groupCount = await MemberGroup.countDocuments({
 _id: { $in: allowedGroupIds },
 orgId: auth.orgId,
 });
 if (groupCount !== allowedGroupIds.length) {
 const res = NextResponse.json(
 { error: 'One or more group IDs are invalid', code: 'VALIDATION_ERROR' },
 { status: 400 },
 );
 return addCorsHeaders(res, req.headers.get('origin'), auth.allowedDomains);
 }
 }
 link.allowedGroupIds = allowedGroupIds as unknown as typeof link.allowedGroupIds;
 }

 await link.save();

 const res = NextResponse.json({
 share: {
 _id: String(link._id),
 token: link.token,
 permission: link.permission,
 expiresAt: link.expiresAt ?? null,
 hasPassword: !!link.password,
 includeNested: link.includeNested,
 maxDownloads: link.maxDownloads ?? null,
 isActive: link.isActive,
 allowedEmails: link.allowedEmails ?? [],
 allowedMemberIds: (link.allowedMemberIds ?? []).map((id: unknown) => String(id)),
 allowedGroupIds: (link.allowedGroupIds ?? []).map((id: unknown) => String(id)),
 updatedAt: link.updatedAt,
 },
 });
 return addCorsHeaders(res, req.headers.get('origin'), auth.allowedDomains);
}

/**
 * DELETE /api/v1/shares/[token]
 *
 * Revoke a share link (sets isActive=false).
 */
export async function DELETE(req: NextRequest, ctx: RouteContext) {
 const { token } = await ctx.params;
 const auth = await authenticateApiRequest(req, 'write');
 if (isErrorResponse(auth)) return auth;

 await connectToDatabase();

 const link = await ShareLink.findOneAndUpdate(
 { token, orgId: auth.orgId },
 { isActive: false },
 { new: true },
 );

 if (!link) {
 const res = NextResponse.json(
 { error: 'Share link not found', code: 'NOT_FOUND' },
 { status: 404 },
 );
 return addCorsHeaders(res, req.headers.get('origin'), auth.allowedDomains);
 }

 const res = NextResponse.json({
 success: true,
 share: {
 _id: String(link._id),
 token: link.token,
 isActive: false,
 },
 });
 return addCorsHeaders(res, req.headers.get('origin'), auth.allowedDomains);
}
