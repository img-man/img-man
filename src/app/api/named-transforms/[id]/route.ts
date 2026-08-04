// SPDX-License-Identifier: Apache-2.0
/**
 * Named Transforms CRUD — Individual Item
 *
 * PATCH /api/named-transforms/[id] — Update a named transform
 * DELETE /api/named-transforms/[id] — Delete + invalidate cache
 */

import { NextResponse, type NextRequest } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { NamedTransform, DerivedAsset } from '@/models/index';
import { requirePermission } from '@/lib/auth-context';
import { parseTransforms, hasTransforms } from '@/lib/transforms/parser';
import { getGcsBucket } from '@/lib/storage';

/* ─── PATCH: Update Named Transform ──────────────────────────── */

export async function PATCH(
 req: NextRequest,
 { params }: { params: Promise<{ id: string }> },
) {
 try {
 const ctx = await requirePermission('manage_settings');
 const { id } = await params;
 await connectToDatabase();

 const doc = await NamedTransform.findOne({ _id: id, orgId: ctx.orgId });
 if (!doc) {
 return NextResponse.json(
 { error: 'Named transform not found' },
 { status: 404 },
 );
 }

 const body = await req.json();
 const { name, transforms, description } = body;

 if (name !== undefined) {
 if (typeof name !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(name.trim())) {
 return NextResponse.json(
 { error: 'Invalid name format' },
 { status: 400 },
 );
 }
 // Check duplicate
 const existing = await NamedTransform.findOne({
 orgId: ctx.orgId,
 name: name.trim(),
 _id: { $ne: id },
 });
 if (existing) {
 return NextResponse.json(
 { error: 'Name already in use' },
 { status: 409 },
 );
 }
 doc.name = name.trim();
 }

 if (transforms !== undefined) {
 if (typeof transforms !== 'string') {
 return NextResponse.json(
 { error: 'Transform string must be a string' },
 { status: 400 },
 );
 }
 const config = parseTransforms(transforms);
 if (!hasTransforms(config)) {
 return NextResponse.json(
 { error: 'Transform string contains no valid transforms' },
 { status: 400 },
 );
 }
 doc.transforms = transforms.trim();
 }

 if (description !== undefined) {
 doc.description = typeof description === 'string' ? description.trim() : '';
 }

 await doc.save();

 return NextResponse.json({ transform: doc });
 } catch (err: unknown) {
 const e = err as { status?: number; message?: string };
 return NextResponse.json(
 { error: e.message ?? 'Failed to update transform' },
 { status: e.status ?? 500 },
 );
 }
}

/* ─── DELETE: Remove Named Transform + Invalidate Cache ──────── */

export async function DELETE(
 _req: NextRequest,
 { params }: { params: Promise<{ id: string }> },
) {
 try {
 const ctx = await requirePermission('manage_settings');
 const { id } = await params;
 await connectToDatabase();

 const doc = await NamedTransform.findOneAndDelete({
 _id: id,
 orgId: ctx.orgId,
 });

 if (!doc) {
 return NextResponse.json(
 { error: 'Named transform not found' },
 { status: 404 },
 );
 }

 // Invalidate any cached transforms that referenced this named transform
 // (search for the name in transformStrings)
 const derivedDocs = await DerivedAsset.find({
 orgId: ctx.orgId,
 transformString: { $regex: `n-${doc.name}` },
 }).lean();

 if (derivedDocs.length > 0) {
 const bucket = await getGcsBucket(String(ctx.orgId));
 await Promise.all(
 derivedDocs.map(async (d) => {
 try {
 await bucket.file(d.storagePath).delete();
 } catch {
 // Ignore
 }
 }),
 );
 await DerivedAsset.deleteMany({
 orgId: ctx.orgId,
 transformString: { $regex: `n-${doc.name}` },
 });
 }

 return NextResponse.json({
 deleted: true,
 cacheInvalidated: derivedDocs.length,
 });
 } catch (err: unknown) {
 const e = err as { status?: number; message?: string };
 return NextResponse.json(
 { error: e.message ?? 'Failed to delete transform' },
 { status: e.status ?? 500 },
 );
 }
}
