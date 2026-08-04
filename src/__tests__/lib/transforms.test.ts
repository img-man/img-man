// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from 'vitest';
import {
 parseTransforms,
 hasTransforms,
 flattenSteps,
 TRANSFORM_LIMITS,
 type TransformationConfig,
} from '@/lib/transforms/parser';
import {
 buildTransformString,
 buildTransformUrl,
 buildSrcSet,
} from '@/lib/transforms/builder';

/* ═══════════════════════════════════════════════════════════════ *
 * PARSER *
 * ═══════════════════════════════════════════════════════════════ */

describe('parseTransforms', () => {
 it('returns empty steps for empty string', () => {
 const config = parseTransforms('');
 expect(config.steps).toHaveLength(0);
 expect(config.raw).toBe('');
 });

 it('returns empty steps for underscore (no-op)', () => {
 const config = parseTransforms('_');
 expect(config.steps).toHaveLength(0);
 expect(config.raw).toBe('_');
 });

 /* ── Resize params ───────────────────────────────────────── */

 it('parses width and height', () => {
 const { steps } = parseTransforms('w-300,h-200');
 expect(steps).toHaveLength(1);
 expect(steps[0].width).toBe(300);
 expect(steps[0].height).toBe(200);
 });

 it('clamps width/height to valid range', () => {
 const { steps } = parseTransforms('w-99999,h-0');
 expect(steps[0].width).toBe(TRANSFORM_LIMITS.width.max);
 expect(steps[0].height).toBe(TRANSFORM_LIMITS.height.min);
 });

 it('parses crop mode', () => {
 const { steps } = parseTransforms('c-cover');
 expect(steps[0].crop).toBe('cover');
 });

 it('ignores invalid crop mode', () => {
 const { steps } = parseTransforms('c-invalid');
 expect(steps[0].crop).toBeUndefined();
 });

 it('parses gravity', () => {
 const { steps } = parseTransforms('g-face');
 expect(steps[0].gravity).toBe('face');
 });

 it('parses DPR', () => {
 const { steps } = parseTransforms('dpr-2');
 expect(steps[0].dpr).toBe(2);
 });

 it('clamps DPR to 1–3', () => {
 const { steps } = parseTransforms('dpr-5');
 expect(steps[0].dpr).toBe(3);
 });

 /* ── Format & Quality ────────────────────────────────────── */

 it('parses format with f- prefix', () => {
 const { steps } = parseTransforms('f-webp');
 expect(steps[0].format).toBe('webp');
 });

 it('parses format with fmt- prefix', () => {
 const { steps } = parseTransforms('fmt-avif');
 expect(steps[0].format).toBe('avif');
 });

 it('normalises jpg to jpeg', () => {
 const { steps } = parseTransforms('f-jpg');
 expect(steps[0].format).toBe('jpeg');
 });

 it('parses quality', () => {
 const { steps } = parseTransforms('q-85');
 expect(steps[0].quality).toBe(85);
 });

 it('clamps quality to 1–100', () => {
 const { steps } = parseTransforms('q-200');
 expect(steps[0].quality).toBe(100);
 });

 /* ── Effects ─────────────────────────────────────────────── */

 it('parses blur', () => {
 const { steps } = parseTransforms('bl-15');
 expect(steps[0].blur).toBe(15);
 });

 it('parses sharpen', () => {
 const { steps } = parseTransforms('sh-50');
 expect(steps[0].sharpen).toBe(50);
 });

 it('parses rotation', () => {
 const { steps } = parseTransforms('rt-90');
 expect(steps[0].rotation).toBe(90);
 });

 it('parses flip', () => {
 const { steps } = parseTransforms('fl-hv');
 expect(steps[0].flip).toBe('hv');
 });

 it('parses grayscale effect', () => {
 const { steps } = parseTransforms('e-grayscale');
 expect(steps[0].grayscale).toBe(true);
 });

 it('parses opacity', () => {
 const { steps } = parseTransforms('o-50');
 expect(steps[0].opacity).toBe(50);
 });

 /* ── Decoration ──────────────────────────────────────────── */

 it('parses border with width and color', () => {
 const { steps } = parseTransforms('b-5_FF0000');
 expect(steps[0].borderWidth).toBe(5);
 expect(steps[0].borderColor).toBe('FF0000');
 });

 it('ignores border with invalid color', () => {
 const { steps } = parseTransforms('b-5_ZZZZZZ');
 expect(steps[0].borderWidth).toBeUndefined();
 expect(steps[0].borderColor).toBeUndefined();
 });

 it('parses numeric radius', () => {
 const { steps } = parseTransforms('r-20');
 expect(steps[0].radius).toBe(20);
 });

 it('parses max radius', () => {
 const { steps } = parseTransforms('r-max');
 expect(steps[0].radius).toBe('max');
 });

 it('parses background color', () => {
 const { steps } = parseTransforms('bg-FFFFFF');
 expect(steps[0].background).toBe('FFFFFF');
 });

 /* ── Named transform ─────────────────────────────────────── */

 it('parses named transform reference', () => {
 const { steps } = parseTransforms('n-thumbnail');
 expect(steps[0].named).toBe('thumbnail');
 });

 it('ignores invalid named transform name', () => {
 // Contains spaces → invalid
 const { steps } = parseTransforms('n-bad name');
 expect(steps[0].named).toBeUndefined();
 });

 /* ── Multi-param single step ─────────────────────────────── */

 it('parses multiple params in one step', () => {
 const { steps } = parseTransforms('w-800,h-600,c-cover,q-80,f-webp');
 expect(steps).toHaveLength(1);
 const s = steps[0];
 expect(s.width).toBe(800);
 expect(s.height).toBe(600);
 expect(s.crop).toBe('cover');
 expect(s.quality).toBe(80);
 expect(s.format).toBe('webp');
 });

 /* ── Pipeline (chained steps) ────────────────────────────── */

 it('parses colon-separated pipeline steps', () => {
 const { steps } = parseTransforms('w-400,h-300:rt-90:bl-10');
 expect(steps).toHaveLength(3);
 expect(steps[0].width).toBe(400);
 expect(steps[0].height).toBe(300);
 expect(steps[1].rotation).toBe(90);
 expect(steps[2].blur).toBe(10);
 });

 /* ── Edge cases ──────────────────────────────────────────── */

 it('ignores unknown params silently', () => {
 const { steps } = parseTransforms('w-100,unknown-value,h-200');
 expect(steps[0].width).toBe(100);
 expect(steps[0].height).toBe(200);
 // Unknown param not included
 expect(Object.keys(steps[0])).toHaveLength(2);
 });

 it('ignores params with empty values', () => {
 const { steps } = parseTransforms('w-,h-200');
 expect(steps[0].width).toBeUndefined();
 expect(steps[0].height).toBe(200);
 });

 it('preserves raw string', () => {
 const { raw } = parseTransforms('w-300,h-300');
 expect(raw).toBe('w-300,h-300');
 });
});

