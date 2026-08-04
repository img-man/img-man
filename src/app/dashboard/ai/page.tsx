// SPDX-License-Identifier: Apache-2.0
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
 Sparkles,
 Wand2,
 ImagePlus,
 ArrowUpCircle,
 Expand,
 Eraser,
 Loader2,
 AlertCircle,
 Clock,
 CheckCircle2,
 XCircle,
 RefreshCw,
 Trash2,
 TrendingUp,
 Zap,
 Pencil,
 Image as ImageIcon,
 ChevronDown,
 Users,
 MapPin,
 Eye,
 RotateCcw,
 Ban,
} from 'lucide-react';
import { useRole } from '@/components/dashboard/role-context';
import {
 EDIT_MODEL,
 getDefaultModelForProviderCapability,
 getModelsForProviderCapability,
} from '@/lib/ai-models';
import type { AiProviderId } from '@/types/providers';

/* ─── Types ──────────────────────────────────────────────────── */

interface AiJobItem {
 _id: string;
 type: string;
 status: 'pending' | 'processing' | 'completed' | 'failed';
 input?: Record<string, unknown>;
 result?: Record<string, unknown>;
 error?: string;
 createdAt: string;
 completedAt?: string;
}

interface Pagination {
 page: number;
 limit: number;
 total: number;
 totalPages: number;
}

/* ─── Constants ──────────────────────────────────────────────── */

const JOB_TYPE_META: Record<
 string,
 { label: string; icon: typeof Sparkles; color: string }
> = {
 auto_tag: { label: 'Auto-Tag', icon: Sparkles, color: 'text-violet-400' },
 face_detect: { label: 'Face Detect', icon: Zap, color: 'text-blue-400' },
 bg_remove: { label: 'BG Remove', icon: Eraser, color: 'text-emerald-400' },
 upscale: { label: 'Upscale', icon: ArrowUpCircle, color: 'text-amber-400' },
 expand: { label: 'Expand', icon: Expand, color: 'text-cyan-400' },
 generate: { label: 'Generate', icon: ImagePlus, color: 'text-pink-400' },
 edit: { label: 'Edit', icon: Sparkles, color: 'text-orange-400' },
};

const STATUS_META: Record<
 string,
 { label: string; icon: typeof Clock; color: string; bg: string }
> = {
 pending: {
 label: 'Pending',
 icon: Clock,
 color: 'text-dash-text-muted',
 bg: 'bg-dash-text-muted/10',
 },
 processing: {
 label: 'Processing',
 icon: Loader2,
 color: 'text-blue-400',
 bg: 'bg-blue-500/10',
 },
 completed: {
 label: 'Completed',
 icon: CheckCircle2,
 color: 'text-emerald-400',
 bg: 'bg-emerald-500/10',
 },
 failed: {
 label: 'Failed',
 icon: XCircle,
 color: 'text-red-400',
 bg: 'bg-red-500/10',
 },
};

/* ─── Component ───────────────────────────────────────────────── */

