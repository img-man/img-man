// SPDX-License-Identifier: Apache-2.0
/**
 * Public API AI routes — proxy to internal AI endpoints.
 *
 * POST /api/v1/ai/auto-tag — Trigger auto-tagging
 * POST /api/v1/ai/bg-remove — Remove background
 * POST /api/v1/ai/expand — AI outpainting
 * POST /api/v1/ai/upscale — AI upscale
 * POST /api/v1/ai/generate — Text-to-image generation
 * POST /api/v1/ai/beautify — AI photo enhancement
 * POST /api/v1/ai/remove-object — AI object removal / inpainting
 * POST /api/v1/ai/retouch — AI portrait retouching
 *
 * Auth: API Key (ai)
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest, isErrorResponse, addCorsHeaders } from '@/lib/api-auth';

// Re-export specific AI operations as public API routes
// Each route validates API key with 'ai' permission and forwards to internal logic

export async function OPTIONS(req: NextRequest) {
 const res = new NextResponse(null, { status: 204 });
 return addCorsHeaders(res, req.headers.get('origin'), []);
}

/**
 * POST /api/v1/ai/[operation]
 * Supported: auto-tag, bg-remove, expand, upscale, generate, beautify, remove-object, retouch
 */
export async function POST(
 req: NextRequest,
 ctx: { params: Promise<{ operation: string }> },
) {
 const { operation } = await ctx.params;

 const auth = await authenticateApiRequest(req, 'ai');
 if (isErrorResponse(auth)) return auth;

 const validOps = ['auto-tag', 'bg-remove', 'expand', 'upscale', 'generate', 'beautify', 'remove-object', 'retouch'];
 if (!validOps.includes(operation)) {
 return NextResponse.json(
 { error: `Unknown AI operation: ${operation}`, code: 'VALIDATION_ERROR' },
 { status: 400 },
 );
 }

 // Forward to internal AI endpoint with internal auth bypass header
 const internalUrl = new URL(`/api/ai/${operation}`, req.nextUrl.origin);
 const body = await req.text();

 const internalRes = await fetch(internalUrl, {
 method: 'POST',
 headers: {
 'Content-Type': 'application/json',
 // Pass org context for internal route to use
 'X-Api-OrgId': auth.orgId,
 'X-Api-KeyId': auth.keyId,
 Cookie: req.headers.get('cookie') ?? '',
 },
 body,
 });

 const data = await internalRes.json();
 const res = NextResponse.json(data, { status: internalRes.status });
 return addCorsHeaders(res, req.headers.get('origin'), auth.allowedDomains);
}
