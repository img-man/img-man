// SPDX-License-Identifier: Apache-2.0
'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
 Settings as SettingsIcon,
 Trash2,
 Save,
 RefreshCw,
 Loader2,
 AlertCircle,
 CheckCircle2,
 Upload,
 Image as ImageIcon,
 HardDrive,
 Sparkles,
 Tag,
 ScanFace,
 Eraser,
 ArrowUpCircle,
 Expand,
 Pencil,
 ChevronDown,
 Shield,
 Palette,
 Wand2,
 GalleryHorizontalEnd,
 Folder,
 Globe,
 Plus,
 X,
 Search,
} from 'lucide-react';
import { THEME_COLORS, DEFAULT_THEME_COLOR } from '@/lib/themes';
import type { AiProviderId, StorageProviderId } from '@/types/providers';

/* ─── Types ────────────────────────────────────────────── */

interface AiFeatureEntry {
 mode: 'enabled' | 'disabled' | 'auto';
 minRole: number; // 4=owner 3=admin 2=editor 1=viewer
}

interface OrgSettings {
 orgName: string;
 orgSlug: string;
 plan: string;
 trashRetentionDays: number;
 logoUrl: string | null;
 usage: {
 storageBytes: number;
 bandwidth: number;
 aiCredits: number;
 };
 storageConfig: {
 provider: StorageProviderId;
 bucket: string;
 isByoc: boolean;
 hasVertexApiKey?: boolean;
 };
 aiProviderConfig?: {
 provider: AiProviderId;
 hasVertexApiKey?: boolean;
 hasOpenAiApiKey?: boolean;
 };
 aiFeatureConfig: Record<string, AiFeatureEntry>;
 sectionAccess: Record<string, number>;
 themeColor: string;
 defaultFolderAccessMode: 'restricted' | 'flexible';
}

const ROLE_LEVELS: { value: number; label: string }[] = [
 { value: 4, label: 'Owner' },
 { value: 3, label: 'Admin' },
 { value: 2, label: 'Editor' },
 { value: 1, label: 'Viewer' },
];

const AI_FEATURES = [
 {
 key: 'auto_tag',
 label: 'Auto AI Tag Generation',
 icon: Tag,
 color: 'emerald',
 credits: 1,
 supportsAuto: true,
 },
 {
 key: 'face_detect',
 label: 'Face Detection',
 icon: ScanFace,
 color: 'blue',
 credits: 2,
 supportsAuto: true,
 },
 {
 key: 'bg_remove',
 label: 'Background Removal',
 icon: Eraser,
 color: 'violet',
 credits: 2,
 supportsAuto: false,
 },
 {
 key: 'upscale',
 label: 'Upscale',
 icon: ArrowUpCircle,
 color: 'amber',
 credits: 2,
 supportsAuto: false,
 },
 {
 key: 'expand',
 label: 'AI Expand',
 icon: Expand,
 color: 'cyan',
 credits: 3,
 supportsAuto: false,
 },
 {
 key: 'generate',
 label: 'AI Generator',
 icon: Wand2,
 color: 'pink',
 credits: 5,
 supportsAuto: false,
 },
 {
 key: 'edit',
 label: 'Edit with AI',
 icon: Pencil,
 color: 'purple',
 credits: 8,
 supportsAuto: false,
 },
] as const;

