// SPDX-License-Identifier: Apache-2.0
/**
 * Static definition of the onboarding-tour steps.
 *
 * Each step targets a stable `data-tour-id` attribute rendered somewhere
 * inside the dashboard chrome. If the target is missing at the moment the
 * step would render (e.g. user is on a route that doesn't include it, or
 * a permission gate hides it), the step is silently skipped.
 */

export type TourStep = {
  id: string;
  /**
   * CSS selector resolved at runtime. We always use `[data-tour-id="..."]`.
   * `null` means "no anchor — render as a centered modal".
   */
  selector: string | null;
  title: string;
  body: string;
  /** Optional placement hint; the renderer may ignore it if it doesn't fit. */
  placement?: 'right' | 'bottom' | 'left' | 'top' | 'center';
};

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    selector: null,
    placement: 'center',
    title: 'Welcome to img-man',
    body: 'Upload, organize, design, and deliver — in one place. This 90-second tour shows you the basics.',
  },
  {
    id: 'assets',
    selector: '[data-tour-id="nav-assets"]',
    placement: 'right',
    title: 'Your library',
    body: 'Drag files here, paste, or import from a URL. Every file becomes an asset with AI tags and a public URL.',
  },
  {
    id: 'smart-albums',
    selector: '[data-tour-id="nav-smart_albums"]',
    placement: 'right',
    title: 'Smart Albums',
    body: 'Auto-populated collections by rule — colors, dates, tags, faces.',
  },
  {
    id: 'designs',
    selector: '[data-tour-id="nav-designs"]',
    placement: 'right',
    title: 'Design Studio',
    body: 'Create social posts, banners, and thumbnails. Templates included.',
  },
  {
    id: 'ai-studio',
    selector: '[data-tour-id="nav-ai_studio"]',
    placement: 'right',
    title: 'AI Studio',
    body: 'Background remove, upscale, expand, generate — using your own keys (BYOK) or our managed quota.',
  },
  {
    id: 'tools',
    selector: '[data-tour-id="nav-tools"]',
    placement: 'right',
    title: 'Tools',
    body: 'PDF merge/split/compress, OCR, format conversion.',
  },
  {
    id: 'shares',
    selector: '[data-tour-id="nav-shares"]',
    placement: 'right',
    title: 'Share & deliver',
    body: 'Every asset has a stable img-man URL with on-the-fly resize. Or create an expiring share link.',
  },
  {
    id: 'api-keys',
    selector: '[data-tour-id="nav-api_keys"]',
    placement: 'right',
    title: 'For developers',
    body: 'Build with the REST API or drop the Embed SDK into your site.',
  },
  {
    id: 'finish',
    selector: null,
    placement: 'center',
    title: "You're set",
    body: 'Replay this tour anytime from the user menu.',
  },
];
