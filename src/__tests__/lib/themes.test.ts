// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from 'vitest';
import {
  THEME_COLORS,
  DEFAULT_THEME_COLOR,
  getThemeById,
} from '@/lib/themes';

describe('THEME_COLORS', () => {
  it('has at least 4 colors', () => {
    expect(THEME_COLORS.length).toBeGreaterThanOrEqual(4);
  });

  it('each color has required fields', () => {
    for (const theme of THEME_COLORS) {
      expect(theme.id, `${theme.id} should have id`).toBeTruthy();
      expect(theme.name, `${theme.id} should have name`).toBeTruthy();
      expect(theme.swatch, `${theme.id} should have swatch`).toMatch(/^#[0-9a-f]{6}$/i);
      expect(theme.light, `${theme.id} should have light`).toBeDefined();
      expect(theme.dark, `${theme.id} should have dark`).toBeDefined();
    }
  });

  it('each color has light and dark primary values', () => {
    for (const theme of THEME_COLORS) {
      expect(theme.light.primary).toBeTruthy();
      expect(theme.light.primaryHover).toBeTruthy();
      expect(theme.light.primaryLight).toBeTruthy();
      expect(theme.light.primaryForeground).toBeTruthy();
      expect(theme.dark.primary).toBeTruthy();
      expect(theme.dark.primaryHover).toBeTruthy();
      expect(theme.dark.primaryLight).toBeTruthy();
      expect(theme.dark.primaryForeground).toBeTruthy();
    }
  });

  it('all ids are unique', () => {
    const ids = THEME_COLORS.map((t) => t.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('includes violet, blue, emerald, and rose', () => {
    const ids = THEME_COLORS.map((t) => t.id);
    expect(ids).toContain('violet');
    expect(ids).toContain('blue');
    expect(ids).toContain('emerald');
    expect(ids).toContain('rose');
  });
});

describe('DEFAULT_THEME_COLOR', () => {
  it('is a string', () => {
    expect(typeof DEFAULT_THEME_COLOR).toBe('string');
  });

  it('matches an existing theme id', () => {
    const ids = THEME_COLORS.map((t) => t.id);
    expect(ids).toContain(DEFAULT_THEME_COLOR);
  });
});

describe('getThemeById', () => {
  it('returns the correct theme for a valid id', () => {
    const theme = getThemeById('violet');
    expect(theme.id).toBe('violet');
    expect(theme.name).toBe('Violet');
  });

  it('returns the correct theme for blue', () => {
    const theme = getThemeById('blue');
    expect(theme.id).toBe('blue');
  });

  it('falls back to the first theme for an unknown id', () => {
    const fallback = getThemeById('nonexistent-theme');
    expect(fallback).toBe(THEME_COLORS[0]);
  });

  it('falls back to the first theme for an empty string', () => {
    const fallback = getThemeById('');
    expect(fallback).toBe(THEME_COLORS[0]);
  });

  it('returns a theme with valid hex swatch color', () => {
    for (const { id } of THEME_COLORS) {
      const theme = getThemeById(id);
      expect(theme.swatch).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});
