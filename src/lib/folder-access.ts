// SPDX-License-Identifier: Apache-2.0
/**
 * Folder Access Control Library
 *
 * Handles the two folder access modes:
 * - **Flexible**: Visible to all logged-in org members (default).
 * - **Restricted**: Only visible to explicitly allowed members/groups.
 *
 * Rules:
 * 1. Owner/Admin always has access to all folders regardless of mode.
 * 2. Child folders inherit access mode from parent at creation time.
 * 3. In restricted mode, access is granted via allowedMemberIds or allowedGroupIds.
 * 4. Group membership is resolved transitively — if a user belongs to a group
 *    that is allowed, the user has access.
 */

import type { Types } from 'mongoose';
import { Folder, OrgMembership, MemberGroup, Organization } from '@/models';
import type { IFolder } from '@/models';
import { connectToDatabase } from './db';
import type { Role } from './permissions';
import { ROLE_LEVEL } from './permissions';

/* ─── Types ──────────────────────────────────────────────────── */

export type FolderAccessMode = 'restricted' | 'flexible';

export interface FolderAccessResult {
  hasAccess: boolean;
  reason: 'owner_admin' | 'flexible' | 'member_allowed' | 'group_allowed' | 'denied';
}

/* ─── Unified Access Resolution ──────────────────────────────── */

export interface AccessSource {
  type: 'direct' | 'group';
  role: Role;
  path: string;
  resourceType: string;
  groupId?: string;
  groupName?: string;
}

export interface UnifiedAccessEntry {
  path: string;
  resourceType: string;
  effectiveRole: Role;
  sources: AccessSource[];
}

/**
 * Resolve unified access for a user across direct rules and group-based rules.
 * When multiple sources grant access to the same path+resourceType, the most
 * powerful role (highest ROLE_LEVEL) wins.
 *
 * @param directRules  The user's direct accessRules from their OrgMembership
 * @param groupRules   Array of { groupId, groupName, accessRules } from the user's groups
 * @returns Array of unified access entries, each with the effective role and all sources
 */
export function resolveUnifiedAccess(
  directRules: { path: string; role: string; resourceType: string }[],
  groupRules: { groupId: string; groupName: string; accessRules: { path: string; role: string; resourceType: string }[] }[],
): UnifiedAccessEntry[] {
  // Build a map keyed by "path|resourceType"
  const entryMap = new Map<string, { path: string; resourceType: string; sources: AccessSource[] }>();

  const addSource = (path: string, resourceType: string, source: AccessSource) => {
    const key = `${path}|${resourceType}`;
    if (!entryMap.has(key)) {
      entryMap.set(key, { path, resourceType, sources: [] });
    }
    entryMap.get(key)!.sources.push(source);
  };

  // Direct rules
  for (const rule of directRules) {
    addSource(rule.path, rule.resourceType, {
      type: 'direct',
      role: rule.role as Role,
      path: rule.path,
      resourceType: rule.resourceType,
    });
  }

  // Group rules
  for (const group of groupRules) {
    for (const rule of group.accessRules) {
      addSource(rule.path, rule.resourceType, {
        type: 'group',
        role: rule.role as Role,
        path: rule.path,
        resourceType: rule.resourceType,
        groupId: group.groupId,
        groupName: group.groupName,
      });
    }
  }

  // Resolve effective role for each entry (highest wins)
  const result: UnifiedAccessEntry[] = [];
  for (const entry of entryMap.values()) {
    let effectiveRole: Role = 'viewer';
    let maxLevel = 0;
    for (const s of entry.sources) {
      const level = ROLE_LEVEL[s.role] ?? 0;
      if (level > maxLevel) {
        maxLevel = level;
        effectiveRole = s.role;
      }
    }
    result.push({
      path: entry.path,
      resourceType: entry.resourceType,
      effectiveRole,
      sources: entry.sources,
    });
  }

  return result.sort((a, b) => a.path.localeCompare(b.path));
}

