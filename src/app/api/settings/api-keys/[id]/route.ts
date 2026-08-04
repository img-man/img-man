// SPDX-License-Identifier: Apache-2.0
/**
 * DELETE /api/settings/api-keys/[id] — Revoke an API key
 *
 * Auth: Dashboard session (manage_api_keys permission, admin+)
 */

import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth-context';
import { revokeApiKey } from '@/lib/api-keys';

interface RouteContext {
 params: Promise<{ id: string }>;
}

export async function DELETE(_req: Request, ctx: RouteContext) {
 try {
 const { id } = await ctx.params;
 const authCtx = await requirePermission('manage_api_keys');

 const revoked = await revokeApiKey(id, authCtx.orgId);
 if (!revoked) {
 return NextResponse.json(
 { error: 'API key not found or already revoked' },
 { status: 404 },
 );
 }

 return NextResponse.json({ message: 'API key revoked', id });
 } catch (err: unknown) {
 const e = err as { status?: number; error?: string };
 return NextResponse.json(
 { error: e.error ?? 'Internal error' },
 { status: e.status ?? 500 },
 );
 }
}
