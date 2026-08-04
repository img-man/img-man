// SPDX-License-Identifier: Apache-2.0
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { OrgMembership, User, MemberGroup } from '@/models';
import { requireAuthContextOrApiKey } from '@/lib/auth-context';
import { canInviteRole, canRemoveMember, type Role } from '@/lib/permissions';

const VALID_ROLES: Role[] = ['admin', 'editor', 'viewer'];
const MAX_BULK_SIZE = 500;

/**
 * POST /api/team/bulk
 * Bulk invite members.
 * Body: { members: Array<{ name, email?, phone?, role, accessRules?, groupIds? }> }
 */
export async function POST(req: NextRequest) {
 try {
 const ctx = await requireAuthContextOrApiKey(req);
 const body = await req.json();
 const { members } = body as {
 members?: Array<{
 name?: string;
 email?: string;
 phone?: string;
 role?: string;
 accessRules?: { path: string; role: string; resourceType: string }[];
 groupIds?: string[];
 }>;
 };

 if (!members || !Array.isArray(members) || members.length === 0) {
 return NextResponse.json(
 { error: 'members must be a non-empty array' },
 { status: 400 },
 );
 }

 if (members.length > MAX_BULK_SIZE) {
 return NextResponse.json(
 { error: `Cannot invite more than ${MAX_BULK_SIZE} members at once` },
 { status: 400 },
 );
 }

 await connectToDatabase();

 const results: Array<{
 index: number;
 success: boolean;
 membershipId?: string;
 error?: string;
 }> = [];

 // Collect all groupIds for validation
 const allGroupIds = new Set<string>();
 for (const m of members) {
 if (m.groupIds) m.groupIds.forEach((id) => allGroupIds.add(id));
 }

 // Validate groups exist in this org
 let validGroupIds = new Set<string>();
 if (allGroupIds.size > 0) {
 const groups = await MemberGroup.find({
 _id: { $in: Array.from(allGroupIds) },
 orgId: ctx.orgId,
 })
 .select('_id')
 .lean();
 validGroupIds = new Set(
 groups.map((g) => (g._id as unknown as string).toString()),
 );
 }

 // Process each member
 for (let i = 0; i < members.length; i++) {
 const m = members[i];
 try {
 // Validate name
 if (!m.name || !m.name.trim()) {
 results.push({ index: i, success: false, error: 'Name is required' });
 continue;
 }

 // Validate contact
 const normalizedEmail = m.email?.toLowerCase().trim() || undefined;
 const normalizedPhone = m.phone?.replace(/[^+\d]/g, '').trim() || undefined;
 if (!normalizedEmail && !normalizedPhone) {
 results.push({ index: i, success: false, error: 'Email or phone required' });
 continue;
 }

 // Validate role
 if (!m.role || !VALID_ROLES.includes(m.role as Role)) {
 results.push({ index: i, success: false, error: 'Invalid role' });
 continue;
 }

 // Check hierarchy
 if (!canInviteRole(ctx.role, m.role as Role)) {
 results.push({
 index: i,
 success: false,
 error: `Cannot invite ${m.role}s with your role`,
 });
 continue;
 }

 // Check duplicate in org
 const existingFilter: Record<string, unknown>[] = [];
 if (normalizedEmail) existingFilter.push({ email: normalizedEmail });
 if (normalizedPhone) existingFilter.push({ phone: normalizedPhone });

 const existing = await OrgMembership.findOne({
 orgId: ctx.orgId,
 $or: existingFilter,
 status: 'active',
 }).lean();

 if (existing) {
 results.push({
 index: i,
 success: false,
 error: 'Already a member',
 membershipId: (existing._id as unknown as string).toString(),
 });
 continue;
 }

 // Clean up old records
 if (normalizedEmail) {
 await OrgMembership.deleteMany({
 orgId: ctx.orgId,
 email: normalizedEmail,
 status: { $in: ['pending', 'revoked'] },
 });
 }

 // Check existing user account
 const existingUser = normalizedEmail
 ? await User.findOne({ email: normalizedEmail }).lean()
 : null;

 // Validate access rules
 const validatedRules = (m.accessRules ?? []).map((r) => ({
 path: r.path,
 role: r.role as 'owner' | 'admin' | 'editor' | 'viewer',
 resourceType: (r.resourceType ?? 'folder') as 'folder' | 'asset',
 }));

 // API key auth uses synthetic userId — not a valid ObjectId
 const invitedByUserId = ctx.userId.startsWith('apikey:') ? null : ctx.userId;

 const membership = await OrgMembership.create({
 orgId: ctx.orgId,
 userId: existingUser?._id ?? null,
 email: normalizedEmail || null,
 phone: normalizedPhone || null,
 inviteName: m.name.trim(),
 role: m.role as Role,
 invitedBy: invitedByUserId,
 status: 'active',
 accessRules: validatedRules,
 });

 const membershipId = (membership._id as unknown as string).toString();

 // Add to groups if specified
 if (m.groupIds && m.groupIds.length > 0) {
 const validIds = m.groupIds.filter((gid) => validGroupIds.has(gid));
 if (validIds.length > 0) {
 await MemberGroup.updateMany(
 { _id: { $in: validIds }, orgId: ctx.orgId },
 { $addToSet: { memberIds: membership._id } },
 );
 }
 }

 results.push({ index: i, success: true, membershipId });
 } catch {
 results.push({ index: i, success: false, error: 'Failed to create membership' });
 }
 }

 const succeeded = results.filter((r) => r.success).length;
 const failed = results.filter((r) => !r.success).length;

 return NextResponse.json(
 {
 total: members.length,
 succeeded,
 failed,
 results,
 },
 { status: failed === members.length ? 400 : 201 },
 );
 } catch (err: unknown) {
 const e = err as { status?: number; error?: string; message?: string };
 return NextResponse.json(
 { error: e.error ?? e.message ?? 'Server error' },
 { status: e.status ?? 500 },
 );
 }
}