export interface FolderWithAccess extends Record<string, unknown> {
  _id: Types.ObjectId | string;
  name: string;
  orgId: Types.ObjectId | string;
  parentId?: Types.ObjectId | string | null;
  path: string;
  accessMode: FolderAccessMode;
  accessModeInherited: boolean;
  allowedMemberIds: (Types.ObjectId | string)[];
  allowedGroupIds: (Types.ObjectId | string)[];
  createdAt: Date;
  updatedAt: Date;
}

/* ─── Core Access Check ──────────────────────────────────────── */

/**
 * Check whether a user (identified by their membership and role) has access
 * to a specific folder.
 *
 * @param folder     The folder document (lean or hydrated)
 * @param role       The user's org-level role
 * @param membershipId The user's OrgMembership._id (string)
 * @param userGroupIds Array of MemberGroup._id strings the user belongs to
 */
export function checkFolderAccess(
  folder: Pick<IFolder, 'accessMode' | 'allowedMemberIds' | 'allowedGroupIds'>,
  role: Role,
  membershipId: string | null,
  userGroupIds: string[],
): FolderAccessResult {
  // Rule 1: Owner/Admin always has access
  if (ROLE_LEVEL[role] >= 3) {
    return { hasAccess: true, reason: 'owner_admin' };
  }

  // Rule 2: Flexible folders are visible to all org members
  if (folder.accessMode === 'flexible') {
    return { hasAccess: true, reason: 'flexible' };
  }

  // Rule 3: Restricted folder — check explicit member access
  if (membershipId) {
    const memberIds = (folder.allowedMemberIds ?? []).map((id) => String(id));
    if (memberIds.includes(membershipId)) {
      return { hasAccess: true, reason: 'member_allowed' };
    }
  }

  // Rule 4: Check group access
  if (userGroupIds.length > 0) {
    const groupIds = (folder.allowedGroupIds ?? []).map((id) => String(id));
    const hasGroupAccess = userGroupIds.some((gid) => groupIds.includes(gid));
    if (hasGroupAccess) {
      return { hasAccess: true, reason: 'group_allowed' };
    }
  }

  return { hasAccess: false, reason: 'denied' };
}

/* ─── Batch Folder Filtering ─────────────────────────────────── */

/**
 * Filter an array of folders to only those accessible by the given user.
 * Returns the accessible folder documents in the same order.
 */
export function filterAccessibleFolders<T extends Pick<IFolder, 'accessMode' | 'allowedMemberIds' | 'allowedGroupIds'>>(
  folders: T[],
  role: Role,
  membershipId: string | null,
  userGroupIds: string[],
): T[] {
  // Owner/Admin sees everything
  if (ROLE_LEVEL[role] >= 3) return folders;

  return folders.filter((f) => {
    const result = checkFolderAccess(f, role, membershipId, userGroupIds);
    return result.hasAccess;
  });
}

/* ─── Resolve User Group IDs ─────────────────────────────────── */

/**
 * Given a user's OrgMembership._id, resolve all MemberGroup IDs they belong to.
 */
export async function getUserGroupIds(
  orgId: string,
  membershipId: string,
): Promise<string[]> {
  await connectToDatabase();
  const groups = await MemberGroup.find({
    orgId,
    memberIds: membershipId,
  })
    .select('_id')
    .lean();
  return groups.map((g) => String(g._id));
}

/**
 * Get the user's OrgMembership._id from their email.
 * Returns null if no active membership is found.
 */
export async function getMembershipId(
  orgId: string,
  email: string,
): Promise<string | null> {
  await connectToDatabase();
  const membership = await OrgMembership.findOne({
    orgId,
    email,
    status: 'active',
  })
    .select('_id')
    .lean();
  return membership ? String(membership._id) : null;
}

/* ─── Resolve Access Mode for New Folders ────────────────────── */

/**
 * Determine the access mode for a new folder.
 * If parentId is provided, inherit from parent.
 * Otherwise, use the org's default.
 */
