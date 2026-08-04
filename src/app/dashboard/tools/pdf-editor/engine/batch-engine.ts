// SPDX-License-Identifier: Apache-2.0
/**
 * Batch Processing Engine — Phase 4, Week 14
 *
 * Manages a queue of PDF batch operations with progress tracking,
 * pause/resume/cancel support, and concurrent execution control.
 *
 * Architecture: Pure state machine + event emitter pattern.
 * Actual file processing is delegated to batch-operations.ts.
 */

import type {
  BatchJob,
  BatchFileEntry,
  BatchOperationType,
  BatchJobStatus,
} from '../types';
import {
  MAX_BATCH_FILES,
  MAX_BATCH_FILE_SIZE,
  BATCH_CONCURRENT_LIMIT,
} from '../constants';

/* ──────────────────────── Job Creation ──────────────────────── */

let _jobCounter = 0;

/**
 * Create a new batch job from a list of files.
 */
export function createBatchJob(
  operation: BatchOperationType,
  files: File[],
  config: Record<string, unknown> = {},
): BatchJob {
  _jobCounter++;
  const jobId = `batch-${Date.now()}-${_jobCounter}`;

  const fileEntries: BatchFileEntry[] = files.map((file, i) => ({
    id: `${jobId}-file-${i}`,
    file,
    fileName: file.name,
    fileSize: file.size,
    status: 'queued' as BatchJobStatus,
    progress: 0,
  }));

  return {
    id: jobId,
    operation,
    files: fileEntries,
    createdAt: new Date(),
    overallProgress: 0,
    status: 'queued',
    config,
  };
}

/* ──────────────────────── Validation ──────────────────────── */

/**
 * Validate files before creating a batch job.
 */
export function validateBatchFiles(files: File[]): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (files.length === 0) {
    errors.push('No files selected.');
  }

  if (files.length > MAX_BATCH_FILES) {
    errors.push(
      `Maximum ${MAX_BATCH_FILES} files allowed. You selected ${files.length}.`,
    );
  }

  const oversized = files.filter((f) => f.size > MAX_BATCH_FILE_SIZE);
  if (oversized.length > 0) {
    errors.push(
      `${oversized.length} file(s) exceed the ${MAX_BATCH_FILE_SIZE / (1024 * 1024)} MB limit: ${oversized.map((f) => f.name).join(', ')}`,
    );
  }

  const nonPdf = files.filter((f) => !f.name.toLowerCase().endsWith('.pdf'));
  if (nonPdf.length > 0) {
    warnings.push(
      `${nonPdf.length} file(s) may not be PDF: ${nonPdf.map((f) => f.name).join(', ')}`,
    );
  }

  const totalSize = files.reduce((sum, f) => sum + f.size, 0);
  if (totalSize > 500 * 1024 * 1024) {
    warnings.push(
      `Total batch size is ${Math.round(totalSize / (1024 * 1024))} MB. This may take a while.`,
    );
  }

  return { valid: errors.length === 0, errors, warnings };
}

/* ──────────────────────── Job State Management ──────────────────────── */

/**
 * Calculate the overall progress of a batch job.
 */
export function calculateOverallProgress(files: BatchFileEntry[]): number {
  if (files.length === 0) return 0;
  const total = files.reduce((sum, f) => sum + f.progress, 0);
  return Math.round(total / files.length);
}

/**
 * Determine the overall status of a batch job from its files' statuses.
 */
export function deriveJobStatus(files: BatchFileEntry[]): BatchJobStatus {
  if (files.length === 0) return 'queued';

  const allCompleted = files.every((f) => f.status === 'completed');
  if (allCompleted) return 'completed';

  const anyProcessing = files.some((f) => f.status === 'processing');
  if (anyProcessing) return 'processing';

  const allFailed = files.every((f) => f.status === 'failed');
  if (allFailed) return 'failed';

  const anyCancelled = files.some((f) => f.status === 'cancelled');
  const allDone = files.every(
    (f) =>
      f.status === 'completed' ||
      f.status === 'failed' ||
      f.status === 'cancelled',
  );
  if (allDone && anyCancelled) return 'cancelled';
  if (allDone) return 'completed';

  const anyPaused = files.some((f) => f.status === 'paused');
  if (anyPaused) return 'paused';

  return 'queued';
}

/**
 * Update a single file entry within a batch job.
 * Returns a new job object (immutable update).
 */
