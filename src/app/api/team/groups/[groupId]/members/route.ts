// SPDX-License-Identifier: Apache-2.0
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { MemberGroup, OrgMembership } from '@/models';
import { requireAuthContextOrApiKey } from '@/lib/auth-context';

interface RouteContext {
 params: Promise<{ groupId: string }>;
}

/**
 * POST /api/team/groups/[groupId]/members
 * Add members to a group (bulk).
 * Body: { memberIds: string[] }
 */
export async function POST(req: NextRequest, context: RouteContext) {
 try {
 const ctx = await requireAuthContextOrApiKey(req);
 const { groupId } = await context.params;

 if (!['owner', 'admin'].includes(ctx.role)) {
 return NextResponse.json(
 { error: 'Only owners and admins can manage group members' },
 { status: 403 },
 );
 }

 const body = await req.json();
 const { memberIds } = body as { memberIds?: string[] };

 if (!memberIds || !Array.isArray(memberIds) || memberIds.length === 0) {
 return NextResponse.json(
 { error: 'memberIds must be a non-empty array' },
 { status: 400 },
 );
 }

 if (memberIds.length > 500) {
 return NextResponse.json(
 { error: 'Cannot add more than 500 members at once' },
 { status: 400 },
 );
 }

 await connectToDatabase();

 // Verify the group exists and belongs to this org
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

 // Validate that all memberIds belong to this org
 const validMembers = await OrgMembership.find({
 _id: { $in: memberIds },
 orgId: ctx.orgId,
 status: { $in: ['active', 'pending'] },
 })
 .select('_id')
 .lean();

 const validIds = new Set(
 validMembers.map((m) => (m._id as unknown as string).toString()),
 );
 const invalidIds = memberIds.filter((id) => !validIds.has(id));
 if (invalidIds.length > 0) {
 return NextResponse.json(
 {
 error: `Invalid member IDs: ${invalidIds.join(', ')}`,
 invalidIds,
 },
 { status: 400 },
 );
 }

 // Add members using $addToSet to avoid duplicates
 const updated = await MemberGroup.findByIdAndUpdate(
 groupId,
 { $addToSet: { memberIds: { $each: memberIds } } },
 { new: true },
 ).lean();

 return NextResponse.json({
 success: true,
 groupId,
 memberCount: updated!.memberIds.length,
 added: memberIds.length,
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
 * DELETE /api/team/groups/[groupId]/members
 * Remove members from a group (bulk).
 * Body: { memberIds: string[] }
 */
export async function DELETE(req: NextRequest, context: RouteContext) {
 try {
 const ctx = await requireAuthContextOrApiKey(req);
 const { groupId } = await context.params;

 if (!['owner', 'admin'].includes(ctx.role)) {
 return NextResponse.json(
 { error: 'Only owners and admins can manage group members' },
 { status: 403 },
 );
 }

 const body = await req.json();
 const { memberIds } = body as { memberIds?: string[] };

 if (!memberIds || !Array.isArray(memberIds) || memberIds.length === 0) {
 return NextResponse.json(
 { error: 'memberIds must be a non-empty array' },
 { status: 400 },
 );
 }

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

 const updated = await MemberGroup.findByIdAndUpdate(
 groupId,
 { $pullAll: { memberIds } },
 { new: true },
 ).lean();

 return NextResponse.json({
 success: true,
 groupId,
 memberCount: updated!.memberIds.length,
 removed: memberIds.length,
 });
 } catch (err: unknown) {
 const e = err as { status?: number; error?: string; message?: string };
 return NextResponse.json(
 { error: e.error ?? e.message ?? 'Server error' },
 { status: e.status ?? 500 },
 );
 }
}
