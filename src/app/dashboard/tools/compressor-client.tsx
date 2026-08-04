// SPDX-License-Identifier: Apache-2.0
'use client';

/**
 * DS-7.4 — Batch Image Compressor Tool
 * Client-side compression via Canvas API with quality/dimension controls.
 * Supports bulk download as individual files (ZIP via simple concatenation avoided for bundle size).
 */

import { useState, useCallback, useRef } from 'react';
import { X, Upload, Download, Loader2, Trash2, Minimize2, Library } from 'lucide-react';
import dynamic from 'next/dynamic';

const AssetPicker = dynamic(() => import('@/components/dashboard/asset-picker'), { ssr: false });

interface CompressEntry {
  id: string;
  file: File;
  name: string;
  originalSize: number;
  previewUrl: string;
  compressedBlob?: Blob;
  compressedSize?: number;
  compressedUrl?: string;
}

interface CompressConfig {
  quality: number;      // 0-100
  maxWidth: number;     // 0 = no limit
  maxHeight: number;    // 0 = no limit
  format: 'jpeg' | 'png' | 'webp';
}

export interface CompressorModalProps {
  onClose: () => void;
}

/* ── Helpers (exported for tests) ── */

export const FORMAT_OPTIONS = [
  { value: 'jpeg', label: 'JPEG' },
  { value: 'png', label: 'PNG' },
  { value: 'webp', label: 'WebP' },
] as const;

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

export function calcDimensions(
  origW: number,
  origH: number,
  maxW: number,
  maxH: number,
): { w: number; h: number } {
  let w = origW;
  let h = origH;
  if (maxW > 0 && w > maxW) {
    h = Math.round(h * (maxW / w));
    w = maxW;
  }
  if (maxH > 0 && h > maxH) {
    w = Math.round(w * (maxH / h));
    h = maxH;
  }
  return { w, h };
}

let _cmpId = 0;

