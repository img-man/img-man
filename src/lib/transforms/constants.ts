// SPDX-License-Identifier: Apache-2.0
/**
 * Transform Definitions & Presets
 *
 * Comprehensive reference for all supported URL transform parameters.
 * Used by:
 * - AI Transform Generator (system prompt context)
 * - API docs page (transform reference table)
 * - SDK documentation
 */

/* ─── Transform Definition Type ──────────────────────────────── */

export interface TransformDefinition {
 /** URL parameter key (e.g. "w", "h", "q") */
 key: string;
 /** Alternative key aliases (e.g. "fmt" for "f") */
 aliases?: string[];
 /** Human-readable name */
 name: string;
 /** Description of what this transform does */
 description: string;
 /** Category grouping */
 category: 'resize' | 'format' | 'effects' | 'decoration' | 'reference';
 /** Parameter value type */
 type: 'number' | 'enum' | 'string' | 'boolean' | 'composite';
 /** Allowed enum values (when type is 'enum') */
 values?: string[];
 /** Min value (when type is 'number') */
 min?: number;
 /** Max value (when type is 'number') */
 max?: number;
 /** Default value when not specified */
 default?: string | number | boolean;
 /** Example usage in URL transform string */
 example: string;
 /** Detailed usage notes */
 notes?: string;
}

export interface TransformPreset {
 /** Preset name */
 name: string;
 /** Description */
 description: string;
 /** The transform string */
 transform: string;
 /** Use case tags */
 tags: string[];
}

/* ─── Transform Definitions ──────────────────────────────────── */

