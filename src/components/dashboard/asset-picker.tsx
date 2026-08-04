// SPDX-License-Identifier: Apache-2.0
'use client';

/**
 * Shared Asset Picker — lets tool modals browse & select assets from the library.
 * Supports folder navigation with breadcrumbs: users can drill into folders,
 * then select assets. Fetches from /api/assets + /api/folders.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  Search,
  X,
  Loader2,
  ImageIcon,
  FileText,
  Check,
  Folder,
  ChevronRight,
  Home,
} from 'lucide-react';

/* ── Re-use the same shape from asset-grid ── */
interface AssetItem {
  _id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  width?: number;
  height?: number;
  url?: string;
  thumbnailUrl?: string | null;
  thumbnailBase64?: string | null;
  createdAt: string;
}

interface FolderItem {
  _id: string;
  name: string;
  parentId: string | null;
  path: string;
  createdAt: string;
}

/** Breadcrumb entry (id=null means root) */
interface BreadcrumbEntry {
  id: string | null;
  name: string;
}

export interface AssetPickerProps {
  /** Restrict which asset types appear (e.g. 'image' or 'application/pdf') */
  accept?: string;
  /** Allow multi-select; default true */
  multiple?: boolean;
  /** Called when user confirms selection — receives File objects */
  onSelect: (files: File[]) => void;
  /** Close the picker */
  onClose: () => void;
}

/** Convert a remote URL + metadata to a File object */
async function urlToFile(url: string, name: string, mimeType: string): Promise<File> {
  const res = await fetch(url);
  const blob = await res.blob();
  return new File([blob], name, { type: mimeType });
}

