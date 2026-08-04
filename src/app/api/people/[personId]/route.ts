// SPDX-License-Identifier: Apache-2.0
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { connectToDatabase } from '@/lib/db';
import { User, Person } from '@/models';

type RouteContext = { params: Promise<{ personId: string }> };

/**
 * PATCH /api/people/[personId]
 * Body: { name?, isPinned?, mergedHashes? }
 *
 * Update a named person.
 */
export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await connectToDatabase();
  const user = await User.findOne({ email: session.user.email }).lean();
  if (!user?.orgId) {
    return NextResponse.json({ error: 'No organization' }, { status: 400 });
  }

  const { personId } = await ctx.params;
  const body = await req.json();
  const update: Record<string, unknown> = {};

  if (body.name !== undefined) update.name = body.name.trim();
  if (body.isPinned !== undefined) update.isPinned = Boolean(body.isPinned);
  if (body.mergedHashes !== undefined) update.mergedHashes = body.mergedHashes;
  if (body.avatarThumbnail !== undefined)
    update.avatarThumbnail = body.avatarThumbnail;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  try {
    const person = await Person.findOneAndUpdate(
      { _id: personId, orgId: user.orgId },
      { $set: update },
      { new: true, lean: true },
    );

    if (!person) {
      return NextResponse.json({ error: 'Person not found' }, { status: 404 });
    }

    return NextResponse.json({ person });
  } catch (err) {
    console.error('[People] Update error:', err);
    return NextResponse.json(
      {
        error: 'Failed to update person',
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/people/[personId]
 *
 * Remove a named person (does not delete the face data, just the name assignment).
 */
export async function DELETE(req: NextRequest, ctx: RouteContext) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await connectToDatabase();
  const user = await User.findOne({ email: session.user.email }).lean();
  if (!user?.orgId) {
    return NextResponse.json({ error: 'No organization' }, { status: 400 });
  }

  const { personId } = await ctx.params;

  try {
    const result = await Person.deleteOne({ _id: personId, orgId: user.orgId });
    if (result.deletedCount === 0) {
      return NextResponse.json({ error: 'Person not found' }, { status: 404 });
    }

    return NextResponse.json({ deleted: true });
  } catch (err) {
    console.error('[People] Delete error:', err);
    return NextResponse.json(
      {
        error: 'Failed to delete person',
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
