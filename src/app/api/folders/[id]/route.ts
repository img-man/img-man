// SPDX-License-Identifier: Apache-2.0
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { connectToDatabase } from '@/lib/db';
import { Folder, Asset, User } from '@/models';
import { propagateAccessMode, checkFolderAccess, getMembershipId, getUserGroupIds } from '@/lib/folder-access';
import type { Role } from '@/lib/permissions';
import type { IFolder } from '@/models/folder';

interface RouteContext {
 params: Promise<{ id: string }>;
}

/**
 * GET /api/folders/:id
 * Returns the folder document (name, path, parentId, galleryMode, galleryEmbed, etc.)
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

 const folder = await Folder.findOne({ _id: id, orgId: user.orgId })
   .select('_id name parentId path accessMode allowedMemberIds allowedGroupIds galleryMode galleryEmbed')
   .lean();

 if (!folder) {
   return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
 }

 // Enforce folder-level access control
 const orgId = String(user.orgId);
 const role = (user.role as Role) ?? 'viewer';
 const membershipId = await getMembershipId(orgId, session.user.email);
 const userGroupIds = membershipId
   ? await getUserGroupIds(orgId, membershipId)
   : [];
 const access = checkFolderAccess(
   folder as Pick<IFolder, 'accessMode' | 'allowedMemberIds' | 'allowedGroupIds'>,
   role,
   membershipId,
   userGroupIds,
 );
 if (!access.hasAccess) {
   return NextResponse.json({ error: 'Access denied' }, { status: 403 });
 }

 return NextResponse.json({ folder });
}

/**
 * PATCH /api/folders/:id
 * Body: { name?, parentId?, accessMode?, allowedMemberIds?, allowedGroupIds?, cascade? }
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

 const orgId = String(user.orgId);
 const body = await req.json();
 const update: Record<string, unknown> = {};

 if (typeof body.name === 'string' && body.name.trim()) {
 update.name = body.name.trim();
 }

 if (body.parentId !== undefined) {
 // Prevent moving folder into itself or its descendants
 if (body.parentId === id) {
 return NextResponse.json(
 { error: 'Cannot move folder into itself' },
 { status: 400 },
 );
 }

 if (body.parentId) {
 const target = await Folder.findOne({
 _id: body.parentId,
 orgId: user.orgId,
 }).lean();
 if (!target) {
 return NextResponse.json(
 { error: 'Target folder not found' },
 { status: 404 },
 );
 }
 // Check for circular reference — target's path must not contain current folder
 const current = await Folder.findOne({
 _id: id,
 orgId: user.orgId,
 }).lean();
 if (current && target.path?.includes(`${current.name}/`)) {
 return NextResponse.json(
 { error: 'Cannot create circular folder reference' },
 { status: 400 },
 );
 }
 update.parentId = body.parentId;
 update.path = `${target.path}${target.name}/`;
 } else {
 update.parentId = null;
 update.path = '/';
 }
 }

 // Handle access mode + allowed lists
 const hasAccessUpdate =
 body.accessMode !== undefined ||
 body.allowedMemberIds !== undefined ||
 body.allowedGroupIds !== undefined;

 if (hasAccessUpdate) {
 // Only owner/admin can change access settings
 if (!['owner', 'admin'].includes(user.role ?? '')) {
 return NextResponse.json(
 { error: 'Only owners and admins can change folder access settings' },
 { status: 403 },
 );
 }

 if (body.accessMode !== undefined) {
 if (!['restricted', 'flexible'].includes(body.accessMode)) {
 return NextResponse.json(
 { error: 'accessMode must be "restricted" or "flexible"' },
 { status: 400 },
 );
 }
 update.accessMode = body.accessMode;
 update.accessModeInherited = false; // Explicit change clears inheritance
 }
 if (body.allowedMemberIds !== undefined) {
 update.allowedMemberIds = body.allowedMemberIds;
 }
 if (body.allowedGroupIds !== undefined) {
 update.allowedGroupIds = body.allowedGroupIds;
 }
 }

 if (Object.keys(update).length === 0) {
 return NextResponse.json(
 { error: 'No valid fields to update' },
 { status: 400 },
 );
 }

 const folder = await Folder.findOneAndUpdate(
 { _id: id, orgId: user.orgId },
 { $set: update },
 { new: true },
 ).lean();

 if (!folder) {
 return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
 }

 // Cascade access mode to child folders if requested
 if (hasAccessUpdate && body.cascade) {
 await propagateAccessMode(
 orgId,
 folder as unknown as Parameters<typeof propagateAccessMode>[1],
 true, // also cascade access lists
 );
 }

 return NextResponse.json({ folder });
}

/**
 * DELETE /api/folders/:id
 * Query: moveAssetsTo? (folderId to relocate assets, default: root)
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

 const folder = await Folder.findOne({ _id: id, orgId: user.orgId }).lean();
 if (!folder) {
 return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
 }

 const moveAssetsTo = req.nextUrl.searchParams.get('moveAssetsTo') || null;

 // Move assets from this folder (and sub-folders) to target
 await Asset.updateMany(
 { orgId: user.orgId, folderId: id },
 { $set: { folderId: moveAssetsTo } },
 );

 // Delete sub-folders that have this folder in their materialised path
 const pathPrefix = `${folder.path}${folder.name}/`;
 const subFolders = await Folder.find({
 orgId: user.orgId,
 path: { $regex: `^${pathPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}` },
 })
 .select('_id')
 .lean();

 if (subFolders.length > 0) {
 const subIds = subFolders.map((f) => f._id);
 // Move assets from sub-folders
 await Asset.updateMany(
 { orgId: user.orgId, folderId: { $in: subIds } },
 { $set: { folderId: moveAssetsTo } },
 );
 await Folder.deleteMany({ _id: { $in: subIds } });
 }

 // Delete the folder itself
 await Folder.deleteOne({ _id: id, orgId: user.orgId });

 return NextResponse.json({ success: true });
}
