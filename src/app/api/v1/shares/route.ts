// SPDX-License-Identifier: Apache-2.0
/**
 * V1 Share API
 * GET /api/v1/shares — List share links
 * POST /api/v1/shares — Create a share link
 *
 * Auth: API Key (read for GET, write for POST)
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { connectToDatabase } from '@/lib/db';
import { authenticateApiRequest, isErrorResponse, addCorsHeaders, applyFolderScope } from '@/lib/api-auth';
import { ShareLink, Asset, Folder, OrgMembership, MemberGroup } from '@/models';

export async function OPTIONS(req: NextRequest) {
 const res = new NextResponse(null, { status: 204 });
 return addCorsHeaders(res, req.headers.get('origin'), []);
}

/**
 * GET /api/v1/shares
 *
 * List share links for the org. Optionally filter by target.
 *
 * Query params:
 * - targetType: 'asset' | 'folder' | 'root'
 * - targetId: filter by specific target
 * - page (default: 1)
 * - limit (default: 20, max: 50)
 * - active: 'true' | 'false' (default: 'true')
 */
export async function GET(req: NextRequest) {
 const auth = await authenticateApiRequest(req, 'read');
 if (isErrorResponse(auth)) return auth;

 await connectToDatabase();

 const { searchParams } = req.nextUrl;
 const page = Math.max(1, Number(searchParams.get('page')) || 1);
 const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit')) || 20));
 const skip = (page - 1) * limit;
 const targetType = searchParams.get('targetType');
 const targetId = searchParams.get('targetId');
 const active = searchParams.get('active') !== 'false'; // default true

 const filter: Record<string, unknown> = {
 orgId: auth.orgId,
 isActive: active,
 };

 if (targetType) filter.targetType = targetType;
 if (targetId) {
 filter.$or = [
 { targetId },
 { targetIds: targetId },
 ];
 }

 const [links, total] = await Promise.all([
 ShareLink.find(filter)
 .sort({ createdAt: -1 })
 .skip(skip)
 .limit(limit)
 .lean(),
 ShareLink.countDocuments(filter),
 ]);

 // Enrich with target names
 const enriched = await Promise.all(
 links.map(async (link) => {
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

 return {
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
 };
 }),
 );

 const res = NextResponse.json({
 shares: enriched,
 page,
 limit,
 total,
 totalPages: Math.ceil(total / limit),
 });
 return addCorsHeaders(res, req.headers.get('origin'), auth.allowedDomains);
}

/**
 * POST /api/v1/shares
 *
 * Create a share link.
 *
 * Body: {
 * targetType: 'asset' | 'folder' | 'root',
 * targetId?: string,
 * targetIds?: string[],
 * permission?: 'view' | 'edit' | 'admin',
 * expiresIn?: '1h' | '1d' | '7d' | '30d' | 'never',
 * password?: string,
 * includeNested?: boolean,
 * maxDownloads?: number,
 * allowedEmails?: string[],
 * allowedMemberIds?: string[],
 * allowedGroupIds?: string[],
 * }
 */