export default function CompressorModal({ onClose }: CompressorModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [entries, setEntries] = useState<CompressEntry[]>([]);
  const [config, setConfig] = useState<CompressConfig>({
    quality: 80,
    maxWidth: 0,
    maxHeight: 0,
    format: 'jpeg',
  });
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);

  const addFiles = useCallback((fileList: FileList | File[]) => {
    const newEntries: CompressEntry[] = [];
    for (const file of Array.from(fileList)) {
      if (!file.type.startsWith('image/')) continue;
      newEntries.push({
        id: `cmp-${++_cmpId}-${Date.now()}`,
        file,
        name: file.name,
        originalSize: file.size,
        previewUrl: URL.createObjectURL(file),
      });
    }
    setEntries((prev) => [...prev, ...newEntries]);
    setError(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      addFiles(e.dataTransfer.files);
    },
    [addFiles],
  );

  const removeEntry = useCallback((id: string) => {
    setEntries((prev) => {
      const found = prev.find((e) => e.id === id);
      if (found) {
        URL.revokeObjectURL(found.previewUrl);
        if (found.compressedUrl) URL.revokeObjectURL(found.compressedUrl);
      }
      return prev.filter((e) => e.id !== id);
    });
  }, []);

  const handleCompress = useCallback(async () => {
    if (entries.length === 0) {
      setError('Please add at least one image.');
      return;
    }
    setProcessing(true);
    setError(null);
    try {
      const updated = [...entries];
      const mimeMap: Record<string, string> = {
        jpeg: 'image/jpeg',
        png: 'image/png',
        webp: 'image/webp',
      };
      const mime = mimeMap[config.format];

      for (let i = 0; i < updated.length; i++) {
        const entry = updated[i];
        const img = new Image();
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = reject;
          img.src = entry.previewUrl;
        });

        const { w, h } = calcDimensions(
          img.naturalWidth,
          img.naturalHeight,
          config.maxWidth,
          config.maxHeight,
        );

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, w, h);

        const blob = await new Promise<Blob | null>((res) =>
          canvas.toBlob(res, mime, config.quality / 100),
        );
        if (!blob) continue;

        if (entry.compressedUrl) URL.revokeObjectURL(entry.compressedUrl);
        updated[i] = {
          ...entry,
          compressedBlob: blob,
          compressedSize: blob.size,
          compressedUrl: URL.createObjectURL(blob),
        };
      }
      setEntries(updated);
    } catch (err) {
      setError(`Compression failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setProcessing(false);
    }
  }, [entries, config]);

  const downloadAll = useCallback(() => {
    entries.forEach((e) => {
      if (!e.compressedUrl || !e.compressedBlob) return;
      const ext = config.format;
      const baseName = e.name.replace(/\.[^.]+$/, '');
      const a = document.createElement('a');
      a.href = e.compressedUrl;
      a.download = `${baseName}.${ext}`;
      a.click();
    });
  }, [entries, config.format]);

  const totalOriginal = entries.reduce((s, e) => s + e.originalSize, 0);
  const totalCompressed = entries.reduce((s, e) => s + (e.compressedSize ?? e.originalSize), 0);
  const hasCompressed = entries.some((e) => e.compressedBlob);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div
        className="relative w-full max-w-2xl rounded-2xl border border-dash-border bg-dash-surface shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-dash-border px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-dash-text">Batch Image Compressor</h2>
            <p className="text-xs text-dash-text-muted mt-0.5">
              Compress & resize multiple images at once
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-dash-text-muted hover:bg-dash-surface-hover hover:text-dash-text transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Source selection */}
          <div className="flex gap-2">
            <div
              className="flex flex-1 items-center justify-center rounded-xl border-2 border-dashed border-dash-border bg-dash-muted hover:border-[var(--im-primary)]/60 h-20 cursor-pointer transition-colors"
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
              data-testid="compressor-drop"
            >
              <div className="flex flex-col items-center gap-1 text-dash-text-muted">
                <Upload className="h-5 w-5" />
                <p className="text-xs font-medium">Upload images</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) addFiles(e.target.files);
                  e.target.value = '';
                }}
              />
            </div>
            <button
              onClick={() => setShowPicker(true)}
              className="flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-dash-border bg-dash-muted hover:border-[var(--im-primary)]/60 hover:bg-[var(--im-primary-light)] h-20 w-36 cursor-pointer transition-colors text-dash-text-muted"
              data-testid="compressor-browse"
            >
              <Library className="h-5 w-5" />
              <span className="text-xs font-medium">Browse Library</span>
            </button>
          </div>

          {/* File list */}
          {entries.length > 0 && (
            <div className="space-y-1 max-h-36 overflow-y-auto" data-testid="compressor-list">
              {entries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center gap-3 rounded-lg border border-dash-border px-3 py-2"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={entry.previewUrl} alt="" className="h-8 w-8 rounded object-cover" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-dash-text truncate">{entry.name}</p>
                    <p className="text-[10px] text-dash-text-muted">
                      {formatBytes(entry.originalSize)}
                      {entry.compressedSize != null && (
                        <span className={entry.compressedSize < entry.originalSize ? 'text-green-500' : 'text-amber-500'}>
                          {' → '}{formatBytes(entry.compressedSize)}
                          {' '}({Math.round((1 - entry.compressedSize / entry.originalSize) * 100)}%)
                        </span>
                      )}
                    </p>
                  </div>
                  <button
                    onClick={() => removeEntry(entry.id)}
                    className="p-1 text-dash-text-muted hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Stats bar */}
          {entries.length > 0 && (
            <div className="flex items-center justify-between rounded-lg bg-dash-muted px-3 py-2 text-xs text-dash-text-muted">
              <span>{entries.length} image(s)</span>
              <span>
                {formatBytes(totalOriginal)} → {formatBytes(totalCompressed)}
                {hasCompressed && (
                  <span className="ml-1 font-medium text-green-500">
                    ({Math.round((1 - totalCompressed / totalOriginal) * 100)}% saved)
                  </span>
                )}
              </span>
            </div>
          )}

          {/* Config */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-dash-text2 mb-1">
                Quality: {config.quality}%
              </label>
              <input
                type="range"
                min={10}
                max={100}
                value={config.quality}
                onChange={(e) => setConfig((c) => ({ ...c, quality: +e.target.value }))}
                className="w-full"
                data-testid="compressor-quality"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-dash-text2 mb-1">Format</label>
              <div className="flex gap-1">
                {FORMAT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setConfig((c) => ({ ...c, format: opt.value as CompressConfig['format'] }))}
                    className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors ${
                      config.format === opt.value
                        ? 'border-[var(--im-primary)] bg-[var(--im-primary)]/10 text-[var(--im-primary)]'
                        : 'border-dash-border text-dash-text-muted hover:bg-dash-surface-hover'
                    }`}
                    data-testid={`compressor-fmt-${opt.value}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-dash-text2 mb-1">Max Width (px)</label>
              <input
                type="number"
                min={0}
                placeholder="0 = no limit"
                value={config.maxWidth || ''}
                onChange={(e) => setConfig((c) => ({ ...c, maxWidth: +e.target.value || 0 }))}
                className="w-full rounded-lg border border-dash-border bg-dash-muted px-3 py-2 text-sm text-dash-text"
                data-testid="compressor-maxw"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-dash-text2 mb-1">Max Height (px)</label>
              <input
                type="number"
                min={0}
                placeholder="0 = no limit"
                value={config.maxHeight || ''}
                onChange={(e) => setConfig((c) => ({ ...c, maxHeight: +e.target.value || 0 }))}
                className="w-full rounded-lg border border-dash-border bg-dash-muted px-3 py-2 text-sm text-dash-text"
                data-testid="compressor-maxh"
              />
            </div>
          </div>

          {error && <p className="text-xs text-red-500" data-testid="compressor-error">{error}</p>}

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={handleCompress}
              disabled={entries.length === 0 || processing}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--im-primary)] px-4 py-2.5 text-sm font-semibold text-[var(--im-primary-fg)] shadow-sm transition hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="compressor-btn"
            >
              {processing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Compressing…
                </>
              ) : (
                <>
                  <Minimize2 className="h-4 w-4" />
                  Compress All
                </>
              )}
            </button>
            {hasCompressed && (
              <button
                onClick={downloadAll}
                className="flex items-center gap-2 rounded-xl border border-dash-border px-4 py-2.5 text-sm font-medium text-dash-text hover:bg-dash-surface-hover transition-colors"
                data-testid="compressor-download"
              >
                <Download className="h-4 w-4" />
                Download All
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Asset Picker overlay */}
      {showPicker && (
        <AssetPicker
          accept="image/*"
          multiple
          onClose={() => setShowPicker(false)}
          onSelect={(files) => {
            setShowPicker(false);
            addFiles(files);
          }}
        />
      )}
    </div>
  );
}
