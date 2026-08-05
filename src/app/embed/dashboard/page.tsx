// SPDX-License-Identifier: Apache-2.0
'use client';

import { useState, useEffect, useCallback, Suspense, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTheme } from 'next-themes';
import { EmbedRoleProvider } from './embed-role-provider';
import { EmbedDashboardShell } from './embed-shell';

/**
 * /embed/dashboard — Full dashboard embed (chromeless, token-authenticated)
 *
 * URL Params:
 * - token (required) — Access token (imgt_...) for authentication
 * - folder (optional) — Root folder ID to scope the assets view to
 * - theme (optional) — "dark" | "light" (default: "light")
 * - brand (optional) — Custom brand label (replaces "img-man")
 *
 * Sections are determined by the user's sectionAccess in their OrgMembership,
 * not by URL parameters.
 */
export default function EmbedDashboardPage() {
 return (
 <Suspense
 fallback={
 <div className="flex h-screen w-screen items-center justify-center bg-dash-muted dark:bg-dash-deep">
 <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
 </div>
 }
 >
 <EmbedDashboardContent />
 </Suspense>
 );
}

interface UserContext {
 userId: string | null;
 email: string | null;
 name: string | null;
 image: string | null;
 orgId: string;
 orgSlug: string;
 orgName: string;
 logoUrl: string | null;
 themeColor: string;
 embedConfig: { showLogo: boolean; showName: boolean };
 role: string;
 sectionAccess: Record<string, number>;
 accessRules: { path: string; role: string; resourceType: string }[];
 folderScope: string | null;
 aiFeatureConfig?: Record<string, { mode?: string }> | null;
}

function EmbedDashboardContent() {
 const searchParams = useSearchParams();
 const { setTheme } = useTheme();
 const token = searchParams.get('token') ?? '';
 const folderScope = searchParams.get('folder') ?? null;
 const requestedTheme = (searchParams.get('theme') ?? 'light') as
	| 'dark'
	| 'light';
 const brand = searchParams.get('brand') ?? null;
 const lastAppliedRequestedThemeRef = useRef<'dark' | 'light' | null>(null);

 const [userCtx, setUserCtx] = useState<UserContext | null>(null);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState<string | null>(null);

 const authenticate = useCallback(async () => {
 if (!token) {
 setError('Missing access token');
 setLoading(false);
 return;
 }

 try {
 const res = await fetch('/api/v1/auth/me', {
 headers: { Authorization: `Bearer ${token}` },
 });

 if (!res.ok) {
 const data = await res.json().catch(() => ({}));
 throw new Error(data.error ?? `Authentication failed (${res.status})`);
 }

 const data: UserContext = await res.json();
 setUserCtx(data);
 setError(null);
 } catch (err) {
 setError(err instanceof Error ? err.message : 'Authentication failed');
 } finally {
 setLoading(false);
 }
 }, [token]);

 useEffect(() => {
 authenticate();
 }, [authenticate]);

 // Apply the host-requested theme only when that request changes.
 useEffect(() => {
 if (lastAppliedRequestedThemeRef.current === requestedTheme) {
 return;
 }

 lastAppliedRequestedThemeRef.current = requestedTheme;
 setTheme(requestedTheme);
 }, [requestedTheme, setTheme]);

 if (loading) {
 return (
 <div className="flex h-screen w-screen items-center justify-center bg-dash-muted dark:bg-dash-deep">
 <div className="flex flex-col items-center gap-3">
 <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
 <p className="text-sm text-dash-text2 ">Loading dashboard…</p>
 </div>
 </div>
 );
 }

 if (error || !userCtx) {
 return (
 <div className="flex h-screen w-screen items-center justify-center bg-dash-muted dark:bg-dash-deep">
 <div className="mx-4 max-w-md rounded-xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-800 dark:bg-red-950">
 <h2 className="text-lg font-semibold text-red-800 dark:text-red-200">
 Authentication Failed
 </h2>
 <p className="mt-2 text-sm text-red-600 dark:text-red-300">
 {error ?? 'Unable to verify access token'}
 </p>
 </div>
 </div>
 );
 }

 return (
 <EmbedRoleProvider
 role={userCtx.role}
 orgSlug={userCtx.orgSlug}
 orgName={userCtx.orgName}
 logoUrl={userCtx.logoUrl}
 themeColor={userCtx.themeColor}
 sectionAccess={userCtx.sectionAccess}
 >
 <EmbedDashboardShell
 user={{
 name: userCtx.name ?? userCtx.email ?? 'User',
 email: userCtx.email ?? '',
 image: userCtx.image ?? '',
 }}
 token={token}
 folderScope={folderScope ?? userCtx.folderScope ?? undefined}
 brand={brand}
 accessRules={userCtx.accessRules}
 logoUrl={userCtx.logoUrl}
 orgName={userCtx.orgName}
 embedConfig={userCtx.embedConfig}
 aiFeatureConfig={userCtx.aiFeatureConfig ?? null}
 />
 </EmbedRoleProvider>
 );
}
