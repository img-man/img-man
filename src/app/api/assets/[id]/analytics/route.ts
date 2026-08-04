// SPDX-License-Identifier: Apache-2.0
/**
 * GET /api/assets/:id/analytics
 *
 * Returns the precomputed AssetAnalytics document for an asset. Never
 * recomputes — the recorder writes summaries inline so reads are cheap.
 *
 * Query params:
 *   raw=1            include decoded raw records (defaults to summary only)
 *   from=YYYY-MM-DD  filter raw section start date
 *   to=YYYY-MM-DD    filter raw section end date
 */
import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { getSession } from '@/lib/session';
import { connectToDatabase } from '@/lib/db';
import { AssetAnalytics, Asset, User, Organization } from '@/models';
import { decodeRawRecord } from '@/lib/asset-analytics';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, ctx: RouteContext) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await ctx.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: 'Invalid asset id' }, { status: 400 });
  }

  await connectToDatabase();
  const user = await User.findOne({ email: session.user.email }).lean();
  if (!user?.orgId) {
    return NextResponse.json({ error: 'No organization' }, { status: 400 });
  }

  const asset = await Asset.findOne({ _id: id, orgId: user.orgId })
    .select('_id')
    .lean();
  if (!asset) {
    return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
  }

  const org = await Organization.findById(user.orgId).select('analyticsConfig').lean();
  const enabled = (org as { analyticsConfig?: { enabled?: boolean } } | null)?.analyticsConfig?.enabled === true;
  if (!enabled) {
    return NextResponse.json({ enabled: false });
  }

  const doc = await AssetAnalytics.findOne({ assetId: id }).lean();
  if (!doc) {
    return NextResponse.json({
      enabled: true,
      assetId: id,
      totals: { views: 0, failures: 0, bytesServed: 0, lastAccessedAt: null, lastFailureAt: null },
      byCountry: {},
      byReferer: {},
      byStatus: {},
      byTransform: {},
      weekly: [],
      monthly: [],
      raw: [],
    });
  }

  const url = new URL(req.url);
  const wantRaw = url.searchParams.get('raw') === '1';
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const fromDate = from ? new Date(from) : null;
  const toDate = to ? new Date(to) : null;

  let raw: ReturnType<typeof decodeRawRecord>[] = [];
  if (wantRaw && Array.isArray(doc.raw)) {
    raw = doc.raw
      .filter((r) => {
        if (fromDate && r.createdAt < fromDate) return false;
        if (toDate && r.createdAt > toDate) return false;
        return true;
      })
      .map(decodeRawRecord);
  }

  return NextResponse.json({
    enabled: true,
    assetId: id,
    schemaVersion: doc.schemaVersion ?? 1,
    totals: doc.totals ?? {},
    byCountry: doc.byCountry ?? {},
    byReferer: doc.byReferer ?? {},
    byStatus: doc.byStatus ?? {},
    byTransform: doc.byTransform ?? {},
    weekly: doc.weekly ?? [],
    monthly: doc.monthly ?? [],
    raw,
    rawCount: Array.isArray(doc.raw) ? doc.raw.length : 0,
    updatedAt: doc.updatedAt,
  });
}
