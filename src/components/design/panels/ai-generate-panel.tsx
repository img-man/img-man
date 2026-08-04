// SPDX-License-Identifier: Apache-2.0
'use client';

import { useEffect, useState, useCallback } from 'react';
import { Sparkles, Loader2, Coins } from 'lucide-react';
import AiBadge from '@/components/ai-badge';
import { DESIGN_RESOURCE_CREDITS } from '@/lib/ai-credit-costs';
import {
  getDefaultModelForProviderCapability,
  getModelsForProviderCapability,
} from '@/lib/ai-models';
import { useAiFeatureAccess } from '@/lib/use-ai-feature-access';
import type { AiProviderId } from '@/types/providers';
import CreditBadge from '../credit-badge';

const STYLE_OPTIONS = [
  { value: 'photorealistic', label: 'Photorealistic' },
  { value: 'illustration', label: 'Illustration' },
  { value: 'icon', label: 'Icon' },
  { value: '3d-render', label: '3D Render' },
  { value: 'watercolor', label: 'Watercolor' },
  { value: 'minimalist', label: 'Minimalist' },
];

const SIZE_OPTIONS = [
  { value: 'canvas', label: 'Canvas Size', w: 0, h: 0 },
  { value: '512', label: '512 × 512', w: 512, h: 512 },
  { value: '1024', label: '1024 × 1024', w: 1024, h: 1024 },
  { value: '1536', label: '1536 × 1536', w: 1536, h: 1536 },
];

interface AiGeneratePanelProps {
  canvasWidth: number;
  canvasHeight: number;
  onImageGenerated: (imageUrl: string, name: string) => void;
  creditRefreshKey: number;
  onCreditRefresh: () => void;
}

export default function AiGeneratePanel({
  canvasWidth,
  canvasHeight,
  onImageGenerated,
  creditRefreshKey,
  onCreditRefresh,
}: AiGeneratePanelProps) {
  const { isFeatureEnabled, provider: settingsProvider } = useAiFeatureAccess();
  const [provider, setProvider] = useState<AiProviderId>('vertex');
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState('photorealistic');
  const [modelId, setModelId] = useState(
    getDefaultModelForProviderCapability('vertex', 'generate')?.id ?? 'gemini-flash',
  );
  const [sizeKey, setSizeKey] = useState('1024');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const genModels = getModelsForProviderCapability(provider, 'generate').filter(
    (model) => !model.capabilities.includes('edit'),
  );
  const generateEnabled = isFeatureEnabled('generate');

  useEffect(() => {
    if (settingsProvider === 'vertex' || settingsProvider === 'openai') {
      setProvider(settingsProvider);
    }
  }, [settingsProvider]);

  useEffect(() => {
    if (!genModels.some((model) => model.id === modelId)) {
      setModelId(
        getDefaultModelForProviderCapability(provider, 'generate')?.id ?? modelId,
      );
    }
  }, [genModels, modelId, provider]);

  const selectedModel =
    genModels.find((m) => m.id === modelId) ?? genModels[0];
  const creditCost =
    selectedModel?.credits ?? DESIGN_RESOURCE_CREDITS.ai_generate_basic;

  const selectedSize =
    SIZE_OPTIONS.find((s) => s.value === sizeKey) ?? SIZE_OPTIONS[2];
  const width = selectedSize.w || canvasWidth;
  const height = selectedSize.h || canvasHeight;

  const handleGenerate = useCallback(async () => {
    if (!generateEnabled || !prompt.trim()) return;
    setGenerating(true);
    setError(null);

    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.trim(),
          width,
          height,
          style,
          model: modelId,
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
        onImageGenerated(imageUrl, `AI: ${prompt.slice(0, 30)}`);
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
    width,
    height,
    style,
    modelId,
    generateEnabled,
    onImageGenerated,
    onCreditRefresh,
  ]);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-dash-border px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-violet-400" />
            <span className="text-[11px] font-semibold text-dash-text">
              AI Image Generator
            </span>
          </div>
          <AiBadge disabled={!generateEnabled} />
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {!generateEnabled && (
          <div className="rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-[10px] text-slate-600 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-300">
            AI generation is disabled in organization settings.
          </div>
        )}

        {/* Prompt */}
        <div>
          <label className="mb-1 block text-[10px] font-medium text-dash-text-muted">
            Describe your image
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="A mountain landscape at sunset with golden clouds..."
            rows={4}
            maxLength={2000}
            disabled={!generateEnabled}
            className="w-full resize-none rounded-lg border border-dash-border bg-dash-muted px-2.5 py-2 text-[11px] text-dash-text placeholder:text-dash-text-muted focus:border-violet-400 focus:outline-none"
          />
          <p className="mt-0.5 text-right text-[9px] text-dash-text-muted">
            {prompt.length}/2000
          </p>
        </div>

        {/* Style */}
        <div>
          <label className="mb-1 block text-[10px] font-medium text-dash-text-muted">
            Style
          </label>
          <div className="grid grid-cols-2 gap-1">
            {STYLE_OPTIONS.map((s) => (
              <button
                key={s.value}
                onClick={() => setStyle(s.value)}
                disabled={!generateEnabled}
                className={`rounded-lg border px-2 py-1.5 text-[10px] font-medium transition-colors ${
                  style === s.value
                    ? 'border-violet-500 bg-violet-500/10 text-violet-400'
                    : 'border-dash-border text-dash-text2 hover:bg-dash-muted'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Model */}
        <div>
          <label className="mb-1 block text-[10px] font-medium text-dash-text-muted">
            AI Model
          </label>
          <select
            value={modelId}
            onChange={(e) => setModelId(e.target.value)}
            disabled={!generateEnabled}
            className="w-full rounded-lg border border-dash-border bg-dash-muted px-2 py-1.5 text-[11px] text-dash-text"
          >
            {genModels.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label} ({m.credits} credits)
              </option>
            ))}
          </select>
          <p className="mt-1 text-[9px] text-dash-text-muted">
            Using {provider === 'openai' ? 'OpenAI' : 'Google Vertex AI'} for generation.
          </p>
        </div>

        {/* Size */}
        <div>
          <label className="mb-1 block text-[10px] font-medium text-dash-text-muted">
            Output Size
          </label>
          <select
            value={sizeKey}
            onChange={(e) => setSizeKey(e.target.value)}
            disabled={!generateEnabled}
            className="w-full rounded-lg border border-dash-border bg-dash-muted px-2 py-1.5 text-[11px] text-dash-text"
          >
            {SIZE_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.value === 'canvas'
                  ? `Canvas (${canvasWidth}×${canvasHeight})`
                  : s.label}
              </option>
            ))}
          </select>
        </div>

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
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {generating ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles size={14} />
              Generate Image
            </>
          )}
        </button>
      </div>
    </div>
  );
}
