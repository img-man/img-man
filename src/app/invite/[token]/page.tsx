// SPDX-License-Identifier: Apache-2.0
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowRight,
  Clock,
  Shield,
} from 'lucide-react';

type Phase = 'loading' | 'success' | 'error';

interface AcceptResult {
  organization?: { name: string; slug: string } | null;
  role?: string;
  message?: string;
}

export default function InviteAcceptPage() {
  const params = useParams();
  const router = useRouter();
  const tokenParam = params.token;
  const token = Array.isArray(tokenParam) ? (tokenParam[0] ?? '') : (tokenParam ?? '');

  const [phase, setPhase] = useState<Phase>(() => (token ? 'loading' : 'error'));
  const [result, setResult] = useState<AcceptResult | null>(null);
  const [error, setError] = useState(() => (token ? '' : 'No invite token provided.'));

  useEffect(() => {
    if (!token) return;

    async function acceptInvite() {
      try {
        const res = await fetch('/api/team/accept', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });

        const json = await res.json();

        if (!res.ok) {
          setPhase('error');
          if (res.status === 410) {
            setError(
              'This invite has expired. Please ask the team admin for a new invite.',
            );
          } else if (res.status === 404) {
            setError('This invite is invalid or has already been used.');
          } else {
            setError(json.error ?? 'Failed to accept invite.');
          }
          return;
        }

        setResult(json);
        setPhase('success');
      } catch {
        setPhase('error');
        setError('Network error. Please try again.');
      }
    }

    acceptInvite();
  }, [token]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-dash-muted to-dash-bg dark:from-dash-deep dark:to-dash-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 text-2xl font-bold text-dash-text dark:text-white">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white text-lg font-black">
              IM
            </div>
            img-man
          </div>
        </div>

        {/* Card */}
        <div className="bg-dash-surface dark:bg-dash-inverted rounded-2xl border border-dash-border shadow-xl overflow-hidden">
          {/* ─── Loading ─────────────────────────── */}
          {phase === 'loading' && (
            <div className="p-12 text-center">
              <Loader2 className="h-12 w-12 animate-spin text-blue-500 mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-dash-text dark:text-white mb-2">
                Accepting Invite…
              </h2>
              <p className="text-sm text-dash-text2 ">
                Please wait while we set up your account.
              </p>
            </div>
          )}

          {/* ─── Success ─────────────────────────── */}
          {phase === 'success' && result && (
            <div className="p-8">
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-green-50 dark:bg-green-500/10 mb-4">
                  <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
                </div>
                <h2 className="text-xl font-bold text-dash-text dark:text-white mb-2">
                  Welcome to the Team!
                </h2>
                <p className="text-sm text-dash-text2 ">{result.message}</p>
              </div>

              {/* Details Card */}
              <div className="bg-dash-muted dark:bg-dash-inverted-hover/50 rounded-xl p-4 mb-6 space-y-3">
                {result.organization?.name && (
                  <div className="flex items-center gap-3">
                    <Shield className="h-4 w-4 text-dash-text-muted" />
                    <div>
                      <div className="text-xs text-dash-text2 ">
                        Organization
                      </div>
                      <div className="text-sm font-medium text-dash-text dark:text-white">
                        {result.organization.name}
                      </div>
                    </div>
                  </div>
                )}
                {result.role && (
                  <div className="flex items-center gap-3">
                    <Clock className="h-4 w-4 text-dash-text-muted" />
                    <div>
                      <div className="text-xs text-dash-text2 ">Your Role</div>
                      <div className="text-sm font-medium text-dash-text dark:text-white capitalize">
                        {result.role}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={() => router.push('/dashboard')}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-blue-500 to-violet-600 text-white font-medium text-sm hover:from-blue-600 hover:to-violet-700 transition-all shadow-lg shadow-blue-500/25"
              >
                Go to Dashboard
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* ─── Error ───────────────────────────── */}
          {phase === 'error' && (
            <div className="p-8 text-center">
              <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-red-50 dark:bg-red-500/10 mb-4">
                <XCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
              </div>
              <h2 className="text-xl font-bold text-dash-text dark:text-white mb-2">
                Invite Unavailable
              </h2>
              <p className="text-sm text-dash-text2 mb-6">{error}</p>
              <button
                onClick={() => router.push('/')}
                className="inline-flex items-center gap-2 py-2 px-4 rounded-lg border border-dash-border text-sm font-medium text-dash-text2 dark:text-dash-text-muted hover:bg-dash-muted dark:hover:bg-dash-inverted-hover transition-colors"
              >
                Go Home
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-dash-text-muted mt-6">
          Secure invite system powered by img-man
        </p>
      </div>
    </div>
  );
}
