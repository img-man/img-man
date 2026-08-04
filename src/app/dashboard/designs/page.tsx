// SPDX-License-Identifier: Apache-2.0
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
 Plus,
 Pencil,
 Trash2,
 Loader2,
 Search,
 ArrowUpRight,
} from 'lucide-react';
import { CreateDesignDialog } from '@/components/design/create-dialog';
import { useRouter } from 'next/navigation';

interface DesignItem {
 _id: string;
 name: string;
 width: number;
 height: number;
 thumbnailUrl?: string;
 createdAt: string;
 updatedAt: string;
}

const LIMIT = 20;

export default function DesignsPage() {
 const router = useRouter();
 const [designs, setDesigns] = useState<DesignItem[]>([]);
 const [loading, setLoading] = useState(true);
 const [loadingMore, setLoadingMore] = useState(false);
 const [hasMore, setHasMore] = useState(true);
 const [page, setPage] = useState(1);
 const [showCreate, setShowCreate] = useState(false);
 const [creating, setCreating] = useState(false);
 const [search, setSearch] = useState('');
 const [error, setError] = useState<string | null>(null);
 const [deleteId, setDeleteId] = useState<string | null>(null);
 const [renameId, setRenameId] = useState<string | null>(null);
 const [renameName, setRenameName] = useState('');
 const sentinelRef = useRef<HTMLDivElement>(null);
 const scrollStateRef = useRef({ hasMore, loading, loadingMore, page, error });
 scrollStateRef.current = { hasMore, loading, loadingMore, page, error };

 const fetchDesigns = useCallback(
 async (pageNum: number, append: boolean) => {
 if (append) setLoadingMore(true);
 else setLoading(true);
 setError(null);
 try {
 const params = new URLSearchParams({
 page: String(pageNum),
 limit: String(LIMIT),
 });
 if (search) params.set('q', search);
 const res = await fetch(`/api/designs?${params}`);
 if (res.ok) {
 const data = await res.json();
 const newDesigns: DesignItem[] = data.designs ?? [];
 if (append) {
 setDesigns((prev) => [...prev, ...newDesigns]);
 } else {
 setDesigns(newDesigns);
 }
 setHasMore(pageNum < (data.totalPages ?? 1));
 } else {
 const data = await res.json().catch(() => null);
 const msg = data?.error || `Failed to load designs (${res.status})`;
 setHasMore(false);
 if (!append) setError(msg);
 }
 } catch (err) {
 console.error('Failed to fetch designs:', err);
 setHasMore(false);
 if (!append) setError('Network error — could not reach the server');
 } finally {
 setLoading(false);
 setLoadingMore(false);
 }
 },
 [search],
 );

 // Reset on search change
 useEffect(() => {
 setDesigns([]);
 setPage(1);
 setHasMore(true);
 fetchDesigns(1, false);
 }, [fetchDesigns]);

 // Infinite scroll observer — uses ref to avoid recreating observer on every state change
 useEffect(() => {
 if (!sentinelRef.current) return;
 const observer = new IntersectionObserver(
 (entries) => {
 const { hasMore, loading, loadingMore, page, error } =
 scrollStateRef.current;
 if (
 entries[0].isIntersecting &&
 hasMore &&
 !loading &&
 !loadingMore &&
 !error
 ) {
 const next = page + 1;
 setPage(next);
 fetchDesigns(next, true);
 }
 },
 { rootMargin: '200px' },
 );
 observer.observe(sentinelRef.current);
 return () => observer.disconnect();
 }, [fetchDesigns]);

 const handleCreate = async (name: string, width: number, height: number) => {
 setCreating(true);
 try {
 const res = await fetch('/api/designs', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ name, width, height }),
 });
 if (res.ok) {
 const { design } = await res.json();
 router.push(`/dashboard/designs/${design._id}`);
 } else {
 const data = await res.json().catch(() => null);
 setError(data?.error || `Failed to create design (${res.status})`);
 setShowCreate(false);
 }
 } catch (err) {
 console.error('Failed to create design:', err);
 setError('Network error — could not create design');
 setShowCreate(false);
 } finally {
 setCreating(false);
 }
 };

 const handleDelete = async (id: string) => {
 try {
 await fetch(`/api/designs/${id}`, { method: 'DELETE' });
 setDesigns((prev) => prev.filter((d) => d._id !== id));
 } catch (err) {
 console.error('Delete failed:', err);
 } finally {
 setDeleteId(null);
 }
 };

 const handleRename = async () => {
 if (!renameId || !renameName.trim()) return;
 try {
 const res = await fetch(`/api/designs/${renameId}`, {
 method: 'PATCH',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ name: renameName.trim() }),
 });
 if (res.ok) {
 const { design } = await res.json();
 setDesigns((prev) =>
 prev.map((d) =>
 d._id === renameId ? { ...d, name: design.name } : d,
 ),
 );
 }
 } catch (err) {
 console.error('Rename failed:', err);
 } finally {
 setRenameId(null);
 setRenameName('');
 }
 };

 const formatDate = (dateStr: string) => {
 return new Date(dateStr).toLocaleDateString('en-US', {
 month: 'short',
 day: 'numeric',
 year: 'numeric',
 });
 };

 return (
 <div className="p-6">
 {/* Header */}
 <div className="mb-6 flex items-center justify-between">
 <div>
 <h1 className="text-xl font-semibold text-dash-text">
 Designs
 </h1>
 <p className="mt-0.5 text-sm text-dash-text2">
 Create and manage your graphic designs
 </p>
 </div>
 <button
 onClick={() => setShowCreate(true)}
 className="flex items-center gap-2 rounded-xl bg-[var(--im-primary)] px-4 py-2.5 text-sm font-medium text-[var(--im-primary-fg)] shadow-sm hover:bg-[var(--im-primary)]/90 transition-colors"
 >
 <Plus className="h-4 w-4"/>
 New design
 </button>
 </div>

 {/* Search */}
 <div className="relative mb-5 max-w-md">
 <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dash-text-muted"/>
 <input
 type="text"
 value={search}
 onChange={(e) => setSearch(e.target.value)}
 placeholder="Search designs..."
 className="w-full rounded-xl border border-dash-border bg-dash-muted dark:bg-dash-deep py-2.5 pl-10 pr-4 text-sm outline-none focus:border-[var(--im-primary)] focus:ring-2 focus:ring-[var(--im-primary)]/20 text-dash-text"
 />
 </div>

 {/* Loading */}
 {loading && (
 <div className="flex items-center justify-center py-20">
 <Loader2 className="h-6 w-6 animate-spin text-[var(--im-primary)]"/>
 </div>
 )}

 {/* Error state */}
 {!loading && error && (
 <div className="flex flex-col items-center justify-center rounded-2xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 py-12">
 <p className="text-sm font-medium text-red-700 dark:text-red-400">
 {error}
 </p>
 <button
 onClick={() => {
 setPage(1);
 setHasMore(true);
 fetchDesigns(1, false);
 }}
 className="mt-3 rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors"
 >
 Retry
 </button>
 </div>
 )}

 {/* Empty state */}
 {!loading && !error && designs.length === 0 && (
 <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-dash-border py-20">
 <div className="mb-4 rounded-full bg-[var(--im-primary-light)] p-4">
 <Plus className="h-8 w-8 text-[var(--im-primary)]"/>
 </div>
 <h3 className="text-base font-medium text-dash-text2 dark:text-dash-text-muted">
 {search ? 'No designs found' : 'No designs yet'}
 </h3>
 <p className="mt-1 text-sm text-dash-text-muted">
 {search
 ? 'Try a different search term'
 : 'Create your first design to get started'}
 </p>
 {!search && (
 <button
 onClick={() => setShowCreate(true)}
 className="mt-4 rounded-xl bg-[var(--im-primary)] px-5 py-2 text-sm font-medium text-[var(--im-primary-fg)] hover:bg-[var(--im-primary)]/90 transition-colors"
 >
 Create design
 </button>
 )}
 </div>
 )}

 {/* Design grid */}
 {!loading && designs.length > 0 && (
 <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
 {designs.map((design) => (
 <div
 key={design._id}
 className="group relative rounded-2xl border border-dash-border bg-dash-surface p-3 transition-all hover:border-[var(--im-primary)]/40 hover:shadow-lg"
 >
 {/* Thumbnail */}
 <button
 onClick={() => router.push(`/dashboard/designs/${design._id}`)}
 className="relative mb-3 block w-full overflow-hidden rounded-xl bg-dash-muted"
 >
 <div
 className="flex items-center justify-center"
 style={{
 aspectRatio: `${design.width}/${design.height}`,
 maxHeight: '160px',
 }}
 >
 {design.thumbnailUrl ? (
 // eslint-disable-next-line @next/next/no-img-element
 <img
 src={design.thumbnailUrl}
 alt={design.name}
 className="h-full w-full object-cover"
 />
 ) : (
 <div className="flex flex-col items-center gap-1 text-dash-text-muted">
 <div className="text-3xl">🎨</div>
 <span className="text-[10px]">
 {design.width}×{design.height}
 </span>
 </div>
 )}
 </div>

 {/* Hover overlay */}
 <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/10">
 <ArrowUpRight className="h-6 w-6 text-white opacity-0 transition-opacity group-hover:opacity-100"/>
 </div>
 </button>

 {/* Info */}
 <div className="flex items-start justify-between">
 <div className="min-w-0 flex-1">
 {renameId === design._id ? (
 <input
 autoFocus
 value={renameName}
 onChange={(e) => setRenameName(e.target.value)}
 onBlur={handleRename}
 onKeyDown={(e) => {
 if (e.key === 'Enter') handleRename();
 if (e.key === 'Escape') {
 setRenameId(null);
 setRenameName('');
 }
 }}
 className="w-full rounded border border-[var(--im-primary)] bg-transparent px-1.5 py-0.5 text-sm outline-none text-dash-text"
 />
 ) : (
 <h4 className="truncate text-sm font-medium text-dash-text ">
 {design.name}
 </h4>
 )}
 <p className="text-[11px] text-dash-text-muted">
 {formatDate(design.updatedAt || design.createdAt)}
 </p>
 </div>

 {/* Actions */}
 <div className="ml-2 flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
 <button
 onClick={(e) => {
 e.stopPropagation();
 setRenameId(design._id);
 setRenameName(design.name);
 }}
 className="rounded-lg p-1.5 text-dash-text-muted hover:bg-dash-surface-hover hover:text-dash-text"
 title="Rename"
 >
 <Pencil className="h-3.5 w-3.5"/>
 </button>
 {deleteId === design._id ? (
 <button
 onClick={(e) => {
 e.stopPropagation();
 handleDelete(design._id);
 }}
 className="rounded-lg bg-red-500 px-2 py-1 text-[10px] font-medium text-white"
 >
 Confirm
 </button>
 ) : (
 <button
 onClick={(e) => {
 e.stopPropagation();
 setDeleteId(design._id);
 }}
 className="rounded-lg p-1.5 text-dash-text-muted hover:bg-red-50 dark:hover:bg-red-950/50 hover:text-red-500 dark:hover:text-red-400"
 title="Delete"
 >
 <Trash2 className="h-3.5 w-3.5"/>
 </button>
 )}
 </div>
 </div>
 </div>
 ))}
 </div>
 )}

 {/* Infinite scroll sentinel — always rendered so the observer ref is stable */}
 <div
 ref={sentinelRef}
 className={
 hasMore && !loading && !error
 ? 'flex justify-center py-6'
 : 'h-0 overflow-hidden'
 }
 >
 {loadingMore && (
 <div className="flex items-center gap-2 text-sm text-dash-text-muted">
 <Loader2 className="h-4 w-4 animate-spin"/>
 Loading more designs…
 </div>
 )}
 </div>

 {/* Create dialog */}
 <CreateDesignDialog
 open={showCreate}
 onClose={() => setShowCreate(false)}
 onCreate={handleCreate}
 creating={creating}
 />
 </div>
 );
}
