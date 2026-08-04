// SPDX-License-Identifier: Apache-2.0
/**
 * Barrel re-export for all Mongoose models.
 *
 * Each model now lives in its own file under src/models/.
 * Import from '@/models' continues to work everywhere.
 */

// --- Core -------------------------------------------------------
export { Organization, type IOrganization } from './organization';
export { User, type IUser } from './user';
export {
  OrgMembership,
  type IOrgMembership,
  type IAccessRule,
} from './org-membership';
export { MemberGroup, type IMemberGroup } from './member-group';
export { ShareLink, type IShareLink } from './share-link';

// --- Assets & Folders -------------------------------------------
export { Folder, type IFolder } from './folder';
export {
  Asset,
  type IAsset,
  type IAssetVariant,
  type IFaceData,
  type IAssetEdit,
  type IExifData,
} from './asset';
export { DerivedAsset, type IDerivedAsset } from './derived-asset';
export { NamedTransform, type INamedTransform } from './named-transform';

// --- People & Smart Albums ------------------------------------
export { Person, type IPerson } from './person';
export {
  SmartAlbum,
  type ISmartAlbum,
  type ISmartAlbumRule,
} from './smart-album';

// --- Design Studio ----------------------------------------------
export { Design, type IDesign, type IDesignSnapshot } from './design';

// --- AI & Processing --------------------------------------------
export { AiJob, type IAiJob } from './ai-job';
export { MigrationJob, type IMigrationJob } from './migration-job';

// --- API & Auth -------------------------------------------------
export { ApiKey, type IApiKey, type ApiKeyPermission } from './api-key';
export { AccessToken, type IAccessToken } from './access-token';
export { RateLimitEntry, type IRateLimitEntry } from './rate-limit-entry';

// --- Billing & Usage --------------------------------------------
export { BandwidthLog, type IBandwidthLog } from './bandwidth-log';

// --- Asset & Org Analytics --------------------------------------
export {
  AssetAnalytics,
  type IAssetAnalytics,
  type IAnalyticsRawRecord,
  type IAnalyticsBucket,
  type IAnalyticsTotals,
} from './asset-analytics';
export { OrgAnalytics, type IOrgAnalytics } from './org-analytics';

// --- Audit & Logging -------------------------------------------
export {
  ActivityLog,
  type IActivityLog,
  type ActivityAction,
  type ActivityTargetType,
} from './activity-log';

// --- Platform Admin ---------------------------------------------
export { ErrorLog, type IErrorLog } from './error-log';

// --- Knowledge Base ---------------------------------------------
export { Doc, type IDoc } from './doc';
