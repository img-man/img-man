// SPDX-License-Identifier: Apache-2.0
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronUp,
  Loader2,
  Sparkles,
  Upload,
  XCircle,
} from 'lucide-react';
import {
  readStoredUploadTasks,
  subscribeToUploadTasks,
  type TaskUploadSnapshot,
} from '@/lib/task-center-events';

interface AiTaskItem {
  _id: string;
  type: string;
  status: string;
  createdAt?: string;
}

interface TaskCenterProps {
  authToken?: string;
  compactOffset?: boolean;
  /**
   * When false, AI job polling is fully disabled (no /api/ai/jobs requests).
   * Pass `false` for embeds where the org has all AI features disabled.
   * Defaults to true for backward compatibility.
   */
  aiEnabled?: boolean;
  /**
   * Polling interval in milliseconds. Defaults to 60_000 (1 minute).
   * Polling is automatically paused while the tab is hidden.
   */
  pollIntervalMs?: number;
}

const ACTIVE_UPLOAD_STATUSES = new Set(['queued', 'uploading', 'confirming']);
const ACTIVE_AI_STATUSES = ['pending', 'processing'];
const DEFAULT_POLL_INTERVAL_MS = 60_000;

function formatRelativeTime(dateString?: string) {
  if (!dateString) return 'Just now';
  const diffMs = Date.now() - new Date(dateString).getTime();
  if (!Number.isFinite(diffMs) || diffMs < 60_000) return 'Just now';
  const mins = Math.round(diffMs / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function getUploadStatusIcon(task: TaskUploadSnapshot) {
  if (task.status === 'done') {
    return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
  }
  if (task.status === 'error') {
    return <XCircle className="h-4 w-4 text-red-500" />;
  }
  if (ACTIVE_UPLOAD_STATUSES.has(task.status)) {
    return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
  }
  return <Upload className="h-4 w-4 text-dash-text-muted" />;
}

function getAiJobLabel(type: string) {
  return type
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function TaskCenter({
  authToken,
  compactOffset = false,
  aiEnabled = true,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
}: TaskCenterProps) {
  const [open, setOpen] = useState(false);
  const [uploadTasks, setUploadTasks] = useState<TaskUploadSnapshot[]>([]);
  const [aiTasks, setAiTasks] = useState<AiTaskItem[]>([]);
  const [loadingAiTasks, setLoadingAiTasks] = useState(false);

  useEffect(() => {
    setUploadTasks(readStoredUploadTasks());
    return subscribeToUploadTasks(setUploadTasks);
  }, []);

  const fetchAiTasks = useCallback(async () => {
    if (!aiEnabled) {
      setAiTasks([]);
      return;
    }
    setLoadingAiTasks(true);
    try {
      const headers = authToken
        ? { Authorization: `Bearer ${authToken}` }
        : undefined;

      const results = await Promise.allSettled(
        ACTIVE_AI_STATUSES.map((status) =>
          fetch(`/api/ai/jobs?status=${status}&limit=4`, { headers }).then(
            async (response) => {
              if (!response.ok) return [] as AiTaskItem[];
              const data = (await response.json()) as { jobs?: AiTaskItem[] };
              return data.jobs ?? [];
            },
          ),
        ),
      );

      const merged = new Map<string, AiTaskItem>();
      results.forEach((result) => {
        if (result.status !== 'fulfilled') return;
        result.value.forEach((job) => merged.set(job._id, job));
      });

      setAiTasks(Array.from(merged.values()).slice(0, 6));
    } catch {
      setAiTasks([]);
    } finally {
      setLoadingAiTasks(false);
    }
  }, [authToken, aiEnabled]);

  useEffect(() => {
    if (!aiEnabled) {
      setAiTasks([]);
      return;
    }

    let lastRunAt = 0;
    const tick = () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      lastRunAt = Date.now();
      void fetchAiTasks();
    };

    // initial fetch
    tick();
    const interval = window.setInterval(tick, pollIntervalMs);

    // refresh on tab return only if we haven't fetched recently
    const onVisibility = () => {
      if (document.hidden) return;
      if (Date.now() - lastRunAt < pollIntervalMs) return;
      tick();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [fetchAiTasks, aiEnabled, pollIntervalMs]);

  const activeUploadCount = useMemo(
    () => uploadTasks.filter((task) => ACTIVE_UPLOAD_STATUSES.has(task.status)).length,
    [uploadTasks],
  );

  const activeTaskCount = activeUploadCount + aiTasks.length;
  const recentUploads = useMemo(() => uploadTasks.slice(0, 6), [uploadTasks]);
  const bottomOffset = compactOffset ? 'bottom-20' : 'bottom-4';

  return (
    <div className={`pointer-events-none fixed right-4 ${bottomOffset} z-40 flex flex-col items-end gap-3`}>
      {open && (
        <div className="pointer-events-auto w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-dash-border bg-dash-surface shadow-2xl">
          <div className="flex items-center justify-between border-b border-dash-border px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-dash-text">Task Center</p>
              <p className="text-[11px] text-dash-text-muted">
                Uploads and AI jobs in one place
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg p-1 text-dash-text-muted transition hover:bg-dash-muted hover:text-dash-text"
              aria-label="Close task center"
            >
              <ChevronUp className="h-4 w-4" />
            </button>
          </div>

          <div className="max-h-104 overflow-y-auto p-4">
            <section>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-dash-text-muted">
                  Uploads
                </h3>
                <span className="text-[11px] text-dash-text-muted">
                  {activeUploadCount} active
                </span>
              </div>

              {recentUploads.length === 0 ? (
                <div className="rounded-xl border border-dash-border bg-dash-muted/40 px-3 py-3 text-xs text-dash-text-muted">
                  No uploads yet in this session.
                </div>
              ) : (
                <div className="space-y-2">
                  {recentUploads.map((task) => (
                    <div
                      key={task.id}
                      className="rounded-xl border border-dash-border bg-dash-muted/30 px-3 py-2"
                    >
                      <div className="flex items-start gap-2">
                        <div className="mt-0.5 shrink-0">{getUploadStatusIcon(task)}</div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-xs font-medium text-dash-text">
                              {task.name}
                            </p>
                            <span className="text-[11px] text-dash-text-muted">
                              {task.progress}%
                            </span>
                          </div>
                          <p className="mt-0.5 text-[11px] text-dash-text-muted">
                            {task.status === 'error'
                              ? task.error || 'Upload failed'
                              : task.status === 'done'
                                ? 'Completed'
                                : task.status === 'confirming'
                                  ? 'Processing metadata'
                                  : task.status === 'queued'
                                    ? 'Waiting in queue'
                                    : 'Uploading'}
                          </p>
                          {task.status !== 'error' && (
                            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-dash-progress-track">
                              <div
                                className={`h-full rounded-full transition-all duration-300 ${
                                  task.status === 'done'
                                    ? 'bg-emerald-500'
                                    : 'bg-primary'
                                }`}
                                style={{ width: `${Math.max(4, task.progress)}%` }}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="mt-5">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-dash-text-muted">
                  AI Jobs
                </h3>
                <button
                  type="button"
                  onClick={() => void fetchAiTasks()}
                  className="text-[11px] text-primary transition hover:opacity-80"
                >
                  Refresh
                </button>
              </div>

              {loadingAiTasks && aiTasks.length === 0 ? (
                <div className="flex items-center gap-2 rounded-xl border border-dash-border bg-dash-muted/40 px-3 py-3 text-xs text-dash-text-muted">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading active AI jobs…
                </div>
              ) : aiTasks.length === 0 ? (
                <div className="rounded-xl border border-dash-border bg-dash-muted/40 px-3 py-3 text-xs text-dash-text-muted">
                  No pending AI jobs.
                </div>
              ) : (
                <div className="space-y-2">
                  {aiTasks.map((job) => (
                    <div
                      key={job._id}
                      className="flex items-start gap-2 rounded-xl border border-dash-border bg-dash-muted/30 px-3 py-2"
                    >
                      <div className="mt-0.5 rounded-lg bg-primary/10 p-1 text-primary">
                        <Sparkles className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-xs font-medium text-dash-text">
                            {getAiJobLabel(job.type)}
                          </p>
                          <span className="text-[11px] capitalize text-dash-text-muted">
                            {job.status}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[11px] text-dash-text-muted">
                          {formatRelativeTime(job.createdAt)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="pointer-events-auto flex items-center gap-2 rounded-full border border-dash-border bg-dash-surface px-4 py-2 text-sm font-medium text-dash-text shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl"
        aria-label="Toggle task center"
      >
        {activeTaskCount > 0 ? (
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
        ) : (
          <AlertCircle className="h-4 w-4 text-dash-text-muted" />
        )}
        <span>Tasks</span>
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
          {activeTaskCount}
        </span>
      </button>
    </div>
  );
}
