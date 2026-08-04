// SPDX-License-Identifier: Apache-2.0
/**
 * Asset Version History Engine — Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  resetVersionIdCounter,
  createInitialVersion,
  createVersion,
  computeDiff,
  generateChangeDescription,
  compareVersions,
  buildRollbackPlan,
  computePruneTargets,
  validatePrunePolicy,
  computeStorageEstimate,
  labelVersion,
  togglePin,
  getLatestVersion,
  getVersion,
  formatBytes,
  MAX_VERSIONS_PER_ASSET,
  DEFAULT_PRUNE_POLICY,
  INITIAL_VERSION_LABEL,
  CHANGE_TYPE_LABELS,
  CHANGE_TYPE_ICONS,
  type VersionSnapshot,
  type CreateVersionInput,
} from '@/lib/version-history';

/* ─── Helpers ────────────────────────────────────────────────── */

function makeInput(overrides: Partial<CreateVersionInput> = {}): CreateVersionInput {
  return {
    assetId: overrides.assetId ?? 'asset1',
    changeType: overrides.changeType ?? 'upload',
    userId: overrides.userId ?? 'u1',
    userName: overrides.userName ?? 'Alice',
    name: overrides.name ?? 'photo.png',
    tags: overrides.tags ?? ['nature', 'landscape'],
    folderId: overrides.folderId ?? 'folder1',
    storageKey: overrides.storageKey ?? 'org1/photo.png',
    sizeBytes: overrides.sizeBytes ?? 1024000,
    width: overrides.width ?? 1920,
    height: overrides.height ?? 1080,
    format: overrides.format ?? 'image/png',
  };
}

function buildVersionChain(count: number): VersionSnapshot[] {
  const v1 = createInitialVersion(makeInput());
  const versions: VersionSnapshot[] = [v1];

  for (let i = 1; i < count; i++) {
    const prev = versions[i - 1];
    const v = createVersion(
      makeInput({
        changeType: 'edit',
        sizeBytes: 1024000 + i * 100,
        tags: ['nature', 'landscape', `tag${i}`],
      }),
      prev,
    );
    versions.push(v);
  }
  return versions;
}

/* ─── Tests ──────────────────────────────────────────────────── */

beforeEach(() => {
  resetVersionIdCounter();
});

/* ═══════════════════════════════════════════════════════════════════════ */
/*  Constants                                                             */
/* ═══════════════════════════════════════════════════════════════════════ */

describe('version-history constants', () => {
  it('MAX_VERSIONS_PER_ASSET is 100', () => {
    expect(MAX_VERSIONS_PER_ASSET).toBe(100);
  });

  it('DEFAULT_PRUNE_POLICY has sensible defaults', () => {
    expect(DEFAULT_PRUNE_POLICY.keepLast).toBe(50);
    expect(DEFAULT_PRUNE_POLICY.keepPinned).toBe(true);
    expect(DEFAULT_PRUNE_POLICY.keepLabeled).toBe(true);
    expect(DEFAULT_PRUNE_POLICY.maxTotalVersions).toBe(100);
    expect(DEFAULT_PRUNE_POLICY.maxAgeInDays).toBe(365);
  });

  it('INITIAL_VERSION_LABEL is "Original Upload"', () => {
    expect(INITIAL_VERSION_LABEL).toBe('Original Upload');
  });

  it('CHANGE_TYPE_LABELS covers all 9 types', () => {
    expect(Object.keys(CHANGE_TYPE_LABELS)).toHaveLength(9);
  });

  it('CHANGE_TYPE_ICONS covers all 9 types', () => {
    expect(Object.keys(CHANGE_TYPE_ICONS)).toHaveLength(9);
  });
});

/* ═══════════════════════════════════════════════════════════════════════ */
/*  createInitialVersion                                                  */
/* ═══════════════════════════════════════════════════════════════════════ */

