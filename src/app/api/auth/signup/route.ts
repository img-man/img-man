// SPDX-License-Identifier: Apache-2.0
import { NextResponse } from 'next/server';
import { hash } from 'bcryptjs';
import { connectToDatabase } from '@/lib/db';
import { User, OrgMembership, Organization } from '@/models';

/**
 * POST /api/auth/signup
 * Register a new user account.
 * If an inviteToken is provided, links the user to the inviting org.
 * Otherwise, creates a new personal org.
 */
export async function POST(req: Request) {
 try {
 const body = await req.json();
 const { name, email, password, inviteToken } = body as {
 name?: string;
 email?: string;
 password?: string;
 inviteToken?: string;
 };

 if (!name?.trim() || !email?.trim() || !password) {
 return NextResponse.json({ error: 'Name, email, and password are required' }, { status: 400 });
 }
 if (password.length < 8) {
 return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
 }

 await connectToDatabase();

 // Check if user already exists
 const existing = await User.findOne({ email: email.toLowerCase() }).lean();
 if (existing) {
 return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 });
 }

 const passwordHash = await hash(password, 12);

 // If invite token, find the pending membership
 if (inviteToken) {
 const membership = await OrgMembership.findOne({
 inviteToken,
 status: 'pending',
 });
 if (!membership) {
 return NextResponse.json({ error: 'Invalid or expired invite token' }, { status: 400 });
 }
 if (membership.inviteExpiresAt && membership.inviteExpiresAt < new Date()) {
 return NextResponse.json({ error: 'This invite has expired' }, { status: 400 });
 }

 // Create user linked to the org
 const user = await User.create({
 name: name.trim(),
 email: email.toLowerCase().trim(),
 passwordHash,
 orgId: membership.orgId,
 role: membership.role,
 });

 // Activate the membership
 membership.userId = user._id;
 membership.email = email.toLowerCase().trim();
 membership.status = 'active';
 membership.inviteToken = undefined;
 await membership.save();

 return NextResponse.json({
 message: 'Account created and linked to organization',
 userId: user._id.toString(),
 });
 }

 // No invite → create user + personal org
 const user = await User.create({
 name: name.trim(),
 email: email.toLowerCase().trim(),
 passwordHash,
 role: 'owner',
 });

 // Create a personal organization
 const slug = email.toLowerCase().split('@')[0].replace(/[^a-z0-9]/g, '-') + '-' + Date.now().toString(36);
 const org = await Organization.create({
 name: `${name.trim()}'s Workspace`,
 slug,
 ownerId: user._id,
 storageConfig: {
 provider: 'gcp',
 bucket: process.env.GCP_STORAGE_BUCKET ?? process.env.GCS_BUCKET ?? '',
 isByoc: false,
 },
 });

 // Link user to org
 user.orgId = org._id;
 await user.save();

 // Create owner membership
 await OrgMembership.create({
 orgId: org._id,
 userId: user._id,
 email: user.email,
 role: 'owner',
 invitedBy: user._id,
 status: 'active',
 });

 return NextResponse.json({
 message: 'Account and workspace created',
 userId: user._id.toString(),
 });
 } catch (err) {
 console.error('[Signup] Error:', err instanceof Error ? err.message : err);
 return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
 }
}
