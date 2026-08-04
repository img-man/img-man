// SPDX-License-Identifier: Apache-2.0
'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from 'react';
import {
  AlertTriangle,
  Camera,
  Check,
  FolderOpen,
  FolderPlus,
  Grid3X3,
  Image as ImageIcon,
  LayoutGrid,
  Loader2,
  MoreHorizontal,
  Pencil,
  Play,
  Search,
  Star,
  Trash2,
  Share2,
  FolderInput,
  Lock,
  Globe,
  Shield,
  Upload,
} from 'lucide-react';
import { getFileTypeInfo } from '@/lib/file-types';
import {
  summarizeUploadSelection,
  uploadAssetFile,
} from '@/lib/upload-helpers';
import {
  getAssetPreviewInfo,
  hasAssetThumbnailPreview,
} from '@/lib/asset-preview';
import { useEmbedScope } from '@/app/embed/dashboard/embed-scope-context';
import {
  type LayoutMode,
  MasonryGrid,
  MasonryItem,
  getStoredLayout,
  setStoredLayout,
} from './masonry-grid';
import { HoverQuickActions } from './hover-quick-actions';
import { DragRectSelect } from './drag-rect-select';
import { Slideshow, type SlideshowAsset } from './slideshow';
import { Lightbox, type LightboxAsset } from './lightbox';

/* ─── Date bucket helper (Google Photos style) ─────────── */

/** Check if a MIME type is an image (for gallery mode filtering) */
function isImageMime(mime: string): boolean {
  return mime.startsWith('image/');
}

/** Check if a MIME type is a video */
function isVideoMime(mime: string): boolean {
  return mime.startsWith('video/');
}

/** Format seconds to mm:ss or hh:mm:ss */
function formatDuration(seconds?: number): string | null {
  if (!seconds || !isFinite(seconds)) return null;
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0)
    return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

/** Get short file extension label from a filename */
function getExtensionBadge(name: string, mimeType: string): string | null {
  // Don't show for images — they have a thumbnail
  if (mimeType.startsWith('image/')) return null;
  const ext = name.split('.').pop()?.toUpperCase();
  if (!ext || ext.length > 6) return null;
  return ext;
}

function getDateBucket(dateStr: string): string {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return 'Unknown';
  const now = new Date();

  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  const startOfYesterday = new Date(startOfToday.getTime() - 86400000);
  const startOfThisWeek = new Date(
    startOfToday.getTime() - startOfToday.getDay() * 86400000,
  );
  const startOfLastWeek = new Date(startOfThisWeek.getTime() - 7 * 86400000);
  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfThisYear = new Date(now.getFullYear(), 0, 1);

  if (date >= startOfToday) return 'Today';
  if (date >= startOfYesterday) return 'Yesterday';
  if (date >= startOfThisWeek) return 'This Week';
  if (date >= startOfLastWeek) return 'Last Week';
  if (date >= startOfThisMonth) return 'This Month';
  if (date >= startOfThisYear) {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }
  return String(date.getFullYear());
}

export interface AssetItem {
  _id: string;
  name: string;
  originalName?: string;
  storageKey?: string;
  mimeType: string;
  sizeBytes: number;
  width?: number;
  height?: number;
  url?: string;
  thumbnailUrl?: string | null;
  thumbnailBase64?: string | null;
  tags: string[];
  userTags?: string[];
  aiTagsGenerated?: boolean;
  originalAiTags?: string[];
  faces?: {
    faceHash: string;
    confidence: number;
    boundingBox: { x: number; y: number; w: number; h: number };
    emotion?: string;
  }[];
  folderId?: string;
  duration?: number;
  pageCount?: number;
  fileCategory?: string;
  isPublic?: boolean;
  isCopy?: boolean;
  copyOfAssetId?: string;
  variants?: {
    key: string;
    storageKey: string;
    width?: number;
    height?: number;
    format?: string;
    sizeBytes?: number;
  }[];
  customMetadata?: Record<string, string>;
  dominantColors?: string[];
  exif?: {
    camera?: string;
    lens?: string;
    iso?: number;
    aperture?: string;
    shutter?: string;
    focalLength?: number;
    dateTime?: string;
    gps?: { latitude: number; longitude: number };
  } | null;
  starredBy?: string[];
  createdAt: string;
  updatedAt?: string;
}

export interface FolderItem {
  _id: string;
  name: string;
  parentId: string | null;
  path: string;
  accessMode?: 'restricted' | 'flexible';
  accessModeInherited?: boolean;
  galleryMode?: boolean;
  galleryEmbed?: boolean;
  createdAt: string;
}

interface AssetGridProps {
  folderId?: string | null;
  refreshKey?: number;
  searchQuery?: string;
  sort?: string;
  sortDir?: 'asc' | 'desc';
  mimeType?: string;
  faceHash?: string;
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  onAssetOpen: (asset: AssetItem) => void;
  onFolderOpen: (folderId: string) => void;
  /** Folder operation callbacks */
  onFolderRename?: (folderId: string, currentName: string) => void;
  onFolderMove?: (folderId: string, folderName: string) => void;
  onFolderDelete?: (folderId: string, folderName: string) => void;
  onFolderShare?: (folderId: string, folderName: string) => void;
  onFolderAccessChange?: (folderId: string, folderName: string) => void;
  /** Selected folder IDs (for batch selection) */
  selectedFolderIds?: Set<string>;
  onFolderSelectionChange?: (ids: Set<string>) => void;
  /** Sprint 8 — gallery enhancements */
  onAssetEdit?: (assetId: string) => void;
  onAssetShare?: (assetId: string) => void;
  onAssetDelete?: (assetId: string) => void;
  currentUserId?: string;
  /** Sprint 9 — semantic search */
  searchMode?: 'text' | 'semantic';
  onSemanticLoadingChange?: (loading: boolean) => void;
  /** "Find Similar" trigger — when set, runs visual similarity search */
  findSimilarAssetId?: string | null;
  onFindSimilarClear?: () => void;
  /** Sprint 9 — color filter */
  colorFilter?: string;
}

