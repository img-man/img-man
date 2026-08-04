// SPDX-License-Identifier: Apache-2.0
/**
 * People / face clustering helpers (D46).
 *
 * The Asset model already stores a `faces[]` array of `{ faceHash, confidence,
 * boundingBox, emotion? }`. The dashboard surfaces three operations on top of
 * that data:
 *
 *   1. **list** \u2014 cluster face hashes across an org's assets and produce a
 *      `Person` summary (cluster representative + asset count + best face).
 *   2. **name** \u2014 attach a human-readable name to a cluster (one entry per
 *      face hash; persistence happens elsewhere).
 *   3. **filter** \u2014 given a person (cluster id + name), return the subset of
 *      assets whose faces include that cluster.
 *
 * All helpers are pure functions over plain data so they can be unit-tested
 * without a database. The dashboard plugs them into the Mongo aggregation that
 * already streams face rows out of the `faces.faceHash` sparse index.
 */

export interface FaceRow {
  /** A short hash that's stable for the same person across photos. */
  faceHash: string;
  /** 0\u20131 confidence reported by the detector. */
  confidence: number;
  /** Optional emotion tag (`happy`, `neutral`, ...). */
  emotion?: string;
}

export interface AssetWithFaces {
  id: string;
  faces?: FaceRow[];
}

export interface PersonCluster {
  /** Stable id for the person; equal to the dominant face hash. */
  personId: string;
  /** User-provided display name when one is set, otherwise undefined. */
  name?: string;
  /** Number of distinct assets containing this person. */
  assetCount: number;
  /** Hash of the highest-confidence face seen, used to render an avatar. */
  representativeFaceHash: string;
  /** Average confidence across all matching face rows. */
  averageConfidence: number;
}

export interface PersonNameMap {
  /** `faceHash -> displayName`. Empty string clears the name. */
  [faceHash: string]: string;
}

export interface ListPeopleOptions {
  /** Drop faces with confidence below this. Default 0.5. */
  minConfidence?: number;
  /** Drop clusters with fewer than this many assets. Default 1. */
  minAssetCount?: number;
  /** Optional `faceHash -> name` map to attach to each cluster. */
  names?: PersonNameMap;
}

/**
 * Cluster face rows across `assets` into one `PersonCluster` per face hash.
 * Sorted by `assetCount` desc, then by `averageConfidence` desc, then by
 * `personId` asc for deterministic ordering.
 */
export function listPeople(
  assets: readonly AssetWithFaces[],
  options: ListPeopleOptions = {},
): PersonCluster[] {
  const minConfidence = options.minConfidence ?? 0.5;
  const minAssetCount = options.minAssetCount ?? 1;

  type Bucket = {
    personId: string;
    assets: Set<string>;
    confidenceSum: number;
    count: number;
    bestConfidence: number;
    representativeFaceHash: string;
  };
  const buckets = new Map<string, Bucket>();

  for (const asset of assets) {
    if (!asset?.faces?.length) continue;
    // De-dupe per asset so the same face appearing twice in one photo doesn't
    // double-inflate `assetCount`.
    const seenInAsset = new Set<string>();
    for (const face of asset.faces) {
      if (!face || typeof face.faceHash !== 'string') continue;
      if (face.confidence < minConfidence) continue;
      let bucket = buckets.get(face.faceHash);
      if (!bucket) {
        bucket = {
          personId: face.faceHash,
          assets: new Set(),
          confidenceSum: 0,
          count: 0,
          bestConfidence: -1,
          representativeFaceHash: face.faceHash,
        };
        buckets.set(face.faceHash, bucket);
      }
      bucket.confidenceSum += face.confidence;
      bucket.count += 1;
      if (face.confidence > bucket.bestConfidence) {
        bucket.bestConfidence = face.confidence;
        bucket.representativeFaceHash = face.faceHash;
      }
      if (!seenInAsset.has(face.faceHash)) {
        bucket.assets.add(asset.id);
        seenInAsset.add(face.faceHash);
      }
    }
  }

  const clusters: PersonCluster[] = [];
  for (const b of buckets.values()) {
    if (b.assets.size < minAssetCount) continue;
    const cluster: PersonCluster = {
      personId: b.personId,
      assetCount: b.assets.size,
      representativeFaceHash: b.representativeFaceHash,
      averageConfidence: b.count === 0 ? 0 : b.confidenceSum / b.count,
    };
    const name = options.names?.[b.personId];
    if (name && name.trim().length > 0) cluster.name = name.trim();
    clusters.push(cluster);
  }

  return clusters.sort((a, b) => {
    if (b.assetCount !== a.assetCount) return b.assetCount - a.assetCount;
    if (b.averageConfidence !== a.averageConfidence) {
      return b.averageConfidence - a.averageConfidence;
    }
    return a.personId.localeCompare(b.personId);
  });
}

/**
 * Apply a name change to a cluster map. Returns a *new* map; passing an empty
 * (or whitespace-only) `name` removes the entry.
 */
export function namePerson(
  names: PersonNameMap,
  personId: string,
  name: string,
): PersonNameMap {
  const next = { ...names };
  const trimmed = name.trim();
  if (trimmed.length === 0) delete next[personId];
  else next[personId] = trimmed;
  return next;
}

/**
 * Filter `assets` to those whose face rows include the given person (by
 * `faceHash` / `personId`) above the configured confidence floor.
 */
export function filterAssetsByPerson<T extends AssetWithFaces>(
  assets: readonly T[],
  personId: string,
  options: { minConfidence?: number } = {},
): T[] {
  const minConfidence = options.minConfidence ?? 0.5;
  return assets.filter((a) =>
    a.faces?.some((f) => f.faceHash === personId && f.confidence >= minConfidence),
  );
}