describe('createInitialVersion', () => {
  it('creates version 1 with upload changeType', () => {
    const v = createInitialVersion(makeInput());
    expect(v.versionNumber).toBe(1);
    expect(v.changeType).toBe('upload');
    expect(v.label).toBe(INITIAL_VERSION_LABEL);
    expect(v.pinned).toBe(true);
    expect(v.name).toBe('photo.png');
    expect(v.tags).toEqual(['nature', 'landscape']);
  });

  it('generates a unique version ID', () => {
    const v1 = createInitialVersion(makeInput());
    const v2 = createInitialVersion(makeInput({ assetId: 'asset2' }));
    expect(v1.versionId).not.toBe(v2.versionId);
  });

  it('includes file metadata', () => {
    const v = createInitialVersion(makeInput());
    expect(v.sizeBytes).toBe(1024000);
    expect(v.width).toBe(1920);
    expect(v.height).toBe(1080);
    expect(v.format).toBe('image/png');
  });

  it('marks tags as changed in diff', () => {
    const v = createInitialVersion(makeInput());
    expect(v.diff.tagsAdded).toEqual(['nature', 'landscape']);
    expect(v.diff.fileChanged).toBe(true);
  });
});

/* ═══════════════════════════════════════════════════════════════════════ */
/*  createVersion                                                         */
/* ═══════════════════════════════════════════════════════════════════════ */

describe('createVersion', () => {
  it('increments version number', () => {
    const v1 = createInitialVersion(makeInput());
    const v2 = createVersion(makeInput({ changeType: 'edit' }), v1);
    expect(v2.versionNumber).toBe(2);
  });

  it('detects name change for rename', () => {
    const v1 = createInitialVersion(makeInput());
    const v2 = createVersion(
      makeInput({ changeType: 'rename', name: 'renamed.png' }),
      v1,
    );
    expect(v2.diff.nameChanged).toBe(true);
    expect(v2.changeDescription).toContain('Renamed');
  });

  it('detects tag changes', () => {
    const v1 = createInitialVersion(makeInput());
    const v2 = createVersion(
      makeInput({ changeType: 'tag_change', tags: ['nature', 'new-tag'] }),
      v1,
    );
    expect(v2.diff.tagsAdded).toContain('new-tag');
    expect(v2.diff.tagsRemoved).toContain('landscape');
  });

  it('detects folder move', () => {
    const v1 = createInitialVersion(makeInput());
    const v2 = createVersion(
      makeInput({ changeType: 'move', folderId: 'folder2' }),
      v1,
    );
    expect(v2.diff.folderChanged).toBe(true);
    expect(v2.changeDescription).toContain('Moved');
  });

  it('inherits previous storageKey when not provided', () => {
    const v1 = createInitialVersion(makeInput());
    const v2 = createVersion(
      makeInput({ changeType: 'rename', storageKey: undefined }),
      v1,
    );
    expect(v2.storageKey).toBe(v1.storageKey);
  });
});

/* ═══════════════════════════════════════════════════════════════════════ */
/*  computeDiff                                                           */
/* ═══════════════════════════════════════════════════════════════════════ */

describe('computeDiff', () => {
  it('detects file change', () => {
    const v1 = createInitialVersion(makeInput());
    const diff = computeDiff(v1, makeInput({ storageKey: 'new/key.png' }));
    expect(diff.fileChanged).toBe(true);
    expect(diff.fieldsChanged).toContain('storageKey');
  });

  it('detects dimension change', () => {
    const v1 = createInitialVersion(makeInput());
    const diff = computeDiff(v1, makeInput({ width: 3840, height: 2160 }));
    expect(diff.dimensionChange).toBeDefined();
    expect(diff.dimensionChange?.newWidth).toBe(3840);
  });

  it('detects size change', () => {
    const v1 = createInitialVersion(makeInput());
    const diff = computeDiff(v1, makeInput({ sizeBytes: 2048000 }));
    expect(diff.sizeChange).toBe(1024000);
    expect(diff.fieldsChanged).toContain('sizeBytes');
  });

  it('returns empty changes when nothing differs', () => {
    const v1 = createInitialVersion(makeInput());
    const diff = computeDiff(v1, makeInput());
    expect(diff.nameChanged).toBe(false);
    expect(diff.folderChanged).toBe(false);
    expect(diff.tagsAdded).toHaveLength(0);
    expect(diff.tagsRemoved).toHaveLength(0);
  });
});

