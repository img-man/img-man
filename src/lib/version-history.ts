// SPDX-License-Identifier: Apache-2.0
/**
 * Asset Version History Engine
 *
 * Platform-wide versioning for assets — tracks every change (overwrite,
 * edit, crop, AI process, rename, tag change) as an immutable version
 * snapshot. Supports:
 *
 * - Version creation with diff tracking
 * - Version comparison (what changed between v2 and v5?)
 * - Rollback decision helpers (determine what a rollback would restore)
 * - Storage estimation (cumulative size of all versions)
 * - Version pruning policies (keep last N, keep tagged, etc.)
 * - Version labeling and pinning
 *
 * Pure functions only — no MongoDB calls.
 *
 * @see src/models/asset.ts — IAsset, IAssetEdit
 */

/* ══════════════════════════════════════════════════════════════════════════
   Types
   ══════════════════════════════════════════════════════════════════════════ */

export type VersionChangeType =
  | 'upload'        // Initial upload
  | 'overwrite'     // File replaced entirely
  | 'edit'          // Non-destructive edit (adjustments, crop, annotations)
  | 'ai_process'    // AI modification (bg-remove, expand, upscale, etc.)
  | 'rename'        // Name changed
  | 'tag_change'    // Tags added/removed
  | 'metadata'      // Custom metadata changed
  | 'move'          // Moved to a different folder
  | 'restore';      // Restored from trash or rolled back

export interface VersionSnapshot {
  versionId: string;
  versionNumber: number;
  assetId: string;
  changeType: VersionChangeType;
  label?: string;      // Optional user-provided label ("Final", "Client approved")
  pinned: boolean;     // Pinned versions are exempt from auto-pruning
  userId: string;
  userName?: string;
  timestamp: Date;
  /** Storage key pointing to the file at this version (if file changed) */
  storageKey?: string;
  /** File size at this version */
  sizeBytes?: number;
  /** Image dimensions at this version */
  width?: number;
  height?: number;
  /** File format at this version */
  format?: string;
  /** Name at this version */
  name: string;
  /** Tags at this version */
  tags: string[];
  /** Folder ID at this version */
  folderId?: string;
  /** Description of what changed */
  changeDescription: string;
  /** Diff metadata: what specifically changed from previous version */
  diff: VersionDiff;
}

export interface VersionDiff {
  fieldsChanged: string[];
  fileChanged: boolean;
  nameChanged: boolean;
  tagsAdded: string[];
  tagsRemoved: string[];
  folderChanged: boolean;
  sizeChange?: number; // bytes delta
  dimensionChange?: { oldWidth?: number; oldHeight?: number; newWidth?: number; newHeight?: number };
  customChanges?: Record<string, { old: unknown; new: unknown }>;
}

export interface VersionComparison {
  fromVersion: number;
  toVersion: number;
  totalChanges: number;
  fileChanges: number;
  nameChanges: number;
  tagChanges: number;
  folderMoves: number;
  changeTypes: VersionChangeType[];
  intermediateVersions: number;
  netSizeChange: number;
  timeline: Array<{ version: number; changeType: VersionChangeType; timestamp: Date; description: string }>;
}

export interface RollbackPlan {
  currentVersion: number;
  targetVersion: number;
  rollbackSteps: number;
  willRestoreFile: boolean;
  willRestoreName: boolean;
  willRestoreTags: boolean;
  willRestoreFolder: boolean;
  warnings: string[];
  estimatedStorageKey?: string;
  estimatedName: string;
  estimatedTags: string[];
}

export interface PrunePolicy {
  keepLast: number;          // Always keep the last N versions
  keepPinned: boolean;       // Always keep pinned versions
  keepLabeled: boolean;      // Always keep labeled versions
  maxTotalVersions: number;  // Hard cap
  maxAgeInDays: number;      // Remove versions older than this (0 = no limit)
}

export interface StorageEstimate {
  totalVersions: number;
  totalBytes: number;
  averageBytesPerVersion: number;
  fileVersions: number;      // Versions where the actual file changed
  metadataOnlyVersions: number;
  pinnedVersions: number;
  labeledVersions: number;
  oldestVersion: Date | null;
  newestVersion: Date | null;
}

/* ══════════════════════════════════════════════════════════════════════════
   Constants
   ══════════════════════════════════════════════════════════════════════════ */

