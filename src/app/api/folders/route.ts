// SPDX-License-Identifier: Apache-2.0
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { connectToDatabase } from '@/lib/db';
import { Folder, User, OrgMembership } from '@/models';
import type { IFolder } from '@/models';
import type { Role } from '@/lib/permissions';
import {
  filterAccessibleFolders,
  getUserGroupIds,
  getMembershipId,
  resolveNewFolderAccessMode,
} from '@/lib/folder-access';

// GET /api/folders?parentId= (omit parentId to get ALL folders for tree view)
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sessionUser = session.user as Record<string, unknown>;
  const sessionOrgId =
    typeof sessionUser.orgId === 'string' && sessionUser.orgId.trim()
      ? sessionUser.orgId
      : null;
  const sessionRole =
    typeof sessionUser.role === 'string' && sessionUser.role.trim()
      ? (sessionUser.role as Role)
      : 'viewer';

  await connectToDatabase();
  const user = await User.findOne({ email: session.user.email }).lean();
  const effectiveOrgId = user?.orgId
    ? String(user.orgId)
    : sessionOrgId;
  if (!effectiveOrgId) {
    return NextResponse.json({ error: 'No organization' }, { status: 400 });
  }

  const orgId = effectiveOrgId;
  const parentIdParam = req.nextUrl.searchParams.get('parentId');

  // If parentId is explicitly passed, filter by it; otherwise return all folders
  const filter: Record<string, unknown> = { orgId };
  if (parentIdParam !== null) {
    filter.parentId = parentIdParam || null;
  }

  const allFolders = await Folder.find(filter).sort({ name: 1 }).lean();

  // Apply folder access filtering
  const role = ((user?.role as Role) ?? sessionRole) as Role;
  const membershipId = await getMembershipId(orgId, session.user.email);
  const userGroupIds = membershipId
    ? await getUserGroupIds(orgId, membershipId)
    : [];

  const folders = filterAccessibleFolders(
    allFolders as unknown as Pick<
      IFolder,
      'accessMode' | 'allowedMemberIds' | 'allowedGroupIds'
    >[],
    role,
    membershipId,
    userGroupIds,
  );

  return NextResponse.json({ folders });
}

// POST /api/folders body: { name, parentId?, accessMode?, allowedMemberIds?, allowedGroupIds? }
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sessionUser = session.user as Record<string, unknown>;
  const sessionOrgId =
    typeof sessionUser.orgId === 'string' && sessionUser.orgId.trim()
      ? sessionUser.orgId
      : null;

  await connectToDatabase();
  const user = await User.findOne({ email: session.user.email }).lean();
  const effectiveOrgId = user?.orgId
    ? String(user.orgId)
    : sessionOrgId;
  if (!effectiveOrgId) {
    return NextResponse.json({ error: 'No organization' }, { status: 400 });
  }

  const orgId = effectiveOrgId;
  const { name, parentId, accessMode, allowedMemberIds, allowedGroupIds } =
    await req.json();
  if (!name?.trim()) {
    return NextResponse.json(
      { error: 'Folder name is required' },
      { status: 400 },
    );
  }

  let parentPath = '/';
  if (parentId) {
    const parent = await Folder.findById(parentId).lean();
    if (parent) parentPath = `${parent.path}${parent.name}/`;
  }

  // Resolve access mode: explicit > inherit from parent > org default
  const resolved = await resolveNewFolderAccessMode(orgId, parentId);
  const finalMode =
    accessMode === 'restricted' || accessMode === 'flexible'
      ? accessMode
      : resolved.accessMode;
  const inherited = !accessMode && resolved.inherited;

  // If inheriting a restricted parent, also inherit the access lists
  const finalMemberIds =
    allowedMemberIds ?? (inherited ? resolved.parentAllowedMemberIds : []);
  const finalGroupIds =
    allowedGroupIds ?? (inherited ? resolved.parentAllowedGroupIds : []);

  const folder = await Folder.create({
    name: name.trim(),
    orgId,
    parentId: parentId || null,
    path: parentPath,
    createdById: user?._id,
    accessMode: finalMode,
    accessModeInherited: inherited,
    allowedMemberIds: finalMemberIds,
    allowedGroupIds: finalGroupIds,
  });

  return NextResponse.json({ folder }, { status: 201 });
}
