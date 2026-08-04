// SPDX-License-Identifier: Apache-2.0
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { connectToDatabase } from '@/lib/db';
import { Asset, User } from '@/models';

/**
 * GET /api/assets/map
 * Returns assets with GPS coordinates for map display.
 * Query params:
 *   - limit (default 500, max 2000)
 *   - sw_lat, sw_lng, ne_lat, ne_lng (bounding box filter)
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

  const url = req.nextUrl;
  const limit = Math.min(Number(url.searchParams.get('limit') || '500'), 2000);

  // Build filter: must have GPS coordinates
  const filter: Record<string, unknown> = {
    orgId: user.orgId,
    'exif.gps': { $exists: true },
  };

  // Optional bounding box filter
  const swLat = url.searchParams.get('sw_lat');
  const swLng = url.searchParams.get('sw_lng');
  const neLat = url.searchParams.get('ne_lat');
  const neLng = url.searchParams.get('ne_lng');

  if (swLat && swLng && neLat && neLng) {
    filter['exif.gps.latitude'] = {
      $gte: Number(swLat),
      $lte: Number(neLat),
    };
    filter['exif.gps.longitude'] = {
      $gte: Number(swLng),
      $lte: Number(neLng),
    };
  }

  const assets = await Asset.find(filter)
    .select(
      'name originalName thumbnailBase64 exif.gps exif.camera exif.dateTime width height mimeType createdAt',
    )
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  // Shape response for map markers
  const markers = assets.map((a) => ({
    id: (a._id as unknown as string).toString(),
    name: a.name || a.originalName,
    lat: a.exif?.gps?.latitude,
    lng: a.exif?.gps?.longitude,
    thumbnail: a.thumbnailBase64 || null,
    camera: a.exif?.camera || null,
    dateTime: a.exif?.dateTime || a.createdAt,
    width: a.width,
    height: a.height,
  }));

  return NextResponse.json({
    markers,
    total: markers.length,
    hasMore: markers.length === limit,
  });
}
