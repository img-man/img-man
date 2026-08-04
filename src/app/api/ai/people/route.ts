// SPDX-License-Identifier: Apache-2.0
import { NextRequest, NextResponse } from 'next/server';
import { requireAuthContext, requireSectionAccess } from '@/lib/auth-context';
import { connectToDatabase } from '@/lib/db';
import { Asset, Organization } from '@/models';

/**
 * GET /api/ai/people
 * Groups assets by detected face hashes and returns person clusters.
 * Each person group shows: faceHash, count, first appearance, thumbnail samples.
 * Query: page?, limit?
 */
export async function GET(req: NextRequest) {
 try {
 const ctx = await requireSectionAccess('ai_studio');
 await connectToDatabase();

 const { searchParams } = req.nextUrl;
 const page = Math.max(1, Number(searchParams.get('page')) || 1);
 const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit')) || 20));
 const skip = (page - 1) * limit;

 // Aggregate: unwind faces → group by faceHash → sort by count desc
 const pipeline = [
 {
 $match: {
 orgId: ctx.orgId,
 isDeleted: { $ne: true },
 'faces.0': { $exists: true }, // only assets with faces
 },
 },
 { $unwind: '$faces' },
 {
 $group: {
 _id: '$faces.faceHash',
 count: { $sum: 1 },
 firstSeen: { $min: '$createdAt' },
 lastSeen: { $max: '$createdAt' },
 avgConfidence: { $avg: '$faces.confidence' },
 emotions: { $addToSet: '$faces.emotion' },
 // Collect first 4 sample assets
 sampleAssets: {
 $push: {
 assetId: { $toString: '$_id' },
 name: '$name',
 thumbnailBase64: '$thumbnailBase64',
 thumbnailUrl: '$thumbnailStorageKey',
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

 // Enrich with person names from org settings
 const org = await Organization.findById(ctx.orgId).select('personNames').lean();
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

 return NextResponse.json({
 people: enrichedPeople,
 personNames: personNamesObj,
 page,
 limit,
 total,
 totalPages: Math.ceil(total / limit),
 });
 } catch (err: unknown) {
 const e = err as { status?: number; message?: string };
 return NextResponse.json(
 { error: e.message ?? 'Server error' },
 { status: e.status ?? 500 },
 );
 }
}

/**
 * PATCH /api/ai/people
 * Update a person's display name.
 * Body: { faceHash: string, displayName: string }
 */
export async function PATCH(req: NextRequest) {
 try {
 const ctx = await requireAuthContext();
 await connectToDatabase();

 const body = await req.json();
 const { faceHash, displayName } = body as { faceHash?: string; displayName?: string };

 if (!faceHash || typeof faceHash !== 'string') {
 return NextResponse.json({ error: 'faceHash is required' }, { status: 400 });
 }

 const name = (displayName ?? '').trim();
 const updateOp = name
 ? { $set: { [`personNames.${faceHash}`]: name } }
 : { $unset: { [`personNames.${faceHash}`]: '' } };

 await Organization.findByIdAndUpdate(ctx.orgId, updateOp);

 return NextResponse.json({ ok: true, faceHash, displayName: name || null });
 } catch (err: unknown) {
 const e = err as { status?: number; message?: string };
 return NextResponse.json(
 { error: e.message ?? 'Server error' },
 { status: e.status ?? 500 },
 );
 }
}