export const TRANSFORM_DEFINITIONS: TransformDefinition[] = [
 // ── Resize ──
 {
 key: 'w',
 name: 'Width',
 description: 'Resize image width in pixels.',
 category: 'resize',
 type: 'number',
 min: 1,
 max: 10000,
 example: 'w-300',
 notes: 'If only width is set, height auto-scales to preserve aspect ratio.',
 },
 {
 key: 'h',
 name: 'Height',
 description: 'Resize image height in pixels.',
 category: 'resize',
 type: 'number',
 min: 1,
 max: 10000,
 example: 'h-200',
 notes: 'If only height is set, width auto-scales to preserve aspect ratio.',
 },
 {
 key: 'c',
 name: 'Crop Mode',
 description:
 'How the image is cropped/fitted when both width and height are specified.',
 category: 'resize',
 type: 'enum',
 values: ['fill', 'fit', 'cover', 'contain', 'thumb'],
 default: 'fill',
 example: 'c-cover',
 notes:
 'fill: exact dimensions, may crop. fit: fits within bounds, no crop. cover: covers area, may crop. contain: fits and pads. thumb: smart thumbnail crop.',
 },
 {
 key: 'g',
 name: 'Gravity',
 description:
 'Focus point for cropping. Determines which part of the image is kept.',
 category: 'resize',
 type: 'enum',
 values: [
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
 ],
 default: 'center',
 example: 'g-face',
 notes:
 'face: uses face detection to crop around faces. auto: smart crop based on content.',
 },
 {
 key: 'dpr',
 name: 'Device Pixel Ratio',
 description:
 'Multiplier for retina/HiDPI displays. Multiplies width and height.',
 category: 'resize',
 type: 'number',
 min: 1,
 max: 3,
 default: 1,
 example: 'dpr-2',
 notes: 'Use 2 for retina displays, 3 for ultra-high density.',
 },

 // ── Format & Quality ──
 {
 key: 'f',
 aliases: ['fmt'],
 name: 'Format',
 description: 'Output image format.',
 category: 'format',
 type: 'enum',
 values: ['jpeg', 'png', 'webp', 'avif', 'auto', 'original'],
 default: 'auto',
 example: 'f-webp',
 notes:
 'auto: serves best format based on browser support (webp > jpeg). original: keeps source format. jpg is an alias for jpeg.',
 },
 {
 key: 'q',
 name: 'Quality',
 description: 'Compression quality for lossy formats (jpeg, webp, avif).',
 category: 'format',
 type: 'number',
 min: 1,
 max: 100,
 default: 80,
 example: 'q-80',
 notes: '80 is a good balance. 60-70 for thumbnails. 90+ for high-quality.',
 },

 // ── Effects ──
 {
 key: 'bl',
 name: 'Blur',
 description: 'Apply Gaussian blur effect.',
 category: 'effects',
 type: 'number',
 min: 1,
 max: 100,
 example: 'bl-10',
 notes: '1-5: subtle. 10-30: moderate. 50+: heavy blur for backgrounds.',
 },
 {
 key: 'sh',
 name: 'Sharpen',
 description: 'Apply sharpening to the image.',
 category: 'effects',
 type: 'number',
 min: 1,
 max: 100,
 example: 'sh-20',
 notes: '10-30: subtle enhancement. 50+: aggressive sharpening.',
 },
 {
 key: 'rt',
 name: 'Rotation',
 description: 'Rotate the image by the specified degrees.',
 category: 'effects',
 type: 'number',
 min: 0,
 max: 360,
 default: 0,
 example: 'rt-90',
 notes: 'Common values: 90, 180, 270. Supports any angle 0-360.',
 },
 {
 key: 'fl',
 name: 'Flip',
 description: 'Flip/mirror the image.',
 category: 'effects',
 type: 'enum',
 values: ['h', 'v', 'hv'],
 example: 'fl-h',
 notes: 'h: horizontal mirror. v: vertical flip. hv: both.',
 },
 {
 key: 'e',
 name: 'Effect',
 description: 'Apply a visual effect to the image.',
 category: 'effects',
 type: 'enum',
 values: ['grayscale'],
 example: 'e-grayscale',
 notes: 'Currently supports grayscale only. More effects coming soon.',
 },
 {
 key: 'o',
 name: 'Opacity',
 description: 'Set image opacity/transparency.',
 category: 'effects',
 type: 'number',
 min: 0,
 max: 100,
 default: 100,
 example: 'o-50',
 notes: '0: fully transparent. 100: fully opaque. Requires PNG/WebP output.',
 },

 // ── Decoration ──
 {
 key: 'b',
 name: 'Border',
 description: 'Add a border around the image.',
 category: 'decoration',
 type: 'composite',
 example: 'b-5_FF0000',
 notes:
 'Format: {width}_{hexColor}. Example: b-5_FF0000 adds a 5px red border. Width range: 1-100.',
 },
 {
 key: 'r',
 name: 'Border Radius',
 description: 'Round the corners of the image.',
 category: 'decoration',
 type: 'number',
 min: 0,
 max: 5000,
 example: 'r-20',
 notes:
 'Use "max" for a perfect circle: r-max. Requires PNG/WebP output to preserve transparency.',
 },
 {
 key: 'bg',
 name: 'Background',
 description:
 'Set a background color (visible with padding, radius, or transparent images).',
 category: 'decoration',
 type: 'string',
 example: 'bg-FFFFFF',
 notes:
 'Hex color without # prefix. Supports 3, 6, or 8 character hex codes. Example: bg-FF5733.',
 },

 // ── Named Transform Reference ──
 {
 key: 'n',
 name: 'Named Transform',
 description: 'Apply a pre-saved named transform preset.',
 category: 'reference',
 type: 'string',
 example: 'n-thumbnail',
 notes:
 'References a saved transform by name. Alphanumeric, hyphens, and underscores only. Max 64 characters.',
 },
];

/* ─── Example Presets ────────────────────────────────────────── */

