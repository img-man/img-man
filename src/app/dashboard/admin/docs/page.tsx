// SPDX-License-Identifier: Apache-2.0
'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
 BookOpen,
 Plus,
 Pencil,
 Trash2,
 Eye,
 EyeOff,
 Save,
 X,
 Loader2,
 RefreshCw,
 ArrowLeft,
 AlertCircle,
 CheckCircle2,
} from 'lucide-react';
import { useRole } from '@/components/dashboard/role-context';

/* ─── Types ──────────────────────────────────────────── */

interface DocItem {
 _id: string;
 title: string;
 slug: string;
 content: string;
 category: string;
 order: number;
 published: boolean;
 updatedAt: string;
}

/* ─── Component ──────────────────────────────────────── */

export default function AdminDocsPage() {
 const [docs, setDocs] = useState<DocItem[]>([]);
 const [loading, setLoading] = useState(true);
 const [saving, setSaving] = useState(false);
 const [error, setError] = useState<string | null>(null);
 const [success, setSuccess] = useState<string | null>(null);
 const { role } = useRole();

 // Editor state
 const [editing, setEditing] = useState<string | null>(null); // _id or 'new'
 const [editTitle, setEditTitle] = useState('');
 const [editContent, setEditContent] = useState('');
 const [editCategory, setEditCategory] = useState('General');
 const [editPublished, setEditPublished] = useState(false);

 const fetchDocs = useCallback(async () => {
 setLoading(true);
 try {
 const res = await fetch('/api/docs?all=true');
 if (res.ok) {
 const data = await res.json();
 setDocs(data.docs ?? []);
 }
 } catch {
 // Error handling
 } finally {
 setLoading(false);
 }
 }, []);

 useEffect(() => {
 fetchDocs();
 }, [fetchDocs]);

 const startCreate = () => {
 setEditing('new');
 setEditTitle('');
 setEditContent('');
 setEditCategory('General');
 setEditPublished(false);
 };

 const startEdit = (doc: DocItem) => {
 setEditing(doc._id);
 setEditTitle(doc.title);
 setEditContent(doc.content);
 setEditCategory(doc.category);
 setEditPublished(doc.published);
 };

 const cancelEdit = () => {
 setEditing(null);
 setError(null);
 };

 const handleSave = useCallback(async () => {
 if (!editTitle.trim()) {
 setError('Title is required');
 return;
 }

 setSaving(true);
 setError(null);
 setSuccess(null);

 try {
 const body = {
 title: editTitle.trim(),
 content: editContent,
 category: editCategory.trim() || 'General',
 published: editPublished,
 };

 const isNew = editing === 'new';
 const url = isNew ? '/api/docs' : `/api/docs/${editing}`;
 const method = isNew ? 'POST' : 'PATCH';

 const res = await fetch(url, {
 method,
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify(body),
 });

 const data = await res.json();
 if (!res.ok) throw new Error(data.error || 'Failed to save');

 setSuccess(isNew ? 'Doc created successfully' : 'Doc updated successfully');
 setTimeout(() => setSuccess(null), 3000);
 setEditing(null);
 fetchDocs();
 } catch (err) {
 setError(err instanceof Error ? err.message : 'Failed to save');
 } finally {
 setSaving(false);
 }
 }, [editing, editTitle, editContent, editCategory, editPublished, fetchDocs]);

 const handleDelete = useCallback(
 async (id: string) => {
 if (!confirm('Delete this doc? This cannot be undone.')) return;
 try {
 const res = await fetch(`/api/docs/${id}`, { method: 'DELETE' });
 if (res.ok) {
 setSuccess('Doc deleted');
 setTimeout(() => setSuccess(null), 3000);
 fetchDocs();
 }
 } catch {
 // Error handling
 }
 },
 [fetchDocs],
 );

 const togglePublish = useCallback(
 async (doc: DocItem) => {
 try {
 const res = await fetch(`/api/docs/${doc._id}`, {
 method: 'PATCH',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ published: !doc.published }),
 });
 if (res.ok) fetchDocs();
 } catch {
 // Error handling
 }
 },
 [fetchDocs],
 );

 if (!['owner', 'admin'].includes(role)) {
 return (
 <div className="flex h-full items-center justify-center">
 <p className="text-sm text-dash-text2">Access restricted</p>
 </div>
 );
 }

 if (loading) {
 return (
 <div className="flex h-full items-center justify-center">
 <RefreshCw className="h-8 w-8 animate-spin text-dash-text-muted"/>
 </div>
 );
 }

 return (
 <div className="mx-auto max-w-4xl space-y-6 p-6 pb-12">
 {/* Header */}
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-3">
 <Link
 href="/dashboard/admin"
 className="flex h-8 w-8 items-center justify-center rounded-lg border border-dash-border text-dash-text2 hover:bg-dash-surface-hover"
 >
 <ArrowLeft className="h-4 w-4"/>
 </Link>
 <div>
 <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-dash-text">
 <BookOpen className="h-5 w-5 text-[var(--im-primary)]"/>
 Manage Docs
 </h1>
 <p className="text-xs text-dash-text2">
 Create and edit knowledge base articles for your team.
 </p>
 </div>
 </div>
 {!editing && (
 <button
 onClick={startCreate}
 className="flex items-center gap-2 rounded-lg bg-[var(--im-primary)] px-4 py-2 text-xs font-medium text-[var(--im-primary-fg)] hover:opacity-90"
 >
 <Plus className="h-3.5 w-3.5"/>
 New Article
 </button>
 )}
 </div>

 {/* Feedback */}
 {error && (
 <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 dark:bg-red-950 px-4 py-3 text-sm text-red-700 dark:text-red-300">
 <AlertCircle className="h-4 w-4 shrink-0"/>
 {error}
 </div>
 )}
 {success && (
 <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-950 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
 <CheckCircle2 className="h-4 w-4 shrink-0"/>
 {success}
 </div>
 )}

 {/* Editor */}
 {editing && (
 <div className="rounded-xl border border-dash-border bg-dash-surface p-6 space-y-4">
 <div className="flex items-center justify-between">
 <h2 className="text-sm font-semibold text-dash-text2 ">
 {editing === 'new' ? 'New Article' : 'Edit Article'}
 </h2>
 <button onClick={cancelEdit} className="text-dash-text-muted hover:text-dash-text">
 <X className="h-4 w-4"/>
 </button>
 </div>

 <div className="grid gap-4 sm:grid-cols-2">
 <div>
 <label className="block text-xs text-dash-text2">Title *</label>
 <input
 type="text"
 value={editTitle}
 onChange={(e) => setEditTitle(e.target.value)}
 placeholder="Article title"
 className="mt-1 w-full rounded-lg border border-dash-border bg-dash-surface2 px-3 py-2 text-sm text-dash-text placeholder:text-dash-text-muted focus:border-[var(--im-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--im-primary)]"
 />
 </div>
 <div>
 <label className="block text-xs text-dash-text2">Category</label>
 <input
 type="text"
 value={editCategory}
 onChange={(e) => setEditCategory(e.target.value)}
 placeholder="General"
 className="mt-1 w-full rounded-lg border border-dash-border bg-dash-surface2 px-3 py-2 text-sm text-dash-text placeholder:text-dash-text-muted focus:border-[var(--im-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--im-primary)]"
 />
 </div>
 </div>

 <div>
 <label className="block text-xs text-dash-text2">
 Content (Markdown supported)
 </label>
 <textarea
 value={editContent}
 onChange={(e) => setEditContent(e.target.value)}
 placeholder="Write your article content in Markdown..."
 rows={16}
 className="mt-1 w-full rounded-lg border border-dash-border bg-dash-surface2 px-3 py-2 font-mono text-sm text-dash-text placeholder:text-dash-text-muted focus:border-[var(--im-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--im-primary)]"
 />
 </div>

 <div className="flex items-center justify-between">
 <label className="flex items-center gap-2 text-xs text-dash-text2 dark:text-dash-text-muted">
 <input
 type="checkbox"
 checked={editPublished}
 onChange={(e) => setEditPublished(e.target.checked)}
 className="h-3.5 w-3.5 rounded border-dash-border accent-[var(--im-primary)]"
 />
 Publish immediately
 </label>

 <div className="flex gap-2">
 <button
 onClick={cancelEdit}
 className="rounded-lg border border-dash-border px-4 py-2 text-xs font-medium text-dash-text2 hover:bg-dash-surface-hover"
 >
 Cancel
 </button>
 <button
 onClick={handleSave}
 disabled={saving}
 className="flex items-center gap-1.5 rounded-lg bg-[var(--im-primary)] px-4 py-2 text-xs font-medium text-[var(--im-primary-fg)] hover:opacity-90 disabled:opacity-50"
 >
 {saving ? <Loader2 className="h-3 w-3 animate-spin"/> : <Save className="h-3 w-3"/>}
 {editing === 'new' ? 'Create' : 'Update'}
 </button>
 </div>
 </div>
 </div>
 )}

 {/* Doc List */}
 {docs.length === 0 && !editing ? (
 <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-dash-border py-16">
 <BookOpen className="h-10 w-10 text-dash-text-muted dark:text-dash-text2"/>
 <p className="mt-3 text-sm text-dash-text2">
 No documentation articles yet
 </p>
 <button
 onClick={startCreate}
 className="mt-3 text-sm font-medium text-[var(--im-primary)] hover:underline"
 >
 Create your first article
 </button>
 </div>
 ) : (
 <div className="space-y-2">
 {docs.map((doc) => (
 <div
 key={doc._id}
 className="group flex items-center gap-4 rounded-xl border border-dash-border bg-dash-surface p-4 transition hover:border-dash-border "
 >
 <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${doc.published ? 'bg-emerald-50 dark:bg-emerald-950' : 'bg-dash-muted'}`}>
 <BookOpen className={`h-4 w-4 ${doc.published ? 'text-emerald-500' : 'text-dash-text-muted'}`} />
 </div>

 <div className="min-w-0 flex-1">
 <div className="flex items-center gap-2">
 <span className="text-sm font-medium text-dash-text">{doc.title}</span>
 <span className="rounded-full bg-dash-muted px-2 py-0.5 text-[10px] text-dash-text2">
 {doc.category}
 </span>
 {!doc.published && (
 <span className="rounded-full bg-amber-100 dark:bg-amber-900 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
 Draft
 </span>
 )}
 </div>
 <p className="text-[11px] text-dash-text-muted">
 /{doc.slug} · Updated {new Date(doc.updatedAt).toLocaleDateString()}
 </p>
 </div>

 <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
 <button
 onClick={() => togglePublish(doc)}
 className="rounded-md p-1.5 text-dash-text-muted hover:bg-dash-surface-hover hover:text-dash-text"
 title={doc.published ? 'Unpublish' : 'Publish'}
 >
 {doc.published ? <EyeOff className="h-3.5 w-3.5"/> : <Eye className="h-3.5 w-3.5"/>}
 </button>
 <button
 onClick={() => startEdit(doc)}
 className="rounded-md p-1.5 text-dash-text-muted hover:bg-dash-surface-hover hover:text-dash-text"
 title="Edit"
 >
 <Pencil className="h-3.5 w-3.5"/>
 </button>
 <Link
 href={`/dashboard/docs/${doc.slug}`}
 className="rounded-md p-1.5 text-dash-text-muted hover:bg-dash-surface-hover hover:text-dash-text"
 title="Preview"
 >
 <Eye className="h-3.5 w-3.5"/>
 </Link>
 <button
 onClick={() => handleDelete(doc._id)}
 className="rounded-md p-1.5 text-dash-text-muted hover:bg-red-50 dark:hover:bg-red-950 hover:text-red-500"
 title="Delete"
 >
 <Trash2 className="h-3.5 w-3.5"/>
 </button>
 </div>
 </div>
 ))}
 </div>
 )}
 </div>
 );
}
