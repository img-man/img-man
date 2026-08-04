// SPDX-License-Identifier: Apache-2.0
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { connectToDatabase } from '@/lib/db';
import { Asset, User } from '@/models';
import {
  generateTextEmbedding,
  generateImageEmbedding,
} from '@/lib/embeddings';
import { getSignedDownloadUrl, getGcsBucket } from '@/lib/storage';
import mongoose from 'mongoose';

/**
 * POST /api/assets/semantic-search
 *
 * Semantic search using Vertex AI multimodal embeddings + MongoDB Atlas Vector Search.
 *
 * Body:
 * - query: string          — natural language text query
 * - assetId?: string       — "find similar" mode: search by an asset's embedding
 * - folderId?: string      — optional folder filter
 * - mimeType?: string      — optional MIME type prefix filter
 * - limit?: number         — max results (default 20, max 50)
 * - minScore?: number      — minimum similarity score (0-1, default 0.5)
 *
 * Returns: { results: Array<{ asset, score }> }
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await connectToDatabase();
  const user = await User.findOne({ email: session.user.email }).lean();
  if (!user?.orgId) {
    return NextResponse.json({ error: 'No organization' }, { status: 400 });
  }

  const body = await req.json();
  const {
    query,
    assetId,
    folderId,
    mimeType,
    limit: rawLimit,
    minScore = 0.5,
    color,
  } = body;

  if (!query && !assetId) {
    return NextResponse.json(
      {
        error: 'Either "query" (text) or "assetId" (find similar) is required',
      },
      { status: 400 },
    );
  }

  const limit = Math.min(50, Math.max(1, rawLimit || 20));

  try {
    let queryVector: number[];

    if (assetId) {
      // "Find Similar" mode — use the asset's existing embedding
      const sourceAsset = await Asset.findOne({
        _id: assetId,
        orgId: user.orgId,
        isDeleted: { $ne: true },
      })
        .select('embedding')
        .lean();

      if (!sourceAsset?.embedding?.length) {
        // If no embedding exists, try to generate one on-the-fly
        const fullAsset = await Asset.findById(assetId)
          .select('storageKey mimeType')
          .lean();
        if (!fullAsset || !fullAsset.mimeType?.startsWith('image/')) {
          return NextResponse.json(
            { error: 'Source asset has no embedding and cannot generate one' },
            { status: 400 },
          );
        }
        const bucket = await getGcsBucket(String(user.orgId));
        const [buffer] = await bucket.file(fullAsset.storageKey).download();
        const result = await generateImageEmbedding(
          buffer.toString('base64'),
          fullAsset.mimeType,
          String(user.orgId),
        );
        queryVector = result.embedding;

        // Save it for future use (fire-and-forget)
        void Asset.updateOne(
          { _id: assetId },
          {
            $set: {
              embedding: result.embedding,
              embeddingModel: result.model,
              embeddedAt: result.generatedAt,
            },
          },
        );
      } else {
        queryVector = sourceAsset.embedding;
      }
    } else {
      // Text query mode — generate text embedding
      const result = await generateTextEmbedding(query, String(user.orgId));
      queryVector = result.embedding;
    }

    // Build MongoDB Atlas Vector Search pipeline
    const orgObjId = new mongoose.Types.ObjectId(
      (user.orgId as unknown as string).toString(),
    );

    // Pre-filter for vector search
    const vectorFilter: Record<string, unknown> = {
      orgId: { $eq: orgObjId },
      isDeleted: { $ne: true },
    };

    if (folderId && folderId !== '__root__') {
      vectorFilter.folderId = {
        $eq: new mongoose.Types.ObjectId(folderId),
      };
    }

    if (mimeType) {
      // Vector search filter doesn't support $regex, so we filter post-search
      // We'll handle this in the $match stage after $vectorSearch
    }

    // $vectorSearch aggregation stage (Atlas Vector Search)
    const pipeline: Record<string, unknown>[] = [
      {
        $vectorSearch: {
          index: 'vector_index',
          path: 'embedding',
          queryVector,
          numCandidates: limit * 10, // Over-fetch for better recall
          limit: limit * 2, // Over-fetch to account for post-filters
          filter: vectorFilter,
        },
      },
      {
        $addFields: {
          score: { $meta: 'vectorSearchScore' },
        },
      },
    ];

    // Post-filter: minimum score
    const matchStage: Record<string, unknown> = {
      score: { $gte: minScore },
    };

    // Exclude the source asset from "find similar" results
    if (assetId) {
      matchStage._id = { $ne: new mongoose.Types.ObjectId(assetId) };
    }

    // MIME type post-filter (vector search doesn't support $regex)
    if (mimeType) {
      if (mimeType === 'document' || mimeType === 'archive') {
        matchStage.fileCategory = mimeType;
      } else {
        matchStage.mimeType = { $regex: `^${mimeType}` };
      }
    }

    // Color filter: match any of the dominant colors
    if (color) {
      matchStage.dominantColors = color;
    }

    pipeline.push({ $match: matchStage });

    // Limit to requested count
    pipeline.push({ $limit: limit });

    // Project relevant fields
    pipeline.push({
      $project: {
        name: 1,
        originalName: 1,
        storageKey: 1,
        thumbnailStorageKey: 1,
        thumbnailBase64: 1,
        mimeType: 1,
        sizeBytes: 1,
        width: 1,
        height: 1,
        tags: 1,
        userTags: 1,
        fileCategory: 1,
        folderId: 1,
        createdAt: 1,
        updatedAt: 1,
        dominantColors: 1,
        starredBy: 1,
        score: 1,
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const results = await Asset.aggregate(pipeline as any);

    // Generate signed URLs for assets without inline thumbnails
    const needsUrls = results.filter(
      (a: Record<string, unknown>) =>
        !a.thumbnailBase64 &&
        (a.thumbnailStorageKey ||
          (typeof a.mimeType === 'string' && a.mimeType.startsWith('image/'))),
    );

    if (needsUrls.length > 0) {
      const urlPromises = needsUrls.map(async (a: Record<string, unknown>) => {
        const key = (a.thumbnailStorageKey || a.storageKey) as string;
        const url = await getSignedDownloadUrl(key, 3600, undefined, String(user.orgId));
        a.thumbnailUrl = url;
      });
      await Promise.all(urlPromises);
    }

    // Format response
    const formatted = results.map(
      (r: Record<string, unknown> & { score: number }) => ({
        asset: { ...r, score: undefined },
        score: r.score,
      }),
    );

    console.log(
      `[SemanticSearch] query="${query || `similar:${assetId}`}" → ${formatted.length} results`,
    );

    return NextResponse.json({
      results: formatted,
      total: formatted.length,
      mode: assetId ? 'visual_similarity' : 'semantic_text',
    });
  } catch (err) {
    console.error('[SemanticSearch] Error:', err);
    return NextResponse.json(
      {
        error: 'Semantic search failed',
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