export function updateFileEntry(
  job: BatchJob,
  fileId: string,
  update: Partial<BatchFileEntry>,
): BatchJob {
  const files = job.files.map((f) =>
    f.id === fileId ? { ...f, ...update } : f,
  );

  return {
    ...job,
    files,
    overallProgress: calculateOverallProgress(files),
    status: deriveJobStatus(files),
    completedAt:
      deriveJobStatus(files) === 'completed' ? new Date() : job.completedAt,
  };
}

/**
 * Mark a file as failed with an error message.
 */
export function markFileFailed(
  job: BatchJob,
  fileId: string,
  error: string,
): BatchJob {
  return updateFileEntry(job, fileId, { status: 'failed', error, progress: 0 });
}

/**
 * Mark a file as completed with a result URL.
 */
export function markFileCompleted(
  job: BatchJob,
  fileId: string,
  resultUrl: string,
  resultSize: number,
): BatchJob {
  return updateFileEntry(job, fileId, {
    status: 'completed',
    progress: 100,
    resultUrl,
    resultSize,
  });
}

/**
 * Pause all queued/processing files in a batch.
 */
export function pauseJob(job: BatchJob): BatchJob {
  const files = job.files.map((f) => {
    if (f.status === 'queued' || f.status === 'processing') {
      return { ...f, status: 'paused' as BatchJobStatus };
    }
    return f;
  });

  return {
    ...job,
    files,
    status: 'paused',
    overallProgress: calculateOverallProgress(files),
  };
}

/**
 * Resume paused files in a batch.
 */
export function resumeJob(job: BatchJob): BatchJob {
  const files = job.files.map((f) => {
    if (f.status === 'paused') {
      return { ...f, status: 'queued' as BatchJobStatus };
    }
    return f;
  });

  return {
    ...job,
    files,
    status: 'queued',
    overallProgress: calculateOverallProgress(files),
  };
}

/**
 * Cancel all non-completed files in a batch.
 */
export function cancelJob(job: BatchJob): BatchJob {
  const files = job.files.map((f) => {
    if (f.status !== 'completed') {
      return { ...f, status: 'cancelled' as BatchJobStatus, progress: 0 };
    }
    return f;
  });

  return {
    ...job,
    files,
    status: 'cancelled',
    overallProgress: calculateOverallProgress(files),
  };
}

/**
 * Retry all failed files in a batch.
 */
export function retryFailed(job: BatchJob): BatchJob {
  const files = job.files.map((f) => {
    if (f.status === 'failed') {
      return {
        ...f,
        status: 'queued' as BatchJobStatus,
        progress: 0,
        error: undefined,
      };
    }
    return f;
  });

  return {
    ...job,
    files,
    status: 'queued',
    overallProgress: calculateOverallProgress(files),
    completedAt: undefined,
  };
}

/* ──────────────────────── Queue Scheduling ──────────────────────── */

/**
 * Get the next files eligible for processing (respects concurrency limit).
 */
export function getNextProcessableFiles(
  job: BatchJob,
  concurrentLimit = BATCH_CONCURRENT_LIMIT,
): BatchFileEntry[] {
  const processing = job.files.filter((f) => f.status === 'processing').length;
  const available = concurrentLimit - processing;
  if (available <= 0) return [];

  return job.files.filter((f) => f.status === 'queued').slice(0, available);
}

/* ──────────────────────── Statistics ──────────────────────── */

/**
 * Get statistics for a batch job.
 */
export function getBatchStats(job: BatchJob): {
  total: number;
  completed: number;
  failed: number;
  processing: number;
  queued: number;
  paused: number;
  cancelled: number;
  totalInputSize: number;
  totalOutputSize: number;
} {
  const stats = {
    total: job.files.length,
    completed: 0,
    failed: 0,
    processing: 0,
    queued: 0,
    paused: 0,
    cancelled: 0,
    totalInputSize: 0,
    totalOutputSize: 0,
  };

  for (const f of job.files) {
    stats.totalInputSize += f.fileSize;
    stats[f.status]++;
    if (f.resultSize) stats.totalOutputSize += f.resultSize;
  }

  return stats;
}

/**
 * Format a duration in milliseconds to a human-readable string.
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const remainSecs = secs % 60;
  if (mins < 60) return `${mins}m ${remainSecs}s`;
  const hours = Math.floor(mins / 60);
  const remainMins = mins % 60;
  return `${hours}h ${remainMins}m`;
}
