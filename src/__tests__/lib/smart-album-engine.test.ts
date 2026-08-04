// SPDX-License-Identifier: Apache-2.0
/**
 * Sprint 10 – Smart Album Engine Tests
 */
import { describe, it, expect } from 'vitest';

describe('Smart Album Engine', () => {
  it('should dynamically import smart-album-engine module', async () => {
    const mod = await import('@/lib/smart-album-engine');
    expect(mod.rulesToMongoFilter).toBeDefined();
    expect(mod.PRESET_SMART_ALBUMS).toBeDefined();
  });

  it('rulesToMongoFilter adds orgId to filter', async () => {
    const { rulesToMongoFilter } = await import('@/lib/smart-album-engine');
    const filter = rulesToMongoFilter('org123', []);
    expect(filter.orgId).toBe('org123');
  });

  it('rulesToMongoFilter handles eq operator', async () => {
    const { rulesToMongoFilter } = await import('@/lib/smart-album-engine');
    const filter = rulesToMongoFilter('org1', [
      { field: 'mimeType', operator: 'eq', value: 'image/png' },
    ]);
    expect(filter.mimeType).toBe('image/png');
  });

  it('rulesToMongoFilter handles ne operator', async () => {
    const { rulesToMongoFilter } = await import('@/lib/smart-album-engine');
    const filter = rulesToMongoFilter('org1', [
      { field: 'fileCategory', operator: 'ne', value: 'video' },
    ]);
    expect(filter.fileCategory).toEqual({ $ne: 'video' });
  });

  it('rulesToMongoFilter handles contains operator with regex', async () => {
    const { rulesToMongoFilter } = await import('@/lib/smart-album-engine');
    const filter = rulesToMongoFilter('org1', [
      { field: 'originalName', operator: 'contains', value: 'screenshot' },
    ]);
    expect(filter.originalName).toEqual({
      $regex: 'screenshot',
      $options: 'i',
    });
  });

  it('rulesToMongoFilter handles startsWith operator', async () => {
    const { rulesToMongoFilter } = await import('@/lib/smart-album-engine');
    const filter = rulesToMongoFilter('org1', [
      { field: 'name', operator: 'startsWith', value: 'IMG_' },
    ]);
    expect(filter.name).toEqual({ $regex: '^IMG_', $options: 'i' });
  });

  it('rulesToMongoFilter handles gt/lt operators with numbers', async () => {
    const { rulesToMongoFilter } = await import('@/lib/smart-album-engine');
    const filter = rulesToMongoFilter('org1', [
      { field: 'sizeBytes', operator: 'gt', value: 5000000 },
    ]);
    expect(filter.sizeBytes).toEqual({ $gt: 5000000 });
  });

  it('rulesToMongoFilter handles gte/lte operators', async () => {
    const { rulesToMongoFilter } = await import('@/lib/smart-album-engine');
    const filter = rulesToMongoFilter('org1', [
      { field: 'width', operator: 'gte', value: 1920 },
    ]);
    expect(filter.width).toEqual({ $gte: 1920 });
  });

  it('rulesToMongoFilter handles exists operator', async () => {
    const { rulesToMongoFilter } = await import('@/lib/smart-album-engine');
    const filter = rulesToMongoFilter('org1', [
      { field: 'exif.gps', operator: 'exists', value: 'true' },
    ]);
    expect(filter['exif.gps']).toEqual({ $exists: true });
  });

  it('rulesToMongoFilter handles regex operator', async () => {
    const { rulesToMongoFilter } = await import('@/lib/smart-album-engine');
    const filter = rulesToMongoFilter('org1', [
      { field: 'tags', operator: 'regex', value: '^nature' },
    ]);
    expect(filter.tags).toEqual({ $regex: '^nature', $options: 'i' });
  });

  it('rulesToMongoFilter handles multiple rules (AND logic)', async () => {
    const { rulesToMongoFilter } = await import('@/lib/smart-album-engine');
    const filter = rulesToMongoFilter('org1', [
      { field: 'mimeType', operator: 'eq', value: 'image/jpeg' },
      { field: 'sizeBytes', operator: 'gt', value: 1000000 },
    ]);
    expect(filter.orgId).toBe('org1');
    expect(filter.mimeType).toBe('image/jpeg');
    expect(filter.sizeBytes).toEqual({ $gt: 1000000 });
  });

  it('rulesToMongoFilter coerces numeric fields', async () => {
    const { rulesToMongoFilter } = await import('@/lib/smart-album-engine');
    const filter = rulesToMongoFilter('org1', [
      { field: 'sizeBytes', operator: 'eq', value: '1024' },
    ]);
    expect(filter.sizeBytes).toBe(1024);
  });

  it('rulesToMongoFilter coerces boolean fields', async () => {
    const { rulesToMongoFilter } = await import('@/lib/smart-album-engine');
    const filter = rulesToMongoFilter('org1', [
      { field: 'isStarred', operator: 'eq', value: 'true' },
    ]);
    expect(filter.isStarred).toBe(true);
  });

  it('rulesToMongoFilter escapes special regex characters in contains', async () => {
    const { rulesToMongoFilter } = await import('@/lib/smart-album-engine');
    const filter = rulesToMongoFilter('org1', [
      { field: 'name', operator: 'contains', value: 'file.test' },
    ]);
    // The dot should be escaped
    expect((filter.name as { $regex: string }).$regex).toBe('file\\.test');
  });

  it('rulesToMongoFilter handles gt with ISO date string', async () => {
    const { rulesToMongoFilter } = await import('@/lib/smart-album-engine');
    const filter = rulesToMongoFilter('org1', [
      { field: 'createdAt', operator: 'gt', value: '2024-01-01T00:00:00Z' },
    ]);
    expect(filter.createdAt).toEqual({ $gt: expect.any(Date) });
  });

  it('PRESET_SMART_ALBUMS has expected presets', async () => {
    const { PRESET_SMART_ALBUMS } = await import('@/lib/smart-album-engine');
    expect(PRESET_SMART_ALBUMS.length).toBeGreaterThanOrEqual(5);

    const names = PRESET_SMART_ALBUMS.map((p) => p.name);
    expect(names).toContain('All Screenshots');
    expect(names).toContain('Photos with Faces');
    expect(names).toContain('Large Files (>5MB)');
    expect(names).toContain('Starred');
    expect(names).toContain('Geotagged Photos');
  });

  it('each preset has valid rules', async () => {
    const { PRESET_SMART_ALBUMS } = await import('@/lib/smart-album-engine');
    for (const preset of PRESET_SMART_ALBUMS) {
      expect(preset.name).toBeTruthy();
      expect(preset.icon).toBeTruthy();
      expect(preset.rules.length).toBeGreaterThanOrEqual(1);
      for (const rule of preset.rules) {
        expect(rule.field).toBeTruthy();
        expect(rule.operator).toBeTruthy();
      }
    }
  });

  it('rulesToMongoFilter skips unknown operators', async () => {
    const { rulesToMongoFilter } = await import('@/lib/smart-album-engine');
    const filter = rulesToMongoFilter('org1', [
      { field: 'name', operator: 'unknown_op' as 'eq', value: 'test' },
    ]);
    // Should only have orgId, the unknown op field should be skipped
    expect(Object.keys(filter)).toEqual(['orgId']);
  });
});
