// SPDX-License-Identifier: Apache-2.0
/**
 * Tests for batch-engine.ts — Phase 4
 *
 * Covers createBatchJob, validateBatchFiles, calculateOverallProgress,
 * deriveJobStatus, updateFileEntry, markFileFailed, markFileCompleted,
 * pauseJob, resumeJob, cancelJob, retryFailed, getNextProcessableFiles,
 * getBatchStats, formatDuration
 */

import { describe, it, expect } from 'vitest';
import {
  createBatchJob,
  validateBatchFiles,
  calculateOverallProgress,
  deriveJobStatus,
  updateFileEntry,
  markFileFailed,
  markFileCompleted,
  pauseJob,
  resumeJob,
  cancelJob,
  retryFailed,
  getNextProcessableFiles,
  getBatchStats,
  formatDuration,
} from '@/app/dashboard/tools/pdf-editor/engine/batch-engine';
import type {
  BatchFileEntry,
  BatchJobStatus,
  BatchJob,
} from '@/app/dashboard/tools/pdf-editor/types';

/* ──────────────── Helper ──────────────── */

function createMockFile(name: string, size: number): File {
  return new File(['x'.repeat(Math.min(size, 100))], name, {
    type: 'application/pdf',
  });
}

function makeEntry(
  id: string,
  status: BatchJobStatus = 'queued',
  progress = 0,
): BatchFileEntry {
  return {
    id,
    file: createMockFile(`${id}.pdf`, 1000),
    fileName: `${id}.pdf`,
    fileSize: 1000,
    status,
    progress,
  };
}

function makeJob(
  files: BatchFileEntry[],
  overrides: Partial<BatchJob> = {},
): BatchJob {
  return {
    id: 'test-job',
    operation: 'compress',
    files,
    createdAt: new Date(),
    overallProgress: calculateOverallProgress(files),
    status: deriveJobStatus(files),
    config: {},
    ...overrides,
  };
}

/* ──────────────── Job Creation ──────────────── */

describe('createBatchJob', () => {
  it('creates a batch job with correct fields', () => {
    const files = [createMockFile('a.pdf', 500), createMockFile('b.pdf', 1000)];
    const job = createBatchJob('compress', files, { quality: 75 });

    expect(job.id).toMatch(/^batch-/);
    expect(job.operation).toBe('compress');
    expect(job.files).toHaveLength(2);
    expect(job.status).toBe('queued');
    expect(job.overallProgress).toBe(0);
    expect(job.config).toEqual({ quality: 75 });
  });

  it('assigns unique IDs to file entries', () => {
    const files = [createMockFile('a.pdf', 100), createMockFile('b.pdf', 200)];
    const job = createBatchJob('merge', files);
    expect(job.files[0].id).not.toBe(job.files[1].id);
  });

  it('preserves file metadata', () => {
    const files = [createMockFile('test.pdf', 5000)];
    const job = createBatchJob('flatten', files);
    expect(job.files[0].fileName).toBe('test.pdf');
    expect(job.files[0].status).toBe('queued');
    expect(job.files[0].progress).toBe(0);
  });
});

/* ──────────────── Validation ──────────────── */

