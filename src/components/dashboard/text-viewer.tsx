// SPDX-License-Identifier: Apache-2.0
'use client';

import { copyText } from '@/lib/clipboard';
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Loader2,
  AlertCircle,
  Download,
  WrapText,
  Copy,
  Check,
} from 'lucide-react';

/* ─── Types ──────────────────────────────────────────────── */

interface TextViewerProps {
  /** Signed GCS URL */
  src: string;
  /** File name (used for language detection) */
  name: string;
  /** MIME type */
  mimeType: string;
}

/* ─── Highlight.js lazy loader ───────────────────────────── */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let hljsPromise: Promise<any> | null = null;

function getHljs(): Promise<{
  highlightAuto: (code: string) => { value: string };
  highlight: (
    code: string,
    options: { language: string; ignoreIllegals?: boolean },
  ) => { value: string };
  getLanguage: (name: string) => unknown;
}> {
  if (!hljsPromise) {
    hljsPromise = import('highlight.js').then((m) => m.default ?? m);
  }
  return hljsPromise;
}

/* ─── Language detection ─────────────────────────────────── */

const EXT_LANGUAGE_MAP: Record<string, string> = {
  js: 'javascript',
  jsx: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  py: 'python',
  rb: 'ruby',
  go: 'go',
  rs: 'rust',
  java: 'java',
  kt: 'kotlin',
  swift: 'swift',
  c: 'c',
  cpp: 'cpp',
  h: 'c',
  hpp: 'cpp',
  cs: 'csharp',
  php: 'php',
  sh: 'bash',
  bash: 'bash',
  zsh: 'bash',
  json: 'json',
  xml: 'xml',
  html: 'html',
  htm: 'html',
  css: 'css',
  scss: 'scss',
  less: 'less',
  yaml: 'yaml',
  yml: 'yaml',
  toml: 'toml',
  md: 'markdown',
  sql: 'sql',
  graphql: 'graphql',
  gql: 'graphql',
  env: 'plaintext',
  log: 'plaintext',
  txt: 'plaintext',
  csv: 'plaintext',
  ini: 'ini',
  conf: 'plaintext',
  dockerfile: 'dockerfile',
  makefile: 'makefile',
};

function getExtension(name: string): string {
  const parts = name.toLowerCase().split('.');
  return parts.length > 1 ? parts[parts.length - 1] : '';
}

function getLanguage(name: string): string {
  const ext = getExtension(name);
  return EXT_LANGUAGE_MAP[ext] ?? 'plaintext';
}

/**
 * Map from our language names to highlight.js registered language IDs.
 * Only needed where our names differ from hljs names.
 */
const HLJS_LANGUAGE_MAP: Record<string, string> = {
  csharp: 'csharp',
  cpp: 'cpp',
  bash: 'bash',
  dockerfile: 'dockerfile',
  makefile: 'makefile',
  graphql: 'graphql',
  // Most languages match 1:1 with hljs
};

/** Max content size to render (1 MB) */
const MAX_PREVIEW_SIZE = 1 * 1024 * 1024;

/* ─── Component ──────────────────────────────────────────── */

