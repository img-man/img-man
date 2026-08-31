// SPDX-License-Identifier: Apache-2.0
'use client';

import { copyText } from '@/lib/clipboard';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Code2,
  Copy,
  CheckCircle2,
  Globe,
  Terminal,
  RefreshCw,
  AlertCircle,
  Plug,
  ShieldCheck,
  ArrowRight,
  Info,
  UserCheck,
  KeyRound,
  Save,
} from 'lucide-react';

/* ─── Types ────────────────────────────────────────────── */

interface OrgInfo {
  orgSlug: string;
  orgName: string;
  baseUrl: string;
  apiKeyPrefix: string;
  defaultNewUserRole: 'editor' | 'viewer';
  allowedEmailDomains: string[];
}

function normalizeAllowedEmailDomain(value: string): string | null {
  const normalized = value.trim().toLowerCase().replace(/^@+/, '');
  if (!normalized) return null;
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(normalized)) return null;
  return normalized;
}

function parseAllowedEmailDomainsInput(value: string): string[] {
  const unique = new Set<string>();
  for (const part of value.split(/[\n,]+/)) {
    const normalized = normalizeAllowedEmailDomain(part);
    if (normalized) unique.add(normalized);
  }
  return Array.from(unique);
}

function formatAllowedEmailDomains(domains: string[]): string {
  return domains.map((domain) => `@${domain}`).join(', ');
}

/* ─── Helpers ──────────────────────────────────────────── */

function CodeBlock({
  id,
  title,
  lang,
  code,
  icon: Icon,
  copiedId,
  onCopy,
}: {
  id: string;
  title: string;
  lang: string;
  code: string;
  icon: React.ElementType;
  copiedId: string | null;
  onCopy: (text: string, id: string) => void;
}) {
  const isCopied = copiedId === id;
  return (
    <section className="overflow-hidden rounded-xl border border-dash-border bg-dash-surface">
      <div className="flex items-center justify-between border-b border-dash-border px-5 py-3">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-dash-text-muted" />
          <h3 className="text-sm font-semibold text-dash-text2">{title}</h3>
          <span className="rounded-full bg-dash-muted px-2 py-0.5 text-[11px] font-medium text-dash-text2">
            {lang}
          </span>
        </div>
        <button
          onClick={() => onCopy(code, id)}
          className="flex items-center gap-1.5 rounded-lg border border-dash-border px-3 py-1.5 text-xs font-medium text-dash-text2 transition hover:bg-dash-muted"
        >
          {isCopied ? (
            <>
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              Copy
            </>
          )}
        </button>
      </div>
      <pre className="overflow-x-auto bg-dash-deep p-5 text-sm leading-relaxed">
        <code className="text-dash-text-muted whitespace-pre">{code}</code>
      </pre>
    </section>
  );
}

function StepBadge({ n }: { n: number }) {
  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[11px] font-bold text-white">
      {n}
    </span>
  );
}

/* ─── Component ────────────────────────────────────────── */

