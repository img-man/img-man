// SPDX-License-Identifier: Apache-2.0
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { MemberGroup, OrgMembership } from '@/models';
import { requireAuthContextOrApiKey, requireSectionAccessOrApiKey } from '@/lib/auth-context';

/**
 * GET /api/team/groups
 * List all member groups for the org, with optional pagination.
 * Query: page?, limit?, search?
 */
export async function GET(req: NextRequest) {
 try {
 const ctx = await requireSectionAccessOrApiKey(req, 'team');
 await connectToDatabase();

 const { searchParams } = req.nextUrl;
 const pageParam = searchParams.get('page');
 const limitParam = searchParams.get('limit');
 const search = searchParams.get('search')?.trim();
 const usePagination = pageParam !== null || limitParam !== null;
 const page = Math.max(1, Number(pageParam) || 1);
 const limit = Math.min(100, Math.max(1, Number(limitParam) || 50));
 const skip = usePagination ? (page - 1) * limit : 0;

 const filter: Record<string, unknown> = { orgId: ctx.orgId };
 if (search) {
 filter.name = { $regex: search, $options: 'i' };
 }

 const query = MemberGroup.find(filter).sort({ name: 1 });
 if (usePagination) query.skip(skip).limit(limit);

 const [groups, total] = await Promise.all([
 query.lean(),
 usePagination ? MemberGroup.countDocuments(filter) : Promise.resolve(0),
 ]);

 const result = groups.map((g) => ({
 id: (g._id as unknown as string).toString(),
 name: g.name,
 description: g.description ?? null,
 memberCount: g.memberIds?.length ?? 0,
 accessRules: g.accessRules ?? [],
 metadata: g.metadata ?? {},
 createdAt: g.createdAt,
 updatedAt: g.updatedAt,
 }));

 return NextResponse.json({
 groups: result,
 ...(usePagination && { page, limit, total }),
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
 * POST /api/team/groups
 * Create a new member group.
 * Body: { name, description?, memberIds?, accessRules?, metadata? }
 */
export async function POST(req: NextRequest) {
 try {
 const ctx = await requireAuthContextOrApiKey(req);

 // Only owner/admin can create groups
 if (!['owner', 'admin'].includes(ctx.role)) {
 return NextResponse.json(
 { error: 'Only owners and admins can create member groups' },
 { status: 403 },
 );
 }

 const body = await req.json();
 const { name, description, memberIds, accessRules, metadata } = body as {
 name?: string;
 description?: string;
 memberIds?: string[];
 accessRules?: { path: string; role: string; resourceType: string }[];
 metadata?: Record<string, string>;
 };

 if (!name || !name.trim()) {
 return NextResponse.json(
 { error: 'Group name is required' },
 { status: 400 },
 );
 }

 // Validate accessRules if provided
 if (accessRules && accessRules.length > 0) {
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
 }

 await connectToDatabase();

 // Validate memberIds belong to this org
 if (memberIds && memberIds.length > 0) {
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
 }

 // Check for duplicate group name in this org
 const existing = await MemberGroup.findOne({
 orgId: ctx.orgId,
 name: name.trim(),
 }).lean();
 if (existing) {
 return NextResponse.json(
 { error: 'A group with this name already exists' },
 { status: 409 },
 );
 }

 const group = await MemberGroup.create({
 orgId: ctx.orgId,
 name: name.trim(),
 description: description?.trim(),
 memberIds: memberIds ?? [],
 accessRules: accessRules ?? [],
 createdById: ctx.userId,
 metadata: metadata ? new Map(Object.entries(metadata)) : new Map(),
 });

 return NextResponse.json(
 {
 group: {
 id: group._id.toString(),
 name: group.name,
 description: group.description ?? null,
 memberCount: group.memberIds.length,
 accessRules: group.accessRules,
 metadata: Object.fromEntries(group.metadata),
 createdAt: group.createdAt,
 },
 },
 { status: 201 },
 );
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
