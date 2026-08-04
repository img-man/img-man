// SPDX-License-Identifier: Apache-2.0
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { OrgMembership, User, Folder, MemberGroup } from '@/models';
import { requireSectionAccess } from '@/lib/auth-context';

/**
 * GET /api/team
 * List org members + pending invites with optional pagination.
 * Query: page?, limit? (defaults to all if omitted for backward compat)
 */
export async function GET(req: NextRequest) {
 try {
 const ctx = await requireSectionAccess('team');
 await connectToDatabase();

 const { searchParams } = req.nextUrl;
 const pageParam = searchParams.get('page');
 const limitParam = searchParams.get('limit');
 const usePagination = pageParam !== null || limitParam !== null;
 const page = Math.max(1, Number(pageParam) || 1);
 const limit = Math.min(100, Math.max(1, Number(limitParam) || 50));
 const skip = usePagination ? (page - 1) * limit : 0;

 const filter = {
 orgId: ctx.orgId,
 status: { $in: ['active', 'pending'] },
 };

 const query = OrgMembership.find(filter)
 .sort({ status: 1, createdAt: -1 });
 if (usePagination) query.skip(skip).limit(limit);

 const [memberships, total] = await Promise.all([
 query.lean(),
 usePagination ? OrgMembership.countDocuments(filter) : Promise.resolve(0),
 ]);

 // Enrich active members with user info
 const userIds = memberships
 .filter((m) => m.userId)
 .map((m) => m.userId);

 const users = await User.find({ _id: { $in: userIds } })
 .select('name email image')
 .lean();

 const userMap = new Map(
 users.map((u) => [(u._id as unknown as string).toString(), u]),
 );

 // Fetch all folders for enriching folder access display
 const allFolders = await Folder.find({ orgId: ctx.orgId })
 .select('name path')
 .lean();
 const folderMap = new Map(
 allFolders.map((f) => [(f._id as unknown as string).toString(), f.name]),
 );

 // Fetch all groups to show per-member group memberships
 const allGroups = await MemberGroup.find({ orgId: ctx.orgId })
 .select('name memberIds accessRules')
 .lean();
 // Build a map: membershipId → [{ groupId, groupName, accessRules }]
 const memberGroupMap = new Map<string, { groupId: string; groupName: string; accessRules: { path: string; role: string; resourceType: string }[] }[]>();
 for (const g of allGroups) {
 const gId = (g._id as unknown as string).toString();
 const gName = g.name;
 const gRules = (g.accessRules ?? []) as { path: string; role: string; resourceType: string }[];
 for (const mid of g.memberIds ?? []) {
 const midStr = String(mid);
 if (!memberGroupMap.has(midStr)) memberGroupMap.set(midStr, []);
 memberGroupMap.get(midStr)!.push({ groupId: gId, groupName: gName, accessRules: gRules });
 }
 }

 const members = memberships.map((m) => {
 const user = m.userId
 ? userMap.get((m.userId as unknown as string).toString())
 : null;
 const fa = (m as unknown as { folderAccess?: string[] }).folderAccess ?? [];
 const rules = (m as unknown as { accessRules?: { path: string; role: string; resourceType?: string }[] }).accessRules ?? [];
 // sectionAccess is stored as a Mongoose Map; with .lean() it becomes a plain object
 const rawSectionAccess = (m as unknown as { sectionAccess?: Map<string, number> | Record<string, number> }).sectionAccess;
 const sectionAccess: Record<string, number> = rawSectionAccess instanceof Map
 ? Object.fromEntries(rawSectionAccess)
 : rawSectionAccess ?? {};
 return {
 id: (m._id as unknown as string).toString(),
 email: m.email,
 role: m.role,
 status: m.status,
 name: user?.name ?? null,
 image: user?.image ?? null,
 userId: m.userId
 ? (m.userId as unknown as string).toString()
 : null,
 inviteName: (m as unknown as { inviteName?: string }).inviteName ?? null,
 inviteExpiresAt: m.inviteExpiresAt ?? null,
 createdAt: m.createdAt,
 folderAccess: fa,
 folderAccessNames: fa.map((id: string) => folderMap.get(id) ?? id),
 accessRules: rules.map((r) => ({
 path: r.path,
 role: r.role,
 resourceType: r.resourceType ?? 'folder',
 })),
 sectionAccess,
 groups: memberGroupMap.get((m._id as unknown as string).toString()) ?? [],
 };
 });

 // Ensure the current user (caller) appears in the member list
 // even if they don't have an OrgMembership record yet (e.g., org owner)
 const callerInList = members.some(
 (m) => m.userId === ctx.userId || (m.email && m.email.toLowerCase() === (ctx.email ?? '').toLowerCase()),
 );
 if (!callerInList) {
 const callerUser = await User.findById(ctx.userId).select('name email image').lean();
 if (callerUser) {
 members.unshift({
 id: `self-${ctx.userId}`,
 email: callerUser.email ?? ctx.email ?? '',
 role: ctx.role,
 status: 'active' as const,
 name: callerUser.name ?? null,
 image: callerUser.image ?? null,
 userId: ctx.userId,
 inviteName: null,
 inviteExpiresAt: null,
 createdAt: new Date().toISOString() as unknown as Date,
 folderAccess: [],
 folderAccessNames: [],
 accessRules: [],
 sectionAccess: {},
 groups: [],
 });
 }
 }

 return NextResponse.json({
 members,
 folders: allFolders.map((f) => ({ id: (f._id as unknown as string).toString(), name: f.name, path: f.path })),
 ...(usePagination ? { page, limit, total, totalPages: Math.ceil(total / limit) } : {}),
 });
 } catch (err: unknown) {
 const e = err as { status?: number; error?: string; message?: string };
 return NextResponse.json(
 { error: e.error ?? e.message ?? 'Server error' },
 { status: e.status ?? 500 },
 );
 }
}
