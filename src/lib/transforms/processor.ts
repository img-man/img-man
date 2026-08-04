// SPDX-License-Identifier: Apache-2.0
/**
 * Sharp-based Image Processor
 *
 * Applies a TransformStep pipeline to an image buffer using Sharp.
 * Pipeline order: resize → crop → rotate/flip → effects → format → optimize
 */

import sharp, { type Sharp } from 'sharp';
import type { TransformStep } from './parser';

/* ─── Sharp Fit Mapping ──────────────────────────────────────── */

const CROP_TO_FIT: Record<string, sharp.FitEnum[keyof sharp.FitEnum]> = {
 fill: 'fill',
 fit: 'inside',
 cover: 'cover',
 contain: 'contain',
 thumb: 'cover', // thumb uses cover + attention gravity
};

const GRAVITY_TO_SHARP: Record<string, string> = {
 center: 'centre',
 north: 'north',
 south: 'south',
 east: 'east',
 west: 'west',
 northeast: 'northeast',
 northwest: 'northwest',
 southeast: 'southeast',
 southwest: 'southwest',
 face: 'attention', // face → Sharp attention-based (saliency)
 auto: 'attention',
};

/* ─── Format Negotiation ─────────────────────────────────────── */

export type NegotiatedFormat = 'jpeg' | 'png' | 'webp' | 'avif';

/**
 * Determine the best output format based on the requested format
 * and the client's Accept header.
 */
export function negotiateFormat(
 requestedFormat: string | undefined,
 acceptHeader?: string,
 hasAlpha?: boolean,
): NegotiatedFormat {
 if (requestedFormat && requestedFormat !== 'auto' && requestedFormat !== 'original') {
 const fmt = requestedFormat === 'jpg' ? 'jpeg' : requestedFormat;
 if (['jpeg', 'png', 'webp', 'avif'].includes(fmt)) {
 return fmt as NegotiatedFormat;
 }
 }

 if (requestedFormat === 'auto' && acceptHeader) {
 // Prefer AVIF > WebP > JPEG/PNG
 if (acceptHeader.includes('image/avif')) return 'avif';
 if (acceptHeader.includes('image/webp')) return 'webp';
 }

 // Default: if alpha channel present, use PNG; otherwise JPEG
 return hasAlpha ? 'png' : 'jpeg';
}

/**
 * Get the MIME type for a negotiated format.
 */
export function formatToMime(format: NegotiatedFormat): string {
 const map: Record<NegotiatedFormat, string> = {
 jpeg: 'image/jpeg',
 png: 'image/png',
 webp: 'image/webp',
 avif: 'image/avif',
 };
 return map[format] ?? 'image/jpeg';
}

/* ─── Process a Single Step ──────────────────────────────────── */

function applyStep(pipeline: Sharp, step: TransformStep): Sharp {
 let p = pipeline;

 /* ── Resize ──────────────────────────────────────────────── */
 const effectiveWidth = step.width
 ? Math.round(step.width * (step.dpr ?? 1))
 : undefined;
 const effectiveHeight = step.height
 ? Math.round(step.height * (step.dpr ?? 1))
 : undefined;

 if (effectiveWidth || effectiveHeight) {
 const fit = step.crop ? CROP_TO_FIT[step.crop] ?? 'cover' : 'inside';
 const position = step.gravity
 ? GRAVITY_TO_SHARP[step.gravity] ?? 'centre'
 : 'centre';

 const bg = step.background
 ? hexToRgba(step.background)
 : { r: 0, g: 0, b: 0, alpha: 0 };

 p = p.resize({
 width: effectiveWidth,
 height: effectiveHeight,
 fit: fit as keyof sharp.FitEnum,
 position,
 background: bg,
 withoutEnlargement: true, // Never upscale beyond original
 });
 }

 /* ── Rotation ────────────────────────────────────────────── */
 if (step.rotation != null && step.rotation !== 0) {
 const bg = step.background
 ? hexToRgba(step.background)
 : { r: 0, g: 0, b: 0, alpha: 0 };
 p = p.rotate(step.rotation, { background: bg });
 }

 /* ── Flip ────────────────────────────────────────────────── */
 if (step.flip) {
 if (step.flip === 'h' || step.flip === 'hv') p = p.flop(); // horizontal
 if (step.flip === 'v' || step.flip === 'hv') p = p.flip(); // vertical
 }

 /* ── Effects ─────────────────────────────────────────────── */
 if (step.blur != null) {
 // Sharp blur sigma: roughly blur_value * 0.5 gives nice results
 const sigma = Math.max(0.3, step.blur * 0.5);
 p = p.blur(sigma);
 }

 if (step.sharpen != null) {
 const sigma = Math.max(0.5, step.sharpen * 0.1);
 p = p.sharpen(sigma);
 }

 if (step.grayscale) {
 p = p.grayscale();
 }

 /* ── Corner Radius (Rounded Corners) ─────────────────────── */
 // Deferred: applied post-format as composite SVG mask — see applyRadius()

 /* ── Border ──────────────────────────────────────────────── */
 if (step.borderWidth != null && step.borderColor) {
 const bw = step.borderWidth;
 const color = hexToRgba(step.borderColor);
 p = p.extend({
 top: bw,
 bottom: bw,
 left: bw,
 right: bw,
 background: color,
 });
 }

 return p;
}

