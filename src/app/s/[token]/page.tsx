// SPDX-License-Identifier: Apache-2.0
'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
 Download,
 Lock,
 AlertTriangle,
 Loader2,
 Folder,
 ChevronRight,
 ArrowLeft,
 Image as ImageIcon,
 Shield,
 Eye,
 Edit3,
 FileImage,
 ZoomIn,
 ZoomOut,
} from 'lucide-react';

/* ─── Types ────────────────────────────────────────────── */

interface ShareInfo {
 targetType: 'asset' | 'folder';
 targetName: string;
 targetMimeType: string;
 permission: 'view' | 'edit';
 requiresPassword: boolean;
 organization: { name: string } | null;
 includeNested: boolean;
}

interface SharedAsset {
 id: string;
 name: string;
 originalName: string;
 url?: string;
 thumbnailBase64?: string;
 mimeType: string;
 sizeBytes: number;
 width?: number;
 height?: number;
 tags: string[];
 createdAt: string;
}

interface SharedFolder {
 id: string;
 name: string;
}

/* ─── Helpers ──────────────────────────────────────────── */

function formatBytes(bytes: number): string {
 if (bytes === 0) return '0 B';
 const units = ['B', 'KB', 'MB', 'GB'];
 const i = Math.floor(Math.log(bytes) / Math.log(1024));
 return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

/* ─── Component ────────────────────────────────────────── */

export default function SharePage() {
 const params = useParams();
 const token = params.token as string;

 // States
 const [phase, setPhase] = useState<
 'loading' | 'password' | 'content' | 'error'
 >('loading');
 const [shareInfo, setShareInfo] = useState<ShareInfo | null>(null);
 const [errorMessage, setErrorMessage] = useState('');

 // Password
 const [password, setPassword] = useState('');
 const [verifying, setVerifying] = useState(false);
 const [passwordError, setPasswordError] = useState('');

 // Content
 const [assets, setAssets] = useState<SharedAsset[]>([]);
 const [folders, setFolders] = useState<SharedFolder[]>([]);
 const [currentFolder, setCurrentFolder] = useState<{
 id: string;
 name: string;
 parentId: string | null;
 } | null>(null);
 const [folderHistory, setFolderHistory] = useState<
 { id: string; name: string }[]
 >([]);
 const [singleAsset, setSingleAsset] = useState<SharedAsset | null>(null);

 // Lightbox for single asset
 const [zoom, setZoom] = useState(1);

 // ─── Step 1: Resolve share link ──────────────────────────
 useEffect(() => {
 (async () => {
 try {
 const res = await fetch(`/api/share/${token}`);
 const data = await res.json();

 if (!res.ok) {
 setErrorMessage(data.error ?? 'This link is not available');
 setPhase('error');
 return;
 }

 setShareInfo(data.share);

 if (data.share.requiresPassword) {
 setPhase('password');
 } else {
 setPhase('content');
 }
 } catch {
 setErrorMessage('Failed to load share link');
 setPhase('error');
 }
 })();
 }, [token]);

 // ─── Step 2: Load content ───────────────────────────────
 const fetchContent = useCallback(
 async (folderId?: string) => {
 try {
 const url = folderId
 ? `/api/share/${token}/assets?folderId=${folderId}`
 : `/api/share/${token}/assets`;
 const res = await fetch(url);
 const data = await res.json();

 if (!res.ok) {
 setErrorMessage(data.error ?? 'Failed to load content');
 setPhase('error');
 return;
 }

 if (data.type === 'asset') {
 setSingleAsset(data.asset);
 } else {
 setAssets(data.assets ?? []);
 setFolders(data.folders ?? []);
 setCurrentFolder(data.currentFolder);
 }
 } catch {
 setErrorMessage('Failed to load content');
 setPhase('error');
 }
 },
 [token],
 );

 useEffect(() => {
 if (phase === 'content') {
 fetchContent();
 }
 }, [phase, fetchContent]);

 // ─── Password verification ──────────────────────────────
 const handlePasswordSubmit = async () => {
 setVerifying(true);
 setPasswordError('');
 try {
 const res = await fetch(`/api/share/${token}/password`, {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ password }),
 });
 const data = await res.json();

 if (!res.ok || !data.valid) {
 setPasswordError('Incorrect password');
 return;
 }

 setPhase('content');
 } catch {
 setPasswordError('Failed to verify password');
 } finally {
 setVerifying(false);
 }
 };

 // ─── Folder navigation ─────────────────────────────────
 const navigateToFolder = (folder: SharedFolder) => {
 if (currentFolder) {
 setFolderHistory((h) => [
 ...h,
 { id: currentFolder.id, name: currentFolder.name },
 ]);
 }
 fetchContent(folder.id);
 };

 const navigateBack = () => {
 const prev = folderHistory[folderHistory.length - 1];
 if (prev) {
 setFolderHistory((h) => h.slice(0, -1));
 fetchContent(prev.id);
 } else if (currentFolder?.parentId) {
 fetchContent(currentFolder.parentId);
 }
 };

 /* ─── Renders ────────────────────────────────────────── */

 // Loading state
 if (phase === 'loading') {
 return (
 <div className="flex min-h-screen items-center justify-center bg-dash-muted">
 <div className="text-center">
 <Loader2 className="mx-auto h-8 w-8 animate-spin text-dash-text-muted" />
 <p className="mt-3 text-sm text-dash-text2">Loading share link...</p>
 </div>
 </div>
 );
 }

 // Error state
 if (phase === 'error') {
 return (
 <div className="flex min-h-screen items-center justify-center bg-dash-muted">
 <div className="mx-4 max-w-sm rounded-xl border border-dash-border bg-dash-surface p-8 text-center shadow-sm">
 <AlertTriangle className="mx-auto h-10 w-10 text-amber-500" />
 <h1 className="mt-4 text-lg font-semibold text-dash-text">
 Link Unavailable
 </h1>
 <p className="mt-2 text-sm text-dash-text2">{errorMessage}</p>
 <Link
 href="/"
 className="mt-6 inline-block rounded-lg bg-dash-inverted px-4 py-2 text-sm font-medium text-white hover:bg-dash-inverted-hover"
 >
 Go to ImageMan
 </Link>
 </div>
 </div>
 );
 }

 // Password gate
 if (phase === 'password') {
 return (
 <div className="flex min-h-screen items-center justify-center bg-dash-muted">
 <div className="mx-4 w-full max-w-sm rounded-xl border border-dash-border bg-dash-surface p-8 shadow-sm">
 <div className="text-center">
 <Lock className="mx-auto h-10 w-10 text-dash-text-muted" />
 <h1 className="mt-4 text-lg font-semibold text-dash-text">
 Protected Content
 </h1>
 {shareInfo?.organization && (
 <p className="mt-1 text-xs text-dash-text-muted">
 Shared by {shareInfo.organization.name}
 </p>
 )}
 <p className="mt-2 text-sm text-dash-text2">
 Enter the password to access{' '}
 <strong>{shareInfo?.targetName}</strong>
 </p>
 </div>
 <div className="mt-6">
 <input
 type="password"
 value={password}
 onChange={(e) => setPassword(e.target.value)}
 onKeyDown={(e) => e.key === 'Enter' && handlePasswordSubmit()}
 placeholder="Enter password"
 className="w-full rounded-lg border border-dash-border px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
 autoFocus
 />
 {passwordError && (
 <p className="mt-2 text-sm text-red-600">{passwordError}</p>
 )}
 <button
 onClick={handlePasswordSubmit}
 disabled={verifying || !password}
 className="mt-3 w-full rounded-lg bg-dash-inverted py-2.5 text-sm font-medium text-white transition hover:bg-dash-inverted-hover disabled:opacity-50"
 >
 {verifying ? (
 <Loader2 className="mx-auto h-4 w-4 animate-spin" />
 ) : (
 'Unlock'
 )}
 </button>
 </div>
 </div>
 </div>
 );
 }

 // ─── Content view ──────────────────────────────────────

 // Single asset view
 if (singleAsset) {
 const isImage = singleAsset.mimeType.startsWith('image/');

 return (
 <div className="min-h-screen bg-dash-inverted">
 {/* Header */}
 <header className="flex items-center justify-between border-b border-dash-border bg-dash-inverted/90 px-4 py-3 backdrop-blur">
 <div className="flex items-center gap-3">
 {shareInfo?.organization && (
 <span className="rounded-md bg-dash-inverted-hover px-2 py-0.5 text-[10px] font-bold tracking-widest text-dash-text-muted">
 {shareInfo.organization.name}
 </span>
 )}
 <span className="text-sm font-medium text-white">
 {singleAsset.name}
 </span>
 <span
 className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
 shareInfo?.permission === 'edit'
 ? 'bg-amber-900/40 text-amber-400'
 : 'bg-blue-900/40 text-blue-400'
 }`}
 >
 {shareInfo?.permission === 'edit' ? (
 <><Edit3 className="mr-1 inline h-3 w-3" />Edit</>
 ) : (
 <><Eye className="mr-1 inline h-3 w-3" />View</>
 )}
 </span>
 </div>
 <div className="flex items-center gap-2">
 {/* Zoom controls */}
 <button
 onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))}
 className="rounded-md p-1.5 text-dash-text-muted hover:bg-dash-inverted-hover hover:text-white"
 >
 <ZoomOut className="h-4 w-4" />
 </button>
 <span className="text-xs text-dash-text2">
 {Math.round(zoom * 100)}%
 </span>
 <button
 onClick={() => setZoom((z) => Math.min(4, z + 0.25))}
 className="rounded-md p-1.5 text-dash-text-muted hover:bg-dash-inverted-hover hover:text-white"
 >
 <ZoomIn className="h-4 w-4" />
 </button>
 {/* Download */}
 {singleAsset.url && (
 <a
 href={singleAsset.url}
 download={singleAsset.originalName}
 className="inline-flex items-center gap-1.5 rounded-lg bg-dash-surface px-3 py-1.5 text-sm font-medium text-dash-text hover:bg-dash-muted"
 >
 <Download className="h-4 w-4" />
 Download
 </a>
 )}
 </div>
 </header>

 {/* Image viewer */}
 <div className="flex items-center justify-center" style={{ height: 'calc(100vh - 120px)' }}>
 {isImage && singleAsset.url ? (
 // eslint-disable-next-line @next/next/no-img-element
 <img
 src={singleAsset.url}
 alt={singleAsset.name}
 className="max-h-full max-w-full object-contain transition-transform duration-200"
 style={{ transform: `scale(${zoom})` }}
 draggable={false}
 />
 ) : (
 <div className="text-center text-dash-text2">
 <FileImage className="mx-auto h-16 w-16" />
 <p className="mt-3 text-sm">{singleAsset.name}</p>
 <p className="text-xs text-dash-text2">
 {singleAsset.mimeType} · {formatBytes(singleAsset.sizeBytes)}
 </p>
 </div>
 )}
 </div>

 {/* Info bar */}
 <footer className="fixed bottom-0 left-0 right-0 border-t border-dash-border bg-dash-inverted/90 px-4 py-2 backdrop-blur">
 <div className="flex items-center justify-between text-xs text-dash-text2">
 <span>
 {singleAsset.width && singleAsset.height
 ? `${singleAsset.width} × ${singleAsset.height}`
 : 'Unknown dimensions'}
 </span>
 <span>{formatBytes(singleAsset.sizeBytes)}</span>
 <span>{singleAsset.mimeType}</span>
 </div>
 </footer>
 </div>
 );
 }

 // Folder view
 return (
 <div className="min-h-screen bg-dash-muted">
 {/* Header */}
 <header className="sticky top-0 z-10 border-b border-dash-border bg-dash-surface/90 px-6 py-4 backdrop-blur">
 <div className="mx-auto max-w-6xl">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-3">
 {shareInfo?.organization && (
 <span className="rounded-md bg-dash-inverted px-2 py-0.5 text-[10px] font-bold tracking-widest text-white">
 {shareInfo.organization.name}
 </span>
 )}
 <div>
 <h1 className="text-lg font-semibold text-dash-text">
 {currentFolder?.name ?? shareInfo?.targetName ?? 'Shared Files'}
 </h1>
 <p className="text-xs text-dash-text2">
 {assets.length} files · {folders.length} folders
 </p>
 </div>
 </div>
 <span
 className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${
 shareInfo?.permission === 'edit'
 ? 'border-amber-200 bg-amber-50 text-amber-700'
 : 'border-blue-200 bg-blue-50 text-blue-700'
 }`}
 >
 <Shield className="h-3 w-3" />
 {shareInfo?.permission === 'edit' ? 'Edit access' : 'View only'}
 </span>
 </div>

 {/* Breadcrumbs */}
 {(folderHistory.length > 0 || currentFolder) && (
 <div className="mt-2 flex items-center gap-1 text-xs text-dash-text2">
 <button
 onClick={navigateBack}
 className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-dash-muted hover:text-dash-text2"
 >
 <ArrowLeft className="h-3 w-3" />
 Back
 </button>
 {folderHistory.map((f) => (
 <span key={f.id} className="flex items-center">
 <ChevronRight className="h-3 w-3 text-dash-text-muted" />
 <span className="px-1">{f.name}</span>
 </span>
 ))}
 {currentFolder && (
 <span className="flex items-center">
 <ChevronRight className="h-3 w-3 text-dash-text-muted" />
 <span className="px-1 font-medium text-dash-text2">
 {currentFolder.name}
 </span>
 </span>
 )}
 </div>
 )}
 </div>
 </header>

 {/* Content */}
 <main className="mx-auto max-w-6xl p-6">
 {/* Folders */}
 {folders.length > 0 && (
 <div className="mb-6">
 <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-dash-text-muted">
 Folders
 </h2>
 <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
 {folders.map((f) => (
 <button
 key={f.id}
 onClick={() => navigateToFolder(f)}
 className="flex items-center gap-2.5 rounded-lg border border-dash-border bg-dash-surface px-4 py-3 text-left transition hover:border-dash-border hover:shadow-sm"
 >
 <Folder className="h-5 w-5 shrink-0 text-amber-500" />
 <span className="truncate text-sm font-medium text-dash-text2">
 {f.name}
 </span>
 </button>
 ))}
 </div>
 </div>
 )}

 {/* Assets grid */}
 {assets.length > 0 ? (
 <div>
 <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-dash-text-muted">
 Files
 </h2>
 <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
 {assets.map((asset) => {
 const isImage = asset.mimeType.startsWith('image/');
 const thumbSrc = asset.thumbnailBase64 ?? asset.url;

 return (
 <div
 key={asset.id}
 className="group overflow-hidden rounded-lg border border-dash-border bg-dash-surface transition hover:shadow-md"
 >
 {/* Preview */}
 <div className="relative aspect-square bg-dash-muted">
 {isImage && thumbSrc ? (
 // eslint-disable-next-line @next/next/no-img-element
 <img
 src={thumbSrc}
 alt={asset.name}
 className="h-full w-full object-cover"
 loading="lazy"
 />
 ) : (
 <div className="flex h-full items-center justify-center">
 <ImageIcon className="h-8 w-8 text-dash-text-muted" />
 </div>
 )}

 {/* Download overlay */}
 {asset.url && (
 <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition group-hover:bg-black/30 group-hover:opacity-100">
 <a
 href={asset.url}
 download={asset.originalName}
 className="inline-flex items-center gap-1.5 rounded-lg bg-dash-surface/90 px-3 py-1.5 text-xs font-medium text-dash-text shadow-sm hover:bg-dash-surface"
 >
 <Download className="h-3.5 w-3.5" />
 Download
 </a>
 </div>
 )}
 </div>

 {/* Info */}
 <div className="px-2.5 py-2">
 <p className="truncate text-xs font-medium text-dash-text2">
 {asset.name}
 </p>
 <p className="text-[10px] text-dash-text-muted">
 {formatBytes(asset.sizeBytes)}
 {asset.width && asset.height
 ? ` · ${asset.width}×${asset.height}`
 : ''}
 </p>
 </div>
 </div>
 );
 })}
 </div>
 </div>
 ) : folders.length === 0 ? (
 <div className="py-20 text-center">
 <ImageIcon className="mx-auto h-12 w-12 text-dash-text-muted" />
 <p className="mt-3 text-sm text-dash-text2">
 This shared folder is empty
 </p>
 </div>
 ) : null}
 </main>
 </div>
 );
}
