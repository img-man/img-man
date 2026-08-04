// SPDX-License-Identifier: Apache-2.0
/**
 * GET /api/v1/assets/[id]/transform — Get transform URL for an asset.
 *
 * Query params: transforms (e.g. "w-300,h-300,q-80,f-webp")
 * Returns a signed URL to the transformed image.
 *
 * Auth: API Key (transform)
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { authenticateApiRequest, isErrorResponse, addCorsHeaders } from '@/lib/api-auth';
import { Asset, Organization } from '@/models';

interface RouteContext {
 params: Promise<{ id: string }>;
}

export async function OPTIONS(req: NextRequest) {
 const res = new NextResponse(null, { status: 204 });
 return addCorsHeaders(res, req.headers.get('origin'), []);
}

export async function GET(req: NextRequest, ctx: RouteContext) {
 const { id } = await ctx.params;
 const auth = await authenticateApiRequest(req, 'transform');
 if (isErrorResponse(auth)) return auth;

 await connectToDatabase();

 const [asset, org] = await Promise.all([
 Asset.findOne({ _id: id, orgId: auth.orgId, isDeleted: { $ne: true } }).lean(),
 Organization.findById(auth.orgId).lean(),
 ]);

 if (!asset) {
 return NextResponse.json(
 { error: 'Asset not found', code: 'NOT_FOUND' },
 { status: 404 },
 );
 }

 const transforms = req.nextUrl.searchParams.get('transforms') ?? '';
 const slug = org?.slug ?? auth.orgId;

 // Build the transform URL using the existing transform endpoint
 const baseUrl = req.nextUrl.origin;
 const transformUrl = transforms
 ? `${baseUrl}/api/transform/${slug}/${transforms}/${asset.storageKey}`
 : `${baseUrl}/api/transform/${slug}/${asset.storageKey}`;

 const res = NextResponse.json({
 url: transformUrl,
 assetId: String(asset._id),
 transforms: transforms || null,
 });
 return addCorsHeaders(res, req.headers.get('origin'), auth.allowedDomains);
}
