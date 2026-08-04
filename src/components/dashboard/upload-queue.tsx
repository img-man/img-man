// SPDX-License-Identifier: Apache-2.0
'use client';

import {
  useCallback,
  useRef,
  useState,
  useEffect,
  useMemo,
  type DragEvent,
} from 'react';
import {
  Cloud,
  Upload,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileImage,
  FolderUp,
  Trash2,
  Pause,
  Play,
  FileWarning,
} from 'lucide-react';
import { getFileTypeInfo } from '@/lib/file-types';
import {
  formatUploadBytes,
  summarizeUploadSelection,
  uploadAssetFile,
  type UploadLifecycleStage,
} from '@/lib/upload-helpers';
import {
  clearStoredUploadTasks,
  publishUploadTasks,
} from '@/lib/task-center-events';
import { useEmbedScope } from '@/app/embed/dashboard/embed-scope-context';

/* ─── Types ─────────────────────────────────────────────────── */

type FileStatus = 'queued' | 'uploading' | 'confirming' | 'done' | 'error';

interface QueuedFile {
  id: string;
  file: File;
  status: FileStatus;
  progress: number; // 0-100
  error?: string;
  preview?: string; // objectURL for thumbnails
  dimensions?: { width: number; height: number };
}

interface UploadQueueProps {
  folderId?: string | null;
  onUploadComplete?: () => void;
  /** Max concurrent uploads (default 2) */
  concurrency?: number;
}

/* ─── Helpers ───────────────────────────────────────────────── */

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Recursively read all files from dropped folders / files via the
 * DataTransfer API (webkitGetAsEntry).
 */
async function getFilesFromDataTransfer(dt: DataTransfer): Promise<File[]> {
  const files: File[] = [];

  // Try using webkitGetAsEntry for folder support
  if (dt.items?.length) {
    const entries: FileSystemEntry[] = [];
    for (let i = 0; i < dt.items.length; i++) {
      const entry = dt.items[i].webkitGetAsEntry?.();
      if (entry) entries.push(entry);
    }

    if (entries.length > 0) {
      const readEntry = async (entry: FileSystemEntry): Promise<void> => {
        if (entry.isFile) {
          const file = await new Promise<File>((res) =>
            (entry as FileSystemFileEntry).file(res),
          );
          files.push(file);
        } else if (entry.isDirectory) {
          const reader = (entry as FileSystemDirectoryEntry).createReader();
          const children = await new Promise<FileSystemEntry[]>((res) =>
            reader.readEntries(res),
          );
          for (const child of children) {
            await readEntry(child);
          }
        }
      };

      for (const entry of entries) {
        await readEntry(entry);
      }
      return files;
    }
  }

  // Fallback: plain file list (no folder recursion)
  for (let i = 0; i < dt.files.length; i++) {
    files.push(dt.files[i]);
  }
  return files;
}

/* ─── Upload Queue Component ────────────────────────────────── */

