// SPDX-License-Identifier: Apache-2.0
/**
 * Named Transforms API
 *
 * GET /api/named-transforms — List all named transforms for the org
 * POST /api/named-transforms — Create a new named transform
 */

import { NextResponse, type NextRequest } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { NamedTransform } from '@/models/index';
import { requirePermission } from '@/lib/auth-context';
import { parseTransforms, hasTransforms } from '@/lib/transforms/parser';

/* ─── GET: List Named Transforms ─────────────────────────────── */

export async function GET() {
 try {
 const ctx = await requirePermission('view');
 await connectToDatabase();

 const transforms = await NamedTransform.find({ orgId: ctx.orgId })
 .sort({ name: 1 })
 .lean();

 return NextResponse.json({ transforms });
 } catch (err: unknown) {
 const e = err as { status?: number; message?: string };
 return NextResponse.json(
 { error: e.message ?? 'Failed to list transforms' },
 { status: e.status ?? 500 },
 );
 }
}

/* ─── POST: Create Named Transform ───────────────────────────── */

export async function POST(req: NextRequest) {
 try {
 const ctx = await requirePermission('manage_settings');
 await connectToDatabase();

 const body = await req.json();
 const { name, transforms, description } = body;

 // Validate name
 if (!name || typeof name !== 'string') {
 return NextResponse.json(
 { error: 'Name is required' },
 { status: 400 },
 );
 }

 if (!/^[a-zA-Z0-9_-]{1,64}$/.test(name.trim())) {
 return NextResponse.json(
 {
 error:
 'Name must be 1-64 characters, alphanumeric with underscores/dashes only',
 },
 { status: 400 },
 );
 }

 // Validate transforms string
 if (!transforms || typeof transforms !== 'string') {
 return NextResponse.json(
 { error: 'Transform string is required' },
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

 // Check for duplicate name
 const existing = await NamedTransform.findOne({
 orgId: ctx.orgId,
 name: name.trim(),
 });
 if (existing) {
 return NextResponse.json(
 { error: 'A named transform with this name already exists' },
 { status: 409 },
 );
 }

 const doc = await NamedTransform.create({
 orgId: ctx.orgId,
 name: name.trim(),
 transforms: transforms.trim(),
 description: description?.trim() ?? '',
 createdById: ctx.userId,
 });

 return NextResponse.json({ transform: doc }, { status: 201 });
 } catch (err: unknown) {
 const e = err as { status?: number; message?: string };
 return NextResponse.json(
 { error: e.message ?? 'Failed to create transform' },
 { status: e.status ?? 500 },
 );
 }
}
