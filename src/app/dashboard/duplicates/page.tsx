// SPDX-License-Identifier: Apache-2.0
'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Copy,
  Trash2,
  Download,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  ArrowLeft,
  HardDrive,
} from 'lucide-react';
import Link from 'next/link';

interface DuplicateAsset {
  _id: string;
  name: string;
  originalName: string;
  storageKey: string;
  thumbnailBase64?: string;
  thumbnailStorageKey?: string;
  mimeType: string;
  sizeBytes: number;
  width?: number;
  height?: number;
  folderId?: string;
  createdAt: string;
}

interface DuplicateGroup {
  hash: string;
  count: number;
  assets: DuplicateAsset[];
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export default function DuplicatesPage() {
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<{
    totalDuplicateAssets: number;
    totalWastedBytes: number;
  } | null>(null);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchDuplicates = useCallback(async (p: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/assets/duplicates?page=${p}&limit=20`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to fetch duplicates');
        return;
      }
      setGroups(data.groups ?? []);
      setStats(data.stats ?? null);
      setTotalPages(data.totalPages ?? 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDuplicates(page);
  }, [page, fetchDuplicates]);

  const handleDeleteDuplicate = async (assetId: string) => {
    if (deletingIds.has(assetId)) return;
    setDeletingIds((prev) => new Set([...prev, assetId]));
    try {
      const res = await fetch(`/api/assets/${assetId}`, { method: 'DELETE' });
      if (res.ok) {
        // Remove from local state
        setGroups((prev) =>
          prev
            .map((g) => ({
              ...g,
              assets: g.assets.filter((a) => a._id !== assetId),
              count: g.assets.filter((a) => a._id !== assetId).length,
            }))
            .filter((g) => g.count >= 2),
        );
      }
    } catch (err) {
      console.error('Failed to delete duplicate:', err);
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(assetId);
        return next;
      });
    }
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-dash-bg">
      {/* Header */}
      <div className="border-b border-dash-border px-6 py-4">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="rounded-lg p-1.5 text-dash-text-muted transition hover:bg-dash-surface-hover hover:text-dash-text"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-lg font-semibold text-dash-text flex items-center gap-2">
              <Copy className="h-5 w-5 text-amber-500" />
              Duplicate Detection
            </h1>
            <p className="text-xs text-dash-text-muted">
              Find and clean up near-duplicate images using perceptual hashing
            </p>
          </div>
        </div>

        {/* Stats banner */}
        {stats && !loading && groups.length > 0 && (
          <div className="mt-3 flex items-center gap-4 rounded-lg border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-950/20 px-4 py-2.5">
            <div className="flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-3.5 w-3.5" />
              {groups.length} duplicate group{groups.length !== 1 ? 's' : ''}{' '}
              found
            </div>
            <div className="h-4 w-px bg-amber-300 dark:bg-amber-700" />
            <div className="text-xs text-amber-600 dark:text-amber-500">
              {stats.totalDuplicateAssets} total duplicate assets
            </div>
            <div className="h-4 w-px bg-amber-300 dark:bg-amber-700" />
            <div className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-500">
              <HardDrive className="h-3 w-3" />
              {formatBytes(stats.totalWastedBytes)} potentially reclaimable
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-dash-text-muted" />
            <span className="ml-2 text-sm text-dash-text-muted">
              Scanning for duplicates…
            </span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20">
            <AlertTriangle className="h-10 w-10 text-red-400" />
            <p className="mt-2 text-sm text-red-500">{error}</p>
            <button
              onClick={() => fetchDuplicates(page)}
              className="mt-3 rounded-lg border border-dash-border px-4 py-2 text-xs font-medium text-dash-text transition hover:bg-dash-surface-hover"
            >
              Retry
            </button>
          </div>
        ) : groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <CheckCircle2 className="h-10 w-10 text-emerald-400" />
            <p className="mt-2 text-sm font-medium text-dash-text">
              No duplicates found!
            </p>
            <p className="text-xs text-dash-text-muted">
              Your library is clean. Duplicates are detected using perceptual
              hashing.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {groups.map((group) => (
              <div
                key={group.hash}
                className="rounded-xl border border-dash-border bg-dash-surface p-4"
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-semibold text-dash-text">
                    {group.count} similar images
                  </span>
                  <span className="rounded bg-dash-muted px-2 py-0.5 text-[10px] font-mono text-dash-text-muted">
                    hash: {group.hash.slice(0, 12)}…
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                  {group.assets.map((asset, idx) => (
                    <div
                      key={asset._id}
                      className={`group relative overflow-hidden rounded-lg border transition ${
                        idx === 0
                          ? 'border-emerald-300 dark:border-emerald-700 ring-1 ring-emerald-200 dark:ring-emerald-800'
                          : 'border-dash-border hover:border-amber-300 dark:hover:border-amber-700'
                      }`}
                    >
                      {/* Thumbnail */}
                      <div className="aspect-square bg-dash-surface2">
                        {asset.thumbnailBase64 ? (
                          <img
                            src={asset.thumbnailBase64}
                            alt={asset.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-dash-text-muted">
                            <Copy className="h-8 w-8 opacity-30" />
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="p-2">
                        <p
                          className="truncate text-xs font-medium text-dash-text"
                          title={asset.name}
                        >
                          {asset.name}
                        </p>
                        <p className="text-[10px] text-dash-text-muted">
                          {formatBytes(asset.sizeBytes)}
                          {asset.width && asset.height
                            ? ` · ${asset.width}×${asset.height}`
                            : ''}
                        </p>
                      </div>

                      {/* Badge for original (first/oldest) */}
                      {idx === 0 && (
                        <div className="absolute left-1.5 top-1.5 rounded-full bg-emerald-500 px-2 py-0.5 text-[9px] font-bold text-white shadow">
                          KEEP
                        </div>
                      )}

                      {/* Delete button for duplicates */}
                      {idx > 0 && (
                        <button
                          onClick={() => handleDeleteDuplicate(asset._id)}
                          disabled={deletingIds.has(asset._id)}
                          className="absolute right-1.5 top-1.5 rounded-full bg-red-500/90 p-1 text-white opacity-0 shadow transition-opacity group-hover:opacity-100 hover:bg-red-600 disabled:opacity-50"
                          title="Delete this duplicate"
                        >
                          {deletingIds.has(asset._id) ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Trash2 className="h-3 w-3" />
                          )}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-4">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="rounded-lg border border-dash-border px-3 py-1.5 text-xs font-medium text-dash-text transition hover:bg-dash-surface-hover disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="text-xs text-dash-text-muted">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="rounded-lg border border-dash-border px-3 py-1.5 text-xs font-medium text-dash-text transition hover:bg-dash-surface-hover disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
