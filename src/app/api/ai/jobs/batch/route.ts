// SPDX-License-Identifier: Apache-2.0
import { NextRequest, NextResponse } from 'next/server';
import { requireAuthContext } from '@/lib/auth-context';
import { connectToDatabase } from '@/lib/db';
import { AiJob } from '@/models';

/**
 * POST /api/ai/jobs/batch
 * Batch operations on AI jobs by status.
 *
 * Body:
 * { action: 'retry' | 'cancel' | 'clear', status?: string }
 *
 * - retry: Reset all failed jobs to 'pending'
 * - cancel: Force-cancel all pending/processing jobs
 * - clear: Delete all jobs matching the given status (or 'failed' by default)
 */
export async function POST(req: NextRequest) {
 try {
 const ctx = await requireAuthContext();
 await connectToDatabase();

 const { action, status } = await req.json().catch(() => ({ action: '', status: '' }));

 if (action === 'retry') {
 // Retry all failed jobs → set back to pending
 const result = await AiJob.updateMany(
 { orgId: ctx.orgId, status: 'failed' },
 {
 $set: { status: 'pending' },
 $unset: { error: 1, result: 1, completedAt: 1, startedAt: 1 },
 },
 );
 return NextResponse.json({ success: true, modified: result.modifiedCount });
 }

 if (action === 'cancel') {
 // Cancel all pending + processing jobs
 const filter: Record<string, unknown> = {
 orgId: ctx.orgId,
 status: { $in: ['pending', 'processing'] },
 };
 const result = await AiJob.updateMany(filter, {
 $set: { status: 'failed', error: 'Cancelled by user (batch)', completedAt: new Date() },
 });
 return NextResponse.json({ success: true, modified: result.modifiedCount });
 }

 if (action === 'clear') {
 // Delete jobs by status
 const targetStatus = status || 'failed';
 const allowed = ['failed', 'completed', 'pending'];
 if (!allowed.includes(targetStatus)) {
 return NextResponse.json(
 { error: `Cannot clear jobs with status "${targetStatus}". Allowed: ${allowed.join(', ')}` },
 { status: 400 },
 );
 }
 const result = await AiJob.deleteMany({ orgId: ctx.orgId, status: targetStatus });
 return NextResponse.json({ success: true, deleted: result.deletedCount });
 }

 return NextResponse.json(
 { error: 'Invalid action. Use "retry", "cancel", or "clear".' },
 { status: 400 },
 );
 } catch (err: unknown) {
 const status = (err as { status?: number }).status ?? 500;
 const message = err instanceof Error ? err.message : String(err);
 return NextResponse.json({ error: message }, { status });
 }
}
