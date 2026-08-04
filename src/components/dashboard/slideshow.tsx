// SPDX-License-Identifier: Apache-2.0
'use client';

/**
 * DS-6.4 — Slideshow Mode
 *
 * Fullscreen image slideshow with:
 *  • Transition modes: Fade, Slide, Zoom, Ken Burns
 *  • Configurable interval (3 / 5 / 8 / 10 s)
 *  • Keyboard navigation (← / → / Escape)
 *  • Click to pause / resume
 *  • Progress bar
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  Settings,
  X,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type TransitionMode = 'fade' | 'slide' | 'zoom' | 'kenburns';

export interface SlideshowAsset {
  id: string;
  url: string;
  name?: string;
}

export interface SlideshowProps {
  assets: SlideshowAsset[];
  startIndex?: number;
  /** Default transition mode */
  transition?: TransitionMode;
  /** Default interval in seconds */
  interval?: number;
  onClose: () => void;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

export const TRANSITION_OPTIONS: { value: TransitionMode; label: string }[] = [
  { value: 'fade', label: 'Fade' },
  { value: 'slide', label: 'Slide' },
  { value: 'zoom', label: 'Zoom' },
  { value: 'kenburns', label: 'Ken Burns' },
];

export const INTERVAL_OPTIONS: number[] = [3, 5, 8, 10];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function Slideshow({
  assets,
  startIndex = 0,
  transition: defaultTransition = 'fade',
  interval: defaultInterval = 5,
  onClose,
}: SlideshowProps) {
  const [index, setIndex] = useState(startIndex);
  const [playing, setPlaying] = useState(true);
  const [transition, setTransition] = useState<TransitionMode>(defaultTransition);
  const [interval, setInterval_] = useState(defaultInterval);
  const [showSettings, setShowSettings] = useState(false);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const total = assets.length;

  const next = useCallback(() => {
    setIndex((i) => (i + 1) % total);
    setProgress(0);
  }, [total]);

  const prev = useCallback(() => {
    setIndex((i) => (i - 1 + total) % total);
    setProgress(0);
  }, [total]);

  const togglePlaying = useCallback(() => {
    setPlaying((current) => {
      const nextPlaying = !current;
      if (nextPlaying) {
        setProgress(0);
      }
      return nextPlaying;
    });
  }, []);

  const handleIntervalChange = useCallback((nextInterval: number) => {
    setInterval_(nextInterval);
    setProgress(0);
  }, []);

  /* Auto-advance timer */
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (progressRef.current) clearInterval(progressRef.current);

    if (playing && total > 1) {
      const ms = interval * 1000;
      timerRef.current = setInterval(next, ms);
      progressRef.current = setInterval(() => {
        setProgress((p) => Math.min(p + 100 / (ms / 50), 100));
      }, 50);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (progressRef.current) clearInterval(progressRef.current);
    };
  }, [playing, interval, total, next]);

  /* Keyboard navigation */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowRight':
          next();
          break;
        case 'ArrowLeft':
          prev();
          break;
        case 'Escape':
          onClose();
          break;
        case ' ':
          e.preventDefault();
          togglePlaying();
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [next, prev, onClose, togglePlaying]);

  /* Transition CSS class — applied per-image */
  const transitionClass = useMemo(() => {
    switch (transition) {
      case 'fade':
        return 'animate-slideshow-fade';
      case 'slide':
        return 'animate-slideshow-slide';
      case 'zoom':
        return 'animate-slideshow-zoom';
      case 'kenburns':
        return 'animate-slideshow-kenburns';
      default:
        return '';
    }
  }, [transition]);

  const asset = assets[index];
  if (!asset) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col bg-black"
      data-testid="slideshow-container"
    >
      {/* Inline keyframes */}
      <style>{`
        @keyframes slideshow-fade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideshow-slide { from { transform: translateX(40px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes slideshow-zoom { from { transform: scale(0.92); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        @keyframes slideshow-kenburns { 0% { transform: scale(1); } 100% { transform: scale(1.08); } }
        .animate-slideshow-fade { animation: slideshow-fade 0.6s ease both; }
        .animate-slideshow-slide { animation: slideshow-slide 0.5s ease both; }
        .animate-slideshow-zoom { animation: slideshow-zoom 0.5s ease both; }
        .animate-slideshow-kenburns { animation: slideshow-kenburns ${interval}s ease both; }
      `}</style>

      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 text-white/80">
        <span className="text-sm" data-testid="slideshow-counter">
          {index + 1} / {total}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSettings((s) => !s)}
            className="rounded p-1 hover:bg-white/10"
            title="Settings"
            data-testid="slideshow-settings-btn"
          >
            <Settings size={18} />
          </button>
          <button
            onClick={onClose}
            className="rounded p-1 hover:bg-white/10"
            title="Close"
            data-testid="slideshow-close"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Settings dropdown */}
      {showSettings && (
        <div
          className="absolute right-4 top-12 z-50 w-56 rounded-lg border border-white/10 bg-gray-900 p-4 shadow-xl"
          data-testid="slideshow-settings-panel"
        >
          <label className="mb-1 block text-xs font-medium text-white/70">
            Transition
          </label>
          <select
            value={transition}
            onChange={(e) => setTransition(e.target.value as TransitionMode)}
            className="mb-3 w-full rounded bg-gray-800 px-2 py-1 text-sm text-white"
            data-testid="slideshow-transition-select"
          >
            {TRANSITION_OPTIONS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>

          <label className="mb-1 block text-xs font-medium text-white/70">
            Interval (seconds)
          </label>
          <select
            value={interval}
            onChange={(e) => handleIntervalChange(Number(e.target.value))}
            className="w-full rounded bg-gray-800 px-2 py-1 text-sm text-white"
            data-testid="slideshow-interval-select"
          >
            {INTERVAL_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}s
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Image area */}
      <div
        className="relative flex flex-1 cursor-pointer items-center justify-center overflow-hidden"
        onClick={togglePlaying}
        data-testid="slideshow-image-area"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={`${asset.id}-${index}`}
          src={asset.url}
          alt={asset.name || ''}
          className={`max-h-full max-w-full object-contain ${transitionClass}`}
          data-testid="slideshow-image"
        />

        {/* Pause overlay */}
        {!playing && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <Play size={64} className="text-white/60" />
          </div>
        )}
      </div>

      {/* Navigation arrows */}
      {total > 1 && (
        <>
          <button
            onClick={(e) => {
              e.stopPropagation();
              prev();
            }}
            className="absolute left-4 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white hover:bg-black/70"
            data-testid="slideshow-prev"
          >
            <ChevronLeft size={28} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              next();
            }}
            className="absolute right-4 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white hover:bg-black/70"
            data-testid="slideshow-next"
          >
            <ChevronRight size={28} />
          </button>
        </>
      )}

      {/* Progress bar */}
      {playing && total > 1 && (
        <div className="h-1 w-full bg-white/10" data-testid="slideshow-progress-bar">
          <div
            className="h-full bg-blue-500 transition-[width] duration-75"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Bottom bar — play/pause + file name */}
      <div className="flex items-center justify-between px-4 py-2 text-white/80">
        <button
          onClick={togglePlaying}
          className="rounded p-1 hover:bg-white/10"
          data-testid="slideshow-play-btn"
        >
          {playing ? <Pause size={18} /> : <Play size={18} />}
        </button>
        <span className="truncate text-sm opacity-70">{asset.name}</span>
      </div>
    </div>
  );
}

export default Slideshow;