export async function POST(req: NextRequest) {
 const auth = await authenticateApiRequest(req, 'write');
 if (isErrorResponse(auth)) return auth;

 await connectToDatabase();

 const body = await req.json();
 const {
 targetType,
 targetId,
 targetIds: rawTargetIds,
 permission = 'view',
 expiresIn = 'never',
 password,
 includeNested = true,
 maxDownloads,
 allowedEmails = [],
 allowedMemberIds = [],
 allowedGroupIds = [],
 } = body as {
 targetType?: string;
 targetId?: string;
 targetIds?: string[];
 permission?: string;
 expiresIn?: string;
 password?: string;
 includeNested?: boolean;
 maxDownloads?: number;
 allowedEmails?: string[];
 allowedMemberIds?: string[];
 allowedGroupIds?: string[];
 };

 // Validate targetType
 if (!targetType || !['asset', 'folder', 'root'].includes(targetType)) {
 const res = NextResponse.json(
 { error: 'targetType must be "asset", "folder", or "root"', code: 'VALIDATION_ERROR' },
 { status: 400 },
 );
 return addCorsHeaders(res, req.headers.get('origin'), auth.allowedDomains);
 }

 if (!['view', 'edit', 'admin'].includes(permission)) {
 const res = NextResponse.json(
 { error: 'permission must be "view", "edit", or "admin"', code: 'VALIDATION_ERROR' },
 { status: 400 },
 );
 return addCorsHeaders(res, req.headers.get('origin'), auth.allowedDomains);
 }

 // Resolve target IDs
 let resolvedIds: string[] = [];

 if (targetType === 'root') {
 resolvedIds = [];
 } else {
 resolvedIds = rawTargetIds?.length ? rawTargetIds : targetId ? [targetId] : [];

 if (resolvedIds.length === 0) {
 const res = NextResponse.json(
 { error: 'targetId or targetIds required for asset/folder shares', code: 'VALIDATION_ERROR' },
 { status: 400 },
 );
 return addCorsHeaders(res, req.headers.get('origin'), auth.allowedDomains);
 }

 // Apply folder scope — check if targets are within scoped folder
 if (auth.folderScope) {
 if (targetType === 'asset') {
 const scopeFilter: Record<string, unknown> = {
 _id: { $in: resolvedIds },
 orgId: auth.orgId,
 isDeleted: { $ne: true },
 };
 const scopeErr = await applyFolderScope(auth, scopeFilter, 'asset');
 if (scopeErr) return scopeErr;

 const count = await Asset.countDocuments(scopeFilter);
 if (count !== resolvedIds.length) {
 const res = NextResponse.json(
 { error: 'One or more assets not found or outside folder scope', code: 'NOT_FOUND' },
 { status: 404 },
 );
 return addCorsHeaders(res, req.headers.get('origin'), auth.allowedDomains);
 }
 } else {
 const scopeFilter: Record<string, unknown> = {
 _id: { $in: resolvedIds },
 orgId: auth.orgId,
 };
 const scopeErr = await applyFolderScope(auth, scopeFilter, 'folder');
 if (scopeErr) return scopeErr;

 const count = await Folder.countDocuments(scopeFilter);
 if (count !== resolvedIds.length) {
 const res = NextResponse.json(
 { error: 'One or more folders not found or outside folder scope', code: 'NOT_FOUND' },
 { status: 404 },
 );
 return addCorsHeaders(res, req.headers.get('origin'), auth.allowedDomains);
 }
 }
 } else {
 // No folder scope — just verify targets exist in org
 if (targetType === 'asset') {
 const count = await Asset.countDocuments({
 _id: { $in: resolvedIds },
 orgId: auth.orgId,
 isDeleted: { $ne: true },
 });
 if (count !== resolvedIds.length) {
 const res = NextResponse.json(
 { error: 'One or more assets not found', code: 'NOT_FOUND' },
 { status: 404 },
 );
 return addCorsHeaders(res, req.headers.get('origin'), auth.allowedDomains);
 }
 } else {
 const count = await Folder.countDocuments({
 _id: { $in: resolvedIds },
 orgId: auth.orgId,
 });
 if (count !== resolvedIds.length) {
 const res = NextResponse.json(
 { error: 'One or more folders not found', code: 'NOT_FOUND' },
 { status: 404 },
 );
 return addCorsHeaders(res, req.headers.get('origin'), auth.allowedDomains);
 }
 }
 }
 }

 // Validate allowedMemberIds exist in org
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

 // Validate allowedGroupIds exist in org
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

 // Calculate expiration
 const expiryMap: Record<string, number> = {
 '1h': 1 * 60 * 60 * 1000,
 '1d': 1 * 24 * 60 * 60 * 1000,
 '7d': 7 * 24 * 60 * 60 * 1000,
 '30d': 30 * 24 * 60 * 60 * 1000,
 };
 let expiresAt: Date | null = null;
 if (expiresIn !== 'never' && expiryMap[expiresIn]) {
 expiresAt = new Date(Date.now() + expiryMap[expiresIn]);
 }

 // Hash password if provided
 let passwordHash: string | null = null;
 if (password && password.trim()) {
 passwordHash = await bcrypt.hash(password.trim(), 10);
 }

 // Generate unique token
 const token = crypto.randomBytes(32).toString('hex');

 // For API key auth, use the key ID as createdBy (no user context)
 // For access token auth, use the user ID
 const createdBy = auth.userId || auth.keyId;

 const link = await ShareLink.create({
 orgId: auth.orgId,
 token,
 targetType,
 targetId: resolvedIds[0] ?? null,
 targetIds: resolvedIds,
 permission,
 includeNested,
 createdBy,
 expiresAt,
 password: passwordHash,
 isActive: true,
 accessCount: 0,
 maxDownloads: maxDownloads ?? null,
 allowedEmails: allowedEmails.map((e: string) => e.toLowerCase().trim()),
 allowedMemberIds,
 allowedGroupIds,
 });

 const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:4000';
 const shareUrl = `${baseUrl}/s/${token}`;

 const res = NextResponse.json(
 {
 share: {
 _id: String(link._id),
 token,
 shareUrl,
 targetType,
 targetId: resolvedIds[0] ?? null,
 targetIds: resolvedIds,
 permission,
 expiresAt,
 hasPassword: !!passwordHash,
 includeNested,
 maxDownloads: maxDownloads ?? null,
 allowedEmails: link.allowedEmails,
 allowedMemberIds: allowedMemberIds,
 allowedGroupIds: allowedGroupIds,
 createdAt: link.createdAt,
 },
 },
 { status: 201 },
 );
 return addCorsHeaders(res, req.headers.get('origin'), auth.allowedDomains);
}