export function AssetGrid({
  folderId,
  refreshKey,
  searchQuery,
  sort = 'createdAt',
  sortDir = 'desc',
  mimeType,
  faceHash,
  selectedIds,
  onSelectionChange,
  onAssetOpen,
  onFolderOpen,
  onFolderRename,
  onFolderMove,
  onFolderDelete,
  onFolderShare,
  onFolderAccessChange,
  selectedFolderIds,
  onFolderSelectionChange,
  onAssetEdit,
  onAssetShare,
  onAssetDelete,
  currentUserId,
  searchMode = 'text',
  onSemanticLoadingChange,
  findSimilarAssetId,
  onFindSimilarClear,
  colorFilter,
}: AssetGridProps) {
  const { isEmbed } = useEmbedScope();
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [dragOverFolder, setDragOverFolder] = useState<string | null>(null);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const sentinelRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef(1);
  const isFetchingMoreRef = useRef(false);
  const hasMoreRef = useRef(true);
  const loadingRef = useRef(true);
  const loadingMoreRef = useRef(false);

  /* ─── Sprint 8 state ─────────────────────────────────── */
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('grid');
  const [isGalleryFolder, setIsGalleryFolder] = useState(false);
  const [slideshowActive, setSlideshowActive] = useState(false);
  const [slideshowStartIdx, setSlideshowStartIdx] = useState(0);
  const [starredIds, setStarredIds] = useState<Set<string>>(new Set());
  const [lightboxActive, setLightboxActive] = useState(false);
  const [lightboxStartIdx, setLightboxStartIdx] = useState(0);
  const [fileDragOver, setFileDragOver] = useState(false);
  const [dropValidationErrors, setDropValidationErrors] = useState<string[]>(
    [],
  );
  const fileDragCounter = useRef(0);

  // Hydrate layout preference from localStorage
  useEffect(() => {
    setLayoutMode(getStoredLayout());
  }, []);

  // Sync starred state from loaded assets
  useEffect(() => {
    if (!currentUserId) return;
    const starred = new Set<string>();
    for (const a of assets) {
      if (a.starredBy?.includes(currentUserId)) starred.add(a._id);
    }
    setStarredIds(starred);
  }, [assets, currentUserId]);

  const handleLayoutToggle = useCallback(() => {
    setLayoutMode((prev) => {
      const next: LayoutMode = prev === 'grid' ? 'masonry' : 'grid';
      setStoredLayout(next);
      return next;
    });
  }, []);

  const handleStarToggle = useCallback((assetId: string, newState: boolean) => {
    setStarredIds((prev) => {
      const next = new Set(prev);
      if (newState) next.add(assetId);
      else next.delete(assetId);
      return next;
    });
  }, []);

  const handleStartSlideshow = useCallback(
    (startIdx = 0) => {
      if (assets.length === 0) return;
      setSlideshowStartIdx(startIdx);
      setSlideshowActive(true);
    },
    [assets.length],
  );

  const slideshowAssets: SlideshowAsset[] = useMemo(
    () =>
      assets.map((a) => ({
        id: a._id,
        url: a.thumbnailUrl || a.url || '',
        name: a.name,
      })),
    [assets],
  );

  /** Gallery mode: only show images, filter out PDFs/docs/etc */
  const galleryAssets = useMemo(
    () =>
      isGalleryFolder ? assets.filter((a) => isImageMime(a.mimeType)) : assets,
    [assets, isGalleryFolder],
  );

  /** Lightbox assets (images-only, full resolution URLs) */
  const lightboxAssets: LightboxAsset[] = useMemo(
    () =>
      galleryAssets
        .filter((a) => isImageMime(a.mimeType))
        .map((a) => ({
          id: a._id,
          url: a.url || a.thumbnailUrl || '',
          name: a.name,
          date: a.createdAt,
          width: a.width,
          height: a.height,
        })),
    [galleryAssets],
  );

  const handleOpenLightbox = useCallback(
    (assetId: string) => {
      const idx = lightboxAssets.findIndex((a) => a.id === assetId);
      if (idx >= 0) {
        setLightboxStartIdx(idx);
        setLightboxActive(true);
      }
    },
    [lightboxAssets],
  );

  /** Convert Set-based selection to array for DragRectSelect */
  const selectedIdsArr = useMemo(() => [...selectedIds], [selectedIds]);
  const handleDragRectSelectionChange = useCallback(
    (ids: string[]) => onSelectionChange(new Set(ids)),
    [onSelectionChange],
  );

  // Client-side cache: keyed by "folderId|sort|sortDir|mimeType|searchQuery"
  const cacheRef = useRef<
    Map<
      string,
      { folders: FolderItem[]; assets: AssetItem[]; hasMore: boolean }
    >
  >(new Map());
  const getCacheKey = useCallback(
    (fId?: string | null) =>
      `${fId ?? '__root__'}|${sort}|${sortDir}|${mimeType ?? ''}|${searchQuery ?? ''}|${faceHash ?? ''}|${colorFilter ?? ''}`,
    [sort, sortDir, mimeType, searchQuery, faceHash, colorFilter],
  );

  // Fetch folders for current directory
  const fetchFolders = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.set('parentId', folderId ?? '');
      const res = await fetch(`/api/folders?${params}`);
      const data = await res.json();
      setFolders(data.folders ?? []);
    } catch (err) {
      console.error('Failed to fetch folders:', err);
    }
  }, [folderId]);

  // Check if current folder has gallery mode enabled
  useEffect(() => {
    if (!folderId) {
      setIsGalleryFolder(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/folders/${folderId}`);
        if (res.ok) {
          const data = await res.json();
          const isGallery = !!(isEmbed
            ? data.folder?.galleryEmbed
            : data.folder?.galleryMode);
          if (!cancelled) {
            setIsGalleryFolder(isGallery);
            if (isGallery) setLayoutMode('masonry');
            else setLayoutMode(getStoredLayout());
          }
        }
      } catch {
        // ignore — use default layout
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [folderId, isEmbed]);

  // Folder context menu
  const [folderMenuId, setFolderMenuId] = useState<string | null>(null);
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [renameFolderValue, setRenameFolderValue] = useState('');
  const folderMenuRef = useRef<HTMLDivElement>(null);

  // Close folder menu on outside click (use 'click' not 'mousedown' to avoid racing with toggle)
  useEffect(() => {
    if (!folderMenuId) return;
    const handleClickOutside = (e: globalThis.MouseEvent) => {
      if (
        folderMenuRef.current &&
        !folderMenuRef.current.contains(e.target as Node)
      ) {
        setFolderMenuId(null);
      }
    };
    document.addEventListener('click', handleClickOutside, true);
    return () =>
      document.removeEventListener('click', handleClickOutside, true);
  }, [folderMenuId]);

  const toggleFolderSelect = useCallback(
    (fId: string) => {
      if (!onFolderSelectionChange) return;
      const next = new Set(selectedFolderIds ?? []);
      if (next.has(fId)) next.delete(fId);
      else next.add(fId);
      onFolderSelectionChange(next);
    },
    [selectedFolderIds, onFolderSelectionChange],
  );

  const handleFolderRenameSubmit = useCallback(
    async (fId: string) => {
      if (!renameFolderValue.trim()) {
        setRenamingFolderId(null);
        return;
      }
      try {
        await fetch(`/api/folders/${fId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: renameFolderValue.trim() }),
        });
        cacheRef.current.clear();
        await fetchFolders();
      } catch (err) {
        console.error('Rename folder failed:', err);
      }
      setRenamingFolderId(null);
    },
    [renameFolderValue, fetchFolders],
  );

  const handleFolderDelete = useCallback(
    async (fId: string, fName: string) => {
      if (onFolderDelete) {
        onFolderDelete(fId, fName);
        return;
      }
      // Fallback: also delegate to parent if no handler (no-op)
    },
    [onFolderDelete],
  );

  // Reset when filters change — restore from cache if available
  useEffect(() => {
    const key = getCacheKey(folderId);
    const cached = cacheRef.current.get(key);
    if (cached && !refreshKey) {
      // Instant restore from cache
      setFolders(cached.folders);
      setAssets(cached.assets);
      setHasMore(cached.hasMore);
      hasMoreRef.current = cached.hasMore;
      pageRef.current = 1;
      setPage(1);
      setLoading(false);
      loadingRef.current = false;
      isFetchingMoreRef.current = false;
    } else {
      setAssets([]);
      setFolders([]);
      pageRef.current = 1;
      setPage(1);
      setHasMore(true);
      hasMoreRef.current = true;
      setLoading(true);
      loadingRef.current = true;
      isFetchingMoreRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    folderId,
    refreshKey,
    searchQuery,
    sort,
    sortDir,
    mimeType,
    faceHash,
    colorFilter,
  ]);

  const fetchAssets = useCallback(
    async (pageNum: number, append: boolean) => {
      if (append) setLoadingMore(true);
      else setLoading(true);

      const params = new URLSearchParams({
        page: String(pageNum),
        limit: '30',
        sort,
        sortDir,
      });
      // Root view: only show root-level assets (no folderId)
      if (folderId) {
        params.set('folderId', folderId);
      } else {
        params.set('folderId', '__root__');
      }
      if (searchQuery) params.set('q', searchQuery);
      if (mimeType) params.set('mimeType', mimeType);
      if (faceHash) params.set('faceHash', faceHash);
      if (colorFilter) params.set('color', colorFilter);

      try {
        const res = await fetch(`/api/assets?${params}`);
        const data = await res.json();
        const newAssets: AssetItem[] = data.assets ?? [];

        if (append) {
          setAssets((prev) => {
            const merged = [...prev, ...newAssets];
            return merged;
          });
        } else {
          setAssets(newAssets);
        }
        const more = pageNum < (data.totalPages ?? 1);
        setHasMore(more);
        hasMoreRef.current = more;
      } catch (err) {
        console.error('Failed to fetch assets:', err);
      } finally {
        setLoading(false);
        loadingRef.current = false;
        setLoadingMore(false);
        loadingMoreRef.current = false;
        isFetchingMoreRef.current = false;
      }
    },
    [folderId, searchQuery, sort, sortDir, mimeType, faceHash, colorFilter],
  );

  // Sprint 9: Semantic search via AI embeddings
  const fetchSemanticResults = useCallback(
    async (query: string, similarAssetId?: string) => {
      setLoading(true);
      onSemanticLoadingChange?.(true);
      try {
        const res = await fetch('/api/assets/semantic-search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: similarAssetId ? undefined : query,
            assetId: similarAssetId,
            folderId: folderId || undefined,
            mimeType: mimeType || undefined,
            color: colorFilter || undefined,
            limit: 30,
            minScore: 0.4,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          console.error('[SemanticSearch] API error:', data.error);
          setAssets([]);
          return;
        }
        const results: AssetItem[] = (data.results ?? []).map(
          (r: { asset: AssetItem; score: number }) => ({
            ...r.asset,
            _similarityScore: r.score,
          }),
        );
        setAssets(results);
        setHasMore(false);
        hasMoreRef.current = false;
      } catch (err) {
        console.error('[SemanticSearch] Failed:', err);
        setAssets([]);
      } finally {
        setLoading(false);
        loadingRef.current = false;
        onSemanticLoadingChange?.(false);
      }
    },
    [folderId, mimeType, colorFilter, onSemanticLoadingChange],
  );

  // Sprint 9: Effect to trigger semantic search when mode is semantic and query changes
  useEffect(() => {
    if (searchMode === 'semantic' && searchQuery && searchQuery.length >= 2) {
      const timer = setTimeout(() => {
        fetchSemanticResults(searchQuery);
      }, 600); // Longer debounce for semantic (API call + embedding)
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, searchMode, fetchSemanticResults]);

  // Sprint 9: "Find Similar" trigger
  useEffect(() => {
    if (findSimilarAssetId) {
      fetchSemanticResults('', findSimilarAssetId);
    }
  }, [findSimilarAssetId, fetchSemanticResults]);

  // Initial fetch — folders + assets in parallel (skip if cache hit)
  // Skip normal fetch if in semantic mode with active query (handled by semantic effect)
  useEffect(() => {
    if (searchMode === 'semantic' && searchQuery) return;
    if (findSimilarAssetId) return;
    const key = getCacheKey(folderId);
    const cached = cacheRef.current.get(key);
    if (cached && !refreshKey) return; // already restored from cache above
    Promise.all([fetchFolders(), fetchAssets(1, false)]).then(() => {
      // Cache the result after first paint
      setTimeout(() => {
        const key2 = getCacheKey(folderId);
        setFolders((f) => {
          setAssets((a) => {
            cacheRef.current.set(key2, {
              folders: f,
              assets: a,
              hasMore: true,
            });
            return a;
          });
          return f;
        });
      }, 0);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchFolders, fetchAssets, refreshKey]);

  // Infinite scroll — observer created once, all guards via refs
  const fetchAssetsRef = useRef(fetchAssets);
  fetchAssetsRef.current = fetchAssets;

  useEffect(() => {
    if (!sentinelRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries[0].isIntersecting &&
          hasMoreRef.current &&
          !loadingRef.current &&
          !loadingMoreRef.current &&
          !isFetchingMoreRef.current
        ) {
          isFetchingMoreRef.current = true;
          const nextPage = pageRef.current + 1;
          pageRef.current = nextPage;
          setPage(nextPage);
          fetchAssetsRef.current(nextPage, true);
        }
      },
      { rootMargin: '200px' },
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, []);

  // Multi-select click handler for assets
  const handleAssetClick = useCallback(
    (asset: AssetItem, e: MouseEvent) => {
      if (e.ctrlKey || e.metaKey) {
        const next = new Set(selectedIds);
        if (next.has(asset._id)) next.delete(asset._id);
        else next.add(asset._id);
        onSelectionChange(next);
      } else if (e.shiftKey && assets.length > 0) {
        const lastSelected = [...selectedIds].pop();
        const lastIdx = assets.findIndex((a) => a._id === lastSelected);
        const currIdx = assets.findIndex((a) => a._id === asset._id);
        if (lastIdx >= 0 && currIdx >= 0) {
          const [start, end] = [
            Math.min(lastIdx, currIdx),
            Math.max(lastIdx, currIdx),
          ];
          const next = new Set(selectedIds);
          for (let i = start; i <= end; i++) next.add(assets[i]._id);
          onSelectionChange(next);
        }
      } else if (isGalleryFolder && isImageMime(asset.mimeType)) {
        // Gallery mode: open lightbox for images
        handleOpenLightbox(asset._id);
      } else {
        // Normal click — open overlay viewer
        onAssetOpen(asset);
      }
    },
    [
      assets,
      selectedIds,
      onSelectionChange,
      onAssetOpen,
      isGalleryFolder,
      handleOpenLightbox,
    ],
  );

  // Double-click folder to navigate into it
  const handleFolderDoubleClick = useCallback(
    (folder: FolderItem) => {
      onFolderOpen(folder._id);
    },
    [onFolderOpen],
  );

  // Drag & Drop: drag asset(s) into a folder
  const handleDragStart = useCallback(
    (e: React.DragEvent, assetId: string) => {
      // If dragging a selected asset, move all selected; otherwise just the one
      const ids =
        selectedIds.has(assetId) && selectedIds.size > 0
          ? [...selectedIds]
          : [assetId];
      e.dataTransfer.setData(
        'application/imgman-assets',
        JSON.stringify(ids),
      );
      e.dataTransfer.effectAllowed = 'move';
    },
    [selectedIds],
  );

  const handleFolderDragOver = useCallback(
    (e: React.DragEvent, fId: string) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setDragOverFolder(fId);
    },
    [],
  );

  const handleFolderDragLeave = useCallback(() => {
    setDragOverFolder(null);
  }, []);

  const handleFolderDrop = useCallback(
    async (e: React.DragEvent, targetFolderId: string) => {
      e.preventDefault();
      setDragOverFolder(null);
      const raw = e.dataTransfer.getData('application/imgman-assets');
      if (!raw) return;
      try {
        const ids: string[] = JSON.parse(raw);
        if (ids.length === 0) return;
        await fetch('/api/assets/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'move',
            ids,
            folderId: targetFolderId,
          }),
        });
        // Refresh the grid
        setAssets([]);
        pageRef.current = 1;
        setPage(1);
        setHasMore(true);
        setLoading(true);
        await Promise.all([fetchFolders(), fetchAssets(1, false)]);
      } catch (err) {
        console.error('Drop move failed:', err);
      }
    },
    [fetchFolders, fetchAssets],
  );

  /* ─── File Drag & Drop upload handlers ───────────────── */
  const handleFileDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    // Only react to external file drops, not internal asset drags
    if (e.dataTransfer.types.includes('Files')) {
      fileDragCounter.current += 1;
      setFileDragOver(true);
    }
  }, []);

  const handleFileDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    fileDragCounter.current -= 1;
    if (fileDragCounter.current <= 0) {
      fileDragCounter.current = 0;
      setFileDragOver(false);
    }
  }, []);

  const handleFileDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.types.includes('Files')) {
      e.dataTransfer.dropEffect = 'copy';
    }
  }, []);

  const handleFileDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      fileDragCounter.current = 0;
      setFileDragOver(false);

      // If it's an internal asset drag, ignore (handled by folder drop)
      if (e.dataTransfer.getData('application/imgman-assets')) return;

      const files = e.dataTransfer.files;
      if (!files || files.length === 0) return;

      const { validFiles, errors } = summarizeUploadSelection(Array.from(files));
      setDropValidationErrors(errors);
      if (errors.length > 0) {
        window.setTimeout(() => setDropValidationErrors([]), 5000);
      }
      if (validFiles.length === 0) return;

      const uploadResults = await Promise.allSettled(
        validFiles.map((file) =>
          uploadAssetFile(file, {
            folderId,
            preferServerUpload: isEmbed,
          }),
        ),
      );

      uploadResults.forEach((result, index) => {
        if (result.status === 'rejected') {
          console.error(
            'Drag-drop upload failed for',
            validFiles[index]?.name,
            result.reason,
          );
        }
      });

      // Refresh grid after uploads
      setAssets([]);
      pageRef.current = 1;
      setPage(1);
      setHasMore(true);
      setLoading(true);
      await fetchAssets(1, false);
    },
    [folderId, fetchAssets],
  );

  // Create folder
  const handleCreateFolder = useCallback(async () => {
    if (!newFolderName.trim()) return;
    try {
      await fetch('/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newFolderName.trim(),
          parentId: folderId || null,
        }),
      });
      setNewFolderName('');
      setCreatingFolder(false);
      cacheRef.current.clear();
      await fetchFolders();
    } catch (err) {
      console.error('Create folder failed:', err);
    }
  }, [newFolderName, folderId, fetchFolders]);

  const toggleSelect = useCallback(
    (assetId: string) => {
      const next = new Set(selectedIds);
      if (next.has(assetId)) next.delete(assetId);
      else next.add(assetId);
      onSelectionChange(next);
    },
    [selectedIds, onSelectionChange],
  );

  /* ─── Date-grouped asset buckets ─────────────────────── */
  const dateGroups = useMemo(() => {
    const source = isGalleryFolder ? galleryAssets : assets;
    const map = new Map<string, typeof assets>();
    for (const asset of source) {
      const bucket = getDateBucket(asset.createdAt);
      if (!map.has(bucket)) map.set(bucket, []);
      map.get(bucket)!.push(asset);
    }
    return Array.from(map.entries()).map(([label, items]) => ({
      label,
      items,
    }));
  }, [assets, galleryAssets, isGalleryFolder]);

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-4 p-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="aspect-square animate-pulse rounded-xl bg-dash-badge "
          />
        ))}
      </div>
    );
  }

  const isEmpty = folders.length === 0 && assets.length === 0;
  const galleryEmpty =
    isGalleryFolder && galleryAssets.length === 0 && assets.length > 0;

  if (isEmpty) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        {searchQuery ? (
          <>
            <div className="mb-2 flex h-16 w-16 items-center justify-center rounded-2xl bg-dash-muted">
              <Search className="h-8 w-8 text-dash-text-muted" />
            </div>
            <p className="text-base font-semibold text-dash-text">
              No results for &ldquo;{searchQuery}&rdquo;
            </p>
            <p className="text-sm text-dash-text2">
              Try different keywords or clear your search.
            </p>
          </>
        ) : (
          <>
            <div className="mb-2 flex h-16 w-16 items-center justify-center rounded-2xl bg-dash-muted">
              <FolderPlus className="h-8 w-8 text-dash-text-muted" />
            </div>
            <p className="text-base font-semibold text-dash-text">
              This folder is empty
            </p>
            <p className="text-sm text-dash-text2">
              Upload files or create subfolders to get started.
            </p>

            {/* Inline create folder in empty state */}
            {creatingFolder ? (
              <div className="flex w-44 flex-col items-center gap-2 rounded-xl border-2 border-dashed border-blue-400 bg-blue-50 dark:bg-blue-900/20 p-4">
                <FolderPlus className="h-8 w-8 text-blue-400" />
                <input
                  autoFocus
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateFolder();
                    if (e.key === 'Escape') {
                      setCreatingFolder(false);
                      setNewFolderName('');
                    }
                  }}
                  placeholder="Folder name"
                  className="w-full rounded border border-dash-border bg-dash-surface px-2 py-1 text-center text-xs outline-none focus:border-blue-500 "
                />
                <div className="flex gap-1">
                  <button
                    onClick={handleCreateFolder}
                    disabled={!newFolderName.trim()}
                    className="rounded bg-blue-600 px-2.5 py-1 text-[10px] font-medium text-white hover:bg-blue-500 disabled:opacity-50"
                  >
                    Create
                  </button>
                  <button
                    onClick={() => {
                      setCreatingFolder(false);
                      setNewFolderName('');
                    }}
                    className="rounded border border-dash-border px-2.5 py-1 text-[10px] font-medium text-dash-text2 hover:bg-dash-surface-hover"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setCreatingFolder(true)}
                className="group mt-2 flex items-center gap-2 rounded-lg border-2 border-dashed border-dash-border bg-dash-surface px-5 py-3 transition hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                <FolderPlus className="h-6 w-6 text-dash-text-muted dark:text-dash-text2 transition group-hover:text-blue-400 dark:group-hover:text-blue-500" />
                <span className="text-sm font-medium text-dash-text-muted group-hover:text-blue-500 dark:group-hover:text-blue-400">
                  New Folder
                </span>
              </button>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <DragRectSelect
      itemSelector="[data-asset-id]"
      itemIdAttr="data-asset-id"
      selectedIds={selectedIdsArr}
      onSelectionChange={handleDragRectSelectionChange}
    >
      <div
        ref={gridRef}
        onDragEnter={handleFileDragEnter}
        onDragLeave={handleFileDragLeave}
        onDragOver={handleFileDragOver}
        onDrop={handleFileDrop}
        className="relative"
      >
        {dropValidationErrors.length > 0 && (
          <div className="pointer-events-none absolute right-3 bottom-3 z-50 flex max-w-sm flex-col gap-2">
            {dropValidationErrors.slice(0, 3).map((error, index) => (
              <div
                key={`${error}-${index}`}
                className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-[var(--im-surface)]/95 px-3 py-2 text-xs text-dash-text shadow-lg backdrop-blur"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                <span>{error}</span>
              </div>
            ))}
            {dropValidationErrors.length > 3 && (
              <div className="rounded-xl border border-dash-border bg-[var(--im-surface)]/95 px-3 py-2 text-xs text-dash-text-muted shadow-lg backdrop-blur">
                +{dropValidationErrors.length - 3} more file issue
                {dropValidationErrors.length - 3 === 1 ? '' : 's'}
              </div>
            )}
          </div>
        )}

        {/* ─── Drag & Drop File Upload Overlay ─── */}
        {fileDragOver && (
          <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center rounded-xl border-2 border-dashed border-[var(--im-primary)] bg-[var(--im-primary)]/5 backdrop-blur-[2px]">
            <div className="flex flex-col items-center gap-3">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--im-primary)]/15">
                <Upload className="h-8 w-8 text-[var(--im-primary)]" />
              </div>
              <p className="text-sm font-semibold text-[var(--im-primary)]">
                Drop files to upload
              </p>
              <p className="text-xs text-dash-text-muted">
                Images, videos, PDFs, documents, and more
              </p>
            </div>
          </div>
        )}

        {/* ─── Toolbar ─── */}
        {isGalleryFolder ? (
          /* Gallery mode toolbar — distinctive purple accent bar */
          <div
            className="flex items-center justify-between gap-3 px-6 pt-5 pb-2"
            data-testid="gallery-toolbar"
            data-no-drag-select
          >
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/15">
                <Camera className="h-4 w-4 text-purple-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-dash-text">
                  Gallery Mode
                </p>
                <p className="text-[10px] text-dash-text-muted">
                  {galleryAssets.length} photo
                  {galleryAssets.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {galleryAssets.length > 0 && (
                <button
                  onClick={() => handleStartSlideshow(0)}
                  className="flex items-center gap-1.5 rounded-lg bg-purple-500/15 px-3 py-1.5 text-xs font-medium text-purple-300 transition hover:bg-purple-500/25"
                  data-testid="slideshow-trigger"
                >
                  <Play size={13} /> Slideshow
                </button>
              )}
              <button
                onClick={handleLayoutToggle}
                className="flex items-center gap-1.5 rounded-lg border border-dash-border bg-dash-surface px-3 py-1.5 text-xs font-medium text-dash-text2 transition hover:bg-dash-surface-hover"
                title={
                  layoutMode === 'grid' ? 'Switch to masonry' : 'Switch to grid'
                }
                data-testid="layout-toggle"
              >
                {layoutMode === 'grid' ? (
                  <LayoutGrid size={13} />
                ) : (
                  <Grid3X3 size={13} />
                )}
                {layoutMode === 'grid' ? 'Masonry' : 'Grid'}
              </button>
            </div>
          </div>
        ) : (
          /* Normal toolbar */
          <div
            className="flex items-center justify-end gap-2 px-6 pt-4 pb-1"
            data-testid="gallery-toolbar"
            data-no-drag-select
          >
            {assets.length > 0 && (
              <button
                onClick={() => handleStartSlideshow(0)}
                className="flex items-center gap-1.5 rounded-lg border border-dash-border bg-dash-surface px-3 py-1.5 text-xs font-medium text-dash-text2 transition hover:bg-dash-surface-hover"
                data-testid="slideshow-trigger"
              >
                <Play size={13} /> Slideshow
              </button>
            )}
            <button
              onClick={handleLayoutToggle}
              className="flex items-center gap-1.5 rounded-lg border border-dash-border bg-dash-surface px-3 py-1.5 text-xs font-medium text-dash-text2 transition hover:bg-dash-surface-hover"
              title={
                layoutMode === 'grid' ? 'Switch to masonry' : 'Switch to grid'
              }
              data-testid="layout-toggle"
            >
              {layoutMode === 'grid' ? (
                <LayoutGrid size={13} />
              ) : (
                <Grid3X3 size={13} />
              )}
              {layoutMode === 'grid' ? 'Masonry' : 'Grid'}
            </button>
          </div>
        )}

        {/* Gallery mode: show subfolders as compact chips (not big cards) */}
        {isGalleryFolder && folders.length > 0 && (
          <div
            className="flex flex-wrap gap-2 px-6 pt-3 pb-1"
            data-no-drag-select
          >
            {folders.map((folder) => (
              <button
                key={`gf-${folder._id}`}
                onDoubleClick={() => handleFolderDoubleClick(folder)}
                onClick={() => onFolderOpen(folder._id)}
                className="flex items-center gap-1.5 rounded-full border border-dash-border bg-dash-surface px-3 py-1.5 text-xs font-medium text-dash-text2 transition hover:bg-dash-surface-hover hover:border-purple-400/50"
              >
                <FolderOpen className="h-3.5 w-3.5 text-amber-400" />
                {folder.name}
              </button>
            ))}
          </div>
        )}

        {/* Gallery mode: empty images state */}
        {isGalleryFolder && galleryEmpty && (
          <div className="flex flex-col items-center justify-center py-20 text-dash-text-muted">
            <ImageIcon className="h-12 w-12 opacity-20 mb-3" />
            <p className="text-sm font-medium">No photos in this folder</p>
            <p className="text-xs mt-1 opacity-70">
              This folder contains {assets.length} non-image file
              {assets.length !== 1 ? 's' : ''} which are hidden in gallery mode.
            </p>
          </div>
        )}

        {/* ─── Folders grid (Normal mode only) ─── */}
        {!isGalleryFolder && (
          <div className="grid grid-cols-2 gap-4 p-6 pb-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {/* ─── Create Folder ─── */}
            {creatingFolder ? (
              <div className="flex aspect-square flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-blue-400 bg-blue-50 dark:bg-blue-900/20 p-3">
                <FolderPlus className="h-8 w-8 text-blue-400" />
                <input
                  autoFocus
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateFolder();
                    if (e.key === 'Escape') {
                      setCreatingFolder(false);
                      setNewFolderName('');
                    }
                  }}
                  placeholder="Folder name"
                  className="w-full rounded border border-dash-border bg-dash-surface px-2 py-1 text-center text-xs outline-none focus:border-blue-500 "
                />
                <div className="flex gap-1">
                  <button
                    onClick={handleCreateFolder}
                    disabled={!newFolderName.trim()}
                    className="rounded bg-blue-600 px-2.5 py-1 text-[10px] font-medium text-white hover:bg-blue-500 disabled:opacity-50"
                  >
                    Create
                  </button>
                  <button
                    onClick={() => {
                      setCreatingFolder(false);
                      setNewFolderName('');
                    }}
                    className="rounded border border-dash-border px-2.5 py-1 text-[10px] font-medium text-dash-text2 hover:bg-dash-surface-hover"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setCreatingFolder(true)}
                className="group flex aspect-square flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-dash-border bg-dash-surface transition hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                <FolderPlus className="h-10 w-10 text-dash-text-muted dark:text-dash-text2 transition group-hover:text-blue-400 dark:group-hover:text-blue-500" />
                <p className="text-xs font-medium text-dash-text-muted group-hover:text-blue-500 dark:group-hover:text-blue-400">
                  New Folder
                </p>
              </button>
            )}

            {/* ─── Folders ─── */}
            {folders.map((folder) => {
              const isFolderSelected =
                selectedFolderIds?.has(folder._id) ?? false;
              const isRenaming = renamingFolderId === folder._id;
              return (
                <div
                  key={`folder-${folder._id}`}
                  className={`group relative flex aspect-square flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border-2 bg-dash-surface transition hover:border-amber-300 dark:hover:border-amber-500/50 hover:shadow-md hover:-translate-y-1 ${
                    isFolderSelected
                      ? 'border-blue-500 ring-2 ring-blue-500/30'
                      : dragOverFolder === folder._id
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 ring-2 ring-blue-400/40 scale-105'
                        : 'border-dash-border'
                  }`}
                  onDoubleClick={() => handleFolderDoubleClick(folder)}
                  onDragOver={(e) => handleFolderDragOver(e, folder._id)}
                  onDragLeave={handleFolderDragLeave}
                  onDrop={(e) => handleFolderDrop(e, folder._id)}
                >
                  {/* Selection checkbox */}
                  <div
                    className={`absolute left-2 top-2 z-10 flex h-5 w-5 items-center justify-center rounded border transition cursor-pointer ${
                      isFolderSelected
                        ? 'border-blue-500 bg-blue-500'
                        : 'border-dash-input-border bg-dash-surface/80 /80 opacity-0 group-hover:opacity-100'
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFolderSelect(folder._id);
                    }}
                  >
                    {isFolderSelected && (
                      <Check className="h-3 w-3 text-white" />
                    )}
                  </div>

                  {/* Context menu button */}
                  <div
                    className="absolute right-2 top-2 z-10"
                    ref={
                      folderMenuId === folder._id ? folderMenuRef : undefined
                    }
                  >
                    <button
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        setFolderMenuId((prev) =>
                          prev === folder._id ? null : folder._id,
                        );
                      }}
                      className={`flex h-6 w-6 items-center justify-center rounded-md bg-dash-surface/80 /80 text-dash-text-muted transition hover:bg-dash-surface-hover hover:text-dash-text ${
                        folderMenuId === folder._id
                          ? 'opacity-100'
                          : 'opacity-0 group-hover:opacity-100'
                      }`}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>

                    {folderMenuId === folder._id && (
                      <div className="absolute right-0 top-full z-30 mt-1 w-36 rounded-lg border border-dash-border bg-dash-surface2 py-1 shadow-lg">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setFolderMenuId(null);
                            setRenamingFolderId(folder._id);
                            setRenameFolderValue(folder.name);
                          }}
                          className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-dash-text2 hover:bg-dash-surface-hover"
                        >
                          <Pencil className="h-3 w-3" /> Rename
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setFolderMenuId(null);
                            onFolderMove?.(folder._id, folder.name);
                          }}
                          className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-dash-text2 hover:bg-dash-surface-hover"
                        >
                          <FolderInput className="h-3 w-3" /> Move to…
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setFolderMenuId(null);
                            onFolderShare?.(folder._id, folder.name);
                          }}
                          className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-dash-text2 hover:bg-dash-surface-hover"
                        >
                          <Share2 className="h-3 w-3" /> Share
                        </button>
                        {!isEmbed && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setFolderMenuId(null);
                              onFolderAccessChange?.(folder._id, folder.name);
                            }}
                            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-dash-text2 hover:bg-dash-surface-hover"
                          >
                            <Shield className="h-3 w-3" /> Access settings
                          </button>
                        )}
                        <div className="my-1 border-t border-dash-border " />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setFolderMenuId(null);
                            handleFolderDelete(folder._id, folder.name);
                          }}
                          className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                        >
                          <Trash2 className="h-3 w-3" /> Delete
                        </button>
                      </div>
                    )}
                  </div>

                  <FolderOpen className="h-12 w-12 text-amber-400 transition group-hover:text-amber-500 group-hover:scale-110" />
                  {/* Access mode badge */}
                  {(folder as FolderItem).accessMode === 'restricted' && (
                    <div
                      className="absolute left-2 bottom-2 z-10 flex items-center gap-0.5 rounded-md bg-red-100 dark:bg-red-900/30 px-1.5 py-0.5"
                      title="Restricted — only allowed members can see this folder"
                    >
                      <Lock className="h-2.5 w-2.5 text-red-600 dark:text-red-400" />
                      <span className="text-[9px] font-medium text-red-600 dark:text-red-400">
                        Restricted
                      </span>
                    </div>
                  )}
                  {isRenaming ? (
                    <input
                      autoFocus
                      value={renameFolderValue}
                      onChange={(e) => setRenameFolderValue(e.target.value)}
                      onBlur={() => handleFolderRenameSubmit(folder._id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter')
                          handleFolderRenameSubmit(folder._id);
                        if (e.key === 'Escape') setRenamingFolderId(null);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="mx-2 w-[calc(100%-1rem)] rounded border border-blue-400 bg-dash-surface px-2 py-0.5 text-center text-xs outline-none "
                    />
                  ) : (
                    <p className="w-full truncate px-3 text-center text-xs font-medium text-dash-text2 dark:text-dash-text-muted">
                      {folder.name}
                    </p>
                  )}
                  <p className="text-[10px] text-dash-text-muted">
                    {dragOverFolder === folder._id
                      ? 'Drop to move here'
                      : 'Double-click to open'}
                  </p>
                </div>
              );
            })}
          </div>
        )}

        {/* ─── Date-grouped asset sections ─── */}
        {dateGroups.map(({ label, items }) => {
          const allGroupSelected = items.every((a) => selectedIds.has(a._id));
          const imageCount = items.filter((a) =>
            isImageMime(a.mimeType),
          ).length;
          return (
            <div key={label}>
              {/* Sticky group header */}
              {isGalleryFolder ? (
                /* Gallery mode header — larger, more prominent */
                <div
                  className="sticky top-0 z-10 flex items-center gap-3 bg-dash-bg/95 backdrop-blur-md px-6 py-3 border-b border-purple-500/10"
                  data-no-drag-select
                >
                  <h3 className="text-sm font-bold text-dash-text">{label}</h3>
                  <span className="rounded-full bg-purple-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-purple-300">
                    {imageCount} photo{imageCount !== 1 ? 's' : ''}
                  </span>
                </div>
              ) : (
                /* Normal header */
                <div
                  className="sticky top-0 z-10 flex items-center gap-3 bg-dash-bg/90 backdrop-blur-sm border-b border-dash-border/50 px-6 py-2"
                  data-no-drag-select
                >
                  <h3 className="text-xs font-semibold text-dash-text2">
                    {label}
                  </h3>
                  <span className="rounded-full bg-dash-badge px-2 py-0.5 text-[10px] font-medium text-dash-text-muted">
                    {items.length}
                  </span>
                  <button
                    onClick={() => {
                      const next = new Set(selectedIds);
                      if (allGroupSelected) {
                        items.forEach((a) => next.delete(a._id));
                      } else {
                        items.forEach((a) => next.add(a._id));
                      }
                      onSelectionChange(next);
                    }}
                    className={`ml-auto flex h-5 w-5 items-center justify-center rounded border transition cursor-pointer ${
                      allGroupSelected
                        ? 'border-blue-500 bg-blue-500'
                        : 'border-dash-input-border bg-dash-surface/80 hover:border-blue-400'
                    }`}
                    title={
                      allGroupSelected
                        ? 'Deselect all in group'
                        : 'Select all in group'
                    }
                  >
                    {allGroupSelected && (
                      <Check className="h-3 w-3 text-white" />
                    )}
                  </button>
                </div>
              )}

              {/* Asset cards — masonry or grid */}
              <MasonryGrid
                mode={layoutMode}
                className="p-6 pt-4"
                gap={isGalleryFolder ? 6 : 16}
              >
                {items.map((asset) => {
                  const isSelected = selectedIds.has(asset._id);
                  const isAssetStarred = starredIds.has(asset._id);
                  const fileType = getFileTypeInfo(asset.mimeType);
                  const previewInfo = getAssetPreviewInfo(asset.mimeType);
                  const isImage = previewInfo.kind === 'image';
                  return (
                    <MasonryItem key={asset._id}>
                      {isGalleryFolder ? (
                        /* ─── Gallery mode card — clean, image-focused ─── */
                        <div
                          role="button"
                          tabIndex={0}
                          data-asset-id={asset._id}
                          onClick={(e) => handleAssetClick(asset, e)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              handleAssetClick(
                                asset,
                                e as unknown as React.MouseEvent<HTMLDivElement>,
                              );
                            }
                          }}
                          className="group relative w-full overflow-hidden rounded-lg bg-dash-surface cursor-pointer transition hover:shadow-lg hover:ring-2 hover:ring-purple-400/40"
                        >
                          {isImage ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={
                                asset.thumbnailBase64 ||
                                asset.thumbnailUrl ||
                                asset.url ||
                                ''
                              }
                              alt={asset.name}
                              className="w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                              loading="lazy"
                            />
                          ) : (
                            (() => {
                              const ft = getFileTypeInfo(asset.mimeType);
                              if (!ft) return null;
                              const FileIcon = ft.icon;
                              return (
                                <div
                                  className={`flex w-full flex-col items-center justify-center gap-1.5 py-10 ${ft.bg}`}
                                >
                                  <FileIcon
                                    className={`h-10 w-10 ${ft.color}`}
                                  />
                                  <span
                                    className={`text-[10px] font-bold uppercase ${ft.color}`}
                                  >
                                    {ft.label}
                                  </span>
                                </div>
                              );
                            })()
                          )}
                          {/* Hover overlay with name */}
                          <div className="absolute inset-x-0 bottom-0 translate-y-full opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-200 bg-gradient-to-t from-black/70 via-black/40 to-transparent px-3 py-2.5 pt-8">
                            <p className="text-xs font-medium text-white truncate">
                              {asset.name}
                            </p>
                          </div>
                          {/* Star */}
                          {isAssetStarred && (
                            <div className="absolute right-2 top-2 z-10">
                              <Star
                                size={14}
                                className="fill-yellow-400 text-yellow-400 drop-shadow"
                              />
                            </div>
                          )}
                        </div>
                      ) : (
                        /* ─── Normal mode card ─── */
                        <div
                          role="button"
                          tabIndex={0}
                          data-asset-id={asset._id}
                          onClick={(e) => handleAssetClick(asset, e)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              handleAssetClick(
                                asset,
                                e as unknown as React.MouseEvent<HTMLDivElement>,
                              );
                            }
                          }}
                          draggable
                          onDragStart={(e) => handleDragStart(e, asset._id)}
                          className={`group relative w-full ${layoutMode === 'masonry' && isImage ? '' : 'aspect-square'} overflow-hidden rounded-xl border-2 bg-dash-surface transition hover:shadow-md hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer ${
                            isSelected
                              ? 'border-blue-500 ring-2 ring-blue-500/30'
                              : 'border-dash-border hover:border-dash-border '
                          }`}
                        >
                          {/* Selection checkbox */}
                          <div
                            className={`absolute left-2 top-2 z-10 flex h-5 w-5 items-center justify-center rounded border transition ${
                              isSelected
                                ? 'border-blue-500 bg-blue-500'
                                : 'border-dash-input-border bg-dash-surface/80 /80 opacity-0 group-hover:opacity-100'
                            }`}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSelect(asset._id);
                            }}
                          >
                            {isSelected && (
                              <Check className="h-3 w-3 text-white" />
                            )}
                          </div>

                          {/* Star indicator */}
                          {isAssetStarred && (
                            <div
                              className="absolute right-2 top-2 z-10"
                              data-testid="star-indicator"
                            >
                              <Star
                                size={14}
                                className="fill-yellow-400 text-yellow-400 drop-shadow"
                              />
                            </div>
                          )}

                          {/* Thumbnail or File Type Icon */}
                          {fileType ? (
                            (() => {
                              const FileIcon = fileType.icon;
                              const thumbSrc =
                                asset.thumbnailBase64 ||
                                asset.thumbnailUrl ||
                                '';
                              const hasThumb = hasAssetThumbnailPreview(asset);
                              const isVideo = isVideoMime(asset.mimeType);

                              // Videos/PDFs with thumbnails: show thumbnail + overlay badge
                              if (hasThumb) {
                                return (
                                  <div className="relative h-full w-full">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src={thumbSrc}
                                      alt={asset.name}
                                      className={`${layoutMode === 'masonry' ? 'w-full' : 'h-full w-full'} object-cover`}
                                      loading="lazy"
                                    />
                                    {/* Video play button overlay */}
                                    {isVideo && (
                                      <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black/60 backdrop-blur-sm transition group-hover:bg-black/80 group-hover:scale-110">
                                          <Play
                                            className="h-4 w-4 text-white ml-0.5"
                                            fill="white"
                                          />
                                        </div>
                                      </div>
                                    )}
                                    {/* Duration badge for videos */}
                                    {isVideo &&
                                      formatDuration(asset.duration) && (
                                        <div className="absolute bottom-1.5 right-1.5 z-10 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
                                          {formatDuration(asset.duration)}
                                        </div>
                                      )}
                                    {/* File type label badge */}
                                    {(() => {
                                      const extBadge = getExtensionBadge(
                                        asset.name,
                                        asset.mimeType,
                                      );
                                      return extBadge ? (
                                        <div
                                          className={`absolute bottom-1.5 left-1.5 z-10 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${fileType.bg} ${fileType.color}`}
                                        >
                                          {extBadge}
                                        </div>
                                      ) : null;
                                    })()}
                                  </div>
                                );
                              }

                              // No thumbnail: show file type icon
                              return (
                                <div
                                  className={`flex h-full w-full flex-col items-center justify-center gap-1.5 px-2 py-4 ${fileType.bg}`}
                                  title={asset.name}
                                >
                                  <FileIcon
                                    className={`h-10 w-10 ${fileType.color}`}
                                  />
                                  <span
                                    className={`text-[10px] font-bold uppercase ${fileType.color}`}
                                  >
                                    {fileType.label}
                                  </span>
                                  <span className="w-full truncate text-center text-[10px] text-dash-text2">
                                    {asset.name}
                                  </span>
                                </div>
                              );
                            })()
                          ) : (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={
                                asset.thumbnailBase64 ||
                                asset.thumbnailUrl ||
                                asset.url ||
                                ''
                              }
                              alt={asset.name}
                              className={`${layoutMode === 'masonry' ? 'w-full' : 'h-full w-full'} object-cover`}
                              loading="lazy"
                            />
                          )}

                          {/* Extension badge for non-image files without thumbnails */}
                          {fileType &&
                            previewInfo.showUnsupportedBadge && (
                              <span title={previewInfo.tooltip}>
                                <AlertTriangle className="absolute bottom-1.5 left-1.5 z-10 h-3.5 w-3.5 text-amber-500" />
                              </span>
                            )}

                          {/* Copy badge */}
                          {asset.isCopy && !isAssetStarred && (
                            <div className="absolute right-2 top-2 z-10 rounded-full bg-amber-500 px-1.5 py-0.5 text-[9px] font-bold text-white shadow">
                              COPY
                            </div>
                          )}

                          {/* DS-6.2 — Hover Quick Actions overlay */}
                          <HoverQuickActions
                            assetId={asset._id}
                            assetUrl={
                              asset.url || asset.thumbnailUrl || undefined
                            }
                            assetName={asset.name}
                            isStarred={isAssetStarred}
                            onEdit={onAssetEdit}
                            onShare={onAssetShare}
                            onDelete={onAssetDelete}
                            onStarToggle={handleStarToggle}
                          />
                        </div>
                      )}
                    </MasonryItem>
                  );
                })}
              </MasonryGrid>
            </div>
          );
        })}

        {/* Infinite scroll sentinel — always in DOM so observer stays attached */}
        <div
          ref={sentinelRef}
          className={
            hasMore ? 'flex justify-center py-6' : 'h-0 overflow-hidden'
          }
        >
          {hasMore && loadingMore && (
            <div className="flex items-center gap-2 text-sm text-dash-text-muted">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-dash-border border-t-primary " />
              Loading more…
            </div>
          )}
        </div>
      </div>

      {/* DS-6.4 — Slideshow overlay */}
      {slideshowActive && slideshowAssets.length > 0 && (
        <Slideshow
          assets={slideshowAssets}
          startIndex={slideshowStartIdx}
          onClose={() => setSlideshowActive(false)}
        />
      )}

      {/* Gallery mode — Lightbox viewer */}
      {lightboxActive && lightboxAssets.length > 0 && (
        <Lightbox
          assets={lightboxAssets}
          startIndex={lightboxStartIdx}
          onClose={() => setLightboxActive(false)}
        />
      )}
    </DragRectSelect>
  );
}
