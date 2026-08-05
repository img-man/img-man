// SPDX-License-Identifier: Apache-2.0
'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  X,
  Download,
  Trash2,
  FolderInput,
  Pencil,
  Plus,
  Tag,
  Loader2,
  ScanFace,
  Maximize2,
  RotateCcw,
  ChevronDown,
  Save,
  FilePlus2,
  User,
  Bot,
  Info,
  Sparkles,
  Expand,
  Share2,
  History,
  Eraser,
  ArrowUpCircle,
  CheckCircle2,
  XCircle,
  Copy,
  Eye,
  ExternalLink,
  AlertTriangle,
  Zap,
  BarChart3,
  SlidersHorizontal,
  Clock,
  Check,
  Minus,
  type LucideIcon,
} from 'lucide-react';
import AiBadge from '@/components/ai-badge';
import { toAbsoluteAssetUrl } from '@/lib/asset-url';
import { ImageViewer } from './image-viewer';
import { ShareDialog } from './share-dialog';
import { TransformPreview } from './transform-preview';
import { PdfViewer } from './pdf-viewer';
import { VideoPlayer } from './video-player';
import { TextViewer } from './text-viewer';
import { CsvViewer } from './csv-viewer';
import { AudioPlayer } from './audio-player';
import { SpreadsheetViewer } from './spreadsheet-viewer';
import { DocxViewer } from './docx-viewer';
import { PresentationViewer } from './presentation-viewer';
import { DocumentTextViewer } from './document-text-viewer';
import { OfficeFallbackViewer } from './office-fallback-viewer';
import { EditHistoryPanel } from './edit-history-panel';
import { useRole } from '@/components/dashboard/role-context';
import { getFileTypeInfo } from '@/lib/file-types';
import {
  formatAssetCategoryLabel,
  formatAssetDuration,
  formatMetadataKeyLabel,
  formatAssetSize,
  getAssetCountLabel,
  getAssetInsightSummary,
  getAssetPreviewStatusLabel,
} from '@/lib/asset-metadata';
import {
  getAssetPreviewInfo,
  UNSUPPORTED_PREVIEW_TOOLTIP,
} from '@/lib/asset-preview';
import { useAiFeatureAccess } from '@/lib/use-ai-feature-access';

/* ─── Types ──────────────────────────────────────────────────── */

interface FolderOption {
  _id: string;
  name: string;
}

interface FaceData {
  faceHash: string;
  confidence: number;
  boundingBox: { x: number; y: number; w: number; h: number };
  emotion?: string;
}

interface AssetVariant {
  key: string;
  storageKey: string;
  width?: number;
  height?: number;
  format?: string;
  sizeBytes?: number;
}

interface AssetExifData {
  camera?: string;
  lens?: string;
  iso?: number;
  aperture?: string;
  shutter?: string;
  focalLength?: number;
  dateTime?: string;
  gps?: { latitude: number; longitude: number };
}

function formatVariantSummary(variant: AssetVariant): string {
  const parts: string[] = [];

  if (variant.format) {
    parts.push(variant.format.toUpperCase());
  }

  if (variant.width && variant.height) {
    parts.push(`${variant.width} × ${variant.height}`);
  }

  if (variant.sizeBytes != null) {
    parts.push(formatAssetSize(variant.sizeBytes));
  }

  return parts.join(' • ') || 'Derived output';
}

interface AssetDrawerProps {
  asset: {
    _id: string;
    name: string;
    originalName?: string;
    storageKey?: string;
    mimeType: string;
    sizeBytes: number;
    width?: number;
    height?: number;
    duration?: number;
    pageCount?: number;
    fileCategory?: string;
    isPublic?: boolean;
    url?: string; // Signed URL — loaded on-demand when drawer opens
    downloadUrl?: string; // Same-origin proxy URL for fetch-based previews
    publicUrl?: string; // Stable ImageMan-domain URL (redirects to signed)
    thumbnailUrl?: string | null;
    thumbnailBase64?: string | null; // Inline base64 from grid for instant preview
    integrityStatus?: 'ok' | 'thumbnail-fallback' | 'missing';
    originalExists?: boolean;
    thumbnailExists?: boolean;
    tags: string[];
    userTags?: string[];
    aiTagsGenerated?: boolean;
    originalAiTags?: string[];
    faces?: FaceData[];
    createdAt: string;
    folderId?: string;
    isCopy?: boolean;
    copyOfAssetId?: string;
    variants?: AssetVariant[];
    customMetadata?: Record<string, string>;
    dominantColors?: string[];
    exif?: AssetExifData | null;
  };
  loading?: boolean; // True while signed URL is being fetched
  onClose: () => void;
  onAssetUpdated?: () => void;
  onMetadataUpdated?: () => void;
  onAssetDeleted?: () => void;
  onOpenOverlay?: () => void;
  /** Sprint 9: "Find Similar" — trigger visual similarity search */
  onFindSimilar?: (assetId: string) => void;
}

type AssetAnalyticsResponse =
  | {
      enabled: false;
    }
  | {
      enabled: true;
      assetId?: string;
      totals?: {
        views: number;
        failures: number;
        bytesServed: number;
        lastAccessedAt: string | null;
        lastFailureAt: string | null;
      };
      byCountry?: Record<string, number>;
      byReferer?: Record<string, number>;
      byStatus?: Record<string, number>;
      byTransform?: Record<string, number>;
      weekly?: unknown[];
      monthly?: unknown[];
      raw?: unknown[];
      rawCount?: number;
    };

/* ─── Presets ─────────────────────────────────────────────────── */

const SIZE_PRESETS = [
  { label: 'Small (480px)', value: 'small', maxDim: 480 },
  { label: 'Medium (1024px)', value: 'medium', maxDim: 1024 },
  { label: 'Large (1920px)', value: 'large', maxDim: 1920 },
];

/** Build dynamic download options based on asset dimensions */
function getDownloadOptions(
  width?: number,
  height?: number,
  mimeType?: string,
) {
  const isImage = mimeType?.startsWith('image/');
  if (!isImage) {
    // For non-image files, only offer direct download (no resize options)
    return [
      {
        label: 'Download',
        value: 'original',
        desc: mimeType?.split('/').pop()?.toUpperCase() ?? 'File',
      },
    ];
  }

  const maxDim = Math.max(width ?? 0, height ?? 0);
  const originalDesc =
    width && height ? `${width}×${height}` : 'Full resolution';
  const options = [
    { label: 'Original', value: 'original', desc: originalDesc },
  ];

  for (const preset of SIZE_PRESETS) {
    if (maxDim > preset.maxDim) {
      options.push({
        label: preset.label,
        value: preset.value,
        desc: `${preset.maxDim}×${preset.maxDim} max`,
      });
    }
  }

  return options;
}

/* ─── URL info tooltip ───────────────────────────────────────────
 * Small hover/focus popover explaining the tradeoff between the direct
 * storage link and the img-man redirect link. Built inline rather than
 * pulled from a UI kit — there's no existing tooltip primitive in this
 * codebase and a native `title` attribute can't render a bullet list.
 */

interface UrlInfoPoint {
  icon: LucideIcon;
  positive: boolean;
  text: string;
}

const PUBLIC_URL_INFO: UrlInfoPoint[] = [
  { icon: Zap, positive: true, text: 'Faster — goes straight to storage, no redirect hop.' },
  { icon: Clock, positive: false, text: 'Expires — a signed link, valid for a limited time. Reopen this drawer for a fresh one.' },
  { icon: Minus, positive: false, text: 'Not tracked — bypasses img-man analytics.' },
];

const IMGMAN_URL_INFO: UrlInfoPoint[] = [
  { icon: Check, positive: true, text: 'Stable — never expires, safe to store or hardcode.' },
  { icon: SlidersHorizontal, positive: true, text: 'Transforms — resize, crop, or reformat via query params.' },
  { icon: BarChart3, positive: true, text: 'Analytics — views count toward this asset’s usage.' },
  { icon: Clock, positive: false, text: 'A touch slower — redirects to a signed link before the asset streams.' },
];

