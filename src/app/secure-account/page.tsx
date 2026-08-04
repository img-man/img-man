// SPDX-License-Identifier: Apache-2.0
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { connectToDatabase } from '@/lib/db';
import { User } from '@/models';
import { SecureAccountForm } from './secure-account-form';

/**
 * Forced credential change for the first-boot admin.
 *
 * The dashboard layout redirects here while `mustChangeCredentials` is set, so
 * a fresh install can never be left sitting on the documented default login.
 */
export default async function SecureAccountPage() {
  const session = await getSession();
  if (!session?.user?.email) redirect('/signin');

  await connectToDatabase();
  const user = await User.findOne({ email: session.user.email })
    .select('email name mustChangeCredentials')
    .lean();

  if (!user) redirect('/signin');
  if (!user.mustChangeCredentials) redirect('/dashboard');

  return (
    <SecureAccountForm
      currentEmail={user.email}
      currentName={user.name ?? ''}
    />
  );
}
