// SPDX-License-Identifier: Apache-2.0
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { ShareLink, Asset, Folder, Organization } from '@/models';
import { requirePermission } from '@/lib/auth-context';

interface RouteContext {
 params: Promise<{ token: string }>;
}

/**
 * GET /api/share/[token]
 * Resolve a share link (PUBLIC — no auth required).
 * Returns target info, permissions, and whether a password is needed.
 */
export async function GET(_req: NextRequest, context: RouteContext) {
 try {
 const { token } = await context.params;
 await connectToDatabase();

 const link = await ShareLink.findOne({ token }).lean();

 if (!link) {
 return NextResponse.json(
 { error: 'Share link not found' },
 { status: 404 },
 );
 }

 if (!link.isActive) {
 return NextResponse.json(
 { error: 'This share link has been revoked' },
 { status: 410 },
 );
 }

 if (link.expiresAt && new Date() > link.expiresAt) {
 return NextResponse.json(
 { error: 'This share link has expired' },
 { status: 410 },
 );
 }

 // Update access tracking
 await ShareLink.findByIdAndUpdate(link._id, {
 $inc: { accessCount: 1 },
 lastAccessedAt: new Date(),
 });

 // Determine if password is required
 const requiresPassword = !!link.password;

 // Get org branding
 const org = await Organization.findById(link.orgId)
 .select('name slug')
 .lean();

 // Get target info (basic, no assets yet — that's a separate endpoint)
 let target: { name: string; type: string } | null = null;
 if (link.targetType === 'asset') {
 const asset = await Asset.findById(link.targetId)
 .select('name originalName mimeType')
 .lean();
 target = asset
 ? { name: asset.name ?? asset.originalName, type: asset.mimeType }
 : null;
 } else {
 const folder = await Folder.findById(link.targetId)
 .select('name')
 .lean();
 target = folder ? { name: folder.name, type: 'folder' } : null;
 }

 if (!target) {
 return NextResponse.json(
 { error: 'Shared content has been deleted' },
 { status: 404 },
 );
 }

 return NextResponse.json({
 share: {
 targetType: link.targetType,
 targetName: target.name,
 targetMimeType: target.type,
 permission: link.permission,
 requiresPassword,
 organization: org ? { name: org.name } : null,
 includeNested: link.includeNested,
 },
 });
 } catch (err: unknown) {
 const e = err as { status?: number; error?: string; message?: string };
 return NextResponse.json(
 { error: e.error ?? e.message ?? 'Server error' },
 { status: e.status ?? 500 },
 );
 }
}

/**
 * DELETE /api/share/[token]
 * Revoke a share link (requires auth + share permission).
 */
export async function DELETE(_req: NextRequest, context: RouteContext) {
 try {
 const ctx = await requirePermission('share');
 const { token } = await context.params;
 await connectToDatabase();

 const link = await ShareLink.findOne({
 token,
 orgId: ctx.orgId,
 });

 if (!link) {
 return NextResponse.json(
 { error: 'Share link not found' },
 { status: 404 },
 );
 }

 link.isActive = false;
 await link.save();

 return NextResponse.json({ success: true });
 } catch (err: unknown) {
 const e = err as { status?: number; error?: string; message?: string };
 return NextResponse.json(
 { error: e.error ?? e.message ?? 'Server error' },
 { status: e.status ?? 500 },
 );
 }
}
