// SPDX-License-Identifier: Apache-2.0
'use client';

import { copyText } from '@/lib/clipboard';
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Link2,
  Copy,
  Check,
  Trash2,
  Loader2,
  Globe,
  Lock,
  Eye,
  Edit3,
  ExternalLink,
  FileText,
  FolderOpen,
  Building2,
  Clock,
  Shield,
  Search,
  ChevronDown,
  AlertCircle,
  RefreshCw,
  BarChart3,
} from 'lucide-react';
import { useRole } from '@/components/dashboard/role-context';

/* ─── Types ────────────────────────────────────────────── */

interface ShareLinkItem {
  _id: string;
  token: string;
  targetType: 'asset' | 'folder' | 'root';
  targetId?: string | null;
  targetIds?: string[];
  targetName: string;
  targetNames?: string[];
  permission: string;
  includeNested?: boolean;
  expiresAt?: string | null;
  password?: string;
  isActive: boolean;
  accessCount: number;
  maxDownloads?: number | null;
  lastAccessedAt?: string | null;
  allowedEmails?: string[];
  createdAt: string;
}

/* ─── Constants ────────────────────────────────────────── */

const TARGET_TYPE_META: Record<
  string,
  { label: string; icon: typeof FileText; color: string; bg: string }
> = {
  asset: {
    label: 'Asset',
    icon: FileText,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
  },
  folder: {
    label: 'Folder',
    icon: FolderOpen,
    color: 'text-amber-600',
    bg: 'bg-amber-50',
  },
  root: {
    label: 'Organization',
    icon: Building2,
    color: 'text-violet-600',
    bg: 'bg-violet-50',
  },
};

const PERMISSION_META: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  view: { label: 'View only', color: 'text-blue-700', bg: 'bg-blue-100' },
  edit: { label: 'Can edit', color: 'text-amber-700', bg: 'bg-amber-100' },
  admin: { label: 'Admin', color: 'text-red-700', bg: 'bg-red-100' },
};

/* ─── Component ────────────────────────────────────────── */