export default function AiStudioPage() {
 const { can } = useRole();
 const canAI = can('ai');

 /* ── State ─────────────────────────────────────────────────── */
 const [jobs, setJobs] = useState<AiJobItem[]>([]);
 const [pagination, setPagination] = useState<Pagination | null>(null);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState('');
 const [currentPage, setCurrentPage] = useState(1);

 // AI Feature Config from org settings
 const [aiFeatureConfig, setAiFeatureConfig] = useState<
 Record<string, { mode: string; minRole: number }>
 >({});
 const [aiProvider, setAiProvider] = useState<AiProviderId>('vertex');

 // Filters
 const [filterStatus, setFilterStatus] = useState('');
 const [filterType, setFilterType] = useState('');

 // Generate panel state
 const [genPrompt, setGenPrompt] = useState('');
 const [genStyle, setGenStyle] = useState('photorealistic');
 const [genWidth, setGenWidth] = useState(1024);
 const [genHeight, setGenHeight] = useState(1024);
 const [generating, setGenerating] = useState(false);
 const [selectedModel, setSelectedModel] = useState(
 getDefaultModelForProviderCapability('vertex', 'generate')?.id ?? 'gemini-flash',
 );
 const [genResult, setGenResult] = useState<{
 status: string;
 result?: Record<string, string>;
 error?: string;
 } | null>(null);
 const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(
 null,
 );

 // Edit panel state
 const [showEditPanel, setShowEditPanel] = useState(false);
 const [editPrompt, setEditPrompt] = useState('');
 const [editAssetId, setEditAssetId] = useState('');
 const [editAssets, setEditAssets] = useState<
 { _id: string; name: string; thumbnailBase64?: string }[]
 >([]);
 const [editing, setEditing] = useState(false);
 const [editResult, setEditResult] = useState<{
 status: string;
 result?: Record<string, string>;
 error?: string;
 } | null>(null);
 const [editPreviewUrl, setEditPreviewUrl] = useState<string | null>(null);

 // Active tab
 const isGenerateEnabled = aiFeatureConfig.generate?.mode !== 'disabled';
 const isEditEnabled = aiFeatureConfig.edit?.mode !== 'disabled';
 const genModels = getModelsForProviderCapability(aiProvider, 'generate').filter(
 (model) => !model.capabilities.includes('edit'),
 );
 const [activeTab, setActiveTab] = useState<'generate' | 'edit' | 'people'>(
 'generate',
 );

 // People tab state
 const [people, setPeople] = useState<
 {
 faceHash: string;
 count: number;
 firstSeen: string;
 lastSeen: string;
 avgConfidence: number;
 emotions: string[];
 displayName?: string | null;
 sampleAssets: { _id: string; name: string; thumbnailBase64?: string }[];
 }[]
 >([]);
 const [peopleLoading, setPeopleLoading] = useState(false);
 const [peoplePagination, setPeoplePagination] = useState<{
 page: number;
 totalPages: number;
 total: number;
 } | null>(null);
 const [peoplePage, setPeoplePage] = useState(1);
 const [editingPersonHash, setEditingPersonHash] = useState<string | null>(
 null,
 );
 const [editingPersonName, setEditingPersonName] = useState('');
 const [savingPersonName, setSavingPersonName] = useState(false);

 /* ── Fetch Jobs ────────────────────────────────────────────── */
 const fetchJobs = useCallback(
 async (pageNum = 1) => {
 try {
 setLoading(true);
 const params = new URLSearchParams({
 page: String(pageNum),
 limit: '15',
 });
 if (filterStatus) params.set('status', filterStatus);
 if (filterType) params.set('type', filterType);

 const res = await fetch(`/api/ai/jobs?${params}`);
 if (!res.ok) throw new Error('Failed to load AI jobs');
 const data = await res.json();

 setJobs(data.jobs ?? []);
 setPagination(data.pagination ?? null);
 setCurrentPage(pageNum);
 setError('');
 } catch (err) {
 setError(err instanceof Error ? err.message : 'Failed to load');
 } finally {
 setLoading(false);
 }
 },
 [filterStatus, filterType],
 );

 useEffect(() => {
 setCurrentPage(1);
 setJobs([]);
 fetchJobs(1);
 }, [fetchJobs]);

 /* ── Fetch AI Feature Config ───────────────────────────────── */
 useEffect(() => {
 async function loadFeatureConfig() {
 try {
 // Try session-auth settings first (main dashboard)
 let config: Record<string, { mode: string; minRole: number }> | null =
 null;
 const res = await fetch('/api/settings');
 if (res.ok) {
 const data = await res.json();
 config = data.settings?.aiFeatureConfig ?? data.aiFeatureConfig ?? null;
 const nextProvider = data.settings?.aiProviderConfig?.provider;
 if (nextProvider === 'vertex' || nextProvider === 'openai') {
 setAiProvider(nextProvider);
 }
 }
 // Fallback: try token-auth (embed context)
 if (!config) {
 const meRes = await fetch('/api/v1/auth/me');
 if (meRes.ok) {
 const meData = await meRes.json();
 config = meData.aiFeatureConfig ?? null;
 }
 }
 if (config) {
 setAiFeatureConfig(config);
 if (config.generate?.mode === 'disabled') {
 setActiveTab(config.edit?.mode === 'disabled' ? 'people' : 'edit');
 }
 }
 } catch {
 // Silently ignore — defaults to all enabled
 }
 }
 loadFeatureConfig();
 }, []);

 useEffect(() => {
 if (!genModels.some((model) => model.id === selectedModel)) {
 setSelectedModel(
 getDefaultModelForProviderCapability(aiProvider, 'generate')?.id ?? selectedModel,
 );
 }
 }, [aiProvider, genModels, selectedModel]);

 /* ── Fetch People ────────────────────────────────────────────── */
 const fetchPeople = useCallback(async () => {
 setPeopleLoading(true);
 try {
 const res = await fetch(`/api/ai/people?page=${peoplePage}&limit=20`);
 if (res.ok) {
 const data = await res.json();
 setPeople(data.people ?? []);
 setPeoplePagination(data.pagination ?? null);
 }
 } catch (err) {
 console.error('Failed to fetch people:', err);
 } finally {
 setPeopleLoading(false);
 }
 }, [peoplePage]);

 useEffect(() => {
 if (activeTab === 'people') fetchPeople();
 }, [activeTab, fetchPeople]);

 /* ── Save Person Name ────────────────────────────────────────── */
 const handleSavePersonName = async (
 faceHash: string,
 displayName: string,
 ) => {
 setSavingPersonName(true);
 try {
 const res = await fetch('/api/ai/people', {
 method: 'PATCH',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ faceHash, displayName }),
 });
 if (res.ok) {
 setPeople((prev) =>
 prev.map((p) =>
 p.faceHash === faceHash
 ? { ...p, displayName: displayName || null }
 : p,
 ),
 );
 setEditingPersonHash(null);
 setEditingPersonName('');
 }
 } catch {
 // silently fail
 } finally {
 setSavingPersonName(false);
 }
 };

 const router = useRouter();

 // Auto-refresh every 10s if there are active jobs (refreshes current page)
 useEffect(() => {
 const hasActive = jobs.some(
 (j) => j.status === 'pending' || j.status === 'processing',
 );
 if (!hasActive) return;
 const interval = setInterval(() => fetchJobs(currentPage), 10_000);
 return () => clearInterval(interval);
 }, [jobs, fetchJobs, currentPage]);

 /* ── Job Actions ────────────────────────────────────────────── */
 const cancelJob = async (jobId: string) => {
 await fetch(`/api/ai/jobs/${jobId}`, { method: 'DELETE' });
 fetchJobs(currentPage);
 };

 const retryJob = async (jobId: string) => {
 await fetch(`/api/ai/jobs/${jobId}`, {
 method: 'PATCH',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ action: 'retry' }),
 });
 fetchJobs(currentPage);
 };

 const batchAction = async (
 action: 'retry' | 'cancel' | 'clear',
 status?: string,
 ) => {
 await fetch('/api/ai/jobs/batch', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ action, status }),
 });
 fetchJobs(1);
 };

 /* ── Generate ──────────────────────────────────────────────── */
 const handleGenerate = async () => {
 if (!isGenerateEnabled || !genPrompt.trim()) return;
 setGenerating(true);
 setGenResult(null);
 setGeneratedImageUrl(null);

 const modelConfig =
 genModels.find((m) => m.id === selectedModel) ?? genModels[0];

 try {
 const res = await fetch('/api/ai/generate', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 prompt: genPrompt,
 width: genWidth,
 height: genHeight,
 style: genStyle,
 model: modelConfig.id,
 }),
 });
 const data = await res.json();
 setGenResult(data);

 // Fetch the generated image URL for preview
 if (data.status === 'completed' && data.result?.assetId) {
 try {
 const assetRes = await fetch(`/api/assets/${data.result.assetId}`);
 const assetData = await assetRes.json();
 if (assetData.asset?.url) {
 setGeneratedImageUrl(assetData.asset.url);
 } else if (assetData.asset?.thumbnailBase64) {
 setGeneratedImageUrl(assetData.asset.thumbnailBase64);
 }
 } catch {
 /* ignore */
 }
 }

 fetchJobs(currentPage); // Refresh job list
 } catch {
 setGenResult({ status: 'failed', error: 'Request failed' });
 } finally {
 setGenerating(false);
 }
 };

 /* ── Fetch assets for edit picker ─────────────────────────── */
 useEffect(() => {
 fetch('/api/assets?limit=50&sort=createdAt&sortDir=desc')
 .then((r) => r.json())
 .then((data) => setEditAssets(data.assets ?? []))
 .catch(() => {});
 }, []);

 /* ── Edit with AI ─────────────────────────────────────────── */
 const handleEdit = async () => {
 if (!isEditEnabled || !editPrompt.trim() || !editAssetId) return;
 setEditing(true);
 setEditResult(null);
 setEditPreviewUrl(null);

 try {
 const res = await fetch('/api/ai/generate', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 prompt: editPrompt,
 model: EDIT_MODEL.id,
 sourceAssetId: editAssetId,
 width: genWidth,
 height: genHeight,
 }),
 });
 const data = await res.json();
 setEditResult(data);

 if (data.status === 'completed' && data.result?.assetId) {
 try {
 const assetRes = await fetch(`/api/assets/${data.result.assetId}`);
 const assetData = await assetRes.json();
 if (assetData.asset?.url) {
 setEditPreviewUrl(assetData.asset.url);
 } else if (assetData.asset?.thumbnailBase64) {
 setEditPreviewUrl(assetData.asset.thumbnailBase64);
 }
 } catch {
 /* ignore */
 }
 }

 fetchJobs(currentPage);
 } catch {
 setEditResult({ status: 'failed', error: 'Request failed' });
 } finally {
 setEditing(false);
 }
 };

 /* ── Helpers ───────────────────────────────────────────────── */
 const formatDate = (iso: string) => {
 const d = new Date(iso);
 return d.toLocaleDateString('en-US', {
 month: 'short',
 day: 'numeric',
 hour: '2-digit',
 minute: '2-digit',
 });
 };

 const formatDuration = (start: string, end?: string) => {
 if (!end) return '—';
 const ms = new Date(end).getTime() - new Date(start).getTime();
 if (ms < 1000) return `${ms}ms`;
 return `${(ms / 1000).toFixed(1)}s`;
 };

 /* ── Render ────────────────────────────────────────────────── */
 return (
 <div className="flex flex-col gap-6 p-6">
 {/* Header */}
 <div className="flex items-center justify-between">
 <div>
 <h1 className="text-xl font-semibold flex items-center gap-2 text-dash-text">
 <Sparkles className="h-5 w-5 text-violet-500 dark:text-violet-400"/>
 AI Studio
 </h1>
 <p className="mt-1 text-sm text-dash-text2">
 Background removal, upscaling, outpainting, image generation & more
 — powered by Vertex AI &amp; Gemini 2.5 Flash.
 </p>
 </div>
 <button
 onClick={() => fetchJobs(currentPage)}
 className="rounded-md border border-dash-border bg-dash-muted px-3 py-1.5 text-sm text-dash-text2 hover:bg-dash-surface-hover transition flex items-center gap-1.5"
 >
 <RefreshCw className="h-3.5 w-3.5"/>
 Refresh
 </button>
 </div>

 {/* Usage — self-hosted, billed by your own AI provider, so no quota to show */}
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div className="rounded-xl border border-dash-border bg-dash-surface p-4">
 <div className="flex items-center gap-2 text-sm text-dash-text2 mb-2">
 <TrendingUp className="h-4 w-4"/>
 Jobs run
 </div>
 <div className="text-2xl font-bold text-dash-text">
 {pagination?.total ?? 0}
 </div>
 </div>

 <div className="rounded-xl border border-dash-border bg-dash-surface p-4">
 <div className="flex items-center gap-2 text-sm text-dash-text2 mb-2">
 <Sparkles className="h-4 w-4"/>
 Billing
 </div>
 <div className="text-sm text-dash-text2">
 Charged directly to your own AI provider key. img-man does not meter
 or cap AI usage.
 </div>
 </div>
 </div>

 {/* AI Workspace — Generate / Edit */}
 {canAI && (
 <div className="rounded-xl border border-dash-border bg-dash-surface">
 <div className="flex border-b border-dash-border">
 <button
 onClick={() => setActiveTab('generate')}
 disabled={!isGenerateEnabled}
 className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition ${
 activeTab === 'generate'
 ? 'border-violet-500 text-dash-text'
 : 'border-transparent text-dash-text2 hover:text-dash-text'
 }`}
 >
 <Wand2 className="h-3.5 w-3.5"/>
 Generate
 </button>
 <button
 onClick={() => setActiveTab('edit')}
 disabled={!isEditEnabled}
 className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition ${
 activeTab === 'edit'
 ? 'border-cyan-500 text-dash-text'
 : 'border-transparent text-dash-text2 hover:text-dash-text'
 }`}
 >
 <Pencil className="h-3.5 w-3.5"/>
 Edit
 </button>
 <button
 onClick={() => setActiveTab('people')}
 className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition ${
 activeTab === 'people'
 ? 'border-emerald-500 text-dash-text'
 : 'border-transparent text-dash-text2 hover:text-dash-text'
 }`}
 >
 <Users className="h-3.5 w-3.5"/>
 People
 </button>
 </div>

 <div className="p-5">
 {activeTab === 'generate' && (
 <>
 <h2 className="text-base font-medium flex items-center gap-2 mb-4 text-dash-text">
 <Wand2 className="h-4 w-4 text-pink-500 dark:text-pink-400"/>
 AI Image Generation
 </h2>

 {!isGenerateEnabled && (
 <div className="mb-4 rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-300">
 AI image generation is disabled in organization settings.
 </div>
 )}

 <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4">
 <div className="flex flex-col gap-3">
 <textarea
 value={genPrompt}
 onChange={(e) => setGenPrompt(e.target.value)}
 placeholder="Describe the image you want to create..."
 disabled={!isGenerateEnabled}
 className="w-full rounded-lg border border-dash-border bg-dash-muted px-3 py-2.5 text-sm text-dash-text placeholder:text-dash-text2 focus:border-violet-500 focus:outline-none resize-none"
 rows={3}
 maxLength={2000}
 />

 <div className="flex flex-wrap items-center gap-3">
 {/* Model Selector */}
 <div className="relative">
 <select
 value={selectedModel}
 onChange={(e) => setSelectedModel(e.target.value)}
 disabled={!isGenerateEnabled}
 className="rounded-md border border-dash-border bg-dash-muted px-2.5 py-1.5 text-sm text-dash-text2 focus:border-violet-500 focus:outline-none pr-7 appearance-none"
 >
 {genModels.map((m) => (
 <option key={m.id} value={m.id}>
 {m.label} ({m.credits} credits)
 </option>
 ))}
 </select>
 <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-dash-text2"/>
 </div>
 <span className="text-xs text-dash-text2">
 {aiProvider === 'openai' ? 'OpenAI' : 'Google Vertex AI'}
 </span>

 {/* Style */}
 <select
 value={genStyle}
 onChange={(e) => setGenStyle(e.target.value)}
 disabled={!isGenerateEnabled}
 className="rounded-md border border-dash-border bg-dash-muted px-2.5 py-1.5 text-sm text-dash-text2 focus:border-violet-500 focus:outline-none"
 >
 <option value="photorealistic">Photorealistic</option>
 <option value="illustration">Illustration</option>
 <option value="icon">Icon</option>
 <option value="3d-render">3D Render</option>
 <option value="watercolor">Watercolor</option>
 <option value="minimalist">Minimalist</option>
 </select>

 {/* Dimensions */}
 <div className="flex items-center gap-1 text-sm text-dash-text2">
 <input
 type="number"
 value={genWidth}
 onChange={(e) => setGenWidth(Number(e.target.value))}
 disabled={!isGenerateEnabled}
 className="w-20 rounded border border-dash-border bg-dash-muted px-2 py-1 text-dash-text2 focus:border-violet-500 focus:outline-none"
 min={64}
 max={4096}
 step={64}
 />
 ×
 <input
 type="number"
 value={genHeight}
 onChange={(e) => setGenHeight(Number(e.target.value))}
 disabled={!isGenerateEnabled}
 className="w-20 rounded border border-dash-border bg-dash-muted px-2 py-1 text-dash-text2 focus:border-violet-500 focus:outline-none"
 min={64}
 max={4096}
 step={64}
 />
 </div>

 {/* Presets */}
 <div className="flex gap-1.5">
 {[
 ['1:1', 1024, 1024],
 ['16:9', 1920, 1080],
 ['9:16', 1080, 1920],
 ['4:3', 1024, 768],
 ].map(([label, w, h]) => (
 <button
 key={label as string}
 onClick={() => {
 setGenWidth(w as number);
 setGenHeight(h as number);
 }}
 disabled={!isGenerateEnabled}
 className={`rounded px-2 py-0.5 text-xs border transition ${
 genWidth === w && genHeight === h
 ? 'border-violet-500 text-violet-600 dark:text-violet-300 bg-violet-50 dark:bg-violet-500/10'
 : 'border-dash-border text-dash-text2 hover:text-dash-text'
 }`}
 >
 {label as string}
 </button>
 ))}
 </div>
 </div>
 </div>

 <div className="flex flex-col items-end gap-2">
 <button
 onClick={handleGenerate}
 disabled={generating || !genPrompt.trim() || !isGenerateEnabled}
 className="rounded-lg bg-gradient-to-r from-violet-600 to-pink-600 px-5 py-2.5 text-sm font-medium text-white hover:from-violet-500 hover:to-pink-500 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2"
 >
 {generating ? (
 <Loader2 className="h-4 w-4 animate-spin"/>
 ) : (
 <ImagePlus className="h-4 w-4"/>
 )}
 {generating ? 'Generating…' : 'Generate'}
 </button>
 <span className="text-xs text-dash-text2">
 {genModels.find((m) => m.id === selectedModel)
 ?.credits ?? 4}{' '}
 credits
 </span>
 </div>
 </div>

 {/* Generation Result */}
 {genResult && (
 <div
 className={`mt-4 rounded-lg p-3 text-sm ${
 genResult.status === 'completed'
 ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/20'
 : 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-500/20'
 }`}
 >
 {genResult.status === 'completed' ? (
 <span className="flex items-center gap-2">
 <CheckCircle2 className="h-4 w-4"/>
 Image generated! Asset saved to your library.
 {genResult.result?.assetId && (
 <span className="text-dash-text2 text-xs ml-2">
 ID: {String(genResult.result.assetId).slice(0, 8)}…
 </span>
 )}
 </span>
 ) : (
 <span className="flex items-center gap-2">
 <XCircle className="h-4 w-4"/>
 {genResult.error ?? 'Generation failed'}
 </span>
 )}
 </div>
 )}

 {/* Generated Image Preview */}
 {generatedImageUrl && (
 <div className="mt-4 flex flex-col items-center gap-3">
 <p className="text-xs font-medium text-dash-text2">
 Generated Image Preview
 </p>
 <div className="relative max-w-md overflow-hidden rounded-xl border border-dash-border bg-dash-muted shadow-lg">
 {/* eslint-disable-next-line @next/next/no-img-element */}
 <img
 src={generatedImageUrl}
 alt="AI Generated"
 className="max-h-96 w-full object-contain"
 />
 </div>
 </div>
 )}
 </>
 )}

 {activeTab === 'edit' && (
 <>
 <div className="flex items-center justify-between mb-4">
 <h2 className="text-base font-medium flex items-center gap-2 text-dash-text">
 <Pencil className="h-4 w-4 text-cyan-500 dark:text-cyan-400"/>
 Edit with AI
 </h2>
 <span className="rounded-full border border-dash-border px-2.5 py-0.5 text-[11px] text-dash-text2">
 {EDIT_MODEL.label} · {EDIT_MODEL.credits} credits
 </span>
 </div>

 {!isEditEnabled && (
 <div className="mb-4 rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-300">
 AI image editing is disabled in organization settings.
 </div>
 )}

 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 {/* Asset Picker */}
 <div>
 <label className="block text-xs font-medium text-dash-text2 mb-1.5">
 Select an image to edit
 </label>
 <select
 value={editAssetId}
 onChange={(e) => setEditAssetId(e.target.value)}
 disabled={!isEditEnabled}
 className="w-full rounded-lg border border-dash-border bg-dash-muted px-3 py-2 text-sm text-dash-text2 focus:border-cyan-500 focus:outline-none"
 >
 <option value="">Choose an asset...</option>
 {editAssets.map((a) => (
 <option key={a._id} value={a._id}>
 {a.name}
 </option>
 ))}
 </select>
 {editAssetId && (
 <div className="mt-2 flex justify-center rounded-lg border border-dash-border bg-dash-muted p-2">
 {/* eslint-disable-next-line @next/next/no-img-element */}
 <img
 src={
 editAssets.find((a) => a._id === editAssetId)
 ?.thumbnailBase64 || ''
 }
 alt="Selected"
 className="max-h-40 rounded object-contain"
 onError={(e) => {
 (e.target as HTMLImageElement).style.display =
 'none';
 }}
 />
 </div>
 )}
 </div>

 {/* Edit Prompt */}
 <div className="flex flex-col gap-3">
 <label className="block text-xs font-medium text-dash-text2">
 Describe what you want to change
 </label>
 <textarea
 value={editPrompt}
 onChange={(e) => setEditPrompt(e.target.value)}
 placeholder="Make the background a sunset, remove the person, change the color to blue..."
 disabled={!isEditEnabled}
 className="w-full flex-1 rounded-lg border border-dash-border bg-dash-muted px-3 py-2.5 text-sm text-dash-text placeholder:text-dash-text2 focus:border-cyan-500 focus:outline-none resize-none"
 rows={4}
 maxLength={2000}
 />
 <button
 onClick={handleEdit}
 disabled={editing || !editPrompt.trim() || !editAssetId || !isEditEnabled}
 className="self-end rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 px-5 py-2 text-sm font-medium text-white hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2"
 >
 {editing ? (
 <Loader2 className="h-4 w-4 animate-spin"/>
 ) : (
 <Pencil className="h-4 w-4"/>
 )}
 {editing ? 'Editing…' : 'Edit Image'}
 </button>
 </div>
 </div>

 {/* Edit Result */}
 {editResult && (
 <div
 className={`mt-4 rounded-lg p-3 text-sm ${
 editResult.status === 'completed'
 ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/20'
 : 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-500/20'
 }`}
 >
 {editResult.status === 'completed' ? (
 <span className="flex items-center gap-2">
 <CheckCircle2 className="h-4 w-4"/>
 Image edited! Result saved to your library.
 </span>
 ) : (
 <span className="flex items-center gap-2">
 <XCircle className="h-4 w-4"/>
 {editResult.error ?? 'Edit failed'}
 </span>
 )}
 </div>
 )}

 {/* Edit Preview */}
 {editPreviewUrl && (
 <div className="mt-4 flex flex-col items-center gap-3">
 <p className="text-xs font-medium text-dash-text2">
 Edited Image Preview
 </p>
 <div className="relative max-w-md overflow-hidden rounded-xl border border-dash-border bg-dash-muted shadow-lg">
 {/* eslint-disable-next-line @next/next/no-img-element */}
 <img
 src={editPreviewUrl}
 alt="AI Edited"
 className="max-h-96 w-full object-contain"
 />
 </div>
 </div>
 )}
 </>
 )}

 {/* People Tab */}
 {activeTab === 'people' && (
 <>
 <h2 className="text-base font-medium flex items-center gap-2 mb-4 text-dash-text">
 <Users className="h-4 w-4 text-emerald-500 dark:text-emerald-400"/>
 People Detection
 </h2>
 <p className="text-xs text-dash-text2 mb-4">
 Images are grouped by detected faces. Click a person to view
 their photos. Click the name to rename.
 </p>

 {peopleLoading ? (
 <div className="flex items-center justify-center gap-2 py-12 text-dash-text2">
 <Loader2 className="h-4 w-4 animate-spin"/>
 Loading people…
 </div>
 ) : people.length === 0 ? (
 <div className="py-12 text-center text-sm text-dash-text2">
 <Users className="mx-auto h-8 w-8 text-dash-text-muted dark:text-dash-text2 mb-3"/>
 No people detected yet. Use Face Detection on your assets
 first.
 </div>
 ) : (
 <>
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
 {people.map((person) => (
 <div
 key={person.faceHash}
 className="rounded-xl border border-dash-border bg-dash-muted/50 p-4 transition hover:border-dash-border group"
 >
 {/* Person header with inline naming */}
 <div className="flex items-center gap-3 mb-3">
 <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-500/10">
 <Users className="h-5 w-5 text-emerald-600 dark:text-emerald-400"/>
 </div>
 <div className="flex-1 min-w-0">
 {editingPersonHash === person.faceHash ? (
 <div className="flex items-center gap-1.5">
 <input
 type="text"
 value={editingPersonName}
 onChange={(e) =>
 setEditingPersonName(e.target.value)
 }
 onKeyDown={(e) => {
 if (e.key === 'Enter')
 handleSavePersonName(
 person.faceHash,
 editingPersonName,
 );
 if (e.key === 'Escape') {
 setEditingPersonHash(null);
 setEditingPersonName('');
 }
 }}
 placeholder="Enter name..."
 className="w-full rounded border border-dash-input-border bg-dash-surface px-2 py-0.5 text-sm text-dash-text outline-none focus:border-emerald-500"
 autoFocus
 />
 <button
 onClick={() =>
 handleSavePersonName(
 person.faceHash,
 editingPersonName,
 )
 }
 disabled={savingPersonName}
 className="rounded bg-emerald-600 px-2 py-0.5 text-xs text-white hover:bg-emerald-500 disabled:opacity-50"
 >
 {savingPersonName ? '…' : '✓'}
 </button>
 <button
 onClick={() => {
 setEditingPersonHash(null);
 setEditingPersonName('');
 }}
 className="rounded bg-dash-badge px-2 py-0.5 text-xs text-dash-text2 hover:bg-dash-surface-hover "
 >
 ✕
 </button>
 </div>
 ) : (
 <button
 onClick={() => {
 setEditingPersonHash(person.faceHash);
 setEditingPersonName(
 person.displayName ?? '',
 );
 }}
 className="group/name text-left"
 title="Click to rename"
 >
 <p className="text-sm font-medium text-dash-text truncate flex items-center gap-1.5">
 {person.displayName ||
 `Person #${person.faceHash.slice(0, 8)}`}
 <Pencil className="h-3 w-3 text-dash-text-muted opacity-0 group-hover/name:opacity-100 transition"/>
 </p>
 </button>
 )}
 <p className="text-[11px] text-dash-text2">
 {person.count} photo
 {person.count !== 1 ? 's' : ''}
 </p>
 </div>
 <span className="rounded-full bg-dash-badge px-2 py-0.5 text-[10px] font-medium text-dash-text2 dark:text-dash-text-muted">
 {Math.round(person.avgConfidence * 100)}% avg
 </span>
 </div>

 {/* Sample thumbnails — click to filter */}
 <button
 onClick={() =>
 router.push(
 `/dashboard?faceHash=${person.faceHash}`,
 )
 }
 className="w-full grid grid-cols-4 gap-1 mb-3 rounded-lg overflow-hidden hover:ring-2 hover:ring-emerald-500/30 transition"
 title="View all photos of this person"
 >
 {person.sampleAssets.slice(0, 4).map((sa) => (
 <div
 key={sa._id}
 className="aspect-square overflow-hidden bg-dash-muted "
 >
 {sa.thumbnailBase64 ? (
 // eslint-disable-next-line @next/next/no-img-element
 <img
 src={sa.thumbnailBase64}
 alt={sa.name}
 className="h-full w-full object-cover"
 />
 ) : (
 <div className="flex h-full items-center justify-center">
 <ImageIcon className="h-4 w-4 text-dash-text-muted dark:text-dash-text2"/>
 </div>
 )}
 </div>
 ))}
 </button>

 {/* Metadata */}
 <div className="space-y-1 text-[11px] text-dash-text2">
 <div className="flex items-center gap-1.5">
 <MapPin className="h-3 w-3"/>
 First seen:{' '}
 {new Date(person.firstSeen).toLocaleDateString()}
 </div>
 <div className="flex items-center gap-1.5">
 <Clock className="h-3 w-3"/>
 Last seen:{' '}
 {new Date(person.lastSeen).toLocaleDateString()}
 </div>
 {person.emotions.length > 0 && (
 <div className="flex flex-wrap gap-1 mt-1">
 {person.emotions.map((em) => (
 <span
 key={em}
 className="rounded-full bg-dash-badge/50 /50 px-1.5 py-0.5 text-[10px] text-dash-text2 capitalize"
 >
 {em}
 </span>
 ))}
 </div>
 )}
 </div>

 {/* View Assets CTA */}
 <button
 onClick={() =>
 router.push(
 `/dashboard?faceHash=${person.faceHash}`,
 )
 }
 className="mt-3 w-full rounded-lg border border-dash-border bg-dash-surface px-3 py-1.5 text-xs text-dash-text2 hover:bg-dash-surface-hover hover:text-dash-text dark:hover:text-white transition flex items-center justify-center gap-1.5"
 >
 <Eye className="h-3 w-3"/>
 View {person.count} Photo
 {person.count !== 1 ? 's' : ''}
 </button>
 </div>
 ))}
 </div>

 {/* People Pagination */}
 {peoplePagination && peoplePagination.totalPages > 1 && (
 <div className="flex items-center justify-between mt-4 pt-3 border-t border-dash-border">
 <span className="text-xs text-dash-text2">
 Page {peoplePagination.page} of{' '}
 {peoplePagination.totalPages} (
 {peoplePagination.total} people)
 </span>
 <div className="flex gap-2">
 <button
 onClick={() =>
 setPeoplePage(Math.max(1, peoplePage - 1))
 }
 disabled={peoplePage <= 1}
 className="rounded border border-dash-border bg-dash-muted px-2.5 py-1 text-xs text-dash-text2 hover:bg-dash-surface-hover disabled:opacity-30 transition"
 >
 Previous
 </button>
 <button
 onClick={() =>
 setPeoplePage(
 Math.min(
 peoplePagination.totalPages,
 peoplePage + 1,
 ),
 )
 }
 disabled={peoplePage >= peoplePagination.totalPages}
 className="rounded border border-dash-border bg-dash-muted px-2.5 py-1 text-xs text-dash-text2 hover:bg-dash-surface-hover disabled:opacity-30 transition"
 >
 Next
 </button>
 </div>
 </div>
 )}
 </>
 )}
 </>
 )}
 </div>
 </div>
 )}

 {/* Jobs Table */}
 <div className="rounded-xl border border-dash-border bg-dash-surface flex flex-col">
 {/* Filters + Batch actions */}
 <div className="flex flex-wrap items-center gap-3 border-b border-dash-border px-4 py-3">
 <h2 className="text-sm font-medium text-dash-text mr-auto">
 AI Jobs
 </h2>

 {/* Batch action buttons */}
 {jobs.some((j) => j.status === 'processing') && (
 <button
 onClick={() => batchAction('cancel')}
 className="inline-flex items-center gap-1 rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950 px-2 py-1 text-[11px] font-medium text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900 transition"
 title="Cancel all processing &amp; pending jobs"
 >
 <Ban className="h-3 w-3"/>
 Cancel Stuck
 </button>
 )}
 {jobs.some((j) => j.status === 'failed') && (
 <>
 <button
 onClick={() => batchAction('retry')}
 className="inline-flex items-center gap-1 rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950 px-2 py-1 text-[11px] font-medium text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900 transition"
 title="Retry all failed jobs"
 >
 <RotateCcw className="h-3 w-3"/>
 Retry All Failed
 </button>
 <button
 onClick={() => batchAction('clear', 'failed')}
 className="inline-flex items-center gap-1 rounded-md border border-dash-border bg-dash-muted px-2 py-1 text-[11px] font-medium text-dash-text2 hover:bg-dash-surface-hover transition"
 title="Clear all failed jobs"
 >
 <Trash2 className="h-3 w-3"/>
 Clear Failed
 </button>
 </>
 )}

 <select
 value={filterType}
 onChange={(e) => {
 setFilterType(e.target.value);
 }}
 className="rounded border border-dash-border bg-dash-muted px-2 py-1 text-xs text-dash-text2 focus:outline-none"
 >
 <option value="">All Types</option>
 <option value="auto_tag">Auto-Tag</option>
 <option value="face_detect">Face Detect</option>
 <option value="bg_remove">BG Remove</option>
 <option value="upscale">Upscale</option>
 <option value="expand">Expand</option>
 <option value="generate">Generate</option>
 </select>

 <select
 value={filterStatus}
 onChange={(e) => {
 setFilterStatus(e.target.value);
 }}
 className="rounded border border-dash-border bg-dash-muted px-2 py-1 text-xs text-dash-text2 focus:outline-none"
 >
 <option value="">All Statuses</option>
 <option value="pending">Pending</option>
 <option value="processing">Processing</option>
 <option value="completed">Completed</option>
 <option value="failed">Failed</option>
 </select>
 </div>

 {/* Error */}
 {error && (
 <div className="flex items-center gap-2 border-b border-dash-border bg-red-500/10 px-4 py-2 text-sm text-red-600 dark:text-red-300">
 <AlertCircle className="h-4 w-4"/>
 {error}
 </div>
 )}

 {/* Loading */}
 {loading && !jobs.length ? (
 <div className="flex items-center justify-center gap-2 py-16 text-dash-text2">
 <Loader2 className="h-4 w-4 animate-spin"/>
 Loading jobs…
 </div>
 ) : jobs.length === 0 ? (
 <div className="py-16 text-center text-sm text-dash-text2">
 <Sparkles className="mx-auto h-8 w-8 text-dash-text-muted dark:text-dash-text2 mb-3"/>
 No AI jobs yet. Start by generating an image above or using AI
 features on your assets.
 </div>
 ) : (
 <>
 {/* Table */}
 <div className="overflow-x-auto max-h-120 overflow-y-auto">
 <table className="w-full text-sm">
 <thead className="sticky top-0 z-10 bg-dash-surface">
 <tr className="text-left text-xs text-dash-text2 border-b border-dash-border">
 <th className="px-4 py-2 font-medium">Type</th>
 <th className="px-4 py-2 font-medium">Status</th>
 <th className="px-4 py-2 font-medium">Created</th>
 <th className="px-4 py-2 font-medium">Duration</th>
 <th className="px-4 py-2 font-medium">Details</th>
 <th className="px-4 py-2 font-medium w-10"/>
 </tr>
 </thead>
 <tbody>
 {jobs.map((job) => {
 const typeMeta =
 JOB_TYPE_META[job.type] ?? JOB_TYPE_META.auto_tag;
 const statusMeta =
 STATUS_META[job.status] ?? STATUS_META.pending;
 const TypeIcon = typeMeta.icon;
 const StatusIcon = statusMeta.icon;

 return (
 <tr
 key={job._id}
 className="border-b border-dash-border/50 /50 hover:bg-dash-muted/50 /30 transition"
 >
 {/* Type */}
 <td className="px-4 py-2.5">
 <span
 className={`flex items-center gap-2 ${typeMeta.color}`}
 >
 <TypeIcon className="h-3.5 w-3.5"/>
 {typeMeta.label}
 </span>
 </td>

 {/* Status */}
 <td className="px-4 py-2.5">
 <span
 className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs ${statusMeta.bg} ${statusMeta.color}`}
 >
 <StatusIcon
 className={`h-3 w-3 ${
 job.status === 'processing'
 ? 'animate-spin'
 : ''
 }`}
 />
 {statusMeta.label}
 </span>
 </td>

 {/* Created */}
 <td className="px-4 py-2.5 text-dash-text2">
 {formatDate(job.createdAt)}
 </td>

 {/* Duration */}
 <td className="px-4 py-2.5 text-dash-text2 tabular-nums">
 {formatDuration(job.createdAt, job.completedAt)}
 </td>

 {/* Details */}
 <td className="px-4 py-2.5 text-dash-text2 max-w-xs truncate">
 {job.status === 'failed' && job.error ? (
 <span className="text-red-500 dark:text-red-400 text-xs">
 {job.error.slice(0, 80)}
 </span>
 ) : job.result ? (
 <span className="text-xs text-dash-text2">
 {JSON.stringify(job.result).slice(0, 80)}…
 </span>
 ) : (
 '—'
 )}
 </td>

 {/* Actions */}
 <td className="px-4 py-2.5">
 <div className="flex items-center gap-1.5">
 {/* Retry button for failed jobs */}
 {job.status === 'failed' && (
 <button
 onClick={() => retryJob(job._id)}
 className="text-dash-text-muted hover:text-amber-500 dark:text-dash-text2 dark:hover:text-amber-400 transition"
 title="Retry"
 >
 <RotateCcw className="h-3.5 w-3.5"/>
 </button>
 )}
 {/* Cancel button for pending/processing jobs */}
 {(job.status === 'pending' ||
 job.status === 'processing') && (
 <button
 onClick={() => cancelJob(job._id)}
 className="text-dash-text-muted hover:text-red-500 dark:text-dash-text2 dark:hover:text-red-400 transition"
 title="Cancel"
 >
 <Ban className="h-3.5 w-3.5"/>
 </button>
 )}
 </div>
 </td>
 </tr>
 );
 })}
 </tbody>
 </table>
 </div>

 {/* Pagination controls */}
 {pagination && pagination.totalPages > 0 && (
 <div className="flex items-center justify-between border-t border-dash-border px-4 py-3">
 <p className="text-xs text-dash-text2">
 Page {currentPage} of {pagination.totalPages} ·{' '}
 {pagination.total} total jobs
 </p>
 <div className="flex items-center gap-1">
 <button
 onClick={() => fetchJobs(1)}
 disabled={currentPage <= 1 || loading}
 className="rounded px-2 py-1 text-xs text-dash-text2 hover:bg-dash-surface-hover disabled:opacity-40 disabled:cursor-not-allowed transition"
 title="First page"
 >
 ««
 </button>
 <button
 onClick={() => fetchJobs(currentPage - 1)}
 disabled={currentPage <= 1 || loading}
 className="rounded px-2 py-1 text-xs text-dash-text2 hover:bg-dash-surface-hover disabled:opacity-40 disabled:cursor-not-allowed transition"
 >
 ‹ Prev
 </button>

 {/* Page numbers */}
 {(() => {
 const totalPages = pagination.totalPages;
 const pages: (number | 'ellipsis')[] = [];
 if (totalPages <= 7) {
 for (let i = 1; i <= totalPages; i++) pages.push(i);
 } else {
 pages.push(1);
 if (currentPage > 3) pages.push('ellipsis');
 for (
 let i = Math.max(2, currentPage - 1);
 i <= Math.min(totalPages - 1, currentPage + 1);
 i++
 ) {
 pages.push(i);
 }
 if (currentPage < totalPages - 2) pages.push('ellipsis');
 pages.push(totalPages);
 }

 return pages.map((p, idx) =>
 p === 'ellipsis' ? (
 <span
 key={`e-${idx}`}
 className="px-1 text-xs text-dash-text-muted"
 >
 …
 </span>
 ) : (
 <button
 key={p}
 onClick={() => fetchJobs(p)}
 disabled={loading}
 className={`min-w-7 rounded px-1.5 py-1 text-xs font-medium transition ${
 p === currentPage
 ? 'bg-dash-inverted dark:bg-dash-muted text-white '
 : 'text-dash-text2 dark:text-dash-text-muted hover:bg-dash-surface-hover'
 } disabled:cursor-not-allowed`}
 >
 {p}
 </button>
 ),
 );
 })()}

 <button
 onClick={() => fetchJobs(currentPage + 1)}
 disabled={currentPage >= pagination.totalPages || loading}
 className="rounded px-2 py-1 text-xs text-dash-text2 hover:bg-dash-surface-hover disabled:opacity-40 disabled:cursor-not-allowed transition"
 >
 Next ›
 </button>
 <button
 onClick={() => fetchJobs(pagination.totalPages)}
 disabled={currentPage >= pagination.totalPages || loading}
 className="rounded px-2 py-1 text-xs text-dash-text2 hover:bg-dash-surface-hover disabled:opacity-40 disabled:cursor-not-allowed transition"
 title="Last page"
 >
 »»
 </button>
 </div>
 </div>
 )}
 </>
 )}
 </div>
 </div>
 );
}
