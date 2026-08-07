// SPDX-License-Identifier: Apache-2.0
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { User, OrgMembership, ApiKey, AccessToken, Organization } from '@/models';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import type { Role } from '@/lib/permissions';
import { addCorsHeaders } from '@/lib/api-auth';

type WhiteLabelDefaultRole = Extract<Role, 'editor' | 'viewer'>;

function normalizeWhiteLabelDefaultRole(value: unknown): WhiteLabelDefaultRole {
  return value === 'viewer' ? 'viewer' : 'editor';
}

function normalizeEmail(value?: string) {
  return value?.toLowerCase().trim() || undefined;
}

function normalizePhone(value?: string) {
  return value?.replace(/[^+\d]/g, '').trim() || undefined;
}

function normalizeAllowedEmailDomain(value: string) {
  const normalized = value.trim().toLowerCase().replace(/^@+/, '');
  if (!normalized) return null;
  return /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(normalized) ? normalized : null;
}

function normalizeAllowedEmailDomains(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  const unique = new Set<string>();
  for (const value of values) {
    if (typeof value !== 'string') continue;
    const normalized = normalizeAllowedEmailDomain(value);
    if (normalized) unique.add(normalized);
  }
  return Array.from(unique);
}

function emailMatchesAllowedDomains(email: string, allowedDomains: string[]) {
  const [, domainPart = ''] = email.toLowerCase().split('@');
  return allowedDomains.some((allowedDomain) => (
    domainPart === allowedDomain || domainPart.endsWith(`.${allowedDomain}`)
  ));
}

function deriveDisplayName(
  name: string | undefined,
  normalizedEmail?: string,
  normalizedPhone?: string,
  inviteName?: string,
) {
  return (
    name?.trim() ||
    inviteName?.trim() ||
    normalizedEmail?.split('@')[0] ||
    normalizedPhone ||
    'User'
  );
}

/** Read the org API key from `Authorization: Bearer img_…`, if present. */
function apiKeyFromHeader(req: NextRequest): string | undefined {
  const header = req.headers.get('authorization');
  if (!header?.toLowerCase().startsWith('bearer ')) return undefined;
  const value = header.slice(7).trim();
  return value.startsWith('img_') ? value : undefined;
}

