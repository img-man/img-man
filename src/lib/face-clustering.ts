// SPDX-License-Identifier: Apache-2.0
/**
 * Sprint 10 — 10.1: Face Clustering Engine
 *
 * Groups assets by face hashes to form "Person" clusters.
 * Uses exact faceHash match (from Gemini face detection) to group faces.
 *
 * Flow:
 *  1. Aggregate assets with faces[] → group by faceHash
 *  2. Each unique faceHash cluster = one "Person"
 *  3. Merge/split support for manual corrections
 *
 * This is a pure data utility — no UI.
 */

import type { Types } from 'mongoose';

/* ─── Types ────────────────────────────────────────────────── */

export interface FaceCluster {
  /** Primary faceHash for this cluster */
  faceHash: string;
  /** Number of photos containing this face */
  photoCount: number;
  /** Sample asset IDs (for thumbnail previews) */
  sampleAssetIds: string[];
  /** Sample thumbnail URLs or base64 */
  sampleThumbnails: string[];
  /** Representative bounding box from first detection */
  representativeBbox?: { x: number; y: number; w: number; h: number };
  /** Most common emotion across detections */
  dominantEmotion?: string;
}

export interface PersonCluster extends FaceCluster {
  /** User-assigned name (null if unnamed) */
  name: string | null;
  /** Merged faceHashes (for manual merge corrections) */
  mergedHashes: string[];
}

export interface FaceClusterResult {
  clusters: FaceCluster[];
  totalFaces: number;
  totalPhotosWithFaces: number;
}

/* ─── Clustering Pipeline Builder ──────────────────────────── */

/**
 * MongoDB aggregation pipeline to cluster faces by hash.
 *
 * @param orgId   Organization ObjectId
 * @param minPhotos Minimum photos for a cluster to appear (default 1)
 * @param limit   Max clusters returned (default 50)
 * @param skip    Pagination offset (default 0)
 */
export function buildFaceClusterPipeline(
  orgId: Types.ObjectId | string,
  minPhotos = 1,
  limit = 50,
  skip = 0,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Record<string, any>[] {
  return [
    // 1. Match org assets with faces
    {
      $match: {
        orgId: typeof orgId === 'string' ? orgId : orgId,
        isDeleted: { $ne: true },
        'faces.0': { $exists: true },
      },
    },
    // 2. Unwind faces array
    { $unwind: '$faces' },
    // 3. Group by faceHash
    {
      $group: {
        _id: '$faces.faceHash',
        photoCount: { $sum: 1 },
        assetIds: { $addToSet: '$_id' },
        thumbnails: {
          $push: {
            $ifNull: ['$thumbnailBase64', '$thumbnailStorageKey'],
          },
        },
        bboxes: { $push: '$faces.boundingBox' },
        emotions: { $push: '$faces.emotion' },
        confidences: { $push: '$faces.confidence' },
      },
    },
    // 4. Filter by minimum photo count
    { $match: { photoCount: { $gte: minPhotos } } },
    // 5. Sort by most photos first
    { $sort: { photoCount: -1 } },
    // 6. Pagination
    {
      $facet: {
        clusters: [
          { $skip: skip },
          { $limit: limit },
          {
            $project: {
              faceHash: '$_id',
              photoCount: 1,
              sampleAssetIds: { $slice: ['$assetIds', 6] },
              sampleThumbnails: { $slice: ['$thumbnails', 6] },
              representativeBbox: { $first: '$bboxes' },
              emotions: 1,
              avgConfidence: { $avg: '$confidences' },
            },
          },
        ],
        totalCount: [{ $count: 'count' }],
        stats: [
          {
            $group: {
              _id: null,
              totalFaces: { $sum: 1 },
              totalPhotos: { $sum: '$photoCount' },
            },
          },
        ],
      },
    },
  ];
}

/* ─── Emotion Analyzer ─────────────────────────────────────── */

/**
 * Find the most common emotion from a list of detections.
 */
export function dominantEmotion(
  emotions: (string | null | undefined)[],
): string | undefined {
  const counts = new Map<string, number>();
  for (const e of emotions) {
    if (!e) continue;
    counts.set(e, (counts.get(e) || 0) + 1);
  }
  if (counts.size === 0) return undefined;
  let best = '';
  let bestCount = 0;
  for (const [emotion, count] of counts) {
    if (count > bestCount) {
      best = emotion;
      bestCount = count;
    }
  }
  return best;
}

/* ─── Similarity Helpers ───────────────────────────────────── */

/**
 * Check if two face hashes should be merged.
 * Currently uses exact match — can be extended to fuzzy similarity.
 */
export function shouldMergeFaces(hash1: string, hash2: string): boolean {
  return hash1 === hash2;
}

/**
 * Merge multiple face clusters into one.
 * Returns a new cluster combining all assets.
 */
export function mergeClusters(
  primary: FaceCluster,
  ...others: FaceCluster[]
): FaceCluster {
  const allAssets = new Set(primary.sampleAssetIds);
  let totalPhotos = primary.photoCount;

  for (const other of others) {
    totalPhotos += other.photoCount;
    for (const id of other.sampleAssetIds) {
      allAssets.add(id);
    }
  }

  return {
    faceHash: primary.faceHash,
    photoCount: totalPhotos,
    sampleAssetIds: [...allAssets].slice(0, 6),
    sampleThumbnails: [
      ...primary.sampleThumbnails,
      ...others.flatMap((o) => o.sampleThumbnails),
    ].slice(0, 6),
    representativeBbox: primary.representativeBbox,
    dominantEmotion: primary.dominantEmotion,
  };
}
