// SPDX-License-Identifier: Apache-2.0
'use client';

import { copyText } from '@/lib/clipboard';
import { useState, useCallback, useMemo, useRef } from 'react';
import {
  Play,
  Copy,
  Check,
  ChevronRight,
  ChevronDown,
  Search,
  Zap,
  FlaskConical,
  Lock,
  Clock,
  KeyRound,
  Eye,
  EyeOff,
  Send,
  RotateCcw,
} from 'lucide-react';
import {
  ENDPOINT_GROUPS,
  METHOD_COLORS,
  type EndpointDef,
  type EndpointGroup,
  type HttpMethod,
} from '@/lib/api-playground-data';

// ─── Mode ────────────────────────────────────────────────────────────────────

type PlaygroundMode = 'mock' | 'live';

// ─── Page Component ─────────────────────────────────────────────────────────

export default function ApiPlaygroundPage() {
  // State — mode & auth
  const [mode, setMode] = useState<PlaygroundMode>('mock');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);

  // State — endpoint selection
  const [selectedEndpoint, setSelectedEndpoint] = useState<EndpointDef>(
    ENDPOINT_GROUPS[0].endpoints[0],
  );
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    () => new Set(ENDPOINT_GROUPS.map((g) => g.name)),
  );
  const [endpointSearch, setEndpointSearch] = useState('');

  // State — request builder
  const [pathParams, setPathParams] = useState<Record<string, string>>({});
  const [queryParams, setQueryParams] = useState<Record<string, string>>({});
  const [bodyText, setBodyText] = useState('');

  // State — response
  const [response, setResponse] = useState<{
    status: number;
    body: string;
    time: number;
    headers?: Record<string, string>;
  } | null>(null);
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);

  // Refs
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  // ── When endpoint changes, reset form (via selection handler) ──
  const selectEndpoint = useCallback((ep: EndpointDef) => {
    setSelectedEndpoint(ep);

    const defaults: Record<string, string> = {};
    ep.params
      .filter((p) => p.in === 'path')
      .forEach((p) => {
        defaults[p.name] = p.example ?? '';
      });
    setPathParams(defaults);

    const qDefaults: Record<string, string> = {};
    ep.params
      .filter((p) => p.in === 'query')
      .forEach((p) => {
        qDefaults[p.name] = p.example ?? p.default ?? '';
      });
    setQueryParams(qDefaults);

    if (ep.sampleBody) {
      setBodyText(JSON.stringify(ep.sampleBody, null, 2));
    } else {
      setBodyText('');
    }

    setResponse(null);
  }, []);

  // ── Build request URL ───────────────────────────────────
  const requestUrl = useMemo(() => {
    let url = selectedEndpoint.path;
    // Replace :param with values
    Object.entries(pathParams).forEach(([key, value]) => {
      url = url.replace(`:${key}`, value || `:${key}`);
    });
    // Add query params
    const qParts = Object.entries(queryParams)
      .filter(([, v]) => v.trim() !== '')
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
    if (qParts.length > 0) url += '?' + qParts.join('&');
    return url;
  }, [selectedEndpoint.path, pathParams, queryParams]);

  // ── Send request ────────────────────────────────────────
  const handleSend = useCallback(async () => {
    setSending(true);
    setResponse(null);
    const start = performance.now();

    if (mode === 'mock') {
      // Simulate network delay
      await new Promise((r) => setTimeout(r, 300 + Math.random() * 400));
      const mock = selectedEndpoint.mockResponse;
      setResponse({
        status: mock.status,
        body: JSON.stringify(mock.body, null, 2),
        time: Math.round(performance.now() - start),
        headers: { 'content-type': 'application/json', 'x-mode': 'mock' },
      });
      setSending(false);
      return;
    }

    // Live mode
    if (!apiKey.trim()) {
      setResponse({
        status: 401,
        body: JSON.stringify(
          {
            error: 'AUTH_REQUIRED',
            message: 'Please enter your API key above to use Live mode.',
          },
          null,
          2,
        ),
        time: 0,
      });
      setSending(false);
      return;
    }

    try {
      const fetchOpts: RequestInit = {
        method: selectedEndpoint.method,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      };
      if (
        ['POST', 'PATCH'].includes(selectedEndpoint.method) &&
        bodyText.trim()
      ) {
        fetchOpts.body = bodyText;
      }
      const res = await fetch(requestUrl, fetchOpts);
      const text = await res.text();
      let formatted: string;
      try {
        formatted = JSON.stringify(JSON.parse(text), null, 2);
      } catch {
        formatted = text;
      }
      setResponse({
        status: res.status,
        body: formatted,
        time: Math.round(performance.now() - start),
      });
    } catch (err) {
      setResponse({
        status: 0,
        body: JSON.stringify(
          {
            error: 'NETWORK_ERROR',
            message: err instanceof Error ? err.message : 'Request failed',
          },
          null,
          2,
        ),
        time: Math.round(performance.now() - start),
      });
    }
    setSending(false);
  }, [mode, apiKey, selectedEndpoint, requestUrl, bodyText]);

  // ── Copy response ───────────────────────────────────────
  const copyResponse = useCallback(() => {
    if (!response) return;
    copyText(response.body);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [response]);

  // ── Toggle group expand ─────────────────────────────────
  const toggleGroup = useCallback((name: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);

  // ── Filter endpoints ────────────────────────────────────
  const filteredGroups = useMemo(() => {
    if (!endpointSearch.trim()) return ENDPOINT_GROUPS;
    const q = endpointSearch.toLowerCase();
    return ENDPOINT_GROUPS.map((g) => ({
      ...g,
      endpoints: g.endpoints.filter(
        (e) =>
          e.summary.toLowerCase().includes(q) ||
          e.path.toLowerCase().includes(q) ||
          e.method.toLowerCase().includes(q),
      ),
    })).filter((g) => g.endpoints.length > 0);
  }, [endpointSearch]);

  // ── Status code color ──────────────────────────────────
  const statusColor = (status: number) => {
    if (status >= 200 && status < 300)
      return 'text-emerald-600 dark:text-emerald-400';
    if (status >= 400 && status < 500)
      return 'text-amber-600 dark:text-amber-400';
    return 'text-red-600 dark:text-red-400';
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* ── Top Bar ─────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 border-b border-dash-border bg-dash-surface px-5 py-3">
        <div className="flex items-center gap-2">
          <FlaskConical className="h-5 w-5 text-[var(--im-primary)]" />
          <h1 className="text-lg font-bold text-dash-text">API Playground</h1>
        </div>

        {/* Mode Toggle */}
        <div className="flex items-center rounded-lg border border-dash-border bg-dash-muted/50 p-0.5">
          <button
            onClick={() => setMode('mock')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
              mode === 'mock'
                ? 'bg-[var(--im-primary)] text-[var(--im-primary-fg)] shadow-sm'
                : 'text-dash-text2 hover:text-dash-text2 dark:text-dash-text-muted '
            }`}
          >
            <FlaskConical className="h-3.5 w-3.5" />
            Mock
          </button>
          <button
            onClick={() => setMode('live')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
              mode === 'live'
                ? 'bg-[var(--im-primary)] text-[var(--im-primary-fg)] shadow-sm'
                : 'text-dash-text2 hover:text-dash-text2 dark:text-dash-text-muted '
            }`}
          >
            <Zap className="h-3.5 w-3.5" />
            Live
          </button>
        </div>

        {/* Mode Description */}
        <span className="text-xs text-dash-text-muted">
          {mode === 'mock'
            ? 'Returns sample responses — no API key required'
            : 'Makes real requests to your workspace'}
        </span>

        {/* API Key (live mode only) */}
        {mode === 'live' && (
          <div className="ml-auto flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-dash-text-muted" />
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="img_xxxxxxxxxxxxxxxx"
                className="w-64 rounded-lg border border-dash-border bg-dash-surface py-1.5 pl-3 pr-8 text-xs font-mono text-dash-text2 placeholder-dash-text-muted transition-colors focus:border-[var(--im-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--im-primary)]"
              />
              <button
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-dash-text-muted hover:text-dash-text"
              >
                {showKey ? (
                  <EyeOff className="h-3.5 w-3.5" />
                ) : (
                  <Eye className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Main Layout ────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── Sidebar — Endpoint Browser ──────────────── */}
        <aside className="flex w-72 flex-shrink-0 flex-col border-r border-dash-border bg-dash-muted/50">
          {/* Search */}
          <div className="p-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-dash-text-muted" />
              <input
                type="text"
                value={endpointSearch}
                onChange={(e) => setEndpointSearch(e.target.value)}
                placeholder="Search endpoints..."
                className="w-full rounded-lg border border-dash-border bg-dash-surface py-2 pl-8 pr-3 text-xs text-dash-text placeholder-dash-text-muted transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {/* Endpoint List */}
          <nav className="flex-1 overflow-y-auto px-2 pb-4">
            {filteredGroups.map((group) => (
              <EndpointGroupSection
                key={group.name}
                group={group}
                expanded={expandedGroups.has(group.name)}
                onToggle={() => toggleGroup(group.name)}
                selectedId={selectedEndpoint.id}
                onSelect={selectEndpoint}
              />
            ))}
            {filteredGroups.length === 0 && (
              <p className="mt-8 text-center text-xs text-dash-text-muted">
                No endpoints match your search
              </p>
            )}
          </nav>

          {/* Stats */}
          <div className="border-t border-dash-border px-3 py-2">
            <p className="text-[10px] text-dash-text-muted">
              {ENDPOINT_GROUPS.reduce((a, g) => a + g.endpoints.length, 0)}{' '}
              endpoints across {ENDPOINT_GROUPS.length} categories
            </p>
          </div>
        </aside>

        {/* ── Main Panel ────────────────────────────────── */}
        <main className="flex flex-1 flex-col overflow-hidden">
          {/* Request Bar */}
          <div className="flex items-center gap-3 border-b border-dash-border bg-dash-surface px-5 py-3">
            <MethodBadge method={selectedEndpoint.method} />
            <code className="flex-1 truncate text-sm font-medium text-dash-text2 ">
              {requestUrl}
            </code>
            <button
              onClick={handleSend}
              disabled={sending}
              className="flex items-center gap-2 rounded-lg bg-[var(--im-primary)] px-4 py-2 text-xs font-semibold text-[var(--im-primary-fg)] shadow-sm transition-all hover:opacity-90 disabled:opacity-50"
            >
              {sending ? (
                <>
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-3.5 w-3.5" />
                  Send
                </>
              )}
            </button>
          </div>

          {/* Request + Response Split */}
          <div className="flex flex-1 overflow-hidden">
            {/* ── Request Details ─────────────────────── */}
            <div className="flex w-1/2 flex-col overflow-y-auto border-r border-dash-border bg-dash-surface">
              {/* Endpoint Info */}
              <div className="border-b border-dash-border/50 px-5 py-4">
                <h2 className="text-sm font-bold text-dash-text ">
                  {selectedEndpoint.summary}
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-dash-text2">
                  {selectedEndpoint.description}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-dash-muted px-2 py-0.5 text-[10px] font-medium text-dash-text2">
                    <Lock className="h-2.5 w-2.5" />
                    {selectedEndpoint.permission}
                  </span>
                </div>
              </div>

              {/* Path Params */}
              {selectedEndpoint.params.filter((p) => p.in === 'path').length >
                0 && (
                <ParamSection
                  title="Path Parameters"
                  params={selectedEndpoint.params.filter(
                    (p) => p.in === 'path',
                  )}
                  values={pathParams}
                  onChange={(k, v) =>
                    setPathParams((prev) => ({ ...prev, [k]: v }))
                  }
                />
              )}

              {/* Query Params */}
              {selectedEndpoint.params.filter((p) => p.in === 'query').length >
                0 && (
                <ParamSection
                  title="Query Parameters"
                  params={selectedEndpoint.params.filter(
                    (p) => p.in === 'query',
                  )}
                  values={queryParams}
                  onChange={(k, v) =>
                    setQueryParams((prev) => ({ ...prev, [k]: v }))
                  }
                />
              )}

              {/* Request Body */}
              {selectedEndpoint.sampleBody && (
                <div className="border-b border-dash-border/50 px-5 py-4">
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-dash-text2">
                      Request Body
                    </h3>
                    <button
                      onClick={() =>
                        setBodyText(
                          JSON.stringify(selectedEndpoint.sampleBody, null, 2),
                        )
                      }
                      className="flex items-center gap-1 text-[10px] text-dash-text-muted hover:text-[var(--im-primary)]"
                    >
                      <RotateCcw className="h-3 w-3" />
                      Reset
                    </button>
                  </div>
                  <textarea
                    ref={bodyRef}
                    value={bodyText}
                    onChange={(e) => setBodyText(e.target.value)}
                    spellCheck={false}
                    className="w-full resize-y rounded-lg border border-dash-border bg-dash-muted/50 p-3 font-mono text-xs leading-relaxed text-dash-text2 transition-colors focus:border-[var(--im-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--im-primary)]"
                    rows={Math.min(12, bodyText.split('\n').length + 1)}
                  />
                </div>
              )}
            </div>

            {/* ── Response Panel ──────────────────────── */}
            <div className="flex w-1/2 flex-col bg-dash-muted dark:bg-dash-deep/50">
              {response ? (
                <div className="flex flex-1 flex-col overflow-hidden">
                  {/* Response Header */}
                  <div className="flex items-center gap-3 border-b border-dash-border px-5 py-3">
                    <span
                      className={`text-sm font-bold ${statusColor(response.status)}`}
                    >
                      {response.status || 'ERR'}
                    </span>
                    <span className="text-[10px] text-dash-text-muted">
                      {response.status >= 200 && response.status < 300
                        ? 'OK'
                        : response.status >= 400 && response.status < 500
                          ? 'Client Error'
                          : 'Error'}
                    </span>
                    <div className="ml-auto flex items-center gap-3">
                      <span className="flex items-center gap-1 text-[10px] text-dash-text-muted">
                        <Clock className="h-3 w-3" />
                        {response.time}ms
                      </span>
                      {mode === 'mock' && (
                        <span className="rounded-full bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400">
                          Mock
                        </span>
                      )}
                      <button
                        onClick={copyResponse}
                        className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] text-dash-text-muted transition-colors hover:bg-dash-surface-hover hover:text-dash-text"
                      >
                        {copied ? (
                          <Check className="h-3 w-3 text-emerald-500 dark:text-emerald-400" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                        {copied ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                  </div>
                  {/* Response Body */}
                  <div className="flex-1 overflow-auto p-4">
                    <pre className="whitespace-pre-wrap rounded-xl border border-dash-border bg-dash-surface p-4 font-mono text-xs leading-relaxed text-dash-text2 dark:text-dash-text-muted">
                      <JsonHighlight json={response.body} />
                    </pre>
                  </div>
                </div>
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-dash-muted">
                    <Play className="h-5 w-5 text-dash-text-muted" />
                  </div>
                  <p className="text-sm font-medium text-dash-text2">
                    Hit{' '}
                    <span className="font-bold text-[var(--im-primary)]">
                      Send
                    </span>{' '}
                    to see the response
                  </p>
                  <p className="max-w-xs text-xs text-dash-text-muted">
                    {mode === 'mock'
                      ? 'Mock mode returns sample data instantly — great for exploring the API shape.'
                      : 'Live mode sends real requests to your workspace using the API key above.'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function EndpointGroupSection({
  group,
  expanded,
  onToggle,
  selectedId,
  onSelect,
}: {
  group: EndpointGroup;
  expanded: boolean;
  onToggle: () => void;
  selectedId: string;
  onSelect: (ep: EndpointDef) => void;
}) {
  return (
    <div className="mb-1">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs font-semibold text-dash-text2 transition-colors hover:bg-dash-surface-hover dark:text-dash-text-muted "
      >
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 text-dash-text-muted" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-dash-text-muted" />
        )}
        <span>{group.icon}</span>
        <span>{group.name}</span>
        <span className="ml-auto rounded-full bg-dash-badge px-1.5 py-0.5 text-[10px] font-medium text-dash-text2 dark:text-dash-text-muted">
          {group.endpoints.length}
        </span>
      </button>
      {expanded && (
        <div className="ml-2 space-y-0.5 border-l border-dash-border pl-2 ">
          {group.endpoints.map((ep) => (
            <button
              key={ep.id}
              onClick={() => onSelect(ep)}
              className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors ${
                selectedId === ep.id
                  ? 'bg-[var(--im-primary-light)] text-[var(--im-primary)] dark:bg-[var(--im-primary)]/20 dark:text-[var(--im-primary)]'
                  : 'text-dash-text2 hover:bg-dash-surface-hover dark:text-dash-text-muted '
              }`}
            >
              <MethodBadge method={ep.method} small />
              <span className="truncate text-[11px] font-medium">
                {ep.summary}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function MethodBadge({
  method,
  small,
}: {
  method: HttpMethod;
  small?: boolean;
}) {
  const colors = METHOD_COLORS[method];
  return (
    <span
      className={`inline-flex items-center justify-center rounded font-bold uppercase ${colors.bg} ${colors.text} ${
        small
          ? 'min-w-[38px] px-1 py-0.5 text-[9px]'
          : 'min-w-[52px] px-2 py-1 text-[10px]'
      }`}
    >
      {method}
    </span>
  );
}

function ParamSection({
  title,
  params,
  values,
  onChange,
}: {
  title: string;
  params: EndpointDef['params'];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
}) {
  return (
    <div className="border-b border-dash-border/50 px-5 py-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-dash-text2">
        {title}
      </h3>
      <div className="space-y-2.5">
        {params.map((p) => (
          <div key={p.name} className="flex items-start gap-3">
            <div className="w-28 flex-shrink-0 pt-2">
              <div className="flex items-center gap-1">
                <code className="text-xs font-semibold text-dash-text2 dark:text-dash-text-muted">
                  {p.name}
                </code>
                {p.required && (
                  <span className="text-[9px] font-bold text-red-500">*</span>
                )}
              </div>
              <p className="mt-0.5 text-[10px] text-dash-text-muted">
                {p.type}
              </p>
            </div>
            <div className="flex-1">
              <input
                type="text"
                value={values[p.name] ?? ''}
                onChange={(e) => onChange(p.name, e.target.value)}
                placeholder={p.example ?? p.default ?? ''}
                className="w-full rounded-lg border border-dash-border bg-dash-surface px-3 py-1.5 font-mono text-xs text-dash-text2 placeholder-dash-text-muted transition-colors focus:border-[var(--im-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--im-primary)]"
              />
              <p className="mt-0.5 text-[10px] text-dash-text-muted">
                {p.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── JSON Syntax Highlighter ─────────────────────────────
function JsonHighlight({ json }: { json: string }) {
  // Simple regex-based JSON syntax highlighting
  const highlighted = json
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // Strings
    .replace(/("(?:[^"\\]|\\.)*")/g, (match) => {
      // Check if it's a key (followed by :)
      if (
        json.indexOf(match + ':') !== -1 ||
        json.indexOf(match + ' :') !== -1
      ) {
        return `<span class="text-[var(--im-primary)]">${match}</span>`;
      }
      return `<span class="text-emerald-600 dark:text-emerald-400">${match}</span>`;
    })
    // Numbers
    .replace(
      /\b(\d+\.?\d*)\b/g,
      '<span class="text-amber-600 dark:text-amber-400">$1</span>',
    )
    // Booleans & null
    .replace(
      /\b(true|false|null)\b/g,
      '<span class="text-blue-600 dark:text-blue-400">$1</span>',
    );

  return <code dangerouslySetInnerHTML={{ __html: highlighted }} />;
}
