// SPDX-License-Identifier: Apache-2.0
'use client';

import { useState, useCallback, useMemo } from 'react';
import {
  Sparkles,
  Loader2,
  X,
  SlidersHorizontal,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import {
  BUILTIN_PRESETS,
  FILTER_CATEGORIES,
  type FilterPreset,
  type FilterCategory,
  applyPresetAtIntensity,
  presetToCSSFilter,
} from './filter-presets';
import {
  adjustmentsToCSSFilter,
  type PhotoAdjustments,
} from './photo-adjustments';

// ── Props ─────────────────────────────────────────────────────────

export interface BatchFilterDialogProps {
  /** Selected asset IDs */
  assetIds: string[];
  /** Representative thumbnail URL used for preview */
  previewSrc?: string;
  /** Called when the dialog is closed */
  onClose: () => void;
  /** Called after a successful batch apply so the grid can refresh */
  onComplete?: () => void;
}

// ── Component ─────────────────────────────────────────────────────

export default function BatchFilterDialog({
  assetIds,
  previewSrc,
  onClose,
  onComplete,
}: BatchFilterDialogProps) {
  const [activeCategory, setActiveCategory] = useState<FilterCategory | 'all'>(
    'all',
  );
  const [selectedPreset, setSelectedPreset] = useState<FilterPreset | null>(
    null,
  );
  const [intensity, setIntensity] = useState(100);
  const [mode, setMode] = useState<'copy' | 'overwrite'>('copy');
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<{
    total: number;
    succeeded: number;
    failed: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Filter presets by category
  const filteredPresets = useMemo(() => {
    if (activeCategory === 'all') return BUILTIN_PRESETS;
    return BUILTIN_PRESETS.filter((p) => p.category === activeCategory);
  }, [activeCategory]);

  // Current adjustments from selected preset + intensity
  const currentAdjustments = useMemo(() => {
    if (!selectedPreset) return null;
    return applyPresetAtIntensity(selectedPreset, intensity);
  }, [selectedPreset, intensity]);

  // CSS filter for preview
  const previewFilter = useMemo(() => {
    if (!currentAdjustments) return 'none';
    return adjustmentsToCSSFilter(currentAdjustments);
  }, [currentAdjustments]);

  // Apply batch filter
  const handleApply = useCallback(async () => {
    if (!currentAdjustments || assetIds.length === 0) return;
    setProcessing(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch('/api/assets/batch-edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetIds,
          adjustments: currentAdjustments,
          mode,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Request failed (${res.status})`);
      }

      const data = await res.json();
      setResult(data.summary);

      if (data.summary.failed === 0) {
        // Auto-close after 1.5s on full success
        setTimeout(() => {
          onComplete?.();
          onClose();
        }, 1500);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setProcessing(false);
    }
  }, [currentAdjustments, assetIds, mode, onComplete, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-700 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-violet-100 dark:bg-violet-900/30">
              <SlidersHorizontal className="h-5 w-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">
                Batch Apply Filter
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Apply a filter preset to {assetIds.length} selected image
                {assetIds.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={processing}
            className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Category Filter */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <button
              onClick={() => setActiveCategory('all')}
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition ${
                activeCategory === 'all'
                  ? 'bg-violet-600 text-white'
                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
              }`}
            >
              All
            </button>
            {FILTER_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition ${
                  activeCategory === cat.id
                    ? 'bg-violet-600 text-white'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Preset Grid + Preview */}
          <div className="flex gap-5">
            {/* Presets */}
            <div className="flex-1 grid grid-cols-3 gap-2 max-h-56 overflow-y-auto pr-1">
              {filteredPresets.map((preset) => {
                const isSelected = selectedPreset?.id === preset.id;
                return (
                  <button
                    key={preset.id}
                    onClick={() => {
                      setSelectedPreset(preset);
                      setIntensity(100);
                    }}
                    className={`relative rounded-lg border-2 p-2 text-center text-xs font-medium transition ${
                      isSelected
                        ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300'
                        : 'border-transparent bg-neutral-50 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:border-neutral-300 dark:hover:border-neutral-600'
                    }`}
                  >
                    {/* Mini preview swatch */}
                    {previewSrc && (
                      <div className="mx-auto mb-1.5 h-12 w-16 overflow-hidden rounded-md bg-neutral-200 dark:bg-neutral-700">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={previewSrc}
                          alt={preset.name}
                          className="h-full w-full object-cover"
                          style={{ filter: presetToCSSFilter(preset) }}
                        />
                      </div>
                    )}
                    {preset.name}
                    {isSelected && (
                      <div className="absolute -top-1 -right-1">
                        <CheckCircle2 className="h-4 w-4 text-violet-500" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Live Preview */}
            {previewSrc && selectedPreset && (
              <div className="w-40 shrink-0">
                <p className="text-[10px] font-medium uppercase tracking-wider text-neutral-400 mb-2">
                  Preview
                </p>
                <div className="overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-700">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewSrc}
                    alt="Preview"
                    className="w-full object-cover"
                    style={{ filter: previewFilter }}
                  />
                </div>
                <p className="mt-1.5 text-center text-xs text-neutral-500">
                  {selectedPreset.name} @ {intensity}%
                </p>
              </div>
            )}
          </div>

          {/* Intensity Slider */}
          {selectedPreset && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
                  Intensity
                </label>
                <span className="text-xs font-mono text-neutral-500">
                  {intensity}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={intensity}
                onChange={(e) => setIntensity(Number(e.target.value))}
                className="w-full accent-violet-600"
              />
            </div>
          )}

          {/* Mode Toggle */}
          <div className="flex items-center gap-4">
            <p className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
              Mode:
            </p>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="batch-mode"
                value="copy"
                checked={mode === 'copy'}
                onChange={() => setMode('copy')}
                className="accent-violet-600"
              />
              <span className="text-xs text-neutral-700 dark:text-neutral-300">
                Save as copies
              </span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="batch-mode"
                value="overwrite"
                checked={mode === 'overwrite'}
                onChange={() => setMode('overwrite')}
                className="accent-violet-600"
              />
              <span className="text-xs text-neutral-700 dark:text-neutral-300">
                Overwrite originals
              </span>
            </label>
          </div>

          {/* Result / Error */}
          {result && (
            <div
              className={`rounded-lg p-3 text-sm ${
                result.failed === 0
                  ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                  : 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400'
              }`}
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                <span>
                  {result.succeeded} of {result.total} processed successfully
                  {result.failed > 0 && ` (${result.failed} failed)`}
                </span>
              </div>
            </div>
          )}
          {error && (
            <div className="rounded-lg p-3 text-sm bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                <span>{error}</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-neutral-200 dark:border-neutral-700 px-6 py-4">
          <button
            onClick={onClose}
            disabled={processing}
            className="rounded-lg px-4 py-2 text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            disabled={!selectedPreset || processing || !!result}
            className="flex items-center gap-2 rounded-lg bg-violet-600 px-5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {processing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Apply to {assetIds.length} image
                {assetIds.length !== 1 ? 's' : ''}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
