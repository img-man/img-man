// SPDX-License-Identifier: Apache-2.0
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { connectToDatabase } from '@/lib/db';
import { Design, User } from '@/models';

interface RouteContext {
  params: Promise<{ id: string }>;
}

const MAX_SNAPSHOTS = 20;

/**
 * GET /api/designs/:id/snapshots
 * Returns the snapshot list (name + createdAt, without bulky jsonState).
 */
export async function GET(_req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params;

  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await connectToDatabase();
  const user = await User.findOne({ email: session.user.email }).lean();
  if (!user?.orgId) {
    return NextResponse.json({ error: 'No organization' }, { status: 400 });
  }

  const design = await Design.findOne(
    { _id: id, orgId: user.orgId },
    { 'snapshots.name': 1, 'snapshots.createdAt': 1, 'snapshots._id': 1 },
  ).lean();

  if (!design) {
    return NextResponse.json({ error: 'Design not found' }, { status: 404 });
  }

  return NextResponse.json({
    snapshots: (design.snapshots ?? []).map(
      (s: { _id?: unknown; name: string; createdAt: Date }) => ({
        _id: String(s._id),
        name: s.name,
        createdAt: s.createdAt,
      }),
    ),
  });
}

/**
 * POST /api/designs/:id/snapshots
 * Body: { name: string }
 * Creates a snapshot of the current jsonState.
 * Prunes oldest snapshots beyond MAX_SNAPSHOTS.
 */
export async function POST(req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params;

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
  const name =
    typeof body.name === 'string' && body.name.trim()
      ? body.name.trim()
      : `Snapshot ${new Date().toLocaleString()}`;

  // Fetch current design to get jsonState
  const design = await Design.findOne({ _id: id, orgId: user.orgId });
  if (!design) {
    return NextResponse.json({ error: 'Design not found' }, { status: 404 });
  }

  // Push new snapshot
  design.snapshots = design.snapshots ?? [];
  design.snapshots.push({
    name,
    jsonState: design.jsonState,
    createdAt: new Date(),
  });

  // Prune oldest if exceeding max
  if (design.snapshots.length > MAX_SNAPSHOTS) {
    design.snapshots = design.snapshots.slice(-MAX_SNAPSHOTS);
  }

  await design.save();

  const newest = design.snapshots[design.snapshots.length - 1];
  return NextResponse.json({
    snapshot: {
      _id: String((newest as unknown as { _id: unknown })._id),
      name: newest.name,
      createdAt: newest.createdAt,
    },
  });
}

/**
 * PATCH /api/designs/:id/snapshots
 * Body: { snapshotId: string }
 * Restores a snapshot — replaces jsonState with the snapshot's jsonState.
 * Saves current state as an auto-snapshot first ("Before restore").
 */
export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params;

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
  const { snapshotId } = body;
  if (!snapshotId) {
    return NextResponse.json(
      { error: 'snapshotId required' },
      { status: 400 },
    );
  }

  const design = await Design.findOne({ _id: id, orgId: user.orgId });
  if (!design) {
    return NextResponse.json({ error: 'Design not found' }, { status: 404 });
  }

  const snap = (design.snapshots ?? []).find(
    (s: { _id?: unknown }) =>
      String(s._id) === snapshotId,
  );
  if (!snap) {
    return NextResponse.json(
      { error: 'Snapshot not found' },
      { status: 404 },
    );
  }

  // Save current state as "Before restore" snapshot
  design.snapshots.push({
    name: 'Before restore',
    jsonState: design.jsonState,
    createdAt: new Date(),
  });

  // Prune oldest
  if (design.snapshots.length > MAX_SNAPSHOTS) {
    design.snapshots = design.snapshots.slice(-MAX_SNAPSHOTS);
  }

  // Restore
  design.jsonState = snap.jsonState;
  await design.save();

  return NextResponse.json({ design: { jsonState: design.jsonState } });
}
