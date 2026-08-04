// SPDX-License-Identifier: Apache-2.0
'use client';

import { useContext, useMemo, useEffect, type ReactNode } from 'react';
import { canPerform, ROLE_LEVEL, type Role, type Action } from '@/lib/permissions';
import { getThemeById } from '@/lib/themes';
import { RoleContext, type RoleContextValue } from '@/components/dashboard/role-context';

/**
 * EmbedRoleProvider — Like the dashboard RoleProvider but pre-seeded
 * with values from the access token instead of fetching /api/auth/me.
 *
 * IMPORTANT: This provides values via the SAME RoleContext that useRole()
 * reads from, so existing dashboard page components work in the embed.
 */

interface EmbedRoleProviderProps {
 children: ReactNode;
 role: string;
 orgSlug: string;
 orgName: string;
 logoUrl: string | null;
 themeColor: string;
 sectionAccess: Record<string, number>;
}

export function EmbedRoleProvider({
 children,
 role: roleStr,
 orgSlug,
 orgName,
 logoUrl,
 themeColor,
 sectionAccess,
}: EmbedRoleProviderProps) {
 const role = (roleStr as Role) || 'viewer';

 // Apply theme color to DOM
 useEffect(() => {
 const theme = getThemeById(themeColor);
 document.documentElement.setAttribute('data-theme-color', theme.id);
 }, [themeColor]);

 const can = useMemo(
 () => (action: Action) => canPerform(role, action),
 [role],
 );

 const canAccessSection = useMemo(
 () => (sectionKey: string) => {
 const minRole = sectionAccess[sectionKey];
 if (minRole === undefined) return true;
 return ROLE_LEVEL[role] >= minRole;
 },
 [role, sectionAccess],
 );

 const value: RoleContextValue = useMemo(
 () => ({
 role,
 orgSlug,
 orgName,
 logoUrl,
 themeColor,
 loading: false,
 can,
 canAccessSection,
 sectionAccess,
 }),
 [role, orgSlug, orgName, logoUrl, themeColor, can, canAccessSection, sectionAccess],
 );

 // Provide via the SAME RoleContext that useRole() reads from
 return (
 <RoleContext.Provider value={value}>
 {children}
 </RoleContext.Provider>
 );
}

/**
 * Alias for useRole() but scoped to embed context naming.
 * Uses the exact same RoleContext, so this is functionally identical to useRole().
 */
export function useEmbedRole() {
 return useContext(RoleContext);
}
