import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getAccountRuntimeConfig,
  loadEntitlements,
  resolveEditionMode,
} from '../../src/lib/edition/account-client.js';

test('getAccountRuntimeConfig stays disabled without an account key', () => {
  const config = getAccountRuntimeConfig({});

  assert.equal(config.enabled, false);
  assert.equal(config.accountKey, '');
  assert.equal(config.apiUrl, 'https://account.img-man.com');
  assert.equal(config.instanceId, 'self-hosted');
});

test('loadEntitlements returns local community entitlements when disabled', async () => {
  const result = await loadEntitlements({ env: {} });

  assert.equal(result.status, 'disabled');
  assert.equal(result.source, 'local');
  assert.equal(result.entitlements.edition, 'community');
  assert.equal(result.error, null);
});

test('loadEntitlements fail-opens when fetch is unavailable but an account key exists', async () => {
  const result = await loadEntitlements({
    env: {
      IMAGEMAN_ACCOUNT_KEY: 'im_acc_test_123',
    },
    fetchImpl: false,
  });

  assert.equal(result.status, 'fallback');
  assert.equal(result.entitlements.edition, 'community');
  assert.match(result.error, /fetch is unavailable/i);
});

test('resolveEditionMode returns managed mode for remote cloud entitlements', async () => {
  const requests = [];
  const result = await resolveEditionMode({
    env: {
      IMAGEMAN_ACCOUNT_KEY: 'im_acc_live_123',
      IMAGEMAN_ACCOUNT_API_URL: 'https://account.example.com/',
      IMAGEMAN_INSTANCE_ID: 'instance-42',
    },
    fetchImpl: async (url, init) => {
      requests.push({ url, init });
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            edition: 'cloud',
            accountId: 'acct_42',
            accountSlug: 'starter',
            features: {
              managedUpdates: true,
              supportBundleUpload: true,
            },
          };
        },
      };
    },
  });

  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, 'https://account.example.com/api/v1/self-host/entitlements');
  assert.equal(requests[0].init.headers.authorization, 'Bearer im_acc_live_123');
  assert.equal(requests[0].init.headers['x-imageman-instance-id'], 'instance-42');
  assert.equal(result.status, 'connected');
  assert.equal(result.managed, true);
  assert.equal(result.entitlements.edition, 'cloud');
  assert.equal(result.entitlements.features.managedUpdates, true);
});

test('loadEntitlements throws when failOpen is false and fetch is unavailable', async () => {
  await assert.rejects(
    loadEntitlements({
      env: {
        IMAGEMAN_ACCOUNT_KEY: 'im_acc_test_123',
      },
      fetchImpl: false,
      failOpen: false,
    }),
    /fetch is unavailable/i,
  );
});

test('loadEntitlements throws when failOpen is false and the account service responds non-ok', async () => {
  await assert.rejects(
    loadEntitlements({
      env: {
        IMAGEMAN_ACCOUNT_KEY: 'im_acc_test_123',
      },
      failOpen: false,
      fetchImpl: async () => ({
        ok: false,
        status: 403,
      }),
    }),
    /http 403/i,
  );
});
