// SPDX-License-Identifier: Apache-2.0
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function proxy(request: NextRequest) {
 const token = await getToken({
 req: request,
 secret: process.env.NEXTAUTH_SECRET,
 });

 const { pathname } = request.nextUrl;

 // Allow auth-related routes and public pages to pass through
 if (
 pathname.startsWith('/api/auth') ||
 pathname.startsWith('/signin') ||
 pathname.startsWith('/api/health')
 ) {
 return NextResponse.next();
 }

 // Allow embed routes (they handle their own token-based auth)
 if (pathname.startsWith('/embed/')) {
 return NextResponse.next();
 }

 // Allow requests with Bearer access tokens (imgt_...) through
 // These are validated by the API route handlers / getSession() fallback
 const authHeader = request.headers.get('authorization');
 const hasAccessToken = authHeader?.startsWith('Bearer imgt_');

 // Protected routes: redirect to sign-in if not authenticated
 if (!token && !hasAccessToken) {
 const signInUrl = new URL('/signin', request.url);
 signInUrl.searchParams.set('callbackUrl', pathname);
 return NextResponse.redirect(signInUrl);
 }

 return NextResponse.next();
}

export const config = {
 matcher: ['/dashboard/:path*', '/api/assets/:path*', '/api/folders/:path*'],
};
