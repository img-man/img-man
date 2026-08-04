// SPDX-License-Identifier: Apache-2.0
import { getServerSession } from 'next-auth';
import { headers } from 'next/headers';
import { authOptions } from '@/auth';
import { connectToDatabase } from '@/lib/db';
import { AccessToken, User } from '@/models';

/**
 * Returns the current user session.
 *
 * Supports two auth modes:
 * 1. NextAuth session (cookies) — primary / dashboard UI
 * 2. Bearer access token (imgt_...) — fallback for embedded dashboard
 *
 * When an access token is presented and valid, a session-compatible object
 * is returned so existing API routes work without modification.
 */
export async function getSession() {
 // 1. Prefer Bearer access token (imgt_...) when provided.
 // This is critical for /embed/dashboard because same-origin cookie sessions
 // may belong to a different user/org than the embed token context.
 try {
 const headersList = await headers();
 const authHeader = headersList.get('authorization');
 if (!authHeader?.startsWith('Bearer imgt_')) {
  // 2. Fallback to NextAuth session (dashboard UI flow)
  const session = await getServerSession(authOptions);
  if (session?.user?.email) return session;
  return null;
 }

 const token = authHeader.slice(7).trim();

 await connectToDatabase();

 const accessToken = await AccessToken.findOne({ token, isActive: true }).lean();
 if (!accessToken) return null;

 // Check expiry
 if (accessToken.expiresAt && new Date(accessToken.expiresAt) < new Date()) return null;

 // Resolve email (from token or linked user)
 let email = (accessToken as Record<string, unknown>).email as string | null;
 let name: string | null = null;
 let image: string | null = null;

 if (!email && accessToken.userId) {
 const user = await User.findById(accessToken.userId)
 .select('email name image')
 .lean();
 if (user) {
 email = user.email;
 name = user.name;
 image = (user as Record<string, unknown>).image as string | null;
 }
 }

 if (!email) return null;

 // Update lastUsedAt in background (don't await)
 AccessToken.findByIdAndUpdate(accessToken._id, { lastUsedAt: new Date() }).catch(() => {});

 // Return a session-compatible object
 return {
 user: {
	 id: accessToken.userId ? String(accessToken.userId) : undefined,
 email,
 name: name ?? email,
 image: image ?? undefined,
	 orgId: accessToken.orgId ? String(accessToken.orgId) : undefined,
	 role: (accessToken as Record<string, unknown>).role as string | undefined,
 },
 expires: accessToken.expiresAt
 ? new Date(accessToken.expiresAt).toISOString()
 : new Date(Date.now() + 86400000).toISOString(),
 };
 } catch {
 // If anything fails in the token path, return null (session not found)
 return null;
 }
}

export async function requireAuth() {
 const session = await getSession();
 if (!session?.user) {
 throw new Error('Unauthorized');
 }
 return session;
}