export default function AssetPicker({
  accept,
  multiple = true,
  onSelect,
  onClose,
}: AssetPickerProps) {
  /* ── Folder navigation state ── */
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbEntry[]>([
    { id: null, name: 'Root' },
  ]);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [loadingFolders, setLoadingFolders] = useState(true);

  /* ── Asset state ── */
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [converting, setConverting] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  /* ── Fetch folders for current directory ── */
  const fetchFolders = useCallback(async () => {
    setLoadingFolders(true);
    try {
      const params = new URLSearchParams();
      params.set('parentId', currentFolderId ?? '');
      const res = await fetch(`/api/folders?${params}`);
      if (!res.ok) throw new Error('fetch folders failed');
      const data = await res.json();
      setFolders(data.folders ?? []);
    } catch {
      setFolders([]);
    } finally {
      setLoadingFolders(false);
    }
  }, [currentFolderId]);

  /* ── Fetch assets for current directory ── */
  const fetchAssets = useCallback(
    async (pageNum: number, append: boolean) => {
      if (!append) setLoading(true);
      const params = new URLSearchParams({
        page: String(pageNum),
        limit: '30',
        sort: 'createdAt',
        sortDir: 'desc',
        folderId: currentFolderId ?? '__root__',
      });
      if (search) params.set('q', search);
      if (accept) {
        if (accept.endsWith('/*')) {
          params.set('mimeType', accept.replace('/*', ''));
        } else {
          params.set('mimeType', accept);
        }
      }
      try {
        const res = await fetch(`/api/assets?${params}`);
        if (!res.ok) throw new Error('fetch failed');
        const data = await res.json();
        const items: AssetItem[] = data.assets ?? [];
        if (append) {
          setAssets((prev) => [...prev, ...items]);
        } else {
          setAssets(items);
        }
        setHasMore(pageNum < (data.totalPages ?? 1));
      } catch {
        // silently fail — user can retry via search
      } finally {
        setLoading(false);
      }
    },
    [search, accept, currentFolderId],
  );

  /* ── Re-fetch when folder or search changes ── */
  useEffect(() => {
    setPage(1);
    fetchFolders();
    fetchAssets(1, false);
  }, [fetchFolders, fetchAssets]);

  /* ── Folder navigation helpers ── */
  const openFolder = useCallback(
    (folder: FolderItem) => {
      setCurrentFolderId(folder._id);
      setBreadcrumbs((prev) => [...prev, { id: folder._id, name: folder.name }]);
      setSelectedIds(new Set());
    },
    [],
  );

  const navigateToBreadcrumb = useCallback(
    (index: number) => {
      const entry = breadcrumbs[index];
      setCurrentFolderId(entry.id);
      setBreadcrumbs((prev) => prev.slice(0, index + 1));
      setSelectedIds(new Set());
    },
    [breadcrumbs],
  );

  const loadMore = useCallback(() => {
    if (!hasMore || loading) return;
    const next = page + 1;
    setPage(next);
    fetchAssets(next, true);
  }, [hasMore, loading, page, fetchAssets]);

  // Scroll-based infinite load
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 50) {
      loadMore();
    }
  }, [loadMore]);

  const toggleSelect = useCallback(
    (id: string) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          if (!multiple) next.clear();
          next.add(id);
        }
        return next;
      });
    },
    [multiple],
  );

  const handleConfirm = useCallback(async () => {
    if (selectedIds.size === 0) return;
    setConverting(true);
    try {
      const selected = assets.filter((a) => selectedIds.has(a._id));
      const files: File[] = [];
      for (const asset of selected) {
        const url = asset.url || asset.thumbnailUrl;
        if (!url) continue;
        const file = await urlToFile(url, asset.name, asset.mimeType);
        files.push(file);
      }
      onSelect(files);
    } catch (err) {
      console.error('Failed to convert assets to files:', err);
    } finally {
      setConverting(false);
    }
  }, [selectedIds, assets, onSelect]);

  const getThumbnail = (a: AssetItem) =>
    a.thumbnailBase64 || a.thumbnailUrl || a.url || null;

  const isImage = (a: AssetItem) => a.mimeType.startsWith('image/');

  const isLoading = loading && assets.length === 0 && loadingFolders;
  const isEmpty = !loading && !loadingFolders && assets.length === 0 && folders.length === 0;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div
        className="relative w-full max-w-2xl rounded-2xl border border-dash-border bg-dash-surface shadow-2xl overflow-hidden flex flex-col"
        style={{ maxHeight: '80vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-dash-border px-5 py-3">
          <h2 className="text-sm font-semibold text-dash-text">Select from Library</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-dash-text-muted hover:bg-dash-surface-hover hover:text-dash-text transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Breadcrumbs */}
        <div className="flex items-center gap-1 px-5 py-2 border-b border-dash-border overflow-x-auto" data-testid="asset-picker-breadcrumbs">
          {breadcrumbs.map((crumb, idx) => {
            const isLast = idx === breadcrumbs.length - 1;
            return (
              <div key={crumb.id ?? 'root'} className="flex items-center gap-1 shrink-0">
                {idx > 0 && <ChevronRight className="h-3 w-3 text-dash-text-muted shrink-0" />}
                <button
                  onClick={() => !isLast && navigateToBreadcrumb(idx)}
                  className={`flex items-center gap-1 text-xs rounded px-1.5 py-0.5 transition-colors ${
                    isLast
                      ? 'font-semibold text-dash-text cursor-default'
                      : 'text-dash-text-muted hover:text-dash-text hover:bg-dash-surface-hover'
                  }`}
                  data-testid={`breadcrumb-${crumb.id ?? 'root'}`}
                >
                  {idx === 0 && <Home className="h-3 w-3" />}
                  {crumb.name}
                </button>
              </div>
            );
          })}
        </div>

        {/* Search bar */}
        <div className="px-5 py-3 border-b border-dash-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-dash-text-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search assets..."
              className="w-full rounded-lg border border-dash-border bg-dash-muted pl-9 pr-3 py-2 text-sm text-dash-text outline-none focus:border-[var(--im-primary)] focus:ring-2 focus:ring-[var(--im-primary)]/20"
              data-testid="asset-picker-search"
            />
          </div>
        </div>

        {/* Grid — folders first, then assets */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-4"
          data-testid="asset-picker-grid"
        >
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-dash-text-muted" />
            </div>
          ) : isEmpty ? (
            <div className="flex flex-col items-center justify-center py-12 text-dash-text-muted">
              <ImageIcon className="h-10 w-10 opacity-30 mb-2" />
              <p className="text-sm">No assets found</p>
            </div>
          ) : (
            <>
              {/* Folders section */}
              {folders.length > 0 && (
                <div className="mb-3">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-dash-text-muted mb-2">
                    Folders
                  </p>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                    {folders.map((folder) => (
                      <button
                        key={folder._id}
                        onDoubleClick={() => openFolder(folder)}
                        onClick={() => openFolder(folder)}
                        className="group flex flex-col items-center gap-1 rounded-lg border border-transparent p-3 hover:bg-dash-surface-hover hover:border-dash-border transition-all"
                        title={folder.name}
                        data-testid={`folder-pick-${folder._id}`}
                      >
                        <Folder className="h-8 w-8 text-[var(--im-primary)] opacity-80 group-hover:opacity-100 transition-opacity" />
                        <span className="text-[10px] text-dash-text truncate max-w-full">
                          {folder.name}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Assets section */}
              {assets.length > 0 && (
                <div>
                  {folders.length > 0 && (
                    <p className="text-[10px] font-medium uppercase tracking-wider text-dash-text-muted mb-2">
                      Assets
                    </p>
                  )}
                  <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2">
                    {assets.map((asset) => {
                      const thumb = getThumbnail(asset);
                      const selected = selectedIds.has(asset._id);
                      return (
                        <button
                          key={asset._id}
                          onClick={() => toggleSelect(asset._id)}
                          className={`relative group rounded-lg border-2 overflow-hidden aspect-square transition-all ${
                            selected
                              ? 'border-[var(--im-primary)] ring-2 ring-[var(--im-primary)]/30'
                              : 'border-transparent hover:border-dash-border'
                          }`}
                          title={asset.name}
                          data-testid={`asset-pick-${asset._id}`}
                        >
                          {isImage(asset) && thumb ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              src={thumb}
                              alt={asset.name}
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-dash-muted">
                              <FileText className="h-6 w-6 text-dash-text-muted" />
                            </div>
                          )}
                          {/* Selection indicator */}
                          {selected && (
                            <div className="absolute inset-0 bg-[var(--im-primary)]/20 flex items-center justify-center">
                              <div className="rounded-full bg-[var(--im-primary)] p-1">
                                <Check className="h-3 w-3 text-white" />
                              </div>
                            </div>
                          )}
                          {/* Name tooltip on hover */}
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-1 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <p className="text-[9px] text-white truncate">{asset.name}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Edge case: only folders, no assets in this folder */}
              {folders.length > 0 && assets.length === 0 && !loading && (
                <p className="text-center text-xs text-dash-text-muted mt-4">
                  No assets in this folder. Browse sub-folders above.
                </p>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-dash-border px-5 py-3">
          <p className="text-xs text-dash-text-muted">
            {selectedIds.size} selected
          </p>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-lg border border-dash-border px-3 py-1.5 text-xs font-medium text-dash-text hover:bg-dash-surface-hover transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={selectedIds.size === 0 || converting}
              className="flex items-center gap-1.5 rounded-lg bg-[var(--im-primary)] px-3 py-1.5 text-xs font-semibold text-[var(--im-primary-fg)] shadow-sm transition hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="asset-picker-confirm"
            >
              {converting ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Loading…
                </>
              ) : (
                `Use ${selectedIds.size} asset${selectedIds.size !== 1 ? 's' : ''}`
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
