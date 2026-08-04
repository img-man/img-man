// SPDX-License-Identifier: Apache-2.0
/**
 * Link Engine — Phase 3, Week 10
 *
 * Manages hyperlink annotations (external URLs and internal page links).
 * Provides creation, validation, and navigation helpers.
 */

import type { LinkAnnotation, LinkConfig } from '../types';
import { generateAnnotationId } from './annotation-serializer';
import { DEFAULT_LINK_BORDER_COLOR } from '../constants';

/* ──────────────────────── Link Factory ──────────────────────── */

/**
 * Create an external URL link annotation.
 */
export function createUrlLink(
  page: number,
  x: number,
  y: number,
  width: number,
  height: number,
  url: string,
  overrides?: Partial<LinkAnnotation>,
): LinkAnnotation {
  return {
    id: generateAnnotationId(),
    kind: 'link',
    page,
    x,
    y,
    width,
    height,
    rotation: 0,
    opacity: 1,
    locked: false,
    visible: true,
    url: normalizeUrl(url),
    isInternal: false,
    borderColor: DEFAULT_LINK_BORDER_COLOR,
    ...overrides,
  };
}

/**
 * Create an internal page link annotation.
 */
export function createInternalLink(
  page: number,
  x: number,
  y: number,
  width: number,
  height: number,
  targetPage: number,
  overrides?: Partial<LinkAnnotation>,
): LinkAnnotation {
  return {
    id: generateAnnotationId(),
    kind: 'link',
    page,
    x,
    y,
    width,
    height,
    rotation: 0,
    opacity: 1,
    locked: false,
    visible: true,
    url: `#page=${targetPage}`,
    isInternal: true,
    targetPage,
    borderColor: DEFAULT_LINK_BORDER_COLOR,
    ...overrides,
  };
}

/**
 * Create a link annotation from a LinkConfig.
 */
export function createLinkFromConfig(
  page: number,
  x: number,
  y: number,
  width: number,
  height: number,
  config: LinkConfig,
): LinkAnnotation {
  if (config.isInternal && config.targetPage) {
    return createInternalLink(page, x, y, width, height, config.targetPage, {
      borderColor: config.borderColor,
    });
  }
  return createUrlLink(page, x, y, width, height, config.url, {
    borderColor: config.borderColor,
  });
}

/* ──────────────────────── URL Validation ──────────────────────── */

/**
 * Normalize a URL by adding https:// if no protocol is specified.
 */
export function normalizeUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return '';

  // Internal page links
  if (trimmed.startsWith('#page=')) return trimmed;

  // Already has protocol
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('mailto:')) return trimmed;
  if (trimmed.startsWith('tel:')) return trimmed;

  // Add https://
  return `https://${trimmed}`;
}

/**
 * Validate that a URL is well-formed.
 */
export function isValidUrl(url: string): boolean {
  if (!url) return false;

  // Internal page link
  if (/^#page=\d+$/.test(url)) return true;

  // Email
  if (url.startsWith('mailto:')) return true;

  // Phone
  if (url.startsWith('tel:')) return true;

  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate an internal page link target.
 */
export function isValidInternalLink(
  targetPage: number,
  totalPages: number,
): boolean {
  return (
    Number.isInteger(targetPage) && targetPage >= 1 && targetPage <= totalPages
  );
}

/* ──────────────────────── Link Navigation ──────────────────────── */

/**
 * Handle link click — navigates to URL or internal page.
 * Returns the target page number for internal links, or null for external.
 */
export function resolveLink(
  link: LinkAnnotation,
): { type: 'external'; url: string } | { type: 'internal'; page: number } {
  if (link.isInternal && link.targetPage) {
    return { type: 'internal', page: link.targetPage };
  }
  return { type: 'external', url: link.url };
}

/**
 * Open an external link in a new tab.
 */
export function openExternalLink(url: string): void {
  if (typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

/**
 * Get all links on a specific page.
 */
export function getLinksOnPage(
  annotations: Map<number, import('../types').Annotation[]>,
  page: number,
): LinkAnnotation[] {
  const pageAnnotations = annotations.get(page) ?? [];
  return pageAnnotations.filter((a): a is LinkAnnotation => a.kind === 'link');
}