export function UploadQueue({
  folderId,
  onUploadComplete,
  concurrency = 2,
}: UploadQueueProps) {
  const { isEmbed } = useEmbedScope();
  const inputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [queue, setQueue] = useState<QueuedFile[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [paused, setPaused] = useState(false);
  const [bucketReady, setBucketReady] = useState<boolean | null>(null);
  const [preferServerUpload, setPreferServerUpload] = useState(false);
  const [showProvisionPrompt, setShowProvisionPrompt] = useState(false);
  const [provisioning, setProvisioning] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const startedUploadIds = useRef(new Set<string>());
  const pausedRef = useRef(false);
  pausedRef.current = paused;
  const queueRef = useRef<QueuedFile[]>([]);
  queueRef.current = queue;
  // Tracks which items have reached a terminal status, updated synchronously
  // the moment each upload settles — not via queueRef, which only reflects
  // React state as of the last render. Checking queueRef for "is everything
  // done" from inside a promise .finally() races that render: the state
  // update from the item's own onStageChange('done') hasn't necessarily been
  // committed yet, so the check can see the just-finished item as still
  // 'uploading' and skip the onUploadComplete callback for a batch that in
  // fact fully succeeded.
  const settledIds = useRef(new Set<string>());

  // Check if bucket is provisioned
  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((data) => {
        const storageConfig = data.settings?.storageConfig;
        const bucket = storageConfig?.bucket;
        setBucketReady(!!bucket);
        setPreferServerUpload(Boolean(storageConfig?.isByoc));
      })
      .catch(() => {
        setBucketReady(true);
        setPreferServerUpload(false);
      });
  }, []);

  const handleProvision = useCallback(async () => {
    setProvisioning(true);
    try {
      const res = await fetch('/api/settings/storage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'auto' }),
      });
      if (res.ok) {
        setBucketReady(true);
        setShowProvisionPrompt(false);
      }
    } catch {
      /* ignore */
    } finally {
      setProvisioning(false);
    }
  }, []);

  /* ── Stats ── */
  const stats = useMemo(() => {
    const total = queue.length;
    const done = queue.filter((f) => f.status === 'done').length;
    const errors = queue.filter((f) => f.status === 'error').length;
    const pending = queue.filter((f) => f.status === 'queued').length;
    const active = queue.filter(
      (f) => f.status === 'uploading' || f.status === 'confirming',
    ).length;
    return { total, done, errors, pending, active };
  }, [queue]);

  /* ── Add files to queue ── */
  const addFiles = useCallback(async (rawFiles: File[]) => {
    const { validFiles, errors } = summarizeUploadSelection(rawFiles);
    setValidationErrors(errors);
    if (validFiles.length === 0) return;

    window.setTimeout(() => setValidationErrors([]), 5000);

    const newItems: QueuedFile[] = [];
    for (const file of validFiles) {
      const item: QueuedFile = {
        id: generateId(),
        file,
        status: 'queued',
        progress: 0,
      };
      // Generate preview for images
      if (file.type.startsWith('image/')) {
        item.preview = URL.createObjectURL(file);
      }
      newItems.push(item);
    }

    setQueue((prev) => [...prev, ...newItems]);
    setIsOpen(true);
  }, []);

  /* ── Process queue: upload one file end-to-end ── */
  const uploadFile = useCallback(
    async (item: QueuedFile) => {
      const updateItem = (patch: Partial<QueuedFile>) =>
        setQueue((prev) =>
          prev.map((f) => (f.id === item.id ? { ...f, ...patch } : f)),
        );

      const updateStage = (stage: UploadLifecycleStage) => {
        if (stage === 'requesting-url') {
          updateItem({ status: 'uploading', progress: 10 });
        } else if (stage === 'uploading') {
          updateItem({ status: 'uploading', progress: 35 });
        } else if (stage === 'extracting-metadata') {
          updateItem({ status: 'confirming', progress: 70 });
        } else if (stage === 'confirming') {
          updateItem({ status: 'confirming', progress: 88 });
        } else if (stage === 'done') {
          updateItem({ status: 'done', progress: 100 });
        }
      };

      try {
        await uploadAssetFile(item.file, {
          folderId,
          onStageChange: updateStage,
          preferServerUpload: isEmbed || preferServerUpload,
        });
      } catch (err) {
        updateItem({
          status: 'error',
          error: err instanceof Error ? err.message : 'Upload failed',
        });
      } finally {
        settledIds.current.add(item.id);
      }
    },
    [folderId, isEmbed, preferServerUpload],
  );

  /* ── Queue processor: picks next queued file and starts uploading ── */
  const processQueue = useCallback(() => {
    if (pausedRef.current) return;

    const active = queueRef.current.filter(
      (f) => f.status === 'uploading' || f.status === 'confirming',
    ).length;
    const slots = concurrency - active;
    if (slots <= 0) return;

    const next = queueRef.current
      .filter(
        (f) => f.status === 'queued' && !startedUploadIds.current.has(f.id),
      )
      .slice(0, slots);

    if (next.length === 0) return;

    for (const item of next) {
      startedUploadIds.current.add(item.id);
      setQueue((prev) =>
        prev.map((queued) =>
          queued.id === item.id
            ? {
                ...queued,
                status: 'uploading',
                progress: Math.max(queued.progress, 5),
                error: undefined,
              }
            : queued,
        ),
      );

      uploadFile(item).finally(() => {
        startedUploadIds.current.delete(item.id);
        // Defer parent notification to a microtask so we never call a
        // parent setState from inside a setQueue updater (updaters run
        // during render and trigger React's "setState in render" warning).
        // Checked against settledIds rather than queueRef: this item's own
        // 'done'/'error' state update may not have committed to React state
        // yet, but uploadFile's finally() above already recorded it as
        // settled synchronously, so settledIds is never stale here.
        queueMicrotask(() => {
          const allFinished =
            queueRef.current.length > 0 &&
            queueRef.current.every((f) => settledIds.current.has(f.id));
          if (allFinished) onUploadComplete?.();
        });
        processQueue();
      });
    }
  }, [concurrency, uploadFile, onUploadComplete]);

  // Start processing whenever queue changes
  useEffect(() => {
    if (queue.some((f) => f.status === 'queued') && !paused) {
      processQueue();
    }
  }, [queue, paused, processQueue]);

  /* ── Event handlers ── */
  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    async (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      if (bucketReady === false) {
        setShowProvisionPrompt(true);
        return;
      }

      const files = await getFilesFromDataTransfer(e.dataTransfer);
      addFiles(files);
    },
    [bucketReady, addFiles],
  );

  const handleFileInput = useCallback(
    (files: FileList | null) => {
      if (!files) return;
      addFiles(Array.from(files));
    },
    [addFiles],
  );

  const handleButtonClick = useCallback(() => {
    if (bucketReady === false) {
      setShowProvisionPrompt(true);
      return;
    }
    inputRef.current?.click();
  }, [bucketReady]);

  const handleFolderClick = useCallback(() => {
    if (bucketReady === false) {
      setShowProvisionPrompt(true);
      return;
    }
    folderInputRef.current?.click();
  }, [bucketReady]);

  const removeFromQueue = useCallback((id: string) => {
    settledIds.current.delete(id);
    setQueue((prev) => {
      const item = prev.find((f) => f.id === id);
      if (item?.preview) URL.revokeObjectURL(item.preview);
      return prev.filter((f) => f.id !== id);
    });
  }, []);

  const retryFailed = useCallback(() => {
    setQueue((prev) =>
      prev.map((f) => {
        if (f.status !== 'error') return f;
        // The id is reused for the retry — clear its prior settled mark so
        // the completion check does not treat this attempt as already done.
        settledIds.current.delete(f.id);
        return { ...f, status: 'queued' as const, progress: 0, error: undefined };
      }),
    );
  }, []);

  const clearCompleted = useCallback(() => {
    setQueue((prev) => {
      for (const item of prev) {
        if (item.status === 'done') {
          settledIds.current.delete(item.id);
          if (item.preview) URL.revokeObjectURL(item.preview);
        }
      }
      return prev.filter((f) => f.status !== 'done');
    });
  }, []);

  const clearAll = useCallback(() => {
    setQueue((prev) => {
      for (const item of prev) {
        settledIds.current.delete(item.id);
        if (item.preview) URL.revokeObjectURL(item.preview);
      }
      return [];
    });
    setIsOpen(false);
  }, []);

  const togglePause = useCallback(() => {
    setPaused((p) => !p);
  }, []);

  // Cleanup previews on unmount
  useEffect(() => {
    return () => {
      for (const item of queue) {
        if (item.preview) URL.revokeObjectURL(item.preview);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const snapshots = queue.map((item) => ({
      id: item.id,
      name: item.file.name,
      status: item.status,
      progress: item.progress,
      error: item.error,
    }));

    if (snapshots.length === 0) {
      clearStoredUploadTasks();
      return;
    }

    publishUploadTasks(snapshots);
  }, [queue]);

  /* ── Render ── */
  return (
    <>
      {/* Hidden inputs */}
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => handleFileInput(e.target.files)}
      />
      <input
        ref={folderInputRef}
        type="file"
        multiple
        className="hidden"
        {...({ webkitdirectory: '', directory: '' } as Record<string, string>)}
        onChange={(e) => handleFileInput(e.target.files)}
      />

      {/* Storage provision prompt */}
      {validationErrors.length > 0 && (
        <div className="fixed bottom-4 right-4 z-[60] max-w-sm space-y-2">
          {validationErrors.map((error, index) => (
            <div
              key={`${error}-${index}`}
              className="flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 px-4 py-3 shadow-lg dark:border-red-700 dark:bg-red-950"
            >
              <FileWarning className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
              <span className="text-xs text-red-700 dark:text-red-300">
                {error}
              </span>
            </div>
          ))}
        </div>
      )}

      {showProvisionPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-md rounded-xl border border-dash-border bg-dash-surface p-6 shadow-2xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/40">
                <Cloud className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-lg font-semibold text-dash-text">
                Create Storage Space
              </h3>
            </div>
            <p className="mb-6 text-sm text-dash-text2 dark:text-dash-text-muted">
              Your organization needs a storage bucket before you can upload
              files.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowProvisionPrompt(false)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-dash-text2 hover:bg-dash-surface-hover dark:text-dash-text-muted "
              >
                Cancel
              </button>
              <button
                onClick={handleProvision}
                disabled={provisioning}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {provisioning ? 'Creating…' : 'Create Storage Bucket'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full-page drop zone overlay */}
      {isDragOver && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-[var(--im-primary)]/10 backdrop-blur-sm border-4 border-dashed border-[var(--im-primary)] rounded-2xl m-4 pointer-events-none">
          <div className="flex flex-col items-center gap-3">
            <Upload className="h-12 w-12 text-[var(--im-primary)] animate-bounce" />
            <p className="text-lg font-semibold text-[var(--im-primary)]">
              Drop files or folders here
            </p>
          </div>
        </div>
      )}

      {/* Drop zone wrapper — wraps the entire visible area */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className="contents"
      >
        {/* Upload buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleButtonClick}
            disabled={bucketReady === null}
            className="flex items-center gap-1.5 rounded-full bg-[var(--im-primary)] px-5 py-2 text-sm font-semibold text-[var(--im-primary-fg)] transition hover:opacity-90 disabled:opacity-50"
          >
            <Upload className="h-4 w-4" />
            Upload
          </button>
          <button
            onClick={handleFolderClick}
            disabled={bucketReady === null}
            title="Upload folder"
            className="flex items-center gap-1.5 rounded-full border border-dash-input-border px-3 py-2 text-sm font-medium text-dash-text2 hover:bg-dash-surface-hover transition disabled:opacity-50"
          >
            <FolderUp className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Queue panel — slides up from bottom-right */}
      {isOpen && queue.length > 0 && (
        <div className="fixed bottom-4 right-4 z-50 w-96 max-h-[70vh] flex flex-col rounded-xl border border-dash-border bg-dash-surface shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-dash-border px-4 py-3">
            <div className="flex items-center gap-2">
              <Upload className="h-4 w-4 text-[var(--im-primary)]" />
              <span className="text-sm font-semibold text-dash-text">
                Uploads
              </span>
              <span className="rounded-full bg-dash-muted px-2 py-0.5 text-[10px] font-medium text-dash-text2 dark:text-dash-text-muted">
                {stats.done}/{stats.total}
              </span>
            </div>
            <div className="flex items-center gap-1">
              {stats.errors > 0 && (
                <button
                  onClick={retryFailed}
                  title="Retry failed"
                  className="rounded p-1 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/30"
                >
                  <AlertCircle className="h-3.5 w-3.5" />
                </button>
              )}
              {stats.active > 0 && (
                <button
                  onClick={togglePause}
                  title={paused ? 'Resume' : 'Pause'}
                  className="rounded p-1 text-dash-text2 hover:bg-dash-surface-hover"
                >
                  {paused ? (
                    <Play className="h-3.5 w-3.5" />
                  ) : (
                    <Pause className="h-3.5 w-3.5" />
                  )}
                </button>
              )}
              {stats.done > 0 && (
                <button
                  onClick={clearCompleted}
                  title="Clear completed"
                  className="rounded p-1 text-dash-text2 hover:bg-dash-surface-hover"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="rounded p-1 text-dash-text2 hover:bg-dash-surface-hover"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Overall progress bar */}
          {stats.total > 0 && (
            <div className="h-1 bg-dash-muted">
              <div
                className="h-full bg-[var(--im-primary)] transition-all duration-300"
                style={{
                  width: `${stats.total > 0 ? (stats.done / stats.total) * 100 : 0}%`,
                }}
              />
            </div>
          )}

          {/* File list */}
          <div className="flex-1 overflow-y-auto divide-y divide-dash-border ">
            {queue.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 px-4 py-2.5"
              >
                {/* Thumbnail / icon */}
                <div className="h-9 w-9 shrink-0 rounded-lg bg-dash-muted flex items-center justify-center overflow-hidden">
                  {item.preview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.preview}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    (() => {
                      const fileType = getFileTypeInfo(
                        item.file.type || 'application/octet-stream',
                      );
                      const FileIcon = fileType?.icon ?? FileImage;
                      return (
                        <FileIcon
                          className={`h-4 w-4 ${fileType?.color ?? 'text-dash-text-muted'}`}
                        />
                      );
                    })()
                  )}
                </div>

                {/* File info */}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-dash-text">
                    {item.file.name}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-dash-text2">
                      {formatUploadBytes(item.file.size)}
                    </span>
                    {item.status === 'uploading' && (
                      <div className="flex-1 h-1 bg-dash-badge rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[var(--im-primary)] transition-all duration-300 rounded-full"
                          style={{ width: `${item.progress}%` }}
                        />
                      </div>
                    )}
                    {item.status === 'confirming' && (
                      <span className="text-[10px] text-amber-600 dark:text-amber-500">
                        Processing…
                      </span>
                    )}
                    {item.status === 'error' && (
                      <span className="text-[10px] text-red-500 dark:text-red-400 truncate">
                        {item.error}
                      </span>
                    )}
                  </div>
                </div>

                {/* Status icon */}
                <div className="shrink-0">
                  {item.status === 'queued' && (
                    <div className="h-4 w-4 rounded-full border-2 border-dash-input-border" />
                  )}
                  {(item.status === 'uploading' ||
                    item.status === 'confirming') && (
                    <Loader2 className="h-4 w-4 animate-spin text-[var(--im-primary)]" />
                  )}
                  {item.status === 'done' && (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
                  )}
                  {item.status === 'error' && (
                    <button
                      onClick={() => removeFromQueue(item.id)}
                      className="rounded p-0.5 text-red-400 hover:text-red-600 dark:hover:text-red-300"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Footer actions */}
          {stats.total > 0 && stats.done === stats.total && (
            <div className="border-t border-dash-border px-4 py-2 flex items-center justify-between">
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                All {stats.total} files uploaded!
              </span>
              <button
                onClick={clearAll}
                className="text-xs text-dash-text2 hover:text-dash-text"
              >
                Dismiss
              </button>
            </div>
          )}

          {paused && (
            <div className="border-t border-dash-border px-4 py-2 text-center">
              <span className="text-xs text-amber-600 dark:text-amber-500 font-medium">
                Paused — {stats.pending} files remaining
              </span>
            </div>
          )}
        </div>
      )}

      {/* Floating badge when panel is closed but uploads are active */}
      {!isOpen && stats.total > 0 && stats.done < stats.total && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full bg-[var(--im-primary)] px-4 py-2 text-sm font-semibold text-[var(--im-primary-fg)] shadow-lg"
        >
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>
            {stats.done}/{stats.total} uploaded
          </span>
        </button>
      )}
    </>
  );
}