/**
 * POST /api/v1/auth/token
 * Generate an access token for a user based on API key + user credentials (email or phone)
 *
 * The org API key may be sent either as `Authorization: Bearer img_…` (preferred)
 * or as an `apiKey` body field. The header wins when both are present.
 *
 * Request Body:
 * {
 *   apiKey?: string;         // The organization's API key (img_...) — or use the header
 *   email?: string;          // User's email (at least one of email or phone required)
 *   phone?: string;          // User's phone number
 *   expiresIn?: string;      // Token expiry: '1h', '24h', '7d', '30d' (default: '24h')
 * }
 *
 * Response:
 * {
 *   success: true,
 *   accessToken: string;     // The access token to use in subsequent requests
 *   user: { id, email, name, role },
 *   org: { id, name },
 *   expiresAt: Date;
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      apiKey: bodyApiKey,
      email,
      phone,
      name,
      expiresIn = '24h',
    } = body as {
      apiKey?: string;
      email?: string;
      phone?: string;
      name?: string;
      expiresIn?: string;
    };

    const apiKey = apiKeyFromHeader(req) ?? bodyApiKey;

    // Validate input
    if (!apiKey) {
      const res = NextResponse.json(
        {
          error:
            'Missing API key. Send it as "Authorization: Bearer img_…" or as an "apiKey" body field.',
        },
        { status: 400 },
      );
      return addCorsHeaders(res, req.headers.get('origin'), []);
    }

    if (!email && !phone) {
      const res = NextResponse.json(
        { error: 'At least one of email or phone is required' },
        { status: 400 },
      );
      return addCorsHeaders(res, req.headers.get('origin'), []);
    }

    await connectToDatabase();

    // Find and validate API key
    if (!apiKey.startsWith('img_')) {
      const res = NextResponse.json(
        { error: 'Invalid API key format' },
        { status: 401 },
      );
      return addCorsHeaders(res, req.headers.get('origin'), []);
    }

    const keyPrefix = apiKey.substring(0, 12); // img_ + first 8 hex chars
    const apiKeyDoc = await ApiKey.findOne({ keyPrefix }).select('+keyHash');

    if (!apiKeyDoc) {
      const res = NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
      return addCorsHeaders(res, req.headers.get('origin'), []);
    }

    // Verify API key hash
    const isValidKey = await bcrypt.compare(apiKey, apiKeyDoc.keyHash);
    if (!isValidKey) {
      const res = NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
      return addCorsHeaders(res, req.headers.get('origin'), []);
    }

    // Check if API key is revoked or expired
    if (apiKeyDoc.isRevoked) {
      const res = NextResponse.json(
        { error: 'API key has been revoked' },
        { status: 401 },
      );
      return addCorsHeaders(res, req.headers.get('origin'), []);
    }

    if (apiKeyDoc.expiresAt && apiKeyDoc.expiresAt < new Date()) {
      const res = NextResponse.json(
        { error: 'API key has expired' },
        { status: 401 },
      );
      return addCorsHeaders(res, req.headers.get('origin'), []);
    }

    const normalizedEmail = normalizeEmail(email);
    const normalizedPhone = normalizePhone(phone);

    const org = await Organization.findById(apiKeyDoc.orgId)
      .select('embedConfig')
      .lean();

    if (!org) {
      const res = NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 },
      );
      return addCorsHeaders(res, req.headers.get('origin'), []);
    }

    const defaultNewUserRole = normalizeWhiteLabelDefaultRole(
      (org as { embedConfig?: { defaultNewUserRole?: unknown } } | null)?.embedConfig?.defaultNewUserRole,
    );
    const allowedEmailDomains = normalizeAllowedEmailDomains(
      (org as { embedConfig?: { allowedEmailDomains?: unknown } } | null)?.embedConfig?.allowedEmailDomains,
    );

    const userLookupClauses = [
      ...(normalizedEmail ? [{ email: normalizedEmail }] : []),
      ...(normalizedPhone ? [{ phone: normalizedPhone }] : []),
    ];

    let user = userLookupClauses.length > 0
      ? await User.findOne(
          userLookupClauses.length === 1 ? userLookupClauses[0] : { $or: userLookupClauses },
        )
      : null;

    const membershipLookupClauses = [
      ...(user?._id ? [{ userId: user._id }] : []),
      ...(normalizedEmail ? [{ email: normalizedEmail }] : []),
      ...(normalizedPhone ? [{ phone: normalizedPhone }] : []),
    ];

    let membership = membershipLookupClauses.length > 0
      ? await OrgMembership.findOne({
          orgId: apiKeyDoc.orgId,
          $or: membershipLookupClauses,
          status: 'active',
        })
      : null;

    const displayName = deriveDisplayName(
      name,
      normalizedEmail,
      normalizedPhone,
      (membership as { inviteName?: string } | null)?.inviteName,
    );

    if (
      !membership
      && normalizedEmail
      && allowedEmailDomains.length > 0
      && !emailMatchesAllowedDomains(normalizedEmail, allowedEmailDomains)
    ) {
      const res = NextResponse.json(
        {
          error: `Email domain is not allowed for automatic white-label provisioning. Allowed domains: ${allowedEmailDomains.map((domain) => `@${domain}`).join(', ')}`,
        },
        { status: 403 },
      );
      return addCorsHeaders(res, req.headers.get('origin'), []);
    }

    if (!user) {
      if (!normalizedEmail) {
        const res = NextResponse.json(
          {
            error:
              'Email is required to automatically provision a brand-new white-label user',
          },
          { status: 400 },
        );
        return addCorsHeaders(res, req.headers.get('origin'), []);
      }

      user = await User.create({
        name: displayName,
        email: normalizedEmail,
        phone: normalizedPhone,
        orgId: apiKeyDoc.orgId,
        role: (membership?.role as Role | undefined) ?? defaultNewUserRole,
      });
    }

    if (!membership) {
      const cleanupClauses = [
        ...(normalizedEmail ? [{ email: normalizedEmail }] : []),
        ...(normalizedPhone ? [{ phone: normalizedPhone }] : []),
      ];

      if (cleanupClauses.length > 0) {
        await OrgMembership.deleteMany({
          orgId: apiKeyDoc.orgId,
          $or: cleanupClauses,
          status: { $in: ['pending', 'revoked'] },
        });
      }

      membership = await OrgMembership.create({
        orgId: apiKeyDoc.orgId,
        userId: user._id,
        email: normalizedEmail ?? user.email,
        phone: normalizedPhone ?? user.phone,
        inviteName: displayName,
        role: defaultNewUserRole,
        invitedBy: apiKeyDoc.createdById,
        status: 'active',
        accessRules: [],
      });
    } else if (membership.userId == null) {
      await OrgMembership.findByIdAndUpdate(membership._id, {
        userId: user._id,
        ...(normalizedEmail ? { email: normalizedEmail } : {}),
        ...(normalizedPhone ? { phone: normalizedPhone } : {}),
      });
    }

    // Parse expiry duration
    const expiryMs = parseExpiryDuration(expiresIn);
    if (!expiryMs) {
      const res = NextResponse.json(
        { error: 'Invalid expiresIn format. Use: 1h, 24h, 7d, 30d' },
        { status: 400 },
      );
      return addCorsHeaders(res, req.headers.get('origin'), []);
    }

    const expiresAt = new Date(Date.now() + expiryMs);

    // Generate access token (crypto random + timestamp for uniqueness)
    const token = `imgt_${crypto.randomBytes(48).toString('hex')}`;
    const tokenHash = await bcrypt.hash(token, 10);

    // Get device info and IP
    const userAgent = req.headers.get('user-agent') || undefined;
    const ipAddress =
      req.headers.get('x-forwarded-for') ||
      req.headers.get('x-real-ip') ||
      undefined;

    // Create access token record
    await AccessToken.create({
      token,
      tokenHash,
      userId: user._id,
      orgId: apiKeyDoc.orgId,
      apiKeyId: apiKeyDoc._id,
      email: user.email,
      phone: user.phone,
      role: membership.role,
      expiresAt,
      isActive: true,
      deviceInfo: userAgent,
      ipAddress,
    });

    // Update API key last used timestamp
    await ApiKey.findByIdAndUpdate(apiKeyDoc._id, { lastUsedAt: new Date() });

    const res = NextResponse.json({
      success: true,
      accessToken: token,
      user: {
        id: user._id.toString(),
        email: user.email,
        phone: user.phone,
        name: user.name,
        role: membership.role,
      },
      org: {
        id: apiKeyDoc.orgId.toString(),
      },
      expiresAt,
    });
    return addCorsHeaders(res, req.headers.get('origin'), []);
  } catch (err: unknown) {
    const e = err as { message?: string };
    console.error('Access token generation error:', e);
    const res = NextResponse.json(
      { error: e.message ?? 'Failed to generate access token' },
      { status: 500 },
    );
    return addCorsHeaders(res, req.headers.get('origin'), []);
  }
}

/**
 * DELETE /api/v1/auth/token
 * Revoke an access token
 *
 * Headers:
 * Authorization: Bearer <accessToken>
 */
