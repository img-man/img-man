// SPDX-License-Identifier: Apache-2.0
import { STORAGE_PROVIDERS, type StorageProviderId } from '@/types/providers';

export const MIGRATION_JOB_STATUSES = [
  'draft',
  'dry_run_pending',
  'dry_run_running',
  'ready',
  'running',
  'paused',
  'completed',
  'failed',
  'cancelled',
] as const;

export type MigrationJobStatus = (typeof MIGRATION_JOB_STATUSES)[number];

export const MIGRATION_MUTATION_MODES = ['read-only', 'folder-opt-in'] as const;

export type MigrationMutationMode = (typeof MIGRATION_MUTATION_MODES)[number];

export const MIGRATION_CONTROL_ACTIONS = [
  'queue-dry-run',
  'start',
  'pause',
  'resume',
  'cancel',
] as const;

export type MigrationControlAction = (typeof MIGRATION_CONTROL_ACTIONS)[number];

export const MIGRATION_CONFIRMATION_THRESHOLD = 1000;

export interface MigrationCounts {
  readonly scanned: number;
  readonly discovered: number;
  readonly imported: number;
  readonly skipped: number;
  readonly errored: number;
  readonly foldersProjected: number;
  readonly foldersCreated: number;
}

export interface MigrationCursor {
  readonly prefix?: string;
  readonly pageToken?: string;
  readonly marker?: string;
  readonly lastKey?: string;
}

export interface MigrationCostEstimate {
  readonly estimatedObjects: number;
  readonly listOperations: number;
  readonly getOperations: number;
  readonly requiresConfirmation: boolean;
  readonly warning?: string;
}

export interface MigrationVerificationSummary {
  readonly bucketObjectCount: number;
  readonly mongoAssetCount: number;
  readonly delta: number;
  readonly sampledSignedUrls: readonly string[];
  readonly verifiedAt?: Date;
}

type MigrationJobLike = Record<string, unknown> & {
  errorEntries?: unknown[];
  toObject?: () => Record<string, unknown>;
};

export interface MigrationProviderRuntime {
  readonly id: StorageProviderId;
  readonly label: string;
  readonly dryRunStatus: 'available' | 'planned';
  readonly liveRunStatus: 'available' | 'planned';
  readonly notes: string;
}

export const MIGRATION_PROVIDER_RUNTIMES: readonly MigrationProviderRuntime[] =
  STORAGE_PROVIDERS.map((provider) => {
    if (provider === 'gcp') {
      return {
        id: provider,
        label: 'Google Cloud Storage',
        dryRunStatus: 'available',
        liveRunStatus: 'available',
        notes: 'Primary migration path for customer-managed GCP buckets.',
      };
    }

    if (provider === 'aws') {
      return {
        id: provider,
        label: 'Amazon S3',
        dryRunStatus: 'available',
        liveRunStatus: 'available',
        notes: 'Supported migration path for customer-managed S3 buckets.',
      };
    }

    return {
      id: provider,
      label: 'Azure Blob Storage',
      dryRunStatus: 'planned',
      liveRunStatus: 'planned',
      notes: 'Provider contract is reserved, but the migration runtime has not been implemented yet.',
    };
  });

export function getMigrationProviderRuntime(
  provider: StorageProviderId,
): MigrationProviderRuntime {
  return (
    MIGRATION_PROVIDER_RUNTIMES.find((entry) => entry.id === provider) ??
    MIGRATION_PROVIDER_RUNTIMES[0]
  );
}

export function normalizeMigrationPrefix(prefix?: string | null): string {
  if (!prefix?.trim()) {
    return '';
  }

  const trimmed = prefix.trim().replace(/^\/+/, '').replace(/\/+/g, '/');
  const withoutTrailingSlash = trimmed.replace(/\/+$/, '');

  return withoutTrailingSlash ? `${withoutTrailingSlash}/` : '';
}

export function createEmptyMigrationCounts(
  overrides: Partial<MigrationCounts> = {},
): MigrationCounts {
  return {
    scanned: 0,
    discovered: 0,
    imported: 0,
    skipped: 0,
    errored: 0,
    foldersProjected: 0,
    foldersCreated: 0,
    ...overrides,
  };
}

