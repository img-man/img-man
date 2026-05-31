import {
  createCommunityEntitlements,
  isCommunityEdition,
  normalizeEntitlements,
} from '../../../packages/imageman-sdk/src/edition.js';

const DEFAULT_ACCOUNT_API_URL = 'https://account.img-man.com';
const DEFAULT_TIMEOUT_MS = 5000;

export function getAccountRuntimeConfig(env = process.env) {
  const accountKey = String(env.IMAGEMAN_ACCOUNT_KEY ?? '').trim();
  const apiUrl = String(env.IMAGEMAN_ACCOUNT_API_URL ?? DEFAULT_ACCOUNT_API_URL)
    .trim()
    .replace(/\/+$/, '');
  const instanceId = String(env.IMAGEMAN_INSTANCE_ID ?? env.HOSTNAME ?? 'self-hosted').trim();

  return {
    accountKey,
    apiUrl,
    instanceId,
    enabled: accountKey.length > 0,
  };
}

export async function loadEntitlements(options = {}) {
  const env = options.env ?? process.env;
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const failOpen = options.failOpen ?? true;
  const config = getAccountRuntimeConfig(env);

  if (!config.enabled) {
    return {
      status: 'disabled',
      source: 'local',
      entitlements: createCommunityEntitlements(),
      error: null,
    };
  }

  if (typeof fetchImpl !== 'function') {
    if (!failOpen) {
      throw new Error('Global fetch is unavailable, but an account key was supplied.');
    }

    return {
      status: 'fallback',
      source: 'local',
      entitlements: createCommunityEntitlements(),
      error: 'Global fetch is unavailable.',
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(`${config.apiUrl}/api/v1/self-host/entitlements`, {
      method: 'GET',
      headers: {
        authorization: `Bearer ${config.accountKey}`,
        'x-imageman-instance-id': config.instanceId,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Account service returned HTTP ${response.status}`);
    }

    const payload = await response.json();

    return {
      status: 'connected',
      source: 'remote',
      entitlements: normalizeEntitlements(payload),
      error: null,
    };
  } catch (error) {
    if (!failOpen) {
      throw error;
    }

    return {
      status: 'fallback',
      source: 'local',
      entitlements: createCommunityEntitlements(),
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function resolveEditionMode(options = {}) {
  const result = await loadEntitlements(options);

  return {
    ...result,
    managed: !isCommunityEdition(result.entitlements),
  };
}
