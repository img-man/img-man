// SPDX-License-Identifier: Apache-2.0
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { connectToDatabase } from '@/lib/db';
import { ShareLink, Asset, Folder } from '@/models';
import { requirePermission } from '@/lib/auth-context';
import bcrypt from 'bcryptjs';

/**
 * GET /api/share
 * List all share links for the current org.
 */
export async function GET() {
 try {
 const ctx = await requirePermission('share');
 await connectToDatabase();

 const links = await ShareLink.find({
 orgId: ctx.orgId,
 isActive: true,
 })
 .sort({ createdAt: -1 })
 .lean();

 // Enrich with target info
 const enriched = await Promise.all(
 links.map(async (link) => {
 let targetName = 'Unknown';

 if (link.targetType === 'root') {
 targetName = 'Entire Organization';
 } else if (link.targetType === 'asset') {
 // Support multi-asset: use targetIds if present, fall back to targetId
 const ids =
 link.targetIds?.length > 0
 ? link.targetIds
 : link.targetId
 ? [link.targetId]
 : [];
 if (ids.length === 1) {
 const asset = await Asset.findById(ids[0])
 .select('name originalName')
 .lean();
 targetName = asset?.name ?? asset?.originalName ?? 'Deleted asset';
 } else if (ids.length > 1) {
 targetName = `${ids.length} assets`;
 }
 } else {
 const folderId = link.targetIds?.[0] ?? link.targetId;
 const folder = await Folder.findById(folderId).select('name').lean();
 targetName = folder?.name ?? 'Deleted folder';
 }

 return {
 id: (link._id as unknown as string).toString(),
 token: link.token,
 targetType: link.targetType,
 targetId: link.targetId
 ? (link.targetId as unknown as string).toString()
 : null,
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
 allowedEmails: link.allowedEmails,
 createdAt: link.createdAt,
 };
 }),
 );

 return NextResponse.json({ links: enriched });
 } catch (err: unknown) {
 const e = err as { status?: number; error?: string; message?: string };
 return NextResponse.json(
 { error: e.error ?? e.message ?? 'Server error' },
 { status: e.status ?? 500 },
 );
 }
}

/**
 * POST /api/share
 * Body: {
 * targetType: 'asset' | 'folder' | 'root',
 * targetId?: string, // single target (legacy compat)
 * targetIds?: string[], // multi-asset support
 * permission?: 'view' | 'edit' | 'admin',
 * expiresIn?: '1d' | '7d' | '30d' | 'never',
 * password?: string,
 * allowedEmails?: string[],
 * includeNested?: boolean,
 * maxDownloads?: number,
 * }
 */
export async function POST(req: NextRequest) {
 try {
 const ctx = await requirePermission('share');
 const body = await req.json();

 const {
 targetType,
 targetId,
 targetIds: rawTargetIds,
 permission = 'view',
 expiresIn = 'never',
 password,
 allowedEmails = [],
 includeNested = true,
 maxDownloads,
 } = body as {
 targetType?: string;
 targetId?: string;
 targetIds?: string[];
 permission?: string;
 expiresIn?: string;
 password?: string;
 allowedEmails?: string[];
 includeNested?: boolean;
 maxDownloads?: number;
 };

 // Validate target type
 if (!targetType || !['asset', 'folder', 'root'].includes(targetType)) {
 return NextResponse.json(
 { error: 'targetType must be "asset", "folder", or "root"' },
 { status: 400 },
 );
 }
 if (!['view', 'edit', 'admin'].includes(permission)) {
 return NextResponse.json(
 { error: 'permission must be "view", "edit", or "admin"' },
 { status: 400 },
 );
 }

 await connectToDatabase();

 // Resolve target IDs: support both single targetId and array targetIds
 let resolvedIds: string[] = [];

 if (targetType === 'root') {
 // Root-level share — no target IDs needed
 resolvedIds = [];
 } else {
 resolvedIds = rawTargetIds?.length
 ? rawTargetIds
 : targetId
 ? [targetId]
 : [];

 if (resolvedIds.length === 0) {
 return NextResponse.json(
 { error: 'targetId or targetIds required for asset/folder shares' },
 { status: 400 },
 );
 }

 // Verify all targets exist and belong to org
 if (targetType === 'asset') {
 const count = await Asset.countDocuments({
 _id: { $in: resolvedIds },
 orgId: ctx.orgId,
 isDeleted: false,
 });
 if (count !== resolvedIds.length) {
 return NextResponse.json(
 { error: 'One or more assets not found' },
 { status: 404 },
 );
 }
 } else {
 const count = await Folder.countDocuments({
 _id: { $in: resolvedIds },
 orgId: ctx.orgId,
 });
 if (count !== resolvedIds.length) {
 return NextResponse.json(
 { error: 'Folder not found' },
 { status: 404 },
 );
 }
 }
 }

 // Calculate expiration
 let expiresAt: Date | null = null;
 const expiryMap: Record<string, number> = {
 '1d': 1 * 24 * 60 * 60 * 1000,
 '7d': 7 * 24 * 60 * 60 * 1000,
 '30d': 30 * 24 * 60 * 60 * 1000,
 };
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

 const link = await ShareLink.create({
 orgId: ctx.orgId,
 token,
 targetType,
 targetId: resolvedIds[0] ?? null, // legacy compat: first ID
 targetIds: resolvedIds,
 permission,
 includeNested,
 createdBy: ctx.userId,
 expiresAt,
 password: passwordHash,
 isActive: true,
 accessCount: 0,
 maxDownloads: maxDownloads ?? null,
 allowedEmails: allowedEmails.map((e: string) => e.toLowerCase().trim()),
 });

 const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:4000';
 const shareUrl = `${baseUrl}/s/${token}`;

 return NextResponse.json(
 {
 link: {
 id: (link._id as unknown as string).toString(),
 token,
 shareUrl,
 targetType,
 targetIds: resolvedIds,
 permission,
 expiresAt,
 hasPassword: !!passwordHash,
 includeNested,
 maxDownloads: maxDownloads ?? null,
 },
 },
 { status: 201 },
 );
 } catch (err: unknown) {
 const e = err as { status?: number; error?: string; message?: string };
 return NextResponse.json(
 { error: e.error ?? e.message ?? 'Server error' },
 { status: e.status ?? 500 },
 );
 }
}
