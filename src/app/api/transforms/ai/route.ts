// SPDX-License-Identifier: Apache-2.0
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { buildTransformPromptContext } from '@/lib/transforms/constants';

/**
 * POST /api/transforms/ai
 * Body: { prompt: string }
 *
 * Uses Vertex AI (Gemini) to interpret a natural language description
 * and return a URL transform string (e.g. "w-300,h-300,q-80,f-webp").
 */
export async function POST(req: NextRequest) {
 const session = await getSession();
 if (!session?.user?.email) {
 return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
 }

 const { prompt } = await req.json();
 if (!prompt?.trim()) {
 return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
 }

 const transformReference = buildTransformPromptContext();

 const systemPrompt = `You are an image transformation assistant for the img-man platform.

Given a natural language description of desired image transformations, return ONLY a URL transform string using the supported parameters below. Do NOT return JSON, explanations, or markdown — only the raw transform string.

${transformReference}

IMPORTANT RULES:
1. Return ONLY the transform string, nothing else. No quotes, no backticks, no explanation.
2. If the user does not specify a detail, use sensible defaults:
 - Quality: 80
 - Format: webp
 - Crop: fill (when both width & height given)
 - Gravity: center
3. Combine related params with commas: w-300,h-300,q-80,f-webp
4. Use colons to chain independent steps: w-400,h-300:rt-90
5. Always use the shortest key form (w not width, h not height, etc.)

Examples:
- "make a 400x400 thumbnail" → w-400,h-400,c-thumb,g-auto,q-80,f-webp
- "convert to webp with high quality" → q-90,f-webp
- "blur the image slightly and make it grayscale" → bl-15,e-grayscale
- "HD social card" → w-1200,h-630,c-cover,g-auto,q-85,f-jpeg
- "make it 300 wide and rotate 90 degrees" → w-300,q-80,f-webp:rt-90
- "circular profile picture" → w-200,h-200,c-fill,g-face,r-max,q-85,f-webp`;

 try {
 const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_AI_API_KEY;

 if (!apiKey) {
 const transform = parsePromptFallback(prompt);
 return NextResponse.json({ transform, source: 'fallback' });
 }

 const res = await fetch(
 `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite-preview-09-2025:generateContent?key=${apiKey}`,
 {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 contents: [
 {
 role: 'user',
 parts: [{ text: `${systemPrompt}\n\nUser request: "${prompt}"` }],
 },
 ],
 generationConfig: {
 temperature: 0.1,
 maxOutputTokens: 256,
 },
 }),
 },
 );

 if (!res.ok) {
 console.error('[AI Transform] Gemini API error:', res.status);
 const transform = parsePromptFallback(prompt);
 return NextResponse.json({ transform, source: 'fallback' });
 }

 const data = await res.json();
 const rawText =
 data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';

 // Clean up — strip any surrounding quotes, backticks, or markdown
 const transform = rawText
 .replace(/^[`"'\s]+|[`"'\s]+$/g, '')
 .replace(/^```[\s\S]*?\n/, '')
 .replace(/\n```$/, '')
 .trim();

 // Validate: must look like a transform string (key-value pairs)
 if (!transform || !/^[a-zA-Z]/.test(transform)) {
 const fallback = parsePromptFallback(prompt);
 return NextResponse.json({ transform: fallback, source: 'fallback' });
 }

 return NextResponse.json({ transform, source: 'ai' });
 } catch (err) {
 console.error('[AI Transform] Error:', err);
 const transform = parsePromptFallback(prompt);
 return NextResponse.json({ transform, source: 'fallback' });
 }
}

/**
 * Simple keyword-based fallback when AI is unavailable.
 * Returns a transform URL string instead of JSON.
 */
