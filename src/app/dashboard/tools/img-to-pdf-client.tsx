// SPDX-License-Identifier: Apache-2.0
'use client';

/**
 * DS-7.2 — Images to PDF Tool
 * Upload/select images, configure page layout, generate PDF client-side.
 * Uses pdf-lib for PDF generation.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  X,
  Upload,
  Download,
  Loader2,
  Trash2,
  ChevronDown,
  Images,
  Library,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { ToolOutputActions } from '@/components/dashboard/ToolOutputActions';

const AssetPicker = dynamic(
  () => import('@/components/dashboard/asset-picker'),
  { ssr: false },
);

interface ImageEntry {
  id: string;
  file: File;
  name: string;
  previewUrl: string;
  width: number;
  height: number;
}

type PageSize = 'a4' | 'letter' | 'custom';
type Orientation = 'portrait' | 'landscape';

interface PdfConfig {
  pageSize: PageSize;
  orientation: Orientation;
  customW: number;
  customH: number;
  margin: number;
  imagesPerPage: number;
  quality: number;
}

const PAGE_SIZES: Record<string, { w: number; h: number }> = {
  a4: { w: 595.28, h: 841.89 },
  letter: { w: 612, h: 792 },
};

let _imgId = 0;
function genId() {
  return `img-${++_imgId}-${Date.now()}`;
}

export interface ImgToPdfModalProps {
  onClose: () => void;
}

export default function ImgToPdfModal({ onClose }: ImgToPdfModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [images, setImages] = useState<ImageEntry[]>([]);
  const [config, setConfig] = useState<PdfConfig>({
    pageSize: 'a4',
    orientation: 'portrait',
    customW: 612,
    customH: 792,
    margin: 40,
    imagesPerPage: 1,
    quality: 85,
  });
  const [processing, setProcessing] = useState(false);
  const [loadingImages, setLoadingImages] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [resultName, setResultName] = useState('images.pdf');

  // Clear generated result when inputs or config change so user can regenerate
  useEffect(() => {
    setResultBlob(null);
  }, [images, config]);

  // Track preview URLs for cleanup on unmount
  const previewUrlsRef = useRef<string[]>([]);

  // Revoke all preview URLs on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  const addFiles = useCallback(async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (files.length === 0) return;
    setLoadingImages(true);
    setError(null);
    try {
      const entries: ImageEntry[] = [];
      for (const file of files) {
        // Accept image types that pdf-lib can embed (PNG/JPEG; others converted via canvas)
        if (
          !file.type.startsWith('image/') &&
          !file.name.match(/\.(jpe?g|png|gif|webp)$/i)
        )
          continue;
        const url = URL.createObjectURL(file);
        const dims = await new Promise<{ w: number; h: number }>((resolve) => {
          const img = new Image();
          img.onload = () =>
            resolve({ w: img.naturalWidth, h: img.naturalHeight });
          img.onerror = () => resolve({ w: 100, h: 100 }); // fallback dims
          img.src = url;
        });
        entries.push({
          id: genId(),
          file,
          name: file.name,
          previewUrl: url,
          width: dims.w,
          height: dims.h,
        });
      }
      if (entries.length === 0) {
        setError(
          'No valid image files found. Please select PNG, JPEG, WEBP, or GIF images (SVG, BMP, and TIFF are not supported).',
        );
        return;
      }
      previewUrlsRef.current.push(...entries.map((e) => e.previewUrl));
      setImages((prev) => [...prev, ...entries]);
    } catch {
      setError('Failed to load images.');
    } finally {
      setLoadingImages(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      addFiles(e.dataTransfer.files);
    },
    [addFiles],
  );

  const removeImage = useCallback((id: string) => {
    setImages((prev) => {
      const found = prev.find((i) => i.id === id);
      if (found) {
        URL.revokeObjectURL(found.previewUrl);
        previewUrlsRef.current = previewUrlsRef.current.filter(
          (u) => u !== found.previewUrl,
        );
      }
      return prev.filter((i) => i.id !== id);
    });
  }, []);

  const getPageDimensions = useCallback(() => {
    let w: number;
    let h: number;
    if (config.pageSize === 'custom') {
      w = config.customW;
      h = config.customH;
    } else {
      const size = PAGE_SIZES[config.pageSize];
      w = size.w;
      h = size.h;
    }
    if (config.orientation === 'landscape') [w, h] = [h, w];
    return { w, h };
  }, [config]);

  const handleGenerate = useCallback(async () => {
    if (images.length === 0) {
      setError('Please add at least one image.');
      return;
    }
    setProcessing(true);
    setError(null);
    try {
      const { PDFDocument } = await import('pdf-lib');
      const pdf = await PDFDocument.create();
      const { w: pageW, h: pageH } = getPageDimensions();
      const margin = config.margin;

      // Process images in groups based on imagesPerPage
      const perPage = Math.max(1, config.imagesPerPage);
      for (let i = 0; i < images.length; i += perPage) {
        const page = pdf.addPage([pageW, pageH]);
        const batch = images.slice(i, i + perPage);
        const contentW = pageW - margin * 2;
        const contentH = pageH - margin * 2;

        // Layout: stack vertically with equal spacing
        const slotH = contentH / batch.length;

        for (let j = 0; j < batch.length; j++) {
          const entry = batch[j];
          // Convert image to embeddable format
          const bytes = await entry.file.arrayBuffer();
          let embedded;
          if (entry.file.type === 'image/png') {
            embedded = await pdf.embedPng(bytes);
          } else {
            // Convert to JPEG via canvas for non-PNG formats
            const canvas = document.createElement('canvas');
            canvas.width = entry.width;
            canvas.height = entry.height;
            const ctx = canvas.getContext('2d')!;
            const img = new Image();
            await new Promise<void>((resolve, reject) => {
              img.onload = () => resolve();
              img.onerror = reject;
              img.src = entry.previewUrl;
            });
            ctx.drawImage(img, 0, 0);
            const blob = await new Promise<Blob | null>((res) =>
              canvas.toBlob(res, 'image/jpeg', config.quality / 100),
            );
            if (!blob) continue;
            const jpegBytes = await blob.arrayBuffer();
            embedded = await pdf.embedJpg(new Uint8Array(jpegBytes));
          }

          // Scale to fit slot
          const aspect = embedded.width / embedded.height;
          let drawW = contentW;
          let drawH = drawW / aspect;
          if (drawH > slotH - 10) {
            drawH = slotH - 10;
            drawW = drawH * aspect;
          }
          const x = margin + (contentW - drawW) / 2;
          const y = pageH - margin - (j + 1) * slotH + (slotH - drawH) / 2;

          page.drawImage(embedded, { x, y, width: drawW, height: drawH });
        }
      }

      const pdfBytes = await pdf.save();
      const blob = new Blob([pdfBytes as unknown as BlobPart], {
        type: 'application/pdf',
      });
      setResultBlob(blob);
      setResultName('images.pdf');
    } catch (err) {
      setError(
        `Generation failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      );
    } finally {
      setProcessing(false);
    }
  }, [images, config, getPageDimensions]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div
        className="relative w-full max-w-2xl rounded-2xl border border-dash-border bg-dash-surface shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-dash-border px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-dash-text">
              Images to PDF
            </h2>
            <p className="text-xs text-dash-text-muted mt-0.5">
              Convert images into a PDF document
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-dash-text-muted hover:bg-dash-surface-hover hover:text-dash-text transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Source selection */}
          <div className="flex gap-2">
            <div
              className="flex flex-1 items-center justify-center rounded-xl border-2 border-dashed border-dash-border bg-dash-muted hover:border-[var(--im-primary)]/60 h-24 cursor-pointer transition-colors"
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
              data-testid="img-pdf-drop"
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
              className="flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-dash-border bg-dash-muted hover:border-[var(--im-primary)]/60 hover:bg-[var(--im-primary-light)] h-24 w-36 cursor-pointer transition-colors text-dash-text-muted"
              data-testid="img-pdf-browse"
            >
              <Library className="h-5 w-5" />
              <span className="text-xs font-medium">Browse Library</span>
            </button>
          </div>

          {/* Image thumbnails */}
          {loadingImages && (
            <div className="flex items-center gap-2 text-sm text-dash-text-muted py-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading images…
            </div>
          )}
          {images.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-dash-text2">
                  {images.length} image{images.length !== 1 ? 's' : ''} selected
                </p>
                <button
                  onClick={() => {
                    images.forEach((img) =>
                      URL.revokeObjectURL(img.previewUrl),
                    );
                    previewUrlsRef.current = [];
                    setImages([]);
                  }}
                  className="text-[10px] font-semibold text-red-500 hover:underline"
                >
                  Clear All
                </button>
              </div>
              <div
                className="flex flex-wrap gap-2"
                data-testid="img-pdf-thumbs"
              >
                {images.map((img) => (
                  <div key={img.id} className="relative group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img.previewUrl}
                      alt={img.name}
                      className="h-20 w-20 rounded-lg object-cover border border-dash-border"
                    />
                    <button
                      onClick={() => removeImage(img.id)}
                      className="absolute -right-1 -top-1 rounded-full bg-red-500 p-0.5 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                    <p className="text-[9px] text-dash-text-muted truncate w-20 mt-0.5 text-center">
                      {img.name}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Configuration */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-dash-text2 mb-1">
                Page Size
              </label>
              <div className="relative">
                <select
                  value={config.pageSize}
                  onChange={(e) =>
                    setConfig((c) => ({
                      ...c,
                      pageSize: e.target.value as PageSize,
                    }))
                  }
                  className="w-full appearance-none rounded-lg border border-dash-border bg-dash-muted px-3 py-2 pr-8 text-sm text-dash-text cursor-pointer"
                  data-testid="img-pdf-pagesize"
                >
                  <option value="a4">A4</option>
                  <option value="letter">Letter</option>
                  <option value="custom">Custom</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-dash-text-muted" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-dash-text2 mb-1">
                Orientation
              </label>
              <div className="relative">
                <select
                  value={config.orientation}
                  onChange={(e) =>
                    setConfig((c) => ({
                      ...c,
                      orientation: e.target.value as Orientation,
                    }))
                  }
                  className="w-full appearance-none rounded-lg border border-dash-border bg-dash-muted px-3 py-2 pr-8 text-sm text-dash-text cursor-pointer"
                  data-testid="img-pdf-orientation"
                >
                  <option value="portrait">Portrait</option>
                  <option value="landscape">Landscape</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-dash-text-muted" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-dash-text2 mb-1">
                Margin (pt): {config.margin}
              </label>
              <input
                type="range"
                min={0}
                max={100}
                value={config.margin}
                onChange={(e) =>
                  setConfig((c) => ({ ...c, margin: +e.target.value }))
                }
                className="w-full"
                data-testid="img-pdf-margin"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-dash-text2 mb-1">
                Images/Page: {config.imagesPerPage}
              </label>
              <input
                type="range"
                min={1}
                max={4}
                value={config.imagesPerPage}
                onChange={(e) =>
                  setConfig((c) => ({ ...c, imagesPerPage: +e.target.value }))
                }
                className="w-full"
                data-testid="img-pdf-perpage"
              />
            </div>
          </div>

          {/* Error */}
          {error && <p className="text-xs text-red-500">{error}</p>}

          {/* Generate button */}
          {resultBlob ? (
            <ToolOutputActions
              blob={resultBlob}
              fileName={resultName}
              mimeType="application/pdf"
            />
          ) : (
            <button
              onClick={handleGenerate}
              disabled={images.length === 0 || processing}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--im-primary)] px-4 py-2.5 text-sm font-semibold text-[var(--im-primary-fg)] shadow-sm transition hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="img-pdf-generate-btn"
            >
              {processing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating…
                </>
              ) : (
                <>
                  <Images className="h-4 w-4" />
                  Generate PDF
                </>
              )}
            </button>
          )}
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
