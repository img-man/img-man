// SPDX-License-Identifier: Apache-2.0
'use client';

import { Download, ExternalLink, FileText, Presentation } from 'lucide-react';

interface OfficeFallbackViewerProps {
  src: string;
  name: string;
  mimeType: string;
}

interface OfficeFallbackConfig {
  label: string;
  title: string;
  description: string;
  suggestions: string[];
  icon: typeof FileText;
  accentClass: string;
  accentTextClass: string;
}

function getOfficeFallbackConfig(mimeType: string): OfficeFallbackConfig {
  if (
    mimeType === 'application/vnd.ms-powerpoint' ||
    mimeType.includes('powerpoint') ||
    mimeType.includes('opendocument.presentation')
  ) {
    return {
      label: mimeType.includes('opendocument.presentation') ? 'ODP' : 'PPT',
      title: 'Legacy presentation file',
      description:
        'This presentation format is stored safely, but inline slide extraction is not available yet.',
      suggestions: [
        'Export the deck as PPTX to unlock searchable inline preview.',
        'Upload a PDF export when visual slide review is required.',
        'Download the original file to edit in PowerPoint, Keynote, or LibreOffice.',
      ],
      icon: Presentation,
      accentClass: 'bg-orange-500/10 border-orange-500/20',
      accentTextClass: 'text-orange-600 dark:text-orange-300',
    };
  }

  return {
    label: 'DOC',
    title: 'Legacy document file',
    description:
      'This Word-compatible format is stored safely, but inline text extraction is limited for the binary version.',
    suggestions: [
      'Convert the file to DOCX or ODT for inline searchable preview.',
      'Upload a PDF copy for paginated visual review.',
      'Download the original file to continue editing in Word or LibreOffice.',
    ],
    icon: FileText,
    accentClass: 'bg-blue-500/10 border-blue-500/20',
    accentTextClass: 'text-blue-600 dark:text-blue-300',
  };
}

export function OfficeFallbackViewer({
  src,
  name,
  mimeType,
}: OfficeFallbackViewerProps) {
  const config = getOfficeFallbackConfig(mimeType);
  const Icon = config.icon;

  return (
    <div className="flex w-full flex-col gap-4 rounded-xl border border-dash-border bg-dash-surface p-5 dark:bg-dash-code-bg">
      <div className="flex items-start gap-4">
        <div
          className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border ${config.accentClass}`}
        >
          <Icon className={`h-7 w-7 ${config.accentTextClass}`} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${config.accentTextClass}`}
            >
              {config.label}
            </span>
            <span className="truncate text-sm font-semibold text-dash-text">
              {name}
            </span>
          </div>
          <p className="mt-2 text-sm font-medium text-dash-text">
            {config.title}
          </p>
          <p className="mt-1 text-sm text-dash-text-muted">
            {config.description}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-dash-border/70 bg-white/70 p-4 dark:bg-dash-surface2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-dash-text-muted">
          Recommended next steps
        </p>
        <ul className="mt-3 space-y-2 text-sm text-dash-text-muted">
          {config.suggestions.map((item) => (
            <li key={item} className="flex gap-2">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-dash-text-muted" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-wrap gap-2">
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg bg-dash-inverted px-4 py-2 text-xs font-medium text-white transition hover:bg-dash-inverted-hover dark:bg-dash-muted dark:text-dash-text dark:hover:bg-dash-surface-hover"
        >
          <Download className="h-3.5 w-3.5" />
          Download original
        </a>
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-dash-border px-4 py-2 text-xs font-medium text-dash-text transition hover:bg-dash-surface-hover"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Open in native app
        </a>
      </div>
    </div>
  );
}

export default OfficeFallbackViewer;
