// SPDX-License-Identifier: Apache-2.0
'use client';

import { getProviders, signIn } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, Eye, EyeOff } from 'lucide-react';

export default function SignInPage() {
 const router = useRouter();
 const [email, setEmail] = useState('admin@img-man.com');
 const [password, setPassword] = useState('Admin@12345');
 const [showPassword, setShowPassword] = useState(false);
 const [error, setError] = useState('');
 const [loading, setLoading] = useState(false);
 const [oauthProviders, setOauthProviders] = useState({
  google: false,
  github: false,
 });

 useEffect(() => {
  getProviders().then((providers) => {
   setOauthProviders({
	google: Boolean(providers?.google),
	github: Boolean(providers?.github),
   });
  });
 }, []);

 const hasOauthProviders = oauthProviders.google || oauthProviders.github;

 const handleLogin = async (e: React.FormEvent) => {
 e.preventDefault();
 setError('');
 setLoading(true);
 try {
 const res = await signIn('credentials', {
 email,
 password,
 redirect: false,
 });
 if (res?.error) {
 setError('Invalid email or password');
 setLoading(false);
 } else if (res?.ok) {
 router.push('/dashboard');
 }
 } catch (err) {
 setError('An error occurred. Please try again.');
 setLoading(false);
 }
 };

 return (
 <div className="min-h-screen bg-dash-bg text-dash-text">
 <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-6 px-6 py-20">
 {/* Brand */}
 <div className="text-center">
 <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-sm font-bold tracking-widest text-dash-text">
 IM
 </div>
 <h1 className="text-2xl font-bold tracking-tight text-dash-text">Welcome back</h1>
 <p className="mt-1 text-sm text-dash-text2">
 Sign in to your img-man workspace
 </p>
 <p className="mt-2 rounded-lg bg-dash-muted px-3 py-2 text-xs text-dash-text2">
  First run? Sign in with the bootstrap administrator from your{' '}
  <code className="rounded bg-dash-badge px-1">SETUP.md</code>. You will be
  required to replace those credentials before the dashboard opens.
 </p>
 </div>

 {hasOauthProviders && (
  <>
   {/* OAuth Providers */}
   <div className="grid w-full gap-3">
	{oauthProviders.google && (
	 <button
	  className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-white transition hover:bg-primary-hover"
	  onClick={() => signIn('google', { callbackUrl: '/dashboard' })}
	  type="button"
	 >
	  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
	   <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
	   <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
	   <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
	   <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
	  </svg>
	  Continue with Google
	 </button>
	)}
	{oauthProviders.github && (
	 <button
	  className="flex w-full items-center justify-center gap-2 rounded-lg border border-dash-border px-6 py-3 text-sm font-semibold text-dash-text2 transition hover:border-dash-border-hover hover:bg-dash-muted"
	  onClick={() => signIn('github', { callbackUrl: '/dashboard' })}
	  type="button"
	 >
	  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
	   <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
	  </svg>
	  Continue with GitHub
	 </button>
	)}
   </div>

   {/* Divider */}
   <div className="flex w-full items-center gap-3">
	<div className="h-px flex-1 bg-dash-badge" />
	<span className="text-xs text-dash-text-muted">or sign in with email</span>
	<div className="h-px flex-1 bg-dash-badge" />
   </div>
  </>
 )}

 {/* Email + Password */}
 <form onSubmit={handleLogin} className="grid w-full gap-3">
 <div>
 <label htmlFor="email" className="mb-1 block text-xs font-medium text-dash-text2">
 Email
 </label>
 <input
 id="email"
 type="email"
 autoComplete="email"
 placeholder="you@company.com"
 value={email}
 onChange={(e) => setEmail(e.target.value)}
 required
 className="w-full rounded-lg border border-dash-border bg-dash-surface px-4 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-1 focus:ring-primary"
 />
 </div>
 <div>
 <label htmlFor="password" className="mb-1 block text-xs font-medium text-dash-text2">
 Password
 </label>
 <div className="relative">
 <input
 id="password"
 type={showPassword ? 'text' : 'password'}
 autoComplete="current-password"
 placeholder="••••••••"
 value={password}
 onChange={(e) => setPassword(e.target.value)}
 required
 className="w-full rounded-lg border border-dash-border bg-dash-surface px-4 py-2.5 pr-10 text-sm outline-none transition focus:border-primary focus:ring-1 focus:ring-primary"
 />
 <button
 type="button"
 onClick={() => setShowPassword(!showPassword)}
 className="absolute right-3 top-1/2 -translate-y-1/2 text-dash-text2 hover:text-dash-text transition"
 aria-label={showPassword ? 'Hide password' : 'Show password'}
 >
 {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
 </button>
 </div>
 </div>
 {error && (
 <p className="rounded-lg bg-red-100 px-3 py-2 text-xs text-red-900 dark:bg-red-950 dark:text-red-200">{error}</p>
 )}
 <button
 type="submit"
 disabled={loading}
 className="flex w-full items-center justify-center gap-2 rounded-lg bg-white dark:bg-primary px-6 py-3 text-sm font-semibold text-dash-text dark:text-white transition hover:bg-gray-100 dark:hover:bg-primary-hover disabled:opacity-50"
 >
 {loading && <Loader2 className="h-4 w-4 animate-spin" />}
 Sign In
 </button>
 </form>

 {/* Footer links */}
 <div className="flex items-center gap-3 text-xs text-dash-text-muted">
 <Link href="/docs" className="text-dash-text2 hover:text-dash-text hover:underline">
 Documentation
 </Link>
 <span>·</span>
 <a
 href="https://github.com/img-man/img-man"
 target="_blank"
 rel="noreferrer"
 className="hover:text-dash-text2"
 >
 GitHub
 </a>
 </div>
 </main>
 </div>
 );
}
