export const IMAGE_MAN_EDITIONS = ['community', 'cloud', 'white-label'];

export const COMMUNITY_EDITIONS = new Set(['community']);

export const DEFAULT_FEATURE_FLAGS = Object.freeze({
  managedUpdates: false,
  supportBundleUpload: false,
  premiumTemplates: false,
  whiteLabel: false,
});

export function createCommunityEntitlements() {
  return {
    edition: 'community',
    accountId: null,
    accountSlug: null,
    updatedAt: new Date(0).toISOString(),
    features: { ...DEFAULT_FEATURE_FLAGS },
  };
}

export function normalizeEntitlements(input = {}) {
  const edition = IMAGE_MAN_EDITIONS.includes(input.edition) ? input.edition : 'community';

  return {
    edition,
    accountId: input.accountId ?? null,
    accountSlug: input.accountSlug ?? null,
    updatedAt: input.updatedAt ?? new Date().toISOString(),
    features: {
      ...DEFAULT_FEATURE_FLAGS,
      ...(input.features ?? {}),
    },
  };
}

export function isCommunityEdition(entitlements) {
  return COMMUNITY_EDITIONS.has(entitlements?.edition ?? 'community');
}
