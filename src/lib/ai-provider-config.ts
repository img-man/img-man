// SPDX-License-Identifier: Apache-2.0
import { Organization } from '@/models';
import { AI_PROVIDERS, type AiProviderId } from '@/types/providers';
import { connectToDatabase } from './db';
import { decryptStoredVertexApiKey } from './gcp-config';
import { decryptStoredSecret, encryptStoredSecret } from './secret-crypto';

const ENCRYPTED_OPENAI_API_KEY_PREFIX = 'enc:openai-api-key:v1:';

type OrganizationAiProviderConfig = {
  aiProviderConfig?: {
    provider?: string;
    vertexApiKey?: string;
    openAiApiKey?: string;
  };
  storageConfig?: {
    vertexApiKey?: string;
  };
};

export interface OrgAiProviderConfig {
  provider: AiProviderId;
  vertexApiKey?: string;
  openAiApiKey?: string;
}

function getDefaultAiProvider(): AiProviderId {
  const provider = process.env.DEFAULT_AI_PROVIDER?.trim().toLowerCase();

  if (provider && AI_PROVIDERS.includes(provider as AiProviderId)) {
    return provider as AiProviderId;
  }

  return 'vertex';
}

function normalizeAiProvider(provider?: string): AiProviderId {
  if (provider && AI_PROVIDERS.includes(provider as AiProviderId)) {
    return provider as AiProviderId;
  }

  return getDefaultAiProvider();
}

export function encryptStoredOpenAiApiKey(apiKey?: string) {
  if (!apiKey?.trim()) {
    return undefined;
  }

  if (apiKey.startsWith(ENCRYPTED_OPENAI_API_KEY_PREFIX)) {
    return apiKey;
  }

  return encryptStoredSecret(apiKey.trim(), ENCRYPTED_OPENAI_API_KEY_PREFIX);
}

export function decryptStoredOpenAiApiKey(apiKeyValue?: string) {
  if (!apiKeyValue?.trim()) {
    return undefined;
  }

  if (!apiKeyValue.startsWith(ENCRYPTED_OPENAI_API_KEY_PREFIX)) {
    return apiKeyValue;
  }

  try {
    return decryptStoredSecret(apiKeyValue, ENCRYPTED_OPENAI_API_KEY_PREFIX);
  } catch {
    throw new Error('Unable to decrypt stored OpenAI API key');
  }
}

export async function getOrgAiProviderConfig(orgId?: string): Promise<OrgAiProviderConfig> {
  if (!orgId) {
    return {
      provider: getDefaultAiProvider(),
      openAiApiKey: decryptStoredOpenAiApiKey(process.env.OPENAI_API_KEY),
    };
  }

  await connectToDatabase();

  const org = (await Organization.findById(orgId)
    .select('aiProviderConfig storageConfig')
    .lean()) as OrganizationAiProviderConfig | null;

  return {
    provider: normalizeAiProvider(org?.aiProviderConfig?.provider),
    vertexApiKey: decryptStoredVertexApiKey(
      org?.aiProviderConfig?.vertexApiKey ?? org?.storageConfig?.vertexApiKey,
    ),
    openAiApiKey:
      decryptStoredOpenAiApiKey(org?.aiProviderConfig?.openAiApiKey)
      ?? decryptStoredOpenAiApiKey(process.env.OPENAI_API_KEY),
  };
}