/** Max versions per asset before auto-pruning kicks in */
export const MAX_VERSIONS_PER_ASSET = 100;

/** Default prune policy */
export const DEFAULT_PRUNE_POLICY: PrunePolicy = {
  keepLast: 50,
  keepPinned: true,
  keepLabeled: true,
  maxTotalVersions: 100,
  maxAgeInDays: 365,
};

/** Default label for the initial upload version */
export const INITIAL_VERSION_LABEL = 'Original Upload';

/** Change type labels for UI */
export const CHANGE_TYPE_LABELS: Record<VersionChangeType, string> = {
  upload: 'Uploaded',
  overwrite: 'Replaced',
  edit: 'Edited',
  ai_process: 'AI Processed',
  rename: 'Renamed',
  tag_change: 'Tags Changed',
  metadata: 'Metadata Updated',
  move: 'Moved',
  restore: 'Restored',
};

/** Change type icons (Lucide icon names) */
export const CHANGE_TYPE_ICONS: Record<VersionChangeType, string> = {
  upload: 'Upload',
  overwrite: 'RefreshCw',
  edit: 'Pencil',
  ai_process: 'Sparkles',
  rename: 'Type',
  tag_change: 'Tag',
  metadata: 'FileText',
  move: 'FolderInput',
  restore: 'RotateCcw',
};

/* ══════════════════════════════════════════════════════════════════════════
   ID Generation
   ══════════════════════════════════════════════════════════════════════════ */

let versionIdCounter = 0;

export function resetVersionIdCounter(): void {
  versionIdCounter = 0;
}

function generateVersionId(): string {
  versionIdCounter += 1;
  return `ver_${Date.now()}_${versionIdCounter}`;
}

/* ══════════════════════════════════════════════════════════════════════════
   Version Creation
   ══════════════════════════════════════════════════════════════════════════ */

export interface CreateVersionInput {
  assetId: string;
  changeType: VersionChangeType;
  userId: string;
  userName?: string;
  name: string;
  tags: string[];
  folderId?: string;
  storageKey?: string;
  sizeBytes?: number;
  width?: number;
  height?: number;
  format?: string;
  label?: string;
  pinned?: boolean;
}

/**
 * Create the initial version (version 1) for a newly uploaded asset.
 */
export function createInitialVersion(input: CreateVersionInput): VersionSnapshot {
  return {
    versionId: generateVersionId(),
    versionNumber: 1,
    assetId: input.assetId,
    changeType: 'upload',
    label: INITIAL_VERSION_LABEL,
    pinned: true, // Initial version is always pinned
    userId: input.userId,
    userName: input.userName,
    timestamp: new Date(),
    storageKey: input.storageKey,
    sizeBytes: input.sizeBytes,
    width: input.width,
    height: input.height,
    format: input.format,
    name: input.name,
    tags: [...input.tags],
    folderId: input.folderId,
    changeDescription: `${input.name} uploaded`,
    diff: {
      fieldsChanged: ['storageKey', 'name', 'tags'],
      fileChanged: true,
      nameChanged: false,
      tagsAdded: [...input.tags],
      tagsRemoved: [],
      folderChanged: false,
    },
  };
}

/**
 * Create a new version based on changes from the previous version.
 */
export function createVersion(
  input: CreateVersionInput,
  previousVersion: VersionSnapshot,
): VersionSnapshot {
  const diff = computeDiff(previousVersion, input);
  const description = generateChangeDescription(input.changeType, diff, input.name, previousVersion.name);

  return {
    versionId: generateVersionId(),
    versionNumber: previousVersion.versionNumber + 1,
    assetId: input.assetId,
    changeType: input.changeType,
    label: input.label,
    pinned: input.pinned ?? false,
    userId: input.userId,
    userName: input.userName,
    timestamp: new Date(),
    storageKey: input.storageKey ?? previousVersion.storageKey,
    sizeBytes: input.sizeBytes ?? previousVersion.sizeBytes,
    width: input.width ?? previousVersion.width,
    height: input.height ?? previousVersion.height,
    format: input.format ?? previousVersion.format,
    name: input.name,
    tags: [...input.tags],
    folderId: input.folderId,
    changeDescription: description,
    diff,
  };
}

