// SPDX-License-Identifier: Apache-2.0
/**
 * Hybrid auth: resolves an actor (orgId, userId, role) from EITHER
 * a Bearer token (`imgt_…` access token or `img_…` API key) OR a NextAuth
 * session, in that order.
 *
 * This lets legacy session-based REST routes (e.g. `/api/assets/upload-url`,
 * `/api/assets/confirm`, `/api/assets/thumbnail`) be reused unchanged from the
 * embedded dashboard, where users only have a token (not a NextAuth cookie).
 *
 * Returns a `NextResponse` directly when authentication fails, so callers
 * can `return` the result.
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/api-auth';
import { getSession } from '@/lib/session';
import { connectToDatabase } from '@/lib/db';
import { User } from '@/models';
import type { ApiKeyPermission } from '@/models';
import type { Role } from '@/lib/permissions';

export interface ActorContext {
  orgId: string;
  userId: string;
  email: string;
  role: Role;
}

function isErrorResponse(value: unknown): value is NextResponse {
  return value instanceof NextResponse;
}

/**
 * Resolve the request actor from Bearer token first, then NextAuth session.
 *
 * @param req      Incoming request
 * @param required Optional permission required when authenticating via token
 *                 (mirrors `authenticateApiRequest`)
 */
export async function getActorFromRequest(
  req: NextRequest,
  required?: ApiKeyPermission,
): Promise<ActorContext | NextResponse> {
  const authHeader = req.headers.get('authorization');

  // Token auth (preferred when present — embed flow always sends this)
  if (authHeader?.startsWith('Bearer ')) {
    const apiAuth = await authenticateApiRequest(req, required);
    if (isErrorResponse(apiAuth)) return apiAuth;

    return {
      orgId: apiAuth.orgId,
      userId: apiAuth.userId ?? '',
      email: apiAuth.userEmail ?? '',
      // API keys without a bound user default to editor so they can upload.
      role: ((apiAuth.userRole as Role | undefined) ?? 'editor') as Role,
    };
  }

  // Session fallback (legacy dashboard cookie auth)
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await connectToDatabase();
  const user = await User.findOne({ email: session.user.email }).lean();
  if (!user?.orgId) {
    return NextResponse.json({ error: 'No organization' }, { status: 400 });
  }

  return {
    orgId: (user.orgId as unknown as string).toString(),
    userId: (user._id as unknown as string).toString(),
    email: user.email as string,
    role: ((user.role as Role | undefined) ?? 'viewer') as Role,
  };
}

export function isActorErrorResponse(
  value: ActorContext | NextResponse,
): value is NextResponse {
  return value instanceof NextResponse;
}
