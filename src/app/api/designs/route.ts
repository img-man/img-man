// SPDX-License-Identifier: Apache-2.0
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { connectToDatabase } from '@/lib/db';
import { Design, User } from '@/models';
import { isSectionRestricted } from '@/lib/auth-context';
import type { Role } from '@/lib/permissions';

/**
 * GET /api/designs
 * Query: page?, limit?, q?
 * Returns paginated list of designs for the current organization.
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

 // Section access enforcement
 if (await isSectionRestricted(String(user.orgId), (user.role as Role) ?? 'viewer', 'designs')) {
 return NextResponse.json({ error: 'Access to designs is restricted for your role' }, { status: 403 });
 }

 const { searchParams } = req.nextUrl;
 const q = searchParams.get('q')?.trim() || undefined;
 const page = Math.max(1, Number(searchParams.get('page')) || 1);
 const limit = Math.min(
 50,
 Math.max(1, Number(searchParams.get('limit')) || 20),
 );
 const skip = (page - 1) * limit;

 const filter: Record<string, unknown> = { orgId: user.orgId };
 if (q) {
 filter.name = { $regex: q, $options: 'i' };
 }

 const [designs, total] = await Promise.all([
 Design.find(filter)
 .select('-jsonState') // Exclude heavy JSON state from list view
 .sort({ updatedAt: -1 })
 .skip(skip)
 .limit(limit)
 .lean(),
 Design.countDocuments(filter),
 ]);

 return NextResponse.json({
 designs,
 page,
 limit,
 total,
 totalPages: Math.ceil(total / limit),
 });
}

/**
 * POST /api/designs
 * Body: { name, width, height, jsonState?, templateId? }
 * Creates a new design.
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

 // Section access enforcement
 if (await isSectionRestricted(String(user.orgId), (user.role as Role) ?? 'viewer', 'designs')) {
 return NextResponse.json({ error: 'Access to designs is restricted for your role' }, { status: 403 });
 }

 const body = await req.json();
 const { name, width, height, jsonState } = body;

 if (!name?.trim()) {
 return NextResponse.json(
 { error: 'Design name is required' },
 { status: 400 },
 );
 }
 if (!width || !height || width < 1 || height < 1) {
 return NextResponse.json(
 { error: 'Valid width and height are required' },
 { status: 400 },
 );
 }

 const design = await Design.create({
 orgId: user.orgId,
 createdById: user._id,
 name: name.trim(),
 width: Math.round(width),
 height: Math.round(height),
 jsonState: jsonState || {},
 });

 return NextResponse.json({ design }, { status: 201 });
}
