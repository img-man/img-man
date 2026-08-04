// SPDX-License-Identifier: Apache-2.0
import { getSession } from '@/lib/session';
import { connectToDatabase } from '@/lib/db';
import { User } from '@/models';
import { redirect } from 'next/navigation';
import { DashboardShell } from '@/components/dashboard/shell';
import { RoleProvider } from '@/components/dashboard/role-context';
import { TOUR_VERSION } from '@/components/onboarding/tour-constants';
import { DashboardTourMount } from '@/components/onboarding/dashboard-tour-mount';

export default async function DashboardLayout({
 children,
}: {
 children: React.ReactNode;
}) {
 const session = await getSession();
 if (!session?.user?.email) redirect('/signin');

 await connectToDatabase();
 const user = await User.findOne({ email: session.user.email }).lean();

 // First boot: nothing loads until the published default login is replaced.
 if (user?.mustChangeCredentials) redirect('/secure-account');

 if (!user?.orgId) redirect('/onboarding');

 const tour = (user as { tour?: { completedAt?: Date; dismissedAt?: Date; version?: number } })
 .tour;
 const shouldAutoStart =
 !tour?.completedAt &&
 !tour?.dismissedAt &&
 (tour?.version ?? 0) < TOUR_VERSION;

 return (
 <RoleProvider>
 <DashboardShell
 user={{
 name: session.user.name ?? '',
 email: session.user.email,
 image: session.user.image ?? '',
 }}
 orgId={String(user.orgId)}
 >
 {children}
 </DashboardShell>
 <DashboardTourMount shouldAutoStart={shouldAutoStart} />
 </RoleProvider>
 );
}