/* ═══════════════════════════════════════════════════════════════════════ */
/*  generateChangeDescription                                             */
/* ═══════════════════════════════════════════════════════════════════════ */

describe('generateChangeDescription', () => {
  const emptyDiff = {
    fieldsChanged: [] as string[],
    fileChanged: false,
    nameChanged: false,
    tagsAdded: [] as string[],
    tagsRemoved: [] as string[],
    folderChanged: false,
  };

  it('describes upload', () => {
    expect(generateChangeDescription('upload', emptyDiff, 'f.png', 'f.png')).toContain('uploaded');
  });

  it('describes overwrite with size change', () => {
    const diff = { ...emptyDiff, sizeChange: 500 };
    const desc = generateChangeDescription('overwrite', diff, 'f.png', 'f.png');
    expect(desc).toContain('replaced');
  });

  it('describes rename', () => {
    const desc = generateChangeDescription('rename', emptyDiff, 'new.png', 'old.png');
    expect(desc).toContain('old.png');
    expect(desc).toContain('new.png');
  });

  it('describes tag changes', () => {
    const diff = { ...emptyDiff, tagsAdded: ['a', 'b'], tagsRemoved: ['c'] };
    const desc = generateChangeDescription('tag_change', diff, 'f.png', 'f.png');
    expect(desc).toContain('+2 tags');
    expect(desc).toContain('-1 tags');
  });

  it('describes move', () => {
    const desc = generateChangeDescription('move', emptyDiff, 'f.png', 'f.png');
    expect(desc).toContain('Moved');
  });

  it('describes restore', () => {
    const desc = generateChangeDescription('restore', emptyDiff, 'f.png', 'f.png');
    expect(desc).toContain('Restored');
  });
});

/* ═══════════════════════════════════════════════════════════════════════ */
/*  compareVersions                                                       */
/* ═══════════════════════════════════════════════════════════════════════ */

describe('compareVersions', () => {
  it('compares a range of versions', () => {
    const versions = buildVersionChain(5);
    const comparison = compareVersions(versions, 1, 5);
    expect(comparison.fromVersion).toBe(1);
    expect(comparison.toVersion).toBe(5);
    expect(comparison.totalChanges).toBe(4); // versions 2-5
    expect(comparison.timeline).toHaveLength(4);
  });

  it('returns 0 changes for same version', () => {
    const versions = buildVersionChain(3);
    const comparison = compareVersions(versions, 2, 2);
    expect(comparison.totalChanges).toBe(0);
  });

  it('tracks net size change', () => {
    const versions = buildVersionChain(3);
    const comparison = compareVersions(versions, 1, 3);
    expect(comparison.netSizeChange).toBeDefined();
  });
});

/* ═══════════════════════════════════════════════════════════════════════ */
/*  buildRollbackPlan                                                     */
/* ═══════════════════════════════════════════════════════════════════════ */

describe('buildRollbackPlan', () => {
  it('plans rollback from current to older version', () => {
    const versions = buildVersionChain(5);
    const plan = buildRollbackPlan(versions, 5, 1);
    expect(plan.rollbackSteps).toBe(4);
    expect(plan.estimatedName).toBe('photo.png');
    expect(plan.warnings.length).toBeGreaterThanOrEqual(0);
  });

  it('warns when target version not found', () => {
    const versions = buildVersionChain(3);
    const plan = buildRollbackPlan(versions, 3, 99);
    expect(plan.warnings).toContain('Target or current version not found');
  });

  it('warns about AI-processed intermediate versions', () => {
    const v1 = createInitialVersion(makeInput());
    const v2 = createVersion(
      makeInput({ changeType: 'ai_process', storageKey: 'key2' }),
      v1,
    );
    const v3 = createVersion(makeInput({ changeType: 'edit' }), v2);
    const plan = buildRollbackPlan([v1, v2, v3], 3, 1);
    expect(plan.warnings.some((w) => w.includes('AI'))).toBe(true);
  });

  it('detects file restoration needed', () => {
    const v1 = createInitialVersion(makeInput());
    const v2 = createVersion(
      makeInput({ changeType: 'overwrite', storageKey: 'new/key.png' }),
      v1,
    );
    const plan = buildRollbackPlan([v1, v2], 2, 1);
    expect(plan.willRestoreFile).toBe(true);
  });
});

