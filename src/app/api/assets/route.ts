// SPDX-License-Identifier: Apache-2.0
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { connectToDatabase } from '@/lib/db';
import { Asset, User } from '@/models';
import { getSignedDownloadUrl } from '@/lib/storage';
import mongoose from 'mongoose';

/**
 * GET /api/assets
 * Query: folderId?, page?, limit?, q? (full-text search), sort?, sortDir?, mimeType?
 * Returns paginated assets for the current organization.
 * - Assets WITH thumbnailBase64: served inline (zero GCS calls)
 * - Legacy assets WITHOUT base64: fallback to signed URL generation
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sessionUser = session.user as Record<string, unknown>;
  const sessionOrgId =
    typeof sessionUser.orgId === 'string' && sessionUser.orgId.trim()
      ? sessionUser.orgId
      : null;

  await connectToDatabase();
  const user = await User.findOne({ email: session.user.email }).lean();
  const effectiveOrgId = user?.orgId
    ? String(user.orgId)
    : sessionOrgId;
  if (!effectiveOrgId) {
    return NextResponse.json({ error: 'No organization' }, { status: 400 });
  }

  const { searchParams } = req.nextUrl;
  const folderId = searchParams.get('folderId') || undefined;
  const q = searchParams.get('q')?.trim() || undefined;
  const sortField = searchParams.get('sort') || 'createdAt';
  const sortDir = searchParams.get('sortDir') === 'asc' ? 1 : -1;
  const mimeType = searchParams.get('mimeType') || undefined;
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const limitParam = searchParams.get('limit');
  const rawLimit = limitParam !== null ? Number(limitParam) : NaN;
  const limit = rawLimit === 0 ? 0 : Math.min(100, Math.max(1, rawLimit || 30));
  const skip = (page - 1) * (limit || 1);

  // Build filter — exclude soft-deleted assets
  const filter: Record<string, unknown> = {
    orgId: effectiveOrgId,
    isDeleted: { $ne: true },
  };
  // __root__ = only root-level assets (no folder)
  if (folderId === '__root__') {
    filter.folderId = { $in: [null, undefined] };
  } else if (folderId) {
    filter.folderId = folderId;
  }
  if (mimeType) {
    // "document" and "archive" filter on the fileCategory field (not a MIME prefix)
    if (mimeType === 'document' || mimeType === 'archive') {
      filter.fileCategory = mimeType;
    } else {
      filter.mimeType = { $regex: `^${mimeType}` };
    }
  }
  if (q) filter.$text = { $search: q };

  // Filter by dominant color (Sprint 9)
  const color = searchParams.get('color') || undefined;
  if (color) {
    filter.dominantColors = color;
  }

  // Filter by face hash (person filtering from AI People tab)
  const faceHash = searchParams.get('faceHash') || undefined;
  if (faceHash) {
    filter['faces.faceHash'] = faceHash;
  }

  // Build sort — when searching, include text score
  const allowedSortFields = ['createdAt', 'name', 'sizeBytes', 'updatedAt'];
  const safeSortField = allowedSortFields.includes(sortField)
    ? sortField
    : 'createdAt';
  const sort: Record<string, unknown> = q
    ? { score: { $meta: 'textScore' }, [safeSortField]: sortDir }
    : { [safeSortField]: sortDir };

  // Projection — include text score when searching
  const projection = q ? { score: { $meta: 'textScore' } } : {};

  const includeStats = searchParams.get('includeStats') === 'true';

  // When limit=0, skip fetching assets (stats-only mode)
  const [assets, total, sizePipeline] = await Promise.all([
    limit > 0
      ? Asset.find(filter, projection)
          .sort(sort as Record<string, 1 | -1 | { $meta: string }>)
          .skip(skip)
          .limit(limit)
          .lean()
      : Promise.resolve([]),
    Asset.countDocuments(filter),
    includeStats
      ? (() => {
          // Build an aggregate-safe filter with ObjectId casting (aggregate doesn't auto-cast)
          const aggFilter: Record<string, unknown> = { ...filter };
          if (typeof aggFilter.orgId === 'string') {
            aggFilter.orgId = new mongoose.Types.ObjectId(aggFilter.orgId);
          }
          if (typeof aggFilter.folderId === 'string') {
            aggFilter.folderId = new mongoose.Types.ObjectId(
              aggFilter.folderId,
            );
          }
          return Asset.aggregate([
            { $match: aggFilter },
            { $group: { _id: null, totalSizeBytes: { $sum: '$sizeBytes' } } },
          ]);
        })()
      : Promise.resolve([]),
  ]);

  const totalSizeBytes =
    sizePipeline.length > 0 ? sizePipeline[0].totalSizeBytes : 0;

  // For assets WITHOUT inline base64, generate signed thumbnail URLs as fallback
  // Only generate thumbnail URLs for assets that have a dedicated thumbnail OR are images
  // (non-image files like PDFs should NOT get a signed URL to the raw file as a "thumbnail")
  const legacyAssets = assets.filter(
    (a) =>
      !a.thumbnailBase64 &&
      (a.thumbnailStorageKey || a.mimeType?.startsWith('image/')),
  );
  let signedUrlCalls = 0;

  if (legacyAssets.length > 0) {
    const urlMap = new Map<string, string>();
    const urlPromises = legacyAssets.map(async (a) => {
      // Prefer thumbnail, fallback to original (safe for images only)
      const key = a.thumbnailStorageKey || a.storageKey;
      const url = await getSignedDownloadUrl(key, 60 * 60, undefined, effectiveOrgId);
      urlMap.set(String(a._id), url);
    });
    await Promise.all(urlPromises);
    signedUrlCalls = legacyAssets.length;

    // Attach signed URLs to legacy assets
    for (const asset of assets) {
      if (!asset.thumbnailBase64) {
        const signedUrl = urlMap.get(String(asset._id));
        if (signedUrl) {
          (asset as Record<string, unknown>).thumbnailUrl = signedUrl;
        }
      }
    }
  }

  const withBase64 = assets.filter((a) => a.thumbnailBase64).length;
  console.log(
    `[API /assets] Returning ${assets.length} assets (${withBase64} inline base64, ${signedUrlCalls} fallback signed URLs)`,
  );

  return NextResponse.json({
    assets,
    page,
    limit,
    total,
    totalPages: Math.ceil(total / (limit || 1)),
    ...(includeStats && { totalSizeBytes }),
  });
}