describe('validateBatchFiles', () => {
  it('validates empty file list', () => {
    const result = validateBatchFiles([]);
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
  });

  it('passes valid PDF files', () => {
    const files = [createMockFile('a.pdf', 1000)];
    const result = validateBatchFiles(files);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('warns about non-PDF files', () => {
    const files = [new File(['x'], 'image.png', { type: 'image/png' })];
    const result = validateBatchFiles(files);
    // Non-PDF generates warning, not error
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});

/* ──────────────── Progress Calculation ──────────────── */

describe('calculateOverallProgress', () => {
  it('returns 0 for empty array', () => {
    expect(calculateOverallProgress([])).toBe(0);
  });

  it('returns average of file progress', () => {
    const files = [
      makeEntry('a', 'completed', 100),
      makeEntry('b', 'processing', 50),
    ];
    expect(calculateOverallProgress(files)).toBe(75);
  });

  it('returns 100 when all complete', () => {
    const files = [
      makeEntry('a', 'completed', 100),
      makeEntry('b', 'completed', 100),
    ];
    expect(calculateOverallProgress(files)).toBe(100);
  });
});

/* ──────────────── Status Derivation ──────────────── */

describe('deriveJobStatus', () => {
  it('returns queued for empty files', () => {
    expect(deriveJobStatus([])).toBe('queued');
  });

  it('returns completed when all files completed', () => {
    const files = [makeEntry('a', 'completed'), makeEntry('b', 'completed')];
    expect(deriveJobStatus(files)).toBe('completed');
  });

  it('returns processing when any file is processing', () => {
    const files = [makeEntry('a', 'completed'), makeEntry('b', 'processing')];
    expect(deriveJobStatus(files)).toBe('processing');
  });

  it('returns failed when all files failed', () => {
    const files = [makeEntry('a', 'failed'), makeEntry('b', 'failed')];
    expect(deriveJobStatus(files)).toBe('failed');
  });

  it('returns paused when any file is paused', () => {
    const files = [makeEntry('a', 'paused'), makeEntry('b', 'queued')];
    expect(deriveJobStatus(files)).toBe('paused');
  });

  it('returns cancelled when all done and some cancelled', () => {
    const files = [makeEntry('a', 'completed'), makeEntry('b', 'cancelled')];
    expect(deriveJobStatus(files)).toBe('cancelled');
  });
});

/* ──────────────── File Entry Updates ──────────────── */

describe('updateFileEntry', () => {
  it('updates a single file while keeping others', () => {
    const job = makeJob([makeEntry('a', 'queued'), makeEntry('b', 'queued')]);
    const updated = updateFileEntry(job, 'a', {
      status: 'processing',
      progress: 50,
    });
    expect(updated.files[0].status).toBe('processing');
    expect(updated.files[0].progress).toBe(50);
    expect(updated.files[1].status).toBe('queued');
  });

  it('recalculates overall progress', () => {
    const job = makeJob([
      makeEntry('a', 'completed', 100),
      makeEntry('b', 'queued', 0),
    ]);
    const updated = updateFileEntry(job, 'b', {
      progress: 50,
      status: 'processing',
    });
    expect(updated.overallProgress).toBe(75);
  });
});

describe('markFileFailed', () => {
  it('sets status to failed with error', () => {
    const job = makeJob([makeEntry('a', 'processing', 50)]);
    const updated = markFileFailed(job, 'a', 'Network error');
    expect(updated.files[0].status).toBe('failed');
    expect(updated.files[0].error).toBe('Network error');
    expect(updated.files[0].progress).toBe(0);
  });
});

describe('markFileCompleted', () => {
  it('sets status to completed with result info', () => {
    const job = makeJob([makeEntry('a', 'processing', 90)]);
    const updated = markFileCompleted(job, 'a', 'https://cdn/result.pdf', 5000);
    expect(updated.files[0].status).toBe('completed');
    expect(updated.files[0].progress).toBe(100);
    expect(updated.files[0].resultUrl).toBe('https://cdn/result.pdf');
    expect(updated.files[0].resultSize).toBe(5000);
  });
});

/* ──────────────── Job Controls ──────────────── */

describe('pauseJob', () => {
  it('pauses queued and processing files', () => {
    const job = makeJob([
      makeEntry('a', 'processing', 50),
      makeEntry('b', 'queued', 0),
      makeEntry('c', 'completed', 100),
    ]);
    const paused = pauseJob(job);
    expect(paused.status).toBe('paused');
    expect(paused.files[0].status).toBe('paused');
    expect(paused.files[1].status).toBe('paused');
    expect(paused.files[2].status).toBe('completed'); // completed stays
  });
});

describe('resumeJob', () => {
  it('resumes paused files to queued', () => {
    const job = makeJob([
      makeEntry('a', 'paused'),
      makeEntry('b', 'paused'),
      makeEntry('c', 'completed', 100),
    ]);
    const resumed = resumeJob(job);
    expect(resumed.files[0].status).toBe('queued');
    expect(resumed.files[1].status).toBe('queued');
    expect(resumed.files[2].status).toBe('completed');
  });
});

describe('cancelJob', () => {
  it('cancels all non-completed files', () => {
    const job = makeJob([
      makeEntry('a', 'processing', 50),
      makeEntry('b', 'queued'),
      makeEntry('c', 'completed', 100),
    ]);
    const cancelled = cancelJob(job);
    expect(cancelled.status).toBe('cancelled');
    expect(cancelled.files[0].status).toBe('cancelled');
    expect(cancelled.files[1].status).toBe('cancelled');
    expect(cancelled.files[2].status).toBe('completed');
  });
});

describe('retryFailed', () => {
  it('resets failed files to queued', () => {
    const job = makeJob([
      makeEntry('a', 'failed'),
      makeEntry('b', 'completed', 100),
    ]);
    // Manually set error on the failed entry
    job.files[0].error = 'Previous error';

    const retried = retryFailed(job);
    expect(retried.files[0].status).toBe('queued');
    expect(retried.files[0].error).toBeUndefined();
    expect(retried.files[1].status).toBe('completed');
  });
});

/* ──────────────── Queue Scheduling ──────────────── */

describe('getNextProcessableFiles', () => {
  it('returns queued files up to concurrency limit', () => {
    const job = makeJob([
      makeEntry('a', 'queued'),
      makeEntry('b', 'queued'),
      makeEntry('c', 'queued'),
      makeEntry('d', 'queued'),
    ]);
    const next = getNextProcessableFiles(job, 2);
    expect(next).toHaveLength(2);
    expect(next[0].id).toBe('a');
    expect(next[1].id).toBe('b');
  });

  it('accounts for currently processing files', () => {
    const job = makeJob([
      makeEntry('a', 'processing', 50),
      makeEntry('b', 'processing', 30),
      makeEntry('c', 'queued'),
    ]);
    const next = getNextProcessableFiles(job, 2);
    // 2 already processing, limit=2 → 0 available
    expect(next).toHaveLength(0);
  });

  it('returns empty when no queued files', () => {
    const job = makeJob([makeEntry('a', 'completed', 100)]);
    expect(getNextProcessableFiles(job)).toHaveLength(0);
  });
});

/* ──────────────── Statistics ──────────────── */

describe('getBatchStats', () => {
  it('counts all statuses correctly', () => {
    const job = makeJob([
      makeEntry('a', 'completed', 100),
      makeEntry('b', 'failed'),
      makeEntry('c', 'processing', 60),
      makeEntry('d', 'queued'),
    ]);
    const stats = getBatchStats(job);
    expect(stats.total).toBe(4);
    expect(stats.completed).toBe(1);
    expect(stats.failed).toBe(1);
    expect(stats.processing).toBe(1);
    expect(stats.queued).toBe(1);
  });

  it('sums input sizes', () => {
    const job = makeJob([makeEntry('a'), makeEntry('b')]);
    const stats = getBatchStats(job);
    expect(stats.totalInputSize).toBe(2000); // 1000 each
  });
});

/* ──────────────── Format Duration ──────────────── */

describe('formatDuration', () => {
  it('formats milliseconds', () => {
    expect(formatDuration(500)).toBe('500ms');
  });

  it('formats seconds', () => {
    expect(formatDuration(5000)).toBe('5s');
  });

  it('formats minutes and seconds', () => {
    expect(formatDuration(125000)).toBe('2m 5s');
  });

  it('formats hours', () => {
    expect(formatDuration(3661000)).toBe('1h 1m');
  });
});
