// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, vi, beforeEach } from 'vitest';

/* ── Mock external deps ──────────────────────────────────────── */

vi.mock('@/lib/db', () => ({
 connectToDatabase: vi.fn(),
}));

vi.mock('@/lib/api-keys', () => ({
 verifyApiKey: vi.fn(),
}));

vi.mock('@/lib/rate-limit', () => ({
 checkRateLimit: vi.fn(),
}));

vi.mock('@/models', () => ({
 AccessToken: { findOne: vi.fn() },
 ApiKey: { findOne: vi.fn() },
 OrgMembership: { findOne: vi.fn(), find: vi.fn() },
 MemberGroup: { find: vi.fn() },
}));

import {
 authenticateApiRequest,
 isErrorResponse,
 isOriginAllowed,
 addCorsHeaders,
} from '@/lib/api-auth';
import { verifyApiKey } from '@/lib/api-keys';
import { checkRateLimit } from '@/lib/rate-limit';
import { NextRequest, NextResponse } from 'next/server';

const mockVerify = vi.mocked(verifyApiKey);
const mockRateLimit = vi.mocked(checkRateLimit);

function makeReq(opts: {
 authorization?: string;
 origin?: string;
} = {}): NextRequest {
 const headers: Record<string, string> = {};
 if (opts.authorization) headers['authorization'] = opts.authorization;
 if (opts.origin) headers['origin'] = opts.origin;
 return new NextRequest('http://localhost/api/v1/assets', { headers });
}

const VALID_KEY_RESULT = {
 id: 'key1',
 orgId: 'org1',
 name: 'Test',
 keyPrefix: 'img_abcd1234',
 permissions: ['read', 'write', 'ai'] as ('read' | 'write' | 'delete' | 'transform' | 'ai')[],
 allowedDomains: [] as string[],
 rateLimit: 60,
 folderScope: null as string | null,
};

describe('API Auth Middleware', () => {
 beforeEach(() => {
 vi.clearAllMocks();
 mockRateLimit.mockResolvedValue({
 allowed: true,
 remaining: 59,
 limit: 60,
 retryAfterSeconds: 0,
 });
 });

 describe('authenticateApiRequest', () => {
 it('rejects missing Authorization header', async () => {
 const result = await authenticateApiRequest(makeReq());
 expect(isErrorResponse(result)).toBe(true);
 if (isErrorResponse(result)) {
 expect(result.status).toBe(401);
 }
 });

 it('rejects non-Bearer token', async () => {
 const result = await authenticateApiRequest(
 makeReq({ authorization: 'Basic abc' }),
 );
 expect(isErrorResponse(result)).toBe(true);
 });

 it('rejects invalid API key', async () => {
 mockVerify.mockResolvedValue(null);
 const result = await authenticateApiRequest(
 makeReq({ authorization: 'Bearer img_invalid' }),
 );
 expect(isErrorResponse(result)).toBe(true);
 if (isErrorResponse(result)) {
 expect(result.status).toBe(401);
 }
 });

 it('rejects when key lacks required permission', async () => {
 mockVerify.mockResolvedValue({
 ...VALID_KEY_RESULT,
 permissions: ['read'],
 });
 const result = await authenticateApiRequest(
 makeReq({ authorization: 'Bearer img_valid' }),
 'delete',
 );
 expect(isErrorResponse(result)).toBe(true);
 if (isErrorResponse(result)) {
 expect(result.status).toBe(403);
 }
 });

 it('rejects when rate limit exceeded', async () => {
 mockVerify.mockResolvedValue(VALID_KEY_RESULT);
 mockRateLimit.mockResolvedValue({
 allowed: false,
 remaining: 0,
 limit: 60,
 retryAfterSeconds: 30,
 });
 const result = await authenticateApiRequest(
 makeReq({ authorization: 'Bearer img_valid' }),
 );
 expect(isErrorResponse(result)).toBe(true);
 if (isErrorResponse(result)) {
 expect(result.status).toBe(429);
 expect(result.headers.get('Retry-After')).toBe('30');
 }
 });

 it('returns auth context on success', async () => {
 mockVerify.mockResolvedValue(VALID_KEY_RESULT);
 const result = await authenticateApiRequest(
 makeReq({ authorization: 'Bearer img_valid' }),
 'read',
 );
 expect(isErrorResponse(result)).toBe(false);
 if (!isErrorResponse(result)) {
 expect(result.orgId).toBe('org1');
 expect(result.keyId).toBe('key1');
 expect(result.permissions).toContain('read');
 }
 });

 it('rejects origin not in allowedDomains', async () => {
 mockVerify.mockResolvedValue({
 ...VALID_KEY_RESULT,
 allowedDomains: ['example.com'],
 });
 const result = await authenticateApiRequest(
 makeReq({
 authorization: 'Bearer img_valid',
 origin: 'https://evil.com',
 }),
 );
 expect(isErrorResponse(result)).toBe(true);
 if (isErrorResponse(result)) {
 expect(result.status).toBe(403);
 }
 });

 it('allows matching origin from allowedDomains', async () => {
 mockVerify.mockResolvedValue({
 ...VALID_KEY_RESULT,
 allowedDomains: ['example.com'],
 });
 const result = await authenticateApiRequest(
 makeReq({
 authorization: 'Bearer img_valid',
 origin: 'https://example.com',
 }),
 'read',
 );
 expect(isErrorResponse(result)).toBe(false);
 });
 });

 // ─── isOriginAllowed ────────────────────────────────────────
 describe('isOriginAllowed', () => {
 it('matches exact domain', () => {
 expect(isOriginAllowed('https://example.com', ['example.com'])).toBe(true);
 });

 it('rejects non-matching domain', () => {
 expect(isOriginAllowed('https://evil.com', ['example.com'])).toBe(false);
 });

 it('matches wildcard subdomain', () => {
 expect(
 isOriginAllowed('https://app.acme.com', ['*.acme.com']),
 ).toBe(true);
 });

 it('matches root domain with wildcard', () => {
 expect(
 isOriginAllowed('https://acme.com', ['*.acme.com']),
 ).toBe(true);
 });

 it('rejects invalid URL', () => {
 expect(isOriginAllowed('not-a-url', ['example.com'])).toBe(false);
 });
 });

 // ─── addCorsHeaders ────────────────────────────────────────
 describe('addCorsHeaders', () => {
 it('sets wildcard origin when no domain restrictions', () => {
 const res = new NextResponse(null, { status: 200 });
 addCorsHeaders(res, 'https://any.com', []);
 expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
 });

 it('sets specific origin when domain matches', () => {
 const res = new NextResponse(null, { status: 200 });
 addCorsHeaders(res, 'https://example.com', ['example.com']);
 expect(res.headers.get('Access-Control-Allow-Origin')).toBe(
 'https://example.com',
 );
 });

 it('always sets allow-methods and allow-headers', () => {
 const res = new NextResponse(null, { status: 200 });
 addCorsHeaders(res, null, []);
 expect(res.headers.get('Access-Control-Allow-Methods')).toContain('GET');
 expect(res.headers.get('Access-Control-Allow-Headers')).toContain('Authorization');
 });
 });
});
