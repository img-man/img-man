// SPDX-License-Identifier: Apache-2.0
/**
 * AI Job Pipeline
 *
 * Reusable infrastructure for running AI jobs:
 * - Concurrency check → Create job → Execute → Return result
 * - Retry with exponential backoff
 * - Automatic job status management
 */

import { AiJob, Asset, Organization } from '@/models';
import type { IAiJob } from '@/models';
import { checkConcurrency } from './ai-concurrency';
import { requirePermission } from './auth-context';
import { connectToDatabase } from './db';

/* ─── Types ──────────────────────────────────────────────────── */

export interface AiJobInput {
 type: IAiJob['type'];
 assetId?: string; // Optional — not needed for "generate"
  input?: Record<string, unknown>;
}

export interface AiJobResult {
 jobId: string;
 status: 'completed' | 'failed';
 result?: Record<string, unknown>;
 error?: string;
}

type AiExecutor = (params: {
 job: InstanceType<typeof AiJob>;
 asset: InstanceType<typeof Asset> | null;
 orgId: string;
 userId: string;
}) => Promise<Record<string, unknown>>;

/* ─── Retry Helper ───────────────────────────────────────────── */

const MAX_RETRIES = 2;
const BACKOFF_BASE_MS = 1000;

async function withRetry<T>(
 fn: () => Promise<T>,
 retries = MAX_RETRIES,
): Promise<T> {
 for (let attempt = 0; attempt <= retries; attempt++) {
 try {
 return await fn();
 } catch (err) {
 if (attempt === retries) throw err;
 const delay = BACKOFF_BASE_MS * Math.pow(2, attempt);
 await new Promise((r) => setTimeout(r, delay));
 }
 }
 throw new Error('Retry exhausted');
}

/* ─── Pipeline Runner ────────────────────────────────────────── */

/**
 * Run an AI job through the full pipeline:
 * 1. Auth + Permission check
 * 2. Concurrency check
 * 3. Create AiJob record
 * 4. Execute with retry
 * 5. Return result
 */
export async function runAiJob(
  jobInput: AiJobInput,
  executor: AiExecutor,
): Promise<AiJobResult> {
  // 1. Auth
  const ctx = await requirePermission('ai');
  await connectToDatabase();

  // 2. Concurrency
 const concurrency = await checkConcurrency(ctx.orgId);
 if (!concurrency.allowed) {
 throw Object.assign(
 new Error(
 `Too many active AI jobs (${concurrency.active}/${concurrency.limit}). Please wait.`,
 ),
 { status: 429 },
 );
 }

  // 3. Resolve asset (if applicable)
 let asset: InstanceType<typeof Asset> | null = null;
 if (jobInput.assetId) {
 asset = await Asset.findOne({
 _id: jobInput.assetId,
 orgId: ctx.orgId,
 isDeleted: { $ne: true },
 });
 if (!asset) {
 throw Object.assign(new Error('Asset not found'), { status: 404 });
 }
 }

  // 4. Create job
 const job = await AiJob.create({
 orgId: ctx.orgId,
 assetId: jobInput.assetId ?? ctx.userId, // fallback for generate (no asset)
 userId: ctx.userId,
 type: jobInput.type,
 status: 'processing',
 input: jobInput.input ?? {},
 startedAt: new Date(),
 });

 try {
  // 5. Execute with retry
  const result = await withRetry(() =>
  executor({ job, asset, orgId: ctx.orgId, userId: ctx.userId }),
  );

  job.status = 'completed';
 job.result = result;
 job.completedAt = new Date();
 await job.save();

 return {
 jobId: job._id.toString(),
 status: 'completed',
 result,
 };
  } catch (err) {
  job.status = 'failed';
 job.error = err instanceof Error ? err.message : String(err);
 job.completedAt = new Date();
 await job.save();

 return {
 jobId: job._id.toString(),
 status: 'failed',
 error: job.error,
 };
 }
}

/**
 * Lightweight helper — creates a pending job for async tracking
 * without running through the full pipeline (for batch operations).
 */
export async function createPendingJob(
 orgId: string,
 userId: string,
 type: IAiJob['type'],
 assetId: string,
 input?: Record<string, unknown>,
) {
 return AiJob.create({
 orgId,
 assetId,
 userId,
 type,
 status: 'pending',
 input: input ?? {},
 });
}
