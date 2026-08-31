// SPDX-License-Identifier: Apache-2.0
'use client';

import { copyText } from '@/lib/clipboard';
import { useState, useEffect, useCallback } from 'react';
import {
 Plus,
 Pencil,
 Trash2,
 Copy,
 Check,
 Loader2,
 Layers,
 AlertCircle,
 X,
 Sparkles,
 Bookmark,
} from 'lucide-react';
import { useRole } from '@/components/dashboard/role-context';
import { parseTransforms, hasTransforms } from '@/lib/transforms/parser';
import {
 TRANSFORM_PRESETS,
 type TransformPreset,
} from '@/lib/transforms/constants';

/* ─── Types ──────────────────────────────────────────────────── */

interface NamedTransform {
 _id: string;
 name: string;
 transforms: string;
 description?: string;
 createdAt: string;
}

/* ─── Component ───────────────────────────────────────────────── */

export default function NamedTransformsPage() {
 const { can, orgSlug } = useRole();
 const canManage = can('manage_settings');

 const [transforms, setTransforms] = useState<NamedTransform[]>([]);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState('');

 // Dialog state
 const [dialogOpen, setDialogOpen] = useState(false);
 const [editing, setEditing] = useState<NamedTransform | null>(null);
 const [formName, setFormName] = useState('');
 const [formTransforms, setFormTransforms] = useState('');
 const [formDescription, setFormDescription] = useState('');
 const [formError, setFormError] = useState('');
 const [saving, setSaving] = useState(false);

 // Delete state
 const [deletingId, setDeletingId] = useState<string | null>(null);
 const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

 // Copy state
 const [copiedId, setCopiedId] = useState<string | null>(null);

 // AI generate state
 const [aiPrompt, setAiPrompt] = useState('');
 const [aiLoading, setAiLoading] = useState(false);
 const [aiError, setAiError] = useState('');

 // Preset copy state
 const [copiedPreset, setCopiedPreset] = useState<string | null>(null);

 /* ── Fetch ─────────────────────────────────────────────────── */
 const fetchTransforms = useCallback(async () => {
 try {
 setLoading(true);
 const res = await fetch('/api/named-transforms');
 if (!res.ok) throw new Error('Failed to load');
 const data = await res.json();
 setTransforms(data.transforms ?? []);
 setError('');
 } catch {
 setError('Failed to load named transforms.');
 } finally {
 setLoading(false);
 }
 }, []);

 useEffect(() => {
 fetchTransforms();
 }, [fetchTransforms]);

 /* ── Dialog Helpers ────────────────────────────────────────── */
 const openCreate = () => {
 setEditing(null);
 setFormName('');
 setFormTransforms('');
 setFormDescription('');
 setFormError('');
 setDialogOpen(true);
 };

 const openEdit = (t: NamedTransform) => {
 setEditing(t);
 setFormName(t.name);
 setFormTransforms(t.transforms);
 setFormDescription(t.description ?? '');
 setFormError('');
 setDialogOpen(true);
 };

 const closeDialog = () => {
 setDialogOpen(false);
 setEditing(null);
 };

 /* ── Save ──────────────────────────────────────────────────── */
 const handleSave = async () => {
 setFormError('');

 // Validate name
 if (!/^[a-zA-Z0-9_-]{1,64}$/.test(formName)) {
 setFormError(
 'Name must be 1–64 characters: letters, numbers, hyphens, underscores.',
 );
 return;
 }

 // Validate transforms
 try {
 const config = parseTransforms(formTransforms);
 if (!hasTransforms(config)) {
 setFormError('Transform string must contain at least one parameter.');
 return;
 }
 } catch {
 setFormError('Invalid transform string. Use format: w-300,h-300,q-80');
 return;
 }

 setSaving(true);
 try {
 const url = editing
 ? `/api/named-transforms/${editing._id}`
 : '/api/named-transforms';
 const method = editing ? 'PATCH' : 'POST';

 const res = await fetch(url, {
 method,
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 name: formName,
 transforms: formTransforms,
 description: formDescription || undefined,
 }),
 });

 if (!res.ok) {
 const data = await res.json();
 setFormError(data.error ?? 'Save failed.');
 return;
 }

 closeDialog();
 fetchTransforms();
 } catch {
 setFormError('Network error. Please try again.');
 } finally {
 setSaving(false);
 }
 };

 /* ── Delete ────────────────────────────────────────────────── */
 const handleDelete = async (id: string) => {
 setDeletingId(id);
 try {
 const res = await fetch(`/api/named-transforms/${id}`, {
 method: 'DELETE',
 });
 if (!res.ok) throw new Error();
 setConfirmDeleteId(null);
 fetchTransforms();
 } catch {
 // Silently fail (could add toast)
 } finally {
 setDeletingId(null);
 }
 };

 /* ── Copy URL ──────────────────────────────────────────────── */
 const handleCopy = async (name: string) => {
 const url = `${window.location.origin}/api/transform/${orgSlug}/n-${name}/{storageKey}`;
 await copyText(url);
 setCopiedId(name);
 setTimeout(() => setCopiedId(null), 2000);
 };

 /* ── AI Generate ─────────────────────────────────────────── */
 const handleAiGenerate = async () => {
 if (!aiPrompt.trim()) return;
 setAiLoading(true);
 setAiError('');
 try {
 const res = await fetch('/api/transforms/ai', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ prompt: aiPrompt }),
 });
 if (!res.ok) {
 const data = await res.json();
 setAiError(data.error ?? 'AI generation failed');
 return;
 }
 const data = await res.json();
 if (data.transform) {
 setFormTransforms(data.transform);
 // If dialog isn't open, open it with the generated transform
 if (!dialogOpen) {
 setEditing(null);
 setFormName('');
 setFormDescription('');
 setFormError('');
 setDialogOpen(true);
 }
 setAiPrompt('');
 }
 } catch {
 setAiError('Network error. Please try again.');
 } finally {
 setAiLoading(false);
 }
 };

 /* ── Use Preset ──────────────────────────────────────────── */
 const handleUsePreset = (preset: TransformPreset) => {
 setEditing(null);
 setFormName(
 preset.name
 .toLowerCase()
 .replace(/[^a-z0-9_-]/g, '-')
 .replace(/-+/g, '-'),
 );
 setFormTransforms(preset.transform);
 setFormDescription(preset.description);
 setFormError('');
 setDialogOpen(true);
 };

 const handleCopyPreset = async (transform: string, name: string) => {
 await copyText(transform);
 setCopiedPreset(name);
 setTimeout(() => setCopiedPreset(null), 2000);
 };

 /* ── Render ────────────────────────────────────────────────── */
 return (
 <div className="mx-auto max-w-3xl">
 <div className="mb-6 flex items-center justify-between">
 <div>
 <h1 className="text-lg font-bold text-dash-text">
 Named Transforms
 </h1>
 <p className="mt-0.5 text-sm text-dash-text2">
 Reusable image transformation presets. Use{' '}
 <code className="rounded bg-dash-muted px-1 py-0.5 text-[11px]">
 n-{'{name}'}
 </code>{' '}
 in transform URLs.
 </p>
 </div>
 {canManage && (
 <div className="flex items-center gap-2">
 <button
 onClick={openCreate}
 className="flex items-center gap-1.5 rounded-lg bg-[var(--im-primary)] px-3 py-2 text-xs font-semibold text-[var(--im-primary-fg)] transition hover:bg-[var(--im-primary)]/90"
 >
 <Plus className="h-3.5 w-3.5"/>
 New Transform
 </button>
 </div>
 )}
 </div>

 {/* ─── AI Generate Bar ─────────────────────────────────── */}
 {canManage && (
 <div className="mb-6 rounded-xl border border-purple-200 dark:border-purple-800/60 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-950/30 dark:to-indigo-950/30 p-4">
 <div className="mb-2 flex items-center gap-2">
 <Sparkles className="h-4 w-4 text-purple-600 dark:text-purple-400"/>
 <span className="text-xs font-semibold text-purple-700 dark:text-purple-300">
 AI Transform Generator
 </span>
 </div>
 <p className="mb-3 text-[11px] text-purple-600/80 dark:text-purple-400/80">
 Describe what you need in plain English and AI will generate the
 transform string.
 </p>
 <div className="flex gap-2">
 <input
 value={aiPrompt}
 onChange={(e) => setAiPrompt(e.target.value)}
 onKeyDown={(e) =>
 e.key === 'Enter' && !aiLoading && handleAiGenerate()
 }
 placeholder='e.g. "400x400 thumbnail with auto crop and high quality"'
 className="flex-1 rounded-lg border border-purple-200 dark:border-purple-700 bg-dash-surface px-3 py-2 text-sm text-dash-text placeholder:text-purple-300 dark:placeholder:text-purple-600 outline-none focus:border-purple-500 dark:focus:border-purple-400"
 />
 <button
 onClick={handleAiGenerate}
 disabled={aiLoading || !aiPrompt.trim()}
 className="flex items-center gap-1.5 rounded-lg bg-purple-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
 >
 {aiLoading ? (
 <Loader2 className="h-3.5 w-3.5 animate-spin"/>
 ) : (
 <Sparkles className="h-3.5 w-3.5"/>
 )}
 Generate
 </button>
 </div>
 {aiError && (
 <p className="mt-2 flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
 <AlertCircle className="h-3 w-3"/>
 {aiError}
 </p>
 )}
 </div>
 )}

 {/* Error */}
 {error && (
 <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950 px-4 py-3 text-sm text-red-700 dark:text-red-300">
 <AlertCircle className="h-4 w-4 shrink-0"/>
 {error}
 </div>
 )}

 {/* Loading */}
 {loading && (
 <div className="flex items-center justify-center py-20">
 <Loader2 className="h-6 w-6 animate-spin text-dash-text-muted"/>
 </div>
 )}

 {/* Empty */}
 {!loading && transforms.length === 0 && !error && (
 <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-dash-border py-16 text-center">
 <Layers className="mb-3 h-10 w-10 text-dash-text-muted"/>
 <p className="text-sm font-medium text-dash-text2 dark:text-dash-text-muted">
 No named transforms yet
 </p>
 <p className="mt-1 text-xs text-dash-text-muted">
 Create reusable presets like &quot;thumbnail&quot;,
 &quot;hero-banner&quot;, or &quot;og-image&quot;.
 </p>
 {canManage && (
 <button
 onClick={openCreate}
 className="mt-4 flex items-center gap-1.5 rounded-lg bg-[var(--im-primary)] px-3 py-2 text-xs font-semibold text-[var(--im-primary-fg)] transition hover:bg-[var(--im-primary)]/90"
 >
 <Plus className="h-3.5 w-3.5"/>
 Create First Transform
 </button>
 )}
 </div>
 )}

 {/* Table */}
 {!loading && transforms.length > 0 && (
 <div className="overflow-hidden rounded-xl border border-dash-border">
 <table className="w-full text-left text-sm">
 <thead className="border-b border-dash-border bg-dash-muted dark:bg-dash-deep">
 <tr>
 <th className="px-4 py-2.5 text-[10px] font-medium uppercase tracking-wider text-dash-text2">
 Name
 </th>
 <th className="px-4 py-2.5 text-[10px] font-medium uppercase tracking-wider text-dash-text2">
 Transform
 </th>
 <th className="px-4 py-2.5 text-[10px] font-medium uppercase tracking-wider text-dash-text2">
 Description
 </th>
 <th className="px-4 py-2.5 text-right text-[10px] font-medium uppercase tracking-wider text-dash-text2">
 Actions
 </th>
 </tr>
 </thead>
 <tbody className="divide-y divide-dash-border ">
 {transforms.map((t) => (
 <tr
 key={t._id}
 className="transition hover:bg-dash-surface-hover"
 >
 <td className="px-4 py-3">
 <code className="rounded bg-dash-muted px-1.5 py-0.5 text-xs font-medium text-dash-text ">
 {t.name}
 </code>
 </td>
 <td className="px-4 py-3">
 <code className="rounded bg-emerald-50 dark:bg-emerald-950 px-1.5 py-0.5 text-xs text-emerald-700 dark:text-emerald-300">
 {t.transforms}
 </code>
 </td>
 <td className="max-w-[200px] truncate px-4 py-3 text-xs text-dash-text2">
 {t.description || '—'}
 </td>
 <td className="px-4 py-3">
 <div className="flex items-center justify-end gap-1">
 <button
 onClick={() => handleCopy(t.name)}
 className="rounded p-1.5 text-dash-text-muted transition hover:bg-dash-surface-hover hover:text-dash-text"
 title="Copy URL pattern"
 >
 {copiedId === t.name ? (
 <Check className="h-3.5 w-3.5 text-emerald-500"/>
 ) : (
 <Copy className="h-3.5 w-3.5"/>
 )}
 </button>
 {canManage && (
 <>
 <button
 onClick={() => openEdit(t)}
 className="rounded p-1.5 text-dash-text-muted transition hover:bg-dash-surface-hover hover:text-dash-text"
 title="Edit"
 >
 <Pencil className="h-3.5 w-3.5"/>
 </button>
 {confirmDeleteId === t._id ? (
 <div className="flex items-center gap-1">
 <button
 onClick={() => handleDelete(t._id)}
 disabled={deletingId === t._id}
 className="rounded bg-red-600 px-2 py-1 text-[10px] font-medium text-white transition hover:bg-red-700 disabled:opacity-50"
 >
 {deletingId === t._id ? (
 <Loader2 className="h-3 w-3 animate-spin"/>
 ) : (
 'Confirm'
 )}
 </button>
 <button
 onClick={() => setConfirmDeleteId(null)}
 className="rounded px-2 py-1 text-[10px] font-medium text-dash-text2 transition hover:bg-dash-surface-hover"
 >
 Cancel
 </button>
 </div>
 ) : (
 <button
 onClick={() => setConfirmDeleteId(t._id)}
 className="rounded p-1.5 text-dash-text-muted transition hover:bg-red-50 dark:hover:bg-red-950 hover:text-red-500"
 title="Delete"
 >
 <Trash2 className="h-3.5 w-3.5"/>
 </button>
 )}
 </>
 )}
 </div>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 )}

 {/* ─── Quick Presets ────────────────────────────────────── */}
 <div className="mt-8">
 <div className="mb-4 flex items-center gap-2">
 <Bookmark className="h-4 w-4 text-dash-text2"/>
 <h2 className="text-sm font-bold text-dash-text">
 Quick Presets
 </h2>
 <span className="rounded-full bg-dash-muted px-2 py-0.5 text-[10px] font-medium text-dash-text2">
 {TRANSFORM_PRESETS.length} presets
 </span>
 </div>
 <p className="mb-4 text-xs text-dash-text2">
 Common transform configurations ready to use. Click &quot;Use&quot; to
 create a named transform from a preset, or copy the string directly.
 </p>
 <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
 {TRANSFORM_PRESETS.map((preset) => (
 <div
 key={preset.name}
 className="group rounded-xl border border-dash-border bg-dash-surface p-3.5 transition hover:border-dash-border hover:shadow-sm"
 >
 <div className="mb-1.5 flex items-center justify-between">
 <span className="text-xs font-semibold text-dash-text">
 {preset.name}
 </span>
 <div className="flex gap-1 opacity-0 transition group-hover:opacity-100">
 <button
 onClick={() =>
 handleCopyPreset(preset.transform, preset.name)
 }
 className="rounded p-1 text-dash-text-muted transition hover:bg-dash-surface-hover hover:text-dash-text2"
 title="Copy transform string"
 >
 {copiedPreset === preset.name ? (
 <Check className="h-3 w-3 text-emerald-500"/>
 ) : (
 <Copy className="h-3 w-3"/>
 )}
 </button>
 {canManage && (
 <button
 onClick={() => handleUsePreset(preset)}
 className="rounded p-1 text-dash-text-muted transition hover:bg-purple-50 dark:hover:bg-purple-950 hover:text-purple-600"
 title="Use as named transform"
 >
 <Plus className="h-3 w-3"/>
 </button>
 )}
 </div>
 </div>
 <p className="mb-2 text-[11px] text-dash-text2 leading-relaxed">
 {preset.description}
 </p>
 <code className="block rounded bg-dash-muted px-2 py-1.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400 break-all">
 {preset.transform}
 </code>
 <div className="mt-2 flex flex-wrap gap-1">
 {preset.tags.map((tag) => (
 <span
 key={tag}
 className="rounded-full bg-dash-muted px-1.5 py-0.5 text-[9px] text-dash-text2"
 >
 {tag}
 </span>
 ))}
 </div>
 </div>
 ))}
 </div>
 </div>

 {/* ─── Create / Edit Dialog ────────────────────────────── */}
 {dialogOpen && (
 <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
 <div className="mx-4 w-full max-w-md rounded-2xl bg-dash-surface p-6 shadow-2xl">
 <div className="mb-4 flex items-center justify-between">
 <h2 className="text-sm font-bold text-dash-text">
 {editing ? 'Edit Transform' : 'New Named Transform'}
 </h2>
 <button
 onClick={closeDialog}
 className="rounded p-1 text-dash-text-muted transition hover:bg-dash-surface-hover"
 >
 <X className="h-4 w-4"/>
 </button>
 </div>

 <div className="space-y-3">
 <div>
 <label className="mb-1 block text-[10px] font-medium text-dash-text2">
 Name
 </label>
 <input
 value={formName}
 onChange={(e) => setFormName(e.target.value)}
 placeholder="e.g. thumbnail, hero-banner, og-image"
 className="w-full rounded-lg border border-dash-input-border bg-transparent px-3 py-2 text-sm text-dash-text outline-none focus:border-primary dark:focus:border-primary"
 />
 <p className="mt-0.5 text-[9px] text-dash-text-muted">
 Letters, numbers, hyphens, underscores only
 </p>
 </div>

 <div>
 <label className="mb-1 block text-[10px] font-medium text-dash-text2">
 Transform String
 </label>
 <div className="flex gap-1.5">
 <input
 value={formTransforms}
 onChange={(e) => setFormTransforms(e.target.value)}
 placeholder="e.g. w-300,h-300,c-cover,q-80,f-webp"
 className="flex-1 rounded-lg border border-dash-input-border bg-transparent px-3 py-2 font-mono text-sm text-dash-text outline-none focus:border-primary dark:focus:border-primary"
 />
 <button
 type="button"
 onClick={() => {
 const desc = formDescription || formName;
 if (desc) {
 setAiPrompt(desc);
 handleAiGenerate();
 }
 }}
 disabled={aiLoading || (!formDescription && !formName)}
 className="flex shrink-0 items-center gap-1 rounded-lg border border-purple-200 dark:border-purple-700 bg-purple-50 dark:bg-purple-950/50 px-2.5 py-2 text-[10px] font-medium text-purple-600 dark:text-purple-400 transition hover:bg-purple-100 dark:hover:bg-purple-900 disabled:opacity-40 disabled:cursor-not-allowed"
 title="Generate from name/description using AI"
 >
 {aiLoading ? (
 <Loader2 className="h-3 w-3 animate-spin"/>
 ) : (
 <Sparkles className="h-3 w-3"/>
 )}
 AI
 </button>
 </div>
 <p className="mt-0.5 text-[9px] text-dash-text-muted">
 Comma-separated params. Use colon for multi-step pipelines.
 </p>
 </div>

 <div>
 <label className="mb-1 block text-[10px] font-medium text-dash-text2">
 Description (optional)
 </label>
 <input
 value={formDescription}
 onChange={(e) => setFormDescription(e.target.value)}
 placeholder="e.g. Small thumbnail for grid display"
 className="w-full rounded-lg border border-dash-input-border bg-transparent px-3 py-2 text-sm text-dash-text outline-none focus:border-primary dark:focus:border-primary"
 />
 </div>
 </div>

 {formError && (
 <p className="mt-3 flex items-center gap-1 text-xs text-red-600">
 <AlertCircle className="h-3 w-3"/>
 {formError}
 </p>
 )}

 {/* URL preview */}
 {formName && formTransforms && (
 <div className="mt-3 rounded-md bg-dash-inverted px-3 py-2">
 <p className="mb-0.5 text-[8px] font-medium text-dash-text-muted uppercase tracking-wide">
 Usage
 </p>
 <code className="block break-all text-[10px] text-emerald-400">
 /api/transform/{orgSlug}/n-{formName}/{'{storageKey}'}
 </code>
 </div>
 )}

 <div className="mt-4 flex gap-2">
 <button
 onClick={handleSave}
 disabled={saving}
 className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[var(--im-primary)] py-2.5 text-xs font-semibold text-[var(--im-primary-fg)] transition hover:bg-[var(--im-primary)]/90 disabled:opacity-50"
 >
 {saving ? (
 <Loader2 className="h-3 w-3 animate-spin"/>
 ) : (
 <>{editing ? 'Update' : 'Create'}</>
 )}
 </button>
 <button
 onClick={closeDialog}
 className="rounded-lg border border-dash-input-border px-4 py-2.5 text-xs font-medium text-dash-text2 transition hover:border-dash-border-hover"
 >
 Cancel
 </button>
 </div>
 </div>
 </div>
 )}
 </div>
 );
}