export default function SharesPage() {
  const { can } = useRole();
  const canShare = can('share');

  const [links, setLinks] = useState<ShareLinkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');

  // Filters
  const [filterType, setFilterType] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Actions
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [revokingToken, setRevokingToken] = useState<string | null>(null);

  // Sentinel for infinite scroll
  const sentinelRef = useRef<HTMLDivElement>(null);

  /* ── Fetch ───────────────────────────────────────────── */
  const fetchLinks = useCallback(
    async (pageNum: number, append: boolean) => {
      try {
        if (!append) setLoading(true);
        else setLoadingMore(true);

        const params = new URLSearchParams({
          page: String(pageNum),
          limit: '20',
        });
        if (filterType) params.set('targetType', filterType);

        const res = await fetch(`/api/share-links?${params}`);
        if (!res.ok) throw new Error('Failed to load share links');
        const data = await res.json();

        const fetched: ShareLinkItem[] = data.links ?? [];
        if (append) {
          setLinks((prev) => [...prev, ...fetched]);
        } else {
          setLinks(fetched);
        }
        setHasMore(pageNum < (data.totalPages ?? 1));
        setError('');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [filterType],
  );

  // Initial load and filter change
  useEffect(() => {
    setPage(1);
    setHasMore(true);
    fetchLinks(1, false);
  }, [fetchLinks]);

  // Infinite scroll observer
  useEffect(() => {
    if (!sentinelRef.current || !hasMore || loading || loadingMore) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          const next = page + 1;
          setPage(next);
          fetchLinks(next, true);
        }
      },
      { rootMargin: '200px' },
    );
    obs.observe(sentinelRef.current);
    return () => obs.disconnect();
  }, [hasMore, loading, loadingMore, page, fetchLinks]);

  /* ── Actions ─────────────────────────────────────────── */
  const handleCopy = async (token: string) => {
    const url = `${window.location.origin}/s/${token}`;
    await copyText(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const handleRevoke = async (token: string) => {
    setRevokingToken(token);
    try {
      const res = await fetch(`/api/share/${token}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Failed to revoke');
      }
      setLinks((prev) => prev.filter((l) => l.token !== token));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke');
    } finally {
      setRevokingToken(null);
    }
  };

  /* ── Helpers ─────────────────────────────────────────── */
  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const isExpired = (link: ShareLinkItem) => {
    if (!link.expiresAt) return false;
    return new Date(link.expiresAt) < new Date();
  };

  // Client-side search filter
  const filteredLinks = searchQuery.trim()
    ? links.filter(
        (l) =>
          l.targetName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (l.targetNames ?? []).some((n) =>
            n.toLowerCase().includes(searchQuery.toLowerCase()),
          ),
      )
    : links;

  /* ── Render ──────────────────────────────────────────── */
  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Link2 className="h-5 w-5 text-dash-text2 dark:text-dash-text-muted" />
            Share Links
          </h1>
          <p className="mt-1 text-sm text-dash-text2">
            Manage all shared links across your organization — assets, folders,
            and root-level shares.
          </p>
        </div>
        <button
          onClick={() => {
            setPage(1);
            setHasMore(true);
            fetchLinks(1, false);
          }}
          className="rounded-md border border-dash-border bg-dash-surface px-3 py-1.5 text-sm text-dash-text2 hover:bg-dash-surface-hover transition flex items-center gap-1.5"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>

      {/* Stats */}
      {!loading && links.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="rounded-xl border border-dash-border bg-dash-surface p-4">
            <div className="flex items-center gap-2 text-sm text-dash-text2 mb-1">
              <Link2 className="h-4 w-4" />
              Total Links
            </div>
            <div className="text-2xl font-bold text-dash-text">
              {links.length}
            </div>
          </div>
          <div className="rounded-xl border border-dash-border bg-dash-surface p-4">
            <div className="flex items-center gap-2 text-sm text-dash-text2 mb-1">
              <Globe className="h-4 w-4" />
              Active
            </div>
            <div className="text-2xl font-bold text-emerald-600">
              {links.filter((l) => l.isActive && !isExpired(l)).length}
            </div>
          </div>
          <div className="rounded-xl border border-dash-border bg-dash-surface p-4">
            <div className="flex items-center gap-2 text-sm text-dash-text2 mb-1">
              <Clock className="h-4 w-4" />
              Expired
            </div>
            <div className="text-2xl font-bold text-amber-600">
              {links.filter((l) => isExpired(l)).length}
            </div>
          </div>
          <div className="rounded-xl border border-dash-border bg-dash-surface p-4">
            <div className="flex items-center gap-2 text-sm text-dash-text2 mb-1">
              <BarChart3 className="h-4 w-4" />
              Total Views
            </div>
            <div className="text-2xl font-bold text-dash-text">
              {links.reduce((sum, l) => sum + l.accessCount, 0)}
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dash-text-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by target name..."
            className="w-full rounded-lg border border-dash-border bg-dash-surface pl-9 pr-3 py-2 text-sm text-dash-text outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>

        <div className="relative">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="appearance-none rounded-lg border border-dash-border bg-dash-surface px-3 py-2 pr-8 text-sm text-dash-text outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          >
            <option value="">All Types</option>
            <option value="asset">Assets</option>
            <option value="folder">Folders</option>
            <option value="root">Organization</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-dash-text-muted" />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-800 px-4 py-2 text-sm text-red-700 dark:text-red-400">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-dash-text2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading share links…
        </div>
      ) : filteredLinks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-dash-muted">
            <Link2 className="h-8 w-8 text-dash-text-muted" />
          </div>
          <p className="text-base font-medium text-dash-text mb-1">
            {searchQuery || filterType
              ? 'No matching share links'
              : 'No share links yet'}
          </p>
          <p className="text-sm text-dash-text2 max-w-xs text-center">
            {searchQuery || filterType
              ? 'Try adjusting your search or filter criteria.'
              : 'Share an asset or folder from the Assets page to create your first link.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredLinks.map((link) => {
            const typeMeta =
              TARGET_TYPE_META[link.targetType] ?? TARGET_TYPE_META.asset;
            const permMeta =
              PERMISSION_META[link.permission] ?? PERMISSION_META.view;
            const TypeIcon = typeMeta.icon;
            const expired = isExpired(link);

            return (
              <div
                key={link._id}
                className={`rounded-xl border bg-dash-surface transition hover:shadow-sm ${
                  expired
                    ? 'border-dash-border opacity-60'
                    : 'border-dash-border'
                }`}
              >
                <div className="flex items-center gap-4 px-5 py-4">
                  {/* Type Icon */}
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${typeMeta.bg}`}
                  >
                    <TypeIcon className={`h-5 w-5 ${typeMeta.color}`} />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-medium text-dash-text truncate">
                        {link.targetName}
                        {link.targetNames && link.targetNames.length > 1 && (
                          <span className="ml-1 text-dash-text-muted font-normal">
                            +{link.targetNames.length - 1} more
                          </span>
                        )}
                      </p>
                      {/* Badges */}
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${permMeta.bg} ${permMeta.color}`}
                      >
                        {permMeta.label}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${typeMeta.bg} ${typeMeta.color}`}
                      >
                        {typeMeta.label}
                      </span>
                      {link.password && (
                        <span title="Password protected">
                          <Lock className="h-3 w-3 text-dash-text-muted" />
                        </span>
                      )}
                      {expired && (
                        <span className="rounded-full bg-red-100 dark:bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-red-700 dark:text-red-400">
                          Expired
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-dash-text2">
                      <span className="flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        {link.accessCount} views
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Created {formatDate(link.createdAt)}
                      </span>
                      {link.expiresAt && (
                        <span className="flex items-center gap-1">
                          <Shield className="h-3 w-3" />
                          {expired
                            ? 'Expired'
                            : `Expires ${formatDate(link.expiresAt)}`}
                        </span>
                      )}
                      {link.maxDownloads && (
                        <span className="text-dash-text-muted">
                          Max: {link.maxDownloads} downloads
                        </span>
                      )}
                      {link.lastAccessedAt && (
                        <span className="text-dash-text-muted">
                          Last accessed {formatDate(link.lastAccessedAt)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <a
                      href={`/s/${link.token}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-md p-2 text-dash-text-muted hover:bg-dash-surface-hover hover:text-dash-text transition"
                      title="Open link"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                    <button
                      onClick={() => handleCopy(link.token)}
                      className="rounded-md p-2 text-dash-text-muted hover:bg-dash-surface-hover hover:text-dash-text transition"
                      title="Copy link"
                    >
                      {copiedToken === link.token ? (
                        <Check className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </button>
                    {canShare && (
                      <button
                        onClick={() => handleRevoke(link.token)}
                        disabled={revokingToken === link.token}
                        className="rounded-md p-2 text-dash-text-muted hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400 transition disabled:opacity-50"
                        title="Revoke link"
                      >
                        {revokingToken === link.token ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {/* Allowed Emails row */}
                {link.allowedEmails && link.allowedEmails.length > 0 && (
                  <div className="border-t border-dash-border px-5 py-2">
                    <p className="text-[11px] text-dash-text-muted">
                      Allowed: {link.allowedEmails.join(', ')}
                    </p>
                  </div>
                )}
              </div>
            );
          })}

          {/* Infinite scroll sentinel */}
          <div ref={sentinelRef} className="h-1" />

          {loadingMore && (
            <div className="flex items-center justify-center gap-2 py-4 text-dash-text2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading more…
            </div>
          )}
        </div>
      )}
    </div>
  );
}
