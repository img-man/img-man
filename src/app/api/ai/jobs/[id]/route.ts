// SPDX-License-Identifier: Apache-2.0
import { NextRequest, NextResponse } from 'next/server';
import { requireAuthContext } from '@/lib/auth-context';
import { connectToDatabase } from '@/lib/db';
import { AiJob } from '@/models';

/**
 * GET /api/ai/jobs/[id]
 * Get a single AI job's details.
 */
export async function GET(
 _req: NextRequest,
 { params }: { params: Promise<{ id: string }> },
) {
 try {
 const ctx = await requireAuthContext();
 await connectToDatabase();

 const { id } = await params;
 const job = await AiJob.findOne({ _id: id, orgId: ctx.orgId }).lean();
 if (!job) {
 return NextResponse.json({ error: 'Job not found' }, { status: 404 });
 }

 return NextResponse.json({ job });
 } catch (err: unknown) {
 const status = (err as { status?: number }).status ?? 500;
 const message = err instanceof Error ? err.message : String(err);
 return NextResponse.json({ error: message }, { status });
 }
}

/**
 * PATCH /api/ai/jobs/[id]
 * Retry a failed/cancelled job or force-cancel a processing job.
 * Body: { action: 'retry' | 'cancel' }
 */
export async function PATCH(
 req: NextRequest,
 { params }: { params: Promise<{ id: string }> },
) {
 try {
 const ctx = await requireAuthContext();
 await connectToDatabase();

 const { id } = await params;
 const { action } = await req.json().catch(() => ({ action: '' }));

 const job = await AiJob.findOne({ _id: id, orgId: ctx.orgId });
 if (!job) {
 return NextResponse.json({ error: 'Job not found' }, { status: 404 });
 }

 if (action === 'retry') {
 if (job.status !== 'failed') {
 return NextResponse.json(
 { error: 'Can only retry failed jobs' },
 { status: 400 },
 );
 }
 // Reset job to pending so the pipeline can run it again
 job.status = 'pending';
 job.error = undefined;
 job.result = undefined;
 job.completedAt = undefined;
 job.startedAt = undefined;
 await job.save();
 return NextResponse.json({ success: true, job });
 }

 if (action === 'cancel') {
 if (job.status !== 'pending' && job.status !== 'processing') {
 return NextResponse.json(
 { error: 'Can only cancel pending or processing jobs' },
 { status: 400 },
 );
 }
 job.status = 'failed';
 job.error = 'Cancelled by user';
 job.completedAt = new Date();
 await job.save();
 return NextResponse.json({ success: true, job });
 }

 return NextResponse.json({ error: 'Invalid action. Use "retry" or "cancel".' }, { status: 400 });
 } catch (err: unknown) {
 const status = (err as { status?: number }).status ?? 500;
 const message = err instanceof Error ? err.message : String(err);
 return NextResponse.json({ error: message }, { status });
 }
}

/**
 * DELETE /api/ai/jobs/[id]
 * Cancel a pending or processing AI job.
 */
export async function DELETE(
 _req: NextRequest,
 { params }: { params: Promise<{ id: string }> },
) {
 try {
 const ctx = await requireAuthContext();
 await connectToDatabase();

 const { id } = await params;
 const job = await AiJob.findOne({ _id: id, orgId: ctx.orgId });
 if (!job) {
 return NextResponse.json({ error: 'Job not found' }, { status: 404 });
 }

 if (job.status !== 'pending' && job.status !== 'processing') {
 return NextResponse.json(
 { error: 'Can only cancel pending or processing jobs' },
 { status: 400 },
 );
 }

 job.status = 'failed';
 job.error = 'Cancelled by user';
 job.completedAt = new Date();
 await job.save();

 return NextResponse.json({ success: true, job });
 } catch (err: unknown) {
 const status = (err as { status?: number }).status ?? 500;
 const message = err instanceof Error ? err.message : String(err);
 return NextResponse.json({ error: message }, { status });
 }
}
