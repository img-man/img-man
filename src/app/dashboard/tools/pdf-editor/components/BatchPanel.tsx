// SPDX-License-Identifier: Apache-2.0
/**
 * BatchPanel Component — Phase 4, Week 14
 *
 * Full-featured batch processing panel with file upload, operation selection,
 * progress tracking, and download management.
 */

'use client';

import { useState, useCallback, useRef, useMemo } from 'react';
import {
  Layers,
  Upload,
  Play,
  Pause,
  Square,
  RotateCcw,
  Download,
  Trash2,
  ChevronDown,
  File,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Clock,
} from 'lucide-react';
import type { BatchJob, BatchOperationType, BatchJobStatus } from '../types';
import { BATCH_OPERATIONS, MAX_BATCH_FILES } from '../constants';
import {
  createBatchJob,
  validateBatchFiles,
  getBatchStats,
  formatDuration,
} from '../engine/batch-engine';
import {
  getOperationDescription,
  getDefaultBatchConfig,
} from '../engine/batch-operations';

/* ──────────────────────── Props ──────────────────────── */

interface BatchPanelProps {
  onStartBatch: (job: BatchJob) => void;
  onPauseBatch: (jobId: string) => void;
  onResumeBatch: (jobId: string) => void;
  onCancelBatch: (jobId: string) => void;
  onRetryFailed: (jobId: string) => void;
  onDownloadResult: (jobId: string, fileId: string) => void;
  onDownloadAll: (jobId: string) => void;
  activeJob?: BatchJob;
}

/* ──────────────────────── Status Icon ──────────────────────── */

function StatusIcon({ status }: { status: BatchJobStatus }) {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />;
    case 'failed':
      return <AlertCircle className="h-3.5 w-3.5 text-red-400" />;
    case 'processing':
      return <Loader2 className="h-3.5 w-3.5 text-im-primary animate-spin" />;
    case 'paused':
      return <Pause className="h-3.5 w-3.5 text-amber-400" />;
    case 'cancelled':
      return <Square className="h-3.5 w-3.5 text-dash-text-muted" />;
    default:
      return <Clock className="h-3.5 w-3.5 text-dash-text-muted" />;
  }
}

/* ──────────────────────── Component ──────────────────────── */

