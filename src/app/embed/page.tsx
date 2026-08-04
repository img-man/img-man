// SPDX-License-Identifier: Apache-2.0
'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
 notifyReady,
 notifyAssetSelected,
 notifyAssetsConfirmed,
 notifyUploadComplete,
 notifyError,
 onParentCommand,
} from '@/lib/embed/messaging';

interface EmbedAsset {
 _id: string;
 name: string;
 mimeType: string;
 width: number;
 height: number;
 sizeBytes: number;
 thumbnailBase64?: string;
 url?: string;
}

/**
 * /embed — Embeddable, chromeless asset picker/uploader.
 *
 * URL Params:
 * - orgSlug (required) — organization slug
 * - apiKey (required) — API key for auth
 * - mode — "picker" | "uploader" | "full" (default: "full")
 * - maxFiles — max selection count (default: 1)
 * - accept — MIME filter (default: "image/*")
 * - theme — "dark" | "light" (default: "light")
 * - accentColor — hex color without # (default: "3B82F6")
 * - hideUpload — "true" to hide upload (default: "false")
 */

export default function EmbedPage() {
 return (
 <Suspense
 fallback={
 <div className="flex h-screen w-screen items-center justify-center">
 <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
 </div>
 }
 >
 <EmbedContent />
 </Suspense>
 );
}