/**
 * Compute the diff between a previous version and new input.
 */
export function computeDiff(
  prev: VersionSnapshot,
  next: CreateVersionInput,
): VersionDiff {
  const fieldsChanged: string[] = [];
  const nameChanged = prev.name !== next.name;
  const fileChanged = next.storageKey !== undefined && next.storageKey !== prev.storageKey;
  const folderChanged = next.folderId !== prev.folderId;

  const prevTagSet = new Set(prev.tags);
  const nextTagSet = new Set(next.tags);
  const tagsAdded = next.tags.filter((t) => !prevTagSet.has(t));
  const tagsRemoved = prev.tags.filter((t) => !nextTagSet.has(t));

  if (fileChanged) fieldsChanged.push('storageKey');
  if (nameChanged) fieldsChanged.push('name');
  if (tagsAdded.length || tagsRemoved.length) fieldsChanged.push('tags');
  if (folderChanged) fieldsChanged.push('folderId');
  if (next.sizeBytes !== undefined && next.sizeBytes !== prev.sizeBytes) fieldsChanged.push('sizeBytes');
  if (next.width !== undefined && next.width !== prev.width) fieldsChanged.push('width');
  if (next.height !== undefined && next.height !== prev.height) fieldsChanged.push('height');
  if (next.format !== undefined && next.format !== prev.format) fieldsChanged.push('format');

  const sizeChange =
    next.sizeBytes !== undefined && prev.sizeBytes !== undefined
      ? next.sizeBytes - prev.sizeBytes
      : undefined;

  let dimensionChange: VersionDiff['dimensionChange'];
  if (
    (next.width !== undefined && next.width !== prev.width) ||
    (next.height !== undefined && next.height !== prev.height)
  ) {
    dimensionChange = {
      oldWidth: prev.width,
      oldHeight: prev.height,
      newWidth: next.width ?? prev.width,
      newHeight: next.height ?? prev.height,
    };
  }

  return {
    fieldsChanged,
    fileChanged,
    nameChanged,
    tagsAdded,
    tagsRemoved,
    folderChanged,
    sizeChange,
    dimensionChange,
  };
}

/**
 * Generate a human-readable change description.
 */
