// SPDX-License-Identifier: Apache-2.0
'use client';

import { useState, useCallback, useMemo } from 'react';
import {
 Sliders,
 Copy,
 ChevronDown,
 RotateCcw,
 Eye,
 Loader2,
 Check,
 ImageIcon,
 Sparkles,
} from 'lucide-react';
import { getPublicAssetUrl } from '@/lib/asset-url';
import type { TransformStep, CropMode, OutputFormat } from '@/lib/transforms/parser';

/* ─── Types ──────────────────────────────────────────────────── */

interface TransformPreviewProps {
 assetId: string;
 publicUrl?: string;
 originalWidth?: number;
 originalHeight?: number;
 mimeType: string;
}

const CROP_MODES: { value: CropMode | ''; label: string }[] = [
 { value: '', label: 'None' },
 { value: 'fit', label: 'Fit' },
 { value: 'fill', label: 'Fill' },
 { value: 'cover', label: 'Cover' },
 { value: 'contain', label: 'Contain' },
 { value: 'thumb', label: 'Thumb' },
];

const FORMATS: { value: OutputFormat | ''; label: string }[] = [
 { value: '', label: 'Auto' },
 { value: 'jpeg', label: 'JPEG' },
 { value: 'png', label: 'PNG' },
 { value: 'webp', label: 'WebP' },
 { value: 'avif', label: 'AVIF' },
];

const PRESETS = [
 { label: 'Thumbnail', step: { width: 200, height: 200, crop: 'thumb' as CropMode, quality: 80, format: 'webp' as OutputFormat } },
 { label: 'Social Card', step: { width: 1200, height: 630, crop: 'cover' as CropMode, quality: 85, format: 'jpeg' as OutputFormat } },
 { label: 'Profile Pic', step: { width: 400, height: 400, crop: 'cover' as CropMode, quality: 80, format: 'webp' as OutputFormat } },
 { label: 'HD Banner', step: { width: 1920, height: 1080, crop: 'cover' as CropMode, quality: 85, format: 'webp' as OutputFormat } },
];

/* ─── Component ───────────────────────────────────────────────── */

