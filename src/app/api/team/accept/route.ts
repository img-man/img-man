// SPDX-License-Identifier: Apache-2.0
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { OrgMembership, User, Organization } from '@/models';

/**
 * POST /api/team/accept
 * Body: { token: string }
 * Accept an invite via the invite token.
 * If user is logged in, binds to their account.
 * If user is not logged in, they must create an account first.
 */
export async function POST(req: NextRequest) {
 try {
 const body = await req.json();
 const { token } = body as { token?: string };

 if (!token) {
 return NextResponse.json(
 { error: 'Invite token is required' },
 { status: 400 },
 );
 }

 await connectToDatabase();

 const membership = await OrgMembership.findOne({
 inviteToken: token,
 status: 'pending',
 });

 if (!membership) {
 return NextResponse.json(
 { error: 'Invalid or expired invite' },
 { status: 404 },
 );
 }

 // Check expiry
 if (
 membership.inviteExpiresAt &&
 new Date() > membership.inviteExpiresAt
 ) {
 await OrgMembership.findByIdAndUpdate(membership._id, {
 status: 'revoked',
 });
 return NextResponse.json(
 { error: 'This invite has expired' },
 { status: 410 },
 );
 }

 // Find or create user
 let user = await User.findOne({
 email: membership.email,
 });

 if (!user) {
 // Auto-provision user (they'll set password on first login)
 user = await User.create({
 name: membership.email.split('@')[0],
 email: membership.email,
 orgId: membership.orgId,
 role: membership.role,
 });
 } else {
 // Update existing user's org binding
 user.orgId = membership.orgId;
 user.role = membership.role as 'owner' | 'admin' | 'editor' | 'viewer';
 await user.save();
 }

 // Activate membership
 membership.userId = user._id;
 membership.status = 'active';
 membership.inviteToken = undefined;
 membership.inviteExpiresAt = undefined;
 await membership.save();

 // Get org info for the response
 const org = await Organization.findById(membership.orgId)
 .select('name slug')
 .lean();

 return NextResponse.json({
 success: true,
 organization: org
 ? { name: org.name, slug: org.slug }
 : null,
 role: membership.role,
 message: `You've been added as ${membership.role} to ${org?.name ?? 'the organization'}`,
 });
 } catch (err: unknown) {
 const e = err as { status?: number; error?: string; message?: string };
 return NextResponse.json(
 { error: e.error ?? e.message ?? 'Server error' },
 { status: e.status ?? 500 },
 );
 }
}
