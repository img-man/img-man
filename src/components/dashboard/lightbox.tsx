// SPDX-License-Identifier: Apache-2.0
'use client';

/**
 * Lightbox — Full-screen photo viewer for Gallery Mode.
 *
 * Google Photos-style experience:
 *  • Full-screen dark backdrop with the image centered
 *  • Arrow keys / swipe to navigate between photos
 *  • Escape or click backdrop to close
 *  • Shows image name, date, and counter
 *  • Smooth fade transition between images
 *  • Zoom on scroll or double-click
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';


export interface LightboxAsset {
  id: string;
  url: string;
  name: string;
  date?: string;
  width?: number;
  height?: number;
}

export interface LightboxProps {
  assets: LightboxAsset[];
  startIndex: number;
  onClose: () => void;
  onDownload?: (asset: LightboxAsset) => void;
}

export function Lightbox({
  assets,
  startIndex,
  onClose,
  onDownload,
}: LightboxProps) {
  const [index, setIndex] = useState(startIndex);
  const [zoom, setZoom] = useState(1);
  const [transitioning, setTransitioning] = useState(false);
  const backdropRef = useRef<HTMLDivElement>(null);
  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const total = assets.length;
  const asset = assets[index];

  const goNext = useCallback(() => {
    if (total <= 1) return;
    if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
    setTransitioning(true);
    transitionTimerRef.current = setTimeout(() => {
      setIndex((i) => (i + 1) % total);
      setZoom(1);
      setTransitioning(false);
      transitionTimerRef.current = null;
    }, 150);
  }, [total]);

  const goPrev = useCallback(() => {
    if (total <= 1) return;
    if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
    setTransitioning(true);
    transitionTimerRef.current = setTimeout(() => {
      setIndex((i) => (i - 1 + total) % total);
      setZoom(1);
      setTransitioning(false);
      transitionTimerRef.current = null;
    }, 150);
  }, [total]);

  // Clean up transition timer on unmount
  useEffect(() => {
    return () => {
      if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
    };
  }, []);

  const handleZoomIn = useCallback(() => {
    setZoom((z) => Math.min(z + 0.5, 4));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((z) => Math.max(z - 0.5, 0.5));
  }, []);

  // Keyboard
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowRight':
          goNext();
          break;
        case 'ArrowLeft':
          goPrev();
          break;
        case 'Escape':
          onClose();
          break;
        case '+':
        case '=':
          handleZoomIn();
          break;
        case '-':
          handleZoomOut();
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [goNext, goPrev, onClose, handleZoomIn, handleZoomOut]);

  // Scroll to zoom
  useEffect(() => {
    const el = backdropRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      if (e.deltaY < 0) setZoom((z) => Math.min(z + 0.25, 4));
      else setZoom((z) => Math.max(z - 0.25, 0.5));
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, []);

  // Close on backdrop click
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === backdropRef.current) onClose();
    },
    [onClose],
  );

  // Double-click to toggle zoom
  const handleDoubleClick = useCallback(() => {
    setZoom((z) => (z > 1 ? 1 : 2));
  }, []);

  if (!asset) return null;

  const formattedDate = asset.date
    ? new Date(asset.date).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Photo viewer"
      className="fixed inset-0 z-[9999] flex flex-col bg-black/95"
      data-testid="lightbox-container"
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 text-white/90">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{asset.name}</p>
          {formattedDate && (
            <p className="text-xs text-white/50">{formattedDate}</p>
          )}
        </div>
        <div className="flex items-center gap-1">
          <span className="mr-3 text-xs text-white/50">
            {index + 1} / {total}
          </span>
          <button
            onClick={handleZoomOut}
            className="rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white transition"
            title="Zoom out (−)"
          >
            <ZoomOut size={18} />
          </button>
          <button
            onClick={handleZoomIn}
            className="rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white transition"
            title="Zoom in (+)"
          >
            <ZoomIn size={18} />
          </button>
          {onDownload && (
            <button
              onClick={() => onDownload(asset)}
              className="rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white transition"
              title="Download"
            >
              <Download size={18} />
            </button>
          )}
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white transition"
            title="Close (Esc)"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Image area */}
      <div
        ref={backdropRef}
        className="relative flex flex-1 items-center justify-center overflow-hidden"
        onClick={handleBackdropClick}
        onDoubleClick={handleDoubleClick}
      >
        {/* Previous button */}
        {total > 1 && (
          <button
            onClick={goPrev}
            className="absolute left-4 z-20 rounded-full bg-black/40 p-2 text-white/70 backdrop-blur-sm transition hover:bg-black/60 hover:text-white"
            title="Previous (←)"
          >
            <ChevronLeft size={28} />
          </button>
        )}

        {/* Image */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={asset.id}
          src={asset.url}
          alt={asset.name}
          className={`max-h-[calc(100vh-120px)] max-w-[calc(100vw-120px)] object-contain transition-all duration-200 select-none ${
            transitioning ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
          }`}
          style={{ transform: `scale(${zoom})` }}
          draggable={false}
        />

        {/* Next button */}
        {total > 1 && (
          <button
            onClick={goNext}
            className="absolute right-4 z-20 rounded-full bg-black/40 p-2 text-white/70 backdrop-blur-sm transition hover:bg-black/60 hover:text-white"
            title="Next (→)"
          >
            <ChevronRight size={28} />
          </button>
        )}
      </div>
    </div>
  );
}
