// SPDX-License-Identifier: Apache-2.0
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import { connectToDatabase } from '@/lib/db';
import { Asset, User } from '@/models';

/**
 * POST /api/assets/star
 * Body: { assetId: string } or { assetIds: string[] }
 *
 * DS-6.5 — Toggle star/favorite on one or many assets.
 * Returns the new starred state for each asset.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const assetIds: string[] = body.assetIds
      ? body.assetIds
      : body.assetId
        ? [body.assetId]
        : [];

    if (assetIds.length === 0) {
      return NextResponse.json(
        { error: 'assetId or assetIds required' },
        { status: 400 },
      );
    }

    await connectToDatabase();
    const userId = session.user.id;
    const user = await User.findOne({ email: session.user.email }).lean();
    if (!user?.orgId) {
      return NextResponse.json({ error: 'No organization' }, { status: 400 });
    }
    const orgId = String(user.orgId);

    // For each asset: toggle starredBy — if user is in array, remove; otherwise add.
    const results: { assetId: string; starred: boolean }[] = [];

    for (const assetId of assetIds) {
      const asset = await Asset.findOne({ _id: assetId, orgId, isDeleted: { $ne: true } });
      if (!asset) {
        results.push({ assetId, starred: false });
        continue;
      }

      const starredBy: string[] = (asset.starredBy ?? []).map(String);
      const isCurrentlyStarred = starredBy.includes(userId);

      if (isCurrentlyStarred) {
        // Un-star
        await Asset.updateOne(
          { _id: assetId, orgId },
          { $pull: { starredBy: userId } },
        );
        results.push({ assetId, starred: false });
      } else {
        // Star
        await Asset.updateOne(
          { _id: assetId, orgId },
          { $addToSet: { starredBy: userId } },
        );
        results.push({ assetId, starred: true });
      }
    }

    return NextResponse.json({ results });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
