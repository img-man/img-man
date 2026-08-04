// SPDX-License-Identifier: Apache-2.0
/**
 * useBatchProcessor Hook — Phase 4, Week 14
 *
 * React hook that manages batch processing state and orchestrates
 * file-by-file execution with concurrency control.
 */

'use client';

import { useState, useCallback, useRef } from 'react';
import type { BatchJob, BatchFileEntry, BatchJobStatus } from '../types';
import {
  getNextProcessableFiles,
  updateFileEntry,
  markFileCompleted,
  markFileFailed,
  pauseJob,
  resumeJob,
  cancelJob,
  retryFailed,
} from '../engine/batch-engine';

/* ──────────────────────── Types ──────────────────────── */

/**
 * A processor function that handles a single file.
 * Receives the file entry and a progress callback.
 * Must return a result URL and size on success.
 */
export type FileProcessor = (
  file: BatchFileEntry,
  onProgress: (progress: number) => void,
) => Promise<{ resultUrl: string; resultSize: number }>;

interface UseBatchProcessorReturn {
  job: BatchJob | null;
  isProcessing: boolean;

  startBatch: (job: BatchJob, processor: FileProcessor) => void;
  pause: () => void;
  resume: () => void;
  cancel: () => void;
  retry: () => void;
  clear: () => void;
}

/* ──────────────────────── Hook ──────────────────────── */

export function useBatchProcessor(): UseBatchProcessorReturn {
  const [job, setJob] = useState<BatchJob | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const processorRef = useRef<FileProcessor | null>(null);
  const abortRef = useRef(false);

  /**
   * Process the next eligible files from the queue.
   * Runs concurrently up to the batch limit.
   */
  const processQueue = useCallback(async (currentJob: BatchJob) => {
    if (abortRef.current) return;

    const nextFiles = getNextProcessableFiles(currentJob);
    if (nextFiles.length === 0) {
      setIsProcessing(false);
      return;
    }

    // Mark files as processing
    let updatedJob = currentJob;
    for (const file of nextFiles) {
      updatedJob = updateFileEntry(updatedJob, file.id, {
        status: 'processing' as BatchJobStatus,
        progress: 0,
      });
    }
    setJob(updatedJob);

    // Process files concurrently
    const promises = nextFiles.map(async (file) => {
      try {
        if (!processorRef.current) throw new Error('No processor defined');

        const result = await processorRef.current(file, (progress) => {
          // Update progress inline
          setJob((prev) => {
            if (!prev) return prev;
            return updateFileEntry(prev, file.id, { progress });
          });
        });

        return { fileId: file.id, success: true as const, ...result };
      } catch (err) {
        return {
          fileId: file.id,
          success: false as const,
          error: err instanceof Error ? err.message : 'Unknown error',
        };
      }
    });

    const results = await Promise.all(promises);

    // Update job with results
    setJob((prev) => {
      if (!prev) return prev;
      let updated = prev;
      for (const result of results) {
        if (result.success) {
          updated = markFileCompleted(
            updated,
            result.fileId,
            result.resultUrl,
            result.resultSize,
          );
        } else {
          updated = markFileFailed(updated, result.fileId, result.error);
        }
      }

      // Recursively process next batch
      if (!abortRef.current) {
        const remaining = updated.files.filter((f) => f.status === 'queued');
        if (remaining.length > 0) {
          // Schedule next batch asynchronously
          setTimeout(() => {
            setJob((latest) => {
              if (latest) processQueue(latest);
              return latest;
            });
          }, 0);
        } else {
          setIsProcessing(false);
        }
      }

      return updated;
    });
  }, []);

  const startBatch = useCallback(
    (newJob: BatchJob, processor: FileProcessor) => {
      processorRef.current = processor;
      abortRef.current = false;
      setJob(newJob);
      setIsProcessing(true);
      processQueue(newJob);
    },
    [processQueue],
  );

  const pause = useCallback(() => {
    abortRef.current = true;
    setJob((prev) => {
      if (!prev) return prev;
      setIsProcessing(false);
      return pauseJob(prev);
    });
  }, []);

  const resume = useCallback(() => {
    abortRef.current = false;
    setJob((prev) => {
      if (!prev) return prev;
      const resumed = resumeJob(prev);
      setIsProcessing(true);
      setTimeout(() => processQueue(resumed), 0);
      return resumed;
    });
  }, [processQueue]);

  const cancel = useCallback(() => {
    abortRef.current = true;
    setJob((prev) => {
      if (!prev) return prev;
      setIsProcessing(false);
      return cancelJob(prev);
    });
  }, []);

  const retry = useCallback(() => {
    abortRef.current = false;
    setJob((prev) => {
      if (!prev) return prev;
      const retried = retryFailed(prev);
      setIsProcessing(true);
      setTimeout(() => processQueue(retried), 0);
      return retried;
    });
  }, [processQueue]);

  const clear = useCallback(() => {
    abortRef.current = true;
    setJob(null);
    setIsProcessing(false);
    processorRef.current = null;
  }, []);

  return {
    job,
    isProcessing,
    startBatch,
    pause,
    resume,
    cancel,
    retry,
    clear,
  };
}
