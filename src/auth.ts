// SPDX-License-Identifier: Apache-2.0
import GitHub from 'next-auth/providers/github';
import Google from 'next-auth/providers/google';
import Credentials from 'next-auth/providers/credentials';
import { MongoDBAdapter } from '@auth/mongodb-adapter';
import clientPromise from '@/lib/mongodb';
import { compare, hash } from 'bcryptjs';
import { connectToDatabase } from '@/lib/db';
import { OrgMembership, Organization, User } from '@/models';
import type { Session, NextAuthOptions } from 'next-auth';
import type { JWT } from 'next-auth/jwt';

/**
 * First-boot admin. Override both values in `.env` before the first run if you
 * are deploying anywhere reachable — the defaults are published in this repo's
 * documentation, so they are only safe because the account is locked into a
 * forced credential change (`mustChangeCredentials`) until the operator
 * replaces them.
 */
export const BOOTSTRAP_EMAIL = (
  process.env.IMGMAN_BOOTSTRAP_EMAIL || 'admin@img-man.com'
).toLowerCase().trim();
const BOOTSTRAP_PASSWORD =
  process.env.IMGMAN_BOOTSTRAP_PASSWORD || 'Admin@12345';

/** True while the deployment is still on the published default login. */
export const BOOTSTRAP_USES_PUBLISHED_DEFAULTS =
  !process.env.IMGMAN_BOOTSTRAP_EMAIL && !process.env.IMGMAN_BOOTSTRAP_PASSWORD;

async function ensureBootstrapAdminUser() {
 try {
  const existing = await User.findOne({ email: BOOTSTRAP_EMAIL }).lean();
  if (existing) return;

  const passwordHash = await hash(BOOTSTRAP_PASSWORD, 12);
  const user = await User.create({
   name: 'img-man Admin',
   email: BOOTSTRAP_EMAIL,
   passwordHash,
   role: 'owner',
   // Force the operator off the default login before anything else loads.
   mustChangeCredentials: true,
  });

  const slug = `img-man-admin-${Date.now().toString(36)}`;
  const org = await Organization.create({
   name: 'img-man Workspace',
   slug,
   ownerId: user._id,
   storageConfig: {
	provider: 'gcp',
	bucket: process.env.GCP_STORAGE_BUCKET ?? process.env.GCS_BUCKET ?? '',
	isByoc: false,
   },
  });

  user.orgId = org._id;
  await user.save();

  await OrgMembership.create({
   orgId: org._id,
   userId: user._id,
   email: user.email,
   role: 'owner',
   invitedBy: user._id,
   status: 'active',
  });
 } catch (err) {
  // Ignore duplicate-key races when multiple requests bootstrap together.
  if (
   typeof err === 'object' &&
   err !== null &&
   'code' in err &&
   (err as { code?: number }).code === 11000
  ) {
   return;
  }
  throw err;
 }
}

const providers: NextAuthOptions['providers'] = [];

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
 providers.push(
  Google({
   clientId: process.env.GOOGLE_CLIENT_ID,
   clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  }),
 );
}

if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
 providers.push(
  GitHub({
   clientId: process.env.GITHUB_CLIENT_ID,
   clientSecret: process.env.GITHUB_CLIENT_SECRET,
  }),
 );
}

providers.push(
 Credentials({
  name: 'Email & Password',
  credentials: {
   email: { label: 'Email', type: 'email' },
   password: { label: 'Password', type: 'password' },
  },
  async authorize(credentials) {
   if (!credentials?.email || !credentials?.password) return null;

   try {
	await connectToDatabase();

	const normalizedEmail = credentials.email.toLowerCase().trim();
	if (normalizedEmail === BOOTSTRAP_EMAIL) {
	 await ensureBootstrapAdminUser();
	}

	// Explicitly select passwordHash since it's excluded by default
	const user = await User.findOne({ email: normalizedEmail })
	 .select('+passwordHash')
	 .lean();

	if (!user) {
	 console.error(`[Auth] User not found: ${credentials.email}`);
	 return null;
	}

	if (!user.passwordHash) {
	 console.error(
	  `[Auth] No passwordHash for user: ${credentials.email}`,
	 );
	 return null;
	}

	const isValid = await compare(
	 credentials.password,
	 user.passwordHash,
	);
	if (!isValid) {
	 console.error(
	  `[Auth] Invalid password for user: ${credentials.email}`,
	 );
	 return null;
	}

	console.log(
	 `[Auth] Successfully authenticated: ${credentials.email}`,
	);
	return {
	 id: (user._id as string).toString(),
	 name: user.name,
	 email: user.email,
	 image: user.image ?? null,
	};
   } catch (err) {
	console.error(
	 '[Auth] Authorize error:',
	 err instanceof Error ? err.message : err,
	);
	return null;
   }
  },
 }),
);

export const authOptions: NextAuthOptions = {
 adapter: MongoDBAdapter(clientPromise),
 session: { strategy: 'jwt' },
 providers,
 trustHost: true,
 callbacks: {
 session({ session, token }: { session: Session; token: JWT }) {
 if (session.user) {
 session.user.id = token.sub ?? '';
 }
 return session;
 },
 },
 pages: {
 signIn: '/signin',
 },
 logger: {
 // Suppress noisy `JWT_SESSION_ERROR` (decryption failed). This fires
 // whenever a browser presents a NextAuth session cookie signed with a
 // previous NEXTAUTH_SECRET (e.g. dev secret rotation, or when a user
 // visits the embed dashboard with a stale cookie from a different
 // img-man instance). The session simply resolves to null — which is
 // the correct, expected behavior — but the default logger prints a
 // multi-line stack on every /api/auth/session call. Demote to debug.
 error(code, metadata) {
 if (code === 'JWT_SESSION_ERROR') {
 if (process.env.NEXTAUTH_DEBUG === '1') {
 console.debug('[next-auth] JWT_SESSION_ERROR (suppressed):', code);
 }
 return;
 }
 console.error(`[next-auth][${code}]`, metadata);
 },
 warn(code) {
 console.warn(`[next-auth][warn][${code}]`);
 },
 debug(code, metadata) {
 if (process.env.NEXTAUTH_DEBUG === '1') {
 console.debug(`[next-auth][debug][${code}]`, metadata);
 }
 },
 },
};
