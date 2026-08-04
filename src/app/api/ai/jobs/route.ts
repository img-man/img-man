// SPDX-License-Identifier: Apache-2.0
import { NextRequest, NextResponse } from 'next/server';
import { requireSectionAccess } from '@/lib/auth-context';
import { connectToDatabase } from '@/lib/db';
import { AiJob } from '@/models';

/**
 * GET /api/ai/jobs
 * List AI jobs for the current organization.
 * Query params: status, type, page, limit
 */
export async function GET(req: NextRequest) {
 try {
 const ctx = await requireSectionAccess('ai_studio');
 await connectToDatabase();

 const { searchParams } = new URL(req.url);
 const status = searchParams.get('status');
 const type = searchParams.get('type');
 const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
 const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20')));
 const skip = (page - 1) * limit;

 // Build filter
 const filter: Record<string, unknown> = { orgId: ctx.orgId };
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

  return NextResponse.json({
  jobs,
  pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
 } catch (err: unknown) {
 const status = (err as { status?: number }).status ?? 500;
 const message = err instanceof Error ? err.message : String(err);
 return NextResponse.json({ error: message }, { status });
 }
}
