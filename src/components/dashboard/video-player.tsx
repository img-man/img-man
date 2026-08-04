// SPDX-License-Identifier: Apache-2.0
'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  SkipBack,
  SkipForward,
  Loader2,
} from 'lucide-react';

/* ─── Types ──────────────────────────────────────────────── */

interface VideoPlayerProps {
  /** Signed GCS URL */
  src: string;
  /** Poster/thumbnail URL */
  poster?: string | null;
  /** File name */
  name: string;
  /** Pre-extracted duration (seconds) */
  duration?: number;
}

/* ─── Helpers ────────────────────────────────────────────── */

function fmtTime(secs: number): string {
  if (!isFinite(secs) || secs < 0) return '0:00';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  if (h > 0)
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2];

/* ─── Component ──────────────────────────────────────────── */

export function VideoPlayer({
  src,
  poster,
  name,
  duration: presetDuration,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(presetDuration ?? 0);
  const [buffered, setBuffered] = useState(0);
  const [rateIdx, setRateIdx] = useState(2); // 1x
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const hideControlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ─── Auto-hide controls ────────────────────────────── */
  const resetControlsTimer = useCallback(() => {
    setControlsVisible(true);
    if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
    if (playing) {
      hideControlsTimer.current = setTimeout(
        () => setControlsVisible(false),
        3000,
      );
    }
  }, [playing]);

  useEffect(() => {
    if (playing) {
      const timer = setTimeout(() => setControlsVisible(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [playing]);

  const showControls = !playing || controlsVisible;

  /* ─── Video event handlers ──────────────────────────── */
  const handleLoadedMetadata = () => {
    const v = videoRef.current;
    if (v) {
      setDuration(v.duration);
      setLoading(false);
    }
  };

  const handleTimeUpdate = () => {
    const v = videoRef.current;
    if (v) {
      setCurrentTime(v.currentTime);
      if (v.buffered.length > 0) {
        setBuffered(v.buffered.end(v.buffered.length - 1));
      }
    }
  };

  const handleEnded = () => setPlaying(false);
  const handleWaiting = () => setLoading(true);
  const handleCanPlay = () => setLoading(false);
  const handleError = () => {
    setError(true);
    setLoading(false);
  };

  /* ─── Controls ──────────────────────────────────────── */
  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play().catch(() => {});
      setPlaying(true);
    } else {
      v.pause();
      setPlaying(false);
    }
  }, []);

  const toggleMute = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  }, []);

  const skip = useCallback((delta: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(v.duration, v.currentTime + delta));
  }, []);

  const cycleRate = useCallback(() => {
    const nextIdx = (rateIdx + 1) % PLAYBACK_RATES.length;
    setRateIdx(nextIdx);
    if (videoRef.current) {
      videoRef.current.playbackRate = PLAYBACK_RATES[nextIdx];
    }
  }, [rateIdx]);

  const handleProgressClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const bar = progressRef.current;
      const v = videoRef.current;
      if (!bar || !v) return;
      const rect = bar.getBoundingClientRect();
      const pct = Math.max(
        0,
        Math.min(1, (e.clientX - rect.left) / rect.width),
      );
      v.currentTime = pct * v.duration;
    },
    [],
  );

  const goFullscreen = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.requestFullscreen) v.requestFullscreen();
  }, []);

  /* ─── Keyboard shortcuts ────────────────────────────── */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'k') {
        e.preventDefault();
        togglePlay();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        skip(-5);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        skip(5);
      } else if (e.key === 'm') {
        e.preventDefault();
        toggleMute();
      } else if (e.key === 'f') {
        e.preventDefault();
        goFullscreen();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [togglePlay, skip, toggleMute, goFullscreen]);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedPct = duration > 0 ? (buffered / duration) * 100 : 0;

  /* ─── Error state ───────────────────────────────────── */
  if (error) {
    return (
      <div className="flex w-full flex-col items-center gap-3 rounded-xl bg-red-50 py-8 dark:bg-red-950/30">
        <VolumeX className="h-10 w-10 text-red-400" />
        <p className="text-sm text-red-600 dark:text-red-400">
          Unable to play this video. Format may not be supported.
        </p>
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-red-100 px-4 py-2 text-xs font-medium text-red-700 transition hover:bg-red-200 dark:bg-red-900/40 dark:text-red-300"
        >
          Download instead
        </a>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-2">
      {/* Video container */}
      <div
        className="group relative overflow-hidden rounded-lg bg-black"
        onMouseMove={resetControlsTimer}
        onClick={togglePlay}
      >
        <video
          ref={videoRef}
          src={src}
          poster={poster ?? undefined}
          preload="metadata"
          playsInline
          className="max-h-80 w-full object-contain"
          onLoadedMetadata={handleLoadedMetadata}
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleEnded}
          onWaiting={handleWaiting}
          onCanPlay={handleCanPlay}
          onError={handleError}
        />

        {/* Loading spinner overlay */}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <Loader2 className="h-8 w-8 animate-spin text-white" />
          </div>
        )}

        {/* Play button overlay (when paused) */}
        {!playing && !loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-black/50 backdrop-blur-sm transition hover:bg-black/70">
              <Play className="h-6 w-6 text-white ml-0.5" fill="white" />
            </div>
          </div>
        )}

        {/* Bottom controls bar */}
        <div
          className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-3 pb-2 pt-6 transition-opacity duration-200 ${
            showControls ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Progress bar */}
          <div
            ref={progressRef}
            className="group/progress mb-2 h-1 cursor-pointer rounded-full bg-white/25 transition-all hover:h-1.5"
            onClick={handleProgressClick}
          >
            <div
              className="absolute h-full rounded-full bg-white/30"
              style={{ width: `${bufferedPct}%` }}
            />
            <div
              className="relative h-full rounded-full bg-white"
              style={{ width: `${progress}%` }}
            >
              <div className="absolute -right-1.5 -top-0.5 h-3 w-3 rounded-full bg-white opacity-0 shadow transition group-hover/progress:opacity-100" />
            </div>
          </div>

          {/* Control buttons */}
          <div className="flex items-center gap-2 text-white">
            <button
              onClick={togglePlay}
              className="rounded p-1 transition hover:bg-white/20"
            >
              {playing ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4" fill="white" />
              )}
            </button>
            <button
              onClick={() => skip(-10)}
              className="rounded p-1 transition hover:bg-white/20"
              title="Back 10s"
            >
              <SkipBack className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => skip(10)}
              className="rounded p-1 transition hover:bg-white/20"
              title="Forward 10s"
            >
              <SkipForward className="h-3.5 w-3.5" />
            </button>

            {/* Time */}
            <span className="flex-1 text-[11px] font-medium tabular-nums">
              {fmtTime(currentTime)} / {fmtTime(duration)}
            </span>

            {/* Playback rate */}
            <button
              onClick={cycleRate}
              className="rounded px-1.5 py-0.5 text-[10px] font-bold tabular-nums transition hover:bg-white/20"
              title="Playback speed"
            >
              {PLAYBACK_RATES[rateIdx]}x
            </button>

            {/* Mute */}
            <button
              onClick={toggleMute}
              className="rounded p-1 transition hover:bg-white/20"
            >
              {muted ? (
                <VolumeX className="h-3.5 w-3.5" />
              ) : (
                <Volume2 className="h-3.5 w-3.5" />
              )}
            </button>

            {/* Fullscreen */}
            <button
              onClick={goFullscreen}
              className="rounded p-1 transition hover:bg-white/20"
            >
              <Maximize className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* File name */}
      <p className="max-w-full truncate text-center text-[11px] font-medium text-dash-text2">
        {name}
      </p>
    </div>
  );
}
