// SPDX-License-Identifier: Apache-2.0
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { connectToDatabase } from '@/lib/db';
import { SmartAlbum, Asset, User } from '@/models';
import {
  rulesToMongoFilter,
  PRESET_SMART_ALBUMS,
} from '@/lib/smart-album-engine';

/**
 * GET /api/smart-albums
 * Returns all smart albums for the org, with live asset counts.
 * Query: ?includePresets=true  — auto-creates presets if none exist
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await connectToDatabase();
  const user = await User.findOne({ email: session.user.email }).lean();
  if (!user?.orgId) {
    return NextResponse.json({ error: 'No organization' }, { status: 400 });
  }

  const orgId = user.orgId;
  const includePresets =
    req.nextUrl.searchParams.get('includePresets') === 'true';

  // Auto-seed preset smart albums if requested and none exist
  if (includePresets) {
    const presetCount = await SmartAlbum.countDocuments({
      orgId,
      isPreset: true,
    });
    if (presetCount === 0) {
      await SmartAlbum.insertMany(
        PRESET_SMART_ALBUMS.map((p) => ({
          ...p,
          orgId,
          isPreset: true,
          createdBy: user._id,
        })),
      );
    }
  }

  const albums = await SmartAlbum.find({ orgId })
    .sort({ isPreset: -1, name: 1 })
    .lean();

  // Live count for each album (parallel)
  const albumsWithCounts = await Promise.all(
    albums.map(async (album) => {
      const filter = rulesToMongoFilter(
        (orgId as unknown as string).toString(),
        album.rules,
      );
      const count = await Asset.countDocuments(filter);

      // Update cached count lazily
      if (count !== album.cachedCount) {
        void SmartAlbum.updateOne(
          { _id: album._id },
          { $set: { cachedCount: count, cachedAt: new Date() } },
        );
      }

      return {
        ...album,
        _id: (album._id as unknown as string).toString(),
        cachedCount: count,
      };
    }),
  );

  return NextResponse.json({ albums: albumsWithCounts });
}

/**
 * POST /api/smart-albums
 * Create a new smart album.
 * Body: { name, description?, icon?, rules: [{ field, operator, value }] }
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await connectToDatabase();
  const user = await User.findOne({ email: session.user.email }).lean();
  if (!user?.orgId) {
    return NextResponse.json({ error: 'No organization' }, { status: 400 });
  }

  const body = await req.json();
  const { name, description, icon, rules } = body;

  if (!name || !rules?.length) {
    return NextResponse.json(
      { error: 'name and at least one rule are required' },
      { status: 400 },
    );
  }

  const album = await SmartAlbum.create({
    orgId: user.orgId,
    name,
    description: description || '',
    icon: icon || '📁',
    rules,
    createdBy: user._id,
  });

  return NextResponse.json({ album }, { status: 201 });
}