/* ═══════════════════════════════════════════════════════════════════════ */
/*  computePruneTargets                                                   */
/* ═══════════════════════════════════════════════════════════════════════ */

describe('computePruneTargets', () => {
  it('returns empty when under keepLast', () => {
    const versions = buildVersionChain(3);
    const targets = computePruneTargets(versions, { ...DEFAULT_PRUNE_POLICY, keepLast: 50 });
    expect(targets).toHaveLength(0);
  });

  it('prunes old versions exceeding keepLast', () => {
    const versions = buildVersionChain(10);
    const targets = computePruneTargets(versions, {
      ...DEFAULT_PRUNE_POLICY,
      keepLast: 3,
      maxTotalVersions: 5,
      keepPinned: false,
      keepLabeled: false,
    });
    expect(targets.length).toBeGreaterThan(0);
  });

  it('preserves pinned versions', () => {
    const versions = buildVersionChain(10);
    // v1 is always pinned
    const targets = computePruneTargets(versions, {
      keepLast: 3,
      keepPinned: true,
      keepLabeled: false,
      maxTotalVersions: 5,
      maxAgeInDays: 0,
    });
    const v1Id = versions[0].versionId;
    expect(targets).not.toContain(v1Id);
  });

  it('preserves labeled versions', () => {
    const versions = buildVersionChain(10);
    const labeled = labelVersion(versions, 2, 'Important');
    const targets = computePruneTargets(labeled, {
      keepLast: 3,
      keepPinned: false,
      keepLabeled: true,
      maxTotalVersions: 5,
      maxAgeInDays: 0,
    });
    const v2Id = labeled[1].versionId;
    expect(targets).not.toContain(v2Id);
  });
});

/* ═══════════════════════════════════════════════════════════════════════ */
/*  validatePrunePolicy                                                   */
/* ═══════════════════════════════════════════════════════════════════════ */

describe('validatePrunePolicy', () => {
  it('fills defaults for empty input', () => {
    const policy = validatePrunePolicy({});
    expect(policy.keepLast).toBe(DEFAULT_PRUNE_POLICY.keepLast);
    expect(policy.keepPinned).toBe(true);
    expect(policy.keepLabeled).toBe(true);
  });

  it('clamps keepLast to at least 1', () => {
    const policy = validatePrunePolicy({ keepLast: -5 });
    expect(policy.keepLast).toBeGreaterThanOrEqual(1);
  });

  it('clamps maxAgeInDays to non-negative', () => {
    const policy = validatePrunePolicy({ maxAgeInDays: -10 });
    expect(policy.maxAgeInDays).toBeGreaterThanOrEqual(0);
  });
});

/* ═══════════════════════════════════════════════════════════════════════ */
/*  computeStorageEstimate                                                */
/* ═══════════════════════════════════════════════════════════════════════ */