export default function IntegrationPage() {
  const [orgInfo, setOrgInfo] = useState<OrgInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [defaultNewUserRole, setDefaultNewUserRole] = useState<'editor' | 'viewer'>('editor');
  const [allowedEmailDomainsInput, setAllowedEmailDomainsInput] = useState('');
  const [savingDefaultRole, setSavingDefaultRole] = useState(false);
  const [defaultRoleStatus, setDefaultRoleStatus] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const fetchOrgInfo = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [settingsRes, keysRes] = await Promise.all([
        fetch('/api/settings'),
        fetch('/api/settings/api-keys'),
      ]);

      if (!settingsRes.ok) throw new Error(`Settings HTTP ${settingsRes.status}`);
      const settingsData = await settingsRes.json();

      let apiKeyPrefix = 'img_YOUR_API_KEY';
      if (keysRes.ok) {
        const keysData = await keysRes.json();
        if (keysData.keys?.length > 0) {
          apiKeyPrefix = keysData.keys[0].keyPrefix + '...';
        }
      }

      const baseUrl =
        typeof window !== 'undefined'
          ? window.location.origin
          : 'https://your-imgman-domain.com';
      const allowedEmailDomains = Array.isArray(settingsData.settings?.embedConfig?.allowedEmailDomains)
        ? settingsData.settings.embedConfig.allowedEmailDomains.filter(
            (value: unknown): value is string => typeof value === 'string',
          )
        : [];

      setOrgInfo({
        orgSlug: settingsData.settings.orgSlug,
        orgName: settingsData.settings.orgName,
        baseUrl,
        apiKeyPrefix,
        defaultNewUserRole:
          settingsData.settings?.embedConfig?.defaultNewUserRole === 'viewer'
            ? 'viewer'
            : 'editor',
        allowedEmailDomains,
      });
      setDefaultNewUserRole(
        settingsData.settings?.embedConfig?.defaultNewUserRole === 'viewer'
          ? 'viewer'
          : 'editor',
      );
      setAllowedEmailDomainsInput(formatAllowedEmailDomains(allowedEmailDomains));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrgInfo();
  }, [fetchOrgInfo]);

  const copyToClipboard = useCallback(async (text: string, id: string) => {
    await copyText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  const saveDefaultRole = useCallback(async () => {
    setSavingDefaultRole(true);
    setDefaultRoleStatus(null);
    try {
      const parsedAllowedEmailDomains = parseAllowedEmailDomainsInput(allowedEmailDomainsInput);
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          embedConfig: {
            defaultNewUserRole,
            allowedEmailDomains: parsedAllowedEmailDomains,
          },
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      const nextRole =
        data.settings?.embedConfig?.defaultNewUserRole === 'viewer'
          ? 'viewer'
          : 'editor';
      const nextAllowedEmailDomains = Array.isArray(data.settings?.embedConfig?.allowedEmailDomains)
        ? data.settings.embedConfig.allowedEmailDomains.filter(
            (value: unknown): value is string => typeof value === 'string',
          )
        : [];

      setDefaultNewUserRole(nextRole);
      setAllowedEmailDomainsInput(formatAllowedEmailDomains(nextAllowedEmailDomains));
      setOrgInfo((prev) =>
        prev
          ? {
              ...prev,
              defaultNewUserRole: nextRole,
              allowedEmailDomains: nextAllowedEmailDomains,
            }
          : prev,
      );
      setDefaultRoleStatus({
        type: 'success',
        message:
          nextAllowedEmailDomains.length > 0
            ? `White-label provisioning updated. New users must match ${formatAllowedEmailDomains(nextAllowedEmailDomains)}.`
            : `White-label provisioning updated. New users will now default to ${nextRole}.`,
      });
    } catch (err) {
      setDefaultRoleStatus({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to save role',
      });
    } finally {
      setSavingDefaultRole(false);
    }
  }, [allowedEmailDomainsInput, defaultNewUserRole]);

  /* ─── Loading / Error ──────────────────────────────── */

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-dash-text-muted" />
      </div>
    );
  }

  if (error || !orgInfo) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <AlertCircle className="mx-auto h-8 w-8 text-red-400" />
          <p className="mt-2 text-sm text-dash-text2">{error ?? 'Unknown error'}</p>
          <button
            onClick={fetchOrgInfo}
            className="mt-3 text-xs font-medium text-blue-600 hover:underline"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const { orgSlug, orgName, baseUrl, apiKeyPrefix } = orgInfo;
  const parsedAllowedEmailDomains = parseAllowedEmailDomainsInput(allowedEmailDomainsInput);
  const hasDefaultRoleChanges =
    defaultNewUserRole !== orgInfo.defaultNewUserRole
    || JSON.stringify(parsedAllowedEmailDomains) !== JSON.stringify(orgInfo.allowedEmailDomains);
  const allowedEmailDomainSummary = parsedAllowedEmailDomains.length > 0
    ? formatAllowedEmailDomains(parsedAllowedEmailDomains)
    : null;

  /* ─── Code Snippets ────────────────────────────────── */

  const envSnippet = `# .env  (server-side — never expose these to the browser)
IMGMAN_BASE_URL="${baseUrl}"
IMGMAN_API_KEY="${apiKeyPrefix}"
IMGMAN_ORG_SLUG="${orgSlug}"`;

  const inviteSnippet = `// Optional — explicitly pre-invite a user when you need
// a role override before their first token is minted.
// Safe to call repeatedly: pass mergeOnConflict=true so it won't error
// if the user is already a member.
const inviteRes = await fetch(\`\${process.env.IMGMAN_BASE_URL}/api/team/invite\`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': \`Bearer \${process.env.IMGMAN_API_KEY}\`,
  },
  body: JSON.stringify({
    email: userEmail,          // required
    name: userName,            // optional but recommended
    role: '${defaultNewUserRole}',  // override the org default for this user
    mergeOnConflict: true,     // ← critical: don't throw if already a member
  }),
});`;

  const tokenSnippet = `// Step 2 — Mint a short-lived access token for the current user.
// The token (imgt_...) is safe to send to the browser — it expires and
// is scoped to this user's membership role.
// If the user is brand-new to this org, img-man auto-provisions them as
// '${defaultNewUserRole}' using your Integration setting.${allowedEmailDomainSummary
    ? `\n// New auto-provisioned users must also match: ${allowedEmailDomainSummary}`
    : ''}
