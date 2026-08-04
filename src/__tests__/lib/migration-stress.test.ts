// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import {
  buildSyntheticMigrationKey,
  runResumeAfterKillSimulation,
  runSyntheticMigrationBatches,
} from '@/lib/migration-stress';

describe('migration stress helpers', () => {
  it('builds deterministic synthetic object keys', () => {
    expect(buildSyntheticMigrationKey(0)).toContain('tenant-0/archive/');
    expect(buildSyntheticMigrationKey(12345)).toMatch(/asset-\d{6}-\d{9}\.jpg$/);
    expect(buildSyntheticMigrationKey(12345)).toBe(buildSyntheticMigrationKey(12345));
  });

  it('processes batches and reports cursor progress', () => {
    const result = runSyntheticMigrationBatches({
      totalObjects: 10_000,
      batchSize: 500,
      maxBatches: 3,
    });

    expect(result.objectsProcessed).toBe(1_500);
    expect(result.nextIndex).toBe(1_500);
    expect(result.batchesProcessed).toBe(3);
    expect(result.completed).toBe(false);
    expect(result.lastKey).toBe(buildSyntheticMigrationKey(1_499));
  });

  it('resumes from checkpoint after simulated kill and finishes exactly once', () => {
    const summary = runResumeAfterKillSimulation({
      totalObjects: 250_000,
      batchSize: 1_000,
      killAfterBatches: 57,
    });

    expect(summary.firstPass.completed).toBe(false);
    expect(summary.resumedFromIndex).toBe(57_000);
    expect(summary.finalProcessedObjects).toBe(250_000);
    expect(summary.completed).toBe(true);
    expect(summary.secondPass.lastKey).toBe(buildSyntheticMigrationKey(249_999));
  });
});