export function TextViewer({ src, name }: TextViewerProps) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [wordWrap, setWordWrap] = useState(true);
  const [copied, setCopied] = useState(false);
  const [highlightedLines, setHighlightedLines] = useState<string[] | null>(
    null,
  );
  const codeRef = useRef<HTMLTableSectionElement>(null);

  const language = getLanguage(name);

  /* ─── Highlight content when loaded ─────────────────── */
  useEffect(() => {
    if (!content || language === 'plaintext') {
      setHighlightedLines(null);
      return;
    }

    let cancelled = false;

    getHljs()
      .then((hljs) => {
        if (cancelled) return;
        try {
          const hljsLang = HLJS_LANGUAGE_MAP[language] ?? language;
          const result = hljs.getLanguage(hljsLang)
            ? hljs.highlight(content, {
                language: hljsLang,
                ignoreIllegals: true,
              })
            : hljs.highlightAuto(content);
          if (!cancelled) {
            setHighlightedLines(result.value.split('\n'));
          }
        } catch {
          // Fallback to no highlighting if language not found
          if (!cancelled) setHighlightedLines(null);
        }
      })
      .catch(() => {
        if (!cancelled) setHighlightedLines(null);
      });

    return () => {
      cancelled = true;
    };
  }, [content, language]);

  /* ─── Fetch content ─────────────────────────────────── */
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(src);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const contentLength = Number(res.headers.get('content-length') ?? '0');
        if (contentLength > MAX_PREVIEW_SIZE) {
          // Read only the first chunk
          const reader = res.body?.getReader();
          if (!reader) throw new Error('No readable body');
          const chunks: Uint8Array[] = [];
          let totalRead = 0;
          while (totalRead < MAX_PREVIEW_SIZE) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            totalRead += value.length;
          }
          reader.cancel();
          const decoder = new TextDecoder();
          const text = chunks
            .map((c) => decoder.decode(c, { stream: true }))
            .join('');
          if (!cancelled) {
            setContent(text.slice(0, MAX_PREVIEW_SIZE));
            setTruncated(true);
          }
        } else {
          const text = await res.text();
          if (!cancelled) {
            if (text.length > MAX_PREVIEW_SIZE) {
              setContent(text.slice(0, MAX_PREVIEW_SIZE));
              setTruncated(true);
            } else {
              setContent(text);
              setTruncated(false);
            }
          }
        }
      } catch (err) {
        if (!cancelled) {
          console.error('[TextViewer] Failed to load file:', err);
          setError('Failed to load file content.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [src]);

  /* ─── Copy to clipboard ─────────────────────────────── */
  const handleCopy = useCallback(async () => {
    if (!content) return;
    try {
      await copyText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  }, [content]);

  /* ─── Render states ─────────────────────────────────── */
  if (loading) {
    return (
      <div className="flex w-full flex-col items-center gap-3 py-12">
        <Loader2 className="h-8 w-8 animate-spin text-dash-text-muted" />
        <p className="text-xs text-dash-text-muted">Loading file content…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex w-full flex-col items-center gap-3 rounded-xl bg-red-50 py-8 dark:bg-red-950/30">
        <AlertCircle className="h-10 w-10 text-red-400" />
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-red-100 px-4 py-2 text-xs font-medium text-red-700 transition hover:bg-red-200 dark:bg-red-900/40 dark:text-red-300"
        >
          <Download className="h-3.5 w-3.5" />
          Download instead
        </a>
      </div>
    );
  }

  const lines = content?.split('\n') ?? [];

  return (
    <div className="flex w-full flex-col gap-2">
      {/* Toolbar */}
      <div className="flex items-center justify-between rounded-lg bg-dash-surface2 px-3 py-1.5">
        <div className="flex items-center gap-2">
          <span className="rounded bg-dash-muted px-1.5 py-0.5 text-[10px] font-bold uppercase text-dash-text-muted">
            {language}
          </span>
          <span className="text-[10px] text-dash-text-muted">
            {lines.length} lines
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setWordWrap((w) => !w)}
            className={`rounded p-1 text-dash-text-muted transition hover:bg-dash-surface-hover hover:text-dash-text ${
              wordWrap ? 'bg-dash-surface-hover text-dash-text' : ''
            }`}
            title="Toggle word wrap"
          >
            <WrapText className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={handleCopy}
            className="rounded p-1 text-dash-text-muted transition hover:bg-dash-surface-hover hover:text-dash-text"
            title="Copy content"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-500" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-h-80 overflow-auto rounded-lg border border-dash-border bg-gray-50 dark:bg-gray-900">
        <table className="w-full border-collapse text-[11px] font-mono leading-5">
          <tbody ref={codeRef}>
            {lines.map((line, i) => (
              <tr
                key={i}
                className="hover:bg-gray-100 dark:hover:bg-gray-800/50"
              >
                <td
                  className="select-none border-r border-dash-border px-2 text-right text-dash-text-muted opacity-50"
                  style={{ minWidth: '2.5rem' }}
                >
                  {i + 1}
                </td>
                {highlightedLines ? (
                  <td
                    className={`hljs px-3 ${wordWrap ? 'whitespace-pre-wrap break-all' : 'whitespace-pre'}`}
                    dangerouslySetInnerHTML={{
                      __html: highlightedLines[i] ?? '\u00A0',
                    }}
                  />
                ) : (
                  <td
                    className={`px-3 text-dash-text ${wordWrap ? 'whitespace-pre-wrap break-all' : 'whitespace-pre'}`}
                  >
                    {line || '\u00A0'}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Truncation notice */}
      {truncated && (
        <div className="flex items-center justify-center gap-2 text-[10px] text-amber-600 dark:text-amber-400">
          <AlertCircle className="h-3 w-3" />
          File too large to preview fully. Showing first 1 MB.
          <a
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium underline"
          >
            Download full file
          </a>
        </div>
      )}

      {/* File name */}
      <p className="max-w-full truncate text-center text-[11px] font-medium text-dash-text2">
        {name}
      </p>
    </div>
  );
}
