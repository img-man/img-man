// SPDX-License-Identifier: Apache-2.0
'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Users,
  UserPlus,
  MoreHorizontal,
  Shield,
  Trash2,
  Loader2,
  Copy,
  CheckCircle2,
  AlertCircle,
  Clock,
  X,
  ChevronDown,
  Mail,
  FolderOpen,
  Globe,
  Save,
} from 'lucide-react';
import { FolderPicker } from '@/components/dashboard/folder-picker';

/* ─── Types ────────────────────────────────────────────── */

interface OrgFolder {
  id: string;
  name: string;
  path: string;
}

interface Member {
  id: string;
  email: string;
  phone?: string;
  role: string;
  status: 'active' | 'pending';
  name: string | null;
  inviteName?: string | null;
  image: string | null;
  userId: string | null;
  inviteExpiresAt: string | null;
  createdAt: string;
  folderAccess: string[];
  folderAccessNames: string[];
  accessRules: { path: string; role: string; resourceType: 'folder' | 'asset' }[];
  sectionAccess: Record<string, number>;
}

interface WhiteLabelProvisioningSettings {
  defaultNewUserRole: 'editor' | 'viewer';
  allowedEmailDomains: string[];
}

type Role = 'owner' | 'admin' | 'editor' | 'viewer';

const TEAM_PAGE_SIZES = [5, 10, 20, 50] as const;