function parsePromptFallback(prompt: string): string {
 const lower = prompt.toLowerCase();
 const parts: string[] = [];

 // Dimensions
 const dimMatch = lower.match(/(\d+)\s*[x×]\s*(\d+)/);
 if (dimMatch) {
 parts.push(`w-${dimMatch[1]}`, `h-${dimMatch[2]}`);
 }

 // Width only
 if (!dimMatch) {
 const wMatch = lower.match(/width\s*(\d+)|(\d+)\s*(?:px)?\s*wide/);
 if (wMatch) parts.push(`w-${wMatch[1] || wMatch[2]}`);
 }

 // Height only
 if (!dimMatch) {
 const hMatch = lower.match(
 /height\s*(\d+)|(\d+)\s*(?:px)?\s*(?:tall|high)/,
 );
 if (hMatch) parts.push(`h-${hMatch[1] || hMatch[2]}`);
 }

 // Crop modes & presets
 if (lower.includes('thumbnail') || lower.includes('thumb')) {
 parts.push('c-thumb', 'g-auto');
 if (!dimMatch) {
 parts.push('w-200', 'h-200');
 }
 } else if (
 lower.includes('social') ||
 lower.includes('og image') ||
 lower.includes('open graph')
 ) {
 if (!dimMatch) {
 parts.push('w-1200', 'h-630');
 }
 parts.push('c-cover', 'g-auto', 'q-85', 'f-jpeg');
 return parts.join(',');
 } else if (lower.includes('banner') || lower.includes('hd')) {
 if (!dimMatch) {
 parts.push('w-1920', 'h-1080');
 }
 parts.push('c-cover');
 } else if (lower.includes('profile') || lower.includes('avatar')) {
 if (!dimMatch) {
 parts.push('w-200', 'h-200');
 }
 parts.push('c-fill', 'g-face', 'r-max');
 } else if (lower.includes('cover')) parts.push('c-cover');
 else if (lower.includes('contain')) parts.push('c-contain');
 else if (lower.includes('fill')) parts.push('c-fill');
 else if (lower.includes('fit')) parts.push('c-fit');

 // Format
 if (lower.includes('webp')) parts.push('f-webp');
 else if (lower.includes('png')) parts.push('f-png');
 else if (lower.includes('jpeg') || lower.includes('jpg'))
 parts.push('f-jpeg');
 else if (lower.includes('avif')) parts.push('f-avif');

 // Quality
 const qMatch = lower.match(/quality\s*(\d+)|(\d+)\s*%?\s*quality/);
 if (qMatch) parts.push(`q-${qMatch[1] || qMatch[2]}`);
 else if (lower.includes('high quality')) parts.push('q-90');
 else if (lower.includes('low quality')) parts.push('q-40');

 // Effects — separate steps with colon
 const effects: string[] = [];
 if (lower.includes('blur')) {
 const blMatch = lower.match(/blur\s*(\d+)/);
 effects.push(`bl-${blMatch ? blMatch[1] : '15'}`);
 }
 if (lower.includes('sharpen')) {
 const shMatch = lower.match(/sharpen\s*(\d+)/);
 effects.push(`sh-${shMatch ? shMatch[1] : '20'}`);
 }
 if (
 lower.includes('grayscale') ||
 lower.includes('grey') ||
 lower.includes('gray') ||
 lower.includes('black and white') ||
 lower.includes('b&w')
 ) {
 effects.push('e-grayscale');
 }
 const rotMatch = lower.match(/rotat\w*\s*(\d+)/);
 if (rotMatch) effects.push(`rt-${rotMatch[1]}`);

 // Add defaults if we have resize params but no format/quality
 if (parts.length > 0 && !parts.some((p) => p.startsWith('q-')))
 parts.push('q-80');
 if (parts.length > 0 && !parts.some((p) => p.startsWith('f-')))
 parts.push('f-webp');

 // Combine: resize params as first step, effects as second step if any
 const mainStep = parts.join(',');
 if (effects.length > 0) {
 return mainStep ? `${mainStep}:${effects.join(',')}` : effects.join(',');
 }

 return mainStep || 'w-800,q-80,f-webp';
}
