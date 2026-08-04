// SPDX-License-Identifier: Apache-2.0
/**
 * Gallery intelligence helpers for `v0.15.0`.
 *
 * D42 \u2014 favorites virtual folder filter.
 * D43 \u2014 dominant-color filtering with HSL tolerance matching.
 * D44 \u2014 duplicate detection (SHA-256 exact + Hamming-distance perceptual hash).
 * D45 \u2014 cosine-similarity ranking for embedding-based semantic search.
 *
 * Pure functions only. The MongoDB / route layer composes these against
 * `Asset` documents \u2014 see `src/models/asset.ts` for the persisted shape
 * (`starredBy`, `dominantColors`, `perceptualHash`, `embedding`).
 */

import type { Types } from 'mongoose';

// ─── D42 favorites ──────────────────────────────────────────────────────────

/**
 * Returns true if `userId` has starred the asset. Accepts ObjectId or string
 * ids in either column to keep call sites tolerant of route-handler shapes.
 */
export function isAssetStarredBy(
  starredBy: ReadonlyArray<Types.ObjectId | string>,
  userId: Types.ObjectId | string,
): boolean {
  const target = userId.toString();
  for (const entry of starredBy) {
    if (entry?.toString() === target) return true;
  }
  return false;
}

// ─── D43 color filter ───────────────────────────────────────────────────────

export interface RGB {
  r: number;
  g: number;
  b: number;
}
export interface HSL {
  h: number;
  s: number;
  l: number;
}