/**
 * PATCH /api/team/bulk
 * Bulk update member roles or access rules.
 * Body: { memberIds: string[], updates: { role?, accessRules? } }
 */
export async function PATCH(req: NextRequest) {
 try {
 const ctx = await requireAuthContextOrApiKey(req);

 if (!['owner', 'admin'].includes(ctx.role)) {
 return NextResponse.json(
 { error: 'Only owners and admins can bulk update members' },
 { status: 403 },
 );
 }

 const body = await req.json();
 const { memberIds, updates } = body as {
 memberIds?: string[];
 updates?: {
 role?: string;
 accessRules?: { path: string; role: string; resourceType: string }[];
 };
 };

 if (!memberIds || !Array.isArray(memberIds) || memberIds.length === 0) {
 return NextResponse.json(
 { error: 'memberIds must be a non-empty array' },
 { status: 400 },
 );
 }

 if (memberIds.length > MAX_BULK_SIZE) {
 return NextResponse.json(
 { error: `Cannot update more than ${MAX_BULK_SIZE} members at once` },
 { status: 400 },
 );
 }

 if (!updates || Object.keys(updates).length === 0) {
 return NextResponse.json(
 { error: 'updates object is required with at least one field' },
 { status: 400 },
 );
 }

 await connectToDatabase();

 const updateDoc: Record<string, unknown> = {};

 if (updates.role) {
 if (!VALID_ROLES.includes(updates.role as Role)) {
 return NextResponse.json(
 { error: 'Invalid role' },
 { status: 400 },
 );
 }
 updateDoc.role = updates.role;
 }

 if (updates.accessRules !== undefined) {
 const validRoles = ['owner', 'admin', 'editor', 'viewer'];
 const validTypes = ['folder', 'asset'];
 for (const rule of updates.accessRules) {
 if (!rule.path || !validRoles.includes(rule.role) || !validTypes.includes(rule.resourceType)) {
 return NextResponse.json(
 { error: 'Each access rule must have a valid path, role, and resourceType' },
 { status: 400 },
 );
 }
 }
 updateDoc.accessRules = updates.accessRules;
 }

 const result = await OrgMembership.updateMany(
 {
 _id: { $in: memberIds },
 orgId: ctx.orgId,
 status: 'active',
 role: { $ne: 'owner' }, // Cannot bulk-update owners
 },
 { $set: updateDoc },
 );

 return NextResponse.json({
 success: true,
 matched: result.matchedCount,
 modified: result.modifiedCount,
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
 * DELETE /api/team/bulk
 * Bulk remove members from the org.
 * Body: { memberIds: string[] }
 */
export async function DELETE(req: NextRequest) {
 try {
 const ctx = await requireAuthContextOrApiKey(req);

 const body = await req.json();
 const { memberIds } = body as { memberIds?: string[] };

 if (!memberIds || !Array.isArray(memberIds) || memberIds.length === 0) {
 return NextResponse.json(
 { error: 'memberIds must be a non-empty array' },
 { status: 400 },
 );
 }

 if (memberIds.length > MAX_BULK_SIZE) {
 return NextResponse.json(
 { error: `Cannot remove more than ${MAX_BULK_SIZE} members at once` },
 { status: 400 },
 );
 }

 await connectToDatabase();

 // Fetch members to validate hierarchy
 const memberships = await OrgMembership.find({
 _id: { $in: memberIds },
 orgId: ctx.orgId,
 status: 'active',
 }).lean();

 const removable: string[] = [];
 const denied: Array<{ id: string; reason: string }> = [];

 for (const m of memberships) {
 const mid = (m._id as unknown as string).toString();
 if (!canRemoveMember(ctx.role, m.role as Role)) {
 denied.push({ id: mid, reason: `Cannot remove ${m.role} with your role` });
 } else {
 removable.push(mid);
 }
 }

 // Revoke valid members
 let revokedCount = 0;
 if (removable.length > 0) {
 const result = await OrgMembership.updateMany(
 { _id: { $in: removable }, orgId: ctx.orgId },
 { $set: { status: 'revoked' } },
 );
 revokedCount = result.modifiedCount;

 // Also remove from any groups
 await MemberGroup.updateMany(
 { orgId: ctx.orgId, memberIds: { $in: removable } },
 { $pullAll: { memberIds: removable } },
 );
 }

 return NextResponse.json({
 success: true,
 revoked: revokedCount,
 denied: denied.length > 0 ? denied : undefined,
 });
 } catch (err: unknown) {
 const e = err as { status?: number; error?: string; message?: string };
 return NextResponse.json(
 { error: e.error ?? e.message ?? 'Server error' },
 { status: e.status ?? 500 },
 );
 }
}
