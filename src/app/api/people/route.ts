// SPDX-License-Identifier: Apache-2.0
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { connectToDatabase } from '@/lib/db';
import { Asset, User, Person } from '@/models';
import {
  buildFaceClusterPipeline,
  dominantEmotion,
} from '@/lib/face-clustering';

/**
 * GET /api/people
 * Query: page?, limit?, minPhotos?
 *
 * Returns face clusters with optional person names.
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await connectToDatabase();
  const user = await User.findOne({ email: session.user.email }).lean();
  if (!user?.orgId) {
    return NextResponse.json({ error: 'No organization' }, { status: 400 });
  }

  const { searchParams } = req.nextUrl;
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const limit = Math.min(
    100,
    Math.max(1, Number(searchParams.get('limit')) || 30),
  );
  const minPhotos = Math.max(1, Number(searchParams.get('minPhotos')) || 1);
  const skip = (page - 1) * limit;

  try {
    const pipeline = buildFaceClusterPipeline(
      user.orgId,
      minPhotos,
      limit,
      skip,
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [result] = await Asset.aggregate(pipeline as any);
    const rawClusters = result?.clusters ?? [];
    const total = result?.totalCount?.[0]?.count ?? 0;
    const stats = result?.stats?.[0] ?? { totalFaces: 0, totalPhotos: 0 };

    // Fetch named persons for these face hashes
    const faceHashes = rawClusters.map((c: { faceHash: string }) => c.faceHash);
    const persons = await Person.find({
      orgId: user.orgId,
      $or: [
        { faceHash: { $in: faceHashes } },
        { mergedHashes: { $in: faceHashes } },
      ],
    }).lean();

    const personMap = new Map<
      string,
      { name: string; isPinned: boolean; id: string }
    >();
    for (const p of persons) {
      personMap.set(p.faceHash, {
        name: p.name,
        isPinned: p.isPinned,
        id: (p._id as string).toString(),
      });
      for (const h of p.mergedHashes) {
        personMap.set(h, {
          name: p.name,
          isPinned: p.isPinned,
          id: (p._id as string).toString(),
        });
      }
    }

    // Enrich clusters with names
    const clusters = rawClusters.map(
      (c: {
        faceHash: string;
        photoCount: number;
        sampleAssetIds: string[];
        sampleThumbnails: string[];
        representativeBbox?: { x: number; y: number; w: number; h: number };
        emotions?: (string | null)[];
        avgConfidence?: number;
      }) => {
        const person = personMap.get(c.faceHash);
        return {
          faceHash: c.faceHash,
          photoCount: c.photoCount,
          sampleAssetIds: c.sampleAssetIds,
          sampleThumbnails: c.sampleThumbnails,
          representativeBbox: c.representativeBbox,
          dominantEmotion: dominantEmotion(c.emotions ?? []),
          avgConfidence: c.avgConfidence,
          // Person info
          personId: person?.id ?? null,
          name: person?.name ?? null,
          isPinned: person?.isPinned ?? false,
        };
      },
    );

    // Sort: pinned first, then named, then by photo count
    clusters.sort(
      (
        a: { isPinned: boolean; name: string | null; photoCount: number },
        b: { isPinned: boolean; name: string | null; photoCount: number },
      ) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        if (!!a.name !== !!b.name) return a.name ? -1 : 1;
        return b.photoCount - a.photoCount;
      },
    );

    return NextResponse.json({
      clusters,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      stats: {
        totalFaces: stats.totalFaces,
        totalPhotosWithFaces: stats.totalPhotos,
        namedPeople: persons.length,
      },
    });
  } catch (err) {
    console.error('[People] Clustering error:', err);
    return NextResponse.json(
      {
        error: 'Failed to cluster faces',
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}

/**
 * POST /api/people
 * Body: { faceHash: string, name: string }
 *
 * Name a face cluster (create or update a Person).
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
  const { faceHash, name } = body;

  if (!faceHash || !name?.trim()) {
    return NextResponse.json(
      { error: 'faceHash and name are required' },
      { status: 400 },
    );
  }

  try {
    const person = await Person.findOneAndUpdate(
      { orgId: user.orgId, faceHash },
      {
        $set: { name: name.trim() },
        $setOnInsert: {
          orgId: user.orgId,
          faceHash,
          mergedHashes: [],
          createdBy: user._id,
          isPinned: false,
        },
      },
      { upsert: true, new: true, lean: true },
    );

    console.log(`[People] Named face "${faceHash}" as "${name.trim()}"`);

    return NextResponse.json({ person });
  } catch (err) {
    console.error('[People] Name error:', err);
    return NextResponse.json(
      {
        error: 'Failed to name person',
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