export async function DELETE(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      const res = NextResponse.json(
        { error: 'Missing or invalid authorization header' },
        { status: 401 },
      );
      return addCorsHeaders(res, req.headers.get('origin'), []);
    }

    const token = authHeader.substring(7);

    await connectToDatabase();

    const accessToken = await AccessToken.findOne({ token });

    if (!accessToken) {
      const res = NextResponse.json(
        { error: 'Invalid access token' },
        { status: 401 },
      );
      return addCorsHeaders(res, req.headers.get('origin'), []);
    }

    // Revoke the token
    await AccessToken.findByIdAndUpdate(accessToken._id, { isActive: false });

    const res = NextResponse.json({
      success: true,
      message: 'Access token revoked successfully',
    });
    return addCorsHeaders(res, req.headers.get('origin'), []);
  } catch (err: unknown) {
    const e = err as { message?: string };
    console.error('Access token revocation error:', e);
    const res = NextResponse.json(
      { error: e.message ?? 'Failed to revoke access token' },
      { status: 500 },
    );
    return addCorsHeaders(res, req.headers.get('origin'), []);
  }
}

/**
 * Parse expiry duration string to milliseconds
 * Examples: '1h' -> 3600000, '7d' -> 604800000
 */
function parseExpiryDuration(expiresIn: string): number | null {
  const match = expiresIn.match(/^(\d+)([hdwm])$/);
  if (!match) return null;

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 'h':
      return value * 60 * 60 * 1000;
    case 'd':
      return value * 24 * 60 * 60 * 1000;
    case 'w':
      return value * 7 * 24 * 60 * 60 * 1000;
    case 'm':
      return value * 30 * 24 * 60 * 60 * 1000;
    default:
      return null;
  }
}

export async function OPTIONS(req: NextRequest) {
  const res = new NextResponse(null, { status: 204 });
  return addCorsHeaders(res, req.headers.get('origin'), []);
}
