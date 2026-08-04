// SPDX-License-Identifier: Apache-2.0
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Check,
  Copy,
  Download,
  FileText,
  Loader2,
  TriangleAlert,
} from 'lucide-react';

interface DocxViewerProps {
  src: string;
  name: string;
}

interface MammothResultMessage {
  type: 'warning' | 'error';
  message: string;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_CHARACTERS = 120_000;

export function DocxViewer({ src, name }: DocxViewerProps) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [copied, setCopied] = useState(false);
  const [messages, setMessages] = useState<MammothResultMessage[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(src);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const contentLength = Number(res.headers.get('content-length') ?? '0');
        if (contentLength > MAX_FILE_SIZE) {
          throw new Error('Document is too large to preview inline.');
        }

        const arrayBuffer = await res.arrayBuffer();
        if (arrayBuffer.byteLength > MAX_FILE_SIZE) {
          throw new Error('Document is too large to preview inline.');
        }

        const mammoth = await import('mammoth');
        const result = await mammoth.extractRawText({ arrayBuffer });
        const normalized = result.value.replace(/\r/g, '').trim();
        const nextContent = normalized.slice(0, MAX_CHARACTERS);

        if (!cancelled) {
          setContent(nextContent);
          setTruncated(normalized.length > MAX_CHARACTERS);
          setMessages(
            (result.messages ?? []).map((message) => ({
              type: message.type,
              message: message.message,
            })),
          );
        }
      } catch (err) {
        if (!cancelled) {
          console.error('[DocxViewer] Failed to load document:', err);
          setError(
            err instanceof Error
              ? err.message
              : 'Failed to load document preview.',
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [src]);

  const paragraphs = useMemo(
    () => content.split(/\n\s*\n+/).filter((paragraph) => paragraph.trim()),
    [content],
  );

  const handleCopy = useCallback(async () => {
    if (!content) {
      return;
    }

    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore clipboard errors and leave manual download fallback.
    }
  }, [content]);

  if (loading) {
    return (
      <div className="flex w-full flex-col items-center gap-3 rounded-xl bg-dash-muted py-10">
        <Loader2 className="h-8 w-8 animate-spin text-dash-text-muted" />
        <p className="text-xs text-dash-text-muted">Extracting DOCX text…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex w-full flex-col items-center gap-3 rounded-xl bg-red-50 py-8 dark:bg-red-950/30">
        <AlertCircle className="h-10 w-10 text-red-400" />
        <p className="text-center text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
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

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-dash-surface2 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="rounded bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-blue-600 dark:text-blue-300">
            DOCX
          </span>
          <span className="truncate text-[11px] text-dash-text-muted">
            {name}
          </span>
          <span className="text-[10px] text-dash-text-muted">
            {paragraphs.length} sections
            {truncated ? ' · preview truncated' : ''}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleCopy}
            className="rounded p-1 text-dash-text-muted transition hover:bg-dash-surface-hover hover:text-dash-text"
            title="Copy extracted text"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-500" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
          <a
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded p-1 text-dash-text-muted transition hover:bg-dash-surface-hover hover:text-dash-text"
            title="Download document"
          >
            <Download className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>

      {messages.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="space-y-1">
            {messages.slice(0, 2).map((message, index) => (
              <p key={`${message.type}-${index}`}>{message.message}</p>
            ))}
          </div>
        </div>
      )}

      <div className="max-h-96 overflow-auto rounded-xl border border-dash-border bg-white p-4 dark:bg-dash-code-bg">
        {paragraphs.length > 0 ? (
          <div className="space-y-4">
            {paragraphs.map((paragraph, index) => (
              <div
                key={`${index}-${paragraph.slice(0, 16)}`}
                className="rounded-lg border border-dash-border/60 bg-dash-surface px-4 py-3 dark:bg-dash-surface2"
              >
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-dash-text-muted">
                  Section {index + 1}
                </p>
                <p className="whitespace-pre-wrap text-sm leading-6 text-dash-text wrap-break-word">
                  {paragraph}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <FileText className="h-8 w-8 text-dash-text-muted" />
            <div>
              <p className="text-sm font-medium text-dash-text">
                No readable text was extracted from this document.
              </p>
              <p className="mt-1 text-xs text-dash-text-muted">
                Download the original file to inspect advanced formatting.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default DocxViewer;
