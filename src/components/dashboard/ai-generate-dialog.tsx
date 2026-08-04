// SPDX-License-Identifier: Apache-2.0
'use client';

import { useState } from 'react';
import { X, Sparkles, Loader2, Image, Palette, Maximize2 } from 'lucide-react';
import AiBadge from '@/components/ai-badge';
import { useAiFeatureAccess } from '@/lib/use-ai-feature-access';

/* ─── Types ────────────────────────────────────────────── */

interface AiGenerateDialogProps {
 open: boolean;
 onClose: () => void;
 /** Current folder ID to save generated image into */
 folderId?: string | null;
 /** Called after successful generation with the new asset */
 onGenerated?: (asset: { assetId: string; name: string }) => void;
}

type StylePreset =
 | 'photorealistic'
 | 'illustration'
 | 'minimalist'
 | 'cyberpunk'
 | 'watercolor'
 | 'icon'
 | 'custom';

const STYLE_PRESETS: { value: StylePreset; label: string; emoji: string }[] = [
 { value: 'photorealistic', label: 'Photorealistic', emoji: '📷' },
 { value: 'illustration', label: 'Illustration', emoji: '🎨' },
 { value: 'minimalist', label: 'Minimalist', emoji: '⬜' },
 { value: 'cyberpunk', label: 'Cyberpunk', emoji: '🌆' },
 { value: 'watercolor', label: 'Watercolor', emoji: '💧' },
 { value: 'icon', label: 'Icon / Logo', emoji: '✨' },
];

const SIZE_PRESETS = [
 { label: '1:1 (1024)', w: 1024, h: 1024 },
 { label: '16:9 (1280×720)', w: 1280, h: 720 },
 { label: '9:16 (720×1280)', w: 720, h: 1280 },
 { label: '4:3 (1024×768)', w: 1024, h: 768 },
];

/* ─── Component ────────────────────────────────────────── */

