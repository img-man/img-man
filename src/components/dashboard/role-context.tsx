// SPDX-License-Identifier: Apache-2.0
'use client';

import {
 createContext,
 useContext,
 useEffect,
 useState,
 type ReactNode,
} from 'react';
import { canPerform, ROLE_LEVEL, type Role, type Action } from '@/lib/permissions';
import { DEFAULT_THEME_COLOR } from '@/lib/themes';

interface RoleContextValue {
 role: Role;
 orgSlug: string;
 orgName: string;
 logoUrl: string | null;
 themeColor: string;
 loading: boolean;
 /** Convenience: check if the current role can perform an action. */
 can: (action: Action) => boolean;
 /** Check if the current role can access a dashboard section. */
 canAccessSection: (sectionKey: string) => boolean;
 sectionAccess: Record<string, number>;
}

const RoleContext = createContext<RoleContextValue>({
 role: 'viewer',
 orgSlug: '',
 orgName: '',
 logoUrl: null,
 themeColor: DEFAULT_THEME_COLOR,
 loading: true,
 can: () => false,
 canAccessSection: () => true,
 sectionAccess: {},
});

/** Re-export the context so the embed provider can set the same values. */
export { RoleContext };
export type { RoleContextValue };

export function RoleProvider({ children }: { children: ReactNode }) {
 const [role, setRole] = useState<Role>('viewer');
 const [orgSlug, setOrgSlug] = useState('');
 const [orgName, setOrgName] = useState('');
 const [logoUrl, setLogoUrl] = useState<string | null>(null);
 const [themeColor, setThemeColor] = useState(DEFAULT_THEME_COLOR);
 const [loading, setLoading] = useState(true);
 const [sectionAccess, setSectionAccess] = useState<Record<string, number>>({});

 useEffect(() => {
 async function fetchRole() {
 try {
 const res = await fetch('/api/auth/me');
 if (res.ok) {
 const data = await res.json();
 setRole(data.role ?? 'viewer');
 setOrgSlug(data.orgSlug ?? '');
 setOrgName(data.orgName ?? '');
 setLogoUrl(data.logoUrl ?? null);
 setThemeColor(data.themeColor ?? DEFAULT_THEME_COLOR);
 setSectionAccess(data.sectionAccess ?? {});
 // Set theme color attribute on html
 if (data.themeColor) {
 document.documentElement.setAttribute('data-theme-color', data.themeColor);
 }
 }
 } catch {
 // Default to viewer on error (most restrictive)
 } finally {
 setLoading(false);
 }
 }
 fetchRole();
 }, []);

 const can = (action: Action) => canPerform(role, action);
 const canAccessSection = (sectionKey: string) => {
 const minRole = sectionAccess[sectionKey];
 if (minRole === undefined) return true; // No restriction configured
 return ROLE_LEVEL[role] >= minRole;
 };

 return (
 <RoleContext.Provider value={{ role, orgSlug, orgName, logoUrl, themeColor, loading, can, canAccessSection, sectionAccess }}>
 {children}
 </RoleContext.Provider>
 );
}

/**
 * Hook to access the current user's role and permission checker.
 *
 * Usage:
 * const { role, can } = useRole();
 * if (can('upload')) { ... }
 */
export function useRole() {
 return useContext(RoleContext);
}
