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
} from 'lucide-react';

interface DocumentTextViewerProps {
  src: string;
  name: string;
  mimeType: string;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_CHARACTERS = 120_000;

function decodeRtfHex(raw: string) {
  return raw.replace(/\\'([0-9a-fA-F]{2})/g, (_, hex: string) =>
    String.fromCharCode(Number.parseInt(hex, 16)),
  );
}

function extractRtfText(raw: string) {
  return decodeRtfHex(raw)
    .replace(/\\par[d]?\s?/g, '\n\n')
    .replace(/\\tab\s?/g, '\t')
    .replace(/\\line\s?/g, '\n')
    .replace(/\\[a-z]+-?\d*\s?/gi, '')
    .replace(/\\([{}\\])/g, '$1')
    .replace(/[{}]/g, '')
    .replace(/\r/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function extractOdtParagraphs(xml: string) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'application/xml');

  const paragraphs = Array.from(doc.getElementsByTagName('*'))
    .filter((node) => ['p', 'h'].includes(node.localName))
    .map((node) => node.textContent?.replace(/\s+/g, ' ').trim() ?? '')
    .filter(Boolean);

  if (paragraphs.length > 0) {
    return paragraphs;
  }

  return Array.from(
    xml.matchAll(/<(?:\w+:)?(?:p|h)[^>]*>([\s\S]*?)<\/(?:\w+:)?(?:p|h)>/gi),
  )
    .map((match) => match[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

async function extractDocumentText(arrayBuffer: ArrayBuffer, mimeType: string) {
  if (
    mimeType === 'application/vnd.oasis.opendocument.text' ||
    mimeType.includes('opendocument.text')
  ) {
    const JSZip = (await import('jszip')).default;
    const archive = await JSZip.loadAsync(arrayBuffer);
    const contentXml = await archive.file('content.xml')?.async('string');

    if (!contentXml) {
      throw new Error('Document content could not be extracted.');
    }

    return extractOdtParagraphs(contentXml).join('\n\n');
  }

  const raw = new TextDecoder().decode(arrayBuffer);
  return extractRtfText(raw);
}

export function DocumentTextViewer({
  src,
  name,
  mimeType,
}: DocumentTextViewerProps) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [truncated, setTruncated] = useState(false);

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

        const extracted = await extractDocumentText(arrayBuffer, mimeType);
        const normalized = extracted.replace(/\r/g, '').trim();

        if (!cancelled) {
          setContent(normalized.slice(0, MAX_CHARACTERS));
          setTruncated(normalized.length > MAX_CHARACTERS);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('[DocumentTextViewer] Failed to load document:', err);
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
  }, [mimeType, src]);

  const paragraphs = useMemo(
    () => content.split(/\n\s*\n+/).filter((paragraph) => paragraph.trim()),
    [content],
  );

  const handleCopy = useCallback(async () => {
    if (!content) return;

    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore clipboard errors.
    }
  }, [content]);

  const formatLabel = mimeType.includes('opendocument.text') ? 'ODT' : 'RTF';

  if (loading) {
    return (
      <div className="flex w-full flex-col items-center gap-3 rounded-xl bg-dash-muted py-10">
        <Loader2 className="h-8 w-8 animate-spin text-dash-text-muted" />
        <p className="text-xs text-dash-text-muted">Extracting document text…</p>
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
          <span className="rounded bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-sky-600 dark:text-sky-300">
            {formatLabel}
          </span>
          <span className="truncate text-[11px] text-dash-text-muted">
            {name}
          </span>
          <span className="text-[10px] text-dash-text-muted">
            {paragraphs.length} sections{truncated ? ' · preview truncated' : ''}
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

export default DocumentTextViewer;
