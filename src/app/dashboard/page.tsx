// SPDX-License-Identifier: Apache-2.0
'use client';

import { useState, useCallback, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Sparkles, AlertTriangle, Loader2, Trash2, X } from 'lucide-react';
import { UploadQueue } from '@/components/dashboard/upload-queue';
import { AssetGrid, type AssetItem } from '@/components/dashboard/asset-grid';
import { AssetDrawer } from '@/components/dashboard/asset-drawer';
import {
  DashboardToolbar,
  type SearchMode,
} from '@/components/dashboard/toolbar';
import {
  BreadcrumbNav,
  type BreadcrumbItem,
} from '@/components/dashboard/breadcrumb-nav';
import { ImageOverlay } from '@/components/dashboard/image-overlay';
import { ShareDialog } from '@/components/dashboard/share-dialog';
import { FolderPickerDialog } from '@/components/dashboard/folder-picker-dialog';
import { AiGenerateDialog } from '@/components/dashboard/ai-generate-dialog';
import BatchFilterDialog from '@/components/dashboard/batch-filter-dialog';
import { useRole } from '@/components/dashboard/role-context';
import { useEmbedScope } from '@/app/embed/dashboard/embed-scope-context';

interface FolderInfo {
  _id: string;
  name: string;
  parentId: string | null;
  path: string;
}

