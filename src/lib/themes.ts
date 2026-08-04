// SPDX-License-Identifier: Apache-2.0
/**
 * Multi-color theme system for img-man.
 *
 * Each color has light and dark mode variants.
 * The org selects a primary color in Settings, and each user
 * can toggle dark/light mode via the shell header icon.
 */

export interface ThemeColor {
 id: string;
 name: string;
 /** Preview swatch color (hex) */
 swatch: string;
 light: {
 primary: string;
 primaryHover: string;
 primaryLight: string;
 primaryForeground: string;
 };
 dark: {
 primary: string;
 primaryHover: string;
 primaryLight: string;
 primaryForeground: string;
 };
}

export const THEME_COLORS: ThemeColor[] = [
 {
 id: 'violet',
 name: 'Violet',
 swatch: '#8b5cf6',
 light: { primary: '#8b5cf6', primaryHover: '#7c3aed', primaryLight: '#ede9fe', primaryForeground: '#ffffff' },
 dark: { primary: '#a78bfa', primaryHover: '#8b5cf6', primaryLight: '#1e1533', primaryForeground: '#ffffff' },
 },
 {
 id: 'blue',
 name: 'Blue',
 swatch: '#3b82f6',
 light: { primary: '#3b82f6', primaryHover: '#2563eb', primaryLight: '#dbeafe', primaryForeground: '#ffffff' },
 dark: { primary: '#60a5fa', primaryHover: '#3b82f6', primaryLight: '#172554', primaryForeground: '#ffffff' },
 },
 {
 id: 'emerald',
 name: 'Emerald',
 swatch: '#10b981',
 light: { primary: '#10b981', primaryHover: '#059669', primaryLight: '#d1fae5', primaryForeground: '#ffffff' },
 dark: { primary: '#34d399', primaryHover: '#10b981', primaryLight: '#022c22', primaryForeground: '#ffffff' },
 },
 {
 id: 'rose',
 name: 'Rose',
 swatch: '#f43f5e',
 light: { primary: '#f43f5e', primaryHover: '#e11d48', primaryLight: '#ffe4e6', primaryForeground: '#ffffff' },
 dark: { primary: '#fb7185', primaryHover: '#f43f5e', primaryLight: '#4c0519', primaryForeground: '#ffffff' },
 },
 {
 id: 'orange',
 name: 'Orange',
 swatch: '#f97316',
 light: { primary: '#f97316', primaryHover: '#ea580c', primaryLight: '#ffedd5', primaryForeground: '#ffffff' },
 dark: { primary: '#fb923c', primaryHover: '#f97316', primaryLight: '#431407', primaryForeground: '#ffffff' },
 },
 {
 id: 'amber',
 name: 'Amber',
 swatch: '#f59e0b',
 light: { primary: '#f59e0b', primaryHover: '#d97706', primaryLight: '#fef3c7', primaryForeground: '#18181b' },
 dark: { primary: '#fbbf24', primaryHover: '#f59e0b', primaryLight: '#451a03', primaryForeground: '#18181b' },
 },
 {
 id: 'cyan',
 name: 'Cyan',
 swatch: '#06b6d4',
 light: { primary: '#06b6d4', primaryHover: '#0891b2', primaryLight: '#cffafe', primaryForeground: '#ffffff' },
 dark: { primary: '#22d3ee', primaryHover: '#06b6d4', primaryLight: '#083344', primaryForeground: '#ffffff' },
 },
 {
 id: 'indigo',
 name: 'Indigo',
 swatch: '#6366f1',
 light: { primary: '#6366f1', primaryHover: '#4f46e5', primaryLight: '#e0e7ff', primaryForeground: '#ffffff' },
 dark: { primary: '#818cf8', primaryHover: '#6366f1', primaryLight: '#1e1b4b', primaryForeground: '#ffffff' },
 },
];

export const DEFAULT_THEME_COLOR = 'violet';

export function getThemeById(id: string): ThemeColor {
 return THEME_COLORS.find((t) => t.id === id) ?? THEME_COLORS[0];
}
