// SPDX-License-Identifier: Apache-2.0
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { connectToDatabase } from '@/lib/db';
import { Asset, User } from '@/models';

/**
 * GET /api/assets/[id]/edits
 * Returns the edit history for an asset.
 * Each entry includes adjustments, crop, annotations, timestamp, mode.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await connectToDatabase();
  const user = await User.findOne({ email: session.user.email }).lean();
  if (!user?.orgId) {
    return NextResponse.json({ error: 'No organization' }, { status: 400 });
  }

  const { id: assetId } = await params;

  const asset = await Asset.findOne({ _id: assetId, orgId: user.orgId })
    .select('edits originalStorageKey name originalName')
    .populate('edits.userId', 'name email')
    .lean();

  if (!asset) {
    return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
  }

  // Sort edits newest first
  const edits = (asset.edits || [])
    .map((edit: Record<string, unknown>, index: number) => ({
      index,
      adjustments: edit.adjustments || {},
      cropSettings: edit.cropSettings || null,
      annotationCount: Array.isArray(edit.annotations)
        ? edit.annotations.length
        : 0,
      timestamp: edit.timestamp,
      user: edit.userId || null,
      mode: edit.mode || 'copy',
    }))
    .reverse();

  return NextResponse.json({
    assetId,
    name: asset.name || asset.originalName,
    hasOriginal: !!asset.originalStorageKey,
    editCount: edits.length,
    edits,
  });
}
