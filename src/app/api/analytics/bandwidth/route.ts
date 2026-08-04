// SPDX-License-Identifier: Apache-2.0
import { NextRequest, NextResponse } from 'next/server';
import { requireAuthContext } from '@/lib/auth-context';
import { getBandwidthStats } from '@/lib/bandwidth';

/**
 * GET /api/analytics/bandwidth?days=30
 * Returns daily bandwidth breakdown for the authenticated user's org.
 */
export async function GET(req: NextRequest) {
 try {
 const ctx = await requireAuthContext();

 const days = Math.min(
 Math.max(Number(req.nextUrl.searchParams.get('days')) || 30, 1),
 365,
 );

 const stats = await getBandwidthStats(ctx.orgId, days);

 return NextResponse.json(stats);
 } catch (err: unknown) {
 const e = err as { status?: number; error?: string; message?: string };
 return NextResponse.json(
 { error: e.error ?? e.message ?? 'Server error' },
 { status: e.status ?? 500 },
 );
 }
}
