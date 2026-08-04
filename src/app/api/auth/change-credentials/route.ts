// SPDX-License-Identifier: Apache-2.0
import { NextRequest, NextResponse } from 'next/server';
import { compare, hash } from 'bcryptjs';
import { getSession } from '@/lib/session';
import { connectToDatabase } from '@/lib/db';
import { OrgMembership, User } from '@/models';

/** Minimum acceptable password. Deliberately dull rules, enforced server-side. */
function validatePassword(password: string): string | null {
  if (password.length < 12) return 'Password must be at least 12 characters';
  if (!/[a-z]/.test(password)) return 'Password must contain a lowercase letter';
  if (!/[A-Z]/.test(password)) return 'Password must contain an uppercase letter';
  if (!/[0-9]/.test(password)) return 'Password must contain a number';
  return null;
}

/**
 * POST /api/auth/change-credentials
 *
 * Replaces the signed-in user's email and/or password and clears the
 * `mustChangeCredentials` flag. This is the only way off the first-boot
 * bootstrap login — the dashboard will not render until it succeeds.
 *
 * Body: { currentPassword, newEmail?, newPassword, name? }
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const {
    currentPassword,
    newEmail,
    newPassword,
    name,
  } = body as {
    currentPassword?: string;
    newEmail?: string;
    newPassword?: string;
    name?: string;
  };

  if (!currentPassword || !newPassword) {
    return NextResponse.json(
      { error: 'currentPassword and newPassword are required' },
      { status: 400 },
    );
  }

  const passwordError = validatePassword(newPassword);
  if (passwordError) {
    return NextResponse.json({ error: passwordError }, { status: 400 });
  }

  if (currentPassword === newPassword) {
    return NextResponse.json(
      { error: 'New password must differ from the current one' },
      { status: 400 },
    );
  }

  await connectToDatabase();

  const currentEmail = session.user.email.toLowerCase().trim();
  const user = await User.findOne({ email: currentEmail }).select('+passwordHash');

  if (!user?.passwordHash) {
    return NextResponse.json(
      { error: 'This account has no password set — sign in with your OAuth provider instead' },
      { status: 400 },
    );
  }

  const isValid = await compare(currentPassword, user.passwordHash);
  if (!isValid) {
    return NextResponse.json({ error: 'Current password is incorrect' }, { status: 403 });
  }

  const nextEmail = newEmail?.toLowerCase().trim();
  const emailChanged = Boolean(nextEmail) && nextEmail !== currentEmail;

  if (nextEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) {
    return NextResponse.json({ error: 'New email is not a valid address' }, { status: 400 });
  }

  if (emailChanged) {
    const taken = await User.findOne({ email: nextEmail }).select('_id').lean();
    if (taken) {
      return NextResponse.json(
        { error: 'That email is already in use' },
        { status: 409 },
      );
    }
  }

  user.passwordHash = await hash(newPassword, 12);
  user.mustChangeCredentials = false;
  if (emailChanged && nextEmail) user.email = nextEmail;
  if (name?.trim()) user.name = name.trim();
  await user.save();

  // Keep membership rows addressable by email — they are looked up by address
  // in the token-minting path, so a stale value would orphan the owner.
  if (emailChanged && nextEmail) {
    await OrgMembership.updateMany(
      { email: currentEmail },
      { $set: { email: nextEmail } },
    );
  }

  return NextResponse.json({
    success: true,
    emailChanged,
    // The NextAuth session is keyed on the old address; the client must sign
    // in again when the email moved.
    requiresReauth: emailChanged,
  });
}
