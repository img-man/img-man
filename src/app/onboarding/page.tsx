// SPDX-License-Identifier: Apache-2.0
'use client';

import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import { createOrganization } from './actions';

export default function OnboardingPage() {
 const { data: session, status } = useSession();

 if (status === 'loading') {
 return (
 <div className="flex min-h-screen items-center justify-center bg-dash-muted">
 <p className="text-sm text-dash-text2">Loading…</p>
 </div>
 );
 }

 if (!session) {
 redirect('/signin');
 }

 return (
 <div className="flex min-h-screen items-center justify-center bg-dash-muted text-dash-text">
 <form
 action={createOrganization}
 className="mx-auto flex w-full max-w-md flex-col gap-6 rounded-2xl border border-dash-border bg-dash-surface p-8 shadow-sm"
 >
 <div>
 <h1 className="text-2xl font-semibold">Create your workspace</h1>
 <p className="mt-1 text-sm text-dash-text2">
 This will be your team&apos;s home for all assets and designs.
 </p>
 </div>

 <label className="flex flex-col gap-1.5">
 <span className="text-sm font-medium">Workspace name</span>
 <input
 name="name"
 type="text"
 required
 placeholder="e.g. Acme Studios"
 className="rounded-lg border border-dash-border px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-1 focus:ring-primary"
 />
 </label>

 <button
 type="submit"
 className="rounded-full bg-dash-inverted px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-dash-inverted-hover"
 >
 Create workspace
 </button>
 </form>
 </div>
 );
}
