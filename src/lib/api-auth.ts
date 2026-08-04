// SPDX-License-Identifier: Apache-2.0
/**
 * API Authentication middleware for public REST API (v1).
 *
 * Validates `Authorization: Bearer <token>` header, supporting both:
 * - API Keys (img_...) - for server-to-server or long-lived access
 * - Access Tokens (imgt_...) - for user-authenticated access
 *
 * Resolves org context, checks permissions, and enforces rate limits.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyApiKey } from '@/lib/api-keys';
import { checkRateLimit } from '@/lib/rate-limit';
import type { ApiKeyPermission } from '@/models';
import { connectToDatabase } from '@/lib/db';
import { AccessToken, ApiKey } from '@/models';

export interface ApiAuthContext {
  keyId: string;
  orgId: string;
  keyName: string;
  permissions: ApiKeyPermission[];
  allowedDomains: string[];
  rateLimit: number;
  folderScope?: string; // Folder ID — restricts all operations to this subtree
  userId?: string; // Only present for access token auth
  userEmail?: string;
  userRole?: string;
}

/**
 * Extract bearer token from request.
 */
function extractBearerToken(req: NextRequest): string | null {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  return authHeader.slice(7).trim();
}

/**
 * Add dynamic CORS headers based on the API key's allowedDomains.
 */
export function addCorsHeaders(
  response: NextResponse,
  origin: string | null,
  allowedDomains: string[],
): NextResponse {
  // If no domain restrictions, allow any origin
  if (allowedDomains.length === 0) {
    response.headers.set('Access-Control-Allow-Origin', '*');
  } else if (origin && isOriginAllowed(origin, allowedDomains)) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Vary', 'Origin');
  }

  response.headers.set(
    'Access-Control-Allow-Methods',
    'GET, POST, PATCH, DELETE, OPTIONS',
  );
  response.headers.set(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization',
  );
  response.headers.set('Access-Control-Max-Age', '86400');

  return response;
}

/**
 * Check if an origin matches allowed domains (supports wildcard subdomains).
 */
export function isOriginAllowed(
  origin: string,
  allowedDomains: string[],
): boolean {
  try {
    const originHost = new URL(origin).hostname;
    return allowedDomains.some((domain) => {
      if (domain.startsWith('*.')) {
        const base = domain.slice(2);
        return originHost === base || originHost.endsWith(`.${base}`);
      }
      return originHost === domain;
    });
  } catch {
    return false;
  }
}

/**
 * Authenticate an API request. Returns the auth context or a NextResponse error.
 * Supports both API keys (img_...) and access tokens (imgt_...).
 */
export async function authenticateApiRequest(
  req: NextRequest,
  requiredPermission?: ApiKeyPermission,
): Promise<ApiAuthContext | NextResponse> {
  const token = extractBearerToken(req);
  if (!token) {
    return NextResponse.json(
      {
        error: 'Missing or invalid Authorization header',
        code: 'AUTH_REQUIRED',
      },
      { status: 401 },
    );
  }

  // Determine token type: API key (img_) or access token (imgt_)
  if (token.startsWith('imgt_')) {
    // Access Token authentication
    return await authenticateWithAccessToken(token, requiredPermission, req);
  } else if (token.startsWith('img_')) {
    // API Key authentication
    return await authenticateWithApiKey(token, requiredPermission, req);
  }

  return NextResponse.json(
    { error: 'Invalid token format', code: 'INVALID_TOKEN' },
    { status: 401 },
  );
}

/**
 * Authenticate using an access token (imgt_...)
 */
async function authenticateWithAccessToken(
  token: string,
  requiredPermission: ApiKeyPermission | undefined,
  req: NextRequest,
): Promise<ApiAuthContext | NextResponse> {
  await connectToDatabase();

  const accessToken = await AccessToken.findOne({ token }).populate('apiKeyId');

  if (!accessToken) {
    return NextResponse.json(
      { error: 'Invalid access token', code: 'INVALID_TOKEN' },
      { status: 401 },
    );
  }

  // Check if token is active
  if (!accessToken.isActive) {
    return NextResponse.json(
      { error: 'Access token has been revoked', code: 'TOKEN_REVOKED' },
      { status: 401 },
    );
  }

  // Check if token is expired
  if (accessToken.expiresAt < new Date()) {
    return NextResponse.json(
      { error: 'Access token has expired', code: 'TOKEN_EXPIRED' },
      { status: 401 },
    );
  }

  // Get the associated API key to check permissions
  const apiKey = await ApiKey.findById(accessToken.apiKeyId);
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Associated API key not found', code: 'INVALID_TOKEN' },
      { status: 401 },
    );
  }

  // Check if API key is still valid
  if (apiKey.isRevoked) {
    return NextResponse.json(
      { error: 'Associated API key has been revoked', code: 'KEY_REVOKED' },
      { status: 401 },
    );
  }

  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
    return NextResponse.json(
      { error: 'Associated API key has expired', code: 'KEY_EXPIRED' },
      { status: 401 },
    );
  }

  // Check domain restrictions (from API key)
  const origin = req.headers.get('origin');
  if (apiKey.allowedDomains.length > 0 && origin) {
    if (!isOriginAllowed(origin, apiKey.allowedDomains)) {
      return NextResponse.json(
        { error: 'Origin not allowed', code: 'FORBIDDEN' },
        { status: 403 },
      );
    }
  }

  // Check permission (from API key)
  if (requiredPermission && !apiKey.permissions.includes(requiredPermission)) {
    return NextResponse.json(
      {
        error: `Access token lacks '${requiredPermission}' permission`,
        code: 'FORBIDDEN',
      },
      { status: 403 },
    );
  }

  // Check rate limit (per user + org)
  const rateResult = await checkRateLimit(
    `accesstoken:${accessToken.userId}:${accessToken.orgId}`,
    apiKey.rateLimit,
  );
  if (!rateResult.allowed) {
    const res = NextResponse.json(
      { error: 'Rate limit exceeded', code: 'RATE_LIMITED' },
      { status: 429 },
    );
    res.headers.set('Retry-After', String(rateResult.retryAfterSeconds));
    res.headers.set('X-RateLimit-Limit', String(apiKey.rateLimit));
    res.headers.set('X-RateLimit-Remaining', '0');
    return res;
  }

  // Update last used timestamp
  await AccessToken.findByIdAndUpdate(accessToken._id, {
    lastUsedAt: new Date(),
  });

  return {
    keyId: apiKey._id.toString(),
    orgId: accessToken.orgId.toString(),
    keyName: apiKey.name,
    permissions: apiKey.permissions,
    allowedDomains: apiKey.allowedDomains,
    rateLimit: apiKey.rateLimit,
    folderScope: apiKey.folderScope ?? undefined,
    userId: accessToken.userId.toString(),
    userEmail: accessToken.email,
    userRole: accessToken.role,
  };
}

