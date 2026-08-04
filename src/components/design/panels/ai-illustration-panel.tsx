// SPDX-License-Identifier: Apache-2.0
'use client';

import { useState, useCallback } from 'react';
import { Palette, Loader2, Coins } from 'lucide-react';
import AiBadge from '@/components/ai-badge';
import { DESIGN_RESOURCE_CREDITS } from '@/lib/ai-credit-costs';
import { useAiFeatureAccess } from '@/lib/use-ai-feature-access';
import CreditBadge from '../credit-badge';

const ILLUSTRATION_STYLES = [
  { value: 'flat', label: 'Flat Design' },
  { value: 'line-art', label: 'Line Art' },
  { value: 'cartoon', label: 'Cartoon' },
  { value: 'sketch', label: 'Sketch' },
  { value: 'isometric', label: 'Isometric' },
  { value: 'pixel-art', label: 'Pixel Art' },
  { value: 'watercolor', label: 'Watercolor' },
  { value: 'geometric', label: 'Geometric' },
];

const COLOR_PALETTES = [
  {
    value: 'vibrant',
    label: 'Vibrant',
    colors: ['#6366f1', '#ec4899', '#f59e0b', '#10b981'],
  },
  {
    value: 'pastel',
    label: 'Pastel',
    colors: ['#c4b5fd', '#fbcfe8', '#fde68a', '#a7f3d0'],
  },
  {
    value: 'monochrome',
    label: 'Mono',
    colors: ['#1a1a1a', '#4a4a4a', '#8a8a8a', '#d4d4d4'],
  },
  {
    value: 'warm',
    label: 'Warm',
    colors: ['#dc2626', '#ea580c', '#d97706', '#ca8a04'],
  },
  {
    value: 'cool',
    label: 'Cool',
    colors: ['#2563eb', '#0891b2', '#059669', '#7c3aed'],
  },
  {
    value: 'earth',
    label: 'Earth',
    colors: ['#78350f', '#92400e', '#854d0e', '#365314'],
  },
];

interface AiIllustrationPanelProps {
  canvasWidth: number;
  canvasHeight: number;
  onImageGenerated: (imageUrl: string, name: string) => void;
  creditRefreshKey: number;
  onCreditRefresh: () => void;
}

