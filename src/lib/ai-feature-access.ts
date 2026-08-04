// SPDX-License-Identifier: Apache-2.0

export type AiFeatureMode = 'enabled' | 'disabled' | 'auto';

export interface AiFeatureConfigEntry {
  mode?: AiFeatureMode | string;
  minRole?: number;
}

export type AiFeatureConfigMap = Record<string, AiFeatureConfigEntry>;

export function normalizeAiFeatureConfig(
  raw: unknown,
): AiFeatureConfigMap | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }

  return raw as AiFeatureConfigMap;
}

export function areAllAiFeaturesDisabled(
  config: AiFeatureConfigMap | null | undefined,
): boolean {
  if (!config) {
    return false;
  }

  const entries = Object.values(config);
  if (entries.length === 0) {
    return false;
  }

  return entries.every((entry) => entry?.mode === 'disabled');
}

export function isAiFeatureEnabled(
  config: AiFeatureConfigMap | null | undefined,
  featureKey?: string | null,
): boolean {
  if (!featureKey) {
    return !areAllAiFeaturesDisabled(config);
  }

  return config?.[featureKey]?.mode !== 'disabled';
}

export function areAiFeaturesEnabled(
  config: AiFeatureConfigMap | null | undefined,
  featureKeys?: readonly string[],
): boolean {
  if (!featureKeys || featureKeys.length === 0) {
    return !areAllAiFeaturesDisabled(config);
  }

  return featureKeys.some((featureKey) => isAiFeatureEnabled(config, featureKey));
}