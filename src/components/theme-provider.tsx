// SPDX-License-Identifier: Apache-2.0
'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { useEffect, type ReactNode } from 'react';
import { getThemeById, DEFAULT_THEME_COLOR } from '@/lib/themes';

/**
 * Applies the organization's primary color as CSS custom properties
 * on the <html> element based on [data-theme-color] and current mode.
 */
function ThemeColorInjector({ themeColor }: { themeColor: string }) {
 useEffect(() => {
 const el = document.documentElement;
 const theme = getThemeById(themeColor);
 el.setAttribute('data-theme-color', theme.id);
 }, [themeColor]);
 return null;
}

interface ThemeProviderProps {
 children: ReactNode;
 themeColor?: string;
}

export function ThemeProvider({ children, themeColor = DEFAULT_THEME_COLOR }: ThemeProviderProps) {
 return (
 <NextThemesProvider
 attribute="class"
 defaultTheme="light"
 enableSystem={false}
 disableTransitionOnChange={false}
 >
 <ThemeColorInjector themeColor={themeColor} />
 {children}
 </NextThemesProvider>
 );
}