function formatBytes(bytes: number): string {
 if (bytes === 0) return '0 B';
 const units = ['B', 'KB', 'MB', 'GB', 'TB'];
 const i = Math.floor(Math.log(bytes) / Math.log(1024));
 return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

/* ─── Component ────────────────────────────────────────── */

export default function SettingsPage() {
 const [settings, setSettings] = useState<OrgSettings | null>(null);
 const [loading, setLoading] = useState(true);
 const [saving, setSaving] = useState(false);
 const [error, setError] = useState<string | null>(null);
 const [success, setSuccess] = useState<string | null>(null);

 // Editable fields
 const [trashDays, setTrashDays] = useState(30);
 const [orgName, setOrgName] = useState('');
 const [nameError, setNameError] = useState<string | null>(null);
 const [nameSuggestions, setNameSuggestions] = useState<string[]>([]);

 // Logo upload
 const [uploadingLogo, setUploadingLogo] = useState(false);
 const [logoPreview, setLogoPreview] = useState<string | null>(null);
 const logoInputRef = useRef<HTMLInputElement>(null);

 // Storage provisioning
 // Storage status is read-only on this page

 // AI feature config
 const [aiExpanded, setAiExpanded] = useState(false);
 const [aiConfig, setAiConfig] = useState<Record<string, AiFeatureEntry>>({});
 const [aiProvider, setAiProvider] = useState<AiProviderId>('vertex');
 const [openAiApiKey, setOpenAiApiKey] = useState('');

 // Theme color
 const [themeColor, setThemeColor] = useState(DEFAULT_THEME_COLOR);

 // Folder access
 const [defaultFolderAccessMode, setDefaultFolderAccessMode] = useState<'restricted' | 'flexible'>('flexible');
 const [bulkConverting, setBulkConverting] = useState(false);
 const [bulkConvertResult, setBulkConvertResult] = useState<string | null>(null);

 // Gallery mode
 interface GalleryFolder {
   _id: string;
   name: string;
   parentId: string | null;
   path: string;
   galleryMode?: boolean;
   galleryEmbed?: boolean;
 }
 const [galleryFolders, setGalleryFolders] = useState<GalleryFolder[]>([]);
 const [galleryLoading, setGalleryLoading] = useState(false);
 const [galleryToggling, setGalleryToggling] = useState<string | null>(null);
 const [galleryPickerOpen, setGalleryPickerOpen] = useState(false);
 const [gallerySearch, setGallerySearch] = useState('');
 const galleryPickerRef = useRef<HTMLDivElement>(null);

 const enabledGalleryFolders = useMemo(
   () => galleryFolders.filter((f) => f.galleryMode || f.galleryEmbed),
   [galleryFolders],
 );

 const availablePickerFolders = useMemo(() => {
   const q = gallerySearch.toLowerCase().trim();
   return galleryFolders
     .filter((f) => !f.galleryMode && !f.galleryEmbed)
     .filter((f) => {
       if (!q) return true;
       const fullPath = (f.path === '/' ? '/' : f.path) + f.name;
       return fullPath.toLowerCase().includes(q) || f.name.toLowerCase().includes(q);
     });
 }, [galleryFolders, gallerySearch]);

 const fetchGalleryFolders = useCallback(async () => {
   setGalleryLoading(true);
   try {
     const res = await fetch('/api/settings/gallery');
     if (res.ok) {
       const data = await res.json();
       setGalleryFolders(data.folders ?? []);
     }
   } catch {
     // silently fail
   } finally {
     setGalleryLoading(false);
   }
 }, []);

 const toggleGalleryFlag = useCallback(async (folderId: string, field: 'galleryMode' | 'galleryEmbed', value: boolean) => {
   setGalleryToggling(folderId + field);
   try {
     const res = await fetch('/api/settings/gallery', {
       method: 'PATCH',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ folderId, [field]: value }),
     });
     if (res.ok) {
       // Optimistically update the local state
       setGalleryFolders((prev) =>
         prev.map((f) => (String(f._id) === String(folderId) ? { ...f, [field]: value } : f)),
       );
     }
   } catch {
     // silently fail
   } finally {
     setGalleryToggling(null);
   }
 }, []);

 const addGalleryFolder = useCallback(async (folderId: string) => {
   // Optimistically add folder to gallery mode immediately
   setGalleryFolders((prev) =>
     prev.map((f) => (String(f._id) === String(folderId) ? { ...f, galleryMode: true } : f)),
   );
   setGalleryPickerOpen(false);
   setGallerySearch('');
   // Then persist to server
   setGalleryToggling(folderId + 'galleryMode');
   try {
     await fetch('/api/settings/gallery', {
       method: 'PATCH',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ folderId, galleryMode: true }),
     });
   } catch {
     // Revert on failure
     setGalleryFolders((prev) =>
       prev.map((f) => (String(f._id) === String(folderId) ? { ...f, galleryMode: false } : f)),
     );
   } finally {
     setGalleryToggling(null);
   }
 }, []);

 const removeGalleryFolder = useCallback(async (folderId: string) => {
   setGalleryToggling(folderId + 'remove');
   try {
     const res = await fetch('/api/settings/gallery', {
       method: 'PATCH',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ folderId, galleryMode: false, galleryEmbed: false }),
     });
     if (res.ok) {
       setGalleryFolders((prev) =>
         prev.map((f) => (String(f._id) === String(folderId) ? { ...f, galleryMode: false, galleryEmbed: false } : f)),
       );
     }
   } catch {
     // silently fail
   } finally {
     setGalleryToggling(null);
   }
 }, []);

 // Close picker on outside click — use 'click' to avoid racing with button onClick
 useEffect(() => {
   if (!galleryPickerOpen) return;
   const handleClick = (e: Event) => {
     if (galleryPickerRef.current && !galleryPickerRef.current.contains(e.target as Node)) {
       setGalleryPickerOpen(false);
       setGallerySearch('');
     }
   };
   document.addEventListener('click', handleClick);
   return () => document.removeEventListener('click', handleClick);
 }, [galleryPickerOpen]);

 const fetchSettings = useCallback(async () => {
 setLoading(true);
 setError(null);
 try {
 const res = await fetch('/api/settings');
 if (!res.ok) throw new Error(`HTTP ${res.status}`);
 const data = await res.json();
 setSettings(data.settings);
 setTrashDays(data.settings.trashRetentionDays);
 setOrgName(data.settings.orgName);
 setLogoPreview(data.settings.logoUrl);
 setAiConfig(data.settings.aiFeatureConfig ?? {});
 setAiProvider(data.settings.aiProviderConfig?.provider ?? 'vertex');
 setOpenAiApiKey('');
 setThemeColor(data.settings.themeColor ?? DEFAULT_THEME_COLOR);
 setDefaultFolderAccessMode(data.settings.defaultFolderAccessMode ?? 'flexible');
 } catch (err) {
 setError(err instanceof Error ? err.message : 'Failed to load settings');
 } finally {
 setLoading(false);
 }
 }, []);

 useEffect(() => {
 fetchSettings();
 }, [fetchSettings]);

 // Fetch gallery folders on mount
 useEffect(() => {
   fetchGalleryFolders();
 }, [fetchGalleryFolders]);

 const handleSave = useCallback(async () => {
 setSaving(true);
 setError(null);
 setSuccess(null);
 setNameError(null);
 setNameSuggestions([]);
 try {
 const body: Record<string, unknown> = {};
 if (trashDays !== settings?.trashRetentionDays) {
 body.trashRetentionDays = trashDays;
 }
 if (orgName !== settings?.orgName) {
 body.orgName = orgName;
 }
 // Include AI feature config if changed
 if (
 JSON.stringify(aiConfig) !==
 JSON.stringify(settings?.aiFeatureConfig ?? {})
 ) {
 body.aiFeatureConfig = aiConfig;
 }
 if (
 aiProvider !== (settings?.aiProviderConfig?.provider ?? 'vertex')
 || !!openAiApiKey.trim()
 ) {
 body.aiProviderConfig = {
 provider: aiProvider,
 ...(openAiApiKey.trim() ? { openAiApiKey: openAiApiKey.trim() } : {}),
 };
 }
 // Include theme color if changed
 if (themeColor !== (settings?.themeColor ?? DEFAULT_THEME_COLOR)) {
 body.themeColor = themeColor;
 }
 // Include default folder access mode if changed
 if (defaultFolderAccessMode !== (settings?.defaultFolderAccessMode ?? 'flexible')) {
 body.defaultFolderAccessMode = defaultFolderAccessMode;
 }

 const res = await fetch('/api/settings', {
 method: 'PATCH',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify(body),
 });

 const data = await res.json();

 if (res.status === 409) {
 setNameError(data.error);
 setNameSuggestions(data.suggestions ?? []);
 return;
 }

 if (!res.ok) {
 throw new Error(data.error || `HTTP ${res.status}`);
 }

 setSettings((prev) => (prev ? { ...prev, ...data.settings } : prev));
 setAiProvider(data.settings.aiProviderConfig?.provider ?? aiProvider);
 setOpenAiApiKey('');
 setSuccess('Settings saved successfully');
 setTimeout(() => setSuccess(null), 3000);
 } catch (err) {
 setError(err instanceof Error ? err.message : 'Failed to save settings');
 } finally {
 setSaving(false);
 }
 }, [trashDays, orgName, settings, aiConfig, themeColor, defaultFolderAccessMode]);

 const handleBulkConvert = useCallback(async (mode: 'restricted' | 'flexible') => {
 if (!confirm(`Convert ALL folders to ${mode} mode? This will override individual folder settings.`)) return;
 setBulkConverting(true);
 setBulkConvertResult(null);
 try {
 const res = await fetch('/api/settings', {
 method: 'PATCH',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ bulkFolderAccessMode: mode }),
 });
 const data = await res.json();
 if (!res.ok) throw new Error(data.error);
 const count = data.bulkConvertResult?.converted ?? 0;
 setBulkConvertResult(`${count} folder${count !== 1 ? 's' : ''} converted to ${mode}`);
 setTimeout(() => setBulkConvertResult(null), 4000);
 } catch (err) {
 setError(err instanceof Error ? err.message : 'Bulk convert failed');
 } finally {
 setBulkConverting(false);
 }
 }, []);

 const handleLogoUpload = useCallback(async (file: File) => {
 setUploadingLogo(true);
 setError(null);
 try {
 const formData = new FormData();
 formData.append('file', file);

 const res = await fetch('/api/settings/logo', {
 method: 'POST',
 body: formData,
 });

 if (!res.ok) {
 const data = await res.json();
 throw new Error(data.error || `HTTP ${res.status}`);
 }

 const data = await res.json();
 setLogoPreview(data.logoUrl);
 setSuccess('Logo uploaded successfully');
 setTimeout(() => setSuccess(null), 3000);
 } catch (err) {
 setError(err instanceof Error ? err.message : 'Failed to upload logo');
 } finally {
 setUploadingLogo(false);
 }
 }, []);

 /* ─── Loading ──────────────────────────────────────── */

 if (loading) {
 return (
 <div className="flex h-full items-center justify-center">
 <RefreshCw className="h-8 w-8 animate-spin text-dash-text-muted dark:text-dash-text2"/>
 </div>
 );
 }

 /* ─── Error ────────────────────────────────────────── */

 if (!settings) {
 return (
 <div className="flex h-full items-center justify-center">
 <div className="text-center">
 <AlertCircle className="mx-auto h-8 w-8 text-red-400 dark:text-red-500"/>
 <p className="mt-2 text-sm text-dash-text2">
 {error ?? 'Failed to load settings'}
 </p>
 <button
 onClick={fetchSettings}
 className="mt-3 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
 >
 Retry
 </button>
 </div>
 </div>
 );
 }

 const hasChanges =
 trashDays !== settings.trashRetentionDays ||
 orgName !== settings.orgName ||
 aiProvider !== (settings.aiProviderConfig?.provider ?? 'vertex') ||
 !!openAiApiKey.trim() ||
 themeColor !== (settings.themeColor ?? DEFAULT_THEME_COLOR) ||
 JSON.stringify(aiConfig) !== JSON.stringify(settings.aiFeatureConfig ?? {});

 /* ─── Render ───────────────────────────────────────── */

 return (
 <div className="mx-auto max-w-3xl space-y-8 p-6 pb-12">
 {/* Header */}
 <div>
 <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-dash-text">
 <SettingsIcon className="h-6 w-6 text-dash-text-muted"/>
 Settings
 </h1>
 <p className="mt-1 text-sm text-dash-text2">
 Manage your workspace configuration, branding, and storage.
 </p>
 </div>

 {/* Feedback messages */}
 {error && (
 <div className="flex items-center gap-2 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950 px-4 py-3 text-sm text-red-700 dark:text-red-300">
 <AlertCircle className="h-4 w-4 shrink-0"/>
 {error}
 </div>
 )}
 {success && (
 <div className="flex items-center gap-2 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
 <CheckCircle2 className="h-4 w-4 shrink-0"/>
 {success}
 </div>
 )}

 {/* Organization Info + Logo */}
 <section className="rounded-xl border border-dash-border bg-dash-surface p-6">
 <h2 className="text-sm font-semibold text-dash-text2 dark:text-dash-text-muted">
 Organization
 </h2>
 <div className="mt-4 flex gap-6">
 {/* Logo Upload */}
 <div className="flex flex-col items-center gap-2">
 <button
 type="button"
 onClick={() => logoInputRef.current?.click()}
 className="group relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-dash-border bg-dash-muted transition hover:border-dash-border-hover dark:hover:border-dash-border-hover"
 >
 {logoPreview ? (
 // eslint-disable-next-line @next/next/no-img-element
 <img
 src={logoPreview}
 alt="Logo"
 className="h-full w-full object-cover"
 />
 ) : (
 <ImageIcon className="h-8 w-8 text-dash-text-muted dark:text-dash-text2"/>
 )}
 <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition group-hover:opacity-100">
 {uploadingLogo ? (
 <Loader2 className="h-5 w-5 animate-spin text-white"/>
 ) : (
 <Upload className="h-5 w-5 text-white"/>
 )}
 </div>
 </button>
 <span className="text-[11px] text-dash-text-muted">
 Logo
 </span>
 <input
 ref={logoInputRef}
 type="file"
 accept="image/png,image/jpeg,image/svg+xml,image/webp"
 className="hidden"
 onChange={(e) => {
 const file = e.target.files?.[0];
 if (file) handleLogoUpload(file);
 }}
 />
 </div>

 {/* Org Details */}
 <div className="flex-1">
 <div className="grid grid-cols-2 gap-4">
 <div>
 <label className="block text-xs text-dash-text-muted">
 Name
 </label>
 <input
 type="text"
 value={orgName}
 onChange={(e) => {
 setOrgName(e.target.value);
 setNameError(null);
 setNameSuggestions([]);
 }}
 className="mt-1 w-full rounded-lg border border-dash-border bg-dash-surface2 px-3 py-2 text-sm font-medium text-dash-text focus:border-primary dark:focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:focus:ring-primary"
 />
 {nameError && (
 <div className="mt-1">
 <p className="text-xs text-red-500 dark:text-red-400">
 {nameError}
 </p>
 {nameSuggestions.length > 0 && (
 <div className="mt-1 flex flex-wrap gap-1.5">
 {nameSuggestions.map((s) => (
 <button
 key={s}
 onClick={() => {
 setOrgName(s);
 setNameError(null);
 setNameSuggestions([]);
 }}
 className="rounded-md bg-blue-50 dark:bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20"
 >
 {s}
 </button>
 ))}
 </div>
 )}
 </div>
 )}
 </div>
 <div>
 <p className="text-xs text-dash-text-muted">Slug</p>
 <p className="mt-1.5 font-mono text-sm text-dash-text2 dark:text-dash-text-muted">
 {settings.orgSlug}
 </p>
 </div>
 <div>
 <p className="text-xs text-dash-text-muted">Plan</p>
 <p className="mt-0.5 text-sm font-medium capitalize text-dash-text">
 {settings.plan}
 </p>
 </div>
 <div>
 <p className="text-xs text-dash-text-muted">
 Storage Used
 </p>
 <p className="mt-0.5 text-sm font-medium text-dash-text">
 {formatBytes(settings.usage?.storageBytes ?? 0)}
 </p>
 </div>
 </div>
 </div>
 </div>
 </section>

 {/* Storage Configuration */}
 <section className="rounded-xl border border-dash-border bg-dash-surface p-6">
 <div className="flex items-center gap-2">
 <HardDrive className="h-4 w-4 text-blue-500"/>
 <h2 className="text-sm font-semibold text-dash-text2 dark:text-dash-text-muted">
 Storage
 </h2>
 </div>
 <p className="mt-1 text-xs text-dash-text2">
 Current bucket status for this workspace.
 </p>

 <div className="mt-4 rounded-lg border border-dash-border bg-dash-muted/40 p-4">
 <div className="flex flex-wrap items-center justify-between gap-3">
 <div>
 <p className="text-xs text-dash-text-muted">Bucket ID</p>
 <p className="mt-1 font-mono text-sm text-dash-text">
 {settings.storageConfig?.bucket || 'Not configured'}
 </p>
 </div>

 <span
 className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
 settings.storageConfig?.bucket
 ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
 : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
 }`}
 >
 <span className={`h-1.5 w-1.5 rounded-full ${settings.storageConfig?.bucket ? 'bg-emerald-500' : 'bg-amber-500'}`} />
 {settings.storageConfig?.bucket ? 'Connected' : 'Not connected'}
 </span>
 </div>
 </div>

 {/* Usage Stats */}
 <div className="mt-4 grid grid-cols-3 gap-4">
 <div className="rounded-lg bg-dash-muted px-4 py-3 text-center">
 <p className="text-lg font-bold text-dash-text">
 {formatBytes(settings.usage?.storageBytes ?? 0)}
 </p>
 <p className="text-[11px] text-dash-text-muted">
 Storage
 </p>
 </div>
 <div className="rounded-lg bg-dash-muted px-4 py-3 text-center">
 <p className="text-lg font-bold text-dash-text">
 {formatBytes(settings.usage?.bandwidth ?? 0)}
 </p>
 <p className="text-[11px] text-dash-text-muted">
 Bandwidth
 </p>
 </div>
 <div className="rounded-lg bg-dash-muted px-4 py-3 text-center">
 <p className="text-lg font-bold text-dash-text">
 {settings.usage?.aiCredits ?? 0}
 </p>
 <p className="text-[11px] text-dash-text-muted">
 AI Credits
 </p>
 </div>
 </div>
 </section>

 {/* AI Feature Configuration */}
 <section className="rounded-xl border border-dash-border bg-dash-surface">
 <button
 type="button"
 onClick={() => setAiExpanded((v) => !v)}
 className="flex w-full items-center justify-between p-6 text-left"
 >
 <div className="flex items-center gap-2">
 <Sparkles className="h-4 w-4 text-violet-400"/>
 <h2 className="text-sm font-semibold text-dash-text2 dark:text-dash-text-muted">
 AI Feature Controls
 </h2>
 </div>
 <ChevronDown
 className={`h-4 w-4 text-dash-text-muted transition-transform duration-200 ${aiExpanded ? 'rotate-180' : ''}`}
 />
 </button>

 {aiExpanded && (
 <div className="border-t border-dash-border px-6 pb-6">
 <p className="mt-4 text-xs text-dash-text2">
 Enable, disable, or set auto-trigger for each AI feature. Control
 access by minimum role level.
 </p>

 <div className="mt-4 rounded-lg border border-dash-border bg-dash-muted/40 p-4">
 <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
 <div>
 <p className="text-sm font-medium text-dash-text2 dark:text-dash-text-muted">
 Active AI provider
 </p>
 <p className="mt-1 max-w-xl text-xs text-dash-text2">
 Image generation and prompt refinement follow this provider. Image editing and analysis tools remain on the current Vertex path until the broader provider rollout is complete.
 </p>
 </div>

 <select
 value={aiProvider}
 onChange={(e) => setAiProvider(e.target.value as AiProviderId)}
 className="rounded-lg border border-dash-border bg-dash-surface px-3 py-2 text-sm font-medium text-dash-text focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
 >
 <option value="vertex">Google Vertex AI</option>
 <option value="openai">OpenAI</option>
 </select>
 </div>

 {aiProvider === 'openai' && (
 <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
 <label className="block">
 <span className="text-xs text-dash-text-muted">OpenAI API key</span>
 <input
 type="password"
 value={openAiApiKey}
 onChange={(e) => setOpenAiApiKey(e.target.value)}
 placeholder={settings.aiProviderConfig?.hasOpenAiApiKey ? 'Stored securely - enter a new key to replace it' : 'sk-...'}
 className="mt-1 w-full rounded-lg border border-dash-border bg-dash-surface2 px-3 py-2 text-sm text-dash-text focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
 />
 </label>

 <div className="text-xs text-dash-text2 sm:text-right">
 {settings.aiProviderConfig?.hasOpenAiApiKey ? (
 <p className="text-emerald-600 dark:text-emerald-400">
 OpenAI API key is already stored securely for this workspace.
 </p>
 ) : (
 <p>
 Use a workspace key or set <span className="font-medium">OPENAI_API_KEY</span> on the server.
 </p>
 )}
 </div>
 </div>
 )}
 </div>

 <div className="mt-4 space-y-3">
 {AI_FEATURES.map((feat) => {
 const Icon = feat.icon;
 const cfg = aiConfig[feat.key] ?? {
 mode: 'enabled',
 minRole: 1,
 };
 const colorMap: Record<string, string> = {
 emerald:
 'text-emerald-500 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 ring-emerald-200 dark:ring-emerald-500/20 text-emerald-700 dark:text-emerald-300',
 blue: 'text-blue-500 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 ring-blue-200 dark:ring-blue-500/20 text-blue-700 dark:text-blue-300',
 violet:
 'text-violet-500 dark:text-violet-400 bg-violet-50 dark:bg-violet-500/10 ring-violet-200 dark:ring-violet-500/20 text-violet-700 dark:text-violet-300',
 amber:
 'text-amber-500 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 ring-amber-200 dark:ring-amber-500/20 text-amber-700 dark:text-amber-300',
 cyan: 'text-cyan-500 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-500/10 ring-cyan-200 dark:ring-cyan-500/20 text-cyan-700 dark:text-cyan-300',
 purple:
 'text-purple-500 dark:text-purple-400 bg-purple-50 dark:bg-purple-500/10 ring-purple-200 dark:ring-purple-500/20 text-purple-700 dark:text-purple-300',
 };
 const [iconColor, bgColor, ringColor, textColor] = (
 colorMap[feat.color] ?? colorMap.violet
 ).split(' ');

 return (
 <div
 key={feat.key}
 className="rounded-lg border border-dash-border bg-dash-muted/50 /50 px-4 py-3"
 >
 <div className="flex items-center justify-between">
 {/* Left: Icon + Name + Credits */}
 <div className="flex items-center gap-3">
 <Icon className={`h-4 w-4 ${iconColor}`} />
 <div>
 <p className="text-xs font-medium text-dash-text2 dark:text-dash-text-muted">
 {feat.label}
 </p>
 <span
 className={`mt-0.5 inline-block rounded-full ${bgColor} px-2 py-0.5 text-[10px] font-semibold ${textColor} ring-1 ${ringColor}`}
 >
 {feat.credits} credit{feat.credits > 1 ? 's' : ''} /
 image
 </span>
 </div>
 </div>

 {/* Right: Mode toggle + Role selector */}
 <div className="flex items-center gap-3">
 {/* Mode Toggle */}
 <div className="flex overflow-hidden rounded-lg border border-dash-border bg-dash-surface">
 {(
 [
 'enabled',
 'disabled',
 ...(feat.supportsAuto ? ['auto'] : []),
 ] as const
 ).map((mode) => (
 <button
 key={mode}
 type="button"
 onClick={() =>
 setAiConfig((prev) => ({
 ...prev,
 [feat.key]: {
 ...cfg,
 mode: mode as AiFeatureEntry['mode'],
 },
 }))
 }
 className={`px-2.5 py-1.5 text-[11px] font-medium capitalize transition ${
 cfg.mode === mode
 ? 'bg-[var(--im-primary)] text-[var(--im-primary-fg)]'
 : 'text-dash-text2 hover:bg-dash-surface-hover'
 }`}
 >
 {mode}
 </button>
 ))}
 </div>

 {/* Min Role */}
 <div className="flex items-center gap-1.5">
 <Shield className="h-3 w-3 text-dash-text-muted"/>
 <select
 value={cfg.minRole}
 onChange={(e) =>
 setAiConfig((prev) => ({
 ...prev,
 [feat.key]: {
 ...cfg,
 minRole: Number(e.target.value),
 },
 }))
 }
 className="rounded-md border border-dash-border bg-dash-surface px-2 py-1 text-[11px] font-medium text-dash-text2 focus:border-primary dark:focus:border-primary focus:outline-none"
 >
 {ROLE_LEVELS.map((r) => (
 <option key={r.value} value={r.value}>
 {r.label}+
 </option>
 ))}
 </select>
 </div>
 </div>
 </div>
 </div>
 );
 })}
 </div>
 </div>
 )}
 </section>

 {/* Theme Color */}
 <section className="rounded-xl border border-dash-border bg-dash-surface p-6">
 <div className="flex items-center gap-2">
 <Palette className="h-4 w-4 text-[var(--im-primary)]"/>
 <h2 className="text-sm font-semibold text-dash-text2 ">
 Theme Color
 </h2>
 </div>
 <p className="mt-1 text-xs text-dash-text2">
 Choose the primary accent color for your workspace. Applies to all
 members.
 </p>

 <div className="mt-4 grid grid-cols-4 gap-3 sm:grid-cols-8">
 {THEME_COLORS.map((c) => (
 <button
 key={c.id}
 type="button"
 onClick={() => {
 setThemeColor(c.id);
 // Live preview: immediately update the data attribute
 document.documentElement.setAttribute('data-theme-color', c.id);
 }}
 className={`group flex flex-col items-center gap-1.5 rounded-xl p-2.5 transition ${
 themeColor === c.id
 ? 'bg-dash-muted ring-2 ring-offset-1 dark:ring-offset-dash-bg'
 : 'hover:bg-dash-surface-hover/50'
 }`}
 style={
 themeColor === c.id
 ? { ['--tw-ring-color' as string]: c.swatch }
 : undefined
 }
 >
 <div
 className={`h-8 w-8 rounded-full shadow-sm transition group-hover:scale-110 ${
 themeColor === c.id
 ? 'ring-2 ring-white dark:ring-dash-border scale-110'
 : ''
 }`}
 style={{ backgroundColor: c.swatch }}
 />
 <span className="text-[10px] font-medium text-dash-text2">
 {c.name}
 </span>
 </button>
 ))}
 </div>
 </section>

 {/* Folder Access Control */}
 <section className="rounded-xl border border-dash-border bg-dash-surface p-6">
 <div className="flex items-center gap-2">
 <Shield className="h-4 w-4 text-[var(--im-primary)]"/>
 <h2 className="text-sm font-semibold text-dash-text2">
 Folder Access Control
 </h2>
 </div>
 <p className="mt-1 text-xs text-dash-text2">
 Control whether new folders default to <strong>Flexible</strong> (visible to all org members) or <strong>Restricted</strong> (only allowed members & groups).
 Child folders inherit the parent&apos;s access mode.
 </p>

 <div className="mt-4 space-y-3">
 <div className="flex items-center gap-3">
 <label className="text-xs font-medium text-dash-text2 w-36">Default for new folders:</label>
 <select
 value={defaultFolderAccessMode}
 onChange={(e) => setDefaultFolderAccessMode(e.target.value as 'restricted' | 'flexible')}
 className="rounded-lg border border-dash-border bg-dash-surface px-3 py-1.5 text-xs text-dash-text outline-none focus:border-[var(--im-primary)]"
 >
 <option value="flexible">Flexible (visible to all)</option>
 <option value="restricted">Restricted (explicit access)</option>
 </select>
 </div>

 <div className="border-t border-dash-border pt-3">
 <p className="mb-2 text-xs text-dash-text-muted">
 Bulk convert all existing folders:
 </p>
 <div className="flex gap-2">
 <button
 onClick={() => handleBulkConvert('flexible')}
 disabled={bulkConverting}
 className="rounded-lg border border-emerald-300 dark:border-emerald-700 px-3 py-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition disabled:opacity-50"
 >
 {bulkConverting ? 'Converting…' : 'Set all Flexible'}
 </button>
 <button
 onClick={() => handleBulkConvert('restricted')}
 disabled={bulkConverting}
 className="rounded-lg border border-red-300 dark:border-red-700 px-3 py-1.5 text-xs font-medium text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition disabled:opacity-50"
 >
 {bulkConverting ? 'Converting…' : 'Set all Restricted'}
 </button>
 </div>
 {bulkConvertResult && (
 <p className="mt-2 flex items-center gap-1 text-xs text-emerald-600">
 <CheckCircle2 className="h-3 w-3"/> {bulkConvertResult}
 </p>
 )}
 </div>
 </div>
 </section>

 {/* Trash Settings */}
 <section className="rounded-xl border border-dash-border bg-dash-surface p-6">
 <div className="flex items-center gap-2">
 <Trash2 className="h-4 w-4 text-red-400 dark:text-red-500"/>
 <h2 className="text-sm font-semibold text-dash-text2 dark:text-dash-text-muted">
 Trash
 </h2>
 </div>
 <p className="mt-1 text-xs text-dash-text2">
 Deleted assets are kept in Trash and automatically purged after the
 retention period.
 </p>

 <div className="mt-5">
 <label className="block text-xs font-medium text-dash-text2 dark:text-dash-text-muted">
 Auto-purge after (days)
 </label>
 <div className="mt-2 flex items-center gap-4">
 <input
 type="range"
 min={30}
 max={90}
 step={1}
 value={trashDays}
 onChange={(e) => setTrashDays(Number(e.target.value))}
 className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-dash-badge accent-primary "
 />
 <div className="flex h-9 w-16 items-center justify-center rounded-lg border border-dash-border bg-dash-surface2 text-sm font-bold tabular-nums text-dash-text">
 {trashDays}d
 </div>
 </div>
 <div className="mt-1 flex justify-between text-[11px] text-dash-text-muted">
 <span>30 days (min)</span>
 <span>60 days</span>
 <span>90 days (max)</span>
 </div>
 </div>
 </section>

 {/* Gallery Mode */}
 <section className="rounded-xl border border-dash-border bg-dash-surface p-6">
 <div className="flex items-center justify-between">
   <div>
     <div className="flex items-center gap-2">
       <GalleryHorizontalEnd className="h-4 w-4 text-purple-400 dark:text-purple-500"/>
       <h2 className="text-sm font-semibold text-dash-text2 dark:text-dash-text-muted">
         Gallery Mode
       </h2>
     </div>
     <p className="mt-1 text-xs text-dash-text2">
       Enable photo gallery mode on specific folders. Gallery mode activates masonry layout,
       date-grouped sections, slideshow, and enhanced viewing experiences.
     </p>
   </div>
   {/* Add folder picker trigger */}
   <div className="relative" ref={galleryPickerRef}>
     <button
       onClick={() => { setGalleryPickerOpen((v) => !v); setGallerySearch(''); }}
       className="flex items-center gap-1.5 rounded-lg border border-dash-border bg-dash-muted px-3 py-1.5 text-xs font-medium text-dash-text hover:bg-dash-surface-hover transition-colors"
     >
       <Plus className="h-3.5 w-3.5"/>
       Add Folder
     </button>
     {/* Picker dropdown */}
     {galleryPickerOpen && (
       <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl border border-dash-border bg-dash-surface shadow-xl">
         {/* Search input */}
         <div className="flex items-center gap-2 border-b border-dash-border px-3 py-2">
           <Search className="h-3.5 w-3.5 text-dash-text-muted shrink-0"/>
           <input
             autoFocus
             type="text"
             value={gallerySearch}
             onChange={(e) => setGallerySearch(e.target.value)}
             placeholder="Search folders..."
             className="w-full bg-transparent text-xs text-dash-text placeholder:text-dash-text-muted outline-none"
           />
           {gallerySearch && (
             <button onClick={() => setGallerySearch('')} className="text-dash-text-muted hover:text-dash-text">
               <X className="h-3 w-3"/>
             </button>
           )}
         </div>
         {/* Folder list */}
         <div className="max-h-64 overflow-y-auto py-1">
           {galleryLoading ? (
             <div className="flex items-center justify-center py-6">
               <Loader2 className="h-4 w-4 animate-spin text-dash-text-muted"/>
             </div>
           ) : availablePickerFolders.length === 0 ? (
             <div className="px-3 py-6 text-center text-xs text-dash-text-muted">
               {gallerySearch ? 'No matching folders found' : 'All folders already added'}
             </div>
           ) : (
             availablePickerFolders.map((folder) => {
               const fullPath = folder.path === '/' ? `/${folder.name}` : `${folder.path}${folder.name}`;
               return (
                 <button
                   key={folder._id}
                   onClick={() => addGalleryFolder(folder._id)}
                   className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-dash-surface-hover transition-colors"
                 >
                   <Folder className="h-3.5 w-3.5 text-[var(--im-primary)] shrink-0"/>
                   <div className="min-w-0 flex-1">
                     <div className="text-xs font-medium text-dash-text truncate">{folder.name}</div>
                     <div className="text-[10px] text-dash-text-muted truncate" title={fullPath}>{fullPath}</div>
                   </div>
                   <Plus className="h-3 w-3 text-dash-text-muted shrink-0"/>
                 </button>
               );
             })
           )}
         </div>
       </div>
     )}
   </div>
 </div>

 <div className="mt-5">
   {galleryLoading ? (
     <div className="flex items-center justify-center py-8">
       <Loader2 className="h-5 w-5 animate-spin text-dash-text-muted"/>
     </div>
   ) : enabledGalleryFolders.length === 0 ? (
     <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-dash-border py-10 text-dash-text-muted">
       <GalleryHorizontalEnd className="h-8 w-8 opacity-20 mb-2"/>
       <p className="text-xs">No folders have gallery mode enabled yet.</p>
       <p className="text-[10px] mt-1 opacity-70">Click &quot;Add Folder&quot; to enable gallery mode on a folder.</p>
     </div>
   ) : (
     <div className="space-y-0 divide-y divide-dash-border rounded-xl border border-dash-border overflow-hidden">
       {/* Table header */}
       <div className="grid grid-cols-[1fr_100px_100px_36px] gap-3 bg-dash-muted px-4 py-2 items-center">
         <span className="text-[10px] font-semibold uppercase tracking-wider text-dash-text-muted">Folder</span>
         <span className="text-[10px] font-semibold uppercase tracking-wider text-dash-text-muted text-center">Assets Gallery</span>
         <span className="text-[10px] font-semibold uppercase tracking-wider text-dash-text-muted text-center">WhiteSource</span>
         <span/>
       </div>
       {/* Enabled folder rows */}
       {enabledGalleryFolders.map((folder) => {
         const fullPath = folder.path === '/' ? `/${folder.name}` : `${folder.path}${folder.name}`;
         return (
           <div
             key={folder._id}
             className="grid grid-cols-[1fr_100px_100px_36px] gap-3 items-center px-4 py-3 hover:bg-dash-surface-hover transition-colors"
           >
             {/* Folder info with path */}
             <div className="min-w-0">
               <div className="flex items-center gap-2">
                 <Folder className="h-3.5 w-3.5 text-[var(--im-primary)] shrink-0"/>
                 <span className="text-xs font-medium text-dash-text truncate">{folder.name}</span>
               </div>
               <div className="ml-[22px] text-[10px] text-dash-text-muted truncate mt-0.5" title={fullPath}>
                 {fullPath}
               </div>
             </div>

             {/* Assets Gallery toggle */}
             <div className="flex justify-center">
               <button
                 onClick={() => toggleGalleryFlag(folder._id, 'galleryMode', !folder.galleryMode)}
                 disabled={galleryToggling === folder._id + 'galleryMode'}
                 className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[var(--im-primary)]/30 disabled:opacity-50 ${
                   folder.galleryMode ? 'bg-[var(--im-primary)]' : 'bg-dash-muted'
                 }`}
                 title={folder.galleryMode ? 'Disable gallery mode in Assets' : 'Enable gallery mode in Assets'}
               >
                 <span
                   className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform ring-0 transition duration-200 ease-in-out ${
                     folder.galleryMode ? 'translate-x-4' : 'translate-x-0'
                   }`}
                 />
               </button>
             </div>

             {/* WhiteSource embed toggle */}
             <div className="flex justify-center">
               <button
                 onClick={() => toggleGalleryFlag(folder._id, 'galleryEmbed', !folder.galleryEmbed)}
                 disabled={galleryToggling === folder._id + 'galleryEmbed'}
                 className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[var(--im-primary)]/30 disabled:opacity-50 ${
                   folder.galleryEmbed ? 'bg-[var(--im-primary)]' : 'bg-dash-muted'
                 }`}
                 title={folder.galleryEmbed ? 'Disable gallery mode in WhiteSource' : 'Enable gallery mode in WhiteSource'}
               >
                 <span
                   className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform ring-0 transition duration-200 ease-in-out ${
                     folder.galleryEmbed ? 'translate-x-4' : 'translate-x-0'
                   }`}
                 />
               </button>
             </div>

             {/* Remove button */}
             <div className="flex justify-center">
               <button
                 onClick={() => removeGalleryFolder(folder._id)}
                 disabled={galleryToggling === folder._id + 'remove'}
                 className="rounded-md p-1 text-dash-text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                 title="Remove from gallery mode"
               >
                 {galleryToggling === folder._id + 'remove' ? (
                   <Loader2 className="h-3.5 w-3.5 animate-spin"/>
                 ) : (
                   <X className="h-3.5 w-3.5"/>
                 )}
               </button>
             </div>
           </div>
         );
       })}
     </div>
   )}

   <div className="mt-3 flex items-start gap-2 rounded-lg bg-dash-muted p-3">
     <Globe className="h-3.5 w-3.5 text-dash-text-muted shrink-0 mt-0.5"/>
     <div className="text-[11px] text-dash-text-muted leading-relaxed">
       <strong className="text-dash-text">Assets Gallery</strong> enables gallery mode when browsing the folder in your dashboard.
       <br/>
       <strong className="text-dash-text">WhiteSource</strong> enables gallery mode when the folder is viewed via the embeddable WhiteSource widget.
     </div>
   </div>
 </div>
 </section>

 {/* Save Button */}
 {hasChanges && (
 <div className="flex justify-end">
 <button
 onClick={handleSave}
 disabled={saving}
 className="flex items-center gap-2 rounded-lg bg-[var(--im-primary)] px-5 py-2.5 text-sm font-medium text-[var(--im-primary-fg)] transition hover:bg-[var(--im-primary)]/90 disabled:opacity-50"
 >
 {saving ? (
 <Loader2 className="h-4 w-4 animate-spin"/>
 ) : (
 <Save className="h-4 w-4"/>
 )}
 Save Changes
 </button>
 </div>
 )}
 </div>
 );
}
