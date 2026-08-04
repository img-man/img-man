// SPDX-License-Identifier: Apache-2.0
export const STORAGE_PROVIDERS = ['gcp', 'aws', 'azure'] as const;

export type StorageProviderId = (typeof STORAGE_PROVIDERS)[number];

export const AI_PROVIDERS = ['vertex', 'openai', 'openrouter', 'groq'] as const;

export type AiProviderId = (typeof AI_PROVIDERS)[number];

export const AI_CAPABILITIES = [
	'text.generate',
	'vision.tag',
	'vision.embed',
	'image.generate',
	'image.edit',
	'image.edit.inpaint',
	'image.edit.outpaint',
	'image.edit.bg-remove',
	'image.upscale',
	'agent.tools',
] as const;

export type AiCapabilityId = (typeof AI_CAPABILITIES)[number];