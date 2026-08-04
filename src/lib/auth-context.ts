// SPDX-License-Identifier: Apache-2.0
/**
 * Server-side auth helpers with RBAC.
 * Builds on top of getSession() to add organization & role resolution.
 *
 * Supports two auth modes:
 * 1. Session-based (cookies/getSession) — for dashboard UI
 * 2. API key bearer token — for server-to-server SDK calls
 */

import { NextRequest } from 'next/server';
import { getSession } from '@/lib/session';
import { connectToDatabase } from '@/lib/db';
import { User, OrgMembership, Organization, MemberGroup } from '@/models';
import type { Role, Action } from '@/lib/permissions';
import { canPerform, ROLE_LEVEL } from '@/lib/permissions';
import { verifyApiKey } from '@/lib/api-keys';

export interface AuthContext {
 userId: string;
 email: string;
 name: string;
 orgId: string;
 role: Role;
 accessRules: { path: string; role: Role; resourceType: 'folder' | 'asset' }[];
}

/**
 * Get the authenticated user's context including org and role.
 * Returns null if not authenticated.
 */
export async function getAuthContext(): Promise<AuthContext | null> {
 const session = await getSession();
 if (!session?.user?.email) return null;

 const sessionUser = session.user as Record<string, unknown>;
 const sessionOrgId =
	typeof sessionUser.orgId === 'string' && sessionUser.orgId.trim()
	 ? sessionUser.orgId
	 : null;
 const sessionRole =
	typeof sessionUser.role === 'string' && sessionUser.role.trim()
	 ? (sessionUser.role as Role)
	 : null;
 const sessionUserId =
	typeof sessionUser.id === 'string' && sessionUser.id.trim()
	 ? sessionUser.id
	 : null;

 await connectToDatabase();
 const user = await User.findOne({ email: session.user.email }).lean();
 const effectiveOrgId = user?.orgId
	? String(user.orgId)
	: sessionOrgId;
 if (!effectiveOrgId) return null;

 // Check OrgMembership first (source of truth), fall back to User.role
 const membership = await OrgMembership.findOne({
 orgId: effectiveOrgId,
 email: session.user.email,
 status: 'active',
 }).lean();

 const role: Role =
  (membership?.role as Role) ??
  (user?.role as Role) ??
  sessionRole ??
  'viewer';

 // Extract access rules from membership
 const rawRules = (membership as unknown as { accessRules?: { path: string; role: string; resourceType?: string }[] })?.accessRules ?? [];

 // Merge group access rules (groups this membership belongs to)
 let mergedRules = [...rawRules];
 if (membership?._id) {
 const groups = await MemberGroup.find({
 orgId: effectiveOrgId,
 memberIds: membership._id,
 })
 .select('accessRules')
 .lean();

 for (const g of groups) {
 if (g.accessRules && g.accessRules.length > 0) {
 mergedRules = mergedRules.concat(
 g.accessRules as typeof rawRules,
 );
 }
 }
 }

 return {
 userId: String((user?._id as unknown as string) ?? sessionUserId ?? ''),
 email: session.user.email,
 name: user?.name ?? session.user.name ?? '',
 orgId: effectiveOrgId,
 role,
 accessRules: mergedRules.map((r) => ({
 path: r.path,
 role: r.role as Role,
 resourceType: (r.resourceType ?? 'folder') as 'folder' | 'asset',
 })),
 };
}

/**
 * Require authentication and return context. Throws descriptive object
 * with `status` for API error responses.
 */
export async function requireAuthContext(): Promise<AuthContext> {
 const ctx = await getAuthContext();
 if (!ctx) {
 throw { status: 401, error: 'Unauthorized' };
 }
 return ctx;
}

/**
 * Require authentication AND a specific action permission.
 */
export async function requirePermission(action: Action): Promise<AuthContext> {
 const ctx = await requireAuthContext();
 if (!canPerform(ctx.role, action)) {
 throw { status: 403, error: 'Insufficient permissions' };
 }
 return ctx;
}

/**
 * Require authentication AND access to a specific dashboard section.
 * Checks the org's sectionAccess map against the user's role level.
 * If no section restriction is configured, access is granted.
 */
export async function requireSectionAccess(sectionKey: string): Promise<AuthContext> {
 const ctx = await requireAuthContext();
 await connectToDatabase();

 const org = await Organization.findById(ctx.orgId).select('sectionAccess').lean();
 const sectionAccessMap = (org as unknown as { sectionAccess?: Map<string, number> | Record<string, number> })?.sectionAccess;

 let minRole: number | undefined;
 if (sectionAccessMap instanceof Map) {
 minRole = sectionAccessMap.get(sectionKey);
 } else if (sectionAccessMap && typeof sectionAccessMap === 'object') {
 minRole = (sectionAccessMap as Record<string, number>)[sectionKey];
 }

 if (minRole !== undefined && ROLE_LEVEL[ctx.role] < minRole) {
 throw { status: 403, error: `Access to ${sectionKey} is restricted for your role` };
 }

 return ctx;
}