export default function DashboardPage() {
  const { can } = useRole();
  const { folderScope } = useEmbedScope();
  const searchParams = useSearchParams();
  const dashboardRouter = useRouter();
  const faceHashFilter = searchParams.get('faceHash') || undefined;

  // Navigation state — start at folderScope if in embed mode
  const [folderId, setFolderId] = useState<string | null>(folderScope);
  const [refreshKey, setRefreshKey] = useState(0);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([]);
  const [allFolders, setAllFolders] = useState<FolderInfo[]>([]);

  // Search, sort, filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMode, setSearchMode] = useState<SearchMode>('text');
  const [isSemanticLoading, setIsSemanticLoading] = useState(false);
  const [colorFilter, setColorFilter] = useState('');
  const [sort, setSort] = useState('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [mimeType, setMimeType] = useState('');

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedFolderIds, setSelectedFolderIds] = useState<Set<string>>(
    new Set(),
  );

  // Folder operation dialogs
  const [folderShareTarget, setFolderShareTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [folderMoveTarget, setFolderMoveTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);

  // Overlay viewer state
  const [overlayAsset, setOverlayAsset] = useState<AssetItem | null>(null);

  // Drawer state (for detailed view)
  const [openAsset, setOpenAsset] = useState<AssetItem | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);

  // Batch share dialog
  const [showBatchShare, setShowBatchShare] = useState(false);

  // Batch move folder picker
  const [showBatchMove, setShowBatchMove] = useState(false);

  // Batch filter dialog (Sprint 11)
  const [showBatchFilter, setShowBatchFilter] = useState(false);

  // AI Generate dialog
  const [showAiGenerate, setShowAiGenerate] = useState(false);

  // Sprint 9: Find Similar state
  const [findSimilarAssetId, setFindSimilarAssetId] = useState<string | null>(
    null,
  );

  // AI Feature Config — controls whether generate button is shown
  const [isGenerateEnabled, setIsGenerateEnabled] = useState(true);
  useEffect(() => {
    async function loadFeatureConfig() {
      try {
        // Try session-auth settings first (main dashboard)
        let config: Record<string, { mode: string }> | null = null;
        const res = await fetch('/api/settings');
        if (res.ok) {
          const data = await res.json();
          config = data.settings?.aiFeatureConfig ?? data.aiFeatureConfig ?? null;
        } else {
          // Fallback: try token-auth (embed context) only if settings endpoint failed
          const meRes = await fetch('/api/v1/auth/me');
          if (meRes.ok) {
            const meData = await meRes.json();
            config = meData.aiFeatureConfig ?? null;
          }
        }
        if (config?.generate?.mode === 'disabled') {
          setIsGenerateEnabled(false);
        }
      } catch {
        // Default: enabled
      }
    }
    loadFeatureConfig();
  }, []);

  // Folder delete confirmation dialog
  const [folderDeleteTarget, setFolderDeleteTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [folderDeleting, setFolderDeleting] = useState(false);

  // Fetch all folders once for breadcrumb building
  useEffect(() => {
    fetch('/api/folders')
      .then((r) => r.json())
      .then((data) => setAllFolders(data.folders ?? []))
      .catch(() => {});
  }, [refreshKey]);

  // Build breadcrumb path when folderId changes
  useEffect(() => {
    if (!folderId || folderId === folderScope) {
      // At root or at the scoped root — no breadcrumb trail needed
      setBreadcrumbs([]);
      return;
    }

    // Build path by walking up the parent chain, stopping at folderScope if set
    const path: BreadcrumbItem[] = [];
    let currentId: string | null = folderId;

    while (currentId && currentId !== folderScope) {
      const folder = allFolders.find(
        (f) => (f._id as unknown as string).toString() === currentId,
      );
      if (folder) {
        path.unshift({ id: folder._id.toString(), name: folder.name });
        currentId = folder.parentId ? folder.parentId.toString() : null;
      } else {
        break;
      }
    }

    setBreadcrumbs(path);
  }, [folderId, allFolders, folderScope]);

  // Full refresh
  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
    setSelectedIds(new Set());
    setSelectedFolderIds(new Set());
  }, []);

  const handleMetadataUpdated = useCallback(async () => {
    refresh();

    if (!openAsset) return;

    try {
      const res = await fetch(`/api/assets/${openAsset._id}`);
      if (!res.ok) return;

      const data = await res.json();
      if (!data.asset) return;

      setOpenAsset((prev) =>
        prev?._id === openAsset._id ? { ...prev, ...data.asset } : prev,
      );
      setOverlayAsset((prev) =>
        prev?._id === openAsset._id ? { ...prev, ...data.asset } : prev,
      );
    } catch (err) {
      console.error('[Dashboard] Error refreshing metadata:', err);
    }
  }, [openAsset, refresh]);

  const handleAssetUpdated = useCallback(async () => {
    refresh();

    if (!openAsset) return;

    try {
      const res = await fetch(`/api/assets/${openAsset._id}`);
      if (!res.ok) return;

      const data = await res.json();
      if (!data.asset) return;

      setOpenAsset((prev) =>
        prev?._id === openAsset._id ? { ...prev, ...data.asset } : prev,
      );
      setOverlayAsset((prev) =>
        prev?._id === openAsset._id ? { ...prev, ...data.asset } : prev,
      );
    } catch (err) {
      console.error('[Dashboard] Error refreshing asset detail:', err);
    }
  }, [openAsset, refresh]);

  // Opens the full detail drawer (from overlay or directly)
  const handleOpenDrawer = useCallback(async (asset: AssetItem) => {
    setOverlayAsset(null);
    setOpenAsset(asset);
    setDrawerLoading(true);

    try {
      const res = await fetch(`/api/assets/${asset._id}`);
      if (res.ok) {
        const data = await res.json();
        setOpenAsset((prev) =>
          prev?._id === asset._id ? { ...prev, ...data.asset } : prev,
        );
      }
    } catch (err) {
      console.error('[Dashboard] Error fetching asset detail:', err);
    } finally {
      setDrawerLoading(false);
    }
  }, []);

  // Opens the detail drawer directly (optimized: thumbnail preview, no full image load)
  const handleAssetOpen = useCallback(
    (gridAsset: AssetItem) => {
      handleOpenDrawer(gridAsset);
    },
    [handleOpenDrawer],
  );

  // Opens image in overlay viewer (normal mode, from drawer)
  const handleOpenOverlay = useCallback(() => {
    if (openAsset) {
      setOverlayAsset(openAsset);
    }
  }, [openAsset]);

  // Navigate to folder
  const handleFolderOpen = useCallback((id: string) => {
    setFolderId(id);
    setSelectedIds(new Set());
    setSelectedFolderIds(new Set());
  }, []);

  // Breadcrumb navigation (respect folder scope — prevent navigating above scoped root)
  const handleBreadcrumbNavigate = useCallback(
    (id: string | null) => {
      // If scoped, don't allow navigating to root (null) or above the scope folder
      if (folderScope && id === null) {
        setFolderId(folderScope);
      } else {
        setFolderId(id);
      }
      setSelectedIds(new Set());
      setSelectedFolderIds(new Set());
    },
    [folderScope],
  );

  const handleSortChange = useCallback(
    (newSort: string, newDir: 'asc' | 'desc') => {
      setSort(newSort);
      setSortDir(newDir);
    },
    [],
  );

  const handleBatchDelete = useCallback(async () => {
    if (selectedIds.size === 0) return;
    if (
      !confirm(
        `Delete ${selectedIds.size} asset${selectedIds.size > 1 ? 's' : ''}?`,
      )
    )
      return;

    try {
      await fetch('/api/assets/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', ids: [...selectedIds] }),
      });
      refresh();
    } catch (err) {
      console.error('Batch delete failed:', err);
    }
  }, [selectedIds, refresh]);

  const handleBatchMove = useCallback(async () => {
    setShowBatchMove(true);
  }, []);

  const handleBatchMoveConfirm = useCallback(
    async (targetFolderId: string | null) => {
      if (selectedIds.size === 0) return;
      try {
        await fetch('/api/assets/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'move',
            ids: [...selectedIds],
            folderId: targetFolderId,
          }),
        });
        refresh();
      } catch (err) {
        console.error('Batch move failed:', err);
      }
    },
    [selectedIds, refresh],
  );

  const handleBatchShare = useCallback(() => {
    setShowBatchShare(true);
  }, []);

  const handleBatchFilter = useCallback(() => {
    setShowBatchFilter(true);
  }, []);

  // Folder operation handlers
  const handleFolderRename = useCallback(
    async (folderId: string, newName: string) => {
      try {
        const res = await fetch(`/api/folders/${folderId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: newName }),
        });
        if (res.ok) refresh();
      } catch (err) {
        console.error('Folder rename failed:', err);
      }
    },
    [refresh],
  );

  const handleFolderDelete = useCallback((folderId: string, name: string) => {
    setFolderDeleteTarget({ id: folderId, name });
  }, []);

  const confirmFolderDelete = useCallback(async () => {
    if (!folderDeleteTarget) return;
    setFolderDeleting(true);
    try {
      const res = await fetch(`/api/folders/${folderDeleteTarget.id}`, {
        method: 'DELETE',
      });
      if (res.ok) refresh();
    } catch (err) {
      console.error('Folder delete failed:', err);
    } finally {
      setFolderDeleting(false);
      setFolderDeleteTarget(null);
    }
  }, [folderDeleteTarget, refresh]);

  const handleFolderMove = useCallback((id: string, name: string) => {
    setFolderMoveTarget({ id, name });
  }, []);

  const handleFolderMoveConfirm = useCallback(
    async (targetParentId: string | null) => {
      if (!folderMoveTarget) return;
      try {
        await fetch(`/api/folders/${folderMoveTarget.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ parentId: targetParentId }),
        });
        refresh();
      } catch (err) {
        console.error('Folder move failed:', err);
      } finally {
        setFolderMoveTarget(null);
      }
    },
    [folderMoveTarget, refresh],
  );

  const handleFolderShare = useCallback((id: string, name: string) => {
    setFolderShareTarget({ id, name });
  }, []);

  // Folder access settings dialog state
  const [folderAccessTarget, setFolderAccessTarget] = useState<{
    id: string;
    name: string;
    mode: 'restricted' | 'flexible';
  } | null>(null);
  const [savingFolderAccess, setSavingFolderAccess] = useState(false);

  const handleFolderAccessChange = useCallback(
    (folderId: string, folderName: string) => {
      const folder = allFolders.find((f) => f._id === folderId);
      const mode =
        (folder as unknown as { accessMode?: string })?.accessMode ===
        'restricted'
          ? 'restricted'
          : 'flexible';
      setFolderAccessTarget({
        id: folderId,
        name: folderName,
        mode: mode as 'restricted' | 'flexible',
      });
    },
    [allFolders],
  );

  const saveFolderAccess = useCallback(
    async (cascade: boolean) => {
      if (!folderAccessTarget) return;
      setSavingFolderAccess(true);
      try {
        const res = await fetch(
          `/api/folders/${folderAccessTarget.id}/access`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              accessMode: folderAccessTarget.mode,
              cascade,
            }),
          },
        );
        if (!res.ok) throw new Error('Failed to update');
        setFolderAccessTarget(null);
        refresh();
      } catch (err) {
        console.error('[Dashboard] Error updating folder access:', err);
      } finally {
        setSavingFolderAccess(false);
      }
    },
    [folderAccessTarget, refresh],
  );

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-dash-border px-6 py-4">
        <div>
          <h1 className="text-xl font-semibold text-dash-text">Assets</h1>
          <p className="mt-0.5 text-xs text-dash-text2">
            Upload and manage your image library.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {can('upload') && (
            <button
              onClick={() => setShowAiGenerate(true)}
              disabled={!isGenerateEnabled}
              className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 px-3.5 py-2 text-sm font-medium text-white transition hover:from-violet-700 hover:to-fuchsia-700 disabled:cursor-not-allowed disabled:opacity-50"
              title={
                isGenerateEnabled
                  ? 'AI Image Generator'
                  : 'AI image generation is disabled in settings'
              }
            >
              <Sparkles className="h-4 w-4" />
              <span className="hidden sm:inline">
                {isGenerateEnabled ? 'AI Generate' : 'AI Disabled'}
              </span>
            </button>
          )}
          {can('upload') && (
            <UploadQueue folderId={folderId} onUploadComplete={refresh} />
          )}
        </div>
      </div>

      {/* Breadcrumb Navigation */}
      {(breadcrumbs.length > 0 || folderId) && (
        <div className="border-b border-dash-border px-6 py-2">
          <BreadcrumbNav
            items={breadcrumbs}
            onNavigate={handleBreadcrumbNavigate}
          />
        </div>
      )}

      {/* Toolbar */}
      <DashboardToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchMode={searchMode}
        onSearchModeChange={setSearchMode}
        isSemanticLoading={isSemanticLoading}
        sort={sort}
        sortDir={sortDir}
        onSortChange={handleSortChange}
        mimeType={mimeType}
        onMimeTypeChange={setMimeType}
        colorFilter={colorFilter}
        onColorFilterChange={setColorFilter}
        totalSelected={selectedIds.size + selectedFolderIds.size}
        onClearSelection={() => {
          setSelectedIds(new Set());
          setSelectedFolderIds(new Set());
        }}
        onBatchDelete={can('delete') ? handleBatchDelete : undefined}
        onBatchMove={can('edit') ? handleBatchMove : undefined}
        onBatchShare={can('share') ? handleBatchShare : undefined}
        onBatchFilter={can('edit') ? handleBatchFilter : undefined}
      />

      {/* Person Filter Banner */}
      {faceHashFilter && (
        <div className="flex items-center gap-2 border-b border-violet-100 dark:border-violet-900/50 bg-violet-50 dark:bg-violet-950/30 px-6 py-2">
          <span className="text-sm text-violet-700 dark:text-violet-400">
            🔍 Filtering by person
          </span>
          <button
            onClick={() => dashboardRouter.push('/dashboard')}
            className="rounded bg-[var(--im-primary-light)] dark:bg-[var(--im-primary)]/20 px-2 py-0.5 text-xs font-medium text-[var(--im-primary)] hover:bg-[var(--im-primary)]/20 dark:hover:bg-[var(--im-primary)]/30 transition"
          >
            Clear Filter ✕
          </button>
        </div>
      )}

      {/* Asset Grid (File Explorer style — folders + files) */}
      <div className="flex-1 overflow-y-auto">
        <AssetGrid
          folderId={folderId}
          refreshKey={refreshKey}
          searchQuery={searchQuery}
          sort={sort}
          sortDir={sortDir}
          mimeType={mimeType}
          faceHash={faceHashFilter}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          onAssetOpen={handleAssetOpen}
          onFolderOpen={handleFolderOpen}
          selectedFolderIds={selectedFolderIds}
          onFolderSelectionChange={setSelectedFolderIds}
          onFolderRename={handleFolderRename}
          onFolderMove={can('edit') ? handleFolderMove : undefined}
          onFolderDelete={can('delete') ? handleFolderDelete : undefined}
          onFolderShare={can('share') ? handleFolderShare : undefined}
          onFolderAccessChange={
            can('manage_settings') ? handleFolderAccessChange : undefined
          }
          searchMode={searchMode}
          onSemanticLoadingChange={setIsSemanticLoading}
          findSimilarAssetId={findSimilarAssetId}
          onFindSimilarClear={() => setFindSimilarAssetId(null)}
          colorFilter={colorFilter}
        />
      </div>

      {/* Image Overlay Viewer (Normal View from Drawer) */}
      {overlayAsset && (
        <ImageOverlay
          src={overlayAsset.thumbnailBase64 || overlayAsset.url || ''}
          alt={overlayAsset.name}
          assetId={overlayAsset._id}
          mimeType={overlayAsset.mimeType}
          onClose={() => setOverlayAsset(null)}
          onRefresh={refresh}
        />
      )}

      {/* Asset Detail Drawer */}
      {openAsset && (
        <AssetDrawer
          asset={openAsset}
          loading={drawerLoading}
          onClose={() => setOpenAsset(null)}
          onAssetUpdated={handleAssetUpdated}
          onMetadataUpdated={handleMetadataUpdated}
          onAssetDeleted={refresh}
          onOpenOverlay={handleOpenOverlay}
          onFindSimilar={(assetId) => {
            setFindSimilarAssetId(assetId);
            setSearchMode('semantic');
          }}
        />
      )}

      {/* Batch Share Dialog — multi-asset sharing */}
      {showBatchShare && selectedIds.size > 0 && (
        <ShareDialog
          open={showBatchShare}
          onClose={() => setShowBatchShare(false)}
          targetType="asset"
          targetIds={[...selectedIds]}
          targetName={`${selectedIds.size} selected asset${selectedIds.size > 1 ? 's' : ''}`}
        />
      )}

      {/* Batch Move — Folder Picker Dialog */}
      {showBatchMove && (
        <FolderPickerDialog
          open={showBatchMove}
          onClose={() => setShowBatchMove(false)}
          onSelect={handleBatchMoveConfirm}
          title="Move assets"
          description={`Move ${selectedIds.size} selected asset${selectedIds.size > 1 ? 's' : ''}`}
          showRoot
        />
      )}

      {/* Sprint 11: Batch Filter Dialog */}
      {showBatchFilter && selectedIds.size > 0 && (
        <BatchFilterDialog
          assetIds={[...selectedIds]}
          onClose={() => setShowBatchFilter(false)}
          onComplete={() => {
            setSelectedIds(new Set());
            refresh();
          }}
        />
      )}

      {/* AI Image Generator Dialog */}
      {showAiGenerate && (
        <AiGenerateDialog
          open={showAiGenerate}
          onClose={() => setShowAiGenerate(false)}
          folderId={folderId}
          onGenerated={() => refresh()}
        />
      )}

      {/* Folder Share Dialog */}
      {folderShareTarget && (
        <ShareDialog
          open={!!folderShareTarget}
          onClose={() => setFolderShareTarget(null)}
          targetType="folder"
          targetIds={[folderShareTarget.id]}
          targetName={folderShareTarget.name}
        />
      )}

      {/* Folder Move — Folder Picker Dialog */}
      {folderMoveTarget && (
        <FolderPickerDialog
          open={!!folderMoveTarget}
          onClose={() => setFolderMoveTarget(null)}
          onSelect={handleFolderMoveConfirm}
          title="Move folder"
          description={`Move "${folderMoveTarget.name}"to another folder`}
          excludeIds={[folderMoveTarget.id]}
          showRoot
        />
      )}

      {/* ─── Folder Delete Confirmation Dialog ─── */}
      {folderDeleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-md rounded-2xl bg-dash-surface p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-950/50">
                  <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
                </div>
                <h2 className="text-base font-bold text-dash-text">
                  Delete Folder
                </h2>
              </div>
              <button
                onClick={() => setFolderDeleteTarget(null)}
                className="rounded p-1 text-dash-text-muted transition hover:bg-dash-surface-hover"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mb-2 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/50 px-4 py-3">
              <p className="text-sm font-medium text-red-800 dark:text-red-300">
                Are you sure you want to delete &ldquo;{folderDeleteTarget.name}
                &rdquo;?
              </p>
              <p className="mt-1.5 text-xs text-red-600/80 dark:text-red-400/80 leading-relaxed">
                This action is <strong>permanent and irreversible</strong>.
                Deleting this folder will also delete:
              </p>
              <ul className="mt-2 space-y-1 text-xs text-red-600/80 dark:text-red-400/80">
                <li className="flex items-center gap-1.5">
                  • All nested sub-folders
                </li>
                <li className="flex items-center gap-1.5">
                  • All images and assets inside
                </li>
                <li className="flex items-center gap-1.5">
                  • Any shared links pointing to this folder
                </li>
              </ul>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                onClick={confirmFolderDelete}
                disabled={folderDeleting}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
              >
                {folderDeleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                {folderDeleting ? 'Deleting…' : 'Delete Permanently'}
              </button>
              <button
                onClick={() => setFolderDeleteTarget(null)}
                disabled={folderDeleting}
                className="rounded-lg border border-dash-input-border px-5 py-2.5 text-sm font-medium text-dash-text2 transition hover:border-dash-border-hover disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Folder Access Settings Dialog */}
      {folderAccessTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setFolderAccessTarget(null)}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-dash-border bg-dash-surface p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-3 text-sm font-semibold text-dash-text">
              Access Mode for{' '}
              <span className="font-medium">{folderAccessTarget.name}</span>
            </h3>
            <label
              className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition mb-2 ${folderAccessTarget.mode === 'flexible' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' : 'border-dash-border hover:border-dash-input-border'}`}
            >
              <input
                type="radio"
                name="folderAccessMode"
                value="flexible"
                checked={folderAccessTarget.mode === 'flexible'}
                onChange={() =>
                  setFolderAccessTarget((prev) =>
                    prev ? { ...prev, mode: 'flexible' } : null,
                  )
                }
                className="accent-emerald-600"
              />
              <div>
                <p className="text-sm font-medium text-dash-text">Flexible</p>
                <p className="text-xs text-dash-text2">
                  All org members can view this folder
                </p>
              </div>
            </label>
            <label
              className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition ${folderAccessTarget.mode === 'restricted' ? 'border-red-500 bg-red-50 dark:bg-red-900/20' : 'border-dash-border hover:border-dash-input-border'}`}
            >
              <input
                type="radio"
                name="folderAccessMode"
                value="restricted"
                checked={folderAccessTarget.mode === 'restricted'}
                onChange={() =>
                  setFolderAccessTarget((prev) =>
                    prev ? { ...prev, mode: 'restricted' } : null,
                  )
                }
                className="accent-red-600"
              />
              <div>
                <p className="text-sm font-medium text-dash-text">Restricted</p>
                <p className="text-xs text-dash-text2">
                  Only allowed members/groups can access
                </p>
              </div>
            </label>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                onClick={() => setFolderAccessTarget(null)}
                className="rounded-lg border border-dash-border px-3 py-1 text-xs text-dash-text2 hover:bg-dash-muted transition"
              >
                Cancel
              </button>
              <button
                onClick={() => saveFolderAccess(false)}
                disabled={savingFolderAccess}
                className="rounded-lg bg-[var(--im-primary)] px-3 py-1 text-xs font-medium text-[var(--im-primary-fg)] transition hover:bg-[var(--im-primary)]/90 disabled:opacity-50"
              >
                {savingFolderAccess ? 'Saving…' : 'Save'}
              </button>
              <button
                onClick={() => saveFolderAccess(true)}
                disabled={savingFolderAccess}
                className="rounded-lg border border-[var(--im-primary)] px-3 py-1 text-xs font-medium text-[var(--im-primary)] transition hover:bg-[var(--im-primary-light)] disabled:opacity-50"
              >
                {savingFolderAccess ? 'Saving…' : 'Save & Apply to Children'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
