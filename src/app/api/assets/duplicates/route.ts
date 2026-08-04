// SPDX-License-Identifier: Apache-2.0
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { connectToDatabase } from '@/lib/db';
import { Asset, User } from '@/models';

/**
 * GET /api/assets/duplicates
 * Query: page?, limit?
 *
 * Find near-duplicate assets using perceptual hash matching.
 * Groups assets with identical perceptualHash values.
 * Returns groups of duplicates (2+ assets per group).
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

  const { searchParams } = req.nextUrl;
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const limit = Math.min(
    50,
    Math.max(1, Number(searchParams.get('limit')) || 20),
  );
  const skip = (page - 1) * limit;

  try {
    // Aggregation pipeline to find duplicate perceptual hashes
    const pipeline = [
      // Match org's non-deleted assets that have a perceptual hash
      {
        $match: {
          orgId: user.orgId,
          isDeleted: { $ne: true },
          perceptualHash: { $ne: null, $exists: true },
        },
      },
      // Group by perceptual hash
      {
        $group: {
          _id: '$perceptualHash',
          count: { $sum: 1 },
          assets: {
            $push: {
              _id: '$_id',
              name: '$name',
              originalName: '$originalName',
              storageKey: '$storageKey',
              thumbnailBase64: '$thumbnailBase64',
              thumbnailStorageKey: '$thumbnailStorageKey',
              mimeType: '$mimeType',
              sizeBytes: '$sizeBytes',
              width: '$width',
              height: '$height',
              folderId: '$folderId',
              createdAt: '$createdAt',
            },
          },
        },
      },
      // Only keep groups with 2+ assets (actual duplicates)
      { $match: { count: { $gte: 2 } } },
      // Sort by group size (most duplicates first)
      { $sort: { count: -1 as const } },
      // Pagination
      {
        $facet: {
          groups: [{ $skip: skip }, { $limit: limit }],
          totalCount: [{ $count: 'count' }],
        },
      },
    ];

    const [result] = await Asset.aggregate(pipeline);
    const groups = result.groups ?? [];
    const total = result.totalCount?.[0]?.count ?? 0;

    // Compute summary stats
    const totalDuplicateAssets = groups.reduce(
      (sum: number, g: { count: number }) => sum + g.count,
      0,
    );
    const totalWastedBytes = groups.reduce(
      (sum: number, g: { assets: Array<{ sizeBytes: number }> }) => {
        // Wasted = sum of all but the smallest file in each group
        const sizes = g.assets
          .map((a) => a.sizeBytes)
          .sort((a: number, b: number) => a - b);
        return sum + sizes.slice(1).reduce((s: number, v: number) => s + v, 0);
      },
      0,
    );

    console.log(
      `[Duplicates] Found ${total} duplicate groups, ${totalDuplicateAssets} total assets`,
    );

    return NextResponse.json({
      groups: groups.map(
        (g: { _id: string; count: number; assets: unknown[] }) => ({
          hash: g._id,
          count: g.count,
          assets: g.assets,
        }),
      ),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      stats: {
        totalDuplicateAssets,
        totalWastedBytes,
      },
    });
  } catch (err) {
    console.error('[Duplicates] Error:', err);
    return NextResponse.json(
      {
        error: 'Failed to find duplicates',
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
