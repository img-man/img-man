// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import {
  createEmptyMigrationCounts,
  estimateMigrationCost,
  getMigrationProviderRuntime,
  normalizeMigrationPrefix,
  projectMigrationFolders,
  summarizeMigrationVerification,
  transitionMigrationStatus,
} from '@/lib/migrations';

describe('migration helpers', () => {
  it('normalizes prefixes into slash-terminated relative paths', () => {
    expect(normalizeMigrationPrefix(' /marketing/summer// ')).toBe('marketing/summer/');
    expect(normalizeMigrationPrefix('')).toBe('');
  });

  it('builds zeroed counts with overrides', () => {
    expect(createEmptyMigrationCounts({ discovered: 12, foldersProjected: 3 })).toEqual({
      scanned: 0,
      discovered: 12,
      imported: 0,
      skipped: 0,
      errored: 0,
      foldersProjected: 3,
      foldersCreated: 0,
    });
  });

  it('requires explicit confirmation once dry runs exceed the 1k safety threshold', () => {
    expect(
      estimateMigrationCost({ estimatedObjects: 1250, averageMetadataReadsPerObject: 1 }),
    ).toMatchObject({
      estimatedObjects: 1250,
      listOperations: 2,
      getOperations: 1250,
      requiresConfirmation: true,
    });
  });

  it('projects nested folder prefixes from sample object keys', () => {
    expect(
      projectMigrationFolders(
        [
          'marketing/2026/spring/hero.png',
          'marketing/2026/spring/social/card.png',
          'other/root.png',
        ],
        'marketing/',
      ),
    ).toEqual([
      'marketing/2026/',
      'marketing/2026/spring/',
      'marketing/2026/spring/social/',
    ]);
  });

  it('summarizes verification deltas and preserves sample signed urls', () => {
    expect(
      summarizeMigrationVerification({
        bucketObjectCount: 120,
        mongoAssetCount: 115,
        sampledSignedUrls: ['https://signed.example/1'],
      }),
    ).toEqual({
      bucketObjectCount: 120,
      mongoAssetCount: 115,
      delta: 5,
      sampledSignedUrls: ['https://signed.example/1'],
      verifiedAt: undefined,
    });
  });

  it('tracks provider availability for dry-run and live migrations', () => {
    expect(getMigrationProviderRuntime('gcp')).toMatchObject({
      dryRunStatus: 'available',
      liveRunStatus: 'available',
    });
    expect(getMigrationProviderRuntime('azure')).toMatchObject({
      dryRunStatus: 'planned',
      liveRunStatus: 'planned',
    });
  });

  it('allows only valid migration lifecycle transitions', () => {
    expect(transitionMigrationStatus('draft', 'queue-dry-run')).toBe('dry_run_pending');
    expect(transitionMigrationStatus('draft', 'start')).toBe('running');
    expect(transitionMigrationStatus('running', 'pause')).toBe('paused');
    expect(transitionMigrationStatus('paused', 'resume')).toBe('running');
    expect(transitionMigrationStatus('completed', 'cancel')).toBeNull();
  });
});