// SPDX-License-Identifier: Apache-2.0
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { OrgMembership, User } from '@/models';
import { requireAuthContext } from '@/lib/auth-context';
import { canChangeRole, canRemoveMember, type Role } from '@/lib/permissions';

interface RouteContext {
  params: Promise<{ memberId: string }>;
}

/**
 * PATCH /api/team/[memberId]
 * Body: { role: 'admin' | 'editor' | 'viewer' }
 * Change a member's role (within hierarchy limits).
 */
export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const ctx = await requireAuthContext();
    const { memberId } = await context.params;
    const body = await req.json();
    const { role: newRole, folderAccess, accessRules, sectionAccess } = body as {
      role?: string;
      folderAccess?: string[];
      accessRules?: { path: string; role: string; resourceType: string }[];
      sectionAccess?: Record<string, number>;
    };

    await connectToDatabase();

    const membership = await OrgMembership.findOne({
      _id: memberId,
      orgId: ctx.orgId,
    }).lean();

    if (!membership) {
      return NextResponse.json(
        { error: 'Member not found' },
        { status: 404 },
      );
    }

    // ── Handle access rules update ──────────────────────────────
    if (accessRules !== undefined) {
      if (!Array.isArray(accessRules)) {
        return NextResponse.json(
          { error: 'accessRules must be an array' },
          { status: 400 },
        );
      }

      const validRoles = ['owner', 'admin', 'editor', 'viewer'];
      const validTypes = ['folder', 'asset'];
      for (const rule of accessRules) {
        if (!rule.path || !validRoles.includes(rule.role) || !validTypes.includes(rule.resourceType)) {
          return NextResponse.json(
            { error: 'Each access rule must have a valid path, role (owner|admin|editor|viewer), and resourceType (folder|asset)' },
            { status: 400 },
          );
        }
      }

      // Only owner/admin can manage access rules
      if (!['owner', 'admin'].includes(ctx.role)) {
        return NextResponse.json(
          { error: 'Only owners and admins can manage access rules' },
          { status: 403 },
        );
      }

      await OrgMembership.findByIdAndUpdate(memberId, { accessRules });

      // If no role change requested, return early
      if (!newRole && folderAccess === undefined && sectionAccess === undefined) {
        return NextResponse.json({ success: true, memberId, accessRules });
      }
    }

    // ── Handle section access update ────────────────────────
    if (sectionAccess !== undefined) {
      // Only owner/admin can manage section access
      if (!['owner', 'admin'].includes(ctx.role)) {
        return NextResponse.json(
          { error: 'Only owners and admins can manage section access' },
          { status: 403 },
        );
      }

      await OrgMembership.findByIdAndUpdate(memberId, { sectionAccess });

      if (!newRole && folderAccess === undefined) {
        return NextResponse.json({ success: true, memberId, sectionAccess });
      }
    }

    // ── Handle legacy folderAccess update ───────────────────────
    if (folderAccess !== undefined) {
      if (!Array.isArray(folderAccess)) {
        return NextResponse.json(
          { error: 'folderAccess must be an array of folder IDs' },
          { status: 400 },
        );
      }

      if (!['owner', 'admin'].includes(ctx.role)) {
        return NextResponse.json(
          { error: 'Only owners and admins can manage folder access' },
          { status: 403 },
        );
      }

      await OrgMembership.findByIdAndUpdate(memberId, { folderAccess });

      if (!newRole) {
        return NextResponse.json({ success: true, memberId, folderAccess });
      }
    }

    // ── Handle role change ──────────────────────────────────────
    if (!newRole || !['admin', 'editor', 'viewer'].includes(newRole)) {
      return NextResponse.json(
        { error: 'Invalid role. Must be admin, editor, or viewer.' },
        { status: 400 },
      );
    }

    // Can't change your own role
    if (membership.email === ctx.email.toLowerCase()) {
      return NextResponse.json(
        { error: 'You cannot change your own role' },
        { status: 400 },
      );
    }

    // Hierarchy check
    if (
      !canChangeRole(ctx.role, membership.role as Role, newRole as Role)
    ) {
      return NextResponse.json(
        { error: 'Insufficient permissions to change this role' },
        { status: 403 },
      );
    }

    // Update membership role
    await OrgMembership.findByIdAndUpdate(memberId, { role: newRole });

    // Also update User.role if they're an active user
    if (membership.userId) {
      await User.findByIdAndUpdate(membership.userId, { role: newRole });
    }

    return NextResponse.json({
      success: true,
      memberId,
      newRole,
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
 * DELETE /api/team/[memberId]
 * Remove a member or revoke a pending invite.
 */
export async function DELETE(_req: NextRequest, context: RouteContext) {
  try {
    const ctx = await requireAuthContext();
    const { memberId } = await context.params;

    await connectToDatabase();

    const membership = await OrgMembership.findOne({
      _id: memberId,
      orgId: ctx.orgId,
    }).lean();

    if (!membership) {
      return NextResponse.json(
        { error: 'Member not found' },
        { status: 404 },
      );
    }

    // Can't remove yourself
    if (membership.email === ctx.email.toLowerCase()) {
      return NextResponse.json(
        { error: 'You cannot remove yourself from the organization' },
        { status: 400 },
      );
    }

    // Hierarchy check
    if (!canRemoveMember(ctx.role, membership.role as Role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions to remove this member' },
        { status: 403 },
      );
    }

    // Revoke the membership (soft-delete via status change)
    await OrgMembership.findByIdAndUpdate(memberId, { status: 'revoked' });

    // If active user, clear their orgId so they lose access
    if (membership.userId && membership.status === 'active') {
      await User.findByIdAndUpdate(membership.userId, {
        $unset: { orgId: 1 },
        role: 'viewer', // Reset role to viewer on removal
      });
    }

    return NextResponse.json({ success: true, memberId });
  } catch (err: unknown) {
    const e = err as { status?: number; error?: string; message?: string };
    return NextResponse.json(
      { error: e.error ?? e.message ?? 'Server error' },
      { status: e.status ?? 500 },
    );
  }
}
