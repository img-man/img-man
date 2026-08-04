// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';

import {
  filterAssetsByPerson,
  listPeople,
  namePerson,
  type AssetWithFaces,
} from '@/lib/people';

const ASSETS: AssetWithFaces[] = [
  {
    id: 'a1',
    faces: [
      { faceHash: 'alice', confidence: 0.9 },
      { faceHash: 'bob', confidence: 0.8 },
    ],
  },
  {
    id: 'a2',
    faces: [
      { faceHash: 'alice', confidence: 0.95 },
      // Same face twice in one photo \u2014 should not double-count.
      { faceHash: 'alice', confidence: 0.7 },
    ],
  },
  {
    id: 'a3',
    faces: [
      { faceHash: 'carol', confidence: 0.4 }, // below threshold
    ],
  },
  { id: 'a4', faces: [] },
  { id: 'a5' },
];

describe('listPeople (D46)', () => {
  it('clusters faces and ranks by asset count then confidence', () => {
    const out = listPeople(ASSETS);
    expect(out).toHaveLength(2);
    expect(out[0].personId).toBe('alice');
    expect(out[0].assetCount).toBe(2);
    expect(out[0].averageConfidence).toBeCloseTo((0.9 + 0.95 + 0.7) / 3);
    expect(out[1].personId).toBe('bob');
    expect(out[1].assetCount).toBe(1);
  });

  it('excludes faces below minConfidence and clusters below minAssetCount', () => {
    const out = listPeople(ASSETS, { minConfidence: 0.5, minAssetCount: 2 });
    expect(out.map((p) => p.personId)).toEqual(['alice']);
  });

  it('attaches names from the names map', () => {
    const out = listPeople(ASSETS, { names: { alice: 'Alice', bob: '' } });
    const alice = out.find((p) => p.personId === 'alice');
    const bob = out.find((p) => p.personId === 'bob');
    expect(alice?.name).toBe('Alice');
    expect(bob?.name).toBeUndefined();
  });

  it('returns empty list when no assets have faces', () => {
    expect(listPeople([{ id: 'x' }, { id: 'y', faces: [] }])).toEqual([]);
  });
});

describe('namePerson (D46)', () => {
  it('sets, trims, and clears names without mutating the input', () => {
    const a = { alice: 'Alice' };
    const b = namePerson(a, 'bob', '  Bob  ');
    expect(a).toEqual({ alice: 'Alice' });
    expect(b).toEqual({ alice: 'Alice', bob: 'Bob' });
    const c = namePerson(b, 'alice', '');
    expect(c).toEqual({ bob: 'Bob' });
  });
});

describe('filterAssetsByPerson (D46)', () => {
  it('returns only assets containing the person above the confidence floor', () => {
    const out = filterAssetsByPerson(ASSETS, 'alice');
    expect(out.map((a) => a.id)).toEqual(['a1', 'a2']);
    expect(filterAssetsByPerson(ASSETS, 'carol').map((a) => a.id)).toEqual([]);
    expect(filterAssetsByPerson(ASSETS, 'carol', { minConfidence: 0.1 }).map((a) => a.id)).toEqual([
      'a3',
    ]);
  });
});
