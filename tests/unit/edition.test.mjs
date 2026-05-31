import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createCommunityEntitlements,
  DEFAULT_FEATURE_FLAGS,
  isCommunityEdition,
  normalizeEntitlements,
} from '../../packages/imageman-sdk/src/edition.js';

test('createCommunityEntitlements returns the public community defaults', () => {
  const entitlements = createCommunityEntitlements();

  assert.equal(entitlements.edition, 'community');
  assert.equal(entitlements.accountId, null);
  assert.equal(entitlements.accountSlug, null);
  assert.deepEqual(entitlements.features, DEFAULT_FEATURE_FLAGS);
  assert.equal(Number.isNaN(Date.parse(entitlements.updatedAt)), false);
});

test('normalizeEntitlements keeps supported editions and merges feature defaults', () => {
  const entitlements = normalizeEntitlements({
    edition: 'cloud',
    accountId: 'acct_123',
    features: {
      managedUpdates: true,
    },
  });

  assert.equal(entitlements.edition, 'cloud');
  assert.equal(entitlements.accountId, 'acct_123');
  assert.equal(entitlements.features.managedUpdates, true);
  assert.equal(entitlements.features.supportBundleUpload, false);
  assert.equal(entitlements.features.premiumTemplates, false);
});

test('normalizeEntitlements falls back to community for unknown editions', () => {
  const entitlements = normalizeEntitlements({ edition: 'enterprise-preview' });

  assert.equal(entitlements.edition, 'community');
  assert.equal(isCommunityEdition(entitlements), true);
  assert.equal(isCommunityEdition({ edition: 'white-label' }), false);
});