export default function BatchPanel({
  onStartBatch,
  onPauseBatch,
  onResumeBatch,
  onCancelBatch,
  onRetryFailed,
  onDownloadResult,
  onDownloadAll,
  activeJob,
}: BatchPanelProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [selectedOperation, setSelectedOperation] =
    useState<BatchOperationType>('merge');
  const [showConfig, setShowConfig] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validation = useMemo(
    () => validateBatchFiles(selectedFiles),
    [selectedFiles],
  );

  const stats = useMemo(
    () => (activeJob ? getBatchStats(activeJob) : null),
    [activeJob],
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      setSelectedFiles((prev) => [...prev, ...files].slice(0, MAX_BATCH_FILES));
      e.target.value = '';
    },
    [],
  );

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files).filter((f) =>
      f.name.toLowerCase().endsWith('.pdf'),
    );
    setSelectedFiles((prev) => [...prev, ...files].slice(0, MAX_BATCH_FILES));
  }, []);

  const handleRemoveFile = useCallback((index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleStart = useCallback(() => {
    if (!validation.valid || selectedFiles.length === 0) return;
    const config = getDefaultBatchConfig(selectedOperation);
    const job = createBatchJob(selectedOperation, selectedFiles, config);
    onStartBatch(job);
    setSelectedFiles([]);
  }, [selectedFiles, selectedOperation, validation, onStartBatch]);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-dash-border">
        <Layers className="h-4 w-4 text-im-primary" />
        <h3 className="text-xs font-semibold text-dash-text">
          Batch Processing
        </h3>
      </div>

      {/* Active Job View */}
      {activeJob && (
        <div className="border-b border-dash-border p-3 space-y-3">
          {/* Progress Bar */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-dash-text font-medium capitalize">
                {activeJob.operation}
              </span>
              <span className="text-dash-text-muted">
                {activeJob.overallProgress}%
              </span>
            </div>
            <div className="h-2 rounded-full bg-dash-border overflow-hidden">
              <div
                className="h-full rounded-full bg-im-primary transition-all duration-300"
                style={{ width: `${activeJob.overallProgress}%` }}
              />
            </div>
          </div>

          {/* Stats */}
          {stats && (
            <div className="grid grid-cols-4 gap-1 text-center">
              {[
                {
                  label: 'Done',
                  value: stats.completed,
                  color: 'text-green-400',
                },
                { label: 'Failed', value: stats.failed, color: 'text-red-400' },
                {
                  label: 'Running',
                  value: stats.processing,
                  color: 'text-im-primary',
                },
                {
                  label: 'Queue',
                  value: stats.queued,
                  color: 'text-dash-text-muted',
                },
              ].map((s) => (
                <div
                  key={s.label}
                  className="rounded-md bg-dash-surface-hover p-1.5"
                >
                  <div className={`text-xs font-semibold ${s.color}`}>
                    {s.value}
                  </div>
                  <div className="text-[9px] text-dash-text-muted">
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Job Controls */}
          <div className="flex gap-2">
            {activeJob.status === 'processing' && (
              <button
                onClick={() => onPauseBatch(activeJob.id)}
                className="flex-1 flex items-center justify-center gap-1 rounded-md border border-dash-border px-2 py-1.5 text-xs text-dash-text-muted hover:bg-dash-surface-hover transition"
              >
                <Pause className="h-3 w-3" /> Pause
              </button>
            )}
            {activeJob.status === 'paused' && (
              <button
                onClick={() => onResumeBatch(activeJob.id)}
                className="flex-1 flex items-center justify-center gap-1 rounded-md bg-im-primary px-2 py-1.5 text-xs font-medium text-im-primary-fg hover:bg-im-primary/90 transition"
              >
                <Play className="h-3 w-3" /> Resume
              </button>
            )}
            {(activeJob.status === 'processing' ||
              activeJob.status === 'paused') && (
              <button
                onClick={() => onCancelBatch(activeJob.id)}
                className="rounded-md border border-red-500/30 px-2 py-1.5 text-xs text-red-400 hover:bg-red-500/10 transition"
              >
                <Square className="h-3 w-3" />
              </button>
            )}
            {stats && stats.failed > 0 && activeJob.status !== 'processing' && (
              <button
                onClick={() => onRetryFailed(activeJob.id)}
                className="flex items-center gap-1 rounded-md border border-dash-border px-2 py-1.5 text-xs text-dash-text-muted hover:bg-dash-surface-hover transition"
              >
                <RotateCcw className="h-3 w-3" /> Retry Failed
              </button>
            )}
            {activeJob.status === 'completed' && (
              <button
                onClick={() => onDownloadAll(activeJob.id)}
                className="flex-1 flex items-center justify-center gap-1 rounded-md bg-green-500 px-2 py-1.5 text-xs font-medium text-white hover:bg-green-600 transition"
              >
                <Download className="h-3 w-3" /> Download All
              </button>
            )}
          </div>

          {/* File List */}
          <div className="max-h-[200px] overflow-y-auto space-y-0.5">
            {activeJob.files.map((file) => (
              <div
                key={file.id}
                className="flex items-center gap-2 px-2 py-1 rounded text-[11px] hover:bg-dash-surface-hover"
              >
                <StatusIcon status={file.status} />
                <span className="flex-1 truncate text-dash-text">
                  {file.fileName}
                </span>
                {file.status === 'processing' && (
                  <span className="text-[10px] text-dash-text-muted">
                    {file.progress}%
                  </span>
                )}
                {file.status === 'completed' && file.resultUrl && (
                  <button
                    onClick={() => onDownloadResult(activeJob.id, file.id)}
                    className="text-green-400 hover:text-green-300"
                  >
                    <Download className="h-3 w-3" />
                  </button>
                )}
                {file.error && (
                  <span
                    className="text-[10px] text-red-400 truncate max-w-[100px]"
                    title={file.error}
                  >
                    {file.error}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* New Batch Setup (when no active job or job completed) */}
      {(!activeJob ||
        activeJob.status === 'completed' ||
        activeJob.status === 'cancelled') && (
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {/* Operation Selection */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-dash-text">
              Operation
            </label>
            <div className="relative">
              <select
                value={selectedOperation}
                onChange={(e) =>
                  setSelectedOperation(e.target.value as BatchOperationType)
                }
                className="w-full appearance-none rounded-md border border-dash-border bg-dash-surface px-3 py-2 pr-8 text-xs text-dash-text cursor-pointer focus:border-im-primary focus:outline-none"
              >
                {BATCH_OPERATIONS.map((op) => (
                  <option key={op.value} value={op.value}>
                    {op.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-dash-text-muted pointer-events-none" />
            </div>
            <p className="text-[10px] text-dash-text-muted">
              {getOperationDescription(selectedOperation)}
            </p>
          </div>

          {/* Drop Zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`rounded-lg border-2 border-dashed p-6 text-center cursor-pointer transition ${
              isDragOver
                ? 'border-im-primary bg-im-primary/10'
                : 'border-dash-border hover:border-dash-text/30'
            }`}
          >
            <Upload className="h-6 w-6 mx-auto mb-2 text-dash-text-muted" />
            <p className="text-xs text-dash-text">Drop PDF files here</p>
            <p className="text-[10px] text-dash-text-muted mt-1">
              or click to browse (max {MAX_BATCH_FILES})
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          {/* File List */}
          {selectedFiles.length > 0 && (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-dash-text">
                  {selectedFiles.length} file(s) selected
                </span>
                <button
                  onClick={() => setSelectedFiles([])}
                  className="text-[10px] text-red-400 hover:text-red-300"
                >
                  Clear all
                </button>
              </div>
              <div className="max-h-[150px] overflow-y-auto space-y-0.5">
                {selectedFiles.map((file, i) => (
                  <div
                    key={`${file.name}-${i}`}
                    className="flex items-center gap-2 px-2 py-1 rounded text-[11px] hover:bg-dash-surface-hover group"
                  >
                    <File className="h-3.5 w-3.5 text-dash-text-muted flex-shrink-0" />
                    <span className="flex-1 truncate text-dash-text">
                      {file.name}
                    </span>
                    <span className="text-[10px] text-dash-text-muted">
                      {formatSize(file.size)}
                    </span>
                    <button
                      onClick={() => handleRemoveFile(i)}
                      className="opacity-0 group-hover:opacity-100 text-dash-text-muted hover:text-red-400 transition"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Validation */}
          {validation.errors.length > 0 && (
            <div className="rounded-md bg-red-500/10 border border-red-500/30 p-2">
              {validation.errors.map((err, i) => (
                <p key={i} className="text-[10px] text-red-400">
                  {err}
                </p>
              ))}
            </div>
          )}
          {validation.warnings.length > 0 && (
            <div className="rounded-md bg-amber-500/10 border border-amber-500/30 p-2">
              {validation.warnings.map((w, i) => (
                <p key={i} className="text-[10px] text-amber-400">
                  {w}
                </p>
              ))}
            </div>
          )}

          {/* Start Button */}
          <button
            onClick={handleStart}
            disabled={!validation.valid || selectedFiles.length === 0}
            className="w-full rounded-md bg-im-primary px-4 py-2 text-xs font-medium text-im-primary-fg hover:bg-im-primary/90 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Play className="h-3.5 w-3.5" />
            Start Batch ({selectedFiles.length} files)
          </button>
        </div>
      )}
    </div>
  );
}
