// SPDX-License-Identifier: Apache-2.0
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X, Download, ExternalLink, ZoomIn, ZoomOut, Pencil } from 'lucide-react';
import { getFileTypeInfo } from '@/lib/file-types';
import {
  formatAssetCategoryLabel,
  formatAssetDuration,
  formatAssetSize,
  getAssetCountLabel,
  getAssetPreviewStatusLabel,
} from '@/lib/asset-metadata';
import { AudioPlayer } from './audio-player';
import { CsvViewer } from './csv-viewer';
import { SpreadsheetViewer } from './spreadsheet-viewer';
import { DocxViewer } from './docx-viewer';
import { PresentationViewer } from './presentation-viewer';
import { DocumentTextViewer } from './document-text-viewer';
import { OfficeFallbackViewer } from './office-fallback-viewer';
import { TextViewer } from './text-viewer';
import { VideoPlayer } from './video-player';
import {
  getAssetPreviewInfo,
  UNSUPPORTED_PREVIEW_TOOLTIP,
} from '@/lib/asset-preview';

/* ─── Filter presets ────────────────────────────────────── */

interface FilterPreset {
  id: string;
  label: string;
  css: string;
}

const FILTER_PRESETS: FilterPreset[] = [
  { id: 'original', label: 'Original', css: 'none' },
  { id: 'vivid', label: 'Vivid', css: 'saturate(1.8) contrast(1.1)' },
  { id: 'warm', label: 'Warm', css: 'sepia(0.3) saturate(1.4) brightness(1.05)' },
  { id: 'cool', label: 'Cool', css: 'hue-rotate(20deg) saturate(1.2) brightness(1.02)' },
  { id: 'faded', label: 'Faded', css: 'saturate(0.7) brightness(1.1) contrast(0.9)' },
  { id: 'bw', label: 'B&W', css: 'grayscale(1)' },
  { id: 'sepia', label: 'Sepia', css: 'sepia(0.9)' },
  { id: 'dramatic', label: 'Dramatic', css: 'contrast(1.5) saturate(1.3) brightness(0.9)' },
];

type EditTab = 'enhance' | 'adjust' | 'filters' | 'crop';

interface EditState {
  activeTab: EditTab;
  // Enhance
  autoEnhance: boolean;
  dynamicMode: boolean;
  boostMode: boolean;
  ultraHDR: boolean;
  portraitLight: boolean;
  // Adjust
  brightness: number;
  contrast: number;
  saturation: number;
  sharpness: number;
  vignette: number;
  // Filters
  activeFilterId: string;
}

const DEFAULT_EDIT: EditState = {
  activeTab: 'enhance',
  autoEnhance: false,
  dynamicMode: false,
  boostMode: false,
  ultraHDR: false,
  portraitLight: false,
  brightness: 1,
  contrast: 1,
  saturation: 1,
  sharpness: 0,
  vignette: 0,
  activeFilterId: 'original',
};

function buildCssFilter(edit: EditState): string {
  const preset = FILTER_PRESETS.find((f) => f.id === edit.activeFilterId);
  const presetFilter = preset && preset.css !== 'none' ? preset.css : '';

  const parts: string[] = [];
  if (edit.brightness !== 1) parts.push(`brightness(${edit.brightness})`);
  if (edit.contrast !== 1) parts.push(`contrast(${edit.contrast})`);
  if (edit.saturation !== 1) parts.push(`saturate(${edit.saturation})`);

  if (edit.autoEnhance) {
    parts.push('contrast(1.1)', 'saturate(1.2)', 'brightness(1.05)');
  }
  if (edit.dynamicMode) {
    parts.push('contrast(1.25)', 'saturate(1.3)');
  }
  if (edit.boostMode) {
    parts.push('brightness(1.1)', 'saturate(1.5)');
  }
  if (edit.ultraHDR) {
    // Simulate HDR: expand dynamic range via contrast, highlights recovery, shadow lift
    parts.push('contrast(1.2)', 'brightness(1.08)', 'saturate(1.15)');
  }
  if (edit.portraitLight) {
    // Simulate portrait lighting: slight warm tint + gentle brightness boost + soften
    parts.push('brightness(1.12)', 'sepia(0.06)', 'contrast(1.05)');
  }

  const adjustFilter = parts.join(' ');
  const combined = [presetFilter, adjustFilter].filter(Boolean).join(' ');
  return combined || 'none';
}