/* ═══════════════════════════════════════════════════════════════ *
 * hasTransforms & flattenSteps *
 * ═══════════════════════════════════════════════════════════════ */

describe('hasTransforms', () => {
 it('returns false for empty config', () => {
 expect(hasTransforms({ steps: [], raw: '' })).toBe(false);
 });

 it('returns false for steps with no actual params', () => {
 expect(hasTransforms({ steps: [{}], raw: '' })).toBe(false);
 });

 it('returns true when steps have params', () => {
 expect(hasTransforms(parseTransforms('w-300'))).toBe(true);
 });
});

describe('flattenSteps', () => {
 it('merges multiple steps, last value wins', () => {
 const config = parseTransforms('w-300,q-80:w-500,f-webp');
 const merged = flattenSteps(config);
 expect(merged.width).toBe(500); // overridden by step 2
 expect(merged.quality).toBe(80); // from step 1
 expect(merged.format).toBe('webp'); // from step 2
 });
});

/* ═══════════════════════════════════════════════════════════════ *
 * BUILDER *
 * ═══════════════════════════════════════════════════════════════ */

describe('buildTransformString', () => {
 it('builds string from single step', () => {
 const result = buildTransformString({ width: 300, height: 200, quality: 80 });
 expect(result).toBe('w-300,h-200,q-80');
 });

 it('builds colon-separated string from multiple steps', () => {
 const result = buildTransformString([
 { width: 400, height: 300 },
 { rotation: 90 },
 { blur: 10 },
 ]);
 expect(result).toBe('w-400,h-300:rt-90:bl-10');
 });

 it('includes all param types', () => {
 const result = buildTransformString({
 width: 100,
 height: 100,
 crop: 'cover',
 gravity: 'face',
 dpr: 2,
 format: 'webp',
 quality: 85,
 blur: 5,
 sharpen: 10,
 rotation: 180,
 flip: 'h',
 grayscale: true,
 opacity: 50,
 borderWidth: 3,
 borderColor: 'FF0000',
 radius: 20,
 background: 'FFFFFF',
 named: 'my-preset',
 });
 expect(result).toContain('w-100');
 expect(result).toContain('h-100');
 expect(result).toContain('c-cover');
 expect(result).toContain('g-face');
 expect(result).toContain('dpr-2');
 expect(result).toContain('f-webp');
 expect(result).toContain('q-85');
 expect(result).toContain('bl-5');
 expect(result).toContain('sh-10');
 expect(result).toContain('rt-180');
 expect(result).toContain('fl-h');
 expect(result).toContain('e-grayscale');
 expect(result).toContain('o-50');
 expect(result).toContain('b-3_FF0000');
 expect(result).toContain('r-20');
 expect(result).toContain('bg-FFFFFF');
 expect(result).toContain('n-my-preset');
 });

 it('returns empty string for empty step', () => {
 expect(buildTransformString({})).toBe('');
 });
});

