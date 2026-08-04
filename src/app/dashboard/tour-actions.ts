// SPDX-License-Identifier: Apache-2.0
'use server';

import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/session';
import { connectToDatabase } from '@/lib/db';
import { User } from '@/models';
import { TOUR_VERSION } from '@/components/onboarding/tour-constants';

type MarkTourInput = {
  status: 'started' | 'step' | 'completed' | 'skipped';
  lastStepShown?: number;
};

/**
 * Persist onboarding-tour progress for the current user.
 * Safe to call repeatedly; only writes the fields that need updating.
 */
export async function markTourState(input: MarkTourInput): Promise<{ ok: true }> {
  const session = await getSession();
  if (!session?.user?.email) throw new Error('Unauthorized');

  await connectToDatabase();

  const update: Record<string, unknown> = {
    'tour.version': TOUR_VERSION,
  };

  if (typeof input.lastStepShown === 'number') {
    update['tour.lastStepShown'] = input.lastStepShown;
  }
  if (input.status === 'completed') {
    update['tour.completedAt'] = new Date();
  }
  if (input.status === 'skipped') {
    update['tour.dismissedAt'] = new Date();
  }

  await User.updateOne({ email: session.user.email }, { $set: update });

  revalidatePath('/dashboard');

  return { ok: true };
}

/**
 * Reset the tour so the current user sees it again on next dashboard load.
 * Used by the "Replay tour" action.
 */
export async function resetTourState(): Promise<{ ok: true }> {
  const session = await getSession();
  if (!session?.user?.email) throw new Error('Unauthorized');

  await connectToDatabase();
  await User.updateOne(
    { email: session.user.email },
    {
      $unset: {
        'tour.completedAt': '',
        'tour.dismissedAt': '',
        'tour.lastStepShown': '',
      },
      $set: { 'tour.version': TOUR_VERSION },
    },
  );

  revalidatePath('/dashboard');
  return { ok: true };
}
