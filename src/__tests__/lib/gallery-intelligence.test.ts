// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';

import {
  assetMatchesColor,
  cosineSimilarity,
  detectDuplicateGroups,
  hammingDistanceHex,
  isAssetStarredBy,
  parseHexColor,
  rankBySemanticSimilarity,
} from '@/lib/gallery-intelligence';

describe('gallery-intelligence (D42 favorites)', () => {
  it('matches starred user via string id', () => {
    expect(isAssetStarredBy(['u1', 'u2'], 'u2')).toBe(true);
    expect(isAssetStarredBy(['u1', 'u2'], 'u3')).toBe(false);
  });
  it('matches starred user via objects with toString', () => {
    const id = { toString: () => 'abc' };
    expect(isAssetStarredBy([id], 'abc')).toBe(true);
  });
});

describe('gallery-intelligence (D43 color filter)', () => {
  it('parses 3- and 6-digit hex codes', () => {
    expect(parseHexColor('#fff')).toEqual({ r: 255, g: 255, b: 255 });
    expect(parseHexColor('#000000')).toEqual({ r: 0, g: 0, b: 0 });
    expect(parseHexColor('#FF8800')).toEqual({ r: 255, g: 136, b: 0 });
  });
  it('rejects malformed hex', () => {
    expect(parseHexColor('blue')).toBeNull();
    expect(parseHexColor('#GGG')).toBeNull();
    expect(parseHexColor('')).toBeNull();
  });
  it('matches identical color with full tolerance', () => {
    expect(assetMatchesColor(['#3366ff'], '#3366ff', 0.99)).toBe(true);
  });
  it('matches similar blues but rejects red when filtering blue', () => {
    expect(assetMatchesColor(['#3366ff', '#ff0000'], '#0044cc', 0.85)).toBe(true);
    expect(assetMatchesColor(['#ff2222'], '#0044cc', 0.85)).toBe(false);
  });
  it('returns false when asset has no dominant colors', () => {
    expect(assetMatchesColor(undefined, '#ffffff')).toBe(false);
    expect(assetMatchesColor([], '#ffffff')).toBe(false);
  });
});

describe('gallery-intelligence (D44 duplicate detection)', () => {
  it('hamming distance is 0 for identical hashes and Infinity for length mismatch', () => {
    expect(hammingDistanceHex('ff00', 'ff00')).toBe(0);
    expect(hammingDistanceHex('ff', 'ff00')).toBe(Infinity);
  });
  it('counts bit differences across hex digits', () => {
    // 0x0 vs 0xf = 4 bits
    expect(hammingDistanceHex('0', 'f')).toBe(4);
    // 0xa (1010) vs 0x5 (0101) = 4 bits
    expect(hammingDistanceHex('a', '5')).toBe(4);
  });
  it('groups exact sha256 duplicates', () => {
    const groups = detectDuplicateGroups([
      { id: 'a', sha256: 'h1' },
      { id: 'b', sha256: 'h2' },
      { id: 'c', sha256: 'h1' },
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].confidence).toBe('exact');
    expect(groups[0].memberIds).toEqual(['a', 'c']);
    expect(groups[0].representativeId).toBe('a');
  });
  it('groups perceptually-near hashes within threshold', () => {
    const groups = detectDuplicateGroups(
      [
        { id: 'a', perceptualHash: '0000' },
        { id: 'b', perceptualHash: '0001' }, // distance 1
        { id: 'c', perceptualHash: 'ffff' }, // distance 16
      ],
      6,
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].confidence).toBe('near');
    expect(groups[0].memberIds.sort()).toEqual(['a', 'b']);
  });
  it('does not double-count assets that exact-matched into a perceptual group', () => {
    const groups = detectDuplicateGroups([
      { id: 'a', sha256: 'h1', perceptualHash: '0000' },
      { id: 'b', sha256: 'h1', perceptualHash: '0001' },
      { id: 'c', perceptualHash: '0001' },
    ]);
    // 'a' and 'b' form an exact group; 'c' is alone (would have matched 'b'
    // perceptually, but b is consumed) -> only the exact group survives.
    expect(groups).toHaveLength(1);
    expect(groups[0].confidence).toBe('exact');
  });
});

describe('gallery-intelligence (D45 semantic search)', () => {
  it('cosine similarity is 1 for identical vectors and 0 for orthogonal', () => {
    expect(cosineSimilarity([1, 0, 0], [1, 0, 0])).toBeCloseTo(1);
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });
  it('returns 0 for empty / mismatched inputs', () => {
    expect(cosineSimilarity([], [1])).toBe(0);
    expect(cosineSimilarity([1, 2], [1, 2, 3])).toBe(0);
    expect(cosineSimilarity([0, 0], [1, 1])).toBe(0);
  });
  it('ranks by similarity, drops below minScore, respects limit', () => {
    const assets = [
      { id: 'a', embedding: [1, 0, 0] },
      { id: 'b', embedding: [0.9, 0.1, 0] },
      { id: 'c', embedding: [0, 1, 0] },
      { id: 'd' }, // no embedding
    ];
    const ranked = rankBySemanticSimilarity(assets, [1, 0, 0], {
      limit: 2,
      minScore: 0.5,
    });
    expect(ranked.map((h) => h.asset.id)).toEqual(['a', 'b']);
    expect(ranked[0].score).toBeGreaterThan(ranked[1].score);
  });
});
