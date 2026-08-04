// SPDX-License-Identifier: Apache-2.0
/**
 * Transform URL Builder
 *
 * Builds ImageKit/Cloudinary-style transformation URLs from typed configs.
 *
 * Output: /api/transform/{orgSlug}/{transforms}/{storageKey}
 */

import type { TransformStep, OutputFormat, CropMode, Gravity, FlipDirection } from './parser';

/* ─── Build a single step string ─────────────────────────────── */

function buildStepString(step: TransformStep): string {
 const parts: string[] = [];

 if (step.width != null) parts.push(`w-${step.width}`);
 if (step.height != null) parts.push(`h-${step.height}`);
 if (step.crop) parts.push(`c-${step.crop}`);
 if (step.gravity) parts.push(`g-${step.gravity}`);
 if (step.dpr != null) parts.push(`dpr-${step.dpr}`);
 if (step.format) parts.push(`f-${step.format}`);
 if (step.quality != null) parts.push(`q-${step.quality}`);
 if (step.blur != null) parts.push(`bl-${step.blur}`);
 if (step.sharpen != null) parts.push(`sh-${step.sharpen}`);
 if (step.rotation != null) parts.push(`rt-${step.rotation}`);
 if (step.flip) parts.push(`fl-${step.flip}`);
 if (step.grayscale) parts.push('e-grayscale');
 if (step.opacity != null) parts.push(`o-${step.opacity}`);
 if (step.borderWidth != null && step.borderColor)
 parts.push(`b-${step.borderWidth}_${step.borderColor}`);
 if (step.radius != null) parts.push(`r-${step.radius}`);
 if (step.background) parts.push(`bg-${step.background}`);
 if (step.named) parts.push(`n-${step.named}`);

 return parts.join(',');
}

/* ─── Public API ─────────────────────────────────────────────── */

/**
 * Build a transform string from one or more transform steps.
 *
 * Single step: "w-300,h-300,q-80,f-webp"
 * Multi-step: "w-400,h-300:rt-90:bl-10"
 */
export function buildTransformString(steps: TransformStep | TransformStep[]): string {
 const arr = Array.isArray(steps) ? steps : [steps];
 return arr.map(buildStepString).filter(Boolean).join(':');
}

/**
 * Build the full transformation API URL.
 *
 * @param orgSlug — Organization slug (e.g. "acme-corp")
 * @param transforms — Transform step(s) or pre-built transform string
 * @param storageKey — GCS object key (e.g. "uploads/abc123/photo.jpg")
 * @param baseUrl — Base URL (defaults to relative path)
 *
 * @returns URL like: /api/transform/acme-corp/w-300,h-300,q-80/uploads/abc123/photo.jpg
 */
export function buildTransformUrl(
 orgSlug: string,
 transforms: TransformStep | TransformStep[] | string,
 storageKey: string,
 baseUrl = '',
): string {
 const transformString =
 typeof transforms === 'string'
 ? transforms
 : buildTransformString(transforms);

 // Encode org slug but preserve slashes in storageKey
 const encodedSlug = encodeURIComponent(orgSlug);
 const encodedTransforms = transformString || '_';
 // storageKey may contain slashes, keep them
 const encodedKey = storageKey
 .split('/')
 .map(encodeURIComponent)
 .join('/');

 return `${baseUrl}/api/transform/${encodedSlug}/${encodedTransforms}/${encodedKey}`;
}

/**
 * Build a srcSet string for responsive images.
 *
 * @param orgSlug
 * @param storageKey
 * @param widths — Array of widths (defaults to standard breakpoints)
 * @param baseTransform — Additional transform params to include in each variant
 * @param baseUrl
 */
export function buildSrcSet(
 orgSlug: string,
 storageKey: string,
 widths: number[] = [320, 640, 960, 1280, 1920, 2560],
 baseTransform: Partial<TransformStep> = {},
 baseUrl = '',
): string {
 return widths
 .map((w) => {
 const step: TransformStep = {
 ...baseTransform,
 width: w,
 format: baseTransform.format ?? 'auto',
 };
 const url = buildTransformUrl(orgSlug, step, storageKey, baseUrl);
 return `${url} ${w}w`;
 })
 .join(', ');
}

export type { TransformStep, OutputFormat, CropMode, Gravity, FlipDirection };