export function TransformPreview({
 assetId,
 publicUrl,
 originalWidth,
 originalHeight,
 mimeType,
}: TransformPreviewProps) {
 const [width, setWidth] = useState<number | ''>('');
 const [height, setHeight] = useState<number | ''>('');
 const [quality, setQuality] = useState(80);
 const [crop, setCrop] = useState<CropMode | ''>('');
 const [format, setFormat] = useState<OutputFormat | ''>('');
 const [blur, setBlur] = useState(0);
 const [rotation, setRotation] = useState(0);
 const [grayscale, setGrayscale] = useState(false);
 const [copied, setCopied] = useState(false);
 const [showPreview, setShowPreview] = useState(false);
 const [previewLoading, setPreviewLoading] = useState(false);

 // AI prompt state
 const [aiPrompt, setAiPrompt] = useState('');
 const [aiLoading, setAiLoading] = useState(false);

 const isImage = mimeType.startsWith('image/');

 const fit = useMemo(() => {
 if (crop === 'fit') return 'inside' as const;
 if (crop === 'thumb') return 'cover' as const;
 return crop || undefined;
 }, [crop]);

 const transformUrl = useMemo(() => {
 const hasAnyOption =
 width || height || quality !== 80 || format || fit || blur > 0 || rotation > 0 || grayscale;

 if (!hasAnyOption) {
 return '';
 }

 const normalizedFormat =
  format && format !== 'auto' && format !== 'original' ? format : undefined;

 return getPublicAssetUrl(assetId, {
 w: width ? Number(width) : undefined,
 h: height ? Number(height) : undefined,
  format: normalizedFormat,
 q: quality !== 80 ? quality : undefined,
 fit,
 blur: blur > 0 ? blur : undefined,
 rotation: rotation > 0 ? rotation : undefined,
 grayscale,
 });
 }, [assetId, width, height, quality, format, fit, blur, rotation, grayscale]);

 const hasAnyTransform = transformUrl.length > 0;
 const displayedTransformUrl = useMemo(() => {
 if (!transformUrl) {
 return '';
 }

 if (typeof window === 'undefined') {
 return publicUrl
 ? new URL(transformUrl, publicUrl).toString()
 : transformUrl;
 }

 return new URL(transformUrl, window.location.origin).toString();
 }, [publicUrl, transformUrl]);

 /* ── Handlers ──────────────────────────────────────────────── */
 const handleCopyUrl = useCallback(async () => {
 if (!transformUrl) return;
 await navigator.clipboard.writeText(displayedTransformUrl);
 setCopied(true);
 setTimeout(() => setCopied(false), 2000);
 }, [displayedTransformUrl, transformUrl]);

 const handleReset = useCallback(() => {
 setWidth('');
 setHeight('');
 setQuality(80);
 setCrop('');
 setFormat('');
 setBlur(0);
 setRotation(0);
 setGrayscale(false);
 setShowPreview(false);
 }, []);

 const handlePreset = useCallback((preset: TransformStep) => {
 setWidth(preset.width ?? '');
 setHeight(preset.height ?? '');
 setQuality(preset.quality ?? 80);
 setCrop(preset.crop ?? '');
 setFormat(preset.format ?? '');
 setBlur(preset.blur ?? 0);
 setRotation(preset.rotation ?? 0);
 setGrayscale(preset.grayscale ?? false);
 setShowPreview(true);
 setPreviewLoading(true);
 }, []);

 const handleAiGenerate = useCallback(async () => {
 if (!aiPrompt.trim()) return;
 setAiLoading(true);
 try {
 const res = await fetch('/api/transforms/ai', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ prompt: aiPrompt.trim() }),
 });
 const data = await res.json();
 if (data.step) {
 const s = data.step;
 if (s.width) setWidth(s.width);
 if (s.height) setHeight(s.height);
 if (s.quality) setQuality(s.quality);
 if (s.crop) setCrop(s.crop);
 if (s.format) setFormat(s.format);
 if (s.blur) setBlur(s.blur);
 if (s.rotation) setRotation(s.rotation);
 if (s.grayscale !== undefined) setGrayscale(s.grayscale);
 setShowPreview(true);
 setPreviewLoading(true);
 }
 } catch (err) {
 console.error('AI transform failed:', err);
 } finally {
 setAiLoading(false);
 }
 }, [aiPrompt]);

 if (!isImage) return null;

 /* ── Render ────────────────────────────────────────────────── */
 return (
 <div className="mt-5">
 <button
 onClick={() => setShowPreview((s) => !s)}
 className="flex w-full items-center justify-between rounded-lg border border-dash-border px-3 py-2 text-xs font-medium text-dash-text2 transition hover:bg-dash-muted"
 >
 <span className="flex items-center gap-1.5">
 <Sliders className="h-3.5 w-3.5"/>
 Transform Preview
 </span>
 <ChevronDown
 className={`h-3.5 w-3.5 transition ${showPreview ? 'rotate-180' : ''}`}
 />
 </button>

 {showPreview && (
 <div className="mt-2 rounded-lg border border-dash-border bg-dash-muted p-3 space-y-3">
 {/* AI Transform Generator */}
 <div>
 <p className="mb-1.5 text-[10px] font-medium text-dash-text2 uppercase tracking-wide flex items-center gap-1">
 <Sparkles className="h-3 w-3 text-[var(--im-primary)]"/> AI Transform
 </p>
 <div className="flex gap-1.5">
 <input
 type="text"
 value={aiPrompt}
 onChange={(e) => setAiPrompt(e.target.value)}
 onKeyDown={(e) => e.key === 'Enter' && handleAiGenerate()}
 placeholder="e.g. &quot;400x400 thumbnail with blur&quot;"
 className="flex-1 rounded-md border border-dash-border px-2 py-1.5 text-xs outline-none focus:border-[var(--im-primary)] focus:ring-1 focus:ring-[var(--im-primary)]"
 />
 <button
 onClick={handleAiGenerate}
 disabled={aiLoading || !aiPrompt.trim()}
 className="flex items-center gap-1 rounded-md bg-[var(--im-primary)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--im-primary-fg)] transition hover:bg-[var(--im-primary)]/90 disabled:opacity-50"
 >
 {aiLoading ? (
 <Loader2 className="h-3 w-3 animate-spin"/>
 ) : (
 <Sparkles className="h-3 w-3"/>
 )}
 Generate
 </button>
 </div>
 </div>

 {/* Quick Presets */}
 <div>
 <p className="mb-1.5 text-[10px] font-medium text-dash-text2 uppercase tracking-wide">
 Quick Presets
 </p>
 <div className="flex flex-wrap gap-1.5">
 {PRESETS.map((preset) => (
 <button
 key={preset.label}
 onClick={() => handlePreset(preset.step)}
 className="rounded-md bg-dash-surface px-2 py-1 text-[10px] font-medium text-dash-text2 ring-1 ring-dash-border transition hover:bg-dash-muted"
 >
 {preset.label}
 </button>
 ))}
 </div>
 </div>

 {/* Dimensions */}
 <div className="flex gap-3">
 <div className="flex-1">
 <label className="mb-1 block text-[10px] font-medium text-dash-text2">
 Width
 </label>
 <input
 type="number"
 value={width}
 onChange={(e) =>
 setWidth(e.target.value ? Number(e.target.value) : '')
 }
 placeholder={originalWidth ? String(originalWidth) : '—'}
 min={1}
 max={10000}
 className="w-full rounded border border-dash-border px-2 py-1.5 text-xs outline-none focus:border-primary"
 />
 </div>
 <div className="flex items-end pb-1.5 text-dash-text-muted">×</div>
 <div className="flex-1">
 <label className="mb-1 block text-[10px] font-medium text-dash-text2">
 Height
 </label>
 <input
 type="number"
 value={height}
 onChange={(e) =>
 setHeight(e.target.value ? Number(e.target.value) : '')
 }
 placeholder={originalHeight ? String(originalHeight) : '—'}
 min={1}
 max={10000}
 className="w-full rounded border border-dash-border px-2 py-1.5 text-xs outline-none focus:border-primary"
 />
 </div>
 </div>

 {/* Crop & Format */}
 <div className="flex gap-3">
 <div className="flex-1">
 <label className="mb-1 block text-[10px] font-medium text-dash-text2">
 Crop Mode
 </label>
 <select
 value={crop}
 onChange={(e) => setCrop(e.target.value as CropMode | '')}
 className="w-full rounded border border-dash-border px-2 py-1.5 text-xs outline-none focus:border-primary"
 >
 {CROP_MODES.map((m) => (
 <option key={m.value} value={m.value}>
 {m.label}
 </option>
 ))}
 </select>
 </div>
 <div className="flex-1">
 <label className="mb-1 block text-[10px] font-medium text-dash-text2">
 Format
 </label>
 <select
 value={format}
 onChange={(e) => setFormat(e.target.value as OutputFormat | '')}
 className="w-full rounded border border-dash-border px-2 py-1.5 text-xs outline-none focus:border-primary"
 >
 {FORMATS.map((f) => (
 <option key={f.value} value={f.value}>
 {f.label}
 </option>
 ))}
 </select>
 </div>
 </div>

 {/* Quality Slider */}
 <div>
 <label className="mb-1 flex items-center justify-between text-[10px] font-medium text-dash-text2">
 <span>Quality</span>
 <span className="text-dash-text2">{quality}%</span>
 </label>
 <input
 type="range"
 value={quality}
 onChange={(e) => setQuality(Number(e.target.value))}
 min={1}
 max={100}
 className="w-full accent-primary"
 />
 </div>

 {/* Blur & Rotation */}
 <div className="flex gap-3">
 <div className="flex-1">
 <label className="mb-1 flex items-center justify-between text-[10px] font-medium text-dash-text2">
 <span>Blur</span>
 <span className="text-dash-text2">{blur}</span>
 </label>
 <input
 type="range"
 value={blur}
 onChange={(e) => setBlur(Number(e.target.value))}
 min={0}
 max={100}
 className="w-full accent-primary"
 />
 </div>
 <div className="flex-1">
 <label className="mb-1 flex items-center justify-between text-[10px] font-medium text-dash-text2">
 <span>Rotation</span>
 <span className="text-dash-text2">{rotation}°</span>
 </label>
 <input
 type="range"
 value={rotation}
 onChange={(e) => setRotation(Number(e.target.value))}
 min={0}
 max={360}
 step={90}
 className="w-full accent-primary"
 />
 </div>
 </div>

 {/* Grayscale Toggle */}
 <label className="flex items-center gap-2 text-xs text-dash-text2 cursor-pointer">
 <input
 type="checkbox"
 checked={grayscale}
 onChange={(e) => setGrayscale(e.target.checked)}
 className="h-3.5 w-3.5 rounded border-dash-border accent-primary"
 />
 Grayscale
 </label>

 {/* Transform String Display */}
 {hasAnyTransform && (
 <div className="rounded-md bg-dash-inverted px-3 py-2">
 <p className="mb-1 text-[9px] font-medium text-dash-text-muted uppercase tracking-wide">
 Transform URL
 </p>
 <code className="block break-all text-[11px] text-emerald-400">
 {displayedTransformUrl}
 </code>
 </div>
 )}

 {/* Live Preview */}
 {hasAnyTransform && (
 <div className="relative rounded-lg border border-dash-border bg-dash-surface p-2">
 <p className="mb-1.5 text-[9px] font-medium text-dash-text-muted uppercase tracking-wide flex items-center gap-1">
 <Eye className="h-2.5 w-2.5"/> Preview
 </p>
 {previewLoading && (
 <div className="absolute inset-0 flex items-center justify-center bg-dash-surface/80 z-10 rounded-lg">
 <Loader2 className="h-5 w-5 animate-spin text-dash-text-muted"/>
 </div>
 )}
 {/* eslint-disable-next-line @next/next/no-img-element */}
 <img
 src={transformUrl}
 alt="Transform preview"
 className="mx-auto max-h-40 max-w-full rounded object-contain"
 onLoad={() => setPreviewLoading(false)}
 onError={() => setPreviewLoading(false)}
 />
 </div>
 )}

 {/* Actions */}
 <div className="flex gap-2">
 <button
 onClick={handleCopyUrl}
 disabled={!hasAnyTransform}
 className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[var(--im-primary)] py-2 text-xs font-semibold text-[var(--im-primary-fg)] transition hover:bg-[var(--im-primary)]/90 disabled:opacity-50"
 >
 {copied ? (
 <>
 <Check className="h-3 w-3"/> Copied!
 </>
 ) : (
 <>
 <Copy className="h-3 w-3"/> Copy URL
 </>
 )}
 </button>
 <button
 onClick={handleReset}
 className="flex items-center justify-center gap-1.5 rounded-lg border border-dash-border px-3 py-2 text-xs font-medium text-dash-text2 transition hover:border-dash-border-hover"
 >
 <RotateCcw className="h-3 w-3"/> Reset
 </button>
 </div>

 {/* Original Info */}
 {originalWidth && originalHeight && (
 <p className="text-[10px] text-dash-text-muted flex items-center gap-1">
 <ImageIcon className="h-2.5 w-2.5"/>
 Original: {originalWidth} × {originalHeight} · {mimeType}
 </p>
 )}
 </div>
 )}
 </div>
 );
}
