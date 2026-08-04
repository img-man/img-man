// SPDX-License-Identifier: Apache-2.0
/**
 * GET /api/v1/ai/jobs/[id] — Check AI job status
 *
 * Auth: API Key (ai)
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { authenticateApiRequest, isErrorResponse, addCorsHeaders } from '@/lib/api-auth';
import { AiJob } from '@/models';

interface RouteContext {
 params: Promise<{ id: string }>;
}

export async function OPTIONS(req: NextRequest) {
 const res = new NextResponse(null, { status: 204 });
 return addCorsHeaders(res, req.headers.get('origin'), []);
}

export async function GET(req: NextRequest, ctx: RouteContext) {
 const { id } = await ctx.params;
 const auth = await authenticateApiRequest(req, 'ai');
 if (isErrorResponse(auth)) return auth;

 await connectToDatabase();

 const job = await AiJob.findOne({ _id: id, orgId: auth.orgId }).lean();
 if (!job) {
 return NextResponse.json(
 { error: 'Job not found', code: 'NOT_FOUND' },
 { status: 404 },
 );
 }

 const res = NextResponse.json({
 job: {
 _id: String(job._id),
 type: job.type,
 status: job.status,
 assetId: job.assetId ? String(job.assetId) : null,
 input: job.input,
 result: job.result,
 error: job.error,
 startedAt: job.startedAt,
 completedAt: job.completedAt,
 createdAt: job.createdAt,
 },
 });
 return addCorsHeaders(res, req.headers.get('origin'), auth.allowedDomains);
}
