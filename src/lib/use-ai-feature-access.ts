// SPDX-License-Identifier: Apache-2.0
'use client';

import { useCallback, useEffect, useState } from 'react';
import type { AiProviderId } from '@/types/providers';
import {
  areAiFeaturesEnabled,
  areAllAiFeaturesDisabled,
  isAiFeatureEnabled,
  normalizeAiFeatureConfig,
  type AiFeatureConfigMap,
} from '@/lib/ai-feature-access';

interface AiFeatureAccessState {
  config: AiFeatureConfigMap | null;
  provider: AiProviderId;
}

const DEFAULT_STATE: AiFeatureAccessState = {
  config: null,
  provider: 'vertex',
};

let cachedState: AiFeatureAccessState | null = null;
let pendingState: Promise<AiFeatureAccessState> | null = null;

async function loadAiFeatureAccessState(): Promise<AiFeatureAccessState> {
  if (cachedState) {
    return cachedState;
  }

  if (pendingState) {
    return pendingState;
  }

  pendingState = (async () => {
    let provider: AiProviderId = 'vertex';
    let config: AiFeatureConfigMap | null = null;

    try {
      const settingsRes = await fetch('/api/settings');
      if (settingsRes.ok) {
        const settingsData = await settingsRes.json();
        config = normalizeAiFeatureConfig(
          settingsData.settings?.aiFeatureConfig ?? settingsData.aiFeatureConfig,
        );

        const nextProvider = settingsData.settings?.aiProviderConfig?.provider;
        if (nextProvider === 'vertex' || nextProvider === 'openai') {
          provider = nextProvider;
        }
      }

      if (!config) {
        const meRes = await fetch('/api/v1/auth/me');
        if (meRes.ok) {
          const meData = await meRes.json();
          config = normalizeAiFeatureConfig(meData.aiFeatureConfig);

          const nextProvider = meData.aiProviderConfig?.provider;
          if (nextProvider === 'vertex' || nextProvider === 'openai') {
            provider = nextProvider;
          }
        }
      }
    } catch {
      // Defaults keep AI enabled when settings are unavailable.
    }

    cachedState = { config, provider };
    return cachedState;
  })();

  try {
    return await pendingState;
  } finally {
    pendingState = null;
  }
}

export function useAiFeatureAccess() {
  const initialState = cachedState ?? DEFAULT_STATE;
  const [state, setState] = useState<AiFeatureAccessState>(initialState);

  useEffect(() => {
    let active = true;

    loadAiFeatureAccessState().then((nextState) => {
      if (!active) {
        return;
      }

      if (
        initialState.provider !== nextState.provider ||
        initialState.config !== nextState.config
      ) {
        setState(nextState);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  const isFeatureEnabled = useCallback(
    (featureKey?: string | null) => isAiFeatureEnabled(state.config, featureKey),
    [state.config],
  );

  const areFeaturesEnabled = useCallback(
    (featureKeys?: readonly string[]) =>
      areAiFeaturesEnabled(state.config, featureKeys),
    [state.config],
  );

  const refresh = useCallback(async () => {
    cachedState = null;
    const nextState = await loadAiFeatureAccessState();
    setState(nextState);
    return nextState;
  }, []);

  return {
    loading: false,
    config: state.config,
    provider: state.provider,
    allAiDisabled: areAllAiFeaturesDisabled(state.config),
    isFeatureEnabled,
    areFeaturesEnabled,
    refresh,
  };
}