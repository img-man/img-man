/**
 * Public entry point for the ImageMan SDK.
 *
 * Re-exports the edition + entitlement contracts that both the community core
 * and the hosted wrapper depend on. This is the only sanctioned barrel in the
 * repository (package entry point), per CONTRIBUTING.md.
 */

export {
  IMAGE_MAN_EDITIONS,
  DEFAULT_FEATURE_FLAGS,
  createCommunityEntitlements,
  normalizeEntitlements,
  isCommunityEdition,
} from './edition.js';
