// SPDX-License-Identifier: Apache-2.0
'use client';

/**
 * DS-5.1–DS-5.5 AI Image Tools Panel
 *
 * Client-side panel component that surfaces 5 AI image tools:
 * 1. Auto Enhance (DS-5.1) — one-click magic enhance
 * 2. Denoise (DS-5.2) — AI noise reduction with strength selector
 * 3. Smart Crop (DS-5.3) — AI subject-aware crop suggestions
 * 4. Sky Replacement (DS-5.4) — AI sky swap with presets
 * 5. Object Move (DS-5.5) — AI object relocation with inpaint
 *
 * Each tool calls the corresponding `/api/ai/*` endpoint and
 * displays before/after results.
 */

import { useState, useCallback } from 'react';
import {
  Sparkles,
  AudioLines,
  Crop,
  CloudSun,
  Move,
  Loader2,
  ChevronDown,
  ChevronUp,
  Check,
  AlertCircle,
  RefreshCw,
  Aperture,
  Sun,
  Palette,
  MessageSquareText,
  Pipette,
  Clapperboard,
  Rocket,
} from 'lucide-react';
import AiBadge from '@/components/ai-badge';
import { useAiFeatureAccess } from '@/lib/use-ai-feature-access';

/* ─── Shared Types ───────────────────────────────────────── */

export interface AiToolsPanelProps {
  assetId: string;
  /** Called after a successful operation with the variant URL */
  onResult?: (tool: AiToolId, result: AiToolResult) => void;
}

export type AiToolId =
  | 'enhance'
  | 'denoise'
  | 'smart_crop'
  | 'sky_replace'
  | 'object_move'
  | 'bokeh'
  | 'relight'
  | 'style_transfer'
  | 'caption'
  | 'color_fix'
  | 'animate'
  | 'ai_boost';

export interface AiToolResult {
  jobId: string;
  status: 'completed' | 'failed';
  result?: Record<string, unknown>;
  error?: string;
}

/* ─── Tool Definitions ───────────────────────────────────── */

export interface AiToolDef {
  id: AiToolId;
  label: string;
  description: string;
  credits: number;
  icon: typeof Sparkles;
  featureKeys?: readonly string[];
}

export const AI_TOOLS: AiToolDef[] = [
  {
    id: 'enhance',
    label: 'Magic Enhance',
    description:
      'One-click auto-adjustment of exposure, color, and sharpness.',
    credits: 1,
    icon: Sparkles,
    featureKeys: ['edit'],
  },
  {
    id: 'denoise',
    label: 'Reduce Noise',
    description:
      'AI-powered noise reduction with selectable strength.',
    credits: 2,
    icon: AudioLines,
    featureKeys: ['edit'],
  },
  {
    id: 'smart_crop',
    label: 'Smart Crop',
    description:
      'AI detects the subject and suggests optimal crop regions.',
    credits: 1,
    icon: Crop,
    featureKeys: ['edit'],
  },
  {
    id: 'sky_replace',
    label: 'Replace Sky',
    description:
      'Swap the sky with AI-generated presets or custom prompts.',
    credits: 3,
    icon: CloudSun,
    featureKeys: ['edit'],
  },
  {
    id: 'object_move',
    label: 'Move Object',
    description:
      'Relocate objects within the image. AI inpaints the void.',
    credits: 5,
    icon: Move,
    featureKeys: ['edit'],
  },
  {
    id: 'bokeh',
    label: 'Portrait Blur',
    description:
      'AI separates subject from background and applies adjustable bokeh blur.',
    credits: 2,
    icon: Aperture,
    featureKeys: ['edit'],
  },
  {
    id: 'relight',
    label: 'Relight Scene',
    description:
      'Virtual lighting direction, intensity, and color temperature control.',
    credits: 3,
    icon: Sun,
    featureKeys: ['edit'],
  },
  {
    id: 'style_transfer',
    label: 'Style Transfer',
    description:
      'Apply artistic styles: Oil Painting, Watercolor, Anime, and more.',
    credits: 4,
    icon: Palette,
    featureKeys: ['edit'],
  },
  {
    id: 'caption',
    label: 'Generate Caption',
    description:
      'AI generates descriptions, hashtags, and SEO alt-text for the image.',
    credits: 1,
    icon: MessageSquareText,
    featureKeys: ['edit'],
  },
  {
    id: 'color_fix',
    label: 'Fix Colors',
    description:
      'Auto white-balance and color cast removal for natural-looking colors.',
    credits: 1,
    icon: Pipette,
    featureKeys: ['edit'],
  },
  {
    id: 'animate',
    label: 'Animate',
    description:
      'Turn a still image into a motion-styled version: cinemagraph, motion-blur, parallax, or anime-motion.',
    credits: 4,
    icon: Clapperboard,
    featureKeys: ['edit'],
  },
  {
    id: 'ai_boost',
    label: 'AI Boost',
    description:
      'Server-side intelligent enhancement: recover lost detail, expand dynamic range, and optimize colors.',
    credits: 2,
    icon: Rocket,
    featureKeys: ['edit'],
  },
];

