// SPDX-License-Identifier: Apache-2.0
/**
 * POST /api/v1/upload/signed-url — Get presigned upload URL
 *
 * Body: { fileName, contentType, sizeBytes }
 * Returns: { uploadUrl, assetId, storageKey, url }
 *
 * Auth: API Key (write)
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { authenticateApiRequest, isErrorResponse, addCorsHeaders } from '@/lib/api-auth';
import { Asset, Organization } from '@/models';
import { getSignedDownloadUrl, getSignedUploadUrl } from '@/lib/storage';
import { getPublicAssetUrl } from '@/lib/asset-url';

export async function OPTIONS(req: NextRequest) {
 const res = new NextResponse(null, { status: 204 });
 return addCorsHeaders(res, req.headers.get('origin'), []);
}

export async function POST(req: NextRequest) {
 const auth = await authenticateApiRequest(req, 'write');
 if (isErrorResponse(auth)) return auth;

 await connectToDatabase();

 const body = await req.json();
 const { fileName, contentType, sizeBytes, folderId } = body;

 if (!fileName || typeof fileName !== 'string') {
 return NextResponse.json(
 { error: 'fileName is required', code: 'VALIDATION_ERROR' },
 { status: 400 },
 );
 }

 if (!contentType || typeof contentType !== 'string') {
 return NextResponse.json(
 { error: 'contentType is required', code: 'VALIDATION_ERROR' },
 { status: 400 },
 );
 }

 const org = await Organization.findById(auth.orgId).lean();
 const slug = org?.slug ?? auth.orgId;
 const storageKey = `uploads/${slug}/${Date.now()}-${fileName}`;

 const uploadUrl = await getSignedUploadUrl(storageKey, contentType, undefined, undefined, String(auth.orgId));
 const url = await getSignedDownloadUrl(storageKey, 3600, undefined, String(auth.orgId));

 // Pre-create asset record
 const asset = await Asset.create({
 orgId: auth.orgId,
 folderId: folderId || null,
 name: fileName,
 storageKey,
 mimeType: contentType,
 sizeBytes: sizeBytes ?? 0,
 tags: [],
 createdById: null,
 });

 const publicUrl = getPublicAssetUrl(String(asset._id));

 const res = NextResponse.json(
 {
 uploadUrl,
 assetId: String(asset._id),
 storageKey,
 url,
 publicUrl,
 },
 { status: 201 },
 );
 return addCorsHeaders(res, req.headers.get('origin'), auth.allowedDomains);
}