describe('computeStorageEstimate', () => {
  it('returns zeros for empty array', () => {
    const est = computeStorageEstimate([]);
    expect(est.totalVersions).toBe(0);
    expect(est.totalBytes).toBe(0);
    expect(est.oldestVersion).toBeNull();
    expect(est.newestVersion).toBeNull();
  });

  it('sums all version sizes', () => {
    const versions = buildVersionChain(5);
    const est = computeStorageEstimate(versions);
    expect(est.totalVersions).toBe(5);
    expect(est.totalBytes).toBeGreaterThan(0);
    expect(est.averageBytesPerVersion).toBe(
      Math.round(est.totalBytes / 5),
    );
  });

  it('counts file vs metadata-only versions', () => {
    const versions = buildVersionChain(3);
    const est = computeStorageEstimate(versions);
    expect(est.fileVersions + est.metadataOnlyVersions).toBe(3);
  });

  it('counts pinned and labeled versions', () => {
    const versions = buildVersionChain(3);
    const labeled = labelVersion(versions, 2, 'Release');
    const est = computeStorageEstimate(labeled);
    expect(est.pinnedVersions).toBeGreaterThanOrEqual(1); // v1 always pinned
    expect(est.labeledVersions).toBeGreaterThanOrEqual(1);
  });
});

/* ═══════════════════════════════════════════════════════════════════════ */
/*  labelVersion / togglePin                                              */
/* ═══════════════════════════════════════════════════════════════════════ */

describe('labelVersion', () => {
  it('sets a label on the target version', () => {
    const versions = buildVersionChain(3);
    const updated = labelVersion(versions, 2, ' Release ');
    expect(updated[1].label).toBe('Release');
  });

  it('clears label when given empty string', () => {
    const versions = buildVersionChain(3);
    const labeled = labelVersion(versions, 2, 'Draft');
    const cleared = labelVersion(labeled, 2, '');
    expect(cleared[1].label).toBeUndefined();
  });

  it('does not mutate other versions', () => {
    const versions = buildVersionChain(3);
    const updated = labelVersion(versions, 2, 'Test');
    expect(updated[0].label).toBe(INITIAL_VERSION_LABEL);
  });
});

describe('togglePin', () => {
  it('flips pin state', () => {
    const versions = buildVersionChain(3);
    // v1 starts pinned
    const toggled = togglePin(versions, 1);
    expect(toggled[0].pinned).toBe(false);
  });

  it('can pin an unpinned version', () => {
    const versions = buildVersionChain(3);
    // v2 starts unpinned
    expect(versions[1].pinned).toBe(false);
    const toggled = togglePin(versions, 2);
    expect(toggled[1].pinned).toBe(true);
  });
});

/* ═══════════════════════════════════════════════════════════════════════ */
/*  getLatestVersion / getVersion                                         */
/* ═══════════════════════════════════════════════════════════════════════ */

describe('getLatestVersion', () => {
  it('returns the highest version number', () => {
    const versions = buildVersionChain(5);
    const latest = getLatestVersion(versions);
    expect(latest?.versionNumber).toBe(5);
  });

  it('returns undefined for empty array', () => {
    expect(getLatestVersion([])).toBeUndefined();
  });
});

describe('getVersion', () => {
  it('finds version by number', () => {
    const versions = buildVersionChain(5);
    const v3 = getVersion(versions, 3);
    expect(v3?.versionNumber).toBe(3);
  });

  it('returns undefined for missing version', () => {
    const versions = buildVersionChain(3);
    expect(getVersion(versions, 99)).toBeUndefined();
  });
});

/* ═══════════════════════════════════════════════════════════════════════ */
/*  formatBytes                                                           */
/* ═══════════════════════════════════════════════════════════════════════ */

describe('formatBytes', () => {
  it('formats small positive bytes', () => {
    expect(formatBytes(100)).toBe('+100 B');
  });

  it('formats KB', () => {
    expect(formatBytes(2048)).toBe('+2.0 KB');
  });

  it('formats negative bytes', () => {
    expect(formatBytes(-1024)).toBe('-1.0 KB');
  });

  it('formats zero', () => {
    expect(formatBytes(0)).toBe('+0 B');
  });

  it('formats MB', () => {
    const mb = 1024 * 1024 * 5;
    expect(formatBytes(mb)).toContain('MB');
  });

  it('formats GB', () => {
    const gb = 1024 * 1024 * 1024 * 2;
    expect(formatBytes(gb)).toContain('GB');
  });
});
