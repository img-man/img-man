// SPDX-License-Identifier: Apache-2.0
/**
 * AI Job Concurrency Guard
 *
 * Self-hosted deployments have no plan-based quotas. The only safeguard is a
 * cap on simultaneously active AI jobs so a single org cannot exhaust local
 * CPU/GPU or provider rate limits.
 *
 * Configure with AI_MAX_CONCURRENT_JOBS (default: 3).
 */

import { AiJob } from '@/models';

const DEFAULT_MAX_CONCURRENT = 3;

function resolveLimit(): number {
  const raw = Number(process.env.AI_MAX_CONCURRENT_JOBS);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : DEFAULT_MAX_CONCURRENT;
}

/**
 * Check if the org has too many active AI jobs.
 */
export async function checkConcurrency(orgId: string): Promise<{
  allowed: boolean;
  active: number;
  limit: number;
}> {
  const limit = resolveLimit();
  const active = await AiJob.countDocuments({
    orgId,
    status: { $in: ['pending', 'processing'] },
  });

  return {
    allowed: active < limit,
    active,
    limit,
  };
}