function EmbedContent() {
 const searchParams = useSearchParams();
 const orgSlug = searchParams.get('orgSlug') ?? '';
 const apiKey = searchParams.get('apiKey') ?? '';
 const mode = (searchParams.get('mode') ?? 'full') as 'picker' | 'uploader' | 'full';
 const maxFiles = Math.max(1, Number(searchParams.get('maxFiles')) || 1);
 const accept = searchParams.get('accept') ?? 'image/*';
 const theme = (searchParams.get('theme') ?? 'light') as 'dark' | 'light';
 const accentColor = `#${searchParams.get('accentColor') ?? '3B82F6'}`;
 const hideUpload = searchParams.get('hideUpload') === 'true';

 const [assets, setAssets] = useState<EmbedAsset[]>([]);
 const [selected, setSelected] = useState<Set<string>>(new Set());
 const [loading, setLoading] = useState(true);
 const [searchQuery, setSearchQuery] = useState('');
 const [page, setPage] = useState(1);
 const [totalPages, setTotalPages] = useState(1);
 const [uploading, setUploading] = useState(false);
 const [error, setError] = useState<string | null>(null);
 const fileInputRef = useRef<HTMLInputElement>(null);

 const isDark = theme === 'dark';
 const bg = isDark ? '#18181b' : '#ffffff';
 const cardBg = isDark ? '#27272a' : '#f4f4f5';
 const textColor = isDark ? '#fafafa' : '#18181b';
 const mutedColor = isDark ? '#a1a1aa' : '#71717a';
 const borderColor = isDark ? '#3f3f46' : '#e4e4e7';

 // ─── Fetch assets from public API ─────────────────────────────
 const fetchAssets = useCallback(async () => {
 if (!apiKey) {
 setError('Missing API key');
 setLoading(false);
 return;
 }
 setLoading(true);
 try {
 const params = new URLSearchParams({
 page: String(page),
 limit: '24',
 });
 if (searchQuery) params.set('q', searchQuery);
 if (accept && accept !== '*') params.set('mimeType', accept.split('/')[0]);

 const res = await fetch(`/api/v1/assets?${params}`, {
 headers: { Authorization: `Bearer ${apiKey}` },
 });
 if (!res.ok) {
 const data = await res.json();
 throw new Error(data.error ?? 'Failed to load assets');
 }
 const data = await res.json();
 setAssets(data.assets);
 setTotalPages(Math.ceil(data.total / 24) || 1);
 setError(null);
 } catch (err: unknown) {
 const msg = err instanceof Error ? err.message : 'Failed to load assets';
 setError(msg);
 notifyError('LOAD_FAILED', msg);
 } finally {
 setLoading(false);
 }
 }, [apiKey, page, searchQuery, accept]);

 useEffect(() => {
 fetchAssets();
 }, [fetchAssets]);

 // ─── postMessage lifecycle ────────────────────────────────────
 useEffect(() => {
 notifyReady();
 const unsub = onParentCommand((cmd) => {
 if (cmd.type === 'imageman:close') {
 // Could hide or post close acknowledgment
 }
 });
 return unsub;
 }, []);

 // ─── Selection ────────────────────────────────────────────────
 const toggleSelect = (asset: EmbedAsset) => {
 setSelected((prev) => {
 const next = new Set(prev);
 if (next.has(asset._id)) {
 next.delete(asset._id);
 } else {
 if (next.size >= maxFiles) {
 // If single-select, replace
 if (maxFiles === 1) next.clear();
 else return prev;
 }
 next.add(asset._id);
 }
 return next;
 });

 // Notify parent on each selection change
 const assetPayload = {
 id: asset._id,
 url: asset.url ?? '',
 name: asset.name,
 mimeType: asset.mimeType,
 width: asset.width,
 height: asset.height,
 };
 notifyAssetSelected(assetPayload);
 };

 const handleConfirm = () => {
 const confirmed = assets
 .filter((a) => selected.has(a._id))
 .map((a) => ({
 id: a._id,
 url: a.url ?? '',
 name: a.name,
 mimeType: a.mimeType,
 width: a.width,
 height: a.height,
 }));
 notifyAssetsConfirmed(confirmed);
 };

 // ─── Upload ───────────────────────────────────────────────────
 const handleUpload = async (files: FileList | null) => {
 if (!files || files.length === 0 || !apiKey) return;
 setUploading(true);
 try {
 for (const file of Array.from(files)) {
 // 1. Get signed URL
 const signRes = await fetch('/api/v1/upload/signed-url', {
 method: 'POST',
 headers: {
 Authorization: `Bearer ${apiKey}`,
 'Content-Type': 'application/json',
 },
 body: JSON.stringify({
 fileName: file.name,
 contentType: file.type,
 sizeBytes: file.size,
 }),
 });
 if (!signRes.ok) throw new Error('Failed to get upload URL');
 const { uploadUrl, assetId, url, publicUrl } = await signRes.json();

 // 2. Upload to GCS
 await fetch(uploadUrl, {
 method: 'PUT',
 headers: { 'Content-Type': file.type },
 body: file,
 });

 notifyUploadComplete({ id: assetId, url: publicUrl || url || '', name: file.name });
 }

 // Refresh grid
 await fetchAssets();
 } catch (err: unknown) {
 const msg = err instanceof Error ? err.message : 'Upload failed';
 setError(msg);
 notifyError('UPLOAD_FAILED', msg);
 } finally {
 setUploading(false);
 }
 };

 // ─── Render ───────────────────────────────────────────────────
 const showPicker = mode === 'picker' || mode === 'full';
 const showUploader = (mode === 'uploader' || mode === 'full') && !hideUpload;

 return (
 <div
 style={{
 background: bg,
 color: textColor,
 height: '100vh',
 display: 'flex',
 flexDirection: 'column',
 fontFamily: 'inherit',
 }}
 >
 {/* ─── Header bar ──────────────────────────────────────── */}
 <div
 style={{
 padding: '8px 12px',
 borderBottom: `1px solid ${borderColor}`,
 display: 'flex',
 gap: 8,
 alignItems: 'center',
 flexShrink: 0,
 }}
 >
 {showPicker && (
 <input
 type="text"
 placeholder="Search assets…"
 value={searchQuery}
 onChange={(e) => {
 setSearchQuery(e.target.value);
 setPage(1);
 }}
 style={{
 flex: 1,
 padding: '6px 10px',
 borderRadius: 6,
 border: `1px solid ${borderColor}`,
 background: cardBg,
 color: textColor,
 fontSize: 13,
 outline: 'none',
 }}
 />
 )}

 {showUploader && (
 <>
 <input
 ref={fileInputRef}
 type="file"
 accept={accept}
 multiple={maxFiles > 1}
 onChange={(e) => handleUpload(e.target.files)}
 style={{ display: 'none' }}
 />
 <button
 onClick={() => fileInputRef.current?.click()}
 disabled={uploading}
 style={{
 padding: '6px 14px',
 borderRadius: 6,
 background: accentColor,
 color: '#fff',
 border: 'none',
 fontSize: 13,
 fontWeight: 600,
 cursor: uploading ? 'wait' : 'pointer',
 opacity: uploading ? 0.6 : 1,
 whiteSpace: 'nowrap',
 }}
 >
 {uploading ? 'Uploading…' : 'Upload'}
 </button>
 </>
 )}
 </div>

 {/* ─── Error banner ────────────────────────────────────── */}
 {error && (
 <div
 style={{
 padding: '6px 12px',
 background: '#fef2f2',
 color: '#b91c1c',
 fontSize: 12,
 borderBottom: '1px solid #fecaca',
 }}
 >
 {error}
 </div>
 )}

 {/* ─── Asset Grid ──────────────────────────────────────── */}
 {showPicker && (
 <div style={{ flex: 1, overflow: 'auto', padding: 8 }}>
 {loading ? (
 <div
 style={{
 display: 'flex',
 justifyContent: 'center',
 alignItems: 'center',
 height: '100%',
 color: mutedColor,
 fontSize: 13,
 }}
 >
 Loading assets…
 </div>
 ) : assets.length === 0 ? (
 <div
 style={{
 display: 'flex',
 justifyContent: 'center',
 alignItems: 'center',
 height: '100%',
 color: mutedColor,
 fontSize: 13,
 }}
 >
 No assets found
 </div>
 ) : (
 <div
 style={{
 display: 'grid',
 gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
 gap: 6,
 }}
 >
 {assets.map((asset) => {
 const isSelected = selected.has(asset._id);
 return (
 <button
 key={asset._id}
 onClick={() => toggleSelect(asset)}
 style={{
 position: 'relative',
 aspectRatio: '1',
 borderRadius: 6,
 border: isSelected
 ? `2px solid ${accentColor}`
 : `1px solid ${borderColor}`,
 background: cardBg,
 overflow: 'hidden',
 cursor: 'pointer',
 padding: 0,
 outline: 'none',
 transition: 'border-color 0.15s',
 }}
 >
 {asset.thumbnailBase64 ? (
 // eslint-disable-next-line @next/next/no-img-element
 <img
 src={asset.thumbnailBase64}
 alt={asset.name}
 style={{
 width: '100%',
 height: '100%',
 objectFit: 'cover',
 }}
 />
 ) : (
 <div
 style={{
 width: '100%',
 height: '100%',
 display: 'flex',
 alignItems: 'center',
 justifyContent: 'center',
 fontSize: 10,
 color: mutedColor,
 padding: 4,
 textAlign: 'center',
 wordBreak: 'break-all',
 }}
 >
 {asset.name}
 </div>
 )}
 {isSelected && (
 <div
 style={{
 position: 'absolute',
 top: 4,
 right: 4,
 width: 18,
 height: 18,
 borderRadius: '50%',
 background: accentColor,
 display: 'flex',
 alignItems: 'center',
 justifyContent: 'center',
 }}
 >
 <svg
 width="12"
 height="12"
 viewBox="0 0 24 24"
 fill="none"
 stroke="#fff"
 strokeWidth="3"
 >
 <polyline points="20 6 9 17 4 12" />
 </svg>
 </div>
 )}
 </button>
 );
 })}
 </div>
 )}
 </div>
 )}

 {/* Upload-only mode body */}
 {mode === 'uploader' && (
 <div
 style={{
 flex: 1,
 display: 'flex',
 alignItems: 'center',
 justifyContent: 'center',
 padding: 24,
 }}
 >
 <div
 onDragOver={(e) => {
 e.preventDefault();
 e.stopPropagation();
 }}
 onDrop={(e) => {
 e.preventDefault();
 e.stopPropagation();
 handleUpload(e.dataTransfer.files);
 }}
 onClick={() => fileInputRef.current?.click()}
 style={{
 width: '100%',
 maxWidth: 400,
 padding: 40,
 border: `2px dashed ${borderColor}`,
 borderRadius: 12,
 textAlign: 'center',
 cursor: 'pointer',
 color: mutedColor,
 fontSize: 14,
 }}
 >
 <div style={{ fontSize: 32, marginBottom: 8 }}>📁</div>
 <div style={{ fontWeight: 600, color: textColor, marginBottom: 4 }}>
 Drop files here or click to browse
 </div>
 <div style={{ fontSize: 12 }}>
 {accept === '*' ? 'All file types' : accept}
 </div>
 </div>
 </div>
 )}

 {/* ─── Footer (confirm + pagination) ───────────────────── */}
 <div
 style={{
 padding: '8px 12px',
 borderTop: `1px solid ${borderColor}`,
 display: 'flex',
 justifyContent: 'space-between',
 alignItems: 'center',
 flexShrink: 0,
 fontSize: 12,
 color: mutedColor,
 }}
 >
 {/* Pagination */}
 {showPicker && totalPages > 1 && (
 <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
 <button
 onClick={() => setPage((p) => Math.max(1, p - 1))}
 disabled={page === 1}
 style={{
 padding: '3px 8px',
 borderRadius: 4,
 border: `1px solid ${borderColor}`,
 background: cardBg,
 color: textColor,
 cursor: page === 1 ? 'not-allowed' : 'pointer',
 opacity: page === 1 ? 0.4 : 1,
 fontSize: 11,
 }}
 >
 ←
 </button>
 <span>
 {page} / {totalPages}
 </span>
 <button
 onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
 disabled={page === totalPages}
 style={{
 padding: '3px 8px',
 borderRadius: 4,
 border: `1px solid ${borderColor}`,
 background: cardBg,
 color: textColor,
 cursor: page === totalPages ? 'not-allowed' : 'pointer',
 opacity: page === totalPages ? 0.4 : 1,
 fontSize: 11,
 }}
 >
 →
 </button>
 </div>
 )}

 {/* Selection info + Confirm */}
 {showPicker && (
 <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
 {selected.size > 0 && (
 <span>
 {selected.size} selected
 {maxFiles > 1 ? ` / ${maxFiles} max` : ''}
 </span>
 )}
 <button
 onClick={handleConfirm}
 disabled={selected.size === 0}
 style={{
 padding: '5px 16px',
 borderRadius: 6,
 background: selected.size > 0 ? accentColor : borderColor,
 color: '#fff',
 border: 'none',
 fontSize: 13,
 fontWeight: 600,
 cursor: selected.size === 0 ? 'not-allowed' : 'pointer',
 }}
 >
 Confirm
 </button>
 </div>
 )}
 </div>
 </div>
 );
}
