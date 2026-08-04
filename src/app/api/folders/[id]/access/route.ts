// SPDX-License-Identifier: Apache-2.0
/**
 * GET  /api/folders/[id]/access — Get folder access details (mode, members, groups)
 * PATCH /api/folders/[id]/access — Update folder access (mode, members, groups)
 *
 * Only owner/admin can modify. Editors/viewers can read.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { connectToDatabase } from '@/lib/db';
import { Folder, User, OrgMembership, MemberGroup } from '@/models';
import { updateFolderAccess, propagateAccessMode } from '@/lib/folder-access';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/folders/[id]/access
 * Returns the folder's access mode, allowed members (with details), and allowed groups.
 */
export async function GET(req: NextRequest, ctx: RouteContext) {
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

  // Resolve member details
  const memberIds = (folder as Record<string, unknown>).allowedMemberIds as string[] ?? [];
  const groupIds = (folder as Record<string, unknown>).allowedGroupIds as string[] ?? [];

  const [members, groups] = await Promise.all([
    memberIds.length > 0
      ? OrgMembership.find({ _id: { $in: memberIds }, orgId: user.orgId })
          .select('email phone role status inviteName userId')
          .lean()
      : Promise.resolve([]),
    groupIds.length > 0
      ? MemberGroup.find({ _id: { $in: groupIds }, orgId: user.orgId })
          .select('name description memberIds')
          .lean()
      : Promise.resolve([]),
  ]);

  // Enrich member data with user names
  const userIds = members
    .filter((m) => m.userId)
    .map((m) => m.userId);
  const users = userIds.length > 0
    ? await User.find({ _id: { $in: userIds } }).select('name email image').lean()
    : [];
  const userMap = new Map(users.map((u) => [String(u._id), u]));

  return NextResponse.json({
    folderId: id,
    folderName: folder.name,
    accessMode: (folder as Record<string, unknown>).accessMode ?? 'flexible',
    accessModeInherited: (folder as Record<string, unknown>).accessModeInherited ?? false,
    allowedMembers: members.map((m) => {
      const u = m.userId ? userMap.get(String(m.userId)) : null;
      return {
        membershipId: String(m._id),
        email: m.email,
        name: u?.name ?? (m as Record<string, unknown>).inviteName ?? null,
        image: u?.image ?? null,
        role: m.role,
        status: m.status,
      };
    }),
    allowedGroups: groups.map((g) => ({
      groupId: String(g._id),
      name: g.name,
      description: g.description ?? null,
      memberCount: g.memberIds?.length ?? 0,
    })),
  });
}

/**
 * PATCH /api/folders/[id]/access
 * Body: { accessMode?, allowedMemberIds?, allowedGroupIds?, cascade? }
 *
 * - accessMode: 'restricted' | 'flexible'
 * - allowedMemberIds: string[] — OrgMembership IDs
 * - allowedGroupIds: string[] — MemberGroup IDs
 * - cascade: boolean — propagate to all child folders
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

  // Only owners/admins can change access
  if (!['owner', 'admin'].includes(user.role ?? '')) {
    return NextResponse.json(
      { error: 'Only owners and admins can change folder access' },
      { status: 403 },
    );
  }

  const orgId = String(user.orgId);
  const body = await req.json();
  const { accessMode, allowedMemberIds, allowedGroupIds, cascade } = body as {
    accessMode?: string;
    allowedMemberIds?: string[];
    allowedGroupIds?: string[];
    cascade?: boolean;
  };

  // Validate accessMode
  if (accessMode !== undefined && !['restricted', 'flexible'].includes(accessMode)) {
    return NextResponse.json(
      { error: 'accessMode must be "restricted" or "flexible"' },
      { status: 400 },
    );
  }

  // Validate member IDs belong to this org
  if (allowedMemberIds && allowedMemberIds.length > 0) {
    const validCount = await OrgMembership.countDocuments({
      _id: { $in: allowedMemberIds },
      orgId,
      status: { $in: ['active', 'pending'] },
    });
    if (validCount !== allowedMemberIds.length) {
      return NextResponse.json(
        { error: 'One or more member IDs are invalid or not in this organization' },
        { status: 400 },
      );
    }
  }

  // Validate group IDs belong to this org
  if (allowedGroupIds && allowedGroupIds.length > 0) {
    const validCount = await MemberGroup.countDocuments({
      _id: { $in: allowedGroupIds },
      orgId,
    });
    if (validCount !== allowedGroupIds.length) {
      return NextResponse.json(
        { error: 'One or more group IDs are invalid or not in this organization' },
        { status: 400 },
      );
    }
  }

  const updated = await updateFolderAccess(id, orgId, {
    accessMode: accessMode as 'restricted' | 'flexible' | undefined,
    allowedMemberIds,
    allowedGroupIds,
  });

  if (!updated) {
    return NextResponse.json({ error: 'Folder not found or no changes' }, { status: 404 });
  }

  // Cascade to children if requested
  let cascadedCount = 0;
  if (cascade && updated) {
    cascadedCount = await propagateAccessMode(
      orgId,
      updated as unknown as Parameters<typeof propagateAccessMode>[1],
      true,
    );
  }

  return NextResponse.json({
    folder: {
      _id: String(updated._id),
      name: updated.name,
      accessMode: updated.accessMode,
      accessModeInherited: updated.accessModeInherited,
      allowedMemberIds: (updated.allowedMemberIds ?? []).map(String),
      allowedGroupIds: (updated.allowedGroupIds ?? []).map(String),
    },
    cascadedFolders: cascadedCount,
  });
}
