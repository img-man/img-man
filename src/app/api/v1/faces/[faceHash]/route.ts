// SPDX-License-Identifier: Apache-2.0
/**
 * GET /api/v1/faces/[faceHash]/assets — List assets containing this face
 * PATCH /api/v1/faces/[faceHash] — Name a face (update personNames)
 *
 * Auth: API Key (read for GET, write for PATCH)
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { authenticateApiRequest, isErrorResponse, addCorsHeaders, applyFolderScope } from '@/lib/api-auth';
import { Asset, Organization } from '@/models';
import { getSignedDownloadUrl } from '@/lib/storage';

interface RouteContext {
 params: Promise<{ faceHash: string }>;
}

export async function OPTIONS(req: NextRequest) {
 const res = new NextResponse(null, { status: 204 });
 return addCorsHeaders(res, req.headers.get('origin'), []);
}

/**
 * GET /api/v1/faces/[faceHash]/assets
 *
 * List all assets containing a specific face.
 *
 * Query params:
 * - page (default: 1)
 * - limit (default: 30, max: 100)
 */
export async function GET(req: NextRequest, ctx: RouteContext) {
 const { faceHash } = await ctx.params;
 const auth = await authenticateApiRequest(req, 'read');
 if (isErrorResponse(auth)) return auth;

 await connectToDatabase();

 const { searchParams } = req.nextUrl;
 const page = Math.max(1, Number(searchParams.get('page')) || 1);
 const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || 30));
 const skip = (page - 1) * limit;

 const filter: Record<string, unknown> = {
 orgId: auth.orgId,
 isDeleted: { $ne: true },
 'faces.faceHash': faceHash,
 };

 // Apply folder scope
 const scopeError = await applyFolderScope(auth, filter, 'asset');
 if (scopeError) return scopeError;

 const [assets, total] = await Promise.all([
 Asset.find(filter)
 .sort({ createdAt: -1 })
 .skip(skip)
 .limit(limit)
 .lean(),
 Asset.countDocuments(filter),
 ]);

 // Enrich with signed URLs
 const enriched = await Promise.all(
 assets.map(async (a) => {
 const url = await getSignedDownloadUrl(a.storageKey, 3600, undefined, String(auth.orgId));
 const thumbnailUrl = a.thumbnailStorageKey
 ? await getSignedDownloadUrl(a.thumbnailStorageKey, 3600, undefined, String(auth.orgId))
 : null;

 // Find the specific face in this asset
 const face = a.faces?.find((f: { faceHash: string }) => f.faceHash === faceHash);

 return {
 _id: String(a._id),
 name: a.name,
 mimeType: a.mimeType,
 width: a.width,
 height: a.height,
 url,
 thumbnailUrl: thumbnailUrl || a.thumbnailBase64 || null,
 face: face
 ? {
 faceHash: face.faceHash,
 confidence: face.confidence,
 boundingBox: face.boundingBox,
 emotion: face.emotion,
 }
 : null,
 tags: a.tags,
 folderId: a.folderId ? String(a.folderId) : null,
 createdAt: a.createdAt,
 };
 }),
 );

 // Get display name for this face
 const org = await Organization.findById(auth.orgId).select('personNames').lean();
 const personNamesMap = (org as unknown as { personNames?: Map<string, string> })?.personNames;
 let displayName: string | null = null;
 if (personNamesMap instanceof Map) {
 displayName = personNamesMap.get(faceHash) ?? null;
 } else if (personNamesMap && typeof personNamesMap === 'object') {
 displayName = (personNamesMap as Record<string, string>)[faceHash] ?? null;
 }

 const res = NextResponse.json({
 faceHash,
 displayName,
 assets: enriched,
 page,
 limit,
 total,
 totalPages: Math.ceil(total / limit),
 });
 return addCorsHeaders(res, req.headers.get('origin'), auth.allowedDomains);
}

/**
 * PATCH /api/v1/faces/[faceHash]
 *
 * Name or un-name a face.
 *
 * Body: { displayName: string }
 * - Set displayName to a non-empty string to name the face
 * - Set displayName to "" or null to remove the name
 */
export async function PATCH(req: NextRequest, ctx: RouteContext) {
 const { faceHash } = await ctx.params;
 const auth = await authenticateApiRequest(req, 'write');
 if (isErrorResponse(auth)) return auth;

 await connectToDatabase();

 const body = await req.json();
 const { displayName } = body as { displayName?: string };

 if (displayName === undefined) {
 const res = NextResponse.json(
 { error: 'displayName is required', code: 'VALIDATION_ERROR' },
 { status: 400 },
 );
 return addCorsHeaders(res, req.headers.get('origin'), auth.allowedDomains);
 }

 const name = (displayName ?? '').trim();
 const updateOp = name
 ? { $set: { [`personNames.${faceHash}`]: name } }
 : { $unset: { [`personNames.${faceHash}`]: '' } };

 await Organization.findByIdAndUpdate(auth.orgId, updateOp);

 const res = NextResponse.json({
 faceHash,
 displayName: name || null,
 });
 return addCorsHeaders(res, req.headers.get('origin'), auth.allowedDomains);
}
