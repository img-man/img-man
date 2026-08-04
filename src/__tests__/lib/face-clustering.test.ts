// SPDX-License-Identifier: Apache-2.0
/**
 * Sprint 10 – Face Clustering Tests
 */
import { describe, it, expect, vi } from 'vitest';

// --- face-clustering.ts ---
describe('Face Clustering', () => {
  it('should dynamically import face-clustering module', async () => {
    const mod = await import('@/lib/face-clustering');
    expect(mod.buildFaceClusterPipeline).toBeDefined();
    expect(mod.dominantEmotion).toBeDefined();
    expect(mod.shouldMergeFaces).toBeDefined();
    expect(mod.mergeClusters).toBeDefined();
  });

  it('buildFaceClusterPipeline returns aggregation stages', async () => {
    const { buildFaceClusterPipeline } = await import('@/lib/face-clustering');
    const pipeline = buildFaceClusterPipeline('org1', 1, 20, 0);
    expect(Array.isArray(pipeline)).toBe(true);
    expect(pipeline.length).toBeGreaterThanOrEqual(4);
    // First stage should be $match
    expect(pipeline[0]).toHaveProperty('$match');
    expect(pipeline[0].$match.orgId).toBe('org1');
    expect(pipeline[0].$match['faces.0']).toEqual({ $exists: true });
  });

  it('buildFaceClusterPipeline includes $unwind and $group stages', async () => {
    const { buildFaceClusterPipeline } = await import('@/lib/face-clustering');
    const pipeline = buildFaceClusterPipeline('org1');
    const stageKeys = pipeline.map(
      (s: Record<string, unknown>) => Object.keys(s)[0],
    );
    expect(stageKeys).toContain('$unwind');
    expect(stageKeys).toContain('$group');
    expect(stageKeys).toContain('$facet');
  });

  it('buildFaceClusterPipeline respects minPhotos parameter', async () => {
    const { buildFaceClusterPipeline } = await import('@/lib/face-clustering');
    const pipeline = buildFaceClusterPipeline('org1', 5);
    // Should have a $match stage after $group that filters by minPhotos
    const matchStages = pipeline.filter(
      (s: Record<string, unknown>) =>
        '$match' in s && !('orgId' in (s.$match as Record<string, unknown>)),
    );
    expect(matchStages.length).toBeGreaterThanOrEqual(1);
  });

  it('dominantEmotion returns most common emotion', async () => {
    const { dominantEmotion } = await import('@/lib/face-clustering');
    expect(dominantEmotion(['happy', 'happy', 'sad', 'happy', 'neutral'])).toBe(
      'happy',
    );
    expect(dominantEmotion(['sad', 'sad', 'happy'])).toBe('sad');
    expect(dominantEmotion([])).toBeUndefined();
  });

  it('shouldMergeFaces returns true for same hash', async () => {
    const { shouldMergeFaces } = await import('@/lib/face-clustering');
    expect(shouldMergeFaces('abc123', 'abc123')).toBe(true);
    expect(shouldMergeFaces('abc123', 'def456')).toBe(false);
  });

  it('mergeClusters combines face cluster data', async () => {
    const { mergeClusters } = await import('@/lib/face-clustering');
    const primary = {
      faceHash: 'primary',
      photoCount: 5,
      sampleAssetIds: ['a1', 'a2'],
      sampleThumbnails: ['t1'],
      emotions: ['happy', 'happy'],
    };
    const secondary = {
      faceHash: 'secondary',
      photoCount: 3,
      sampleAssetIds: ['a3', 'a4'],
      sampleThumbnails: ['t2'],
      emotions: ['sad'],
    };
    const merged = mergeClusters(primary, secondary);
    expect(merged.faceHash).toBe('primary');
    expect(merged.photoCount).toBe(8);
    expect(merged.sampleAssetIds.length).toBe(4);
    expect(merged.sampleThumbnails.length).toBe(2);
  });
});