const ROLE_META: Record<Role, { label: string; color: string; bg: string }> = {
  owner: { label: 'Owner', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
  admin: { label: 'Admin', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
  editor: { label: 'Editor', color: 'text-green-700', bg: 'bg-green-50 border-green-200' },
  viewer: { label: 'Viewer', color: 'text-zinc-600', bg: 'bg-zinc-50 border-zinc-200' },
};

const ROLE_LEVEL: Record<Role, number> = { owner: 4, admin: 3, editor: 2, viewer: 1 };

// Available dashboard sections that can be restricted
const DASHBOARD_SECTIONS = [
  { key: 'dashboard', label: 'Dashboard Home' },
  { key: 'vault', label: 'Vault (Assets)' },
  { key: 'ai_studio', label: 'AI Studio' },
  { key: 'designs', label: 'Designs' },
  { key: 'shares', label: 'Shares' },
  { key: 'docs', label: 'Documentation' },
  { key: 'analytics', label: 'Analytics' },
  { key: 'settings', label: 'Settings' },
  { key: 'admin', label: 'Admin Panel' },
];

/* ─── Helpers ──────────────────────────────────────────── */

function getInvitableRoles(myRole: Role): Role[] {
  const myLevel = ROLE_LEVEL[myRole];
  return (['admin', 'editor', 'viewer'] as Role[]).filter(
    (r) => ROLE_LEVEL[r] < myLevel,
  );
}

function canChangeRole(myRole: Role, targetRole: Role): boolean {
  return ROLE_LEVEL[myRole] > ROLE_LEVEL[targetRole];
}

function RoleBadge({ role }: { role: string }) {
  const meta = ROLE_META[role as Role] ?? ROLE_META.viewer;
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${meta.bg} ${meta.color}`}
    >
      {meta.label}
    </span>
  );
}

function relativeTime(date: string): string {
  const d = new Date(date);
  const diff = Date.now() - d.getTime();
  const days = Math.floor(diff / 86400000);
  if (days > 0) return `${days}d ago`;
  const hours = Math.floor(diff / 3600000);
  if (hours > 0) return `${hours}h ago`;
  return 'Just now';
}

function normalizeAllowedEmailDomain(value: string): string | null {
  const normalized = value.trim().toLowerCase().replace(/^@+/, '');
  if (!normalized) return null;
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(normalized)) return null;
  return normalized;
}

function parseAllowedEmailDomainsInput(value: string): string[] {
  const unique = new Set<string>();
  for (const part of value.split(/[\n,]+/)) {
    const normalized = normalizeAllowedEmailDomain(part);
    if (normalized) unique.add(normalized);
  }
  return Array.from(unique);
}

function formatAllowedEmailDomains(domains: string[]): string {
  return domains.map((domain) => `@${domain}`).join(', ');
}

/* ─── Component ────────────────────────────────────────── */

export default function TeamPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [folders, setFolders] = useState<OrgFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [totalMembers, setTotalMembers] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [myRole, setMyRole] = useState<Role>('viewer');
  const [myEmail, setMyEmail] = useState('');
  const [whiteLabelSettings, setWhiteLabelSettings] = useState<WhiteLabelProvisioningSettings | null>(null);
  const [defaultNewUserRole, setDefaultNewUserRole] = useState<'editor' | 'viewer'>('editor');
  const [allowedEmailDomainsInput, setAllowedEmailDomainsInput] = useState('');
  const [savingWhiteLabelSettings, setSavingWhiteLabelSettings] = useState(false);

  // Add member dialog
  const [showInvite, setShowInvite] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePhone, setInvitePhone] = useState('');
  const [inviteRole, setInviteRole] = useState<Role>('viewer');
  const [inviting, setInviting] = useState(false);
  const [inviteAccessRules, setInviteAccessRules] = useState<{ path: string; role: Role; resourceType: 'folder' | 'asset' }[]>([]);

  // Access control dialog
  const [accessMember, setAccessMember] = useState<Member | null>(null);
  const [accessRules, setAccessRules] = useState<{ path: string; role: Role; resourceType: 'folder' | 'asset' }[]>([]);
  const [sectionAccess, setSectionAccess] = useState<Record<string, number>>({});
  const [savingAccess, setSavingAccess] = useState(false);

  // Action menus
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: String(pageSize),
      });
      const res = await fetch(`/api/team?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      const nextTotalPages = Math.max(1, Number(data.totalPages) || 1);
      if (currentPage > nextTotalPages) {
        setCurrentPage(nextTotalPages);
        return;
      }

      setMembers(data.members ?? []);
      setFolders(data.folders ?? []);
      setTotalMembers(Number(data.total) || 0);
      setTotalPages(nextTotalPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load team');
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize]);

  const fetchWhiteLabelSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/settings');
      if (!res.ok) return;
      const data = await res.json();
      const nextSettings: WhiteLabelProvisioningSettings = {
        defaultNewUserRole:
          data.settings?.embedConfig?.defaultNewUserRole === 'viewer'
            ? 'viewer'
            : 'editor',
        allowedEmailDomains: Array.isArray(data.settings?.embedConfig?.allowedEmailDomains)
          ? data.settings.embedConfig.allowedEmailDomains.filter(
              (value: unknown): value is string => typeof value === 'string',
            )
          : [],
      };
      setWhiteLabelSettings(nextSettings);
      setDefaultNewUserRole(nextSettings.defaultNewUserRole);
      setAllowedEmailDomainsInput(formatAllowedEmailDomains(nextSettings.allowedEmailDomains));
    } catch {
      // Keep team management usable even if settings fetch fails.
    }
  }, []);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((data) => {
        if (data.email) setMyEmail(data.email.toLowerCase());
        if (data.role) setMyRole(data.role as Role);
      })
      .catch(() => {});
  }, []);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  useEffect(() => {
    if (['owner', 'admin'].includes(myRole)) {
      fetchWhiteLabelSettings();
    }
  }, [fetchWhiteLabelSettings, myRole]);

  useEffect(() => {
    if (success) {
      const t = setTimeout(() => setSuccess(null), 4000);
      return () => clearTimeout(t);
    }
  }, [success]);

  const handleInvite = async () => {
    if (!inviteName.trim()) return;
    if (!inviteEmail.trim() && !invitePhone.trim()) return;
    setInviting(true);
    setError(null);
    try {
      const res = await fetch('/api/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: inviteName.trim(),
          email: inviteEmail.trim() || undefined,
          phone: invitePhone.trim() || undefined,
          role: inviteRole,
          accessRules: inviteAccessRules,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setSuccess(`Added ${inviteName.trim()} as ${inviteRole}`);
      setInviteName('');
      setInviteEmail('');
      setInvitePhone('');
      setInviteAccessRules([]);
      setShowInvite(false);
      fetchMembers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add member');
    } finally {
      setInviting(false);
    }
  };

  const handleRoleChange = async (memberId: string, newRole: Role) => {
    setActionLoading(memberId);
    setOpenMenu(null);
    try {
      const res = await fetch(`/api/team/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setSuccess(`Role updated to ${newRole}`);
      fetchMembers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change role');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemove = async (memberId: string, email: string) => {
    if (!confirm(`Remove ${email} from the organization?`)) return;
    setActionLoading(memberId);
    setOpenMenu(null);
    try {
      const res = await fetch(`/api/team/${memberId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setSuccess(`Removed ${email}`);
      fetchMembers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove member');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSaveAccess = async () => {
    if (!accessMember) return;
    setSavingAccess(true);
    setError(null);
    try {
      const res = await fetch(`/api/team/${accessMember.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessRules, sectionAccess }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setSuccess(`Access updated for ${accessMember.name ?? accessMember.email}`);
      setAccessMember(null);
      fetchMembers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update access');
    } finally {
      setSavingAccess(false);
    }
  };

  const handleSaveWhiteLabelSettings = async () => {
    setSavingWhiteLabelSettings(true);
    setError(null);
    try {
      const allowedEmailDomains = parseAllowedEmailDomainsInput(allowedEmailDomainsInput);
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          embedConfig: {
            defaultNewUserRole,
            allowedEmailDomains,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);

      const nextSettings: WhiteLabelProvisioningSettings = {
        defaultNewUserRole:
          data.settings?.embedConfig?.defaultNewUserRole === 'viewer'
            ? 'viewer'
            : 'editor',
        allowedEmailDomains: Array.isArray(data.settings?.embedConfig?.allowedEmailDomains)
          ? data.settings.embedConfig.allowedEmailDomains.filter(
              (value: unknown): value is string => typeof value === 'string',
            )
          : [],
      };
      setWhiteLabelSettings(nextSettings);
      setDefaultNewUserRole(nextSettings.defaultNewUserRole);
      setAllowedEmailDomainsInput(formatAllowedEmailDomains(nextSettings.allowedEmailDomains));
      setSuccess(
        nextSettings.allowedEmailDomains.length > 0
          ? `White-label auto-join now allows only ${formatAllowedEmailDomains(nextSettings.allowedEmailDomains)}.`
          : `White-label auto-join updated. New users default to ${nextSettings.defaultNewUserRole}.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save white-label settings');
    } finally {
      setSavingWhiteLabelSettings(false);
    }
  };

  const openAccessControl = (member: Member) => {
    setAccessMember(member);
    setAccessRules(member.accessRules?.map((r) => ({ ...r, role: r.role as Role, resourceType: r.resourceType as 'folder' | 'asset' })) ?? []);
    setSectionAccess(member.sectionAccess ?? {});
  };

  const addAccessRule = (rules: { path: string; role: Role; resourceType: 'folder' | 'asset' }[], setter: (r: { path: string; role: Role; resourceType: 'folder' | 'asset' }[]) => void) => {
    setter([...rules, { path: '', role: 'viewer', resourceType: 'folder' }]);
  };

  const removeAccessRule = (rules: { path: string; role: Role; resourceType: 'folder' | 'asset' }[], index: number, setter: (r: { path: string; role: Role; resourceType: 'folder' | 'asset' }[]) => void) => {
    setter(rules.filter((_, i) => i !== index));
  };

  const updateAccessRule = (rules: { path: string; role: Role; resourceType: 'folder' | 'asset' }[], index: number, field: string, value: string, setter: (r: { path: string; role: Role; resourceType: 'folder' | 'asset' }[]) => void) => {
    const updated = rules.map((r, i) => i === index ? { ...r, [field]: value } : r);
    setter(updated);
  };

  const invitableRoles = getInvitableRoles(myRole);
  const canInvite = invitableRoles.length > 0;
  const isAdmin = ['owner', 'admin'].includes(myRole);

  const activeMembers = members.filter((m) => m.status === 'active');
  const effectiveTotalMembers = totalMembers || activeMembers.length;
  const parsedAllowedEmailDomains = parseAllowedEmailDomainsInput(allowedEmailDomainsInput);
  const hasWhiteLabelChanges = whiteLabelSettings !== null && (
    defaultNewUserRole !== whiteLabelSettings.defaultNewUserRole
    || JSON.stringify(parsedAllowedEmailDomains) !== JSON.stringify(whiteLabelSettings.allowedEmailDomains)
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6 md:p-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Team</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Manage members, roles, and folder access in your organization.
          </p>
        </div>
        {canInvite && (
          <button
            onClick={() => setShowInvite(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--im-primary)] px-4 py-2 text-sm font-medium text-[var(--im-primary-fg)] transition hover:bg-[var(--im-primary)]/90"
          >
            <UserPlus className="h-4 w-4" />
            Add Team Member
          </button>
        )}
      </div>

      {/* Alerts */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950 p-3 text-sm text-red-700 dark:text-red-300">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto"><X className="h-3.5 w-3.5" /></button>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950 p-3 text-sm text-green-700 dark:text-green-300">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {success}
        </div>
      )}

      {isAdmin && whiteLabelSettings && (
        <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                White-label Auto-Join
              </h2>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Control how brand-new users from white-label tokens join this organization.
              </p>
            </div>
            <button
              onClick={handleSaveWhiteLabelSettings}
              disabled={savingWhiteLabelSettings || !hasWhiteLabelChanges}
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--im-primary)] px-4 py-2 text-sm font-medium text-[var(--im-primary-fg)] transition hover:bg-[var(--im-primary)]/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {savingWhiteLabelSettings ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save White-label Settings
            </button>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[180px,1fr]">
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Default role
              </label>
              <div className="relative">
                <select
                  value={defaultNewUserRole}
                  onChange={(e) => setDefaultNewUserRole(e.target.value as 'editor' | 'viewer')}
                  className="w-full appearance-none rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 outline-none transition focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500"
                >
                  <option value="editor">Editor</option>
                  <option value="viewer">Viewer</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              </div>
              <p className="mt-2 text-[11px] text-zinc-400">
                Applied only when a white-label token creates a brand-new member.
              </p>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Allowed email endings
              </label>
              <textarea
                value={allowedEmailDomainsInput}
                onChange={(e) => setAllowedEmailDomainsInput(e.target.value)}
                rows={2}
                placeholder="@img-man.com, @agency.example"
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 outline-none transition focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500"
              />
              <p className="mt-2 text-[11px] text-zinc-400">
                Optional. Leave blank to allow any email. If set, only new white-label users whose email ends with one of these domains can auto-join.
              </p>
            </div>
          </div>
        </section>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
        </div>
      ) : (
        <>
          {/* Active Members */}
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
              <Users className="h-4 w-4" />
              Members ({effectiveTotalMembers})
            </h2>
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
              {activeMembers.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-zinc-500">No active members yet</div>
              ) : (
                activeMembers.map((m) => (
                  <div key={m.id} className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {m.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={m.image} alt="" className="h-9 w-9 rounded-full" />
                      ) : (
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 text-sm font-semibold text-zinc-500 dark:text-zinc-400">
                          {(m.name ?? m.email).charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                          {m.name ?? m.email.split('@')[0]}
                          {m.email === myEmail && <span className="ml-1.5 text-xs text-zinc-400">(you)</span>}
                        </p>
                        <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">{m.email}</p>
                      </div>

                      {/* Access rules badge */}
                      <div className="hidden sm:flex items-center gap-1.5">
                        {(m.accessRules?.length ?? 0) === 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                            <Globe className="h-3 w-3" /> Root Access
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
                            <FolderOpen className="h-3 w-3" /> {m.accessRules.length} rule{m.accessRules.length !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>

                      <RoleBadge role={m.role} />

                      {m.email !== myEmail && canChangeRole(myRole, m.role as Role) && (
                        <div className="relative">
                          {actionLoading === m.id ? (
                            <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
                          ) : (
                            <button
                              onClick={() => setOpenMenu(openMenu === m.id ? null : m.id)}
                              className="rounded-md p-1.5 text-zinc-400 transition hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-700 dark:hover:text-zinc-300"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                          )}
                          {openMenu === m.id && (
                            <>
                              <div className="fixed inset-0 z-10" onClick={() => setOpenMenu(null)} />
                              <div className="absolute right-0 top-full z-20 mt-1 w-48 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 py-1 shadow-lg">
                                <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Change Role</p>
                                {(['admin', 'editor', 'viewer'] as Role[])
                                  .filter((r) => r !== m.role && ROLE_LEVEL[myRole] > ROLE_LEVEL[r])
                                  .map((r) => (
                                    <button key={r} onClick={() => handleRoleChange(m.id, r)}
                                      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800">
                                      <Shield className="h-3.5 w-3.5" /> Make {ROLE_META[r].label}
                                    </button>
                                  ))}
                                {isAdmin && (
                                  <>
                                    <div className="my-1 border-t border-zinc-100 dark:border-zinc-800" />
                                    <button
                                      onClick={() => { setOpenMenu(null); openAccessControl(m); }}
                                      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800">
                                      <FolderOpen className="h-3.5 w-3.5" /> Manage Access
                                    </button>
                                  </>
                                )}
                                <div className="my-1 border-t border-zinc-100 dark:border-zinc-800" />
                                <button onClick={() => handleRemove(m.id, m.email)}
                                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950">
                                  <Trash2 className="h-3.5 w-3.5" /> Remove
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                    {/* Access rules shown below each member row */}
                    {(m.accessRules?.length ?? 0) > 0 && (
                      <div className="ml-12 mt-2 flex flex-wrap gap-1.5">
                        {m.accessRules.map((rule, idx) => (
                          <span key={idx} className="inline-flex items-center gap-1 rounded-md bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-[11px] text-zinc-600 dark:text-zinc-400">
                            <FolderOpen className="h-3 w-3 text-zinc-400" />
                            <span className="font-medium">{rule.path}</span>
                            <span className="text-zinc-400">:</span>
                            <span className={ROLE_META[rule.role as Role]?.color ?? 'text-zinc-600'}>{rule.role}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
            <div className="mt-4 flex flex-col gap-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                Page {currentPage} of {totalPages}
                {effectiveTotalMembers > 0 ? ` · ${effectiveTotalMembers} total members` : ''}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="text-xs text-zinc-500 dark:text-zinc-400">Rows</label>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setCurrentPage(1);
                    setPageSize(Number(e.target.value));
                  }}
                  className="rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1 text-xs text-zinc-900 dark:text-zinc-100"
                >
                  {TEAM_PAGE_SIZES.map((size) => (
                    <option key={size} value={size}>{size}</option>
                  ))}
                </select>
                <button
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  disabled={loading || currentPage <= 1}
                  className="rounded-md border border-zinc-300 dark:border-zinc-600 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 transition hover:bg-white dark:hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                  disabled={loading || currentPage >= totalPages}
                  className="rounded-md border border-zinc-300 dark:border-zinc-600 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 transition hover:bg-white dark:hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          </section>

        </>
      )}

      {/* ─── Add Member Modal ────────────────────────────── */}
      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Add Team Member</h3>
              <button onClick={() => setShowInvite(false)} className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-700 dark:hover:text-zinc-300">
                <X className="h-5 w-5" />
              </button>
            </div>
            <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">Name <span className="text-red-400">*</span></label>
            <input type="text" value={inviteName} onChange={(e) => setInviteName(e.target.value)} placeholder="Full name"
              className="mb-4 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 outline-none transition focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500" autoFocus />
            <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">Email address</label>
            <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="colleague@company.com"
              className="mb-4 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 outline-none transition focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500" />
            <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">Mobile number</label>
            <input type="tel" value={invitePhone} onChange={(e) => setInvitePhone(e.target.value)} placeholder="+1 (555) 000-0000"
              className="mb-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 outline-none transition focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500" />
            <p className="mb-4 text-[11px] text-zinc-400">At least one of email or mobile is required.</p>
            <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">Default Role</label>
            <div className="relative mb-4">
              <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as Role)}
                className="w-full appearance-none rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 outline-none transition focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500">
                {invitableRoles.map((r) => (<option key={r} value={r}>{ROLE_META[r].label}</option>))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            </div>

            {/* Access Rules */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Folder/Asset Access Rules</label>
                <button
                  onClick={() => addAccessRule(inviteAccessRules, setInviteAccessRules)}
                  className="text-xs font-medium text-blue-600 hover:text-blue-800 transition"
                >
                  + Add Rule
                </button>
              </div>
              {inviteAccessRules.length === 0 ? (
                <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3">
                  <p className="text-xs font-medium text-emerald-700">✓ Full root access — can see all folders & assets with the selected role</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {inviteAccessRules.map((rule, idx) => (
                    <div key={idx} className="flex items-center gap-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 p-2">
                      <select
                        value={rule.resourceType}
                        onChange={(e) => updateAccessRule(inviteAccessRules, idx, 'resourceType', e.target.value, setInviteAccessRules)}
                        className="rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-2 py-1 text-xs text-zinc-900 dark:text-zinc-100"
                      >
                        <option value="folder">Folder</option>
                        <option value="asset">Asset</option>
                      </select>
                      <FolderPicker
                        folders={folders}
                        value={rule.path}
                        onChange={(path) => updateAccessRule(inviteAccessRules, idx, 'path', path, setInviteAccessRules)}
                      />
                      <select
                        value={rule.role}
                        onChange={(e) => updateAccessRule(inviteAccessRules, idx, 'role', e.target.value, setInviteAccessRules)}
                        className="rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-2 py-1 text-xs text-zinc-900 dark:text-zinc-100"
                      >
                        <option value="owner">Owner</option>
                        <option value="admin">Admin</option>
                        <option value="editor">Editor</option>
                        <option value="viewer">Viewer</option>
                      </select>
                      <button
                        onClick={() => removeAccessRule(inviteAccessRules, idx, setInviteAccessRules)}
                        className="rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-500 transition"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  <p className="text-[11px] text-zinc-400">Member will only see folders/assets matching these rules.</p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <button onClick={() => setShowInvite(false)} className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 transition hover:bg-zinc-50 dark:hover:bg-zinc-800">Cancel</button>
              <button onClick={handleInvite} disabled={inviting || !inviteName.trim() || (!inviteEmail.trim() && !invitePhone.trim())}
                className="inline-flex items-center gap-2 rounded-lg bg-[var(--im-primary)] px-4 py-2 text-sm font-medium text-[var(--im-primary-fg)] transition hover:bg-[var(--im-primary)]/90 disabled:opacity-50">
                {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                {inviting ? 'Adding...' : 'Add Member'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Access Rules Modal ────────────────────────── */}
      {accessMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Manage Access Rules</h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">{accessMember.name ?? accessMember.email}</p>
              </div>
              <button onClick={() => setAccessMember(null)} className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-700 dark:hover:text-zinc-300">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Root access option */}
            <div
              onClick={() => setAccessRules([])}
              className={`mb-4 flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition hover:bg-zinc-50 dark:hover:bg-zinc-800 ${
                accessRules.length === 0 ? 'border-emerald-300 bg-emerald-50' : 'border-zinc-200'
              }`}
            >
              <Globe className={`h-4 w-4 ${accessRules.length === 0 ? 'text-emerald-600' : 'text-zinc-400'}`} />
              <div>
                <p className="text-sm font-medium">Root Access</p>
                <p className="text-xs text-zinc-400">Full access to all folders and assets with their default role</p>
              </div>
            </div>

            {/* Path-based rules */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Or set specific path rules</p>
                <button
                  onClick={() => addAccessRule(accessRules, setAccessRules)}
                  className="text-xs font-medium text-blue-600 hover:text-blue-800 transition"
                >
                  + Add Rule
                </button>
              </div>
              {accessRules.length > 0 ? (
                <div className="space-y-2">
                  {accessRules.map((rule, idx) => (
                    <div key={idx} className="flex items-center gap-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 p-2">
                      <select
                        value={rule.resourceType}
                        onChange={(e) => updateAccessRule(accessRules, idx, 'resourceType', e.target.value, setAccessRules)}
                        className="rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-2 py-1 text-xs text-zinc-900 dark:text-zinc-100"
                      >
                        <option value="folder">Folder</option>
                        <option value="asset">Asset</option>
                      </select>
                      <FolderPicker
                        folders={folders}
                        value={rule.path}
                        onChange={(path) => updateAccessRule(accessRules, idx, 'path', path, setAccessRules)}
                      />
                      <select
                        value={rule.role}
                        onChange={(e) => updateAccessRule(accessRules, idx, 'role', e.target.value, setAccessRules)}
                        className="rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-2 py-1 text-xs text-zinc-900 dark:text-zinc-100"
                      >
                        <option value="owner">Owner</option>
                        <option value="admin">Admin</option>
                        <option value="editor">Editor</option>
                        <option value="viewer">Viewer</option>
                      </select>
                      <button
                        onClick={() => removeAccessRule(accessRules, idx, setAccessRules)}
                        className="rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-500 transition"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  <p className="text-[11px] text-zinc-400">
                    Example: <code className="bg-zinc-100 dark:bg-zinc-800 px-1 rounded">root/tripyog/demo</code> : editor — Member sees only that path.
                  </p>
                </div>
              ) : (
                <p className="text-xs text-zinc-400 py-2">No specific rules. Member has root access.</p>
              )}
            </div>

            {/* Section Access Restrictions */}
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950 dark:border-amber-800 p-4">
              <div className="mb-3">
                <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-200">Dashboard Section Access</h4>
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                  Restrict which dashboard sections this member can access. Empty = unrestricted access based on role.
                </p>
              </div>
              <div className="space-y-2">
                {DASHBOARD_SECTIONS.map((section) => {
                  const minRole = sectionAccess[section.key] || 0;
                  return (
                    <div key={section.key} className="flex items-center justify-between rounded-lg border border-amber-200 dark:border-amber-800 bg-white dark:bg-zinc-900 px-3 py-2">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={minRole > 0}
                          onChange={(e) => {
                            const newSectionAccess = { ...sectionAccess };
                            if (e.target.checked) {
                              newSectionAccess[section.key] = 2; // Default to editor level
                            } else {
                              delete newSectionAccess[section.key];
                            }
                            setSectionAccess(newSectionAccess);
                          }}
                          className="rounded border-amber-300"
                        />
                        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{section.label}</span>
                      </label>
                      {minRole > 0 && (
                        <select
                          value={minRole}
                          onChange={(e) => {
                            const newSectionAccess = { ...sectionAccess };
                            newSectionAccess[section.key] = parseInt(e.target.value, 10);
                            setSectionAccess(newSectionAccess);
                          }}
                          className="rounded border border-amber-300 dark:border-amber-700 bg-white dark:bg-zinc-800 px-2 py-1 text-xs text-zinc-900 dark:text-zinc-100"
                        >
                          <option value="1">Viewer+</option>
                          <option value="2">Editor+</option>
                          <option value="3">Admin+</option>
                          <option value="4">Owner only</option>
                        </select>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button onClick={() => setAccessMember(null)} className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 transition hover:bg-zinc-50 dark:hover:bg-zinc-800">Cancel</button>
              <button onClick={handleSaveAccess} disabled={savingAccess}
                className="inline-flex items-center gap-2 rounded-lg bg-[var(--im-primary)] px-4 py-2 text-sm font-medium text-[var(--im-primary-fg)] transition hover:bg-[var(--im-primary)]/90 disabled:opacity-50">
                {savingAccess ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {savingAccess ? 'Saving...' : 'Save Access Rules'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
