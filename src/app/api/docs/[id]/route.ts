// SPDX-License-Identifier: Apache-2.0
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { connectToDatabase } from '@/lib/db';
import { User, Doc, Organization } from '@/models';
import { getSignedDownloadUrl } from '@/lib/storage';

/**
 * GET /api/docs/[id]
 * Returns a single doc with org branding for white-label rendering.
 */
export async function GET(
 _req: NextRequest,
 { params }: { params: Promise<{ id: string }> },
) {
 const { id } = await params;
 const session = await getSession();
 if (!session?.user?.email) {
 return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
 }

 await connectToDatabase();
 const user = await User.findOne({ email: session.user.email }).lean();
 if (!user?.orgId) {
 return NextResponse.json({ error: 'No organization' }, { status: 400 });
 }

 // Support lookup by slug or by _id
 const isSlug = !/^[0-9a-fA-F]{24}$/.test(id);
 const filter: Record<string, unknown> = { orgId: user.orgId };
 if (isSlug) {
 filter.slug = id;
 } else {
 filter._id = id;
 }

 const [doc, org] = await Promise.all([
 Doc.findOne(filter).lean(),
 Organization.findById(user.orgId).select('name logoUrl storageConfig themeColor').lean(),
 ]);

 if (!doc) {
 return NextResponse.json({ error: 'Doc not found' }, { status: 404 });
 }

 const orgDetails = org as
 | {
  name?: string;
  logoUrl?: string | null;
  themeColor?: string | null;
  storageConfig?: { bucket?: string };
 }
 | null;

 // If the doc is unpublished, only admin/owner can see it
 if (!doc.published && !['owner', 'admin'].includes(user.role ?? '')) {
 return NextResponse.json({ error: 'Doc not found' }, { status: 404 });
 }

 // Resolve signed URL for org logo
 let logoSignedUrl: string | null = null;
 if (orgDetails?.logoUrl) {
 try {
 const bucketOverride = orgDetails.storageConfig?.bucket || undefined;
 logoSignedUrl = await getSignedDownloadUrl(
 orgDetails.logoUrl,
 7 * 24 * 60 * 60,
 bucketOverride as string | undefined,
 String(user.orgId),
 );
 } catch {
 // Logo not accessible — skip
 }
 }

 return NextResponse.json({
 doc,
 org: {
 name: orgDetails?.name ?? '',
 logoUrl: logoSignedUrl,
 themeColor: orgDetails?.themeColor ?? 'violet',
 },
 });
}

/**
 * PATCH /api/docs/[id]
 * Update a doc (admin/owner only).
 */
export async function PATCH(
 req: NextRequest,
 { params }: { params: Promise<{ id: string }> },
) {
 const { id } = await params;
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
 const update: Record<string, unknown> = {};

 if (body.title?.trim()) {
 update.title = body.title.trim();
 update.slug = body.title
 .trim()
 .toLowerCase()
 .replace(/[^a-z0-9]+/g, '-')
 .replace(/(^-|-$)/g, '');
 }
 if (body.content !== undefined) update.content = body.content;
 if (body.category?.trim()) update.category = body.category.trim();
 if (typeof body.order === 'number') update.order = body.order;
 if (typeof body.published === 'boolean') update.published = body.published;

 const doc = await Doc.findOneAndUpdate(
 { _id: id, orgId: user.orgId },
 { $set: update },
 { new: true },
 ).lean();

 if (!doc) {
 return NextResponse.json({ error: 'Doc not found' }, { status: 404 });
 }

 return NextResponse.json({ doc });
}

/**
 * DELETE /api/docs/[id]
 */
export async function DELETE(
 _req: NextRequest,
 { params }: { params: Promise<{ id: string }> },
) {
 const { id } = await params;
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

 const doc = await Doc.findOneAndDelete({ _id: id, orgId: user.orgId }).lean();
 if (!doc) {
 return NextResponse.json({ error: 'Doc not found' }, { status: 404 });
 }

 return NextResponse.json({ success: true });
}
