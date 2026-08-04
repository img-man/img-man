// SPDX-License-Identifier: Apache-2.0
'use server';

import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { connectToDatabase } from '@/lib/db';
import { User } from '@/models';

export async function redirectAfterSignin() {
  const session = await getSession();
  if (!session?.user?.email) {
    redirect('/signin');
  }

  await connectToDatabase();
  const user = await User.findOne({ email: session.user.email })
    .select('mustChangeCredentials')
    .lean();

  if (user?.mustChangeCredentials) {
    redirect('/secure-account');
  } else {
    redirect('/dashboard');
  }
}
