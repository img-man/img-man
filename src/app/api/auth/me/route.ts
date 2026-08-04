// SPDX-License-Identifier: Apache-2.0
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { connectToDatabase } from '@/lib/db';
import { User, OrgMembership, Organization } from '@/models';
import type { Role } from '@/lib/permissions';

/**
 * GET /api/auth/me
 * Returns the current user's context including role.
 * Lightweight endpoint for client-side role-gating.
 */
export async function GET() {
 try {
 const session = await getSession();
 if (!session?.user?.email) {
 return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
 }

 await connectToDatabase();
 const user = await User.findOne({ email: session.user.email })
 .select('name email image orgId role')
 .lean();

 if (!user?.orgId) {
 return NextResponse.json({ error: 'No organization' }, { status: 403 });
 }

 // Check OrgMembership for source-of-truth role + fetch org slug
 const [membership, org] = await Promise.all([
 OrgMembership.findOne({
 orgId: user.orgId,
 email: session.user.email,
 status: 'active',
 })
 .select('role')
 .lean(),
 Organization.findById(user.orgId).select('name slug logoUrl sectionAccess themeColor').lean(),
 ]);

 const role: Role =
 (membership?.role as Role) ?? (user.role as Role) ?? 'viewer';

 // Convert Map to plain object for client
 const orgDetails = org as
 | {
  slug?: string;
  name?: string;
  logoUrl?: string | null;
  themeColor?: string | null;
  sectionAccess?: Map<string, number> | Record<string, number>;
 }
 | null;
 const rawAccess = orgDetails?.sectionAccess;
 const sectionAccess: Record<string, number> = rawAccess instanceof Map
 ? Object.fromEntries(rawAccess)
 : rawAccess ?? {};

 return NextResponse.json({
 userId: (user._id as unknown as string).toString(),
 email: user.email,
 name: user.name,
 image: user.image,
 orgId: (user.orgId as unknown as string).toString(),
 orgSlug: orgDetails?.slug ?? '',
 orgName: orgDetails?.name ?? '',
 logoUrl: orgDetails?.logoUrl ?? null,
 themeColor: orgDetails?.themeColor ?? 'violet',
 role,
 sectionAccess,
 });
 } catch {
 return NextResponse.json({ error: 'Server error' }, { status: 500 });
 }
}
