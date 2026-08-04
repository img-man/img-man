// SPDX-License-Identifier: Apache-2.0
/**
 * AI Model Registry & Credit Cost Map
 *
 * Central configuration for all AI models available in img-man.
 * Update credits and model IDs here — the rest of the app reads from this file.
 */

import type { AiProviderId } from '@/types/providers';

export type AiModelCapability = 'generate' | 'edit' | 'analyze';

export interface AiModelConfig {
 id: string;
 /** AI provider backing this model */
 provider: AiProviderId;
 /** Display name shown in UI */
 label: string;
 /** Provider model identifier */
 modelId: string;
 /** Credits consumed per invocation */
 credits: number;
 /** Short description */
 description: string;
 /** Capabilities */
 capabilities: AiModelCapability[];
 /** Whether this model supports image input (for editing) */
 supportsImageInput: boolean;
}

/**
 * All available AI models.
 * Order matters — first in list is the default for each capability.
 */
export const AI_MODELS: AiModelConfig[] = [
 {
 id: 'gemini-flash',
 provider: 'vertex',
 label: 'Nana Banana',
 modelId: 'gemini-2.5-flash-image',
 credits: 4,
 description: 'Fast generation with Gemini 2.5 Flash',
 capabilities: ['generate', 'analyze'],
 supportsImageInput: false,
 },
 {
 id: 'gemini-pro',
 provider: 'vertex',
 label: 'Nana Banana Pro',
 modelId: 'gemini-3-pro-image-preview',
 credits: 6,
 description: 'Higher quality with Gemini 3 Pro',
 capabilities: ['generate'],
 supportsImageInput: false,
 },
 {
 id: 'imagen4-fast',
 provider: 'vertex',
 label: 'Imagen 4 Fast',
 modelId: 'imagen-4.0-fast-generate-preview-06-06',
 credits: 8,
 description: 'Lightning-fast image generation',
 capabilities: ['generate'],
 supportsImageInput: false,
 },
 {
 id: 'imagen3-edit',
 provider: 'vertex',
 label: 'Imagen 4 Edit',
 modelId: 'imagen-3.0-capability-002',
 credits: 8,
 description: 'Edit & customize existing images with AI',
 capabilities: ['generate', 'edit'],
 supportsImageInput: true,
 },
 {
 id: 'gpt-4.1-mini-vision',
 provider: 'openai',
 label: 'GPT-4.1 Mini Vision',
 modelId: 'gpt-4.1-mini',
 credits: 1,
 description: 'OpenAI multimodal analysis for captions, tags, and visual understanding',
 capabilities: ['analyze'],
 supportsImageInput: true,
 },
 {
 id: 'gpt-image-1',
 provider: 'openai',
 label: 'GPT Image 1',
 modelId: 'gpt-image-1',
 credits: 7,
 description: 'OpenAI image generation and edit model (text-to-image and image+prompt)',
 capabilities: ['generate', 'edit'],
 supportsImageInput: true,
 },
];

/** Quick lookup by model id */
export const AI_MODEL_MAP = new Map(AI_MODELS.map((m) => [m.id, m]));

export function getModelConfigById(modelId?: string) {
 if (!modelId) {
  return undefined;
 }

 return AI_MODEL_MAP.get(modelId);
}

/** Get models that support a specific capability */
export function getModelsForCapability(cap: AiModelCapability): AiModelConfig[] {
 return AI_MODELS.filter((m) => m.capabilities.includes(cap));
}

export function getModelsForProviderCapability(
 provider: AiProviderId,
 cap: AiModelCapability,
): AiModelConfig[] {
 return AI_MODELS.filter(
  (model) => model.provider === provider && model.capabilities.includes(cap),
 );
}

export function getDefaultModelForProviderCapability(
 provider: AiProviderId,
 cap: AiModelCapability,
) {
 return getModelsForProviderCapability(provider, cap)[0];
}

export function resolveModelForProviderCapability(
 provider: AiProviderId,
 cap: AiModelCapability,
 modelId?: string,
) {
 const explicitModel = getModelConfigById(modelId);

 if (
  explicitModel
  && explicitModel.provider === provider
  && explicitModel.capabilities.includes(cap)
 ) {
  return explicitModel;
 }

 return getDefaultModelForProviderCapability(provider, cap);
}

/** Default generation model */
export const DEFAULT_GEN_MODEL = getDefaultModelForProviderCapability('vertex', 'generate')!;

/**
 * Default Vertex edit model. Kept for back-compat with UI surfaces that need a
 * synchronous label/credits hint. For the actual runtime resolution use
 * `getDefaultEditModelForProvider(provider)` or the provider-aware helpers
 * inside `applyAiImageEdit` / the generate route.
 */
export const EDIT_MODEL = getDefaultModelForProviderCapability('vertex', 'edit')!;

/** Provider-aware default edit model (falls back to Vertex if provider has none). */
export function getDefaultEditModelForProvider(provider: AiProviderId) {
 return (
  getDefaultModelForProviderCapability(provider, 'edit')
  ?? getDefaultModelForProviderCapability('vertex', 'edit')!
 );
}

/**
 * Per-operation credit costs (for auto operations like auto-tag, face-detect).
 * These are separate from the user-facing model costs above.
 */
export const AUTO_OPERATION_CREDITS: Record<string, number> = {
 auto_tag: 1,
 face_detect: 2,
 bg_remove: 2,
 upscale: 2,
 expand: 3,
};
