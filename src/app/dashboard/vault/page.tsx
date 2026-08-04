// SPDX-License-Identifier: Apache-2.0
'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Trash2,
  RotateCcw,
  Flame,
  AlertTriangle,
  Check,
  RefreshCw,
  FileImage,
  Clock,
  Loader2,
  X,
} from 'lucide-react';

/* ─── Types ────────────────────────────────────────────── */

interface TrashedAsset {
  _id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  thumbnailBase64?: string | null;
  thumbnailUrl?: string | null;
  deletedAt: string;
  daysRemaining: number;
  retentionDays: number;
  createdAt: string;
}

/* ─── Helpers ──────────────────────────────────────────── */

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const LIMIT = 30;

/* ─── Component ────────────────────────────────────────── */

export default function TheVaultPage() {
  const [assets, setAssets] = useState<TrashedAsset[]>([]);
  const [total, setTotal] = useState(0);
  const [retentionDays, setRetentionDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showEmptyConfirm, setShowEmptyConfirm] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const fetchTrash = useCallback(async (pageNum: number, append: boolean) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    try {
      const res = await fetch(`/api/trash?page=${pageNum}&limit=${LIMIT}`);
      if (res.ok) {
        const data = await res.json();
        const newAssets: TrashedAsset[] = data.assets ?? [];
        if (append) {
          setAssets((prev) => [...prev, ...newAssets]);
        } else {
          setAssets(newAssets);
        }
        setTotal(data.total ?? 0);
        setRetentionDays(data.retentionDays ?? 30);
        setHasMore(pageNum < (data.totalPages ?? 1));
      }
    } catch (err) {
      console.error('Failed to fetch trash:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    fetchTrash(1, false);
  }, [fetchTrash]);

  // Infinite scroll
  useEffect(() => {
    if (!sentinelRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading && !loadingMore) {
          const next = page + 1;
          setPage(next);
          fetchTrash(next, true);
        }
      },
      { rootMargin: '200px' },
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, loading, loadingMore, page, fetchTrash]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    if (selectedIds.size === assets.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(assets.map((a) => a._id)));
    }
  }, [selectedIds.size, assets]);

  const handleRestore = useCallback(
    async (ids?: string[]) => {
      const targetIds = ids ?? [...selectedIds];
      if (targetIds.length === 0) return;

      setActionLoading('restore');
      try {
        const res = await fetch('/api/trash', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'restore', ids: targetIds }),
        });
        if (res.ok) {
          setSelectedIds(new Set());
          setPage(1);
          setHasMore(true);
          await fetchTrash(1, false);
        }
      } catch (err) {
        console.error('Restore failed:', err);
      } finally {
        setActionLoading(null);
      }
    },
    [selectedIds, fetchTrash],
  );

  const handlePurge = useCallback(
    async (ids?: string[]) => {
      const targetIds = ids ?? [...selectedIds];
      if (targetIds.length === 0) return;
      if (
        !confirm(
          `Permanently delete ${targetIds.length} asset${targetIds.length > 1 ? 's' : ''}? This cannot be undone.`,
        )
      )
        return;

      setActionLoading('purge');
      try {
        const res = await fetch('/api/trash', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'purge', ids: targetIds }),
        });
        if (res.ok) {
          setSelectedIds(new Set());
          setPage(1);
          setHasMore(true);
          await fetchTrash(1, false);
        }
      } catch (err) {
        console.error('Purge failed:', err);
      } finally {
        setActionLoading(null);
      }
    },
    [selectedIds, fetchTrash],
  );

  const handleEmptyTrash = useCallback(async () => {
    setShowEmptyConfirm(false);
    setActionLoading('empty');
    try {
      const res = await fetch('/api/trash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'empty' }),
      });
      if (res.ok) {
        setSelectedIds(new Set());
        setPage(1);
        setHasMore(true);
        await fetchTrash(1, false);
      }
    } catch (err) {
      console.error('Empty trash failed:', err);
    } finally {
      setActionLoading(null);
    }
  }, [fetchTrash]);

  /* ─── Loading ────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="h-8 w-8 animate-spin text-dash-text-muted dark:text-dash-text2" />
          <p className="text-sm text-dash-text2">Loading trash…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 dark:bg-red-500/10">
            <Trash2 className="h-5 w-5 text-red-500 dark:text-red-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-dash-text">
              Trash
            </h1>
            <p className="mt-0.5 text-sm text-dash-text2">
              {total} trashed asset{total !== 1 ? 's' : ''} · Auto-purge after{' '}
              <span className="font-medium text-dash-text2 dark:text-dash-text-muted">
                {retentionDays} days
              </span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setAssets([]);
              setPage(1);
              setHasMore(true);
              fetchTrash(1, false);
            }}
            className="flex items-center gap-1.5 rounded-lg border border-dash-border bg-dash-surface px-3 py-2 text-xs font-medium text-dash-text2 transition hover:bg-dash-surface-hover"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
          {total > 0 && (
            <button
              onClick={() => setShowEmptyConfirm(true)}
              disabled={actionLoading !== null}
              className="flex items-center gap-1.5 rounded-lg bg-red-500 px-3 py-2 text-xs font-medium text-white transition hover:bg-red-600 disabled:opacity-50"
            >
              <Flame className="h-3.5 w-3.5" />
              Empty Vault
            </button>
          )}
        </div>
      </div>

      {/* Empty Trash Confirmation Modal */}
      {showEmptyConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-dash-surface p-6 shadow-2xl border border-dash-border">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-500/20">
                <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-dash-text">
                  Empty Trash?
                </h3>
                <p className="mt-1 text-xs text-dash-text2">
                  This will permanently delete{' '}
                  <span className="font-medium text-dash-text2 dark:text-dash-text-muted">
                    {total} asset{total !== 1 ? 's' : ''}
                  </span>{' '}
                  and their files from cloud storage. This action cannot be
                  undone.
                </p>
              </div>
            </div>
            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setShowEmptyConfirm(false)}
                className="flex-1 rounded-lg border border-dash-border px-3 py-2 text-xs font-medium text-dash-text2 transition hover:bg-dash-surface-hover"
              >
                Cancel
              </button>
              <button
                onClick={handleEmptyTrash}
                className="flex-1 rounded-lg bg-red-500 px-3 py-2 text-xs font-medium text-white transition hover:bg-red-600"
              >
                Permanently Delete All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/50 px-4 py-3">
          <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
            {selectedIds.size} selected
          </span>
          <div className="flex-1" />
          <button
            onClick={() => handleRestore()}
            disabled={actionLoading !== null}
            className="flex items-center gap-1.5 rounded-lg bg-dash-surface2 px-3 py-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400 shadow-sm transition hover:bg-emerald-50 dark:hover:bg-emerald-900/50 disabled:opacity-50"
          >
            {actionLoading === 'restore' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RotateCcw className="h-3.5 w-3.5" />
            )}
            Restore
          </button>
          <button
            onClick={() => handlePurge()}
            disabled={actionLoading !== null}
            className="flex items-center gap-1.5 rounded-lg bg-dash-surface2 px-3 py-1.5 text-xs font-medium text-red-700 dark:text-red-400 shadow-sm transition hover:bg-red-50 dark:hover:bg-red-900/50 disabled:opacity-50"
          >
            {actionLoading === 'purge' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Flame className="h-3.5 w-3.5" />
            )}
            Delete Forever
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="rounded-lg p-1.5 text-dash-text-muted transition hover:bg-dash-surface hover:text-dash-text"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Empty State */}
      {assets.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
          <div className="mb-2 flex h-20 w-20 items-center justify-center rounded-2xl bg-dash-muted">
            <Trash2 className="h-10 w-10 text-dash-text-muted" />
          </div>
          <p className="text-lg font-semibold text-dash-text">Trash is empty</p>
          <p className="max-w-xs text-sm text-dash-text2">
            When you delete assets, they&apos;ll appear here for {retentionDays}{' '}
            days before being permanently removed.
          </p>
        </div>
      )}

      {/* Asset Grid */}
      {assets.length > 0 && (
        <div>
          {/* Select All */}
          <div className="mb-3 flex items-center gap-2">
            <button
              onClick={selectAll}
              className="flex items-center gap-2 text-xs font-medium text-dash-text2 transition hover:text-dash-text"
            >
              <div
                className={`flex h-4 w-4 items-center justify-center rounded border transition ${
                  selectedIds.size === assets.length
                    ? 'border-blue-500 bg-blue-500'
                    : 'border-dash-input-border'
                }`}
              >
                {selectedIds.size === assets.length && (
                  <Check className="h-2.5 w-2.5 text-white" />
                )}
              </div>
              Select all ({assets.length})
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {assets.map((asset) => {
              const isSelected = selectedIds.has(asset._id);
              const isExpiring = asset.daysRemaining <= 7;

              return (
                <div
                  key={asset._id}
                  className={`group relative overflow-hidden rounded-xl border-2 bg-dash-surface transition hover:shadow-md dark:hover:shadow-none /50 ${
                    isSelected
                      ? 'border-blue-500 ring-2 ring-blue-500/20'
                      : 'border-dash-border'
                  }`}
                >
                  {/* Thumbnail */}
                  <div className="relative aspect-video overflow-hidden bg-dash-muted">
                    {asset.thumbnailBase64 || asset.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={asset.thumbnailBase64 || asset.thumbnailUrl || ''}
                        alt={asset.name}
                        className="h-full w-full object-cover opacity-60"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <FileImage className="h-8 w-8 text-dash-text-muted dark:text-dash-text2" />
                      </div>
                    )}

                    {/* Selection checkbox */}
                    <button
                      onClick={() => toggleSelect(asset._id)}
                      className={`absolute left-2 top-2 flex h-5 w-5 items-center justify-center rounded border transition ${
                        isSelected
                          ? 'border-blue-500 bg-blue-500'
                          : 'border-dash-input-border bg-dash-surface/90 /90 opacity-0 group-hover:opacity-100'
                      }`}
                    >
                      {isSelected && <Check className="h-3 w-3 text-white" />}
                    </button>

                    {/* Days remaining badge */}
                    <div
                      className={`absolute right-2 top-2 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        isExpiring
                          ? 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400'
                          : 'bg-dash-inverted/70 dark:bg-dash-muted/70 text-white '
                      }`}
                    >
                      <Clock className="mr-1 inline h-3 w-3" />
                      {asset.daysRemaining}d left
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-3">
                    <p className="truncate text-sm font-medium text-dash-text2 dark:text-dash-text-muted">
                      {asset.name}
                    </p>
                    <p className="mt-0.5 text-xs text-dash-text-muted">
                      {formatBytes(asset.sizeBytes)} · Deleted{' '}
                      {timeAgo(asset.deletedAt)}
                    </p>

                    {/* Quick Actions */}
                    <div className="mt-2.5 flex gap-2">
                      <button
                        onClick={() => handleRestore([asset._id])}
                        disabled={actionLoading !== null}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-dash-border px-2 py-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 transition hover:bg-emerald-50 dark:hover:bg-emerald-900/50 disabled:opacity-50"
                      >
                        <RotateCcw className="h-3 w-3" />
                        Restore
                      </button>
                      <button
                        onClick={() => handlePurge([asset._id])}
                        disabled={actionLoading !== null}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-dash-border px-2 py-1.5 text-xs font-medium text-red-500 dark:text-red-400 transition hover:bg-red-50 dark:hover:bg-red-900/50 disabled:opacity-50"
                      >
                        <Flame className="h-3 w-3" />
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Infinite scroll sentinel */}
      {hasMore && !loading && (
        <div ref={sentinelRef} className="flex justify-center py-6">
          {loadingMore && (
            <div className="flex items-center gap-2 text-sm text-dash-text-muted">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading more…
            </div>
          )}
        </div>
      )}
    </div>
  );
}