export async function resolveNewFolderAccessMode(
  orgId: string,
  parentId?: string | null,
): Promise<{ accessMode: FolderAccessMode; inherited: boolean; parentAllowedMemberIds: string[]; parentAllowedGroupIds: string[] }> {
  await connectToDatabase();

  if (parentId) {
    const parent = await Folder.findOne({ _id: parentId, orgId }).lean();
    if (parent) {
      return {
        accessMode: (parent as unknown as FolderWithAccess).accessMode ?? 'flexible',
        inherited: true,
        parentAllowedMemberIds: ((parent as unknown as FolderWithAccess).allowedMemberIds ?? []).map(String),
        parentAllowedGroupIds: ((parent as unknown as FolderWithAccess).allowedGroupIds ?? []).map(String),
      };
    }
  }

  // No parent — use org default
  const org = await Organization.findById(orgId).select('defaultFolderAccessMode').lean();
  const mode: FolderAccessMode = (org as unknown as { defaultFolderAccessMode?: string })?.defaultFolderAccessMode === 'restricted'
    ? 'restricted'
    : 'flexible';

  return {
    accessMode: mode,
    inherited: false,
    parentAllowedMemberIds: [],
    parentAllowedGroupIds: [],
  };
}

/* ─── Bulk Mode Conversion ───────────────────────────────────── */

/**
 * Convert all folders in an org to the specified access mode.
 * Returns the number of folders updated.
 */
export async function bulkSetFolderAccessMode(
  orgId: string,
  mode: FolderAccessMode,
): Promise<number> {
  await connectToDatabase();
  const result = await Folder.updateMany(
    { orgId },
    {
      $set: {
        accessMode: mode,
        accessModeInherited: false,
      },
    },
  );
  return result.modifiedCount;
}

/* ─── Update Access Lists ────────────────────────────────────── */

/**
 * Set the allowed members and/or groups for a restricted folder.
 * Pass null to leave a field unchanged.
 */
export async function updateFolderAccess(
  folderId: string,
  orgId: string,
  opts: {
    allowedMemberIds?: string[];
    allowedGroupIds?: string[];
    accessMode?: FolderAccessMode;
  },
): Promise<IFolder | null> {
  await connectToDatabase();

  const update: Record<string, unknown> = {};

  if (opts.accessMode !== undefined) {
    update.accessMode = opts.accessMode;
    update.accessModeInherited = false; // Override clears inheritance
  }

  if (opts.allowedMemberIds !== undefined) {
    update.allowedMemberIds = opts.allowedMemberIds;
  }

  if (opts.allowedGroupIds !== undefined) {
    update.allowedGroupIds = opts.allowedGroupIds;
  }

  if (Object.keys(update).length === 0) return null;

  return Folder.findOneAndUpdate(
    { _id: folderId, orgId },
    { $set: update },
    { new: true },
  ).lean();
}

/**
 * Propagate access mode change to all child folders (recursive).
 * When a parent's access mode is changed, optionally cascade to descendants.
 */
export async function propagateAccessMode(
  orgId: string,
  parentFolder: Pick<IFolder, '_id' | 'name' | 'path' | 'accessMode' | 'allowedMemberIds' | 'allowedGroupIds'>,
  cascadeAccess: boolean = false,
): Promise<number> {
  await connectToDatabase();
  const pathPrefix = `${parentFolder.path}${parentFolder.name}/`;

  const update: Record<string, unknown> = {
    accessMode: parentFolder.accessMode,
    accessModeInherited: true,
  };

  // Optionally cascade the access lists too
  if (cascadeAccess) {
    update.allowedMemberIds = parentFolder.allowedMemberIds ?? [];
    update.allowedGroupIds = parentFolder.allowedGroupIds ?? [];
  }

  const result = await Folder.updateMany(
    {
      orgId,
      path: { $regex: `^${pathPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}` },
    },
    { $set: update },
  );

  return result.modifiedCount;
}
