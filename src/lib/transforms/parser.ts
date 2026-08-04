// SPDX-License-Identifier: Apache-2.0
/**
 * Transform URL Parser
 *
 * Parses ImageKit/Cloudinary-style URL transformation strings into
 * a typed TransformationConfig object.
 *
 * URL format: w-300,h-300,q-80,f-webp,rt-90
 * Chained: w-400,h-300:rt-90:bl-10 (colon separates pipeline steps)
 */

/* ─── Types ──────────────────────────────────────────────────── */

export type CropMode = 'fill' | 'fit' | 'cover' | 'contain' | 'thumb';
export type Gravity =
 | 'center'
 | 'face'
 | 'auto'
 | 'north'
 | 'south'
 | 'east'
 | 'west'
 | 'northeast'
 | 'northwest'
 | 'southeast'
 | 'southwest';
export type OutputFormat = 'jpeg' | 'png' | 'webp' | 'avif' | 'auto' | 'original';
export type FlipDirection = 'h' | 'v' | 'hv';

export interface TransformStep {
 // Resize
 width?: number;
 height?: number;
 crop?: CropMode;
 gravity?: Gravity;
 dpr?: number;

 // Format & Quality
 format?: OutputFormat;
 quality?: number;

 // Effects
 blur?: number;
 sharpen?: number;
 rotation?: number;
 flip?: FlipDirection;
 grayscale?: boolean;
 opacity?: number;

 // Decoration
 borderWidth?: number;
 borderColor?: string;
 radius?: number | 'max';
 background?: string;

 // Named transform reference
 named?: string;
}

export interface TransformationConfig {
 /** Pipeline of ordered transform steps (colon-separated in URL) */
 steps: TransformStep[];
 /** Raw input string for cache key generation */
 raw: string;
}

/* ─── Param Definitions ──────────────────────────────────────── */

const CROP_MODES: Set<string> = new Set([
 'fill',
 'fit',
 'cover',
 'contain',
 'thumb',
]);
const GRAVITY_VALUES: Set<string> = new Set([
 'center',
 'face',
 'auto',
 'north',
 'south',
 'east',
 'west',
 'northeast',
 'northwest',
 'southeast',
 'southwest',
]);
const FORMAT_VALUES: Set<string> = new Set([
 'jpeg',
 'jpg',
 'png',
 'webp',
 'avif',
 'auto',
 'original',
]);
const FLIP_VALUES: Set<string> = new Set(['h', 'v', 'hv']);

/* ─── Validation Ranges ──────────────────────────────────────── */

const LIMITS = {
 width: { min: 1, max: 10000 },
 height: { min: 1, max: 10000 },
 quality: { min: 1, max: 100 },
 blur: { min: 1, max: 100 },
 sharpen: { min: 1, max: 100 },
 rotation: { min: 0, max: 360 },
 dpr: { min: 1, max: 3 },
 opacity: { min: 0, max: 100 },
 borderWidth: { min: 1, max: 100 },
 radius: { min: 0, max: 5000 },
} as const;

function clamp(val: number, min: number, max: number): number {
 return Math.max(min, Math.min(max, val));
}

function isValidHexColor(color: string): boolean {
 return /^[0-9a-fA-F]{3,8}$/.test(color);
}

/* ─── Parse a Single Step ────────────────────────────────────── */

