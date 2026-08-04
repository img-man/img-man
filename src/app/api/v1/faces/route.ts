// SPDX-License-Identifier: Apache-2.0
/**
 * GET /api/v1/faces — List unique faces (people) across assets
 * POST /api/v1/faces/search — Search for a face across assets using a selfie
 *
 * Auth: API Key (read)
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { authenticateApiRequest, isErrorResponse, addCorsHeaders, applyFolderScope } from '@/lib/api-auth';
import { Asset, Organization } from '@/models';
import { getSignedDownloadUrl } from '@/lib/storage';

export async function OPTIONS(req: NextRequest) {
 const res = new NextResponse(null, { status: 204 });
 return addCorsHeaders(res, req.headers.get('origin'), []);
}

/**
 * GET /api/v1/faces
 *
 * List unique faces (people) detected across all assets in the org.
 * Respects folder scope if the API key has one set.
 *
 * Query params:
 * - page (default: 1)
 * - limit (default: 20, max: 50)
 *
 * Returns:
 * - people[]: { faceHash, displayName, count, firstSeen, lastSeen, avgConfidence, emotions, sampleAssets[] }
 * - personNames: { faceHash → displayName }
 * - pagination: { page, limit, total, totalPages }
 */
export async function GET(req: NextRequest) {
 const auth = await authenticateApiRequest(req, 'read');
 if (isErrorResponse(auth)) return auth;

 await connectToDatabase();

 const { searchParams } = req.nextUrl;
 const page = Math.max(1, Number(searchParams.get('page')) || 1);
 const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit')) || 20));
 const skip = (page - 1) * limit;

 // Build base match filter with folder scope
 const matchFilter: Record<string, unknown> = {
 orgId: auth.orgId,
 isDeleted: { $ne: true },
 'faces.0': { $exists: true },
 };

 // Apply folder scope if API key has one
 const scopeError = await applyFolderScope(auth, matchFilter, 'asset');
 if (scopeError) return scopeError;

 const pipeline = [
 { $match: matchFilter },
 { $unwind: '$faces' },
 {
 $group: {
 _id: '$faces.faceHash',
 count: { $sum: 1 },
 firstSeen: { $min: '$createdAt' },
 lastSeen: { $max: '$createdAt' },
 avgConfidence: { $avg: '$faces.confidence' },
 emotions: { $addToSet: '$faces.emotion' },
 sampleAssets: {
 $push: {
 assetId: { $toString: '$_id' },
 name: '$name',
 thumbnailBase64: '$thumbnailBase64',
 boundingBox: '$faces.boundingBox',
 createdAt: '$createdAt',
 },
 },
 },
 },
 { $sort: { count: -1 as const } },
 {
 $facet: {
 metadata: [{ $count: 'total' }],
 data: [
 { $skip: skip },
 { $limit: limit },
 {
 $project: {
 faceHash: '$_id',
 count: 1,
 firstSeen: 1,
 lastSeen: 1,
 avgConfidence: 1,
 emotions: 1,
 sampleAssets: { $slice: ['$sampleAssets', 4] },
 },
 },
 ],
 },
 },
 ];

 const [result] = await Asset.aggregate(pipeline);
 const total = result.metadata[0]?.total ?? 0;
 const people = result.data;

 // Enrich with person names
 const org = await Organization.findById(auth.orgId).select('personNames').lean();
 const personNamesMap = (org as unknown as { personNames?: Map<string, string> })?.personNames;
 const personNamesObj: Record<string, string> = {};
 if (personNamesMap instanceof Map) {
 personNamesMap.forEach((v, k) => { personNamesObj[k] = v; });
 } else if (personNamesMap && typeof personNamesMap === 'object') {
 Object.assign(personNamesObj, personNamesMap);
 }

 const enrichedPeople = people.map((p: { faceHash: string }) => ({
 ...p,
 displayName: personNamesObj[p.faceHash] ?? null,
 }));

 const res = NextResponse.json({
 people: enrichedPeople,
 personNames: personNamesObj,
 page,
 limit,
 total,
 totalPages: Math.ceil(total / limit),
 });
 return addCorsHeaders(res, req.headers.get('origin'), auth.allowedDomains);
}
