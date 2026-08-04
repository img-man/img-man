// SPDX-License-Identifier: Apache-2.0
/**
 * GET /api/analytics/access
 *
 * Central org-wide access analytics. Returns the precomputed
 * `OrgAnalytics` document for the caller's organization. Never recomputes.
 *
 * Query params:
 *   raw=1            include decoded raw view records (capped section)
 *   from=YYYY-MM-DD  filter raw section start date
 *   to=YYYY-MM-DD    filter raw section end date
 *   topAssetsHydrate=1   resolve top asset names + thumbnails
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { connectToDatabase } from '@/lib/db';
import { OrgAnalytics, User, Organization, Asset } from '@/models';
import { decodeRawRecord } from '@/lib/asset-analytics';
import { isSectionRestricted } from '@/lib/auth-context';
import type { Role } from '@/lib/permissions';

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

  if (await isSectionRestricted(String(user.orgId), (user.role as Role) ?? 'viewer', 'dashboard')) {
    return NextResponse.json({ error: 'Access to dashboard is restricted for your role' }, { status: 403 });
  }

  const org = await Organization.findById(user.orgId).select('analyticsConfig').lean();
  const enabled = (org as { analyticsConfig?: { enabled?: boolean } } | null)?.analyticsConfig?.enabled === true;
  if (!enabled) {
    return NextResponse.json({ enabled: false });
  }

  const doc = await OrgAnalytics.findOne({ orgId: user.orgId }).lean();
  if (!doc) {
    return NextResponse.json({
      enabled: true,
      totals: { views: 0, failures: 0, bytesServed: 0, lastAccessedAt: null, lastFailureAt: null },
      byCountry: {},
      byReferer: {},
      byStatus: {},
      byTransform: {},
      weekly: [],
      monthly: [],
      topAssets: [],
      raw: [],
    });
  }

  const url = new URL(req.url);
  const wantRaw = url.searchParams.get('raw') === '1';
  const hydrateTop = url.searchParams.get('topAssetsHydrate') === '1';
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

  let topAssets = doc.topAssets ?? [];
  if (hydrateTop && topAssets.length > 0) {
    const ids = topAssets.map((t) => t.assetId);
    const assets = await Asset.find({ _id: { $in: ids } })
      .select('_id name mimeType thumbnailBase64')
      .lean();
    const byId = new Map(assets.map((a) => [String(a._id), a]));
    topAssets = topAssets.map((t) => {
      const a = byId.get(String(t.assetId));
      return {
        ...t,
        name: a?.name ?? null,
        mimeType: a?.mimeType ?? null,
        thumbnailBase64: a?.thumbnailBase64 ?? null,
      } as typeof t & { name: string | null; mimeType: string | null; thumbnailBase64: string | null };
    });
  }

  return NextResponse.json({
    enabled: true,
    schemaVersion: doc.schemaVersion ?? 1,
    totals: doc.totals ?? {},
    byCountry: doc.byCountry ?? {},
    byReferer: doc.byReferer ?? {},
    byStatus: doc.byStatus ?? {},
    byTransform: doc.byTransform ?? {},
    weekly: doc.weekly ?? [],
    monthly: doc.monthly ?? [],
    topAssets,
    raw,
    rawCount: Array.isArray(doc.raw) ? doc.raw.length : 0,
    updatedAt: doc.updatedAt,
  });
}