interface ImageOverlayProps {
 src: string;
 alt: string;
 assetId: string;
 mimeType?: string;
 onClose: () => void;
 onOpenDrawer?: () => void;
 onRefresh?: () => void;
}

interface OverlayAssetDetails {
 mimeType?: string;
 sizeBytes?: number;
 pageCount?: number;
 duration?: number;
 originalName?: string;
 fileCategory?: string;
 variantsCount?: number;
}

export function ImageOverlay({ src, alt, assetId, mimeType, onClose, onOpenDrawer, onRefresh }: ImageOverlayProps) {
 const [zoom, setZoom] = useState(1);
 const [fileUrl, setFileUrl] = useState(src || '');
 const [loading, setLoading] = useState(false);
 const [resolvedMimeType, setResolvedMimeType] = useState(mimeType || '');
 const [assetDetails, setAssetDetails] = useState<OverlayAssetDetails>({
 mimeType,
 });
 const [editOpen, setEditOpen] = useState(false);
 const [edit, setEdit] = useState<EditState>(DEFAULT_EDIT);
 const imgRef = useRef<HTMLImageElement>(null);

 const previewInfo = useMemo(
 () => getAssetPreviewInfo(resolvedMimeType),
 [resolvedMimeType],
 );

 const fileTypeInfo = useMemo(() => {
 if (previewInfo.kind === 'image') return null;
 return getFileTypeInfo(resolvedMimeType);
 }, [resolvedMimeType, previewInfo.kind]);

 const previewStatusLabel = useMemo(
 () => getAssetPreviewStatusLabel(previewInfo.kind),
 [previewInfo.kind],
 );

 const durationLabel = useMemo(
 () => formatAssetDuration(assetDetails.duration),
 [assetDetails.duration],
 );

 const countLabel = useMemo(
 () => getAssetCountLabel(resolvedMimeType, previewInfo.kind),
 [resolvedMimeType, previewInfo.kind],
 );

 const sizeLabel = useMemo(
 () => formatAssetSize(assetDetails.sizeBytes),
 [assetDetails.sizeBytes],
 );

 const categoryLabel = useMemo(
 () => formatAssetCategoryLabel(assetDetails.fileCategory),
 [assetDetails.fileCategory],
 );

 // Fetch signed URL for full-res asset
 useEffect(() => {
 let cancelled = false;

 async function resolveFileUrl() {
 if (src && !src.startsWith('data:')) {
 if (!cancelled) {
 setFileUrl(src);
 if (mimeType) {
 setResolvedMimeType(mimeType);
 }
 setLoading(false);
 }
 return;
 }

 setLoading(true);

 try {
 const response = await fetch(`/api/assets/${assetId}`);
 const data = await response.json();

 if (cancelled) {
 return;
 }

 if (data.asset?.url) setFileUrl(data.asset.url);
 if (data.asset?.mimeType && !mimeType) setResolvedMimeType(data.asset.mimeType);
 setAssetDetails({
   mimeType: data.asset?.mimeType,
   sizeBytes: data.asset?.sizeBytes,
   pageCount: data.asset?.pageCount,
   duration: data.asset?.duration,
   originalName: data.asset?.originalName,
   fileCategory: data.asset?.fileCategory,
   variantsCount: Array.isArray(data.asset?.variants)
     ? data.asset.variants.length
     : 0,
 });
 } catch {
 } finally {
 if (!cancelled) {
 setLoading(false);
 }
 }
 }

 void resolveFileUrl();

 return () => {
 cancelled = true;
 };
 }, [src, assetId, mimeType]);

 // Close on Escape
 useEffect(() => {
 const handler = (e: KeyboardEvent) => {
 if (e.key === 'Escape') onClose();
 };
 window.addEventListener('keydown', handler);
 return () => window.removeEventListener('keydown', handler);
 }, [onClose]);

 const handleDownload = useCallback(async () => {
 try {
 const res = await fetch(fileUrl);
 const blob = await res.blob();
 const url = URL.createObjectURL(blob);
 const a = document.createElement('a');
 a.href = url;
 a.download = alt || 'file';
 a.click();
 URL.revokeObjectURL(url);
 } catch {
 window.open(fileUrl, '_blank');
 }
 }, [fileUrl, alt]);

 /* Computed CSS filter string */
 const cssFilter = useMemo(() => buildCssFilter(edit), [edit]);

 /* Download with applied edits via canvas */
 const handleDownloadEdited = useCallback(async () => {
 if (!fileUrl) return;
 const img = new Image();
 img.crossOrigin = 'anonymous';
 img.onload = () => {
   const canvas = document.createElement('canvas');
   canvas.width = img.naturalWidth;
   canvas.height = img.naturalHeight;
   const ctx = canvas.getContext('2d')!;
   if (cssFilter !== 'none') {
     try { ctx.filter = cssFilter; } catch { /* unsupported */ }
   }
   ctx.drawImage(img, 0, 0);
   canvas.toBlob((blob) => {
     if (!blob) return;
     const url = URL.createObjectURL(blob);
     const a = document.createElement('a');
     a.href = url;
     const safeName = (alt || 'image').replace(/\.[^.]+$/, '').replace(/[/\\:*?"<>|]/g, '_');
     a.download = `${safeName}_edited.png`;
     a.click();
     URL.revokeObjectURL(url);
   }, 'image/png');
 };
 img.onerror = () => window.open(fileUrl, '_blank');
 img.src = fileUrl;
 }, [fileUrl, alt, cssFilter]);

 /* Slider helper */
 const setAdjust = useCallback(
   <K extends keyof EditState>(key: K, value: EditState[K]) =>
     setEdit((prev) => ({ ...prev, [key]: value })),
   [],
 );

 return (
 <div
 className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
 onClick={onClose}
 >
 {/* Top bar */}
 <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-6 py-4">
 <div className="flex max-w-2xl items-start gap-2">
 {fileTypeInfo && (
 <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wider ${fileTypeInfo.bg} ${fileTypeInfo.color}`}>
 {fileTypeInfo.label}
 </span>
 )}
 <span className="inline-flex items-center gap-1 rounded bg-white/10 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-white/85">
 {previewStatusLabel}
 </span>
 {assetDetails.pageCount != null && assetDetails.pageCount > 0 && (
 <span className="inline-flex items-center gap-1 rounded bg-white/10 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-white/85">
 {assetDetails.pageCount} {countLabel}
 </span>
 )}
 {durationLabel && (
 <span className="inline-flex items-center gap-1 rounded bg-white/10 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-white/85">
 {durationLabel}
 </span>
 )}
 {assetDetails.sizeBytes != null && (
 <span className="inline-flex items-center gap-1 rounded bg-white/10 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-white/70">
 {sizeLabel}
 </span>
 )}
 {categoryLabel && (
 <span className="inline-flex items-center gap-1 rounded bg-white/10 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-white/70">
 {categoryLabel}
 </span>
 )}
 {assetDetails.variantsCount != null && assetDetails.variantsCount > 0 && (
 <span className="inline-flex items-center gap-1 rounded bg-white/10 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-white/70">
 {assetDetails.variantsCount} variants
 </span>
 )}
 <div className="min-w-0">
 <p className="truncate text-sm font-medium text-white/80">{alt}</p>
 {assetDetails.originalName && assetDetails.originalName !== alt && (
 <p className="truncate text-xs text-white/50">
 Original: {assetDetails.originalName}
 </p>
 )}
 </div>
 </div>
 <div className="flex items-center gap-2">
 {previewInfo.kind === 'image' && (
 <>
 {/* Edit toggle button */}
 <button
 onClick={(e) => { e.stopPropagation(); setEditOpen((o) => !o); }}
 className={`rounded-lg p-2 text-white transition ${editOpen ? 'bg-[var(--im-primary)] hover:bg-[var(--im-primary)]/90' : 'bg-dash-surface/10 hover:bg-dash-surface/20'}`}
 title="Edit image"
 >
 <Pencil className="h-4 w-4"/>
 </button>
 <button
 onClick={(e) => { e.stopPropagation(); setZoom((z) => Math.min(z + 0.25, 3)); }}
 className="rounded-lg bg-dash-surface/10 p-2 text-white transition hover:bg-dash-surface/20"
 title="Zoom in"
 >
 <ZoomIn className="h-4 w-4"/>
 </button>
 <button
 onClick={(e) => { e.stopPropagation(); setZoom((z) => Math.max(z - 0.25, 0.25)); }}
 className="rounded-lg bg-dash-surface/10 p-2 text-white transition hover:bg-dash-surface/20"
 title="Zoom out"
 >
 <ZoomOut className="h-4 w-4"/>
 </button>
 </>
 )}
 <button
 onClick={(e) => { e.stopPropagation(); handleDownload(); }}
 className="rounded-lg bg-dash-surface/10 p-2 text-white transition hover:bg-dash-surface/20"
 title="Download"
 >
 <Download className="h-4 w-4"/>
 </button>
 {previewInfo.kind === 'pdf' && fileUrl && (
 <button
 onClick={(e) => { e.stopPropagation(); window.open(fileUrl, '_blank'); }}
 className="rounded-lg bg-dash-surface/10 p-2 text-white transition hover:bg-dash-surface/20"
 title="Open in new tab"
 >
 <ExternalLink className="h-4 w-4"/>
 </button>
 )}
 {onOpenDrawer && (
 <button
 onClick={(e) => { e.stopPropagation(); onOpenDrawer(); }}
 className="rounded-lg bg-dash-surface/10 p-2 text-white transition hover:bg-dash-surface/20"
 title="Open details"
 >
 <ExternalLink className="h-4 w-4"/>
 </button>
 )}
 <button
 onClick={(e) => { e.stopPropagation(); onClose(); }}
 className="rounded-lg bg-dash-surface/10 p-2 text-white transition hover:bg-dash-surface/20"
 title="Close"
 >
 <X className="h-4 w-4"/>
 </button>
 </div>
 </div>

 {/* Main content area — flex row when edit panel is open */}
 <div
 className={`flex w-full h-full pt-16 pb-8 ${editOpen && previewInfo.kind === 'image' ? 'flex-row items-stretch' : 'items-center justify-center px-8'}`}
 onClick={(e) => e.stopPropagation()}
 >
 {loading && (
 <div className="flex flex-1 items-center justify-center">
 <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white"/>
 </div>
 )}

 {/* Image viewer */}
 {previewInfo.kind === 'image' && !loading && (
 fileUrl ? (
 <div className={`flex items-center justify-center ${editOpen ? 'flex-1 px-6' : 'w-full'}`}>
 {/* eslint-disable-next-line @next/next/no-img-element */}
 <img
 ref={imgRef}
 src={fileUrl}
 alt={alt}
 className={`rounded-lg object-contain shadow-2xl transition-all duration-200 ${editOpen ? 'max-h-[calc(100vh-8rem)] max-w-full' : 'max-h-[85vh] max-w-[90vw]'}`}
 style={{
   transform: `scale(${zoom})`,
   filter: cssFilter !== 'none' ? cssFilter : undefined,
   ...(edit.vignette > 0 ? { boxShadow: `inset 0 0 ${edit.vignette * 120}px ${edit.vignette * 80}px rgba(0,0,0,${edit.vignette * 0.8})` } : {}),
 }}
 draggable={false}
 />
 </div>
 ) : (
 <div className="flex flex-1 items-center justify-center rounded-lg bg-dash-inverted-hover px-12 py-20">
 <p className="text-sm text-dash-text-muted">Image unavailable</p>
 </div>
 )
 )}

 {/* PDF viewer */}
 {previewInfo.kind === 'pdf' && !loading && fileUrl && (
 <iframe
 src={fileUrl}
 className="h-[85vh] w-full max-w-5xl rounded-lg bg-dash-surface shadow-2xl"
 title={alt}
 />
 )}

 {/* Video viewer */}
 {previewInfo.kind === 'video' && !loading && fileUrl && (
 <div className="w-full max-w-5xl rounded-lg bg-dash-surface p-4 shadow-2xl">
 <VideoPlayer
 src={fileUrl}
 poster={src.startsWith('data:') ? undefined : src}
 name={alt}
 />
 </div>
 )}

 {/* Audio viewer */}
 {previewInfo.kind === 'audio' && !loading && fileUrl && (
 <div className="w-full max-w-4xl rounded-lg bg-dash-surface p-4 shadow-2xl">
 <AudioPlayer src={fileUrl} name={alt} mimeType={resolvedMimeType} />
 </div>
 )}

 {/* CSV viewer */}
 {previewInfo.kind === 'csv' && !loading && fileUrl && (
 <div className="h-[80vh] w-full max-w-6xl overflow-hidden rounded-lg bg-dash-surface shadow-2xl">
 <CsvViewer src={fileUrl} name={alt} />
 </div>
 )}

 {/* Spreadsheet viewer */}
 {previewInfo.kind === 'spreadsheet' && !loading && fileUrl && (
 <div className="h-[80vh] w-full max-w-6xl overflow-hidden rounded-lg bg-dash-surface shadow-2xl">
 <SpreadsheetViewer src={fileUrl} name={alt} />
 </div>
 )}

 {/* DOCX viewer */}
 {previewInfo.kind === 'docx' && !loading && fileUrl && (
 <div className="h-[80vh] w-full max-w-6xl overflow-hidden rounded-lg bg-dash-surface shadow-2xl">
 <DocxViewer src={fileUrl} name={alt} />
 </div>
 )}

 {/* Presentation viewer */}
 {previewInfo.kind === 'presentation' && !loading && fileUrl && (
 <div className="h-[80vh] w-full max-w-6xl overflow-hidden rounded-lg bg-dash-surface shadow-2xl">
 <PresentationViewer src={fileUrl} name={alt} mimeType={resolvedMimeType} />
 </div>
 )}

 {/* ODT / RTF viewer */}
 {previewInfo.kind === 'document-text' && !loading && fileUrl && (
 <div className="h-[80vh] w-full max-w-6xl overflow-hidden rounded-lg bg-dash-surface shadow-2xl">
 <DocumentTextViewer src={fileUrl} name={alt} mimeType={resolvedMimeType} />
 </div>
 )}

 {/* Legacy Office fallback viewer */}
 {previewInfo.kind === 'office-fallback' && !loading && fileUrl && (
 <div className="w-full max-w-4xl rounded-lg bg-dash-surface p-4 shadow-2xl">
 <OfficeFallbackViewer src={fileUrl} name={alt} mimeType={resolvedMimeType} />
 </div>
 )}

 {/* Text viewer */}
 {previewInfo.kind === 'text' && !loading && fileUrl && (
 <div className="h-[80vh] w-full max-w-6xl overflow-hidden rounded-lg bg-dash-surface shadow-2xl">
 <TextViewer src={fileUrl} name={alt} mimeType={resolvedMimeType} />
 </div>
 )}

 {/* Document (non-viewable) */}
 {previewInfo.kind === 'generic' && !loading && (
 <div className="flex flex-col items-center gap-6 rounded-2xl bg-dash-code-bg/80 p-12 shadow-2xl backdrop-blur">
 {fileTypeInfo && (
 <div className={`flex h-20 w-20 items-center justify-center rounded-2xl ${fileTypeInfo.bg}`}>
 <fileTypeInfo.icon className={`h-10 w-10 ${fileTypeInfo.color}`} />
 </div>
 )}
 <div className="text-center">
 <p className="text-lg font-semibold text-white">{alt}</p>
 <p className="mt-1 text-sm text-dash-text-muted">
 {fileTypeInfo?.label ?? 'File'} — {UNSUPPORTED_PREVIEW_TOOLTIP}
 </p>
 </div>
 <button
 onClick={handleDownload}
 className="flex items-center gap-2 rounded-lg bg-[var(--im-primary)] px-6 py-2.5 text-sm font-medium text-[var(--im-primary-fg)] transition hover:brightness-110"
 >
 <Download className="h-4 w-4"/>
 Download to view
 </button>
 </div>
 )}

 {/* ── Edit Panel (slides in from right) ── */}
 {editOpen && previewInfo.kind === 'image' && (
 <div
 className="flex w-72 shrink-0 flex-col overflow-y-auto border-l border-white/10 bg-black/70 backdrop-blur-xl"
 onClick={(e) => e.stopPropagation()}
 >
 {/* Tab bar */}
 <div className="flex border-b border-white/10">
 {(['enhance', 'adjust', 'filters', 'crop'] as EditTab[]).map((tab) => (
 <button
 key={tab}
 onClick={() => setAdjust('activeTab', tab)}
 className={`flex-1 py-2.5 text-[11px] font-semibold capitalize transition-colors ${
   edit.activeTab === tab
     ? 'border-b-2 border-[var(--im-primary)] text-white'
     : 'text-white/50 hover:text-white/80'
 }`}
 >
 {tab}
 </button>
 ))}
 </div>

 {/* Tab content */}
 <div className="flex-1 p-4 space-y-4">
 {/* Enhance tab */}
 {edit.activeTab === 'enhance' && (
 <div className="space-y-3">
 {([
   { key: 'autoEnhance', label: 'Auto Enhance', desc: 'Boost contrast, saturation & brightness' },
   { key: 'dynamicMode', label: 'Dynamic Mode', desc: 'Higher contrast & vivid colors' },
   { key: 'boostMode', label: 'Boost Mode', desc: 'Extra brightness & saturation pop' },
   { key: 'ultraHDR', label: 'Ultra HDR', desc: 'Expand dynamic range for lifelike tones' },
   { key: 'portraitLight', label: 'Portrait Light', desc: 'Warm directional light for portraits' },
 ] as { key: keyof EditState; label: string; desc: string }[]).map(({ key, label, desc }) => (
   <div key={key} className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-3">
     <div>
       <p className="text-xs font-medium text-white">{label}</p>
       <p className="text-[10px] text-white/50">{desc}</p>
     </div>
     <button
       onClick={() => setAdjust(key, !edit[key] as EditState[typeof key])}
       className={`relative h-5 w-9 rounded-full transition-colors ${edit[key] ? 'bg-[var(--im-primary)]' : 'bg-white/20'}`}
     >
       <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${edit[key] ? 'translate-x-4' : 'translate-x-0.5'}`} />
     </button>
   </div>
 ))}
 </div>
 )}

 {/* Adjust tab */}
 {edit.activeTab === 'adjust' && (
 <div className="space-y-4">
 {([
   { key: 'brightness', label: 'Brightness', min: 0.5, max: 2, step: 0.05, default: 1 },
   { key: 'contrast', label: 'Contrast', min: 0.5, max: 2, step: 0.05, default: 1 },
   { key: 'saturation', label: 'Saturation', min: 0, max: 3, step: 0.05, default: 1 },
   { key: 'sharpness', label: 'Sharpness (visual)', min: 0, max: 1, step: 0.05, default: 0 },
   { key: 'vignette', label: 'Vignette', min: 0, max: 1, step: 0.05, default: 0 },
 ] as { key: keyof EditState; label: string; min: number; max: number; step: number; default: number }[]).map(({ key, label, min, max, step, default: def }) => (
   <div key={key}>
     <div className="mb-1 flex justify-between">
       <span className="text-[11px] font-medium text-white/80">{label}</span>
       <span className="text-[11px] text-white/50">{Number(edit[key]).toFixed(2)}</span>
     </div>
     <div className="flex items-center gap-2">
       <input
         type="range"
         min={min}
         max={max}
         step={step}
         value={Number(edit[key])}
         onChange={(e) => setAdjust(key, Number(e.target.value) as EditState[typeof key])}
         className="w-full accent-[var(--im-primary)] cursor-pointer"
       />
       <button
         onClick={() => setAdjust(key, def as EditState[typeof key])}
         className="text-[10px] text-white/40 hover:text-white/70 transition-colors"
         title="Reset"
       >
         ↺
       </button>
     </div>
   </div>
 ))}
 </div>
 )}

 {/* Filters tab */}
 {edit.activeTab === 'filters' && (
 <div className="grid grid-cols-2 gap-2">
 {FILTER_PRESETS.map((preset) => (
 <button
   key={preset.id}
   onClick={() => setAdjust('activeFilterId', preset.id)}
   className={`group relative overflow-hidden rounded-xl border-2 transition-all ${
     edit.activeFilterId === preset.id
       ? 'border-[var(--im-primary)]'
       : 'border-white/10 hover:border-white/30'
   }`}
 >
   {fileUrl && (
   // eslint-disable-next-line @next/next/no-img-element
   <img
     src={fileUrl}
     alt={preset.label}
     className="h-20 w-full object-cover"
     style={{ filter: preset.css !== 'none' ? preset.css : undefined }}
   />
   )}
   <div className="bg-black/50 py-1 text-center">
     <span className={`text-[10px] font-semibold ${edit.activeFilterId === preset.id ? 'text-[var(--im-primary)]' : 'text-white/70'}`}>
       {preset.label}
     </span>
   </div>
 </button>
 ))}
 </div>
 )}

 {/* Crop tab */}
 {edit.activeTab === 'crop' && (
 <div className="flex flex-col items-center justify-center gap-3 rounded-xl bg-white/5 py-10 text-center">
 <div className="text-4xl">✂️</div>
 <p className="text-sm font-semibold text-white">Crop tool</p>
 <p className="text-xs text-white/50">Crop is coming soon</p>
 </div>
 )}
 </div>

 {/* Footer actions */}
 <div className="border-t border-white/10 p-4 space-y-2">
 <button
 onClick={() => setEdit(DEFAULT_EDIT)}
 className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/20 py-2 text-xs font-medium text-white/70 transition hover:bg-white/10 hover:text-white"
 >
 Reset all
 </button>
 <button
 onClick={handleDownloadEdited}
 className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--im-primary)] py-2 text-xs font-semibold text-[var(--im-primary-fg)] transition hover:brightness-110"
 >
 <Download className="h-3.5 w-3.5"/>
 Download Edited
 </button>
 </div>
 </div>
 )}
 </div>

 {/* Zoom indicator (images only, when edit panel closed) */}
 {previewInfo.kind === 'image' && zoom !== 1 && !editOpen && (
 <div className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs text-white">
 {Math.round(zoom * 100)}%
 </div>
 )}
 </div>
 );
}