/* ─── Sky Presets (mirrored from API for client display) ──── */

export const SKY_PRESET_OPTIONS = [
  { id: 'sunset', label: 'Sunset' },
  { id: 'sunrise', label: 'Sunrise' },
  { id: 'dramatic-clouds', label: 'Dramatic Clouds' },
  { id: 'clear-blue', label: 'Clear Blue' },
  { id: 'night-stars', label: 'Night Stars' },
  { id: 'aurora', label: 'Aurora' },
  { id: 'overcast', label: 'Overcast' },
  { id: 'storm', label: 'Storm' },
] as const;

/* ─── Denoise Strengths ──────────────────────────────────── */

export const DENOISE_STRENGTHS = [
  { value: 'light', label: 'Light', description: 'Subtle — preserves all detail' },
  { value: 'medium', label: 'Medium', description: 'Balanced noise reduction' },
  { value: 'heavy', label: 'Heavy', description: 'Aggressive — for very noisy images' },
] as const;

/* ─── Style Transfer Presets (mirrored from API) ─────────── */

export const STYLE_PRESET_OPTIONS = [
  { id: 'oil-painting', label: 'Oil Painting' },
  { id: 'watercolor', label: 'Watercolor' },
  { id: 'sketch', label: 'Sketch' },
  { id: 'anime', label: 'Anime' },
  { id: 'ghibli', label: 'Ghibli' },
  { id: 'pop-art', label: 'Pop Art' },
  { id: 'cyberpunk', label: 'Cyberpunk' },
  { id: 'retro-film', label: 'Retro Film' },
  { id: 'pixel-art', label: 'Pixel Art' },
  { id: 'impressionist', label: 'Impressionist' },
] as const;

/* ─── Animate Style Presets ──────────────────────────────── */

export const ANIMATE_STYLE_OPTIONS = [
  { id: 'cinemagraph', label: 'Cinemagraph' },
  { id: 'motion-blur', label: 'Motion Blur' },
  { id: 'parallax', label: 'Parallax' },
  { id: 'anime-motion', label: 'Anime Motion' },
] as const;

/* ─── AI Boost Mode Presets ──────────────────────────────── */

export const AI_BOOST_MODE_OPTIONS = [
  { id: 'auto', label: 'Auto' },
  { id: 'vivid', label: 'Vivid' },
  { id: 'natural', label: 'Natural' },
  { id: 'hdr', label: 'HDR' },
] as const;

/* ─── Component ──────────────────────────────────────────── */

