// SPDX-License-Identifier: Apache-2.0
'use client';

import { useState, useEffect, useCallback } from 'react';
import {
 Key,
 Plus,
 Copy,
 Trash2,
 Check,
 AlertTriangle,
 Eye,
 EyeOff,
 Shield,
 Globe,
 Clock,
 Loader2,
} from 'lucide-react';

interface ApiKeyEntry {
 _id: string;
 name: string;
 keyPrefix: string;
 permissions: string[];
 allowedDomains: string[];
 rateLimit: number;
 lastUsedAt?: string;
 expiresAt?: string;
 isRevoked: boolean;
 createdAt: string;
}

const PERMISSION_LABELS: Record<string, { label: string; color: string }> = {
 read: { label: 'Read', color: 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' },
 write: { label: 'Write', color: 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300' },
 delete: { label: 'Delete', color: 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300' },
 transform: { label: 'Transform', color: 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300' },
 ai: { label: 'AI', color: 'bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300' },
};

export default function ApiKeysPage() {
 const [keys, setKeys] = useState<ApiKeyEntry[]>([]);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState<string | null>(null);

 // Create dialog state
 const [showCreate, setShowCreate] = useState(false);
 const [newName, setNewName] = useState('');
 const [newPermissions, setNewPermissions] = useState<Set<string>>(
 new Set(['read']),
 );
 const [newDomains, setNewDomains] = useState('');
 const [newRateLimit, setNewRateLimit] = useState(60);
 const [newExpiresInDays, setNewExpiresInDays] = useState<number | ''>('');
 const [creating, setCreating] = useState(false);

 // Show-once key state
 const [revealedKey, setRevealedKey] = useState<string | null>(null);
 const [copied, setCopied] = useState(false);

 // Revoke state
 const [revoking, setRevoking] = useState<string | null>(null);

 const fetchKeys = useCallback(async () => {
 try {
 const res = await fetch('/api/settings/api-keys');
 if (!res.ok) throw new Error('Failed to load API keys');
 const data = await res.json();
 setKeys(data.keys);
 } catch (err: unknown) {
 setError(err instanceof Error ? err.message : 'Failed to load API keys');
 } finally {
 setLoading(false);
 }
 }, []);

 useEffect(() => {
 fetchKeys();
 }, [fetchKeys]);

 // ─── Create key ─────────────────────────────────────────────
 const handleCreate = async () => {
 if (!newName.trim()) return;
 setCreating(true);
 try {
 const res = await fetch('/api/settings/api-keys', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 name: newName.trim(),
 permissions: Array.from(newPermissions),
 allowedDomains: newDomains
 .split(',')
 .map((d) => d.trim())
 .filter(Boolean),
 rateLimit: newRateLimit,
 expiresInDays: newExpiresInDays || undefined,
 }),
 });
 if (!res.ok) {
 const data = await res.json();
 throw new Error(data.error ?? 'Failed to create API key');
 }
 const data = await res.json();
 setRevealedKey(data.plaintext);
 setShowCreate(false);
 resetCreateForm();
 fetchKeys();
 } catch (err: unknown) {
 setError(err instanceof Error ? err.message : 'Failed to create key');
 } finally {
 setCreating(false);
 }
 };

 const resetCreateForm = () => {
 setNewName('');
 setNewPermissions(new Set(['read']));
 setNewDomains('');
 setNewRateLimit(60);
 setNewExpiresInDays('');
 };

 // ─── Revoke key ────────────────────────────────────────────
 const handleRevoke = async (keyId: string) => {
 if (!confirm('Are you sure you want to revoke this API key? This cannot be undone.'))
 return;
 setRevoking(keyId);
 try {
 const res = await fetch(`/api/settings/api-keys/${keyId}`, {
 method: 'DELETE',
 });
 if (!res.ok) throw new Error('Failed to revoke');
 fetchKeys();
 } catch {
 setError('Failed to revoke API key');
 } finally {
 setRevoking(null);
 }
 };

 // ─── Copy key ──────────────────────────────────────────────
 const handleCopy = async () => {
 if (!revealedKey) return;
 await navigator.clipboard.writeText(revealedKey);
 setCopied(true);
 setTimeout(() => setCopied(false), 2000);
 };

 const togglePermission = (perm: string) => {
 setNewPermissions((prev) => {
 const next = new Set(prev);
 if (next.has(perm)) {
 next.delete(perm);
 } else {
 next.add(perm);
 }
 return next;
 });
 };

 const activeKeys = keys.filter((k) => !k.isRevoked);
 const revokedKeys = keys.filter((k) => k.isRevoked);

 return (
 <div className="mx-auto max-w-4xl p-6">
 {/* Header */}
 <div className="mb-8 flex items-center justify-between">
 <div>
 <h1 className="flex items-center gap-2 text-2xl font-bold text-dash-text">
 <Key className="h-6 w-6"/>
 API Keys
 </h1>
 <p className="mt-1 text-sm text-dash-text2">
 Manage API keys for programmatic access to your assets and AI
 features.
 </p>
 </div>
 <button
 onClick={() => setShowCreate(true)}
 className="flex items-center gap-2 rounded-lg bg-[var(--im-primary)] px-4 py-2 text-sm font-medium text-[var(--im-primary-fg)] transition hover:bg-[var(--im-primary)]/90"
 >
 <Plus className="h-4 w-4"/>
 Create Key
 </button>
 </div>

 {/* Error */}
 {error && (
 <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950 p-3 text-sm text-red-700 dark:text-red-300">
 <AlertTriangle className="h-4 w-4 shrink-0"/>
 {error}
 <button
 onClick={() => setError(null)}
 className="ml-auto text-red-500 hover:text-red-700"
 >
 ✕
 </button>
 </div>
 )}

 {/* Revealed key modal */}
 {revealedKey && (
 <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
 <div className="mx-4 w-full max-w-lg rounded-xl border border-dash-border bg-dash-surface p-6 shadow-2xl">
 <div className="mb-4 flex items-center gap-2 text-amber-600">
 <AlertTriangle className="h-5 w-5"/>
 <h2 className="text-lg font-semibold">
 Save your API key now!
 </h2>
 </div>
 <p className="mb-4 text-sm text-dash-text2">
 This key will only be shown once. Copy it and store it securely.
 </p>
 <div className="mb-6 flex items-center gap-2 rounded-lg border border-dash-border bg-dash-muted dark:bg-dash-deep p-3">
 <code className="flex-1 break-all text-sm font-mono text-dash-text">
 {revealedKey}
 </code>
 <button
 onClick={handleCopy}
 className="flex shrink-0 items-center gap-1 rounded-md bg-[var(--im-primary)] px-3 py-1.5 text-xs font-medium text-[var(--im-primary-fg)] transition hover:bg-[var(--im-primary)]/90"
 >
 {copied ? (
 <>
 <Check className="h-3 w-3"/> Copied
 </>
 ) : (
 <>
 <Copy className="h-3 w-3"/> Copy
 </>
 )}
 </button>
 </div>
 <button
 onClick={() => {
 setRevealedKey(null);
 setCopied(false);
 }}
 className="w-full rounded-lg bg-dash-muted py-2 text-sm font-medium text-dash-text2 transition hover:bg-dash-surface-hover "
 >
 I&apos;ve saved it — close
 </button>
 </div>
 </div>
 )}

 {/* Create dialog */}
 {showCreate && (
 <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
 <div className="mx-4 w-full max-w-lg rounded-xl border border-dash-border bg-dash-surface p-6 shadow-2xl">
 <h2 className="mb-4 text-lg font-semibold text-dash-text">
 Create API Key
 </h2>

 {/* Name */}
 <label className="mb-3 block">
 <span className="mb-1 block text-sm font-medium text-dash-text2 dark:text-dash-text-muted">
 Key Name
 </span>
 <input
 type="text"
 value={newName}
 onChange={(e) => setNewName(e.target.value)}
 placeholder="e.g. Production, Staging, Widget"
 className="w-full rounded-lg border border-dash-input-border bg-transparent px-3 py-2 text-sm text-dash-text outline-none focus:border-primary focus:ring-1 focus:ring-primary"
 />
 </label>

 {/* Permissions */}
 <div className="mb-3">
 <span className="mb-2 block text-sm font-medium text-dash-text2 dark:text-dash-text-muted">
 <Shield className="mr-1 inline h-3.5 w-3.5"/>
 Permissions
 </span>
 <div className="flex flex-wrap gap-2">
 {Object.entries(PERMISSION_LABELS).map(
 ([perm, { label, color }]) => (
 <button
 key={perm}
 onClick={() => togglePermission(perm)}
 className={`rounded-full px-3 py-1 text-xs font-medium transition ${
 newPermissions.has(perm)
 ? color
 : 'bg-dash-muted text-dash-text-muted'
 }`}
 >
 {newPermissions.has(perm) ? '✓ ' : ''}
 {label}
 </button>
 ),
 )}
 </div>
 </div>

 {/* Allowed domains */}
 <label className="mb-3 block">
 <span className="mb-1 flex items-center gap-1 text-sm font-medium text-dash-text2 dark:text-dash-text-muted">
 <Globe className="h-3.5 w-3.5"/>
 Allowed Domains
 <span className="text-xs font-normal text-dash-text-muted">
 (optional)
 </span>
 </span>
 <input
 type="text"
 value={newDomains}
 onChange={(e) => setNewDomains(e.target.value)}
 placeholder="example.com, *.acme.com"
 className="w-full rounded-lg border border-dash-input-border bg-transparent px-3 py-2 text-sm text-dash-text outline-none focus:border-primary focus:ring-1 focus:ring-primary"
 />
 <p className="mt-1 text-xs text-dash-text-muted">
 Comma-separated. Leave empty to allow any origin.
 </p>
 </label>

 {/* Rate limit */}
 <div className="mb-3 flex gap-4">
 <label className="flex-1">
 <span className="mb-1 block text-sm font-medium text-dash-text2 dark:text-dash-text-muted">
 Rate Limit (req/min)
 </span>
 <input
 type="number"
 value={newRateLimit}
 onChange={(e) => setNewRateLimit(Number(e.target.value))}
 min={1}
 max={10000}
 className="w-full rounded-lg border border-dash-input-border bg-transparent px-3 py-2 text-sm text-dash-text outline-none focus:border-primary focus:ring-1 focus:ring-primary"
 />
 </label>
 <label className="flex-1">
 <span className="mb-1 flex items-center gap-1 text-sm font-medium text-dash-text2 dark:text-dash-text-muted">
 <Clock className="h-3.5 w-3.5"/>
 Expires In (days)
 </span>
 <input
 type="number"
 value={newExpiresInDays}
 onChange={(e) =>
 setNewExpiresInDays(
 e.target.value ? Number(e.target.value) : '',
 )
 }
 min={1}
 placeholder="Never"
 className="w-full rounded-lg border border-dash-input-border bg-transparent px-3 py-2 text-sm text-dash-text outline-none focus:border-primary focus:ring-1 focus:ring-primary"
 />
 </label>
 </div>

 {/* Actions */}
 <div className="mt-6 flex justify-end gap-3">
 <button
 onClick={() => {
 setShowCreate(false);
 resetCreateForm();
 }}
 className="rounded-lg px-4 py-2 text-sm text-dash-text2 transition hover:bg-dash-surface-hover"
 >
 Cancel
 </button>
 <button
 onClick={handleCreate}
 disabled={!newName.trim() || newPermissions.size === 0 || creating}
 className="flex items-center gap-2 rounded-lg bg-[var(--im-primary)] px-4 py-2 text-sm font-medium text-[var(--im-primary-fg)] transition hover:bg-[var(--im-primary)]/90 disabled:cursor-not-allowed disabled:opacity-50"
 >
 {creating && <Loader2 className="h-4 w-4 animate-spin"/>}
 Create Key
 </button>
 </div>
 </div>
 </div>
 )}

 {/* Loading */}
 {loading ? (
 <div className="flex items-center justify-center py-16 text-dash-text-muted">
 <Loader2 className="mr-2 h-5 w-5 animate-spin"/>
 Loading API keys…
 </div>
 ) : (
 <>
 {/* Active keys */}
 <div className="mb-8">
 <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-dash-text-muted">
 Active Keys ({activeKeys.length})
 </h2>
 {activeKeys.length === 0 ? (
 <div className="rounded-lg border border-dashed border-dash-input-border py-10 text-center text-sm text-dash-text-muted">
 No active API keys. Create one to get started.
 </div>
 ) : (
 <div className="space-y-3">
 {activeKeys.map((key) => (
 <KeyCard
 key={key._id}
 apiKey={key}
 onRevoke={handleRevoke}
 revoking={revoking === key._id}
 />
 ))}
 </div>
 )}
 </div>

 {/* Revoked keys */}
 {revokedKeys.length > 0 && (
 <div>
 <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-dash-text-muted">
 Revoked Keys ({revokedKeys.length})
 </h2>
 <div className="space-y-3 opacity-50">
 {revokedKeys.map((key) => (
 <KeyCard key={key._id} apiKey={key} revoked />
 ))}
 </div>
 </div>
 )}
 </>
 )}
 </div>
 );
}

// ─── Key Card Component ──────────────────────────────────────────
function KeyCard({
 apiKey,
 onRevoke,
 revoking,
 revoked,
}: {
 apiKey: ApiKeyEntry;
 onRevoke?: (id: string) => void;
 revoking?: boolean;
 revoked?: boolean;
}) {
 const [showPrefix, setShowPrefix] = useState(false);

 return (
 <div className="rounded-lg border border-dash-border bg-dash-surface p-4 transition hover:shadow-sm">
 <div className="flex items-start justify-between">
 <div>
 <h3 className="flex items-center gap-2 font-medium text-dash-text">
 <Key className="h-4 w-4 text-dash-text-muted"/>
 {apiKey.name}
 {revoked && (
 <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-600">
 Revoked
 </span>
 )}
 </h3>

 {/* Key prefix */}
 <div className="mt-1 flex items-center gap-2">
 <code className="text-xs text-dash-text-muted">
 {showPrefix
 ? `${apiKey.keyPrefix}${'•'.repeat(52)}`
 : `${'•'.repeat(64)}`}
 </code>
 <button
 onClick={() => setShowPrefix((p) => !p)}
 className="text-dash-text-muted transition hover:text-dash-text"
 >
 {showPrefix ? (
 <EyeOff className="h-3 w-3"/>
 ) : (
 <Eye className="h-3 w-3"/>
 )}
 </button>
 </div>

 {/* Permissions */}
 <div className="mt-2 flex flex-wrap gap-1.5">
 {apiKey.permissions.map((perm) => {
 const { label, color } =
 PERMISSION_LABELS[perm] ?? {
 label: perm,
 color: 'bg-dash-muted text-dash-text2 dark:text-dash-text-muted',
 };
 return (
 <span
 key={perm}
 className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${color}`}
 >
 {label}
 </span>
 );
 })}
 </div>

 {/* Meta */}
 <div className="mt-2 flex gap-4 text-[11px] text-dash-text-muted">
 <span>Rate: {apiKey.rateLimit}/min</span>
 {apiKey.allowedDomains.length > 0 && (
 <span>
 Domains: {apiKey.allowedDomains.join(', ')}
 </span>
 )}
 {apiKey.lastUsedAt && (
 <span>
 Last used:{' '}
 {new Date(apiKey.lastUsedAt).toLocaleDateString()}
 </span>
 )}
 {apiKey.expiresAt && (
 <span>
 Expires:{' '}
 {new Date(apiKey.expiresAt).toLocaleDateString()}
 </span>
 )}
 <span>
 Created:{' '}
 {new Date(apiKey.createdAt).toLocaleDateString()}
 </span>
 </div>
 </div>

 {/* Revoke button */}
 {!revoked && onRevoke && (
 <button
 onClick={() => onRevoke(apiKey._id)}
 disabled={revoking}
 className="flex items-center gap-1 rounded-md px-3 py-1.5 text-xs text-red-500 transition hover:bg-red-50 dark:hover:bg-red-950 hover:text-red-700 disabled:opacity-50"
 >
 {revoking ? (
 <Loader2 className="h-3 w-3 animate-spin"/>
 ) : (
 <Trash2 className="h-3 w-3"/>
 )}
 Revoke
 </button>
 )}
 </div>
 </div>
 );
}
