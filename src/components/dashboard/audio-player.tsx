// SPDX-License-Identifier: Apache-2.0
'use client';

import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Loader2,
  SkipBack,
  SkipForward,
  AlertCircle,
  Download,
} from 'lucide-react';
import { getFileTypeInfo } from '@/lib/file-types';

/* ─── Types ──────────────────────────────────────────────── */

interface AudioPlayerProps {
  /** Signed GCS URL */
  src: string;
  /** File name */
  name: string;
  /** MIME type (for icon/label) */
  mimeType: string;
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

/** Number of bars to draw in waveform visualization */
const WAVEFORM_BARS = 48;

function buildWaveformData(name: string): number[] {
  const bars: number[] = [];
  let seed = 0;

  for (let index = 0; index < name.length; index++) {
    seed += name.charCodeAt(index);
  }

  for (let index = 0; index < WAVEFORM_BARS; index++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    bars.push((seed / 0x7fffffff) * 0.6 + 0.2);
  }

  return bars;
}

/* ─── Component ──────────────────────────────────────────── */

export function AudioPlayer({
  src,
  name,
  mimeType,
  duration: presetDuration,
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(presetDuration ?? 0);
  const [buffered, setBuffered] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showVolume, setShowVolume] = useState(false);

  const ft = getFileTypeInfo(mimeType);
  const FileIcon = ft?.icon;
  const waveformData = useMemo(() => buildWaveformData(name), [name]);

  /* ─── Audio event handlers ──────────────────────────── */
  const handleLoadedMetadata = () => {
    const a = audioRef.current;
    if (a) {
      setDuration(a.duration);
      setLoading(false);
    }
  };

  const handleTimeUpdate = () => {
    const a = audioRef.current;
    if (a) {
      setCurrentTime(a.currentTime);
      if (a.buffered.length > 0) {
        setBuffered(a.buffered.end(a.buffered.length - 1));
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
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) {
      a.play().catch(() => {});
      setPlaying(true);
    } else {
      a.pause();
      setPlaying(false);
    }
  }, []);

  const toggleMute = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    a.muted = !a.muted;
    setMuted(a.muted);
  }, []);

  const handleVolumeChange = useCallback((val: number) => {
    const a = audioRef.current;
    if (!a) return;
    a.volume = val;
    setVolume(val);
    if (val === 0) {
      a.muted = true;
      setMuted(true);
    } else if (a.muted) {
      a.muted = false;
      setMuted(false);
    }
  }, []);

  const skip = useCallback((delta: number) => {
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = Math.max(0, Math.min(a.duration, a.currentTime + delta));
  }, []);

  const handleProgressClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const bar = progressRef.current;
      const a = audioRef.current;
      if (!bar || !a) return;
      const rect = bar.getBoundingClientRect();
      const pct = Math.max(
        0,
        Math.min(1, (e.clientX - rect.left) / rect.width),
      );
      a.currentTime = pct * a.duration;
    },
    [],
  );

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
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [togglePlay, skip, toggleMute]);

  const progress = duration > 0 ? currentTime / duration : 0;
  const bufferedPct = duration > 0 ? (buffered / duration) * 100 : 0;
  const progressPct = progress * 100;

  /* ─── Error state ───────────────────────────────────── */
  if (error) {
    return (
      <div className="flex w-full flex-col items-center gap-3 rounded-xl bg-red-50 py-8 dark:bg-red-950/30">
        <AlertCircle className="h-10 w-10 text-red-400" />
        <p className="text-sm text-red-600 dark:text-red-400">
          Unable to play this audio. Format may not be supported.
        </p>
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-red-100 px-4 py-2 text-xs font-medium text-red-700 transition hover:bg-red-200 dark:bg-red-900/40 dark:text-red-300"
        >
          <Download className="h-3.5 w-3.5" />
          Download instead
        </a>
      </div>
    );
  }

  /* ─── Render ────────────────────────────────────────── */
  return (
    <div
      className={`flex w-full flex-col gap-4 rounded-xl px-5 py-6 ${ft?.bg ?? 'bg-dash-muted'}`}
    >
      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        onWaiting={handleWaiting}
        onCanPlay={handleCanPlay}
        onError={handleError}
      />

      {/* Icon + title */}
      <div className="flex flex-col items-center gap-2">
        {FileIcon && (
          <FileIcon
            className={`h-10 w-10 ${ft?.color ?? 'text-dash-text-muted'}`}
          />
        )}
        <p className="max-w-full truncate text-center text-sm font-semibold text-dash-text">
          {name}
        </p>
        <span
          className={`text-[10px] font-bold uppercase tracking-wider ${ft?.color ?? 'text-dash-text2'}`}
        >
          {ft?.label ?? 'Audio'}
        </span>
      </div>

      {/* Waveform visualization */}
      <div
        ref={progressRef}
        onClick={handleProgressClick}
        className="relative mx-auto flex h-12 w-full max-w-xs cursor-pointer items-end justify-center gap-[2px]"
      >
        {waveformData.map((height, i) => {
          const barProgress = (i + 0.5) / WAVEFORM_BARS;
          const isPlayed = barProgress <= progress;
          return (
            <div
              key={i}
              className={`w-[3px] rounded-full transition-colors duration-100 ${
                isPlayed
                  ? 'bg-primary'
                  : 'bg-dash-text-muted/30 dark:bg-dash-text-muted/20'
              }`}
              style={{ height: `${height * 100}%` }}
            />
          );
        })}
      </div>

      {/* Time display */}
      <div className="flex items-center justify-between px-2">
        <span className="text-[11px] font-medium tabular-nums text-dash-text-muted">
          {fmtTime(currentTime)}
        </span>
        <span className="text-[11px] font-medium tabular-nums text-dash-text-muted">
          {loading && duration === 0 ? '--:--' : fmtTime(duration)}
        </span>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-3">
        {/* Skip back */}
        <button
          onClick={() => skip(-10)}
          className="rounded-full p-2 text-dash-text-muted transition hover:bg-black/5 hover:text-dash-text dark:hover:bg-white/10"
          title="Back 10s"
        >
          <SkipBack className="h-4 w-4" />
        </button>

        {/* Play/Pause (larger central button) */}
        <button
          onClick={togglePlay}
          disabled={loading && duration === 0}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-white shadow-md transition hover:bg-primary/90 active:scale-95 disabled:opacity-40"
        >
          {loading && duration === 0 ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : playing ? (
            <Pause className="h-5 w-5" />
          ) : (
            <Play className="h-5 w-5 ml-0.5" fill="white" />
          )}
        </button>

        {/* Skip forward */}
        <button
          onClick={() => skip(10)}
          className="rounded-full p-2 text-dash-text-muted transition hover:bg-black/5 hover:text-dash-text dark:hover:bg-white/10"
          title="Forward 10s"
        >
          <SkipForward className="h-4 w-4" />
        </button>

        {/* Volume */}
        <div
          className="relative"
          onMouseEnter={() => setShowVolume(true)}
          onMouseLeave={() => setShowVolume(false)}
        >
          <button
            onClick={toggleMute}
            className="rounded-full p-2 text-dash-text-muted transition hover:bg-black/5 hover:text-dash-text dark:hover:bg-white/10"
          >
            {muted || volume === 0 ? (
              <VolumeX className="h-4 w-4" />
            ) : (
              <Volume2 className="h-4 w-4" />
            )}
          </button>

          {/* Volume slider popup */}
          {showVolume && (
            <div className="absolute -top-24 left-1/2 z-20 flex -translate-x-1/2 flex-col items-center rounded-lg bg-dash-surface p-2 shadow-lg border border-dash-border">
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={muted ? 0 : volume}
                onChange={(e) => handleVolumeChange(Number(e.target.value))}
                className="h-16 w-1.5 cursor-pointer appearance-none rounded-full bg-dash-text-muted/20 accent-primary"
                style={{
                  writingMode: 'vertical-lr',
                  direction: 'rtl',
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Linear progress bar (fallback/detail) */}
      <div className="mx-2 h-1 overflow-hidden rounded-full bg-dash-text-muted/20">
        <div
          className="h-full rounded-full bg-white/30 transition-all"
          style={{ width: `${bufferedPct}%` }}
        />
        <div
          className="relative -top-full h-full rounded-full bg-primary transition-all"
          style={{ width: `${progressPct}%` }}
        />
      </div>
    </div>
  );
}

export default AudioPlayer;
