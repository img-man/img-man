// SPDX-License-Identifier: Apache-2.0
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { connectToDatabase } from '@/lib/db';
import { SmartAlbum, Asset, User } from '@/models';
import { rulesToMongoFilter } from '@/lib/smart-album-engine';

/**
 * GET /api/smart-albums/[albumId]
 * Returns the smart album details + matching assets.
 * Query: ?page=1&limit=40
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ albumId: string }> },
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

  const { albumId } = await params;
  const album = await SmartAlbum.findOne({
    _id: albumId,
    orgId: user.orgId,
  }).lean();
  if (!album) {
    return NextResponse.json(
      { error: 'Smart album not found' },
      { status: 404 },
    );
  }

  const url = req.nextUrl;
  const page = Math.max(1, Number(url.searchParams.get('page') || '1'));
  const limit = Math.min(
    100,
    Math.max(1, Number(url.searchParams.get('limit') || '40')),
  );
  const skip = (page - 1) * limit;

  const orgIdStr = (user.orgId as unknown as string).toString();
  const filter = rulesToMongoFilter(orgIdStr, album.rules);

  const [assets, total] = await Promise.all([
    Asset.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select(
        'name originalName thumbnailBase64 mimeType sizeBytes width height createdAt fileCategory isStarred',
      )
      .lean(),
    Asset.countDocuments(filter),
  ]);

  return NextResponse.json({
    album: {
      ...album,
      _id: (album._id as unknown as string).toString(),
    },
    assets: assets.map((a) => ({
      ...a,
      _id: (a._id as unknown as string).toString(),
    })),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
}

/**
 * PATCH /api/smart-albums/[albumId]
 * Update album name, description, icon, or rules.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ albumId: string }> },
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

  const { albumId } = await params;
  const body = await req.json();
  const allowed = ['name', 'description', 'icon', 'rules'];
  const updates: Record<string, unknown> = {};

  for (const key of allowed) {
    if (body[key] !== undefined) {
      updates[key] = body[key];
    }
  }

  if (updates.rules && !(updates.rules as unknown[]).length) {
    return NextResponse.json(
      { error: 'At least one rule required' },
      { status: 400 },
    );
  }

  const album = await SmartAlbum.findOneAndUpdate(
    { _id: albumId, orgId: user.orgId },
    { $set: updates },
    { new: true },
  ).lean();

  if (!album) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({ album });
}

/**
 * DELETE /api/smart-albums/[albumId]
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ albumId: string }> },
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

  const { albumId } = await params;
  const deleted = await SmartAlbum.findOneAndDelete({
    _id: albumId,
    orgId: user.orgId,
  });

  if (!deleted) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