export function AiGenerateDialog({
 open,
 onClose,
 folderId,
 onGenerated,
}: AiGenerateDialogProps) {
 const { isFeatureEnabled } = useAiFeatureAccess();
 const [prompt, setPrompt] = useState('');
 const [style, setStyle] = useState<StylePreset>('photorealistic');
 const [sizeIdx, setSizeIdx] = useState(0);
 const [generating, setGenerating] = useState(false);
 const [error, setError] = useState<string | null>(null);
 const [result, setResult] = useState<{
 assetId: string;
 name: string;
 thumbnailBase64?: string;
 } | null>(null);
 const generateEnabled = isFeatureEnabled('generate');

 const handleGenerate = async () => {
 if (!generateEnabled || !prompt.trim()) return;

 setGenerating(true);
 setError(null);
 setResult(null);

 try {
 const size = SIZE_PRESETS[sizeIdx];
 const res = await fetch('/api/ai/generate', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 prompt: prompt.trim(),
 style,
 width: size.w,
 height: size.h,
 folderId: folderId || undefined,
 }),
 });

 const data = await res.json();
 if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);

 const generated = {
 assetId: data.result?.assetId ?? data.assetId,
 name: data.result?.name ?? data.name ?? 'AI Generated',
 thumbnailBase64: data.result?.thumbnailBase64,
 };
 setResult(generated);
 onGenerated?.(generated);
 } catch (err) {
 setError(err instanceof Error ? err.message : 'Generation failed');
 } finally {
 setGenerating(false);
 }
 };

 const handleReset = () => {
 setPrompt('');
 setResult(null);
 setError(null);
 };

 if (!open) return null;

 return (
 <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
 <div
 className="w-full max-w-lg rounded-xl border border-dash-border bg-dash-surface shadow-2xl"
 onClick={(e) => e.stopPropagation()}
 >
 {/* Header */}
 <div className="flex items-center justify-between border-b border-dash-border px-5 py-4">
 <div className="flex items-center gap-2">
 <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500">
 <Sparkles className="h-4 w-4 text-white"/>
 </div>
 <div>
 <div className="flex items-center gap-2">
 <h3 className="text-base font-semibold text-dash-text">
 AI Image Generator
 </h3>
 <AiBadge disabled={!generateEnabled} />
 </div>
 <p className="text-xs text-dash-text2">
 Powered by Vertex AI
 </p>
 </div>
 </div>
 <button
 onClick={onClose}
 className="rounded-md p-1 text-dash-text-muted hover:bg-dash-surface-hover hover:text-dash-text2 dark:hover:text-dash-text-muted"
 >
 <X className="h-5 w-5"/>
 </button>
 </div>

 <div className="space-y-4 p-5">
 {result ? (
 /* ─── Result ────────────────────────── */
 <div className="space-y-3">
 <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950">
 <p className="mb-2 text-sm font-medium text-green-800 dark:text-green-300">
 Image generated successfully!
 </p>
 <div className="flex items-center gap-3">
 {result.thumbnailBase64 ? (
 // eslint-disable-next-line @next/next/no-img-element
 <img
 src={result.thumbnailBase64}
 alt={result.name}
 className="h-16 w-16 rounded-lg object-cover"
 />
 ) : (
 <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/50">
 <Image className="h-8 w-8 text-green-400 dark:text-green-500"/>
 </div>
 )}
 <div>
 <p className="text-sm font-medium text-dash-text ">
 {result.name}
 </p>
 <p className="text-xs text-dash-text2">
 Saved to {folderId ? 'current folder' : 'root'}
 </p>
 </div>
 </div>
 </div>
 <div className="flex gap-2">
 <button
 onClick={handleReset}
 className="flex-1 rounded-lg border border-dash-border px-4 py-2 text-sm font-medium text-dash-text2 transition hover:bg-dash-surface-hover dark:text-dash-text-muted"
 >
 Generate Another
 </button>
 <button
 onClick={onClose}
 className="flex-1 rounded-lg bg-[var(--im-primary)] px-4 py-2 text-sm font-medium text-[var(--im-primary-fg)] transition hover:opacity-90"
 >
 Done
 </button>
 </div>
 </div>
 ) : (
 /* ─── Generate Form ─────────────────── */
 <>
 {/* Settings notice */}
 {!generateEnabled && (
 <p className="rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-300">
 AI generation is disabled in organization settings.
 </p>
 )}

 {/* Prompt */}
 <div>
 <label className="mb-1.5 block text-xs font-medium text-dash-text2 dark:text-dash-text-muted">
 Describe the image you want
 </label>
 <textarea
 value={prompt}
 onChange={(e) => setPrompt(e.target.value)}
 placeholder="A serene mountain landscape at sunset with golden light..."
 rows={3}
 className="w-full rounded-lg border border-dash-border bg-dash-surface px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-1 focus:ring-primary dark:focus:border-primary"
 disabled={generating || !generateEnabled}
 />
 </div>

 {/* Style Presets */}
 <div>
 <label className="mb-1.5 flex items-center gap-1 text-xs font-medium text-dash-text2 dark:text-dash-text-muted">
 <Palette className="h-3.5 w-3.5"/>
 Style
 </label>
 <div className="grid grid-cols-3 gap-2">
 {STYLE_PRESETS.map((s) => (
 <button
 key={s.value}
 onClick={() => setStyle(s.value)}
 disabled={generating || !generateEnabled}
 className={`rounded-lg border px-2.5 py-2 text-xs font-medium transition ${
 style === s.value
 ? 'border-violet-400 bg-violet-50 text-violet-700 dark:border-violet-600 dark:bg-violet-950 dark:text-violet-300'
 : 'border-dash-border text-dash-text2 hover:bg-dash-surface-hover dark:text-dash-text-muted '
 }`}
 >
 {s.emoji} {s.label}
 </button>
 ))}
 </div>
 </div>

 {/* Size */}
 <div>
 <label className="mb-1.5 flex items-center gap-1 text-xs font-medium text-dash-text2 dark:text-dash-text-muted">
 <Maximize2 className="h-3.5 w-3.5"/>
 Dimensions
 </label>
 <div className="flex flex-wrap gap-2">
 {SIZE_PRESETS.map((s, i) => (
 <button
 key={i}
 onClick={() => setSizeIdx(i)}
 disabled={generating || !generateEnabled}
 className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
 sizeIdx === i
 ? 'border-violet-400 bg-violet-50 text-violet-700 dark:border-violet-600 dark:bg-violet-950 dark:text-violet-300'
 : 'border-dash-border text-dash-text2 hover:bg-dash-surface-hover dark:text-dash-text-muted '
 }`}
 >
 {s.label}
 </button>
 ))}
 </div>
 </div>

 {/* Error */}
 {error && (
 <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:border-red-900 dark:text-red-400">
 {error}
 </p>
 )}

 {/* Generate Button */}
 <button
 onClick={handleGenerate}
 disabled={generating || !prompt.trim() || !generateEnabled}
 className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-2.5 text-sm font-medium text-white transition hover:from-violet-700 hover:to-fuchsia-700 disabled:opacity-50"
 >
 {generating ? (
 <>
 <Loader2 className="h-4 w-4 animate-spin"/>
 Generating…
 </>
 ) : (
 <>
 <Sparkles className="h-4 w-4"/>
 Generate Image
 </>
 )}
 </button>

 {generating && (
 <p className="text-center text-xs text-dash-text-muted">
 This may take 10–30 seconds depending on complexity.
 </p>
 )}
 </>
 )}
 </div>
 </div>
 </div>
 );
}
