// SPDX-License-Identifier: Apache-2.0
'use server';

import { getSession } from '@/lib/session';
import { connectToDatabase } from '@/lib/db';
import { Organization, User } from '@/models';
import { redirect } from 'next/navigation';

export async function createOrganization(formData: FormData) {
 const session = await getSession();
 if (!session?.user?.email) throw new Error('Unauthorized');

 await connectToDatabase();

 const name = (formData.get('name') as string)?.trim();
 if (!name) throw new Error('Organization name is required');

 const slug = name
 .toLowerCase()
 .replace(/[^a-z0-9]+/g, '-')
 .replace(/(^-|-$)/g, '');

 const existing = await Organization.findOne({ slug });
 if (existing) throw new Error('Organization name already taken');

 // Find or create user document in Mongoose
 let user = await User.findOne({ email: session.user.email });
 if (!user) {
 user = await User.create({
 name: session.user.name ?? 'User',
 email: session.user.email,
 image: session.user.image ?? undefined,
 role: 'owner',
 });
 }

 const org = await Organization.create({
 name,
 slug,
 ownerId: user._id,
 storageConfig: { provider: 'gcp', bucket: '' },
 });

 // Link user → org
 user.orgId = org._id;
 await user.save();

 redirect('/dashboard');
}
