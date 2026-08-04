// SPDX-License-Identifier: Apache-2.0
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { connectToDatabase } from '@/lib/db';
import { ShareLink } from '@/models';

interface RouteContext {
 params: Promise<{ token: string }>;
}

/**
 * POST /api/share/[token]/password
 * Body: { password: string }
 * Verify the password for a password-protected share link.
 * Returns { valid: boolean }.
 */
export async function POST(req: NextRequest, context: RouteContext) {
 try {
 const { token } = await context.params;
 const body = await req.json();
 const { password } = body as { password?: string };

 if (!password) {
 return NextResponse.json(
 { error: 'Password is required' },
 { status: 400 },
 );
 }

 await connectToDatabase();

 // Explicitly select the password field (it's excluded by default)
 const link = await ShareLink.findOne({ token })
 .select('+password')
 .lean();

 if (!link) {
 return NextResponse.json(
 { error: 'Share link not found' },
 { status: 404 },
 );
 }

 if (!link.isActive) {
 return NextResponse.json(
 { error: 'This share link has been revoked' },
 { status: 410 },
 );
 }

 if (link.expiresAt && new Date() > link.expiresAt) {
 return NextResponse.json(
 { error: 'This share link has expired' },
 { status: 410 },
 );
 }

 if (!link.password) {
 // No password set — access is open
 return NextResponse.json({ valid: true });
 }

 const valid = await bcrypt.compare(password, link.password);
 return NextResponse.json({ valid });
 } catch (err: unknown) {
 const e = err as { status?: number; error?: string; message?: string };
 return NextResponse.json(
 { error: e.error ?? e.message ?? 'Server error' },
 { status: e.status ?? 500 },
 );
 }
}
