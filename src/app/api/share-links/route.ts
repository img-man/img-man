// SPDX-License-Identifier: Apache-2.0
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { ShareLink, Asset, Folder, User } from '@/models';
import { requireSectionAccess } from '@/lib/auth-context';
import crypto from 'crypto';

/**
 * GET /api/share-links
 * List all share links for the current organization.
 * Query: page?, limit?, targetType?
 */
export async function GET(req: NextRequest) {
 try {
 const ctx = await requireSectionAccess('shares');
 await connectToDatabase();

 const { searchParams } = req.nextUrl;
 const page = Math.max(1, Number(searchParams.get('page')) || 1);
 const limit = Math.min(
 50,
 Math.max(1, Number(searchParams.get('limit')) || 20),
 );
 const skip = (page - 1) * limit;
 const targetType = searchParams.get('targetType') || undefined;

 const filter: Record<string, unknown> = { orgId: ctx.orgId };
 if (targetType) filter.targetType = targetType;

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
 let targetName = 'Root';
 if (link.targetType === 'asset' && link.targetId) {
 const asset = await Asset.findById(link.targetId)
 .select('name')
 .lean();
 targetName = asset?.name ?? 'Unknown Asset';
 } else if (link.targetType === 'folder' && link.targetId) {
 const folder = await Folder.findById(link.targetId)
 .select('name')
 .lean();
 targetName = folder?.name ?? 'Unknown Folder';
 }
 // Multi-target
 let targetNames: string[] = [];
 if (link.targetIds?.length) {
 const assets = await Asset.find({ _id: { $in: link.targetIds } })
 .select('name')
 .lean();
 targetNames = assets.map((a) => a.name);
 }
 return {
 ...link,
 _id: String(link._id),
 targetName,
 targetNames,
 };
 }),
 );

 return NextResponse.json({
 links: enriched,
 page,
 limit,
 total,
 totalPages: Math.ceil(total / limit),
 });
 } catch (err: unknown) {
 const e = err as { status?: number; message?: string };
 return NextResponse.json(
 { error: e.message ?? 'Server error' },
 { status: e.status ?? 500 },
 );
 }
}

/**
 * POST /api/share-links
 * Create a new share link.
 * Body: {
 * targetType: 'asset' | 'folder' | 'root',
 * targetId?: string,
 * targetIds?: string[],
 * permission?: 'view' | 'edit' | 'admin',
 * includeNested?: boolean,
 * expiresInDays?: number,
 * password?: string,
 * maxDownloads?: number,
 * allowedEmails?: string[],
 * }
 */
export async function POST(req: NextRequest) {
 try {
 const ctx = await requireSectionAccess('shares');

 // Only editors+ can create share links
 const ROLE_LEVEL: Record<string, number> = {
 owner: 4,
 admin: 3,
 editor: 2,
 viewer: 1,
 };
 if ((ROLE_LEVEL[ctx.role] ?? 0) < 2) {
 return NextResponse.json(
 { error: 'Insufficient permissions' },
 { status: 403 },
 );
 }

 await connectToDatabase();
 const body = await req.json();
 const {
 targetType,
 targetId,
 targetIds,
 permission = 'view',
 includeNested = true,
 expiresInDays,
 password,
 maxDownloads,
 allowedEmails,
 } = body;

 if (!['asset', 'folder', 'root'].includes(targetType)) {
 return NextResponse.json(
 { error: 'Invalid targetType' },
 { status: 400 },
 );
 }

 // Validate target exists
 if (targetType === 'asset' && targetId) {
 const asset = await Asset.findOne({
 _id: targetId,
 orgId: ctx.orgId,
 }).lean();
 if (!asset)
 return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
 } else if (targetType === 'folder' && targetId) {
 const folder = await Folder.findOne({
 _id: targetId,
 orgId: ctx.orgId,
 }).lean();
 if (!folder)
 return NextResponse.json(
 { error: 'Folder not found' },
 { status: 404 },
 );
 }

 // Generate unique token
 const token = crypto.randomBytes(32).toString('hex');

 // Hash password if provided
 let passwordHash: string | undefined;
 if (password) {
 const bcrypt = await import('bcryptjs');
 passwordHash = await bcrypt.hash(password, 10);
 }

 const link = await ShareLink.create({
 orgId: ctx.orgId,
 token,
 targetType,
 targetId: targetId || null,
 targetIds: targetIds || [],
 permission,
 includeNested,
 createdBy: ctx.userId,
 expiresAt: expiresInDays
 ? new Date(Date.now() + expiresInDays * 86400000)
 : null,
 password: passwordHash,
 maxDownloads: maxDownloads || null,
 allowedEmails: allowedEmails || [],
 });

 const shareUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:4000'}/s/${token}`;

 return NextResponse.json(
 {
 link: { ...link.toObject(), _id: String(link._id) },
 shareUrl,
 },
 { status: 201 },
 );
 } catch (err: unknown) {
 const e = err as { status?: number; message?: string };
 return NextResponse.json(
 { error: e.message ?? 'Server error' },
 { status: e.status ?? 500 },
 );
 }
}