export default function AiIllustrationPanel({
  canvasWidth,
  canvasHeight,
  onImageGenerated,
  creditRefreshKey,
  onCreditRefresh,
}: AiIllustrationPanelProps) {
  const { isFeatureEnabled } = useAiFeatureAccess();
  const [prompt, setPrompt] = useState('');
  const [illustrationStyle, setIllustrationStyle] = useState('flat');
  const [palette, setPalette] = useState('vibrant');
  const [transparentBg, setTransparentBg] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generateEnabled = isFeatureEnabled('generate');

  const creditCost = DESIGN_RESOURCE_CREDITS.ai_illustration;

  const handleGenerate = useCallback(async () => {
    if (!generateEnabled || !prompt.trim()) return;
    setGenerating(true);
    setError(null);

    // Build a detailed prompt with illustration modifiers
    const styleLabel =
      ILLUSTRATION_STYLES.find((s) => s.value === illustrationStyle)?.label ??
      'Flat';
    const paletteLabel =
      COLOR_PALETTES.find((p) => p.value === palette)?.label ?? 'Vibrant';

    const fullPrompt = [
      prompt.trim(),
      `Style: ${styleLabel} illustration`,
      `Color palette: ${paletteLabel} tones`,
      transparentBg ? 'Transparent background, no background' : '',
      'Clean, professional illustration suitable for design use',
    ]
      .filter(Boolean)
      .join('. ');

    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: fullPrompt,
          width: Math.min(canvasWidth, 1024),
          height: Math.min(canvasHeight, 1024),
          style: 'illustration',
          name: `Illustration: ${prompt.slice(0, 30)}`,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Generation failed (${res.status})`);
      }

      const data = await res.json();
      const imageUrl =
        data.asset?.thumbnailBase64 || data.asset?.url || data.imageUrl;
      if (imageUrl) {
        onImageGenerated(imageUrl, `Illustration: ${prompt.slice(0, 25)}`);
        onCreditRefresh();
      } else {
        throw new Error('No image returned');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setGenerating(false);
    }
  }, [
    prompt,
    illustrationStyle,
    palette,
    transparentBg,
    canvasWidth,
    canvasHeight,
    generateEnabled,
    onImageGenerated,
    onCreditRefresh,
  ]);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-dash-border px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Palette size={14} className="text-pink-400" />
            <span className="text-[11px] font-semibold text-dash-text">
              AI Illustration
            </span>
          </div>
          <AiBadge disabled={!generateEnabled} />
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {!generateEnabled && (
          <div className="rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-[10px] text-slate-600 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-300">
            AI illustration is disabled in organization settings.
          </div>
        )}

        {/* Prompt */}
        <div>
          <label className="mb-1 block text-[10px] font-medium text-dash-text-muted">
            Describe your illustration
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="A friendly robot watering plants in a garden..."
            rows={3}
            maxLength={2000}
            disabled={!generateEnabled}
            className="w-full resize-none rounded-lg border border-dash-border bg-dash-muted px-2.5 py-2 text-[11px] text-dash-text placeholder:text-dash-text-muted focus:border-violet-400 focus:outline-none"
          />
        </div>

        {/* Illustration style */}
        <div>
          <label className="mb-1 block text-[10px] font-medium text-dash-text-muted">
            Illustration Style
          </label>
          <div className="grid grid-cols-2 gap-1">
            {ILLUSTRATION_STYLES.map((s) => (
              <button
                key={s.value}
                onClick={() => setIllustrationStyle(s.value)}
                disabled={!generateEnabled}
                className={`rounded-lg border px-2 py-1.5 text-[10px] font-medium transition-colors ${
                  illustrationStyle === s.value
                    ? 'border-pink-500 bg-pink-500/10 text-pink-400'
                    : 'border-dash-border text-dash-text2 hover:bg-dash-muted'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Color palette */}
        <div>
          <label className="mb-1 block text-[10px] font-medium text-dash-text-muted">
            Color Palette
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            {COLOR_PALETTES.map((p) => (
              <button
                key={p.value}
                onClick={() => setPalette(p.value)}
                disabled={!generateEnabled}
                className={`flex flex-col items-center gap-1 rounded-lg border p-1.5 transition-colors ${
                  palette === p.value
                    ? 'border-pink-500 bg-pink-500/10'
                    : 'border-dash-border hover:bg-dash-muted'
                }`}
              >
                <div className="flex gap-0.5">
                  {p.colors.map((c, i) => (
                    <div
                      key={i}
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
                <span className="text-[8px] text-dash-text-muted">
                  {p.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Transparent BG */}
        <label className="flex items-center gap-2 rounded-lg border border-dash-border px-3 py-2">
          <input
            type="checkbox"
            checked={transparentBg}
            onChange={(e) => setTransparentBg(e.target.checked)}
            disabled={!generateEnabled}
            className="h-3 w-3 rounded border-dash-border accent-pink-500"
          />
          <span className="text-[10px] text-dash-text2">
            Transparent background
          </span>
        </label>

        {/* Cost display */}
        <div className="flex items-center justify-between rounded-lg border border-dash-border bg-dash-muted/50 px-3 py-2">
          <div className="flex items-center gap-1.5">
            <Coins size={12} className="text-amber-400" />
            <span className="text-[10px] text-dash-text-muted">Cost:</span>
            <span className="text-[11px] font-semibold text-amber-400">
              {creditCost} credits
            </span>
          </div>
          <CreditBadge refreshKey={creditRefreshKey} />
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-[10px] text-red-600 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Generate button */}
        <button
          onClick={handleGenerate}
          disabled={generating || !prompt.trim() || !generateEnabled}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-pink-600 px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-pink-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {generating ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Creating...
            </>
          ) : (
            <>
              <Palette size={14} />
              Create Illustration
            </>
          )}
        </button>
      </div>
    </div>
  );
}
