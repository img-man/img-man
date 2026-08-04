// SPDX-License-Identifier: Apache-2.0
/**
 * Prompt Refiner — Uses Gemini Flash to improve user prompts
 * before they're sent to the image generation / editing model.
 *
 * The refiner:
 * - Adds detail, specificity, and artistic direction
 * - Preserves the user's original intent
 * - Adapts to the operation type (generate vs edit)
 * - Keeps the output concise (< 500 chars)
 */

import type { AiProviderId } from '@/types/providers';
import { generateOpenAiText } from './openai';
import { getVertexAiClient } from './vertex-ai';

const VERTEX_REFINER_MODEL = process.env.PROMPT_REFINER_MODEL || 'gemini-2.0-flash';

/* ─── System Prompts ─────────────────────────────────────────── */

const GENERATE_SYSTEM = `You are an expert image prompt engineer. Your job is to take a user's raw image generation prompt and refine it into a detailed, high-quality prompt that produces stunning images.

Rules:
- Preserve the user's core intent and subject exactly
- Add specific details: lighting, composition, color palette, texture, mood
- Include technical quality descriptors (high resolution, detailed, sharp focus)
- Keep the refined prompt under 400 characters
- Output ONLY the refined prompt text, no explanations or formatting
- If the user's prompt is already detailed and specific, make minimal changes
- Never add content the user didn't ask for (e.g. don't add people if they asked for a landscape)`;

const EDIT_SYSTEM = `You are an expert image editing prompt engineer. Your job is to take a user's raw image editing instruction and refine it into a precise, clear editing prompt for an AI image editor.

Rules:
- Preserve the user's core editing intent exactly
- Add specific details about how the edit should look (colors, style, intensity)
- Be specific about what should change and what should be preserved
- Keep the refined prompt under 400 characters
- Output ONLY the refined prompt text, no explanations or formatting
- For simple edits (crop, resize, color adjust), keep the instruction straightforward
- Never change the operation type (don't turn a "remove background" into something else)`;

/* ─── Refiner Function ───────────────────────────────────────── */

export interface RefineOptions {
 /** 'generate' for text-to-image, 'edit' for image editing */
 mode: 'generate' | 'edit';
 /** User's raw prompt */
 prompt: string;
 /** Optional style hint (e.g. 'photorealistic', 'illustration') */
 style?: string;
 /** Optional target dimensions */
 width?: number;
 height?: number;
 /** Current org for provider-specific credentials */
 orgId?: string;
 /** Override the provider used for this refinement pass */
 providerOverride?: AiProviderId;
 /** Already-resolved OpenAI API key to avoid a second org lookup */
 openAiApiKey?: string;
}

/**
 * Refine a user prompt using Gemini Flash for better AI image results.
 *
 * Falls back to the original prompt if refinement fails (non-blocking).
 */
export async function refinePrompt(options: RefineOptions): Promise<string> {
 const {
 mode,
 prompt,
 style,
 width,
 height,
 orgId,
 providerOverride = 'vertex',
 openAiApiKey,
 } = options;

 // Skip refinement for very short or empty prompts
 if (!prompt || prompt.length < 5) return prompt;

 try {
 const systemPrompt = mode === 'edit' ? EDIT_SYSTEM : GENERATE_SYSTEM;

 let userMessage = `Refine this ${mode === 'edit' ? 'image editing' : 'image generation'} prompt:\n\n"${prompt}"`;

 if (style && mode === 'generate') {
 userMessage += `\n\nTarget style: ${style}`;
 }
 if (width && height) {
 userMessage += `\nTarget dimensions: ${width}x${height}`;
 }

 let refined: string | undefined;

 if (providerOverride === 'openai') {
  refined = await generateOpenAiText({
   prompt: userMessage,
   systemPrompt,
   model: process.env.OPENAI_PROMPT_REFINER_MODEL,
   apiKey: openAiApiKey,
   orgId,
  });
 } else {
  const model = getVertexAiClient().getGenerativeModel({ model: VERTEX_REFINER_MODEL });
  const result = await model.generateContent({
   contents: [
   { role: 'user', parts: [{ text: userMessage }] },
   ],
   systemInstruction: { role: 'user', parts: [{ text: systemPrompt }] },
  });

  refined =
  result.response?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
 }

 if (refined && refined.length > 0 && refined.length <= 600) {
 return refined;
 }

 // If response is too long or empty, fall back
 return prompt;
 } catch (err) {
 console.warn('[PromptRefiner] Refinement failed, using original prompt:', err);
 return prompt;
 }
}
