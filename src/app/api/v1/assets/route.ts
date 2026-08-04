// SPDX-License-Identifier: Apache-2.0
/**
 * GET /api/v1/assets — List assets (paginate, search, filter)
 * POST /api/v1/assets — Upload asset (multipart or URL)
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
import { Asset, Organization } from '@/models';
import { getSignedDownloadUrl, getSignedUploadUrl } from '@/lib/storage';
import mongoose from 'mongoose';

export async function OPTIONS(req: NextRequest) {
  const res = new NextResponse(null, { status: 204 });
  return addCorsHeaders(res, req.headers.get('origin'), []);
}

export async function GET(req: NextRequest) {
  const auth = await authenticateApiRequest(req, 'read');
  if (isErrorResponse(auth)) return auth;

  await connectToDatabase();

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

  const filter: Record<string, unknown> = {
    orgId: auth.orgId,
    isDeleted: { $ne: true },
  };
  if (folderId) filter.folderId = folderId;
  if (mimeType) filter.mimeType = { $regex: `^${mimeType}` };
  if (q) filter.$text = { $search: q };

  // Enforce API key folder scope
  const scopeError = await applyFolderScope(auth, filter, 'asset');
  if (scopeError) return scopeError;

  const allowedSortFields = ['createdAt', 'name', 'sizeBytes', 'updatedAt'];
  const safeSortField = allowedSortFields.includes(sortField)
    ? sortField
    : 'createdAt';
  const sort: Record<string, unknown> = q
    ? { score: { $meta: 'textScore' }, [safeSortField]: sortDir }
    : { [safeSortField]: sortDir };
  const projection = q ? { score: { $meta: 'textScore' } } : {};

  const includeStats = searchParams.get('includeStats') === 'true';

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
          // Build an aggregate-safe filter with ObjectId for orgId
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

  // Generate signed URLs for assets without inline thumbnails
  const enriched = await Promise.all(
    assets.map(async (a) => {
      const url = await getSignedDownloadUrl(a.storageKey, 3600, undefined, auth.orgId);
      return {
        _id: String(a._id),
        name: a.name,
        mimeType: a.mimeType,
        width: a.width,
        height: a.height,
        sizeBytes: a.sizeBytes,
        url,
        thumbnailBase64: a.thumbnailBase64 || null,
        tags: a.tags,
        folderId: a.folderId ? String(a.folderId) : null,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
      };
    }),
  );

  const res = NextResponse.json({
    assets: enriched,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / (limit || 1)),
    ...(includeStats && { totalSizeBytes }),
  });

  return addCorsHeaders(res, req.headers.get('origin'), auth.allowedDomains);
}

export async function POST(req: NextRequest) {
  const auth = await authenticateApiRequest(req, 'write');
  if (isErrorResponse(auth)) return auth;

  await connectToDatabase();

  const body = await req.json();
  const { name, folderId, tags, url: importUrl } = body;

  if (!name || typeof name !== 'string') {
    return NextResponse.json(
      { error: 'name is required', code: 'VALIDATION_ERROR' },
      { status: 400 },
    );
  }

  // If importing from URL
  if (importUrl) {
    const fetchRes = await fetch(importUrl);
    if (!fetchRes.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch image from URL', code: 'IMPORT_FAILED' },
        { status: 400 },
      );
    }

    const contentType =
      fetchRes.headers.get('content-type') ?? 'application/octet-stream';
    const buffer = Buffer.from(await fetchRes.arrayBuffer());
    const { uploadBuffer } = await import('@/lib/storage');

    const org = await Organization.findById(auth.orgId).lean();
    const slug = org?.slug ?? auth.orgId;
    const effectiveUserId = auth.userId ?? org?.ownerId?.toString() ?? null;
    const storageKey = `uploads/${slug}/${Date.now()}-${name}`;
    await uploadBuffer(storageKey, buffer, contentType, undefined, undefined, auth.orgId);

    const asset = await Asset.create({
      orgId: auth.orgId,
      folderId: folderId || null,
      name,
      originalName: name,
      storageKey,
      mimeType: contentType,
      sizeBytes: buffer.length,
      tags: tags ?? [],
      uploadedById: effectiveUserId,
      createdById: effectiveUserId,
    });

    const url = await getSignedDownloadUrl(storageKey, 3600, undefined, auth.orgId);

    const res = NextResponse.json(
      {
        asset: { ...asset.toObject(), url },
      },
      { status: 201 },
    );
    return addCorsHeaders(res, req.headers.get('origin'), auth.allowedDomains);
  }

  // Otherwise, return a signed upload URL for direct upload
  const contentType = body.contentType ?? 'application/octet-stream';
  const org = await Organization.findById(auth.orgId).lean();
  const slug = org?.slug ?? auth.orgId;
  const effectiveUserId = auth.userId ?? org?.ownerId?.toString() ?? null;
  const storageKey = `uploads/${slug}/${Date.now()}-${name}`;
  const uploadUrl = await getSignedUploadUrl(storageKey, contentType, undefined, undefined, auth.orgId);

  const asset = await Asset.create({
    orgId: auth.orgId,
    folderId: folderId || null,
    name,
    originalName: name,
    storageKey,
    mimeType: contentType,
    sizeBytes: body.sizeBytes ?? 0,
    tags: tags ?? [],
    uploadedById: effectiveUserId,
    createdById: effectiveUserId,
  });

  const res = NextResponse.json(
    {
      assetId: String(asset._id),
      uploadUrl,
      storageKey,
    },
    { status: 201 },
  );
  return addCorsHeaders(res, req.headers.get('origin'), auth.allowedDomains);
}