const tokenRes = await fetch(\`\${process.env.IMGMAN_BASE_URL}/api/v1/auth/token\`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': \`Bearer \${process.env.IMGMAN_API_KEY}\`,
  },
  body: JSON.stringify({
    email: userEmail,    // identify the user
    name: userName,      // used for display
    expiresIn: '24h',    // '1h' | '24h' | '7d' | '30d'
  }),
});

const { accessToken, expiresAt } = await tokenRes.json();
// accessToken = "imgt_..."`;

  const selfHealSnippet = `// Full proxy route (Express / Node.js)
// Place this behind your own authentication so only your
// logged-in users can call it — NEVER expose IMGMAN_API_KEY to the browser.
// New org users are auto-provisioned as '${defaultNewUserRole}'.${allowedEmailDomainSummary
    ? `\n// Only emails matching ${allowedEmailDomainSummary} can auto-join this org.`
    : ''}

app.post('/api/imageman/token', requireAuth, async (req, res) => {
  const { email, name } = req.body;
  const BASE = process.env.IMGMAN_BASE_URL;
  const KEY  = process.env.IMGMAN_API_KEY;

  async function mintToken() {
    const r = await fetch(\`\${BASE}/api/v1/auth/token\`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': \`Bearer \${KEY}\`,
      },
      body: JSON.stringify({ email, name, expiresIn: '24h' }),
    });
    return { status: r.status, data: await r.json() };
  }

  let { status, data } = await mintToken();

  if (status !== 200) {
    return res.status(status).json({ success: false, error: data.error });
  }

  return res.json({
    success: true,
    accessToken: data.accessToken,
    expiresAt: data.expiresAt,
    embedUrl: BASE,
  });
});`;

  const embedSnippet = `// Step 3 — Embed the dashboard in an iframe.
// Call YOUR proxy endpoint to get the token, then build the embed URL.
// The token is short-lived; refresh it before it expires.

const proxyRes = await fetch('/api/imageman/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: currentUser.email, name: currentUser.name }),
});

const { accessToken, embedUrl } = await proxyRes.json();

// ✅ Correct embed route — /embed/dashboard reads the \`token\` query param
const iframeSrc = \`\${embedUrl}/embed/dashboard?token=\${encodeURIComponent(accessToken)}\`;

// ❌ Wrong — this loads the marketing landing page, not the dashboard
// const iframeSrc = \`\${embedUrl}/?token=\${accessToken}\`;`;

  const reactSnippet = `'use client';

import { useEffect, useState } from 'react';

export function ImgManEmbed({
  userEmail,
  userName,
}: {
  userEmail: string;
  userName?: string;
}) {
  const [embedSrc, setEmbedSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/imageman/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: userEmail, name: userName }),
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error);

        // ✅ Always use /embed/dashboard?token=...
        setEmbedSrc(
          \`\${data.embedUrl}/embed/dashboard?token=\${encodeURIComponent(data.accessToken)}\`
        );
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load img-man');
      }
    })();
  }, [userEmail, userName]);

  if (error) return <p style={{ color: 'red' }}>{error}</p>;
  if (!embedSrc) return <p>Loading…</p>;

  return (
    <iframe
      src={embedSrc}
      style={{ width: '100%', height: '100vh', border: 'none' }}
      allow="clipboard-write"
    />
  );
}`;

  return (
    <div className="mx-auto max-w-4xl space-y-10 p-6 pb-16">
      {/* Header */}
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Plug className="h-6 w-6 text-dash-text-muted" />
          Client Integration Guide
        </h1>
        <p className="mt-1 text-sm text-dash-text2">
          How to securely embed img-man into your application using server-side access tokens.
          All code snippets are pre-filled with your org&apos;s details.
        </p>
      </div>

      {/* Quick-reference bar */}
      <div className="rounded-xl border border-dash-border bg-dash-surface p-5">
        <div className="grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-4">
          <div>
            <p className="text-xs text-dash-text-muted">Org Name</p>
            <p className="mt-0.5 font-mono text-sm font-medium truncate">{orgName}</p>
          </div>
          <div>
            <p className="text-xs text-dash-text-muted">Org Slug</p>
            <p className="mt-0.5 font-mono text-sm text-dash-text2">{orgSlug}</p>
          </div>
          <div>
            <p className="text-xs text-dash-text-muted">API Key (prefix)</p>
            <p className="mt-0.5 font-mono text-sm text-dash-text2">{apiKeyPrefix}</p>
          </div>
          <div>
            <p className="text-xs text-dash-text-muted">Base URL</p>
            <p className="mt-0.5 font-mono text-sm text-dash-text2 truncate">{baseUrl}</p>
          </div>
        </div>
      </div>

      <section className="rounded-xl border border-dash-border bg-dash-surface p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              White-label User Provisioning
            </h2>
            <p className="text-sm text-dash-text2">
              First-time users created through the white-label token flow can be auto-added to your org with a default role and an optional email-domain allowlist.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={defaultNewUserRole}
              onChange={(e) => setDefaultNewUserRole(e.target.value as 'editor' | 'viewer')}
              className="rounded-lg border border-dash-border bg-dash-surface2 px-3 py-2 text-sm text-dash-text"
            >
              <option value="editor">Editor</option>
              <option value="viewer">Viewer</option>
            </select>
            <button
              onClick={saveDefaultRole}
              disabled={savingDefaultRole || !hasDefaultRoleChanges}
              className="inline-flex items-center gap-1.5 rounded-lg bg-dash-inverted px-3 py-2 text-xs font-medium text-white transition hover:bg-dash-inverted-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {savingDefaultRole ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              Save
            </button>
          </div>
        </div>
        <div className="mt-4 space-y-2">
          <label className="block text-xs font-medium text-dash-text-muted">
            Optional email allowlist
          </label>
          <textarea
            value={allowedEmailDomainsInput}
            onChange={(e) => setAllowedEmailDomainsInput(e.target.value)}
            rows={2}
            placeholder="@img-man.com, @agency.example"
            className="w-full rounded-lg border border-dash-border bg-dash-surface2 px-3 py-2 text-sm text-dash-text outline-none transition focus:border-dash-border-hover"
          />
          <p className="text-xs text-dash-text-muted">
            Only brand-new white-label users whose email matches one of these domains can auto-join this organization. Leave blank to allow any email.
          </p>
        </div>
        <p className="mt-3 text-xs text-dash-text-muted">
          Need a one-off exception? Explicitly call <code className="rounded bg-dash-muted px-1">POST /api/team/invite</code> first with the role you want, then mint the token.
        </p>
        {defaultRoleStatus && (
          <div
            className={`mt-3 rounded-lg border px-3 py-2 text-xs ${
              defaultRoleStatus.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300'
                : 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300'
            }`}
          >
            {defaultRoleStatus.message}
          </div>
        )}
      </section>

      {/* Identity passthrough — the thing that makes this integration cheap */}
      <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900 dark:bg-emerald-950/40">
        <h2 className="flex items-center gap-2 text-base font-semibold text-emerald-900 dark:text-emerald-200">
          <UserCheck className="h-4 w-4" />
          Your users stay your users
        </h2>
        <p className="mt-2 text-sm text-emerald-800 dark:text-emerald-300/90">
          img-man never asks your users to create an account, remember a second
          password, or see a second login screen. Your server names the user when
          it mints the token, and the embedded dashboard opens as that person —
          with their role, their folder access, and their name on every upload and
          audit entry.
        </p>
        <ul className="mt-3 space-y-1.5 text-xs text-emerald-800 dark:text-emerald-300/80">
          <li>
            <strong>Zero client-side work.</strong> Your frontend calls your own
            proxy and drops the returned URL into an iframe. Nothing else changes.
          </li>
          <li>
            <strong>Your app stays the identity provider.</strong> Deactivate a
            user on your side and they simply stop getting tokens.
          </li>
          <li>
            <strong>First-time users provision themselves.</strong> An unknown
            email is added as {defaultNewUserRole} on its first token — no manual
            invite step.
          </li>
        </ul>
      </section>

      {/* How it works */}
      <section className="space-y-4">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <ShieldCheck className="h-4 w-4 text-emerald-500" />
          How the secure token flow works
        </h2>

        <div className="rounded-xl border border-dash-border bg-dash-surface divide-y divide-dash-border">
          {[
            {
              step: 1,
              icon: KeyRound,
              title: 'Your server holds the API key',
              body: 'IMGMAN_API_KEY lives only in your server environment. It is never sent to the browser.',
            },
            {
              step: 2,
              icon: Globe,
              title: 'Your server mints a short-lived access token',
              body: `When a user opens the embed, your server calls POST /api/v1/auth/token with the user's email and your API key. Brand-new org users are auto-provisioned as ${defaultNewUserRole}s${allowedEmailDomainSummary ? ` when their email matches ${allowedEmailDomainSummary}` : ''}, then img-man returns an imgt_... access token valid for 1–24 h.`,
            },
            {
              step: 3,
              icon: ArrowRight,
              title: 'The token is passed to the iframe via URL',
              body: 'Your frontend builds the embed URL as /embed/dashboard?token=imgt_... and sets it as the iframe src. The embed page calls /api/v1/auth/me to bootstrap the dashboard.',
            },
            {
              step: 4,
              icon: UserCheck,
              title: 'The embed runs as that same user',
              body: 'Every action inside the iframe — uploads, edits, shares, audit entries — is attributed to the user whose email you minted the token for. You do not manage a second set of accounts; your app stays the identity provider.',
            },
          ].map(({ step, icon: Icon, title, body }) => (
            <div key={step} className="flex gap-4 px-5 py-4">
              <StepBadge n={step} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Icon className="h-3.5 w-3.5 text-dash-text-muted shrink-0" />
                  <p className="text-sm font-medium">{title}</p>
                </div>
                <p className="mt-0.5 text-xs text-dash-text2 leading-relaxed">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Critical warning */}
      <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40 p-4 text-sm text-amber-800 dark:text-amber-300">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="space-y-1">
          <p className="font-semibold">Common mistakes to avoid</p>
          <ul className="list-disc pl-4 space-y-1 text-xs">
            <li>
              <strong>Wrong embed URL:</strong> Use{' '}
              <code className="rounded bg-amber-100 dark:bg-amber-900 px-1">
                /embed/dashboard?token=imgt_...
              </code>{' '}
              — <em>not</em>{' '}
              <code className="rounded bg-amber-100 dark:bg-amber-900 px-1">/?token=...</code>{' '}
              (that lands on the sign-in page).
            </li>
            <li>
              <strong>Unexpected role:</strong> New white-label users inherit the org default role of{' '}
              <code className="rounded bg-amber-100 dark:bg-amber-900 px-1">
                {defaultNewUserRole}
              </code>
              . Call{' '}
              <code className="rounded bg-amber-100 dark:bg-amber-900 px-1">
                POST /api/team/invite
              </code>{' '}
              first when you need a one-off override, with{' '}
              <code className="rounded bg-amber-100 dark:bg-amber-900 px-1">
                mergeOnConflict: true
              </code>
              .
            </li>
            <li>
              <strong>Blocked new users:</strong> {allowedEmailDomainSummary
                ? `Only emails matching ${allowedEmailDomainSummary} can auto-provision through the white-label token flow.`
                : 'If you leave the allowlist blank, any email can auto-provision through the white-label token flow.'}
            </li>
            <li>
              <strong>Phone-only first login:</strong> Automatic provisioning needs an email for brand-new users.
              Phone-only identification works only after that user already exists in img-man.
            </li>
            <li>
              <strong>API key in the browser:</strong> Never send{' '}
              <code className="rounded bg-amber-100 dark:bg-amber-900 px-1">
                IMGMAN_API_KEY
              </code>{' '}
              to the client. All API key calls must go through your own server proxy.
            </li>
          </ul>
        </div>
      </div>

      {/* Step-by-step snippets */}
      <section className="space-y-6">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Terminal className="h-4 w-4 text-dash-text-muted" />
          Step-by-step code
        </h2>

        <CodeBlock
          id="env"
          title="1 · Environment variables"
          lang=".env"
          icon={KeyRound}
          code={envSnippet}
          copiedId={copiedId}
          onCopy={copyToClipboard}
        />

        <CodeBlock
          id="invite"
          title="2 · Optional role override"
          lang="typescript"
          icon={Globe}
          code={inviteSnippet}
          copiedId={copiedId}
          onCopy={copyToClipboard}
        />

        <CodeBlock
          id="token"
          title="3 · Mint an access token"
          lang="typescript"
          icon={KeyRound}
          code={tokenSnippet}
          copiedId={copiedId}
          onCopy={copyToClipboard}
        />

        <CodeBlock
          id="proxy"
          title="4 · Proxy route (recommended)"
          lang="typescript"
          icon={Terminal}
          code={selfHealSnippet}
          copiedId={copiedId}
          onCopy={copyToClipboard}
        />

        <CodeBlock
          id="embed"
          title="5 · Build the embed URL (critical)"
          lang="typescript"
          icon={Code2}
          code={embedSnippet}
          copiedId={copiedId}
          onCopy={copyToClipboard}
        />

        <CodeBlock
          id="react"
          title="6 · React component example"
          lang="tsx"
          icon={Code2}
          code={reactSnippet}
          copiedId={copiedId}
          onCopy={copyToClipboard}
        />

      </section>

      {/* API docs link */}
      <div className="rounded-xl border border-blue-100 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/40 p-5 text-center">
        <p className="text-sm text-blue-700 dark:text-blue-300">
          Need more details? Check the{' '}
          <Link
            href="/docs/api"
            className="font-semibold underline hover:text-blue-900 dark:hover:text-blue-100"
          >
            full API documentation
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