function parseStep(segment: string): TransformStep {
 const step: TransformStep = {};
 const params = segment.split(',').filter(Boolean);

 for (const param of params) {
 const dashIdx = param.indexOf('-');
 if (dashIdx === -1) continue;

 const key = param.slice(0, dashIdx);
 const value = param.slice(dashIdx + 1);

 if (!value) continue;

 switch (key) {
 /* ── Resize ──────────────────────────────────────────── */
 case 'w': {
 const n = parseInt(value, 10);
 if (!isNaN(n)) step.width = clamp(n, LIMITS.width.min, LIMITS.width.max);
 break;
 }
 case 'h': {
 const n = parseInt(value, 10);
 if (!isNaN(n))
 step.height = clamp(n, LIMITS.height.min, LIMITS.height.max);
 break;
 }
 case 'c':
 if (CROP_MODES.has(value)) step.crop = value as CropMode;
 break;
 case 'g':
 if (GRAVITY_VALUES.has(value)) step.gravity = value as Gravity;
 break;
 case 'dpr': {
 const n = parseFloat(value);
 if (!isNaN(n)) step.dpr = clamp(n, LIMITS.dpr.min, LIMITS.dpr.max);
 break;
 }

 /* ── Format & Quality ────────────────────────────────── */
 case 'f':
 case 'fmt': {
 const fmt = value.toLowerCase();
 if (FORMAT_VALUES.has(fmt))
 step.format = (fmt === 'jpg' ? 'jpeg' : fmt) as OutputFormat;
 break;
 }
 case 'q': {
 const n = parseInt(value, 10);
 if (!isNaN(n))
 step.quality = clamp(n, LIMITS.quality.min, LIMITS.quality.max);
 break;
 }

 /* ── Effects ─────────────────────────────────────────── */
 case 'bl': {
 const n = parseInt(value, 10);
 if (!isNaN(n)) step.blur = clamp(n, LIMITS.blur.min, LIMITS.blur.max);
 break;
 }
 case 'sh': {
 const n = parseInt(value, 10);
 if (!isNaN(n))
 step.sharpen = clamp(n, LIMITS.sharpen.min, LIMITS.sharpen.max);
 break;
 }
 case 'rt': {
 const n = parseInt(value, 10);
 if (!isNaN(n))
 step.rotation = clamp(n, LIMITS.rotation.min, LIMITS.rotation.max);
 break;
 }
 case 'fl':
 if (FLIP_VALUES.has(value)) step.flip = value as FlipDirection;
 break;
 case 'e': {
 if (value === 'grayscale') step.grayscale = true;
 break;
 }
 case 'o': {
 const n = parseInt(value, 10);
 if (!isNaN(n))
 step.opacity = clamp(n, LIMITS.opacity.min, LIMITS.opacity.max);
 break;
 }

 /* ── Decoration ──────────────────────────────────────── */
 case 'b': {
 // Format: {width}_{color} e.g. 5_FF0000
 const parts = value.split('_');
 if (parts.length === 2) {
 const bw = parseInt(parts[0], 10);
 if (!isNaN(bw) && isValidHexColor(parts[1])) {
 step.borderWidth = clamp(
 bw,
 LIMITS.borderWidth.min,
 LIMITS.borderWidth.max,
 );
 step.borderColor = parts[1];
 }
 }
 break;
 }
 case 'r': {
 if (value === 'max') {
 step.radius = 'max';
 } else {
 const n = parseInt(value, 10);
 if (!isNaN(n))
 step.radius = clamp(n, LIMITS.radius.min, LIMITS.radius.max);
 }
 break;
 }
 case 'bg':
 if (isValidHexColor(value)) step.background = value;
 break;

 /* ── Named Transform ─────────────────────────────────── */
 case 'n':
 if (/^[a-zA-Z0-9_-]{1,64}$/.test(value)) step.named = value;
 break;

 default:
 // Unknown params are silently ignored for forward-compatibility
 break;
 }
 }

 return step;
}

/* ─── Public API ─────────────────────────────────────────────── */

/**
 * Parse a transformation URL string into a TransformationConfig.
 *
 * @param transformString — e.g. "w-300,h-300,q-80,f-webp" or "w-400,h-300:rt-90:bl-10"
 * @returns TransformationConfig with ordered steps
 */
export function parseTransforms(transformString: string): TransformationConfig {
 if (!transformString || transformString === '_') {
 return { steps: [], raw: transformString ?? '' };
 }

 // Split by colon for chained steps
 const segments = transformString.split(':').filter(Boolean);
 const steps = segments.map(parseStep);

 return { steps, raw: transformString };
}

/**
 * Check if a transformation config has any actual transforms to apply.
 */
export function hasTransforms(config: TransformationConfig): boolean {
 return config.steps.some(
 (step) => Object.keys(step).length > 0,
 );
}

/**
 * Merge all steps into a single flat config (last value wins for conflicts).
 * Useful when the pipeline has no order dependency.
 */
export function flattenSteps(config: TransformationConfig): TransformStep {
 const merged: TransformStep = {};
 for (const step of config.steps) {
 Object.assign(merged, step);
 }
 return merged;
}

export { LIMITS as TRANSFORM_LIMITS };