export function estimateMigrationCost({
  estimatedObjects,
  averageMetadataReadsPerObject = 0,
}: {
  estimatedObjects: number;
  averageMetadataReadsPerObject?: number;
}): MigrationCostEstimate {
  const safeObjectCount = Math.max(0, Math.floor(estimatedObjects));
  const safeAverageReads = Math.max(0, Math.floor(averageMetadataReadsPerObject));
  const listOperations = safeObjectCount === 0 ? 0 : Math.ceil(safeObjectCount / 1000);
  const getOperations = safeObjectCount * safeAverageReads;
  const requiresConfirmation =
    safeObjectCount > MIGRATION_CONFIRMATION_THRESHOLD ||
    listOperations > 1 ||
    getOperations > MIGRATION_CONFIRMATION_THRESHOLD;

  return {
    estimatedObjects: safeObjectCount,
    listOperations,
    getOperations,
    requiresConfirmation,
    warning: requiresConfirmation
      ? 'Dry run exceeds the 1,000 object safety threshold and should require explicit confirmation before high-volume List/Get work.'
      : undefined,
  };
}

export function projectMigrationFolders(
  objectKeys: readonly string[],
  prefix?: string,
): string[] {
  const normalizedPrefix = normalizeMigrationPrefix(prefix);
  const folders = new Set<string>();

  for (const rawKey of objectKeys) {
    const normalizedKey = rawKey.trim().replace(/^\/+/, '').replace(/\/+/g, '/');
    if (!normalizedKey) {
      continue;
    }

    if (normalizedPrefix && !normalizedKey.startsWith(normalizedPrefix)) {
      continue;
    }

    const relativeKey = normalizedPrefix
      ? normalizedKey.slice(normalizedPrefix.length)
      : normalizedKey;
    const parts = relativeKey.split('/').filter(Boolean);

    if (parts.length <= 1) {
      continue;
    }

    let currentPath = normalizedPrefix;

    for (const segment of parts.slice(0, -1)) {
      currentPath = `${currentPath}${segment}/`;
      folders.add(currentPath);
    }
  }

  return Array.from(folders).sort((left, right) => left.localeCompare(right));
}

export function summarizeMigrationVerification({
  bucketObjectCount,
  mongoAssetCount,
  sampledSignedUrls,
  verifiedAt,
}: {
  bucketObjectCount: number;
  mongoAssetCount: number;
  sampledSignedUrls?: readonly string[];
  verifiedAt?: Date;
}): MigrationVerificationSummary {
  const safeBucketCount = Math.max(0, Math.floor(bucketObjectCount));
  const safeMongoCount = Math.max(0, Math.floor(mongoAssetCount));

  return {
    bucketObjectCount: safeBucketCount,
    mongoAssetCount: safeMongoCount,
    delta: safeBucketCount - safeMongoCount,
    sampledSignedUrls: sampledSignedUrls ?? [],
    verifiedAt,
  };
}

export function transitionMigrationStatus(
  currentStatus: MigrationJobStatus,
  action: MigrationControlAction,
): MigrationJobStatus | null {
  switch (action) {
    case 'queue-dry-run':
      return currentStatus === 'draft' || currentStatus === 'failed'
        ? 'dry_run_pending'
        : null;
    case 'start':
      return currentStatus === 'draft' || currentStatus === 'ready' || currentStatus === 'paused'
        ? 'running'
        : null;
    case 'pause':
      return currentStatus === 'running' ? 'paused' : null;
    case 'resume':
      return currentStatus === 'paused' ? 'running' : null;
    case 'cancel':
      return ['draft', 'dry_run_pending', 'dry_run_running', 'ready', 'running', 'paused'].includes(
        currentStatus,
      )
        ? 'cancelled'
        : null;
    default:
      return null;
  }
}

export function serializeMigrationJobForApi(job: MigrationJobLike) {
  const plainJob = typeof job.toObject === 'function' ? job.toObject() : job;
  const { errorEntries = [], ...rest } = plainJob;

  return {
    ...rest,
    errors: errorEntries,
  };
}