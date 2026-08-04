// SPDX-License-Identifier: Apache-2.0
import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth-context';
import { connectToDatabase } from '@/lib/db';
import {
  MIGRATION_CONTROL_ACTIONS,
  serializeMigrationJobForApi,
  transitionMigrationStatus,
  type MigrationControlAction,
} from '@/lib/migrations';
import { MigrationJob } from '@/models';

/**
 * GET /api/migrations/[id]
 * Fetch a single migration job.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requirePermission('manage_settings');
    await connectToDatabase();

    const { id } = await params;
    const job = await MigrationJob.findOne({ _id: id, orgId: ctx.orgId }).lean();

    if (!job) {
      return NextResponse.json({ error: 'Migration job not found' }, { status: 404 });
    }

    return NextResponse.json({ job: serializeMigrationJobForApi(job) });
  } catch (err: unknown) {
    const e = err as { status?: number; error?: string; message?: string };
    return NextResponse.json(
      { error: e.error ?? e.message ?? 'Server error' },
      { status: e.status ?? 500 },
    );
  }
}

/**
 * PATCH /api/migrations/[id]
 * Control a migration job lifecycle.
 * Body: { action: 'queue-dry-run' | 'start' | 'pause' | 'resume' | 'cancel' }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requirePermission('manage_settings');
    await connectToDatabase();

    const { id } = await params;
    const { action } = (await req.json().catch(() => ({ action: '' }))) as {
      action?: MigrationControlAction;
    };

    if (!action || !MIGRATION_CONTROL_ACTIONS.includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Use "queue-dry-run", "start", "pause", "resume", or "cancel".' },
        { status: 400 },
      );
    }

    const job = await MigrationJob.findOne({ _id: id, orgId: ctx.orgId });
    if (!job) {
      return NextResponse.json({ error: 'Migration job not found' }, { status: 404 });
    }

    const nextStatus = transitionMigrationStatus(job.status, action);
    if (!nextStatus) {
      return NextResponse.json(
        { error: `Cannot ${action} a job in status "${job.status}".` },
        { status: 400 },
      );
    }

    job.status = nextStatus;

    if (action === 'start' || action === 'resume') {
      job.startedAt = job.startedAt ?? new Date();
      job.completedAt = undefined;
    }

    if (action === 'cancel') {
      job.completedAt = new Date();
    }

    await job.save();

    return NextResponse.json({ success: true, job: serializeMigrationJobForApi(job) });
  } catch (err: unknown) {
    const e = err as { status?: number; error?: string; message?: string };
    return NextResponse.json(
      { error: e.error ?? e.message ?? 'Server error' },
      { status: e.status ?? 500 },
    );
  }
}