/**
 * Lightweight section access check for legacy routes that already have orgId and role.
 * Returns true if access is denied.
 */
export async function isSectionRestricted(
 orgId: string,
 role: Role,
 sectionKey: string,
): Promise<boolean> {
 const org = await Organization.findById(orgId).select('sectionAccess').lean();
 const sectionAccessMap = (org as unknown as { sectionAccess?: Map<string, number> | Record<string, number> })?.sectionAccess;

 let minRole: number | undefined;
 if (sectionAccessMap instanceof Map) {
 minRole = sectionAccessMap.get(sectionKey);
 } else if (sectionAccessMap && typeof sectionAccessMap === 'object') {
 minRole = (sectionAccessMap as Record<string, number>)[sectionKey];
 }

 if (minRole !== undefined && ROLE_LEVEL[role] < minRole) {
 return true;
 }

 return false;
}

// ─── API Key → AuthContext Bridge ────────────────────────────────────────────

/**
 * Resolve an AuthContext from an API key Bearer token.
 * API keys represent the organization-level admin identity.
 * Only keys with 'write' permission are granted 'owner' role.
 *
 * Returns null if no valid API key is found in the request header.
 */
async function getAuthContextFromApiKey(req: NextRequest): Promise<AuthContext | null> {
 const authHeader = req.headers.get('authorization');
 if (!authHeader?.startsWith('Bearer img_')) return null;

 const token = authHeader.slice(7).trim();

 try {
 const keyData = await verifyApiKey(token);
 if (!keyData) return null;

 // API keys must have write permission for team management
 if (!keyData.permissions.includes('write')) return null;

 // Build an AuthContext representing the API key as an owner-level identity.
 // The "user" is synthetic — it represents the API key itself.
 return {
 userId: `apikey:${keyData.id}`,
 email: `apikey-${keyData.name}@imageman.internal`,
 name: keyData.name,
 orgId: keyData.orgId,
 role: 'owner' as Role,
 accessRules: [],
 };
 } catch {
 return null;
 }
}

/**
 * Require authentication from EITHER session cookies OR an API key Bearer token.
 * Tries session auth first, falls back to API key auth.
 *
 * Use this in routes that need to support both:
 * - Dashboard UI (session cookies)
 * - Server-to-server SDK calls (API key Bearer token)
 *
 * @param req The NextRequest object (needed to read Authorization header)
 */
export async function requireAuthContextOrApiKey(req: NextRequest): Promise<AuthContext> {
 // Try session auth first
 const sessionCtx = await getAuthContext();
 if (sessionCtx) return sessionCtx;

 // Fall back to API key auth
 const apiKeyCtx = await getAuthContextFromApiKey(req);
 if (apiKeyCtx) return apiKeyCtx;

 throw { status: 401, error: 'Unauthorized' };
}

/**
 * Require authentication (session or API key) AND a specific action permission.
 */
export async function requirePermissionOrApiKey(
 req: NextRequest,
 action: Action,
): Promise<AuthContext> {
 const ctx = await requireAuthContextOrApiKey(req);
 if (!canPerform(ctx.role, action)) {
 throw { status: 403, error: 'Insufficient permissions' };
 }
 return ctx;
}

/**
 * Require authentication (session or API key) AND access to a specific section.
 */
export async function requireSectionAccessOrApiKey(
 req: NextRequest,
 sectionKey: string,
): Promise<AuthContext> {
 const ctx = await requireAuthContextOrApiKey(req);
 await connectToDatabase();

 const org = await Organization.findById(ctx.orgId).select('sectionAccess').lean();
 const sectionAccessMap = (org as unknown as { sectionAccess?: Map<string, number> | Record<string, number> })?.sectionAccess;

 let minRole: number | undefined;
 if (sectionAccessMap instanceof Map) {
 minRole = sectionAccessMap.get(sectionKey);
 } else if (sectionAccessMap && typeof sectionAccessMap === 'object') {
 minRole = (sectionAccessMap as Record<string, number>)[sectionKey];
 }

 if (minRole !== undefined && ROLE_LEVEL[ctx.role] < minRole) {
 throw { status: 403, error: `Access to ${sectionKey} is restricted for your role` };
 }

 return ctx;
}
