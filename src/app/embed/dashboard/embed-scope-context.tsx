// SPDX-License-Identifier: Apache-2.0
'use client';

import { createContext, useContext, type ReactNode } from 'react';

/**
 * EmbedScopeContext — Provides folder scoping to lazy-loaded dashboard pages.
 *
 * When the embed is loaded with a `folder` param (wedding's root folder ID),
 * the dashboard Assets page should start at that folder and prevent navigation
 * above it. This context bridges the gap between the embed shell (which knows
 * the folder scope) and the lazy-loaded dashboard page (which normally starts
 * at root).
 */

interface EmbedScopeValue {
 /** The folder ID to scope the Assets view to (null = show everything) */
 folderScope: string | null;
 /** Whether the current rendering is inside the embed/white-label shell */
 isEmbed: boolean;
}

const EmbedScopeContext = createContext<EmbedScopeValue>({
 folderScope: null,
 isEmbed: false,
});

export function EmbedScopeProvider({
 children,
 folderScope,
}: {
 children: ReactNode;
 folderScope: string | null;
}) {
 return (
 <EmbedScopeContext.Provider value={{ folderScope, isEmbed: true }}>
 {children}
 </EmbedScopeContext.Provider>
 );
}

/**
 * Hook to read the embed folder scope.
 * Returns `{ folderScope: null }` when not inside an embed context.
 */
export function useEmbedScope() {
 return useContext(EmbedScopeContext);
}
