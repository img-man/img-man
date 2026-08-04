// SPDX-License-Identifier: Apache-2.0
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { Loader2, ShieldAlert } from 'lucide-react';

interface SecureAccountFormProps {
  currentEmail: string;
  currentName: string;
}

export function SecureAccountForm({ currentEmail, currentName }: SecureAccountFormProps) {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newEmail, setNewEmail] = useState(currentEmail);
  const [name, setName] = useState(currentName);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/auth/change-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newEmail, newPassword, name }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? `Request failed (${res.status})`);
        return;
      }

      if (data.requiresReauth) {
        // The session is keyed on the old address — force a clean sign-in.
        await signOut({ callbackUrl: '/signin' });
        return;
      }

      // Refresh so the dashboard layout re-reads the now-cleared flag.
      router.refresh();
      router.push('/dashboard');
    } catch {
      setError('Could not reach the server. Check that img-man is running.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-dash-muted text-dash-text">
      <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-6 px-6 py-16">
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/40">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div>
            <h1 className="text-sm font-semibold text-amber-800 dark:text-amber-300">
              Secure this deployment
            </h1>
            <p className="mt-1 text-xs text-amber-700 dark:text-amber-400/90">
              You are signed in with the default administrator account. Those
              credentials are published in the img-man documentation, so anyone
              who can reach this URL can use them. Replace them now — the
              dashboard stays locked until you do.
            </p>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="grid gap-4 rounded-2xl border border-dash-border bg-dash-surface p-6"
        >
          <div>
            <label htmlFor="currentPassword" className="mb-1 block text-xs font-medium text-dash-text2">
              Current password
            </label>
            <input
              id="currentPassword"
              type="password"
              required
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full rounded-lg border border-dash-border bg-dash-surface2 px-4 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="h-px bg-dash-border" />

          <div>
            <label htmlFor="name" className="mb-1 block text-xs font-medium text-dash-text2">
              Your name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-dash-border bg-dash-surface2 px-4 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label htmlFor="newEmail" className="mb-1 block text-xs font-medium text-dash-text2">
              Administrator email
            </label>
            <input
              id="newEmail"
              type="email"
              required
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="w-full rounded-lg border border-dash-border bg-dash-surface2 px-4 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-1 focus:ring-primary"
            />
            <p className="mt-1 text-[11px] text-dash-text-muted">
              Changing this signs you out so you can sign back in with the new address.
            </p>
          </div>

          <div>
            <label htmlFor="newPassword" className="mb-1 block text-xs font-medium text-dash-text2">
              New password
            </label>
            <input
              id="newPassword"
              type="password"
              required
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-lg border border-dash-border bg-dash-surface2 px-4 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-1 focus:ring-primary"
            />
            <p className="mt-1 text-[11px] text-dash-text-muted">
              At least 12 characters, with an uppercase letter, a lowercase letter, and a number.
            </p>
          </div>

          <div>
            <label htmlFor="confirmPassword" className="mb-1 block text-xs font-medium text-dash-text2">
              Confirm new password
            </label>
            <input
              id="confirmPassword"
              type="password"
              required
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-lg border border-dash-border bg-dash-surface2 px-4 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600 dark:bg-red-950/40 dark:text-red-400">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-dash-inverted px-6 py-3 text-sm font-semibold text-white transition hover:bg-dash-inverted-hover disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save and continue
          </button>
        </form>
      </main>
    </div>
  );
}
