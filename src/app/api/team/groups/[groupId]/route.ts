// SPDX-License-Identifier: Apache-2.0
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { MemberGroup, OrgMembership, User } from '@/models';
import { requireAuthContextOrApiKey, requireSectionAccessOrApiKey } from '@/lib/auth-context';

interface RouteContext {
 params: Promise<{ groupId: string }>;
}

/**
 * GET /api/team/groups/[groupId]
 * Get a single group with its member details.
 */
export async function GET(req: NextRequest, context: RouteContext) {
 try {
 const ctx = await requireSectionAccessOrApiKey(req, 'team');
 const { groupId } = await context.params;
 await connectToDatabase();

 const group = await MemberGroup.findOne({
 _id: groupId,
 orgId: ctx.orgId,
 }).lean();

 if (!group) {
 return NextResponse.json(
 { error: 'Group not found' },
 { status: 404 },
 );
 }

 // Fetch member details
 const memberships = await OrgMembership.find({
 _id: { $in: group.memberIds },
 orgId: ctx.orgId,
 }).lean();

 const userIds = memberships
 .filter((m) => m.userId)
 .map((m) => m.userId);

 const users = await User.find({ _id: { $in: userIds } })
 .select('name email image')
 .lean();

 const userMap = new Map(
 users.map((u) => [(u._id as unknown as string).toString(), u]),
 );

 const members = memberships.map((m) => {
 const user = m.userId
 ? userMap.get((m.userId as unknown as string).toString())
 : null;
 return {
 id: (m._id as unknown as string).toString(),
 email: m.email,
 phone: (m as unknown as { phone?: string }).phone ?? null,
 role: m.role,
 status: m.status,
 name: user?.name ?? (m as unknown as { inviteName?: string }).inviteName ?? null,
 image: user?.image ?? null,
 };
 });

 return NextResponse.json({
 group: {
 id: (group._id as unknown as string).toString(),
 name: group.name,
 description: group.description ?? null,
 memberCount: group.memberIds?.length ?? 0,
 members,
 accessRules: group.accessRules ?? [],
 metadata: group.metadata ?? {},
 createdAt: group.createdAt,
 updatedAt: group.updatedAt,
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
 * PATCH /api/team/groups/[groupId]
 * Update a group's name, description, accessRules, or metadata.
 * Body: { name?, description?, accessRules?, metadata? }
 */
export async function PATCH(req: NextRequest, context: RouteContext) {
 try {
 const ctx = await requireAuthContextOrApiKey(req);
 const { groupId } = await context.params;

 if (!['owner', 'admin'].includes(ctx.role)) {
 return NextResponse.json(
 { error: 'Only owners and admins can update member groups' },
 { status: 403 },
 );
 }

 const body = await req.json();
 const { name, description, accessRules, metadata, memberIds, addMemberIds, removeMemberIds } = body as {
 name?: string;
 description?: string;
 accessRules?: { path: string; role: string; resourceType: string }[];
 metadata?: Record<string, string>;
 memberIds?: string[];
 addMemberIds?: string[];
 removeMemberIds?: string[];
 };

 await connectToDatabase();

 const group = await MemberGroup.findOne({
 _id: groupId,
 orgId: ctx.orgId,
 });

 if (!group) {
 return NextResponse.json(
 { error: 'Group not found' },
 { status: 404 },
 );
 }

 // Build update object
 const update: Record<string, unknown> = {};

 if (name !== undefined) {
 if (!name.trim()) {
 return NextResponse.json(
 { error: 'Group name cannot be empty' },
 { status: 400 },
 );
 }
 // Check duplicate name (excluding self)
 const duplicate = await MemberGroup.findOne({
 orgId: ctx.orgId,
 name: name.trim(),
 _id: { $ne: groupId },
 }).lean();
 if (duplicate) {
 return NextResponse.json(
 { error: 'A group with this name already exists' },
 { status: 409 },
 );
 }
 update.name = name.trim();
 }

 if (description !== undefined) {
 update.description = description?.trim() || '';
 }

 if (accessRules !== undefined) {
 const validRoles = ['owner', 'admin', 'editor', 'viewer'];
 const validTypes = ['folder', 'asset'];
 for (const rule of accessRules) {
 if (!rule.path || !validRoles.includes(rule.role) || !validTypes.includes(rule.resourceType)) {
 return NextResponse.json(
 { error: 'Each access rule must have a valid path, role, and resourceType' },
 { status: 400 },
 );
 }
 }
 update.accessRules = accessRules;
 }

 if (metadata !== undefined) {
 update.metadata = new Map(Object.entries(metadata));
 }

 // Handle memberIds — full replacement, add, or remove
 let memberOps: Record<string, unknown> | null = null;
 if (memberIds !== undefined) {
 // Validate all memberIds belong to this org
 const validCount = await OrgMembership.countDocuments({
 _id: { $in: memberIds },
 orgId: ctx.orgId,
 status: { $in: ['active', 'pending'] },
 });
 if (validCount !== memberIds.length) {
 return NextResponse.json(
 { error: 'One or more member IDs are invalid or not in this organization' },
 { status: 400 },
 );
 }
 update.memberIds = memberIds;
 } else if (addMemberIds?.length || removeMemberIds?.length) {
 // Validate addMemberIds
 if (addMemberIds?.length) {
 const validCount = await OrgMembership.countDocuments({
 _id: { $in: addMemberIds },
 orgId: ctx.orgId,
 status: { $in: ['active', 'pending'] },
 });
 if (validCount !== addMemberIds.length) {
 return NextResponse.json(
 { error: 'One or more member IDs to add are invalid' },
 { status: 400 },
 );
 }
 }
 memberOps = {};
 if (addMemberIds?.length) {
 memberOps.$addToSet = { memberIds: { $each: addMemberIds } };
 }
 if (removeMemberIds?.length) {
 memberOps.$pull = { memberIds: { $in: removeMemberIds } };
 }
 }

 const hasUpdates = Object.keys(update).length > 0 || memberOps !== null;
 if (!hasUpdates) {
 return NextResponse.json(
 { error: 'No fields to update' },
 { status: 400 },
 );
 }

 // Apply atomic $set updates
 if (Object.keys(update).length > 0) {
 await MemberGroup.findByIdAndUpdate(groupId, { $set: update });
 }
 // Apply $addToSet / $pull for member operations separately
 if (memberOps) {
 if (memberOps.$addToSet) {
 await MemberGroup.findByIdAndUpdate(groupId, { $addToSet: (memberOps.$addToSet as Record<string, unknown>) });
 }
 if (memberOps.$pull) {
 await MemberGroup.findByIdAndUpdate(groupId, { $pull: (memberOps.$pull as Record<string, unknown>) });
 }
 }

 const updated = await MemberGroup.findById(groupId).lean();

 return NextResponse.json({
 group: {
 id: (updated!._id as unknown as string).toString(),
 name: updated!.name,
 description: updated!.description ?? null,
 memberCount: updated!.memberIds?.length ?? 0,
 accessRules: updated!.accessRules ?? [],
 metadata: updated!.metadata ?? {},
 updatedAt: updated!.updatedAt,
 },
 });
 } catch (err: unknown) {
 const e = err as { status?: number; error?: string; message?: string; code?: number };
 if (e.code === 11000) {
 return NextResponse.json(
 { error: 'A group with this name already exists' },
 { status: 409 },
 );
 }
 return NextResponse.json(
 { error: e.error ?? e.message ?? 'Server error' },
 { status: e.status ?? 500 },
 );
 }
}

/**
 * DELETE /api/team/groups/[groupId]
 * Delete a member group (does not remove actual members from the org).
 */
export async function DELETE(req: NextRequest, context: RouteContext) {
 try {
 const ctx = await requireAuthContextOrApiKey(req);
 const { groupId } = await context.params;

 if (!['owner', 'admin'].includes(ctx.role)) {
 return NextResponse.json(
 { error: 'Only owners and admins can delete member groups' },
 { status: 403 },
 );
 }

 await connectToDatabase();

 const deleted = await MemberGroup.findOneAndDelete({
 _id: groupId,
 orgId: ctx.orgId,
 });

 if (!deleted) {
 return NextResponse.json(
 { error: 'Group not found' },
 { status: 404 },
 );
 }

 return NextResponse.json({
 success: true,
 deletedGroupId: groupId,
 });
 } catch (err: unknown) {
 const e = err as { status?: number; error?: string; message?: string };
 return NextResponse.json(
 { error: e.error ?? e.message ?? 'Server error' },
 { status: e.status ?? 500 },
 );
 }
}