/**
 * Authenticate using an API key (img_...)
 */
async function authenticateWithApiKey(
  token: string,
  requiredPermission: ApiKeyPermission | undefined,
  req: NextRequest,
): Promise<ApiAuthContext | NextResponse> {
  const apiKey = await verifyApiKey(token);
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Invalid API key', code: 'INVALID_KEY' },
      { status: 401 },
    );
  }

  // Check domain restrictions
  const origin = req.headers.get('origin');
  if (apiKey.allowedDomains.length > 0 && origin) {
    if (!isOriginAllowed(origin, apiKey.allowedDomains)) {
      return NextResponse.json(
        { error: 'Origin not allowed', code: 'FORBIDDEN' },
        { status: 403 },
      );
    }
  }

  // Check permission
  if (requiredPermission && !apiKey.permissions.includes(requiredPermission)) {
    return NextResponse.json(
      {
        error: `API key lacks '${requiredPermission}' permission`,
        code: 'FORBIDDEN',
      },
      { status: 403 },
    );
  }

  // Check rate limit
  const rateResult = await checkRateLimit(
    `apikey:${apiKey.id}`,
    apiKey.rateLimit,
  );
  if (!rateResult.allowed) {
    const res = NextResponse.json(
      { error: 'Rate limit exceeded', code: 'RATE_LIMITED' },
      { status: 429 },
    );
    res.headers.set('Retry-After', String(rateResult.retryAfterSeconds));
    res.headers.set('X-RateLimit-Limit', String(apiKey.rateLimit));
    res.headers.set('X-RateLimit-Remaining', '0');
    return res;
  }

  return {
    keyId: apiKey.id,
    orgId: apiKey.orgId,
    keyName: apiKey.name,
    permissions: apiKey.permissions,
    allowedDomains: apiKey.allowedDomains,
    rateLimit: apiKey.rateLimit,
    folderScope: apiKey.folderScope ?? undefined,
  };
}

/**
 * Convenience: returns true if the value is a NextResponse (error case).
 */
export function isErrorResponse(
  result: ApiAuthContext | NextResponse,
): result is NextResponse {
  return result instanceof NextResponse;
}

/**
 * Apply folder scope constraints to a filter query.
 * If the API key has a folderScope, restricts queries to that folder subtree.
 */
export async function applyFolderScope(
  auth: ApiAuthContext,
  filter: Record<string, unknown>,
  type: 'asset' | 'folder',
): Promise<NextResponse | null> {
  if (!auth.folderScope) return null;

  const { Folder } = await import('@/models');

  const scopedFolder = await Folder.findOne({
    _id: auth.folderScope,
    orgId: auth.orgId,
  }).lean();

  if (!scopedFolder) {
    return NextResponse.json(
      { error: 'Folder scope target not found', code: 'SCOPE_ERROR' },
      { status: 403 },
    );
  }

  const descendantFolders = await Folder.find({
    orgId: auth.orgId,
    $or: [
      { _id: auth.folderScope },
      { path: { $regex: `^${scopedFolder.path}/` } },
    ],
  })
    .select('_id')
    .lean();

  const scopedFolderIds = descendantFolders.map((folder) =>
    (folder._id as unknown as string).toString(),
  );

  if (type === 'asset') {
    if (filter.folderId) {
      if (!scopedFolderIds.includes(String(filter.folderId))) {
        return NextResponse.json(
          {
            error: 'Requested folder is outside the API key scope',
            code: 'SCOPE_ERROR',
          },
          { status: 403 },
        );
      }
    } else {
      filter.folderId = { $in: scopedFolderIds };
    }
  } else {
    filter._id = { $in: scopedFolderIds };
  }

  return null;
}
