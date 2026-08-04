// SPDX-License-Identifier: Apache-2.0
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { connectToDatabase } from '@/lib/db';
import { User, Folder } from '@/models';
import { isSectionRestricted } from '@/lib/auth-context';
import type { Role } from '@/lib/permissions';

/**
 * GET /api/settings/gallery
 * Returns all folders for the org with their galleryMode & galleryEmbed flags.
 */
export async function GET() {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await connectToDatabase();
  const user = await User.findOne({ email: session.user.email }).lean();
  if (!user?.orgId) {
    return NextResponse.json({ error: 'No organization' }, { status: 400 });
  }

  if (await isSectionRestricted(String(user.orgId), (user.role as Role) ?? 'viewer', 'settings')) {
    return NextResponse.json({ error: 'Access restricted' }, { status: 403 });
  }

  const folders = await Folder.find({ orgId: user.orgId })
    .select('_id name parentId path galleryMode galleryEmbed')
    .sort({ path: 1, name: 1 })
    .lean();

  return NextResponse.json({ folders });
}

/**
 * PATCH /api/settings/gallery
 * Body: { folderId: string, galleryMode?: boolean, galleryEmbed?: boolean }
 * Toggles gallery mode flags on a specific folder.
 */
export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await connectToDatabase();
  const user = await User.findOne({ email: session.user.email }).lean();
  if (!user?.orgId) {
    return NextResponse.json({ error: 'No organization' }, { status: 400 });
  }

  if (await isSectionRestricted(String(user.orgId), (user.role as Role) ?? 'viewer', 'settings')) {
    return NextResponse.json({ error: 'Access restricted' }, { status: 403 });
  }

  if (!['owner', 'admin'].includes(user.role ?? '')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const body = await req.json();
  const { folderId, galleryMode, galleryEmbed } = body;

  if (!folderId || typeof folderId !== 'string') {
    return NextResponse.json({ error: 'folderId is required' }, { status: 400 });
  }

  // Ensure folder belongs to the org
  const folder = await Folder.findOne({ _id: folderId, orgId: user.orgId });
  if (!folder) {
    return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
  }

  const update: Record<string, boolean> = {};
  if (typeof galleryMode === 'boolean') update.galleryMode = galleryMode;
  if (typeof galleryEmbed === 'boolean') update.galleryEmbed = galleryEmbed;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  const updated = await Folder.findByIdAndUpdate(
    folderId,
    { $set: update },
    { new: true },
  )
    .select('_id name parentId path galleryMode galleryEmbed')
    .lean();

  return NextResponse.json({ folder: updated });
}