export function generateChangeDescription(
  changeType: VersionChangeType,
  diff: VersionDiff,
  newName: string,
  prevName: string,
): string {
  switch (changeType) {
    case 'upload':
      return `${newName} uploaded`;
    case 'overwrite':
      return `File replaced${diff.sizeChange ? ` (${formatBytes(diff.sizeChange)} change)` : ''}`;
    case 'edit':
      return `Edited: ${diff.fieldsChanged.join(', ')}`;
    case 'ai_process':
      return `AI processed${diff.dimensionChange ? ` — dimensions changed` : ''}`;
    case 'rename':
      return `Renamed from "${prevName}" to "${newName}"`;
    case 'tag_change': {
      const parts: string[] = [];
      if (diff.tagsAdded.length) parts.push(`+${diff.tagsAdded.length} tags`);
      if (diff.tagsRemoved.length) parts.push(`-${diff.tagsRemoved.length} tags`);
      return `Tags: ${parts.join(', ')}`;
    }
    case 'metadata':
      return `Metadata updated: ${diff.fieldsChanged.join(', ')}`;
    case 'move':
      return `Moved to a different folder`;
    case 'restore':
      return `Restored to version ${newName}`;
    default:
      return `Changed: ${diff.fieldsChanged.join(', ')}`;
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   Version Comparison
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Compare two versions and summarize all changes between them.
 * `versions` must be sorted by versionNumber ascending.
 */
export function compareVersions(
  versions: VersionSnapshot[],
  fromVersion: number,
  toVersion: number,
): VersionComparison {
  const sorted = [...versions].sort((a, b) => a.versionNumber - b.versionNumber);
  const inRange = sorted.filter(
    (v) => v.versionNumber > fromVersion && v.versionNumber <= toVersion,
  );

  let fileChanges = 0;
  let nameChanges = 0;
  let tagChanges = 0;
  let folderMoves = 0;
  let netSizeChange = 0;
  const changeTypes: VersionChangeType[] = [];
  const timeline: VersionComparison['timeline'] = [];

  for (const v of inRange) {
    if (v.diff.fileChanged) fileChanges++;
    if (v.diff.nameChanged) nameChanges++;
    if (v.diff.tagsAdded.length || v.diff.tagsRemoved.length) tagChanges++;
    if (v.diff.folderChanged) folderMoves++;
    if (v.diff.sizeChange) netSizeChange += v.diff.sizeChange;
    if (!changeTypes.includes(v.changeType)) changeTypes.push(v.changeType);
    timeline.push({
      version: v.versionNumber,
      changeType: v.changeType,
      timestamp: v.timestamp,
      description: v.changeDescription,
    });
  }

  return {
    fromVersion,
    toVersion,
    totalChanges: inRange.length,
    fileChanges,
    nameChanges,
    tagChanges,
    folderMoves,
    changeTypes,
    intermediateVersions: inRange.length,
    netSizeChange,
    timeline,
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   Rollback
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Build a rollback plan — describes what a rollback to a target version
 * would restore, and any warnings.
 */
export function buildRollbackPlan(
  versions: VersionSnapshot[],
  currentVersion: number,
  targetVersion: number,
): RollbackPlan {
  const sorted = [...versions].sort((a, b) => a.versionNumber - b.versionNumber);
  const target = sorted.find((v) => v.versionNumber === targetVersion);
  const current = sorted.find((v) => v.versionNumber === currentVersion);

  if (!target || !current) {
    return {
      currentVersion,
      targetVersion,
      rollbackSteps: 0,
      willRestoreFile: false,
      willRestoreName: false,
      willRestoreTags: false,
      willRestoreFolder: false,
      warnings: ['Target or current version not found'],
      estimatedName: '',
      estimatedTags: [],
    };
  }

  const warnings: string[] = [];

  if (targetVersion >= currentVersion) {
    warnings.push('Target version must be older than current version');
  }

  // Check if any intermediate versions had destructive changes
  const intermediate = sorted.filter(
    (v) => v.versionNumber > targetVersion && v.versionNumber <= currentVersion,
  );
  const aiProcessed = intermediate.some((v) => v.changeType === 'ai_process');
  if (aiProcessed) {
    warnings.push('Rolling back past AI-processed versions — AI changes will be lost');
  }

  const willRestoreFile = target.storageKey !== current.storageKey;
  const willRestoreName = target.name !== current.name;
  const willRestoreTags =
    JSON.stringify([...target.tags].sort()) !==
    JSON.stringify([...current.tags].sort());
  const willRestoreFolder = target.folderId !== current.folderId;

  if (willRestoreFile && !target.storageKey) {
    warnings.push('Target version has no stored file reference — file may not be recoverable');
  }

  return {
    currentVersion,
    targetVersion,
    rollbackSteps: currentVersion - targetVersion,
    willRestoreFile,
    willRestoreName,
    willRestoreTags,
    willRestoreFolder,
    warnings,
    estimatedStorageKey: target.storageKey,
    estimatedName: target.name,
    estimatedTags: [...target.tags],
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   Pruning
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Given a list of versions and a prune policy, determine which versions
 * should be deleted to comply with the policy.
 * Returns the IDs of versions to remove.
 */
export function computePruneTargets(
  versions: VersionSnapshot[],
  policy: PrunePolicy = DEFAULT_PRUNE_POLICY,
  referenceDate: Date = new Date(),
): string[] {
  if (versions.length <= policy.keepLast) return [];

  const sorted = [...versions].sort((a, b) => a.versionNumber - b.versionNumber);
  const removeIds: string[] = [];

  // Mark the last N as protected
  const protectedIndices = new Set<number>();
  for (let i = Math.max(0, sorted.length - policy.keepLast); i < sorted.length; i++) {
    protectedIndices.add(i);
  }

  for (let i = 0; i < sorted.length; i++) {
    if (protectedIndices.has(i)) continue;

    const v = sorted[i];

    // Skip pinned
    if (policy.keepPinned && v.pinned) continue;

    // Skip labeled
    if (policy.keepLabeled && v.label) continue;

    // Check age
    if (policy.maxAgeInDays > 0) {
      const ageMs = referenceDate.getTime() - new Date(v.timestamp).getTime();
      const ageDays = ageMs / (1000 * 60 * 60 * 24);
      if (ageDays > policy.maxAgeInDays) {
        removeIds.push(v.versionId);
        continue;
      }
    }

    // Check total cap
    const remaining = sorted.length - removeIds.length;
    if (remaining > policy.maxTotalVersions) {
      removeIds.push(v.versionId);
    }
  }

  return removeIds;
}

/**
 * Validate a prune policy.
 */
export function validatePrunePolicy(policy: Partial<PrunePolicy>): PrunePolicy {
  return {
    keepLast: Math.max(1, Math.min(policy.keepLast ?? DEFAULT_PRUNE_POLICY.keepLast, MAX_VERSIONS_PER_ASSET)),
    keepPinned: policy.keepPinned ?? DEFAULT_PRUNE_POLICY.keepPinned,
    keepLabeled: policy.keepLabeled ?? DEFAULT_PRUNE_POLICY.keepLabeled,
    maxTotalVersions: Math.max(1, Math.min(policy.maxTotalVersions ?? DEFAULT_PRUNE_POLICY.maxTotalVersions, MAX_VERSIONS_PER_ASSET * 2)),
    maxAgeInDays: Math.max(0, policy.maxAgeInDays ?? DEFAULT_PRUNE_POLICY.maxAgeInDays),
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   Storage Estimation
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Compute storage statistics for an asset's version history.
 */
export function computeStorageEstimate(versions: VersionSnapshot[]): StorageEstimate {
  if (!versions.length) {
    return {
      totalVersions: 0,
      totalBytes: 0,
      averageBytesPerVersion: 0,
      fileVersions: 0,
      metadataOnlyVersions: 0,
      pinnedVersions: 0,
      labeledVersions: 0,
      oldestVersion: null,
      newestVersion: null,
    };
  }

  let totalBytes = 0;
  let fileVersions = 0;
  let metadataOnlyVersions = 0;
  let pinnedVersions = 0;
  let labeledVersions = 0;

  const dates = versions.map((v) => new Date(v.timestamp).getTime());

  for (const v of versions) {
    if (v.sizeBytes) totalBytes += v.sizeBytes;
    if (v.diff.fileChanged) fileVersions++;
    else metadataOnlyVersions++;
    if (v.pinned) pinnedVersions++;
    if (v.label) labeledVersions++;
  }

  return {
    totalVersions: versions.length,
    totalBytes,
    averageBytesPerVersion: Math.round(totalBytes / versions.length),
    fileVersions,
    metadataOnlyVersions,
    pinnedVersions,
    labeledVersions,
    oldestVersion: new Date(Math.min(...dates)),
    newestVersion: new Date(Math.max(...dates)),
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   Version Label / Pin
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Set a label on a specific version.
 */
export function labelVersion(
  versions: VersionSnapshot[],
  versionNumber: number,
  label: string,
): VersionSnapshot[] {
  return versions.map((v) =>
    v.versionNumber === versionNumber
      ? { ...v, label: label.trim() || undefined }
      : v,
  );
}

/**
 * Toggle pin state on a specific version.
 */
export function togglePin(
  versions: VersionSnapshot[],
  versionNumber: number,
): VersionSnapshot[] {
  return versions.map((v) =>
    v.versionNumber === versionNumber ? { ...v, pinned: !v.pinned } : v,
  );
}

/**
 * Get the latest version from an array.
 */
export function getLatestVersion(versions: VersionSnapshot[]): VersionSnapshot | undefined {
  if (!versions.length) return undefined;
  return versions.reduce((latest, v) =>
    v.versionNumber > latest.versionNumber ? v : latest,
  );
}

/**
 * Get a specific version by number.
 */
export function getVersion(
  versions: VersionSnapshot[],
  versionNumber: number,
): VersionSnapshot | undefined {
  return versions.find((v) => v.versionNumber === versionNumber);
}

/* ══════════════════════════════════════════════════════════════════════════
   Utility
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Format a bytes delta to human-readable string with sign.
 */
export function formatBytes(bytes: number): string {
  const sign = bytes >= 0 ? '+' : '';
  const abs = Math.abs(bytes);
  if (abs < 1024) return `${sign}${bytes} B`;
  if (abs < 1024 * 1024) return `${sign}${(bytes / 1024).toFixed(1)} KB`;
  if (abs < 1024 * 1024 * 1024) return `${sign}${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${sign}${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
