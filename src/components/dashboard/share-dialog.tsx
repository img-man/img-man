// SPDX-License-Identifier: Apache-2.0
'use client';

import { copyText } from '@/lib/clipboard';
import { useState, useEffect, useCallback, useMemo } from 'react';
import {
 Link2,
 Copy,
 Check,
 X,
 Lock,
 Globe,
 Calendar,
 Shield,
 Loader2,
 Trash2,
 Eye,
 Edit3,
 ChevronDown,
 ExternalLink,
 Image,
} from 'lucide-react';

/* ─── Types ────────────────────────────────────────────── */

interface ShareDialogProps {
 open: boolean;
 onClose: () => void;
 targetType: 'asset' | 'folder';
 /** Single target ID (legacy) — used when sharing one item */
 targetId?: string;
 /** Multiple target IDs — used when sharing multiple selected assets or selecting a folder */
 targetIds?: string[];
 targetName: string;
}

interface ExistingLink {
 id: string;
 token: string;
 permission: string;
 hasPassword: boolean;
 expiresAt: string | null;
 accessCount: number;
 createdAt: string;
}

type Permission = 'view' | 'edit';
type Expiry = '1d' | '7d' | '30d' | 'never';

/* ─── Component ────────────────────────────────────────── */

export function ShareDialog({
 open,
 onClose,
 targetType,
 targetId,
 targetIds,
 targetName,
}: ShareDialogProps) {
 // Resolve effective IDs: prefer targetIds array, fall back to single targetId
 const effectiveIds = useMemo(
 () => (targetIds?.length ? targetIds : targetId ? [targetId] : []),
 [targetIds, targetId],
 );
 const isMulti = effectiveIds.length > 1;
 // Create link form
 const [permission, setPermission] = useState<Permission>('view');
 const [expiry, setExpiry] = useState<Expiry>('7d');
 const [usePassword, setUsePassword] = useState(false);
 const [password, setPassword] = useState('');
 const [creating, setCreating] = useState(false);

 // Result
 const [shareUrl, setShareUrl] = useState<string | null>(null);
 const [copied, setCopied] = useState(false);

 // Existing links
 const [existingLinks, setExistingLinks] = useState<ExistingLink[]>([]);
 const [loadingLinks, setLoadingLinks] = useState(false);

 // Error
 const [error, setError] = useState<string | null>(null);

 const fetchExistingLinks = useCallback(async () => {
 setLoadingLinks(true);
 try {
 const res = await fetch('/api/share');
 if (!res.ok) return;
 const data = await res.json();
 // Filter to only links matching this target
 const filtered = (data.links ?? []).filter(
 (l: { targetId: string; targetIds?: string[]; targetType: string }) => {
 if (l.targetType !== targetType) return false;
 // Check if any of the effective IDs match
 const linkIds = l.targetIds?.length
 ? l.targetIds
 : l.targetId
 ? [l.targetId]
 : [];
 return effectiveIds.some((id) => linkIds.includes(id));
 },
 );
 setExistingLinks(filtered);
 } catch {
 // Silently fail for existing links
 } finally {
 setLoadingLinks(false);
 }
 }, [effectiveIds, targetType]);

 useEffect(() => {
 if (open) {
 setShareUrl(null);
 setError(null);
 setCopied(false);
 fetchExistingLinks();
 }
 }, [open, fetchExistingLinks]);

 const handleCreate = async () => {
 setCreating(true);
 setError(null);
 try {
 const res = await fetch('/api/share', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 targetType,
 targetIds: effectiveIds,
 permission,
 expiresIn: expiry,
 password: usePassword ? password : undefined,
 }),
 });
 const data = await res.json();
 if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
 setShareUrl(data.link.shareUrl);
 fetchExistingLinks();
 } catch (err) {
 setError(err instanceof Error ? err.message : 'Failed to create link');
 } finally {
 setCreating(false);
 }
 };

 const handleCopy = async () => {
 if (!shareUrl) return;
 await copyText(shareUrl);
 setCopied(true);
 setTimeout(() => setCopied(false), 2000);
 };

 const handleRevoke = async (token: string) => {
 try {
 const res = await fetch(`/api/share/${token}`, { method: 'DELETE' });
 if (!res.ok) {
 const data = await res.json();
 throw new Error(data.error ?? `HTTP ${res.status}`);
 }
 fetchExistingLinks();
 } catch (err) {
 setError(err instanceof Error ? err.message : 'Failed to revoke link');
 }
 };

 if (!open) return null;

 return (
 <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
 <div
 className="w-full max-w-lg rounded-xl border border-dash-border bg-dash-surface shadow-2xl"
 onClick={(e) => e.stopPropagation()}
 >
 {/* Header */}
 <div className="flex items-center justify-between border-b border-dash-border px-5 py-4">
 <div className="flex items-center gap-2">
 <Link2 className="h-5 w-5 text-dash-text2 dark:text-dash-text-muted"/>
 <div>
 <h3 className="text-base font-semibold text-dash-text">
 Share
 </h3>
 <p className="text-xs text-dash-text2 truncate max-w-[300px]">
 {isMulti ? (
 <>
 <Image className="mr-1 inline h-3 w-3"/>
 {effectiveIds.length} items selected
 </>
 ) : (
 <>
 {targetType === 'asset' ? '📄' : '📁'} {targetName}
 </>
 )}
 </p>
 </div>
 </div>
 <button
 onClick={onClose}
 className="rounded-md p-1 text-dash-text-muted hover:bg-dash-surface-hover hover:text-dash-text"
 >
 <X className="h-5 w-5"/>
 </button>
 </div>

 <div className="space-y-5 p-5">
 {/* ─── Create New Link ─────────────────────────── */}
 {shareUrl ? (
 // Show result
 <div className="space-y-3">
 <div className="rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-900/50 p-4">
 <p className="mb-2 text-sm font-medium text-green-800 dark:text-green-400">
 Share link created!
 </p>
 <div className="flex items-center gap-2">
 <input
 readOnly
 value={shareUrl}
 className="flex-1 rounded-md border border-green-300 dark:border-green-800 bg-dash-surface px-3 py-1.5 text-sm text-dash-text2 dark:text-dash-text-muted"
 />
 <button
 onClick={handleCopy}
 className="inline-flex items-center gap-1.5 rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700"
 >
 {copied ? (
 <Check className="h-4 w-4"/>
 ) : (
 <Copy className="h-4 w-4"/>
 )}
 {copied ? 'Copied!' : 'Copy'}
 </button>
 </div>
 </div>
 <button
 onClick={() => setShareUrl(null)}
 className="text-sm text-dash-text2 underline hover:text-dash-text"
 >
 Create another link
 </button>
 </div>
 ) : (
 // Create form
 <div className="space-y-4">
 {/* Permission */}
 <div>
 <label className="mb-1.5 block text-xs font-medium text-dash-text2 dark:text-dash-text-muted">
 Permission
 </label>
 <div className="flex gap-2">
 <button
 onClick={() => setPermission('view')}
 className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition ${
 permission === 'view'
 ? 'border-[var(--im-primary)] bg-[var(--im-primary)] text-[var(--im-primary-fg)]'
 : 'border-dash-border text-dash-text2 hover:bg-dash-surface-hover'
 }`}
 >
 <Eye className="h-4 w-4"/>
 View only
 </button>
 <button
 onClick={() => setPermission('edit')}
 className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition ${
 permission === 'edit'
 ? 'border-[var(--im-primary)] bg-[var(--im-primary)] text-[var(--im-primary-fg)]'
 : 'border-dash-border text-dash-text2 hover:bg-dash-surface-hover'
 }`}
 >
 <Edit3 className="h-4 w-4"/>
 Can edit
 </button>
 </div>
 </div>

 {/* Expiry */}
 <div>
 <label className="mb-1.5 block text-xs font-medium text-dash-text2 dark:text-dash-text-muted">
 <Calendar className="mr-1 inline h-3.5 w-3.5"/>
 Link expiration
 </label>
 <div className="relative">
 <select
 value={expiry}
 onChange={(e) => setExpiry(e.target.value as Expiry)}
 className="w-full appearance-none rounded-lg border border-dash-border bg-dash-surface px-3 py-2 text-sm outline-none focus:border-primary dark:focus:border-primary focus:ring-1 focus:ring-primary "
 >
 <option value="1d">1 day</option>
 <option value="7d">7 days</option>
 <option value="30d">30 days</option>
 <option value="never">Never expires</option>
 </select>
 <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dash-text-muted"/>
 </div>
 </div>

 {/* Password toggle */}
 <div>
 <label className="flex items-center gap-2 text-sm">
 <input
 type="checkbox"
 checked={usePassword}
 onChange={(e) => setUsePassword(e.target.checked)}
 className="rounded border-dash-border bg-dash-surface"
 />
 <Lock className="h-3.5 w-3.5 text-dash-text2"/>
 <span className="text-dash-text2 dark:text-dash-text-muted">
 Require password
 </span>
 </label>
 {usePassword && (
 <input
 type="password"
 value={password}
 onChange={(e) => setPassword(e.target.value)}
 placeholder="Enter password"
 className="mt-2 w-full rounded-lg border border-dash-border bg-dash-surface px-3 py-2 text-sm outline-none focus:border-primary dark:focus:border-primary focus:ring-1 focus:ring-primary "
 />
 )}
 </div>

 {/* Error */}
 {error && (
 <p className="text-sm text-red-600 dark:text-red-400">
 {error}
 </p>
 )}

 {/* Create button */}
 <button
 onClick={handleCreate}
 disabled={creating || (usePassword && !password.trim())}
 className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--im-primary)] px-4 py-2.5 text-sm font-medium text-[var(--im-primary-fg)] transition hover:bg-[var(--im-primary)]/90 disabled:opacity-50"
 >
 {creating ? (
 <Loader2 className="h-4 w-4 animate-spin"/>
 ) : (
 <Globe className="h-4 w-4"/>
 )}
 {creating ? 'Creating...' : 'Create Share Link'}
 </button>
 </div>
 )}

 {/* ─── Existing Links ──────────────────────────── */}
 {(existingLinks.length > 0 || loadingLinks) && (
 <div>
 <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-dash-text-muted">
 <Shield className="h-3.5 w-3.5"/>
 Active Share Links
 </h4>
 {loadingLinks ? (
 <div className="flex justify-center py-4">
 <Loader2 className="h-4 w-4 animate-spin text-dash-text-muted"/>
 </div>
 ) : (
 <div className="space-y-2">
 {existingLinks.map((link) => (
 <div
 key={link.id}
 className="flex items-center gap-2 rounded-lg border border-dash-border bg-dash-muted/50 px-3 py-2"
 >
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2">
 <span
 className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
 link.permission === 'edit'
 ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
 : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
 }`}
 >
 {link.permission}
 </span>
 {link.hasPassword && (
 <Lock className="h-3 w-3 text-dash-text-muted"/>
 )}
 <span className="text-xs text-dash-text-muted">
 {link.accessCount} views
 </span>
 </div>
 <p className="mt-0.5 text-[11px] text-dash-text-muted">
 {link.expiresAt
 ? `Expires ${new Date(link.expiresAt).toLocaleDateString()}`
 : 'Never expires'}
 </p>
 </div>
 <a
 href={`/s/${link.token}`}
 target="_blank"
 rel="noopener noreferrer"
 className="rounded-md p-1.5 text-dash-text-muted hover:bg-dash-surface-hover hover:text-dash-text"
 title="Open link"
 >
 <ExternalLink className="h-3.5 w-3.5"/>
 </a>
 <button
 onClick={() => handleRevoke(link.token)}
 className="rounded-md p-1.5 text-dash-text-muted hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400"
 title="Revoke link"
 >
 <Trash2 className="h-3.5 w-3.5"/>
 </button>
 </div>
 ))}
 </div>
 )}
 </div>
 )}
 </div>
 </div>
 </div>
 );
}
