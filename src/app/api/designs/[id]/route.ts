// SPDX-License-Identifier: Apache-2.0
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { connectToDatabase } from '@/lib/db';
import { Design, User } from '@/models';

interface RouteContext {
 params: Promise<{ id: string }>;
}

/**
 * GET /api/designs/:id
 * Returns full design including jsonState for editor loading.
 */
export async function GET(_req: NextRequest, ctx: RouteContext) {
 const { id } = await ctx.params;

 const session = await getSession();
 if (!session?.user?.email) {
 return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
 }

 await connectToDatabase();
 const user = await User.findOne({ email: session.user.email }).lean();
 if (!user?.orgId) {
 return NextResponse.json({ error: 'No organization' }, { status: 400 });
 }

 const design = await Design.findOne({ _id: id, orgId: user.orgId }).lean();
 if (!design) {
 return NextResponse.json({ error: 'Design not found' }, { status: 404 });
 }

 return NextResponse.json({ design });
}

/**
 * PATCH /api/designs/:id
 * Body: { name?, jsonState?, thumbnailUrl?, width?, height? }
 * Updates design metadata and/or canvas state.
 */
export async function PATCH(req: NextRequest, ctx: RouteContext) {
 const { id } = await ctx.params;

 const session = await getSession();
 if (!session?.user?.email) {
 return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
 }

 await connectToDatabase();
 const user = await User.findOne({ email: session.user.email }).lean();
 if (!user?.orgId) {
 return NextResponse.json({ error: 'No organization' }, { status: 400 });
 }

 const body = await req.json();
 const update: Record<string, unknown> = {};

 if (typeof body.name === 'string' && body.name.trim()) {
 update.name = body.name.trim();
 }
 if (body.jsonState !== undefined) {
 update.jsonState = body.jsonState;
 }
 if (typeof body.thumbnailUrl === 'string') {
 update.thumbnailUrl = body.thumbnailUrl;
 }
 if (typeof body.width === 'number' && body.width > 0) {
 update.width = Math.round(body.width);
 }
 if (typeof body.height === 'number' && body.height > 0) {
 update.height = Math.round(body.height);
 }

 if (Object.keys(update).length === 0) {
 return NextResponse.json(
 { error: 'No valid fields to update' },
 { status: 400 },
 );
 }

 const design = await Design.findOneAndUpdate(
 { _id: id, orgId: user.orgId },
 { $set: update },
 { new: true },
 ).lean();

 if (!design) {
 return NextResponse.json({ error: 'Design not found' }, { status: 404 });
 }

 return NextResponse.json({ design });
}

/**
 * DELETE /api/designs/:id
 * Deletes a design.
 */
export async function DELETE(_req: NextRequest, ctx: RouteContext) {
 const { id } = await ctx.params;

 const session = await getSession();
 if (!session?.user?.email) {
 return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
 }

 await connectToDatabase();
 const user = await User.findOne({ email: session.user.email }).lean();
 if (!user?.orgId) {
 return NextResponse.json({ error: 'No organization' }, { status: 400 });
 }

 const design = await Design.findOneAndDelete({
 _id: id,
 orgId: user.orgId,
 }).lean();

 if (!design) {
 return NextResponse.json({ error: 'Design not found' }, { status: 404 });
 }

 return NextResponse.json({ success: true });
}