/** Parse `#rgb` or `#rrggbb` (case-insensitive). Returns null on bad input. */
export function parseHexColor(input: string): RGB | null {
  if (typeof input !== 'string') return null;
  const hex = input.trim().replace(/^#/, '');
  if (hex.length === 3) {
    const r = parseInt(hex[0] + hex[0], 16);
    const g = parseInt(hex[1] + hex[1], 16);
    const b = parseInt(hex[2] + hex[2], 16);
    if ([r, g, b].some(Number.isNaN)) return null;
    return { r, g, b };
  }
  if (hex.length === 6) {
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    if ([r, g, b].some(Number.isNaN)) return null;
    return { r, g, b };
  }
  return null;
}

export function rgbToHsl({ r, g, b }: RGB): HSL {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  switch (max) {
    case rn:
      h = ((gn - bn) / d + (gn < bn ? 6 : 0)) * 60;
      break;
    case gn:
      h = ((bn - rn) / d + 2) * 60;
      break;
    default:
      h = ((rn - gn) / d + 4) * 60;
  }
  return { h, s, l };
}

/**
 * Returns a similarity score in [0, 1] between two colors using HSL distance.
 * Hue weight dominates; saturation/lightness weighted lower so a "blue"
 * filter matches navy and royal blue.
 */
export function colorSimilarity(a: RGB, b: RGB): number {
  const ha = rgbToHsl(a);
  const hb = rgbToHsl(b);
  const dh = Math.min(Math.abs(ha.h - hb.h), 360 - Math.abs(ha.h - hb.h)) / 180;
  const ds = Math.abs(ha.s - hb.s);
  const dl = Math.abs(ha.l - hb.l);
  const distance = Math.sqrt(dh * dh * 0.7 + ds * ds * 0.15 + dl * dl * 0.15);
  return Math.max(0, 1 - distance);
}

/**
 * Returns true if any of `dominantColors` is within `tolerance` of `target`.
 * `tolerance` is in [0, 1]; 0.85 is a reasonable default for "looks similar".
 */
export function assetMatchesColor(
  dominantColors: ReadonlyArray<string> | undefined,
  target: string,
  tolerance = 0.85,
): boolean {
  const targetRgb = parseHexColor(target);
  if (!targetRgb || !dominantColors?.length) return false;
  for (const c of dominantColors) {
    const rgb = parseHexColor(c);
    if (!rgb) continue;
    if (colorSimilarity(rgb, targetRgb) >= tolerance) return true;
  }
  return false;
}

// ─── D44 duplicate detection ────────────────────────────────────────────────

/**
 * Hamming distance between two equal-length hex strings (perceptual hashes).
 * Returns Infinity if lengths mismatch so callers can treat that as "no match".
 */
export function hammingDistanceHex(a: string, b: string): number {
  if (typeof a !== 'string' || typeof b !== 'string') return Infinity;
  if (a.length !== b.length) return Infinity;
  let distance = 0;
  for (let i = 0; i < a.length; i++) {
    const xor = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    if (Number.isNaN(xor)) return Infinity;
    // Brian Kernighan's bit count
    let v = xor;
    while (v) {
      distance += v & 1;
      v >>>= 1;
    }
  }
  return distance;
}

export interface DuplicateCandidate {
  /** Caller-supplied id (asset _id, storage key, etc.). */
  id: string;
  perceptualHash?: string | null;
  sha256?: string | null;
}

export interface DuplicateGroup {
  /** Stable representative id (the lowest id in the group). */
  representativeId: string;
  memberIds: string[];
  /** Confidence: 'exact' for sha256 matches, 'near' for perceptual matches. */
  confidence: 'exact' | 'near';
  /** Max Hamming distance observed inside the group (0 for exact). */
  maxDistance: number;
}

/**
 * Cluster candidates into duplicate groups.
 *
 * - Exact match: identical `sha256` => one `'exact'` group per hash.
 * - Near match: among the remaining candidates, group together any pair
 *   whose perceptual-hash Hamming distance is ≤ `nearThreshold` (default 6,
 *   the standard pHash tolerance for "visually similar").
 *
 * Returns only groups with ≥ 2 members.
 */
export function detectDuplicateGroups(
  candidates: ReadonlyArray<DuplicateCandidate>,
  nearThreshold = 6,
): DuplicateGroup[] {
  const groups: DuplicateGroup[] = [];
  const consumed = new Set<string>();

  // Pass 1: exact sha256 buckets.
  const sha = new Map<string, DuplicateCandidate[]>();
  for (const c of candidates) {
    if (!c.sha256) continue;
    const arr = sha.get(c.sha256) ?? [];
    arr.push(c);
    sha.set(c.sha256, arr);
  }
  for (const [, members] of sha) {
    if (members.length < 2) continue;
    const ids = members.map((m) => m.id).sort();
    groups.push({
      representativeId: ids[0],
      memberIds: ids,
      confidence: 'exact',
      maxDistance: 0,
    });
    for (const id of ids) consumed.add(id);
  }

  // Pass 2: perceptual-hash neighborhoods (greedy union over remaining).
  const remaining = candidates.filter(
    (c) => !consumed.has(c.id) && typeof c.perceptualHash === 'string' && c.perceptualHash,
  );
  for (let i = 0; i < remaining.length; i++) {
    const seed = remaining[i];
    if (consumed.has(seed.id)) continue;
    const cluster: DuplicateCandidate[] = [seed];
    let maxDistance = 0;
    for (let j = i + 1; j < remaining.length; j++) {
      const other = remaining[j];
      if (consumed.has(other.id)) continue;
      const d = hammingDistanceHex(seed.perceptualHash!, other.perceptualHash!);
      if (d <= nearThreshold) {
        cluster.push(other);
        maxDistance = Math.max(maxDistance, d);
      }
    }
    if (cluster.length >= 2) {
      const ids = cluster.map((m) => m.id).sort();
      groups.push({
        representativeId: ids[0],
        memberIds: ids,
        confidence: 'near',
        maxDistance,
      });
      for (const id of ids) consumed.add(id);
    }
  }

  return groups;
}

// ─── D45 semantic search ────────────────────────────────────────────────────

/**
 * Cosine similarity between two equal-length numeric vectors. Returns 0 when
 * either vector is empty, lengths differ, or a magnitude is 0.
 */
export function cosineSimilarity(
  a: ReadonlyArray<number>,
  b: ReadonlyArray<number>,
): number {
  if (!a?.length || !b?.length || a.length !== b.length) return 0;
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

export interface SemanticHit<T> {
  asset: T;
  score: number;
}

/**
 * Rank `assets` by cosine similarity of their embedding to `queryEmbedding`.
 * Filters out anything with no embedding or score below `minScore`. Returns
 * at most `limit` results sorted by score descending.
 */
export function rankBySemanticSimilarity<
  T extends { embedding?: number[] | null | undefined },
>(
  assets: ReadonlyArray<T>,
  queryEmbedding: ReadonlyArray<number>,
  options: { limit?: number; minScore?: number } = {},
): SemanticHit<T>[] {
  const limit = options.limit ?? 50;
  const minScore = options.minScore ?? 0.2;
  const hits: SemanticHit<T>[] = [];
  for (const asset of assets) {
    if (!asset.embedding?.length) continue;
    const score = cosineSimilarity(asset.embedding, queryEmbedding);
    if (score >= minScore) hits.push({ asset, score });
  }
  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, limit);
}
