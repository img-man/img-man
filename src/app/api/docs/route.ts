// SPDX-License-Identifier: Apache-2.0
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { connectToDatabase } from '@/lib/db';
import { User, Doc } from '@/models';

/**
 * GET /api/docs
 * List docs for the current organization.
 * Query: ?published=true (for non-admins) | ?all=true (admin — includes drafts)
 */
export async function GET(req: NextRequest) {
 const session = await getSession();
 if (!session?.user?.email) {
 return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
 }

 await connectToDatabase();
 const user = await User.findOne({ email: session.user.email }).lean();
 if (!user?.orgId) {
 return NextResponse.json({ error: 'No organization' }, { status: 400 });
 }

 const { searchParams } = new URL(req.url);
 const showAll = searchParams.get('all') === 'true' && ['owner', 'admin'].includes(user.role ?? '');

 const filter: Record<string, unknown> = { orgId: user.orgId };
 if (!showAll) {
 filter.published = true;
 }

 const docs = await Doc.find(filter)
 .sort({ category: 1, order: 1, createdAt: -1 })
 .lean();

 // Group by category
 const categories = [...new Set(docs.map((d) => d.category))];

 return NextResponse.json({ docs, categories });
}

/**
 * POST /api/docs
 * Create a new knowledge-base doc (admin/owner only).
 */
export async function POST(req: NextRequest) {
 const session = await getSession();
 if (!session?.user?.email) {
 return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
 }

 await connectToDatabase();
 const user = await User.findOne({ email: session.user.email }).lean();
 if (!user?.orgId) {
 return NextResponse.json({ error: 'No organization' }, { status: 400 });
 }

 if (!['owner', 'admin'].includes(user.role ?? '')) {
 return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
 }

 const body = await req.json();

 if (!body.title?.trim()) {
 return NextResponse.json({ error: 'Title is required' }, { status: 400 });
 }

 // Auto-generate slug
 const slug = body.title
 .trim()
 .toLowerCase()
 .replace(/[^a-z0-9]+/g, '-')
 .replace(/(^-|-$)/g, '');

 // Check uniqueness
 const existing = await Doc.findOne({ orgId: user.orgId, slug }).lean();
 if (existing) {
 return NextResponse.json({ error: 'A doc with this title already exists' }, { status: 409 });
 }

 const doc = await Doc.create({
 orgId: user.orgId,
 title: body.title.trim(),
 slug,
 content: body.content ?? '',
 category: body.category?.trim() || 'General',
 order: typeof body.order === 'number' ? body.order : 0,
 published: body.published ?? false,
 createdById: user._id,
 });

 return NextResponse.json({ doc }, { status: 201 });
}
