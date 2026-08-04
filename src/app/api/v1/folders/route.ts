// SPDX-License-Identifier: Apache-2.0
/**
 * GET /api/v1/folders — List folders
 * POST /api/v1/folders — Create folder
 *
 * Auth: API Key (read for GET, write for POST)
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import {
  authenticateApiRequest,
  isErrorResponse,
  addCorsHeaders,
  applyFolderScope,
} from '@/lib/api-auth';
import { Folder, Organization } from '@/models';
import { resolveNewFolderAccessMode } from '@/lib/folder-access';

export async function OPTIONS(req: NextRequest) {
  const res = new NextResponse(null, { status: 204 });
  return addCorsHeaders(res, req.headers.get('origin'), []);
}

export async function GET(req: NextRequest) {
  const auth = await authenticateApiRequest(req, 'read');
  if (isErrorResponse(auth)) return auth;

  await connectToDatabase();

  const parentId = req.nextUrl.searchParams.get('parentId');
  const accessModeFilter = req.nextUrl.searchParams.get('accessMode');

  const filter: Record<string, unknown> = { orgId: auth.orgId };
  // If parentId is explicitly passed, filter by it; otherwise return all folders
  if (parentId !== null) {
    filter.parentId = parentId || null;
  }

  // Optional access mode filter
  if (
    accessModeFilter &&
    ['restricted', 'flexible'].includes(accessModeFilter)
  ) {
    filter.accessMode = accessModeFilter;
  }

  // Enforce API key folder scope
  const scopeError = await applyFolderScope(auth, filter, 'folder');
  if (scopeError) return scopeError;

  const folders = await Folder.find(filter).sort({ name: 1 }).lean();

  const res = NextResponse.json({
    folders: folders.map((f) => ({
      _id: String(f._id),
      name: f.name,
      parentId: f.parentId ? String(f.parentId) : null,
      path: f.path,
      accessMode: (f as Record<string, unknown>).accessMode ?? 'flexible',
      accessModeInherited:
        (f as Record<string, unknown>).accessModeInherited ?? false,
      allowedMemberIds: (
        ((f as Record<string, unknown>).allowedMemberIds as string[]) ?? []
      ).map(String),
      allowedGroupIds: (
        ((f as Record<string, unknown>).allowedGroupIds as string[]) ?? []
      ).map(String),
      createdAt: f.createdAt,
    })),
  });
  return addCorsHeaders(res, req.headers.get('origin'), auth.allowedDomains);
}

export async function POST(req: NextRequest) {
  const auth = await authenticateApiRequest(req, 'write');
  if (isErrorResponse(auth)) return auth;

  await connectToDatabase();

  const body = await req.json();
  const { name, parentId, accessMode, allowedMemberIds, allowedGroupIds } =
    body;

  if (!name || typeof name !== 'string' || !name.trim()) {
    return NextResponse.json(
      { error: 'name is required', code: 'VALIDATION_ERROR' },
      { status: 400 },
    );
  }

  // Build path
  let path = `/${name.trim()}`;
  if (parentId) {
    const parent = await Folder.findOne({
      _id: parentId,
      orgId: auth.orgId,
    }).lean();
    if (!parent) {
      return NextResponse.json(
        { error: 'Parent folder not found', code: 'NOT_FOUND' },
        { status: 404 },
      );
    }
    path = `${parent.path}/${name.trim()}`;
  }

  // Enforce folder scope: new folder must be within scope
  if (auth.folderScope) {
    const scopedFolder = await Folder.findOne({
      _id: auth.folderScope,
      orgId: auth.orgId,
    }).lean();
    if (scopedFolder) {
      // If no parentId, the folder must be under the scoped folder
      if (!parentId) {
        // Auto-parent under scoped folder
        path = `${scopedFolder.path}/${name.trim()}`;
      } else if (!path.startsWith(scopedFolder.path)) {
        return NextResponse.json(
          {
            error: 'Cannot create folder outside API key scope',
            code: 'SCOPE_ERROR',
          },
          { status: 403 },
        );
      }
    }
  }

  const effectiveParentId =
    !parentId && auth.folderScope ? auth.folderScope : parentId || null;

  // Resolve createdById: use auth user if available, otherwise org owner
  let createdById: string | null = auth.userId ?? null;
  if (!createdById) {
    const org = await Organization.findById(auth.orgId).lean();
    createdById = org?.ownerId?.toString() ?? null;
  }
  if (!createdById) {
    return NextResponse.json(
      {
        error: 'Unable to resolve folder owner',
        code: 'MISSING_OWNER',
      },
      { status: 400 },
    );
  }

  // Resolve access mode: explicit > inherit from parent > org default
  const resolved = await resolveNewFolderAccessMode(
    auth.orgId,
    effectiveParentId,
  );
  const finalMode =
    accessMode === 'restricted' || accessMode === 'flexible'
      ? accessMode
      : resolved.accessMode;
  const inherited = !accessMode && resolved.inherited;
  const finalMemberIds =
    allowedMemberIds ?? (inherited ? resolved.parentAllowedMemberIds : []);
  const finalGroupIds =
    allowedGroupIds ?? (inherited ? resolved.parentAllowedGroupIds : []);

  const folder = await Folder.create({
    orgId: auth.orgId,
    name: name.trim(),
    parentId: effectiveParentId,
    path,
    createdById,
    accessMode: finalMode,
    accessModeInherited: inherited,
    allowedMemberIds: finalMemberIds,
    allowedGroupIds: finalGroupIds,
  });

  const res = NextResponse.json(
    {
      folder: {
        _id: String(folder._id),
        name: folder.name,
        parentId: folder.parentId ? String(folder.parentId) : null,
        path: folder.path,
        accessMode: finalMode,
        accessModeInherited: inherited,
        allowedMemberIds: finalMemberIds.map(String),
        allowedGroupIds: finalGroupIds.map(String),
        createdAt: folder.createdAt,
      },
    },
    { status: 201 },
  );
  return addCorsHeaders(res, req.headers.get('origin'), auth.allowedDomains);
}
