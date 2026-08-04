// SPDX-License-Identifier: Apache-2.0
import { NextResponse } from 'next/server';
import { BOOTSTRAP_EMAIL, BOOTSTRAP_USES_PUBLISHED_DEFAULTS } from '@/auth';
import { connectToDatabase } from '@/lib/db';
import { User } from '@/models';

export const dynamic = 'force-dynamic';

/**
 * GET /api/auth/bootstrap-status
 *
 * Reports whether this deployment still has no accounts, so the sign-in page
 * can offer the documented first-run credentials. It stops doing so the moment
 * a real account exists — otherwise the form keeps handing back the published
 * default long after the operator has renamed it, which is how someone signs
 * in as the wrong account without noticing.
 *
 * Discloses nothing an unbootstrapped instance would not already accept from
 * the documented default login.
 */
export async function GET() {
  try {
    await connectToDatabase();
    const userCount = await User.estimatedDocumentCount();

    const pending = userCount === 0 && BOOTSTRAP_USES_PUBLISHED_DEFAULTS;

    return NextResponse.json({
      pending,
      email: pending ? BOOTSTRAP_EMAIL : null,
    });
  } catch {
    // Never block the sign-in form on this.
    return NextResponse.json({ pending: false, email: null });
  }
}
