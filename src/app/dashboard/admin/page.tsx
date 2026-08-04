// SPDX-License-Identifier: Apache-2.0
'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
 Shield,
 Users,
 FileText,
 BookOpen,
 HardDrive,
 Sparkles,
 ImageIcon,
 FolderOpen,
 RefreshCw,
 ArrowRight,
 DollarSign,
} from 'lucide-react';
import { useRole } from '@/components/dashboard/role-context';

/* ─── Types ──────────────────────────────────────────── */

interface AdminStats {
 totalMembers: number;
 totalAssets: number;
 totalFolders: number;
 totalDesigns: number;
 totalInvoices: number;
 totalDocs: number;
 storageBytes: number;
 aiCredits: number;
}

function formatBytes(bytes: number): string {
 if (bytes === 0) return '0 B';
 const units = ['B', 'KB', 'MB', 'GB', 'TB'];
 const i = Math.floor(Math.log(bytes) / Math.log(1024));
 return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

/* ─── Component ──────────────────────────────────────── */

export default function AdminPage() {
 const [stats, setStats] = useState<AdminStats | null>(null);
 const [loading, setLoading] = useState(true);
 const { orgName, role } = useRole();

 const fetchStats = useCallback(async () => {
 setLoading(true);
 try {
 const res = await fetch('/api/admin/stats');
 if (res.ok) {
 const data = await res.json();
 setStats(data.stats);
 }
 } catch {
 // Error handling
 } finally {
 setLoading(false);
 }
 }, []);

 useEffect(() => {
 fetchStats();
 }, [fetchStats]);

 if (!['owner', 'admin'].includes(role)) {
 return (
 <div className="flex h-full items-center justify-center">
 <div className="text-center">
 <Shield className="mx-auto h-10 w-10 text-dash-text-muted dark:text-dash-text2"/>
 <p className="mt-3 text-sm text-dash-text2">
 You don&apos;t have permission to access the admin panel.
 </p>
 </div>
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
 <div className="mx-auto max-w-5xl space-y-6 p-6">
 {/* Header */}
 <div>
 <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-dash-text">
 <Shield className="h-6 w-6 text-[var(--im-primary)]"/>
 Admin Panel
 </h1>
 <p className="mt-1 text-sm text-dash-text2">
 Manage {orgName || 'your organization'} — overview, content, and users.
 </p>
 </div>

 {/* Stats Grid */}
 <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
 <StatCard icon={Users} label="Team Members"value={stats?.totalMembers ?? 0} />
 <StatCard icon={ImageIcon} label="Assets"value={stats?.totalAssets ?? 0} />
 <StatCard icon={FolderOpen} label="Folders"value={stats?.totalFolders ?? 0} />
 <StatCard icon={HardDrive} label="Storage"value={formatBytes(stats?.storageBytes ?? 0)} />
 <StatCard icon={Sparkles} label="AI Credits"value={stats?.aiCredits ?? 0} />
 <StatCard icon={FileText} label="Invoices"value={stats?.totalInvoices ?? 0} />
 <StatCard icon={BookOpen} label="Docs"value={stats?.totalDocs ?? 0} />
 <StatCard icon={DollarSign} label="Designs"value={stats?.totalDesigns ?? 0} />
 </div>

 {/* Quick Actions */}
 <div className="grid gap-4 sm:grid-cols-3">
 <QuickAction
 href="/dashboard/admin/docs"
 icon={BookOpen}
 title="Manage Docs"
 description="Create, edit, and publish knowledge base articles."
 color="emerald"
 />
 <QuickAction
 href="/dashboard/team"
 icon={Users}
 title="Team"
 description="Manage team members and permissions."
 color="violet"
 />
 <QuickAction
 href="/dashboard/settings"
 icon={Shield}
 title="Settings"
 description="Organization settings, branding, and theme."
 color="amber"
 />
 <QuickAction
 href="/dashboard/ai"
 icon={Sparkles}
 title="AI Studio"
 description="AI-powered image editing and generation."
 color="purple"
 />
 <QuickAction
 href="/dashboard/transforms"
 icon={HardDrive}
 title="Transforms"
 description="Manage image transformation presets."
 color="cyan"
 />
 </div>
 </div>
 );
}

/* ─── Sub-components ─────────────────────────────────── */

function StatCard({
 icon: Icon,
 label,
 value,
}: {
 icon: React.ElementType;
 label: string;
 value: string | number;
}) {
 return (
 <div className="rounded-xl border border-dash-border bg-dash-surface p-4">
 <div className="flex items-center gap-2">
 <Icon className="h-4 w-4 text-dash-text-muted"/>
 <span className="text-[11px] text-dash-text2">{label}</span>
 </div>
 <p className="mt-1 text-xl font-bold text-dash-text">{value}</p>
 </div>
 );
}

function QuickAction({
 href,
 icon: Icon,
 title,
 description,
 color,
}: {
 href: string;
 icon: React.ElementType;
 title: string;
 description: string;
 color: string;
}) {
 const colorMap: Record<string, string> = {
 emerald: 'bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400',
 blue: 'bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400',
 violet: 'bg-violet-50 dark:bg-violet-950 text-violet-600 dark:text-violet-400',
 amber: 'bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400',
 purple: 'bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400',
 cyan: 'bg-cyan-50 dark:bg-cyan-950 text-cyan-600 dark:text-cyan-400',
 };

 return (
 <Link
 href={href}
 className="group flex items-start gap-4 rounded-xl border border-dash-border bg-dash-surface p-5 transition hover:border-dash-border hover:shadow-sm"
 >
 <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${colorMap[color] ?? colorMap.violet}`}>
 <Icon className="h-5 w-5"/>
 </div>
 <div className="min-w-0 flex-1">
 <p className="text-sm font-semibold text-dash-text group-hover:text-[var(--im-primary)]">
 {title}
 </p>
 <p className="mt-0.5 text-xs text-dash-text2">{description}</p>
 </div>
 <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-dash-text-muted transition group-hover:text-[var(--im-primary)] group-hover:translate-x-0.5"/>
 </Link>
 );
}
