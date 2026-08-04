// SPDX-License-Identifier: Apache-2.0
/**
 * GET /api/settings/api-keys — List all API keys for the org
 * POST /api/settings/api-keys — Create a new API key
 *
 * Auth: Dashboard session (manage_api_keys permission, admin+)
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth-context';
import { createApiKey, listApiKeys } from '@/lib/api-keys';
import type { ApiKeyPermission } from '@/models';

export async function GET() {
 try {
 const ctx = await requirePermission('manage_api_keys');
 const keys = await listApiKeys(ctx.orgId);

 return NextResponse.json({
 keys: keys.map((k) => ({
 _id: String(k._id),
 name: k.name,
 keyPrefix: k.keyPrefix,
 permissions: k.permissions,
 allowedDomains: k.allowedDomains,
 rateLimit: k.rateLimit,
 lastUsedAt: k.lastUsedAt,
 expiresAt: k.expiresAt,
 isRevoked: k.isRevoked,
 createdAt: k.createdAt,
 })),
 });
 } catch (err: unknown) {
 const e = err as { status?: number; error?: string };
 return NextResponse.json(
 { error: e.error ?? 'Internal error' },
 { status: e.status ?? 500 },
 );
 }
}

export async function POST(req: NextRequest) {
 try {
 const ctx = await requirePermission('manage_api_keys');
 const body = await req.json();

 const { name, permissions, allowedDomains, rateLimit, expiresInDays, folderScope } = body;

 if (!name || typeof name !== 'string' || !name.trim()) {
 return NextResponse.json(
 { error: 'name is required' },
 { status: 400 },
 );
 }

 const validPermissions: ApiKeyPermission[] = [
 'read',
 'write',
 'delete',
 'transform',
 'ai',
 ];
 const perms: ApiKeyPermission[] = Array.isArray(permissions)
 ? permissions.filter((p: string) =>
 validPermissions.includes(p as ApiKeyPermission),
 )
 : ['read'];

 if (perms.length === 0) {
 return NextResponse.json(
 { error: 'At least one valid permission is required' },
 { status: 400 },
 );
 }

 const expiresAt = expiresInDays
 ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
 : undefined;

 const result = await createApiKey({
 orgId: ctx.orgId,
 name: name.trim(),
 permissions: perms,
 allowedDomains: Array.isArray(allowedDomains)
 ? allowedDomains.filter((d: unknown) => typeof d === 'string')
 : [],
 rateLimit: typeof rateLimit === 'number' ? rateLimit : 60,
 folderScope: typeof folderScope === 'string' ? folderScope : undefined,
 expiresAt,
 createdById: ctx.userId,
 });

 return NextResponse.json(
 {
 // Include plaintext key — SHOWN ONLY ONCE
 plaintext: result.plaintext,
 apiKey: result.apiKey,
 },
 { status: 201 },
 );
 } catch (err: unknown) {
 const e = err as { status?: number; error?: string };
 return NextResponse.json(
 { error: e.error ?? 'Internal error' },
 { status: e.status ?? 500 },
 );
 }
}
