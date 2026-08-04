// SPDX-License-Identifier: Apache-2.0
/**
 * GET /api/v1/ai/jobs — List AI jobs for the organization
 *
 * Auth: API Key or Access Token (ai permission)
 * Query params: status, type, page, limit
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { authenticateApiRequest, isErrorResponse, addCorsHeaders } from '@/lib/api-auth';
import { AiJob } from '@/models';

export async function OPTIONS(req: NextRequest) {
 const res = new NextResponse(null, { status: 204 });
 return addCorsHeaders(res, req.headers.get('origin'), []);
}

export async function GET(req: NextRequest) {
 const auth = await authenticateApiRequest(req, 'ai');
 if (isErrorResponse(auth)) return auth;

 await connectToDatabase();

 const { searchParams } = req.nextUrl;
 const status = searchParams.get('status');
 const type = searchParams.get('type');
 const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
 const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20')));
 const skip = (page - 1) * limit;

 // Build filter
 const filter: Record<string, unknown> = { orgId: auth.orgId };
 if (status) filter.status = status;
 if (type) filter.type = type;

  const [jobs, total] = await Promise.all([
  AiJob.find(filter)
  .sort({ createdAt: -1 })
  .skip(skip)
  .limit(limit)
  .lean(),
  AiJob.countDocuments(filter),
  ]);

  const res = NextResponse.json({
  jobs,
  pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
 return addCorsHeaders(res, req.headers.get('origin'), auth.allowedDomains);
}