/* ─── Main Processor ─────────────────────────────────────────── */

export interface ProcessResult {
 buffer: Buffer;
 format: NegotiatedFormat;
 width: number;
 height: number;
 sizeBytes: number;
}

/**
 * Process an image through a transform pipeline.
 *
 * @param input — Source image buffer
 * @param steps — Ordered array of transform steps
 * @param outputFormat — Negotiated output format
 * @param quality — Output quality (1-100)
 */
export async function processImage(
 input: Buffer,
 steps: TransformStep[],
 outputFormat: NegotiatedFormat = 'jpeg',
 quality?: number,
): Promise<ProcessResult> {
 let pipeline = sharp(input, {
 failOnError: false,
 // Limit memory for safety (256 MB)
 limitInputPixels: 268_435_456,
 });

 // Apply each step in order
 for (const step of steps) {
 pipeline = applyStep(pipeline, step);
 }

 // Check if any step requested radius (applied after resize)
 const radiusStep = steps.find((s) => s.radius != null);
 if (radiusStep?.radius != null) {
 pipeline = await applyRadius(pipeline, radiusStep.radius);
 }

 // Apply opacity (composited as alpha channel)
 const opacityStep = steps.find((s) => s.opacity != null);
 if (opacityStep?.opacity != null && opacityStep.opacity < 100) {
 pipeline = applyOpacity(pipeline, opacityStep.opacity);
 }

 // Determine quality from last step that has it, or default
 const effectiveQuality =
 quality ??
 steps.reduce((q, s) => (s.quality != null ? s.quality : q), 80);

 // Format conversion
 switch (outputFormat) {
 case 'jpeg':
 pipeline = pipeline.jpeg({
 quality: effectiveQuality,
 mozjpeg: true,
 });
 break;
 case 'png':
 pipeline = pipeline.png({
 compressionLevel: Math.round((100 - effectiveQuality) / 10),
 });
 break;
 case 'webp':
 pipeline = pipeline.webp({
 quality: effectiveQuality,
 effort: 4,
 });
 break;
 case 'avif':
 pipeline = pipeline.avif({
 quality: effectiveQuality,
 effort: 4,
 });
 break;
 }

 const buffer = await pipeline.toBuffer();
 const metadata = await sharp(buffer).metadata();

 return {
 buffer,
 format: outputFormat,
 width: metadata.width ?? 0,
 height: metadata.height ?? 0,
 sizeBytes: buffer.length,
 };
}

/* ─── Helpers ────────────────────────────────────────────────── */

function hexToRgba(hex: string): { r: number; g: number; b: number; alpha: number } {
 const h = hex.replace('#', '');
 if (h.length === 3) {
 return {
 r: parseInt(h[0] + h[0], 16),
 g: parseInt(h[1] + h[1], 16),
 b: parseInt(h[2] + h[2], 16),
 alpha: 1,
 };
 }
 if (h.length === 6) {
 return {
 r: parseInt(h.slice(0, 2), 16),
 g: parseInt(h.slice(2, 4), 16),
 b: parseInt(h.slice(4, 6), 16),
 alpha: 1,
 };
 }
 if (h.length === 8) {
 return {
 r: parseInt(h.slice(0, 2), 16),
 g: parseInt(h.slice(2, 4), 16),
 b: parseInt(h.slice(4, 6), 16),
 alpha: parseInt(h.slice(6, 8), 16) / 255,
 };
 }
 return { r: 0, g: 0, b: 0, alpha: 1 };
}

/**
 * Apply rounded corners via SVG mask composite.
 */
async function applyRadius(
 pipeline: Sharp,
 radius: number | 'max',
): Promise<Sharp> {
 // We need to know the current dimensions after transforms
 const metadata = await pipeline.clone().metadata();
 const w = metadata.width ?? 1;
 const h = metadata.height ?? 1;

 const r = radius === 'max' ? Math.min(w, h) / 2 : Math.min(radius, Math.min(w, h) / 2);

 const mask = Buffer.from(
 `<svg width="${w}" height="${h}">
 <rect x="0" y="0" width="${w}" height="${h}" rx="${r}" ry="${r}" fill="white"/>
 </svg>`,
 );

 return pipeline.composite([
 {
 input: mask,
 blend: 'dest-in',
 },
 ]);
}

/**
 * Apply opacity by modifying the alpha channel.
 */
function applyOpacity(pipeline: Sharp, opacity: number): Sharp {
 // Ensure alpha channel exists, then apply linear transform
 return pipeline.ensureAlpha().linear(
 [1, 1, 1, opacity / 100],
 [0, 0, 0, 0],
 );
}
