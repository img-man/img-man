// SPDX-License-Identifier: Apache-2.0
import {
  AI_CAPABILITIES,
  AI_PROVIDERS,
  type AiCapabilityId,
  type AiProviderId,
} from '@/types/providers';

export type AiProviderStatus = 'active' | 'planned';

export type AiProviderAdapter = {
  id: AiProviderId;
  label: string;
  status: AiProviderStatus;
  capabilities: readonly AiCapabilityId[];
  defaultModels: Partial<Record<AiCapabilityId, string>>;
};

const vertexProviderAdapter: AiProviderAdapter = {
  id: 'vertex',
  label: 'Google Vertex AI / Gemini',
  status: 'active',
  capabilities: [
    'text.generate',
    'vision.tag',
    'vision.embed',
    'image.generate',
    'image.edit',
    'image.edit.inpaint',
    'image.edit.outpaint',
    'image.edit.bg-remove',
    'image.upscale',
  ],
  defaultModels: {
    'text.generate': 'gemini-2.5-flash-image',
    'vision.tag': 'gemini-2.5-flash-image',
    'vision.embed': 'multimodalembedding@001',
    'image.generate': 'gemini-2.5-flash-image',
    'image.edit': 'gemini-2.5-flash-image',
    'image.edit.inpaint': 'gemini-2.5-flash-image',
    'image.edit.outpaint': 'gemini-2.5-flash-image',
    'image.edit.bg-remove': 'gemini-2.5-flash-image',
    'image.upscale': 'gemini-2.5-flash-image',
  },
};

const openAiProviderAdapter: AiProviderAdapter = {
  id: 'openai',
  label: 'OpenAI',
  status: 'active',
  capabilities: [
    'text.generate',
    'vision.tag',
    'image.generate',
    'image.edit',
    'image.edit.inpaint',
    'image.edit.outpaint',
    'image.edit.bg-remove',
  ],
  defaultModels: {
    'text.generate': 'gpt-4.1-mini',
    'vision.tag': 'gpt-4.1-mini',
    'image.generate': 'gpt-image-1',
    'image.edit': 'gpt-image-1',
    'image.edit.inpaint': 'gpt-image-1',
    'image.edit.outpaint': 'gpt-image-1',
    'image.edit.bg-remove': 'gpt-image-1',
  },
};

const openRouterProviderAdapter: AiProviderAdapter = {
  id: 'openrouter',
  label: 'OpenRouter',
  status: 'planned',
  // Capabilities are intentionally empty until the runtime adapter ships.
  // The provider is exposed here so the settings UI can render it as
  // "Coming soon" and so credential storage can be wired up ahead of
  // runtime support. See docs/AI_PROVIDERS.md for the supported-capability
  // matrix and roll-out plan.
  capabilities: [],
  defaultModels: {},
};

const groqProviderAdapter: AiProviderAdapter = {
  id: 'groq',
  label: 'Groq',
  status: 'planned',
  // Same caveat as OpenRouter: contract-only placeholder until the runtime
  // adapter is implemented. Groq is text/vision-first; image generation is
  // not on the planned capability list.
  capabilities: [],
  defaultModels: {},
};

const AI_PROVIDER_ADAPTERS: Record<AiProviderId, AiProviderAdapter> = {
  vertex: vertexProviderAdapter,
  openai: openAiProviderAdapter,
  openrouter: openRouterProviderAdapter,
  groq: groqProviderAdapter,
};

export function getAiProviderAdapter(provider: AiProviderId) {
  return AI_PROVIDER_ADAPTERS[provider];
}

export function listAiProviderAdapters() {
  return AI_PROVIDERS.map((provider) => AI_PROVIDER_ADAPTERS[provider]);
}

export function providerSupportsCapability(
  provider: AiProviderId,
  capability: AiCapabilityId,
) {
  return AI_PROVIDER_ADAPTERS[provider].capabilities.includes(capability);
}

export function assertAiProviderCapability(
  provider: AiProviderId,
  capability: AiCapabilityId,
) {
  if (!providerSupportsCapability(provider, capability)) {
    throw new Error(`AI provider "${provider}" does not support "${capability}"`);
  }
}

export function getDefaultAiModelForCapability(
  provider: AiProviderId,
  capability: AiCapabilityId,
) {
  assertAiProviderCapability(provider, capability);
  return AI_PROVIDER_ADAPTERS[provider].defaultModels[capability];
}

export function getSupportedAiCapabilities() {
  return AI_CAPABILITIES;
}