function InfoTooltip({ title, points }: { title: string; points: UrlInfoPoint[] }) {
  const [open, setOpen] = useState(false);

  return (
    <span
      className="relative inline-flex shrink-0"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-center rounded-full p-0.5 text-dash-text-muted transition hover:text-dash-text2"
        aria-label={`About the ${title}`}
      >
        <Info className="h-3 w-3" />
      </button>
      {open && (
        <div
          role="tooltip"
          className="absolute left-0 top-full z-20 mt-1.5 w-60 max-w-[80vw] rounded-lg border border-dash-border bg-dash-surface p-2.5 text-left shadow-xl"
        >
          <p className="text-[11px] font-semibold text-dash-text">{title}</p>
          <ul className="mt-1.5 space-y-1.5">
            {points.map((point, i) => {
              const PointIcon = point.icon;
              return (
                <li key={i} className="flex items-start gap-1.5">
                  <PointIcon
                    className={`mt-0.5 h-3 w-3 shrink-0 ${
                      point.positive
                        ? 'text-emerald-500 dark:text-emerald-400'
                        : 'text-dash-text-muted'
                    }`}
                  />
                  <span className="text-[10px] leading-snug text-dash-text2">
                    {point.text}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </span>
  );
}

/* ─── Component ───────────────────────────────────────────────── */

export function AssetDrawer({
  asset,
  loading: urlLoading,
  onClose,
  onAssetUpdated,
  onMetadataUpdated,
  onAssetDeleted,
  onOpenOverlay,
  onFindSimilar,
}: AssetDrawerProps) {
  // Role-based gating
  const { can, orgSlug } = useRole();
  const { isFeatureEnabled } = useAiFeatureAccess();
  const canEdit = can('edit');
  const canDelete = can('delete');
  const canAI = can('ai');
  const canShare = can('share');
  const autoTagEnabled = isFeatureEnabled('auto_tag');
  const faceDetectEnabled = isFeatureEnabled('face_detect');
  const bgRemoveEnabled = isFeatureEnabled('bg_remove');
  const upscaleEnabled = isFeatureEnabled('upscale');
  const expandEnabled = isFeatureEnabled('expand');
  const imageEditEnabled = isFeatureEnabled('edit');
  const hasAnyAssetAiTool =
    faceDetectEnabled ||
    bgRemoveEnabled ||
    upscaleEnabled ||
    expandEnabled ||
    imageEditEnabled;
  const hasAnyCreativeAiAction =
    bgRemoveEnabled || upscaleEnabled || expandEnabled || imageEditEnabled;

  // Core state
  const [name, setName] = useState(asset.name);
  const [isEditingName, setIsEditingName] = useState(false);
  const [isPublicLink, setIsPublicLink] = useState(asset.isPublic ?? true);
  const [aiTags, setAiTags] = useState<string[]>(asset.tags ?? []);
  const [userTags, setUserTags] = useState<string[]>(asset.userTags ?? []);
  const [newTag, setNewTag] = useState('');
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [showMoveMenu, setShowMoveMenu] = useState(false);
  const [folders, setFolders] = useState<FolderOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // AI state
  const [autoTagging, setAutoTagging] = useState(false);
  const [aiTagsGenerated, setAiTagsGenerated] = useState(
    asset.aiTagsGenerated ?? false,
  );
  const [faceDetecting, setFaceDetecting] = useState(false);
  const [faces, setFaces] = useState<FaceData[]>(asset.faces ?? []);

  // AI actions state
  const [bgRemoving, setBgRemoving] = useState(false);
  const [upscaling, setUpscaling] = useState(false);
  const [expanding, setExpanding] = useState(false);
  const [aiActionResult, setAiActionResult] = useState<{
    type: string;
    status: string;
    message: string;
  } | null>(null);

  // Edit with AI state
  const [showAiEdit, setShowAiEdit] = useState(false);
  const [aiEditPrompt, setAiEditPrompt] = useState('');
  const [aiEditing, setAiEditing] = useState(false);
  const [aiEditPreview, setAiEditPreview] = useState<string | null>(null);
  const [showAiActionsPanel, setShowAiActionsPanel] = useState(false);

  // Resize state
  const [showResizePanel, setShowResizePanel] = useState(false);
  const [resizeW, setResizeW] = useState(asset.width ?? 800);
  const [resizeH, setResizeH] = useState(asset.height ?? 600);
  const [resizing, setResizing] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  // Download state
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Copy feedback state
  const [copiedField, setCopiedField] = useState<
    'id' | 'directUrl' | 'imgmanUrl' | null
  >(null);

  // Fullscreen viewer state
  const [showViewer, setShowViewer] = useState(false);

  // Share dialog state
  const [showShare, setShowShare] = useState(false);
  const [hardDeleting, setHardDeleting] = useState(false);

  const primaryImageUrl =
    asset.publicUrl || asset.url || asset.thumbnailUrl || asset.thumbnailBase64 || '';
  const previewFallbackUrl =
    asset.thumbnailBase64 || asset.thumbnailUrl || primaryImageUrl;
  const [previewImageSrc, setPreviewImageSrc] = useState(previewFallbackUrl);

  // Copy asset state
  const [copying, setCopying] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  // Experimental asset analytics (disabled by default)
  const [assetAnalytics, setAssetAnalytics] =
    useState<AssetAnalyticsResponse | null>(null);

  const nameInputRef = useRef<HTMLInputElement>(null);
  const tagInputRef = useRef<HTMLInputElement>(null);

  // Sync when asset prop changes
  useEffect(() => {
    setName(asset.name);
    setIsPublicLink(asset.isPublic ?? true);
    setAiTags(asset.tags ?? []);
    setUserTags(asset.userTags ?? []);
    setAiTagsGenerated(asset.aiTagsGenerated ?? false);
    setFaces(asset.faces ?? []);
    setResizeW(asset.width ?? 800);
    setResizeH(asset.height ?? 600);
    setIsEditingName(false);
    setIsAddingTag(false);
    setConfirmDelete(false);
    setShowMoveMenu(false);
    setShowResizePanel(false);
    setShowAiActionsPanel(false);
    setShowAiEdit(false);
    setAiActionResult(null);
    setShowDownloadMenu(false);
    setShowSaveDialog(false);
    setShowViewer(false);
    setHardDeleting(false);
    setPreviewImageSrc(previewFallbackUrl);
    setAssetAnalytics(null);
  }, [
    asset._id,
    asset.name,
    asset.isPublic,
    asset.tags,
    asset.userTags,
    asset.aiTagsGenerated,
    asset.faces,
    asset.width,
    asset.height,
    previewFallbackUrl,
  ]);

  useEffect(() => {
    if (!asset.mimeType.startsWith('image/')) {
      return;
    }

    if (!primaryImageUrl || primaryImageUrl === previewFallbackUrl) {
      return;
    }

    let active = true;
    const img = new Image();
    img.onload = () => {
      if (active) {
        setPreviewImageSrc(primaryImageUrl);
      }
    };
    img.onerror = () => {
      if (active) {
        setPreviewImageSrc(previewFallbackUrl);
      }
    };
    img.src = primaryImageUrl;

    return () => {
      active = false;
      img.onload = null;
      img.onerror = null;
    };
  }, [asset._id, asset.mimeType, primaryImageUrl, previewFallbackUrl]);

  useEffect(() => {
    let cancelled = false;

    async function loadAssetAnalytics() {
      try {
        const res = await fetch(`/api/assets/${asset._id}/analytics`);
        if (!res.ok) return;

        const data = (await res.json()) as AssetAnalyticsResponse;
        if (!cancelled) {
          setAssetAnalytics(data);
        }
      } catch {
        if (!cancelled) {
          setAssetAnalytics(null);
        }
      }
    }

    void loadAssetAnalytics();

    return () => {
      cancelled = true;
    };
  }, [asset._id]);

  const sizeLabel =
    asset.sizeBytes < 1024 * 1024
      ? `${(asset.sizeBytes / 1024).toFixed(1)} KB`
      : `${(asset.sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
  const fetchableAssetUrl = asset.downloadUrl || asset.url;

  /* ─── Rename ─────────────────────────────────────────────────── */
  const handleRename = useCallback(async () => {
    if (!name.trim() || name === asset.name) {
      setName(asset.name);
      setIsEditingName(false);
      return;
    }
    setSaving(true);
    try {
      await fetch(`/api/assets/${asset._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });
      setIsEditingName(false);
      onMetadataUpdated?.();
    } catch (err) {
      console.error('Rename failed:', err);
    } finally {
      setSaving(false);
    }
  }, [name, asset._id, asset.name, onMetadataUpdated]);

  const handleLinkPrivacyToggle = useCallback(async () => {
    if (!canEdit || saving) {
      return;
    }

    const previousValue = isPublicLink;
    const nextValue = !previousValue;

    setIsPublicLink(nextValue);
    setSaving(true);

    try {
      const res = await fetch(`/api/assets/${asset._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublic: nextValue }),
      });

      if (!res.ok) {
        throw new Error('Failed to update asset link privacy.');
      }

      onMetadataUpdated?.();
    } catch (err) {
      console.error('Asset link privacy update failed:', err);
      setIsPublicLink(previousValue);
    } finally {
      setSaving(false);
    }
  }, [asset._id, canEdit, isPublicLink, onMetadataUpdated, saving]);

  /* ─── User Tag CRUD ──────────────────────────────────────────── */
  const handleAddUserTag = useCallback(async () => {
    const tag = newTag.trim().toLowerCase();
    if (!tag || userTags.includes(tag) || aiTags.includes(tag)) {
      setNewTag('');
      return;
    }
    const updated = [...userTags, tag];
    setUserTags(updated);
    setNewTag('');
    setSaving(true);
    try {
      await fetch(`/api/assets/${asset._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userTags: updated }),
      });
      onMetadataUpdated?.();
    } catch (err) {
      console.error('Add user tag failed:', err);
      setUserTags(userTags);
    } finally {
      setSaving(false);
    }
  }, [newTag, userTags, aiTags, asset._id, onMetadataUpdated]);

  const handleRemoveUserTag = useCallback(
    async (tagToRemove: string) => {
      const updated = userTags.filter((t) => t !== tagToRemove);
      setUserTags(updated);
      setSaving(true);
      try {
        await fetch(`/api/assets/${asset._id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userTags: updated }),
        });
        onMetadataUpdated?.();
      } catch (err) {
        console.error('Remove user tag failed:', err);
        setUserTags(userTags);
      } finally {
        setSaving(false);
      }
    },
    [userTags, asset._id, onMetadataUpdated],
  );

  const handleRemoveAiTag = useCallback(
    async (tagToRemove: string) => {
      const updated = aiTags.filter((t) => t !== tagToRemove);
      setAiTags(updated);
      setSaving(true);
      try {
        await fetch(`/api/assets/${asset._id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tags: updated }),
        });
        onMetadataUpdated?.();
      } catch (err) {
        console.error('Remove AI tag failed:', err);
        setAiTags(aiTags);
      } finally {
        setSaving(false);
      }
    },
    [aiTags, asset._id, onMetadataUpdated],
  );

  /* ─── Auto-Tag (smart: no re-trigger → revert) ──────────────── */
  const handleAutoTag = useCallback(async () => {
    if (!autoTagEnabled) {
      return;
    }

    setAutoTagging(true);
    try {
      const res = await fetch('/api/ai/auto-tag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetId: asset._id, forceRegenerate: false }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.tags) setAiTags(data.tags);
        if (data.userTags) setUserTags(data.userTags);
        setAiTagsGenerated(true);
        onMetadataUpdated?.();
      }
    } catch (err) {
      console.error('Auto-tag failed:', err);
    } finally {
      setAutoTagging(false);
    }
  }, [asset._id, autoTagEnabled, onMetadataUpdated]);

  /* ─── Face Detection ─────────────────────────────────────────── */
  const handleFaceDetect = useCallback(async () => {
    if (!faceDetectEnabled) {
      return;
    }

    setFaceDetecting(true);
    try {
      const res = await fetch('/api/ai/face-detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetId: asset._id }),
      });
      if (res.ok) {
        const data = await res.json();
        setFaces(data.faces ?? []);
        onMetadataUpdated?.();
      }
    } catch (err) {
      console.error('Face detection failed:', err);
    } finally {
      setFaceDetecting(false);
    }
  }, [asset._id, faceDetectEnabled, onMetadataUpdated]);

  /* ─── AI Actions (BG Remove, Upscale, Expand) ─────────────── */
  const handleBgRemove = useCallback(async () => {
    if (!bgRemoveEnabled) {
      return;
    }

    setBgRemoving(true);
    setAiActionResult(null);
    try {
      const res = await fetch('/api/ai/bg-remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetId: asset._id }),
      });
      const data = await res.json();
      if (data.status === 'completed') {
        setAiActionResult({
          type: 'bg_remove',
          status: 'completed',
          message: 'Background removed! Variant saved.',
        });
        onAssetUpdated?.();
      } else {
        setAiActionResult({
          type: 'bg_remove',
          status: 'failed',
          message: data.error ?? 'Failed',
        });
      }
    } catch {
      setAiActionResult({
        type: 'bg_remove',
        status: 'failed',
        message: 'Request failed',
      });
    } finally {
      setBgRemoving(false);
    }
  }, [asset._id, bgRemoveEnabled, onAssetUpdated]);

  const handleUpscale = useCallback(
    async (scaleFactor: 2 | 4) => {
      if (!upscaleEnabled) {
        return;
      }

      setUpscaling(true);
      setAiActionResult(null);
      try {
        const res = await fetch('/api/ai/upscale', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ assetId: asset._id, scaleFactor }),
        });
        const data = await res.json();
        if (data.status === 'completed') {
          setAiActionResult({
            type: 'upscale',
            status: 'completed',
            message: `Upscaled ${scaleFactor}x! Variant saved.`,
          });
          onAssetUpdated?.();
        } else {
          setAiActionResult({
            type: 'upscale',
            status: 'failed',
            message: data.error ?? 'Failed',
          });
        }
      } catch {
        setAiActionResult({
          type: 'upscale',
          status: 'failed',
          message: 'Request failed',
        });
      } finally {
        setUpscaling(false);
      }
    },
    [asset._id, onAssetUpdated, upscaleEnabled],
  );

  const handleExpand = useCallback(
    async (targetWidth: number, targetHeight: number) => {
      if (!expandEnabled) {
        return;
      }

      setExpanding(true);
      setAiActionResult(null);
      try {
        const res = await fetch('/api/ai/expand', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            assetId: asset._id,
            targetWidth,
            targetHeight,
          }),
        });
        const data = await res.json();
        if (data.status === 'completed') {
          setAiActionResult({
            type: 'expand',
            status: 'completed',
            message: `Expanded to ${targetWidth}×${targetHeight}! Variant saved.`,
          });
          onAssetUpdated?.();
        } else {
          setAiActionResult({
            type: 'expand',
            status: 'failed',
            message: data.error ?? 'Failed',
          });
        }
      } catch {
        setAiActionResult({
          type: 'expand',
          status: 'failed',
          message: 'Request failed',
        });
      } finally {
        setExpanding(false);
      }
    },
    [asset._id, expandEnabled, onAssetUpdated],
  );

  /* ─── Edit with AI ──────────────────────────────────────────── */
  const handleAiEdit = useCallback(async () => {
    if (!imageEditEnabled || !aiEditPrompt.trim()) return;
    setAiEditing(true);
    setAiActionResult(null);
    setAiEditPreview(null);
    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: aiEditPrompt,
          model: 'imagen3-edit',
          sourceAssetId: asset._id,
        }),
      });
      const data = await res.json();
      if (data.status === 'completed' && data.asset?._id) {
        setAiActionResult({
          type: 'ai_edit',
          status: 'completed',
          message: 'Image edited! Saved as new asset.',
        });
        // Fetch the generated asset URL for preview
        try {
          const urlRes = await fetch(`/api/assets/${data.asset._id}/url`);
          const urlData = await urlRes.json();
          if (urlData.url) setAiEditPreview(urlData.url);
        } catch {
          /* preview not critical */
        }
        onAssetUpdated?.();
      } else {
        setAiActionResult({
          type: 'ai_edit',
          status: 'failed',
          message: data.error ?? 'Edit failed',
        });
      }
    } catch {
      setAiActionResult({
        type: 'ai_edit',
        status: 'failed',
        message: 'Request failed',
      });
    } finally {
      setAiEditing(false);
    }
  }, [asset._id, aiEditPrompt, imageEditEnabled, onAssetUpdated]);

  /* ─── Resize ─────────────────────────────────────────────────── */
  const handleResize = useCallback(
    async (saveMode: 'new' | 'replace') => {
      setResizing(true);
      setShowSaveDialog(false);
      try {
        const res = await fetch('/api/assets/resize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            assetId: asset._id,
            width: resizeW,
            height: resizeH,
            saveMode,
          }),
        });
        if (res.ok) {
          setShowResizePanel(false);
          onAssetUpdated?.();
        }
      } catch (err) {
        console.error('Resize failed:', err);
      } finally {
        setResizing(false);
      }
    },
    [asset._id, resizeW, resizeH, onAssetUpdated],
  );

  /* ─── Download with Size Options ─────────────────────────────── */
  const handleDownload = useCallback(
    async (size: string) => {
      setDownloading(true);
      setShowDownloadMenu(false);
      try {
        const params = new URLSearchParams({ assetId: asset._id, size });
        const res = await fetch(`/api/assets/download?${params}`);
        if (res.ok) {
          const blob = await res.blob();
          const blobUrl = URL.createObjectURL(blob);
          const a = document.createElement('a');
          const disposition = res.headers.get('content-disposition') || '';
          const match = disposition.match(/filename="(.+)"/);
          a.download = match?.[1] || asset.name;
          a.href = blobUrl;
          a.click();
          URL.revokeObjectURL(blobUrl);
        }
      } catch (err) {
        console.error('Download failed:', err);
      } finally {
        setDownloading(false);
      }
    },
    [asset._id, asset.name],
  );

  /* ─── Delete ─────────────────────────────────────────────────── */
  const handleDelete = useCallback(async () => {
    setDeleting(true);
    try {
      await fetch(`/api/assets/${asset._id}`, { method: 'DELETE' });
      onAssetDeleted?.();
      onClose();
    } catch (err) {
      console.error('Delete failed:', err);
    } finally {
      setDeleting(false);
    }
  }, [asset._id, onAssetDeleted, onClose]);

  const handlePermanentDelete = useCallback(async () => {
    if (!canDelete || hardDeleting) return;

    const confirmed = window.confirm(
      'Permanently delete this broken asset? This will bypass trash and remove it immediately.',
    );
    if (!confirmed) return;

    setHardDeleting(true);
    try {
      const res = await fetch(`/api/assets/${asset._id}?permanent=1`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        throw new Error('Permanent delete failed');
      }
      onAssetDeleted?.();
      onClose();
    } catch (err) {
      console.error('Permanent delete failed:', err);
    } finally {
      setHardDeleting(false);
    }
  }, [asset._id, canDelete, hardDeleting, onAssetDeleted, onClose]);

  /* ─── Copy Asset (reference copy — same bucket file) ─────────── */
  const handleCopyAsset = useCallback(async () => {
    setCopying(true);
    setCopySuccess(false);
    try {
      const res = await fetch(`/api/assets/${asset._id}/copy`, {
        method: 'POST',
      });
      if (res.ok) {
        setCopySuccess(true);
        onAssetUpdated?.();
        setTimeout(() => setCopySuccess(false), 2000);
      }
    } catch (err) {
      console.error('Copy failed:', err);
    } finally {
      setCopying(false);
    }
  }, [asset._id, onAssetUpdated]);

  /* ─── Move ───────────────────────────────────────────────────── */
  const handleMove = useCallback(
    async (folderId: string | null) => {
      setSaving(true);
      try {
        await fetch(`/api/assets/${asset._id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ folderId }),
        });
        setShowMoveMenu(false);
        onAssetUpdated?.();
      } catch (err) {
        console.error('Move failed:', err);
      } finally {
        setSaving(false);
      }
    },
    [asset._id, onAssetUpdated],
  );

  useEffect(() => {
    if (showMoveMenu) {
      fetch('/api/folders')
        .then((r) => r.json())
        .then((d) => setFolders(d.folders ?? []))
        .catch(console.error);
    }
  }, [showMoveMenu]);

  /* ─── Aspect ratio helpers ───────────────────────────────────── */
  const aspectRatio =
    asset.width && asset.height ? asset.width / asset.height : 1;

  const handleResizeWChange = (w: number) => {
    setResizeW(w);
    setResizeH(Math.round(w / aspectRatio));
  };
  const handleResizeHChange = (h: number) => {
    setResizeH(h);
    setResizeW(Math.round(h * aspectRatio));
  };

  const previewInfo = getAssetPreviewInfo(asset.mimeType);
  const isImage = previewInfo.kind === 'image';
  const viewerImageUrl = primaryImageUrl || previewFallbackUrl;
  const integrityStatus = asset.integrityStatus ?? 'ok';
  const showDegradedAssetWarning =
    isImage && integrityStatus !== 'ok' && !asset.isCopy;
  const previewStatusLabel = getAssetPreviewStatusLabel(previewInfo.kind);
  const countLabel = getAssetCountLabel(asset.mimeType, previewInfo.kind);
  const durationLabel = formatAssetDuration(asset.duration);
  const originalName = asset.originalName || asset.name;
  const categoryLabel = formatAssetCategoryLabel(asset.fileCategory);
  const variantCount = asset.variants?.length ?? 0;
  const customMetadataEntries = Object.entries(asset.customMetadata ?? {}).filter(
    ([key, value]) => key.trim() && value?.trim(),
  );
  const dominantColors = asset.dominantColors ?? [];
  const exifDetails = [
    asset.exif?.camera
      ? { label: 'Camera', value: asset.exif.camera }
      : null,
    asset.exif?.lens ? { label: 'Lens', value: asset.exif.lens } : null,
    asset.exif?.iso ? { label: 'ISO', value: String(asset.exif.iso) } : null,
    asset.exif?.aperture
      ? { label: 'Aperture', value: asset.exif.aperture }
      : null,
    asset.exif?.shutter ? { label: 'Shutter', value: asset.exif.shutter } : null,
    asset.exif?.focalLength
      ? { label: 'Focal Length', value: `${asset.exif.focalLength}mm` }
      : null,
    asset.exif?.dateTime
      ? {
          label: 'Captured',
          value: new Date(asset.exif.dateTime).toLocaleString(),
        }
      : null,
    asset.exif?.gps
      ? {
          label: 'GPS',
          value: `${asset.exif.gps.latitude.toFixed(4)}, ${asset.exif.gps.longitude.toFixed(4)}`,
        }
      : null,
  ].filter((detail): detail is { label: string; value: string } => Boolean(detail));
  const variants = asset.variants ?? [];
  const insightSummary = getAssetInsightSummary({
    mimeType: asset.mimeType,
    fileCategory: asset.fileCategory,
    pageCount: asset.pageCount,
    duration: asset.duration,
    isCopy: asset.isCopy,
  });

  /* ─── Render ─────────────────────────────────────────────────── */
  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-dash-border bg-dash-surface shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-dash-border px-5 py-3">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {canEdit && isEditingName ? (
              <input
                ref={nameInputRef}
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={handleRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRename();
                  if (e.key === 'Escape') {
                    setName(asset.name);
                    setIsEditingName(false);
                  }
                }}
                className="min-w-0 flex-1 rounded border border-dash-border bg-transparent px-2 py-1 text-sm font-semibold outline-none focus:border-primary text-dash-text"
                autoFocus
              />
            ) : canEdit ? (
              <button
                onClick={() => setIsEditingName(true)}
                className="group flex min-w-0 items-center gap-1.5"
              >
                <h2 className="truncate text-sm font-semibold text-dash-text">
                  {name}
                </h2>
                <Pencil className="h-3 w-3 shrink-0 text-dash-text-muted opacity-0 transition group-hover:opacity-100" />
              </button>
            ) : (
              <h2 className="truncate text-sm font-semibold text-dash-text">
                {name}
              </h2>
            )}
          </div>
          <button
            onClick={onClose}
            className="ml-2 rounded-lg p-1.5 text-dash-text-muted transition hover:bg-dash-surface-hover hover:text-dash-text"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Preview — uses thumbnail for instant load */}
        <div className="group/preview relative flex items-center justify-center bg-dash-muted p-6">
          {isImage ? (
            <>
              {/* View mode buttons (hover reveal) */}
              <div className="absolute right-3 top-3 z-10 flex gap-1.5 opacity-0 transition group-hover/preview:opacity-100">
                {viewerImageUrl && (
                  <button
                    onClick={() => setShowViewer(true)}
                    className="flex items-center gap-1.5 rounded-lg bg-black/60 px-2.5 py-1.5 text-[11px] font-medium text-white backdrop-blur-sm transition hover:bg-black/80"
                    title="View in fullscreen"
                  >
                    <Expand className="h-3.5 w-3.5" />
                    Full Screen
                  </button>
                )}
                {onOpenOverlay && (
                  <button
                    onClick={onOpenOverlay}
                    className="flex items-center gap-1.5 rounded-lg bg-black/60 px-2.5 py-1.5 text-[11px] font-medium text-white backdrop-blur-sm transition hover:bg-black/80"
                    title="View in normal mode"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    Normal
                  </button>
                )}
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewImageSrc}
                alt={asset.name}
                className="max-h-64 max-w-full rounded-lg object-contain shadow-sm"
              />
            </>
          ) : previewInfo.kind === 'video' ? (
            /* ─── Video Player ──────────────────────────────── */
            asset.url ? (
              <VideoPlayer
                src={asset.url}
                poster={asset.thumbnailBase64 || asset.thumbnailUrl}
                name={asset.name}
                duration={asset.duration}
              />
            ) : (
              <div className="flex h-40 w-full items-center justify-center rounded-lg bg-dash-muted">
                <Loader2 className="h-6 w-6 animate-spin text-dash-text-muted" />
              </div>
            )
          ) : previewInfo.kind === 'pdf' ? (
            /* ─── PDF Viewer ────────────────────────────────── */
            fetchableAssetUrl ? (
              <PdfViewer
                src={fetchableAssetUrl}
                name={asset.name}
                pageCount={asset.pageCount}
                assetId={asset._id}
              />
            ) : (
              <div className="flex h-40 w-full items-center justify-center rounded-lg bg-dash-muted">
                <Loader2 className="h-6 w-6 animate-spin text-dash-text-muted" />
              </div>
            )
          ) : previewInfo.kind === 'audio' ? (
            /* ─── Audio Player ──────────────────────────────── */
            asset.url ? (
              <AudioPlayer
                src={asset.url}
                name={asset.name}
                mimeType={asset.mimeType}
                duration={asset.duration}
              />
            ) : (
              <div className="flex h-40 w-full items-center justify-center rounded-lg bg-dash-muted">
                <Loader2 className="h-6 w-6 animate-spin text-dash-text-muted" />
              </div>
            )
          ) : previewInfo.kind === 'csv' ? (
            /* ─── CSV Viewer ─────────────────────────────────── */
            fetchableAssetUrl ? (
              <CsvViewer src={fetchableAssetUrl} name={asset.name} />
            ) : (
              <div className="flex h-40 w-full items-center justify-center rounded-lg bg-dash-muted">
                <Loader2 className="h-6 w-6 animate-spin text-dash-text-muted" />
              </div>
            )
          ) : previewInfo.kind === 'spreadsheet' ? (
            /* ─── Spreadsheet Viewer ─────────────────────────── */
            fetchableAssetUrl ? (
              <SpreadsheetViewer src={fetchableAssetUrl} name={asset.name} />
            ) : (
              <div className="flex h-40 w-full items-center justify-center rounded-lg bg-dash-muted">
                <Loader2 className="h-6 w-6 animate-spin text-dash-text-muted" />
              </div>
            )
          ) : previewInfo.kind === 'docx' ? (
            /* ─── DOCX Viewer ────────────────────────────────── */
            fetchableAssetUrl ? (
              <DocxViewer src={fetchableAssetUrl} name={asset.name} />
            ) : (
              <div className="flex h-40 w-full items-center justify-center rounded-lg bg-dash-muted">
                <Loader2 className="h-6 w-6 animate-spin text-dash-text-muted" />
              </div>
            )
          ) : previewInfo.kind === 'presentation' ? (
            /* ─── Presentation Viewer ────────────────────────── */
            fetchableAssetUrl ? (
              <PresentationViewer
                src={fetchableAssetUrl}
                name={asset.name}
                mimeType={asset.mimeType}
              />
            ) : (
              <div className="flex h-40 w-full items-center justify-center rounded-lg bg-dash-muted">
                <Loader2 className="h-6 w-6 animate-spin text-dash-text-muted" />
              </div>
            )
          ) : previewInfo.kind === 'document-text' ? (
            /* ─── ODT / RTF Viewer ───────────────────────────── */
            fetchableAssetUrl ? (
              <DocumentTextViewer
                src={fetchableAssetUrl}
                name={asset.name}
                mimeType={asset.mimeType}
              />
            ) : (
              <div className="flex h-40 w-full items-center justify-center rounded-lg bg-dash-muted">
                <Loader2 className="h-6 w-6 animate-spin text-dash-text-muted" />
              </div>
            )
          ) : previewInfo.kind === 'office-fallback' ? (
            /* ─── Legacy Office Fallback Viewer ─────────────── */
            fetchableAssetUrl ? (
              <OfficeFallbackViewer
                src={fetchableAssetUrl}
                name={asset.name}
                mimeType={asset.mimeType}
              />
            ) : (
              <div className="flex h-40 w-full items-center justify-center rounded-lg bg-dash-muted">
                <Loader2 className="h-6 w-6 animate-spin text-dash-text-muted" />
              </div>
            )
          ) : previewInfo.kind === 'text' ? (
            /* ─── Text/Code Viewer ──────────────────────────── */
            fetchableAssetUrl ? (
              <TextViewer
                src={fetchableAssetUrl}
                name={asset.name}
                mimeType={asset.mimeType}
              />
            ) : (
              <div className="flex h-40 w-full items-center justify-center rounded-lg bg-dash-muted">
                <Loader2 className="h-6 w-6 animate-spin text-dash-text-muted" />
              </div>
            )
          ) : (
            /* ─── Generic File (Document, Archive, etc.) ───── */
            (() => {
              const ft = getFileTypeInfo(asset.mimeType);
              const DocIcon = ft?.icon;
              return (
                <div
                  className={`flex w-full flex-col items-center gap-3 rounded-xl py-8 ${ft?.bg ?? 'bg-dash-muted'}`}
                >
                  {DocIcon && (
                    <DocIcon
                      className={`h-14 w-14 ${ft?.color ?? 'text-dash-text-muted'}`}
                    />
                  )}
                  <span
                    className={`text-xs font-bold uppercase tracking-wider ${ft?.color ?? 'text-dash-text2'}`}
                  >
                    {ft?.label ?? asset.mimeType.split('/').pop()}
                  </span>
                  <p className="max-w-[85%] truncate text-center text-sm font-medium text-dash-text2 dark:text-dash-text-muted">
                    {asset.name}
                  </p>
                  <p className="max-w-[85%] text-center text-xs text-dash-text-muted">
                    {UNSUPPORTED_PREVIEW_TOOLTIP}
                  </p>
                  {asset.url && (
                    <a
                      href={asset.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-dash-inverted px-4 py-2 text-xs font-medium text-white transition hover:bg-dash-inverted-hover dark:bg-dash-muted dark:hover:bg-dash-surface-hover"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Open File
                    </a>
                  )}
                </div>
              );
            })()
          )}

          {/* Face bounding boxes overlay */}
          {faces.length > 0 && asset.width && asset.height && (
            <div className="pointer-events-none absolute inset-6">
              {faces.map((face, i) => (
                <div
                  key={face.faceHash || i}
                  className="absolute rounded border-2 border-green-400"
                  style={{
                    left: `${(face.boundingBox.x / asset.width!) * 100}%`,
                    top: `${(face.boundingBox.y / asset.height!) * 100}%`,
                    width: `${(face.boundingBox.w / asset.width!) * 100}%`,
                    height: `${(face.boundingBox.h / asset.height!) * 100}%`,
                  }}
                  title={`${face.emotion ?? 'face'} (${Math.round((face.confidence ?? 0.8) * 100)}%)`}
                />
              ))}
            </div>
          )}
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {!isImage && (
            <div className="mb-4 rounded-2xl border border-dash-border bg-dash-muted/60 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-dash-text">
                    {insightSummary.title}
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-dash-text-muted">
                    {insightSummary.description}
                  </p>
                </div>
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-dash-text-muted" />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {insightSummary.badges.map((badge) => (
                  <span
                    key={badge}
                    className="inline-flex items-center rounded-full border border-dash-border bg-dash-surface px-2.5 py-1 text-[11px] font-medium text-dash-text2"
                  >
                    {badge}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Metadata */}
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div>
              <dt className="text-xs font-medium text-dash-text2">Preview</dt>
              <dd className="mt-0.5 text-dash-text">{previewStatusLabel}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-dash-text2">Type</dt>
              <dd className="mt-0.5 text-dash-text">{asset.mimeType}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-dash-text2">Size</dt>
              <dd className="mt-0.5 text-dash-text">{sizeLabel}</dd>
            </div>
            {asset.width && asset.height && (
              <div>
                <dt className="text-xs font-medium text-dash-text2">
                  Dimensions
                </dt>
                <dd className="mt-0.5 text-dash-text">
                  {asset.width} × {asset.height}
                </dd>
              </div>
            )}
            {asset.duration != null && asset.duration > 0 && (
              <div>
                <dt className="text-xs font-medium text-dash-text2">
                  Duration
                </dt>
                <dd className="mt-0.5 text-dash-text">{durationLabel}</dd>
              </div>
            )}
            {asset.pageCount != null && asset.pageCount > 0 && (
              <div>
                <dt className="text-xs font-medium text-dash-text2">
                  {countLabel}
                </dt>
                <dd className="mt-0.5 text-dash-text">{asset.pageCount}</dd>
              </div>
            )}
            {asset.isCopy && (
              <div>
                <dt className="text-xs font-medium text-dash-text2">Source</dt>
                <dd className="mt-0.5 text-dash-text">Copied asset</dd>
              </div>
            )}
            <div>
              <dt className="text-xs font-medium text-dash-text2">Uploaded</dt>
              <dd className="mt-0.5 text-dash-text">
                {new Date(asset.createdAt).toLocaleDateString()}
              </dd>
            </div>
          </dl>

          {/* ─── Asset ID / URL (click to copy) ────────────────── */}
          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs font-medium text-dash-text2">
              Asset ID
            </span>
            <button
              onClick={() => {
                navigator.clipboard.writeText(asset._id);
                setCopiedField('id');
                setTimeout(() => setCopiedField(null), 2000);
              }}
              className="flex items-center gap-1 rounded-md px-2 py-0.5 text-xs text-dash-text2 transition hover:bg-dash-surface-hover"
              title="Click to copy Asset ID"
            >
              <code className="text-[10px] font-mono text-dash-text2 break-all">
                {asset._id}
              </code>
              <Copy className="h-3 w-3 shrink-0" />
            </button>
            {copiedField === 'id' && (
              <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                Copied!
              </span>
            )}
          </div>

          {asset.url && (
            <div className="mt-2 flex items-center gap-1.5">
              <span className="text-xs font-medium text-dash-text2">
                Public URL
              </span>
              <InfoTooltip title="Public URL" points={PUBLIC_URL_INFO} />
              <button
                onClick={() => {
                  const shareUrl = toAbsoluteAssetUrl(asset.url!);
                  navigator.clipboard.writeText(shareUrl);
                  setCopiedField('directUrl');
                  setTimeout(() => setCopiedField(null), 2000);
                }}
                className="flex min-w-0 items-center gap-1 rounded-md px-2 py-0.5 text-xs text-dash-text2 transition hover:bg-dash-surface-hover"
                title="Copy direct storage URL"
              >
                <span className="max-w-[220px] truncate text-[10px] font-mono text-dash-text2">
                  {toAbsoluteAssetUrl(asset.url)}
                </span>
                <Copy className="h-3 w-3 shrink-0" />
              </button>
              {copiedField === 'directUrl' && (
                <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                  Copied!
                </span>
              )}
            </div>
          )}

          {asset.publicUrl && (
            <div className="mt-2 flex items-center gap-1.5">
              <span className="text-xs font-medium text-dash-text2">
                img-man URL
              </span>
              <InfoTooltip title="img-man URL" points={IMGMAN_URL_INFO} />
              <button
                onClick={() => {
                  const shareUrl = toAbsoluteAssetUrl(asset.publicUrl!);
                  navigator.clipboard.writeText(shareUrl);
                  setCopiedField('imgmanUrl');
                  setTimeout(() => setCopiedField(null), 2000);
                }}
                className="flex min-w-0 items-center gap-1 rounded-md px-2 py-0.5 text-xs text-dash-text2 transition hover:bg-dash-surface-hover"
                title="Copy img-man asset URL"
              >
                <span className="max-w-[220px] truncate text-[10px] font-mono text-dash-text2">
                  {toAbsoluteAssetUrl(asset.publicUrl)}
                </span>
                <Copy className="h-3 w-3 shrink-0" />
              </button>
              {copiedField === 'imgmanUrl' && (
                <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                  Copied!
                </span>
              )}
            </div>
          )}

          <div className="mt-4 rounded-2xl border border-dash-border bg-dash-muted/40 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-dash-text2">
                  Link privacy
                </div>
                <p className="mt-1 text-xs leading-5 text-dash-text-muted">
                  {isPublicLink
                    ? 'Public links can be opened without signing in.'
                    : 'Private links require a logged-in user from this workspace.'}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-label="Private asset link"
                aria-checked={!isPublicLink}
                onClick={handleLinkPrivacyToggle}
                disabled={!canEdit || saving}
                className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-50 ${
                  isPublicLink
                    ? 'bg-dash-input ring-1 ring-dash-border'
                    : 'bg-[var(--im-primary)]'
                }`}
                title={isPublicLink ? 'Make link private' : 'Make link public'}
              >
                <span
                  className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                    isPublicLink ? 'translate-x-1' : 'translate-x-6'
                  }`}
                />
              </button>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-dash-text-muted">
              <span
                className={`rounded-full px-2 py-0.5 font-semibold ${
                  isPublicLink
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                    : 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                }`}
              >
                {isPublicLink ? 'Public' : 'Private'}
              </span>
              <span>
                {saving
                  ? 'Saving visibility…'
                  : canEdit
                    ? 'Copying the asset URL uses this setting.'
                    : 'Editors can change this setting.'}
              </span>
            </div>
          </div>

          {showDegradedAssetWarning && (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/80 p-4 dark:border-amber-900/50 dark:bg-amber-950/30">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300">
                    Broken Cloud Asset
                  </div>
                  <p className="mt-1 text-xs leading-5 text-amber-700 dark:text-amber-200">
                    {integrityStatus === 'thumbnail-fallback'
                      ? 'The original file is missing from cloud storage. img-man is serving only the thumbnail fallback. Reupload the original to restore full quality, or delete this broken asset permanently.'
                      : 'The original file and thumbnail are missing from cloud storage. Reupload the original if you still need it, or delete this broken asset permanently.'}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-amber-700 dark:text-amber-300">
                    <span className="rounded-full bg-white/80 px-2 py-0.5 font-semibold ring-1 ring-amber-200 dark:bg-amber-950/50 dark:ring-amber-800/60">
                      Original: {asset.originalExists ? 'present' : 'missing'}
                    </span>
                    <span className="rounded-full bg-white/80 px-2 py-0.5 font-semibold ring-1 ring-amber-200 dark:bg-amber-950/50 dark:ring-amber-800/60">
                      Thumbnail: {asset.thumbnailExists ? 'present' : 'missing'}
                    </span>
                  </div>
                  {canDelete && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        onClick={handlePermanentDelete}
                        disabled={hardDeleting}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {hardDeleting ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                        {hardDeleting ? 'Deleting…' : 'Delete Permanently'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {(originalName !== asset.name || categoryLabel || variantCount > 0 || asset.copyOfAssetId) && (
            <div className="mt-4 rounded-2xl border border-dash-border bg-dash-muted/40 p-4">
              <div className="mb-3 flex items-center gap-2">
                <Info className="h-3.5 w-3.5 text-dash-text-muted" />
                <h3 className="text-xs font-semibold uppercase tracking-wide text-dash-text2">
                  File insights
                </h3>
              </div>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                {originalName !== asset.name && (
                  <div className="col-span-2">
                    <dt className="text-xs font-medium text-dash-text2">
                      Original filename
                    </dt>
                    <dd className="mt-0.5 break-all text-dash-text">
                      {originalName}
                    </dd>
                  </div>
                )}
                {categoryLabel && (
                  <div>
                    <dt className="text-xs font-medium text-dash-text2">
                      Category
                    </dt>
                    <dd className="mt-0.5 text-dash-text">{categoryLabel}</dd>
                  </div>
                )}
                {variantCount > 0 && (
                  <div>
                    <dt className="text-xs font-medium text-dash-text2">
                      Variants
                    </dt>
                    <dd className="mt-0.5 text-dash-text">
                      {variantCount} saved
                    </dd>
                  </div>
                )}
                {asset.copyOfAssetId && (
                  <div className="col-span-2">
                    <dt className="text-xs font-medium text-dash-text2">
                      Source asset
                    </dt>
                    <dd className="mt-0.5 break-all text-dash-text">
                      {asset.copyOfAssetId}
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          )}

          {dominantColors.length > 0 && (
            <div className="mt-4 rounded-2xl border border-dash-border bg-dash-muted/40 p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-dash-text2">
                Dominant colors
              </h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {dominantColors.map((color) => (
                  <div
                    key={color}
                    className="inline-flex items-center gap-2 rounded-full border border-dash-border bg-dash-surface px-2.5 py-1 text-xs text-dash-text"
                  >
                    <span
                      className="h-3 w-3 rounded-full border border-black/10"
                      style={{ backgroundColor: color }}
                    />
                    {color}
                  </div>
                ))}
              </div>
            </div>
          )}

          {exifDetails.length > 0 && (
            <div className="mt-4 rounded-2xl border border-dash-border bg-dash-muted/40 p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-dash-text2">
                Capture details
              </h3>
              <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                {exifDetails.map((detail) => (
                  <div key={detail.label}>
                    <dt className="text-xs font-medium text-dash-text2">
                      {detail.label}
                    </dt>
                    <dd className="mt-0.5 text-dash-text">{detail.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {customMetadataEntries.length > 0 && (
            <div className="mt-4 rounded-2xl border border-dash-border bg-dash-muted/40 p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-dash-text2">
                Custom metadata
              </h3>
              <dl className="mt-3 grid grid-cols-1 gap-3 text-sm">
                {customMetadataEntries.map(([key, value]) => (
                  <div key={key}>
                    <dt className="text-xs font-medium text-dash-text2">
                      {formatMetadataKeyLabel(key)}
                    </dt>
                    <dd className="mt-0.5 break-all text-dash-text">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {assetAnalytics?.enabled && (
            <div className="mt-4 rounded-2xl border border-dash-border bg-dash-muted/40 p-4">
              <div className="mb-3 flex items-center gap-2">
                <History className="h-3.5 w-3.5 text-dash-text-muted" />
                <h3 className="text-xs font-semibold uppercase tracking-wide text-dash-text2">
                  Access analytics
                </h3>
              </div>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs font-medium text-dash-text2">Views</dt>
                  <dd className="mt-0.5 text-dash-text">
                    {assetAnalytics.totals?.views ?? 0}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-dash-text2">Failures</dt>
                  <dd className="mt-0.5 text-dash-text">
                    {assetAnalytics.totals?.failures ?? 0}
                  </dd>
                </div>
                {assetAnalytics.totals?.lastAccessedAt && (
                  <div>
                    <dt className="text-xs font-medium text-dash-text2">
                      Last access
                    </dt>
                    <dd className="mt-0.5 text-dash-text">
                      {new Date(assetAnalytics.totals.lastAccessedAt).toLocaleString()}
                    </dd>
                  </div>
                )}
                {assetAnalytics.totals?.lastFailureAt && (
                  <div>
                    <dt className="text-xs font-medium text-dash-text2">
                      Last failure
                    </dt>
                    <dd className="mt-0.5 text-dash-text">
                      {new Date(assetAnalytics.totals.lastFailureAt).toLocaleString()}
                    </dd>
                  </div>
                )}
              </dl>
              {assetAnalytics.byCountry && Object.keys(assetAnalytics.byCountry).length > 0 && (
                <div className="mt-3">
                  <p className="text-[11px] font-medium text-dash-text2">Top locations</p>
                  <ul className="mt-1 flex flex-wrap gap-1">
                    {Object.entries(assetAnalytics.byCountry)
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 5)
                      .map(([k, v]) => (
                        <li
                          key={k}
                          className="rounded-full bg-dash-surface px-2 py-0.5 text-[10px] text-dash-text2"
                        >
                          {k} · {v}
                        </li>
                      ))}
                  </ul>
                </div>
              )}
              <p className="mt-3 text-[11px] leading-5 text-dash-text-muted">
                Precomputed from the public asset endpoint. Enable / disable in
                <span className="mx-1 rounded bg-dash-surface px-1.5 py-0.5">Dashboard → Analytics</span>.
              </p>
            </div>
          )}

          {(variants.length > 0 || (isImage && !asset.isCopy)) && (
            <div className="mt-4 space-y-4">
              {variants.length > 0 && (
                <div className="rounded-2xl border border-dash-border bg-dash-muted/40 p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <FilePlus2 className="h-3.5 w-3.5 text-dash-text-muted" />
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-dash-text2">
                      Variants
                    </h3>
                    <span className="rounded-full bg-dash-surface px-2 py-0.5 text-[10px] font-medium text-dash-text2">
                      {variants.length}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {variants.map((variant, index) => (
                      <div
                        key={`${variant.key}-${variant.storageKey}-${index}`}
                        className="rounded-xl border border-dash-border bg-dash-surface px-3 py-2"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-xs font-semibold text-dash-text">
                            {formatMetadataKeyLabel(variant.key || `Variant ${index + 1}`)}
                          </span>
                          {variant.format && (
                            <span className="rounded-full bg-dash-muted px-2 py-0.5 text-[10px] font-medium text-dash-text2">
                              {variant.format.toUpperCase()}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-dash-text-muted">
                          {formatVariantSummary(variant)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {isImage && !asset.isCopy && (
                <div>
                  <div className="mb-2 flex items-center gap-2 px-1">
                    <History className="h-3.5 w-3.5 text-dash-text-muted" />
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-dash-text2">
                      Edit lineage
                    </h3>
                  </div>
                  <EditHistoryPanel
                    assetId={asset._id}
                    onRevert={() => {
                      onMetadataUpdated?.();
                      onAssetUpdated?.();
                    }}
                  />
                </div>
              )}
            </div>
          )}

          {/* ─── Tags ──────────────────────────────────────────── */}
          <div className="mt-5">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-1.5 text-xs font-medium text-dash-text2">
                <Tag className="h-3 w-3" />
                Tags
                {canAI && <AiBadge disabled={!autoTagEnabled} className="ml-1" />}
              </h3>
              <div className="flex gap-1">
                {canAI && (
                  <button
                    onClick={handleAutoTag}
                    disabled={autoTagging || !autoTagEnabled}
                    className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium text-[var(--im-primary)] transition hover:bg-[var(--im-primary-light)] disabled:opacity-50"
                    title={
                      aiTagsGenerated
                        ? 'Restore original AI tags'
                        : 'Generate AI tags'
                    }
                  >
                    {autoTagging ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : aiTagsGenerated ? (
                      <RotateCcw className="h-3 w-3" />
                    ) : (
                      <Sparkles className="h-3 w-3" />
                    )}
                    {aiTagsGenerated ? 'Revert AI Tags' : 'Auto-tag'}
                  </button>
                )}
                {canEdit && (
                  <button
                    onClick={() => {
                      setIsAddingTag(true);
                      setTimeout(() => tagInputRef.current?.focus(), 50);
                    }}
                    className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium text-dash-text2 transition hover:bg-dash-surface-hover"
                  >
                    <Plus className="h-3 w-3" />
                    Add
                  </button>
                )}
              </div>
            </div>

            {/* AI Tags — violet */}
            {aiTags.length > 0 && (
              <div className="mt-2">
                <p className="mb-1 flex items-center gap-1 text-[10px] font-medium text-[var(--im-primary)]">
                  <Bot className="h-2.5 w-2.5" /> AI Generated
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {aiTags.map((tag) => (
                    <span
                      key={`ai-${tag}`}
                      className="group relative flex items-center gap-1 rounded-full bg-[var(--im-primary-light)] px-2.5 py-0.5 text-xs font-medium text-[var(--im-primary)] ring-1 ring-[var(--im-primary)]/20"
                      title="AI-generated tag"
                    >
                      {tag}
                      {canEdit && (
                        <button
                          onClick={() => handleRemoveAiTag(tag)}
                          className="text-[var(--im-primary)]/60 opacity-0 transition hover:text-red-500 dark:hover:text-red-400 group-hover:opacity-100"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* User Tags — blue */}
            {userTags.length > 0 && (
              <div className="mt-2">
                <p className="mb-1 flex items-center gap-1 text-[10px] font-medium text-blue-500 dark:text-blue-400">
                  <User className="h-2.5 w-2.5" /> Your Tags
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {userTags.map((tag) => (
                    <span
                      key={`user-${tag}`}
                      className="group relative flex items-center gap-1 rounded-full bg-blue-50 dark:bg-blue-950/50 px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-400 ring-1 ring-blue-200 dark:ring-blue-800"
                      title="User-added tag"
                    >
                      {tag}
                      {canEdit && (
                        <button
                          onClick={() => handleRemoveUserTag(tag)}
                          className="text-blue-400 dark:text-blue-500 opacity-0 transition hover:text-red-500 dark:hover:text-red-400 group-hover:opacity-100"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {aiTags.length === 0 && userTags.length === 0 && !isAddingTag && (
              <p className="mt-2 text-xs text-dash-text-muted">
                No tags. Click Auto-tag or Add.
              </p>
            )}

            {canAI && !autoTagEnabled && (
              <p className="mt-2 text-[10px] text-dash-text-muted">
                AI auto-tagging is disabled in settings.
              </p>
            )}

            {isAddingTag && canEdit && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleAddUserTag();
                }}
                className="mt-2 flex gap-1"
              >
                <input
                  ref={tagInputRef}
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onBlur={() => {
                    if (!newTag.trim()) setIsAddingTag(false);
                  }}
                  placeholder="Type tag…"
                  className="min-w-0 flex-1 rounded border border-dash-border bg-transparent px-2 py-1 text-xs outline-none focus:border-primary text-dash-text"
                />
                <button
                  type="submit"
                  className="rounded bg-[var(--im-primary)] px-2.5 py-1 text-xs font-medium text-[var(--im-primary-fg)]"
                >
                  Add
                </button>
              </form>
            )}
          </div>

          {/* ─── AI Actions (Face Detection, BG Remove, Upscale, Expand) ───── */}
          {isImage && canAI && !asset.isCopy && (
            <div className="mt-5">
              <button
                onClick={() => setShowAiActionsPanel((s) => !s)}
                className="flex w-full items-center justify-between rounded-lg border border-dash-border px-3 py-2 text-xs font-medium text-dash-text2 transition hover:bg-dash-surface-hover"
              >
                <span className="flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" />
                  AI Actions
                  <AiBadge disabled={!hasAnyAssetAiTool} className="ml-1" />
                </span>
                <ChevronDown
                  className={`h-3.5 w-3.5 transition ${showAiActionsPanel ? 'rotate-180' : ''}`}
                />
              </button>

              {showAiActionsPanel && (
                <div className="mt-2 rounded-lg border border-dash-border bg-dash-muted/50 p-3">
                  {!hasAnyAssetAiTool && (
                    <p className="mb-3 text-[10px] text-dash-text-muted">
                      AI actions are disabled in organization settings.
                    </p>
                  )}

                  <div className="rounded-lg border border-dash-border bg-dash-surface px-3 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-1.5 text-xs font-medium text-dash-text2">
                          <ScanFace className="h-3.5 w-3.5" />
                          Face Detection
                        </div>
                        <p className="mt-1 text-[10px] text-dash-text-muted">
                          Detect faces and show bounding boxes on the preview.
                        </p>
                      </div>
                      <button
                        onClick={handleFaceDetect}
                        disabled={faceDetecting || !faceDetectEnabled}
                        className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium text-emerald-600 transition hover:bg-emerald-50 disabled:opacity-50 dark:text-emerald-400 dark:hover:bg-emerald-950/50"
                      >
                        {faceDetecting ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <ScanFace className="h-3 w-3" />
                        )}
                        {faces.length > 0 ? 'Re-detect' : 'Detect Faces'}
                      </button>
                    </div>

                    {faces.length > 0 ? (
                      <div className="mt-3 space-y-1.5">
                        {faces.map((face, i) => (
                          <div
                            key={face.faceHash || i}
                            className="flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-1.5 text-xs ring-1 ring-emerald-200 dark:bg-emerald-950/30 dark:ring-emerald-800"
                          >
                            <span className="font-medium text-emerald-700 dark:text-emerald-400">
                              Face {i + 1}
                            </span>
                            <div className="flex items-center gap-3 text-emerald-600 dark:text-emerald-500">
                              {face.emotion && (
                                <span className="capitalize">{face.emotion}</span>
                              )}
                              <span>
                                {Math.round((face.confidence ?? 0.8) * 100)}%
                              </span>
                            </div>
                          </div>
                        ))}
                        <p className="text-[10px] text-dash-text-muted">
                          <Info className="mr-0.5 inline h-2.5 w-2.5" />
                          Face bounding boxes are shown on the preview above.
                        </p>
                      </div>
                    ) : (
                      <p className="mt-3 text-xs text-dash-text-muted">
                        {faceDetectEnabled
                          ? 'No faces detected yet.'
                          : 'Face detection is disabled in settings.'}
                      </p>
                    )}
                  </div>

                  <div className="mt-3">
                    <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-dash-text2">
                      <Sparkles className="h-3 w-3" />
                      Image actions
                    </div>

                    {!hasAnyCreativeAiAction && (
                      <p className="mb-2 text-[10px] text-dash-text-muted">
                        AI image actions are disabled in organization settings.
                      </p>
                    )}

                    {aiActionResult && (
                      <div
                        className={`mb-2 flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs ${
                          aiActionResult.status === 'completed'
                            ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-200 dark:ring-emerald-800'
                            : 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 ring-1 ring-red-200 dark:ring-red-800'
                        }`}
                      >
                        {aiActionResult.status === 'completed' ? (
                          <CheckCircle2 className="h-3 w-3 shrink-0" />
                        ) : (
                          <XCircle className="h-3 w-3 shrink-0" />
                        )}
                        {aiActionResult.message}
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={handleBgRemove}
                        disabled={bgRemoving || upscaling || expanding || !bgRemoveEnabled}
                        className="flex items-center gap-1.5 rounded-lg border border-dash-border px-3 py-2 text-xs font-medium text-dash-text2 transition hover:border-[var(--im-primary)]/30 hover:bg-[var(--im-primary-light)] hover:text-[var(--im-primary)] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {bgRemoving ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Eraser className="h-3.5 w-3.5" />
                        )}
                        {bgRemoving ? 'Removing…' : 'Remove BG'}
                      </button>

                      <button
                        onClick={() => handleUpscale(2)}
                        disabled={bgRemoving || upscaling || expanding || !upscaleEnabled}
                        className="flex items-center gap-1.5 rounded-lg border border-dash-border px-3 py-2 text-xs font-medium text-dash-text2 transition hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:border-amber-800 dark:hover:bg-amber-950/30 dark:hover:text-amber-400"
                      >
                        {upscaling ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <ArrowUpCircle className="h-3.5 w-3.5" />
                        )}
                        {upscaling ? 'Upscaling…' : 'Upscale 2×'}
                      </button>

                      <button
                        onClick={() => handleUpscale(4)}
                        disabled={bgRemoving || upscaling || expanding || !upscaleEnabled}
                        className="flex items-center gap-1.5 rounded-lg border border-dash-border px-3 py-2 text-xs font-medium text-dash-text2 transition hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:border-amber-800 dark:hover:bg-amber-950/30 dark:hover:text-amber-400"
                      >
                        {upscaling ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <ArrowUpCircle className="h-3.5 w-3.5" />
                        )}
                        {upscaling ? 'Upscaling…' : 'Upscale 4×'}
                      </button>

                      {asset.width && asset.height && (
                        <button
                          onClick={() => {
                            const w = asset.width!;
                            const h = asset.height!;
                            const targetW =
                              w >= h ? Math.round(w * 1.5) : Math.round(h * (16 / 9));
                            const targetH = w >= h ? h : Math.round(h);
                            handleExpand(targetW, targetH);
                          }}
                          disabled={bgRemoving || upscaling || expanding || !expandEnabled}
                          className="flex items-center gap-1.5 rounded-lg border border-dash-border px-3 py-2 text-xs font-medium text-dash-text2 transition hover:border-cyan-300 hover:bg-cyan-50 hover:text-cyan-700 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:border-cyan-800 dark:hover:bg-cyan-950/30 dark:hover:text-cyan-400"
                        >
                          {expanding ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Expand className="h-3.5 w-3.5" />
                          )}
                          {expanding ? 'Expanding…' : 'AI Expand'}
                        </button>
                      )}

                      <button
                        onClick={() => setShowAiEdit((s) => !s)}
                        disabled={bgRemoving || upscaling || expanding || aiEditing || !imageEditEnabled}
                        className="col-span-2 flex items-center gap-1.5 rounded-lg border border-dash-border px-3 py-2 text-xs font-medium text-dash-text2 transition hover:border-purple-300 hover:bg-purple-50 hover:text-purple-700 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:border-purple-800 dark:hover:bg-purple-950/30 dark:hover:text-purple-400"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit with AI
                        <span className="ml-auto text-[10px] text-dash-text-muted">
                          8 credits
                        </span>
                      </button>
                    </div>

                    {showAiEdit && (
                      <div className="mt-2 rounded-lg border border-purple-200 bg-purple-50/50 p-3 dark:border-purple-800 dark:bg-purple-950/30">
                        {!imageEditEnabled && (
                          <p className="mb-2 text-[10px] text-dash-text-muted">
                            AI image editing is disabled in settings.
                          </p>
                        )}
                        <label className="mb-1 block text-[10px] font-medium text-dash-text2">
                          Describe the edit you want
                        </label>
                        <textarea
                          value={aiEditPrompt}
                          onChange={(e) => setAiEditPrompt(e.target.value)}
                          placeholder="Change the background to a sunset, make it warmer…"
                          disabled={!imageEditEnabled}
                          className="w-full resize-none rounded border border-dash-border bg-dash-surface px-2 py-1.5 text-xs text-dash-text outline-none focus:border-purple-400 dark:focus:border-purple-500"
                          rows={3}
                          maxLength={2000}
                        />
                        <button
                          onClick={handleAiEdit}
                          disabled={aiEditing || !aiEditPrompt.trim() || !imageEditEnabled}
                          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-purple-600 px-3 py-2 text-xs font-medium text-white transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {aiEditing ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Pencil className="h-3.5 w-3.5" />
                          )}
                          {aiEditing ? 'Editing…' : 'Edit Image'}
                        </button>

                        {aiEditPreview && (
                          <div className="mt-2 flex justify-center rounded-lg border border-dash-border bg-dash-surface p-2">
                            <img
                              src={aiEditPreview}
                              alt="AI Edited"
                              className="max-h-48 rounded object-contain"
                            />
                          </div>
                        )}
                      </div>
                    )}

                    <p className="mt-1.5 text-[10px] text-dash-text-muted">
                      AI operations use credits. Results are saved as asset variants.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ─── Resize ────────────────────────────────────────── */}
          {isImage && canEdit && !asset.isCopy && (
            <div className="mt-5">
              <button
                onClick={() => setShowResizePanel((s) => !s)}
                className="flex w-full items-center justify-between rounded-lg border border-dash-border px-3 py-2 text-xs font-medium text-dash-text2 transition hover:bg-dash-surface-hover"
              >
                <span className="flex items-center gap-1.5">
                  <Maximize2 className="h-3.5 w-3.5" />
                  Resize Image
                </span>
                <ChevronDown
                  className={`h-3.5 w-3.5 transition ${showResizePanel ? 'rotate-180' : ''}`}
                />
              </button>

              {showResizePanel && (
                <div className="mt-2 rounded-lg border border-dash-border bg-dash-muted/50 p-3">
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="mb-1 block text-[10px] font-medium text-dash-text2">
                        Width (px)
                      </label>
                      <input
                        type="number"
                        value={resizeW}
                        onChange={(e) =>
                          handleResizeWChange(Number(e.target.value))
                        }
                        min={1}
                        max={10000}
                        className="w-full rounded border border-dash-border bg-dash-surface px-2 py-1.5 text-xs outline-none focus:border-primary text-dash-text"
                      />
                    </div>
                    <div className="flex items-end pb-1.5 text-dash-text-muted">
                      ×
                    </div>
                    <div className="flex-1">
                      <label className="mb-1 block text-[10px] font-medium text-dash-text2">
                        Height (px)
                      </label>
                      <input
                        type="number"
                        value={resizeH}
                        onChange={(e) =>
                          handleResizeHChange(Number(e.target.value))
                        }
                        min={1}
                        max={10000}
                        className="w-full rounded border border-dash-border bg-dash-surface px-2 py-1.5 text-xs outline-none focus:border-primary text-dash-text"
                      />
                    </div>
                  </div>

                  {asset.width && asset.height && (
                    <p className="mt-2 text-[10px] text-dash-text-muted">
                      Original: {asset.width} × {asset.height}
                    </p>
                  )}

                  {showSaveDialog ? (
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => handleResize('new')}
                        disabled={resizing}
                        className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-blue-600 py-2 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
                      >
                        {resizing ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <FilePlus2 className="h-3 w-3" />
                        )}
                        Save as New
                      </button>
                      <button
                        onClick={() => handleResize('replace')}
                        disabled={resizing}
                        className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-amber-600 py-2 text-xs font-semibold text-white transition hover:bg-amber-700 disabled:opacity-50"
                      >
                        {resizing ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Save className="h-3 w-3" />
                        )}
                        Replace Original
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowSaveDialog(true)}
                      className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-[var(--im-primary)] py-2 text-xs font-semibold text-[var(--im-primary-fg)] transition hover:bg-[var(--im-primary)]/90"
                    >
                      <Maximize2 className="h-3 w-3" />
                      Apply Resize
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ─── Transform Preview ──────────────────────────────── */}
          {isImage && asset._id && (
            <TransformPreview
              assetId={asset._id}
              publicUrl={asset.publicUrl}
              originalWidth={asset.width}
              originalHeight={asset.height}
              mimeType={asset.mimeType}
            />
          )}
        </div>

        {/* ─── Actions Bar ─────────────────────────────────────── */}
        <div className="space-y-2 border-t border-dash-border p-4">
          {/* Sprint 9: Find Similar */}
          {onFindSimilar && asset.mimeType?.startsWith('image/') && (
            <button
              onClick={() => {
                onFindSimilar(asset._id);
                onClose();
              }}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-purple-200 dark:border-purple-800/50 bg-purple-50/50 dark:bg-purple-950/20 py-2 text-xs font-semibold text-purple-700 dark:text-purple-400 transition hover:bg-purple-100 dark:hover:bg-purple-900/30"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Find Similar Images
            </button>
          )}

          {/* Move */}
          {canEdit && (
            <div className="relative">
              <button
                onClick={() => setShowMoveMenu(!showMoveMenu)}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-dash-border py-2 text-xs font-semibold transition hover:border-dash-border-hover text-dash-text"
              >
                <FolderInput className="h-3.5 w-3.5" />
                Move to folder
              </button>

              {showMoveMenu && (
                <div className="absolute bottom-full left-0 right-0 z-10 mb-1 max-h-48 overflow-y-auto rounded-xl border border-dash-border bg-dash-surface py-1 shadow-lg">
                  <button
                    onClick={() => handleMove(null)}
                    className="w-full px-3 py-2 text-left text-xs text-dash-text2 transition hover:bg-dash-surface-hover"
                  >
                    📂 Root (no folder)
                  </button>
                  {folders.map((folder) => (
                    <button
                      key={folder._id}
                      onClick={() => handleMove(folder._id)}
                      className={`w-full px-3 py-2 text-left text-xs transition hover:bg-dash-surface-hover ${
                        asset.folderId === folder._id
                          ? 'font-semibold text-dash-text'
                          : 'text-dash-text2 dark:text-dash-text-muted'
                      }`}
                    >
                      📁 {folder.name}
                      {asset.folderId === folder._id && (
                        <span className="ml-1 text-dash-text-muted">
                          (current)
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Non-editable badge for copies */}
          {asset.isCopy && (
            <div className="flex items-center gap-1.5 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-3 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">
              <FilePlus2 className="h-3.5 w-3.5" />
              Non-editable copy
            </div>
          )}

          <div className="flex gap-2">
            {/* Make Copy */}
            {canEdit && !asset.isCopy && (
              <button
                onClick={handleCopyAsset}
                disabled={copying}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-dash-border px-3 py-2 text-xs font-semibold transition hover:border-dash-border-hover disabled:opacity-50 text-dash-text"
                title="Make a reference copy"
              >
                {copying ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : copySuccess ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400" />
                ) : (
                  <FilePlus2 className="h-3.5 w-3.5" />
                )}
              </button>
            )}

            {/* Share */}
            {canShare && (
              <button
                onClick={() => setShowShare(true)}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-dash-border px-3 py-2 text-xs font-semibold transition hover:border-dash-border-hover text-dash-text"
                title="Share"
              >
                <Share2 className="h-3.5 w-3.5" />
              </button>
            )}

            {(asset.publicUrl || asset.url) && (
              <button
                onClick={() => {
                  const shareUrl = toAbsoluteAssetUrl(asset.publicUrl || asset.url!);
                  navigator.clipboard.writeText(shareUrl);
                  setCopiedField('imgmanUrl');
                  setTimeout(() => setCopiedField(null), 2000);
                }}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-dash-border px-3 py-2 text-xs font-semibold transition hover:border-dash-border-hover text-dash-text"
                title="Copy img-man asset URL"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
            )}

            {/* Download with size options */}
            <div className="relative flex-1">
              <button
                onClick={() => setShowDownloadMenu(!showDownloadMenu)}
                disabled={downloading}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dash-border py-2 text-xs font-semibold transition hover:border-dash-border-hover disabled:opacity-50 text-dash-text"
              >
                {downloading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
                Download
                <ChevronDown className="h-3 w-3" />
              </button>

              {showDownloadMenu && (
                <div className="absolute bottom-full left-0 right-0 z-10 mb-1 rounded-xl border border-dash-border bg-dash-surface2 py-1 shadow-lg">
                  {getDownloadOptions(
                    asset.width,
                    asset.height,
                    asset.mimeType,
                  ).map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => handleDownload(opt.value)}
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-xs transition hover:bg-dash-surface-hover "
                    >
                      <span
                        className={`font-medium ${opt.value === 'original' ? 'text-dash-text' : 'text-dash-text2 dark:text-dash-text-muted'}`}
                      >
                        {opt.label}
                        {opt.value === 'original' &&
                          asset.mimeType?.startsWith('image/') && (
                            <span className="ml-1 rounded bg-amber-100 dark:bg-amber-900 px-1 py-0.5 text-[9px] font-semibold text-amber-700 dark:text-amber-300">
                              ORIGINAL
                            </span>
                          )}
                      </span>
                      <span className="text-[10px] text-dash-text-muted">
                        {opt.desc}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Delete */}
            {canDelete &&
              (confirmDelete ? (
                <div className="flex flex-1 gap-1">
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-red-600 py-2 text-xs font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
                  >
                    {deleting ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      'Confirm'
                    )}
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="rounded-lg border border-dash-border px-3 py-2 text-xs font-medium transition hover:border-dash-border-hover text-dash-text"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-red-200 dark:border-red-900/50 py-2 text-xs font-semibold text-red-600 dark:text-red-400 transition hover:bg-red-50 dark:hover:bg-red-950/30"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </button>
              ))}
          </div>
        </div>

        {/* Saving indicator */}
        {saving && (
          <div className="absolute bottom-20 left-1/2 -translate-x-1/2 rounded-full bg-dash-inverted dark:bg-dash-muted px-3 py-1 text-xs text-white shadow-lg">
            Saving…
          </div>
        )}
      </div>

      {/* Fullscreen Image Viewer */}
      {showViewer && isImage && viewerImageUrl && (
        <ImageViewer
          src={viewerImageUrl}
          alt={asset.name}
          assetId={asset._id}
          onClose={() => setShowViewer(false)}
          onSaved={() => {
            setShowViewer(false);
            onAssetUpdated?.();
          }}
        />
      )}

      {/* Share Dialog */}
      <ShareDialog
        open={showShare}
        onClose={() => setShowShare(false)}
        targetType="asset"
        targetId={asset._id}
        targetName={asset.name}
      />
    </>
  );
}