export function AiToolsPanel({ assetId, onResult }: AiToolsPanelProps) {
  const { areFeaturesEnabled } = useAiFeatureAccess();
  const [expandedTool, setExpandedTool] = useState<AiToolId | null>(null);
  const [loading, setLoading] = useState<AiToolId | null>(null);
  const [lastResult, setLastResult] = useState<{
    tool: AiToolId;
    result: AiToolResult;
  } | null>(null);

  // Denoise state
  const [denoiseStrength, setDenoiseStrength] = useState<string>('medium');

  // Sky replace state
  const [skyPreset, setSkyPreset] = useState<string>('sunset');
  const [skyCustomPrompt, setSkyCustomPrompt] = useState('');
  const [skyUseCustom, setSkyUseCustom] = useState(false);

  // Object move state
  const [moveDescription, setMoveDescription] = useState('');
  const [moveFrom, setMoveFrom] = useState('0,0,100,100');
  const [moveTo, setMoveTo] = useState('200,200,100,100');

  // Bokeh state
  const [bokehIntensity, setBokehIntensity] = useState(50);

  // Relight state
  const [relightAngle, setRelightAngle] = useState(45);
  const [relightIntensity, setRelightIntensity] = useState(50);
  const [relightTemp, setRelightTemp] = useState(5000);

  // Style transfer state
  const [selectedStyle, setSelectedStyle] = useState<string>('oil-painting');
  const [styleIntensity, setStyleIntensity] = useState(70);

  // Animate state
  const [animateStyle, setAnimateStyle] = useState<string>('cinemagraph');
  const [animateIntensity, setAnimateIntensity] = useState(50);

  // AI Boost state
  const [boostMode, setBoostMode] = useState<string>('auto');

  const toggleTool = useCallback(
    (id: AiToolId) => {
      setExpandedTool((prev) => (prev === id ? null : id));
    },
    [],
  );

  const callApi = useCallback(
    async (tool: AiToolId, body: Record<string, unknown>) => {
      const selectedTool = AI_TOOLS.find((item) => item.id === tool);
      if (selectedTool && !areFeaturesEnabled(selectedTool.featureKeys)) {
        setLastResult({
          tool,
          result: {
            jobId: 'disabled',
            status: 'failed',
            error: 'AI image tools are disabled in settings.',
          },
        });
        return;
      }

      setLoading(tool);
      setLastResult(null);
      try {
        const endpoints: Record<AiToolId, string> = {
          enhance: '/api/ai/enhance',
          denoise: '/api/ai/denoise',
          smart_crop: '/api/ai/smart-crop',
          sky_replace: '/api/ai/sky-replace',
          object_move: '/api/ai/object-move',
          bokeh: '/api/ai/bokeh',
          relight: '/api/ai/relight',
          style_transfer: '/api/ai/style-transfer',
          caption: '/api/ai/caption',
          color_fix: '/api/ai/color-fix',
          animate: '/api/ai/animate',
          ai_boost: '/api/ai/boost',
        };
        const res = await fetch(endpoints[tool], {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ assetId, ...body }),
        });
        const json = await res.json();
        const result: AiToolResult = {
          jobId: json.jobId ?? '',
          status: json.status ?? (res.ok ? 'completed' : 'failed'),
          result: json.result,
          error: json.error,
        };
        setLastResult({ tool, result });
        onResult?.(tool, result);
      } catch (err) {
        const result: AiToolResult = {
          jobId: '',
          status: 'failed',
          error: err instanceof Error ? err.message : 'Network error',
        };
        setLastResult({ tool, result });
      } finally {
        setLoading(null);
      }
    },
    [areFeaturesEnabled, assetId, onResult],
  );

  const runEnhance = () => callApi('enhance', {});
  const runDenoise = () => callApi('denoise', { strength: denoiseStrength });
  const runSmartCrop = () => callApi('smart_crop', {});
  const runSkyReplace = () =>
    callApi('sky_replace', {
      skyPreset: skyUseCustom ? undefined : skyPreset,
      customPrompt: skyUseCustom ? skyCustomPrompt : undefined,
    });
  const runObjectMove = () => {
    const [fx, fy, fw, fh] = moveFrom.split(',').map(Number);
    const [tx, ty, tw, th] = moveTo.split(',').map(Number);
    callApi('object_move', {
      description: moveDescription,
      fromRegion: { x: fx || 0, y: fy || 0, w: fw || 100, h: fh || 100 },
      toRegion: { x: tx || 0, y: ty || 0, w: tw || 100, h: th || 100 },
    });
  };
  const runBokeh = () => callApi('bokeh', { intensity: bokehIntensity });
  const runRelight = () =>
    callApi('relight', {
      angle: relightAngle,
      intensity: relightIntensity,
      temperature: relightTemp,
    });
  const runStyleTransfer = () =>
    callApi('style_transfer', { style: selectedStyle, intensity: styleIntensity });
  const runCaption = () => callApi('caption', {});
  const runColorFix = () => callApi('color_fix', {});
  const runAnimate = () => callApi('animate', { style: animateStyle, intensity: animateIntensity });
  const runAiBoost = () => callApi('ai_boost', { mode: boostMode });

  const isRunning = (id: AiToolId) => loading === id;

  return (
    <div className="flex flex-col gap-1.5" data-testid="ai-tools-panel">
      {AI_TOOLS.map((tool) => {
        const Icon = tool.icon;
        const open = expandedTool === tool.id;
        const running = isRunning(tool.id);
        const showResult =
          lastResult?.tool === tool.id && !running;
        const toolEnabled = areFeaturesEnabled(tool.featureKeys);

        return (
          <div
            key={tool.id}
            className="rounded-lg border border-dash-border bg-dash-card overflow-hidden"
          >
            {/* Header */}
            <button
              onClick={() => toggleTool(tool.id)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-dash-muted/50 transition-colors"
            >
              <Icon size={14} className="text-blue-500 shrink-0" />
              <span className="flex-1 text-sm font-medium text-dash-text">
                {tool.label}
              </span>
              <AiBadge disabled={!toolEnabled} />
              <span className="text-[10px] text-dash-text-muted bg-dash-muted px-1.5 py-0.5 rounded-full">
                {tool.credits} cr
              </span>
              {open ? (
                <ChevronUp size={12} className="text-dash-text-muted" />
              ) : (
                <ChevronDown size={12} className="text-dash-text-muted" />
              )}
            </button>

            {/* Expanded content */}
            {open && (
              <div className="px-3 pb-3 space-y-2 border-t border-dash-border pt-2">
                <p className="text-[11px] text-dash-text-muted leading-tight">
                  {tool.description}
                </p>

                {!toolEnabled && (
                  <div className="rounded-md border border-slate-300 bg-slate-100 px-2 py-1.5 text-[11px] text-slate-600 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-300">
                    This AI tool is disabled in organization settings.
                  </div>
                )}

                <div
                  className={
                    toolEnabled
                      ? 'space-y-2'
                      : 'space-y-2 pointer-events-none opacity-50'
                  }
                >

                {/* ── Enhance ── */}
                {tool.id === 'enhance' && (
                  <button
                    onClick={runEnhance}
                    disabled={running}
                    className="flex w-full items-center justify-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {running ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Sparkles size={12} />
                    )}
                    {running ? 'Enhancing...' : 'Magic Enhance'}
                  </button>
                )}

                {/* ── Denoise ── */}
                {tool.id === 'denoise' && (
                  <>
                    <div className="flex gap-1">
                      {DENOISE_STRENGTHS.map((s) => (
                        <button
                          key={s.value}
                          onClick={() => setDenoiseStrength(s.value)}
                          title={s.description}
                          className={`flex-1 rounded border px-2 py-1 text-[10px] font-medium transition-colors ${
                            denoiseStrength === s.value
                              ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400'
                              : 'border-dash-border text-dash-text2 hover:bg-dash-muted'
                          }`}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={runDenoise}
                      disabled={running}
                      className="flex w-full items-center justify-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      {running ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <AudioLines size={12} />
                      )}
                      {running ? 'Denoising...' : 'Reduce Noise'}
                    </button>
                  </>
                )}

                {/* ── Smart Crop ── */}
                {tool.id === 'smart_crop' && (
                  <button
                    onClick={runSmartCrop}
                    disabled={running}
                    className="flex w-full items-center justify-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {running ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Crop size={12} />
                    )}
                    {running
                      ? 'Analyzing...'
                      : 'Suggest Crops'}
                  </button>
                )}

                {/* ── Sky Replace ── */}
                {tool.id === 'sky_replace' && (
                  <>
                    <label className="flex items-center gap-1.5 text-[11px] text-dash-text-muted">
                      <input
                        type="checkbox"
                        checked={skyUseCustom}
                        onChange={(e) => setSkyUseCustom(e.target.checked)}
                        className="rounded"
                      />
                      Use custom prompt
                    </label>

                    {skyUseCustom ? (
                      <input
                        type="text"
                        placeholder="A sky with ..."
                        value={skyCustomPrompt}
                        onChange={(e) => setSkyCustomPrompt(e.target.value)}
                        className="w-full rounded border border-dash-border bg-dash-muted px-2 py-1 text-xs text-dash-text"
                      />
                    ) : (
                      <div className="grid grid-cols-2 gap-1">
                        {SKY_PRESET_OPTIONS.map((p) => (
                          <button
                            key={p.id}
                            onClick={() => setSkyPreset(p.id)}
                            className={`rounded border px-2 py-1 text-[10px] font-medium transition-colors ${
                              skyPreset === p.id
                                ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400'
                                : 'border-dash-border text-dash-text2 hover:bg-dash-muted'
                            }`}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
                    )}

                    <button
                      onClick={runSkyReplace}
                      disabled={
                        running ||
                        (skyUseCustom && !skyCustomPrompt.trim())
                      }
                      className="flex w-full items-center justify-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      {running ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <CloudSun size={12} />
                      )}
                      {running ? 'Replacing...' : 'Replace Sky'}
                    </button>
                  </>
                )}

                {/* ── Object Move ── */}
                {tool.id === 'object_move' && (
                  <>
                    <input
                      type="text"
                      placeholder="Object description (e.g. 'the red car')"
                      value={moveDescription}
                      onChange={(e) => setMoveDescription(e.target.value)}
                      className="w-full rounded border border-dash-border bg-dash-muted px-2 py-1 text-xs text-dash-text"
                    />
                    <div className="grid grid-cols-2 gap-1">
                      <label className="flex flex-col gap-0.5">
                        <span className="text-[10px] text-dash-text-muted">
                          From (x,y,w,h)
                        </span>
                        <input
                          type="text"
                          value={moveFrom}
                          onChange={(e) => setMoveFrom(e.target.value)}
                          className="rounded border border-dash-border bg-dash-muted px-2 py-1 text-[10px] text-dash-text"
                        />
                      </label>
                      <label className="flex flex-col gap-0.5">
                        <span className="text-[10px] text-dash-text-muted">
                          To (x,y,w,h)
                        </span>
                        <input
                          type="text"
                          value={moveTo}
                          onChange={(e) => setMoveTo(e.target.value)}
                          className="rounded border border-dash-border bg-dash-muted px-2 py-1 text-[10px] text-dash-text"
                        />
                      </label>
                    </div>
                    <button
                      onClick={runObjectMove}
                      disabled={running || !moveDescription.trim()}
                      className="flex w-full items-center justify-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      {running ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Move size={12} />
                      )}
                      {running ? 'Moving...' : 'Move Object'}
                    </button>
                  </>
                )}

                {/* ── Bokeh (DS-5.6) ── */}
                {tool.id === 'bokeh' && (
                  <>
                    <label className="flex flex-col gap-0.5">
                      <span className="text-[10px] text-dash-text-muted">
                        Blur Intensity: {bokehIntensity}%
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={bokehIntensity}
                        onChange={(e) => setBokehIntensity(Number(e.target.value))}
                        className="w-full accent-blue-600"
                      />
                    </label>
                    <button
                      onClick={runBokeh}
                      disabled={running}
                      className="flex w-full items-center justify-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      {running ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Aperture size={12} />
                      )}
                      {running ? 'Blurring...' : 'Apply Portrait Blur'}
                    </button>
                  </>
                )}

                {/* ── Relight (DS-5.7) ── */}
                {tool.id === 'relight' && (
                  <>
                    <label className="flex flex-col gap-0.5">
                      <span className="text-[10px] text-dash-text-muted">
                        Light Angle: {relightAngle}°
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={360}
                        value={relightAngle}
                        onChange={(e) => setRelightAngle(Number(e.target.value))}
                        className="w-full accent-blue-600"
                      />
                    </label>
                    <label className="flex flex-col gap-0.5">
                      <span className="text-[10px] text-dash-text-muted">
                        Intensity: {relightIntensity}%
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={relightIntensity}
                        onChange={(e) => setRelightIntensity(Number(e.target.value))}
                        className="w-full accent-blue-600"
                      />
                    </label>
                    <label className="flex flex-col gap-0.5">
                      <span className="text-[10px] text-dash-text-muted">
                        Temperature: {relightTemp}K
                      </span>
                      <input
                        type="range"
                        min={2700}
                        max={6500}
                        step={100}
                        value={relightTemp}
                        onChange={(e) => setRelightTemp(Number(e.target.value))}
                        className="w-full accent-blue-600"
                      />
                    </label>
                    <button
                      onClick={runRelight}
                      disabled={running}
                      className="flex w-full items-center justify-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      {running ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Sun size={12} />
                      )}
                      {running ? 'Relighting...' : 'Relight Scene'}
                    </button>
                  </>
                )}

                {/* ── Style Transfer (DS-5.8) ── */}
                {tool.id === 'style_transfer' && (
                  <>
                    <div className="grid grid-cols-2 gap-1">
                      {STYLE_PRESET_OPTIONS.map((s) => (
                        <button
                          key={s.id}
                          onClick={() => setSelectedStyle(s.id)}
                          className={`rounded border px-2 py-1 text-[10px] font-medium transition-colors ${
                            selectedStyle === s.id
                              ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400'
                              : 'border-dash-border text-dash-text2 hover:bg-dash-muted'
                          }`}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                    <label className="flex flex-col gap-0.5">
                      <span className="text-[10px] text-dash-text-muted">
                        Intensity: {styleIntensity}%
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={styleIntensity}
                        onChange={(e) => setStyleIntensity(Number(e.target.value))}
                        className="w-full accent-blue-600"
                      />
                    </label>
                    <button
                      onClick={runStyleTransfer}
                      disabled={running}
                      className="flex w-full items-center justify-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      {running ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Palette size={12} />
                      )}
                      {running ? 'Styling...' : 'Apply Style'}
                    </button>
                  </>
                )}

                {/* ── Caption (DS-5.9) ── */}
                {tool.id === 'caption' && (
                  <button
                    onClick={runCaption}
                    disabled={running}
                    className="flex w-full items-center justify-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {running ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <MessageSquareText size={12} />
                    )}
                    {running ? 'Generating...' : 'Generate Caption'}
                  </button>
                )}

                {/* ── Color Fix (DS-5.10) ── */}
                {tool.id === 'color_fix' && (
                  <button
                    onClick={runColorFix}
                    disabled={running}
                    className="flex w-full items-center justify-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {running ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Pipette size={12} />
                    )}
                    {running ? 'Fixing...' : 'Fix Colors'}
                  </button>
                )}

                {/* ── Animate ── */}
                {tool.id === 'animate' && (
                  <>
                    <div className="grid grid-cols-2 gap-1">
                      {ANIMATE_STYLE_OPTIONS.map((s) => (
                        <button
                          key={s.id}
                          onClick={() => setAnimateStyle(s.id)}
                          className={`rounded border px-2 py-1 text-[10px] font-medium transition-colors ${
                            animateStyle === s.id
                              ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400'
                              : 'border-dash-border text-dash-text2 hover:bg-dash-muted'
                          }`}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                    <label className="flex flex-col gap-0.5">
                      <span className="text-[10px] text-dash-text-muted">
                        Intensity: {animateIntensity}%
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={animateIntensity}
                        onChange={(e) => setAnimateIntensity(Number(e.target.value))}
                        className="w-full accent-blue-600"
                      />
                    </label>
                    <button
                      onClick={runAnimate}
                      disabled={running}
                      className="flex w-full items-center justify-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      {running ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Clapperboard size={12} />
                      )}
                      {running ? 'Animating...' : 'Animate Image'}
                    </button>
                  </>
                )}

                {/* ── AI Boost ── */}
                {tool.id === 'ai_boost' && (
                  <>
                    <div className="grid grid-cols-2 gap-1">
                      {AI_BOOST_MODE_OPTIONS.map((m) => (
                        <button
                          key={m.id}
                          onClick={() => setBoostMode(m.id)}
                          className={`rounded border px-2 py-1 text-[10px] font-medium transition-colors ${
                            boostMode === m.id
                              ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400'
                              : 'border-dash-border text-dash-text2 hover:bg-dash-muted'
                          }`}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={runAiBoost}
                      disabled={running}
                      className="flex w-full items-center justify-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      {running ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Rocket size={12} />
                      )}
                      {running ? 'Boosting...' : 'AI Boost'}
                    </button>
                  </>
                )}

                </div>

                {/* ── Result feedback ── */}
                {showResult && lastResult && (
                  <div
                    className={`flex items-center gap-1.5 rounded px-2 py-1.5 text-[11px] ${
                      lastResult.result.status === 'completed'
                        ? 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400'
                        : 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400'
                    }`}
                  >
                    {lastResult.result.status === 'completed' ? (
                      <Check size={11} />
                    ) : (
                      <AlertCircle size={11} />
                    )}
                    <span className="flex-1">
                      {lastResult.result.status === 'completed'
                        ? 'Done! Result saved as variant.'
                        : lastResult.result.error ||
                          'Processing failed.'}
                    </span>
                    {lastResult.result.status === 'failed' && (
                      <button
                        onClick={() => setLastResult(null)}
                        title="Dismiss"
                        className="hover:text-red-900 dark:hover:text-red-300"
                      >
                        <RefreshCw size={10} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default AiToolsPanel;