describe('buildTransformUrl', () => {
 it('builds correct URL with step object', () => {
 const url = buildTransformUrl('acme-corp', { width: 300, quality: 80 }, 'uploads/photo.jpg');
 expect(url).toBe('/api/transform/acme-corp/w-300,q-80/uploads/photo.jpg');
 });

 it('builds URL with pre-built transform string', () => {
 const url = buildTransformUrl('acme-corp', 'w-300,q-80', 'uploads/photo.jpg');
 expect(url).toBe('/api/transform/acme-corp/w-300,q-80/uploads/photo.jpg');
 });

 it('uses underscore for empty transforms', () => {
 const url = buildTransformUrl('acme-corp', {}, 'uploads/photo.jpg');
 expect(url).toBe('/api/transform/acme-corp/_/uploads/photo.jpg');
 });

 it('supports custom base URL', () => {
 const url = buildTransformUrl(
 'acme-corp',
 { width: 100 },
 'photo.jpg',
 'https://cdn.example.com',
 );
 expect(url).toBe('https://cdn.example.com/api/transform/acme-corp/w-100/photo.jpg');
 });

 it('encodes org slug with special characters', () => {
 const url = buildTransformUrl('my org', { width: 100 }, 'photo.jpg');
 expect(url).toContain('my%20org');
 });
});

describe('buildSrcSet', () => {
 it('generates srcset with default breakpoints', () => {
 const srcset = buildSrcSet('acme', 'photo.jpg');
 // Default breakpoints: 320, 640, 960, 1280, 1920, 2560
 expect(srcset.split(', ')).toHaveLength(6);
 expect(srcset).toContain('320w');
 expect(srcset).toContain('1920w');
 });

 it('generates srcset with custom widths', () => {
 const srcset = buildSrcSet('acme', 'photo.jpg', [100, 200]);
 expect(srcset.split(', ')).toHaveLength(2);
 expect(srcset).toContain('100w');
 expect(srcset).toContain('200w');
 });

 it('includes base transform params in each variant', () => {
 const srcset = buildSrcSet('acme', 'photo.jpg', [320], { quality: 80 });
 expect(srcset).toContain('q-80');
 expect(srcset).toContain('w-320');
 });
});

/* ═══════════════════════════════════════════════════════════════ *
 * ROUNDTRIP: parse → build → parse *
 * ═══════════════════════════════════════════════════════════════ */

describe('roundtrip parse → build → parse', () => {
 it('preserves params through roundtrip', () => {
 const input = 'w-300,h-200,c-cover,q-85,f-webp';
 const config = parseTransforms(input);
 const rebuilt = buildTransformString(config.steps);
 const reparsed = parseTransforms(rebuilt);

 expect(reparsed.steps[0].width).toBe(300);
 expect(reparsed.steps[0].height).toBe(200);
 expect(reparsed.steps[0].crop).toBe('cover');
 expect(reparsed.steps[0].quality).toBe(85);
 expect(reparsed.steps[0].format).toBe('webp');
 });

 it('preserves pipeline through roundtrip', () => {
 const input = 'w-400,h-300:rt-90:bl-10,e-grayscale';
 const config = parseTransforms(input);
 const rebuilt = buildTransformString(config.steps);
 const reparsed = parseTransforms(rebuilt);

 expect(reparsed.steps).toHaveLength(3);
 expect(reparsed.steps[0].width).toBe(400);
 expect(reparsed.steps[1].rotation).toBe(90);
 expect(reparsed.steps[2].blur).toBe(10);
 expect(reparsed.steps[2].grayscale).toBe(true);
 });
});
