// SPDX-License-Identifier: Apache-2.0
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { OrgMembership } from '@/models';
import { requireAuthContext } from '@/lib/auth-context';

interface RouteContext {
  params: Promise<{ memberId: string }>;
}

/**
 * POST /api/team/[memberId]/access-rules
 * Add a new access rule for a team member
 * Body: { path: string, role: string, resourceType: 'folder' | 'asset' }
 */
export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const ctx = await requireAuthContext();
    const { memberId } = await context.params;
    const body = await req.json();
    const { path, role, resourceType } = body as {
      path: string;
      role: string;
      resourceType: 'folder' | 'asset';
    };

    // Only owner/admin can manage access rules
    if (!['owner', 'admin'].includes(ctx.role)) {
      return NextResponse.json(
        { error: 'Only owners and admins can manage access rules' },
        { status: 403 },
      );
    }

    // Validate input
    const validRoles = ['owner', 'admin', 'editor', 'viewer'];
    const validTypes = ['folder', 'asset'];
    if (!path || !validRoles.includes(role) || !validTypes.includes(resourceType)) {
      return NextResponse.json(
        {
          error: 'Invalid input. path, role (owner|admin|editor|viewer), and resourceType (folder|asset) are required',
        },
        { status: 400 },
      );
    }

    await connectToDatabase();

    const membership = await OrgMembership.findOne({
      _id: memberId,
      orgId: ctx.orgId,
    });

    if (!membership) {
      return NextResponse.json(
        { error: 'Member not found' },
        { status: 404 },
      );
    }

    // Add the new rule
    const accessRules = membership.accessRules || [];
    accessRules.push({ path, role, resourceType } as never);

    await OrgMembership.findByIdAndUpdate(memberId, { accessRules });

    return NextResponse.json({
      success: true,
      memberId,
      accessRules,
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
 * DELETE /api/team/[memberId]/access-rules
 * Remove an access rule from a team member
 * Body: { path: string, resourceType?: string }
 */
export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const ctx = await requireAuthContext();
    const { memberId } = await context.params;
    const body = await req.json();
    const { path, resourceType } = body as {
      path: string;
      resourceType?: 'folder' | 'asset';
    };

    // Only owner/admin can manage access rules
    if (!['owner', 'admin'].includes(ctx.role)) {
      return NextResponse.json(
        { error: 'Only owners and admins can manage access rules' },
        { status: 403 },
      );
    }

    if (!path) {
      return NextResponse.json(
        { error: 'path is required' },
        { status: 400 },
      );
    }

    await connectToDatabase();

    const membership = await OrgMembership.findOne({
      _id: memberId,
      orgId: ctx.orgId,
    });

    if (!membership) {
      return NextResponse.json(
        { error: 'Member not found' },
        { status: 404 },
      );
    }

    // Remove the rule(s) matching the path (and optionally resourceType)
    const accessRules = (membership.accessRules || []).filter((rule: { path: string, resourceType: string }) => {
      if (resourceType) {
        return rule.path !== path || rule.resourceType !== resourceType;
      }
      return rule.path !== path;
    });

    await OrgMembership.findByIdAndUpdate(memberId, { accessRules });

    return NextResponse.json({
      success: true,
      memberId,
      accessRules,
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
 * PUT /api/team/[memberId]/access-rules
 * Update an existing access rule
 * Body: { oldPath: string, oldResourceType?: string, newPath: string, newRole: string, newResourceType: string }
 */
export async function PUT(req: NextRequest, context: RouteContext) {
  try {
    const ctx = await requireAuthContext();
    const { memberId } = await context.params;
    const body = await req.json();
    const { oldPath, oldResourceType, newPath, newRole, newResourceType } = body as {
      oldPath: string;
      oldResourceType?: 'folder' | 'asset';
      newPath: string;
      newRole: string;
      newResourceType: 'folder' | 'asset';
    };

    // Only owner/admin can manage access rules
    if (!['owner', 'admin'].includes(ctx.role)) {
      return NextResponse.json(
        { error: 'Only owners and admins can manage access rules' },
        { status: 403 },
      );
    }

    // Validate input
    const validRoles = ['owner', 'admin', 'editor', 'viewer'];
    const validTypes = ['folder', 'asset'];
    if (!oldPath || !newPath || !validRoles.includes(newRole) || !validTypes.includes(newResourceType)) {
      return NextResponse.json(
        {
          error: 'Invalid input. oldPath, newPath, newRole (owner|admin|editor|viewer), and newResourceType (folder|asset) are required',
        },
        { status: 400 },
      );
    }

    await connectToDatabase();

    const membership = await OrgMembership.findOne({
      _id: memberId,
      orgId: ctx.orgId,
    });

    if (!membership) {
      return NextResponse.json(
        { error: 'Member not found' },
        { status: 404 },
      );
    }

    // Update the matching rule
    const accessRules = (membership.accessRules || []).map((rule: { path: string, role: string, resourceType: string }) => {
      if (oldResourceType) {
        if (rule.path === oldPath && rule.resourceType === oldResourceType) {
          return { path: newPath, role: newRole, resourceType: newResourceType };
        }
      } else if (rule.path === oldPath) {
        return { path: newPath, role: newRole, resourceType: newResourceType };
      }
      return rule;
    });

    await OrgMembership.findByIdAndUpdate(memberId, { accessRules });

    return NextResponse.json({
      success: true,
      memberId,
      accessRules,
    });
  } catch (err: unknown) {
    const e = err as { status?: number; error?: string; message?: string };
    return NextResponse.json(
      { error: e.error ?? e.message ?? 'Server error' },
      { status: e.status ?? 500 },
    );
  }
}