export const TRANSFORM_PRESETS: TransformPreset[] = [
 {
 name: 'Thumbnail',
 description: 'Small square thumbnail for grids and lists.',
 transform: 'w-200,h-200,c-thumb,g-auto,q-80,f-webp',
 tags: ['thumbnail', 'grid', 'list'],
 },
 {
 name: 'Profile Avatar',
 description: 'Circular profile picture with face detection.',
 transform: 'w-150,h-150,c-fill,g-face,r-max,q-85,f-webp',
 tags: ['avatar', 'profile', 'user'],
 },
 {
 name: 'Social Card (OG Image)',
 description: 'Open Graph / Social media card image.',
 transform: 'w-1200,h-630,c-fill,g-auto,q-85,f-jpeg',
 tags: ['og', 'social', 'meta', 'twitter'],
 },
 {
 name: 'Hero Banner',
 description: 'Full-width hero banner for websites.',
 transform: 'w-1920,h-600,c-cover,g-center,q-85,f-webp',
 tags: ['banner', 'hero', 'header'],
 },
 {
 name: 'Product Card',
 description: 'E-commerce product card image.',
 transform: 'w-400,h-400,c-contain,bg-FFFFFF,q-90,f-webp',
 tags: ['product', 'ecommerce', 'card'],
 },
 {
 name: 'Retina Thumbnail',
 description: 'HiDPI thumbnail for retina displays.',
 transform: 'w-200,h-200,c-thumb,g-auto,dpr-2,q-75,f-webp',
 tags: ['retina', 'hidpi', 'thumbnail'],
 },
 {
 name: 'Blurred Background',
 description: 'Heavily blurred version for background overlays.',
 transform: 'w-800,h-600,c-fill,bl-40,q-60,f-webp',
 tags: ['background', 'blur', 'overlay'],
 },
 {
 name: 'Grayscale Portrait',
 description: 'Black & white portrait with face detection.',
 transform: 'w-600,h-800,c-fill,g-face,e-grayscale,q-85,f-jpeg',
 tags: ['grayscale', 'portrait', 'bw'],
 },
 {
 name: 'Instagram Square',
 description: 'Instagram-optimized square post.',
 transform: 'w-1080,h-1080,c-fill,g-auto,q-90,f-jpeg',
 tags: ['instagram', 'square', 'social'],
 },
 {
 name: 'Instagram Story',
 description: 'Instagram story dimensions.',
 transform: 'w-1080,h-1920,c-fill,g-center,q-85,f-jpeg',
 tags: ['instagram', 'story', 'vertical'],
 },
 {
 name: 'Email-Safe',
 description: 'Email-compatible image with max width and JPEG format.',
 transform: 'w-600,q-75,f-jpeg',
 tags: ['email', 'newsletter'],
 },
 {
 name: 'Favicon',
 description: 'Tiny square icon.',
 transform: 'w-32,h-32,c-fill,g-center,f-png',
 tags: ['favicon', 'icon'],
 },
];

/* ─── Helper: Build AI Prompt Context ────────────────────────── */

/**
 * Generates a concise text reference of all transform keys for use in
 * AI model system prompts.
 */
export function buildTransformPromptContext(): string {
 const lines = TRANSFORM_DEFINITIONS.map((d) => {
 let def = `- ${d.key}: ${d.name} — ${d.description}`;
 if (d.aliases?.length) def += ` (aliases: ${d.aliases.join(', ')})`;
 if (d.type === 'enum' && d.values)
 def += ` Values: ${d.values.join(', ')}.`;
 if (d.type === 'number') {
 if (d.min !== undefined && d.max !== undefined)
 def += ` Range: ${d.min}-${d.max}.`;
 if (d.default !== undefined) def += ` Default: ${d.default}.`;
 }
 if (d.type === 'composite' && d.notes) def += ` ${d.notes}`;
 def += ` Example: ${d.example}`;
 return def;
 });

 return [
 'Supported URL Transform Parameters:',
 'Format: key-value pairs separated by commas. Chain multiple steps with colons.',
 'Example: w-400,h-300,c-fill,q-80,f-webp or w-800:rt-90:bl-10',
 '',
 ...lines,
 '',
 'Rules:',
 '- Combine params with commas: w-300,h-300,q-80',
 '- Chain independent steps with colons: w-400,h-300:rt-90',
 '- Hex colors without # prefix: bg-FF5733, b-3_000000',
 '- r-max creates a perfect circle',
 '- f-auto serves best format based on browser support',
 ].join('\n');
}
