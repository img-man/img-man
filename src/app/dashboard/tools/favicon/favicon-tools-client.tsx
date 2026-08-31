// SPDX-License-Identifier: Apache-2.0
'use client';

import { copyText as copyToClipboard } from '@/lib/clipboard';
import type { ChangeEvent, ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Code2,
  Copy,
  Download,
  ExternalLink,
  FileArchive,
  FileCode2,
  FileImage,
  Globe,
  ImagePlus,
  Loader2,
  Palette,
  RefreshCcw,
  Search,
  Sparkles,
  Wand2,
  Zap,
} from 'lucide-react';
import {
  buildAnalysisReport,
  formatBytes as formatAnalysisBytes,
  formatLoadTime,
  type FaviconAnalysisResult,
  type FaviconFetchPayload,
} from '@/lib/favicon-analysis';
import {
  buildFaviconPackage,
  createEmojiSource,
  DEFAULT_FAVICON_PACKAGE_CONFIG,
  downloadBlob,
  fileToDataUrl,
  findPackageFile,
  formatBytes,
  loadImageFromSource,
  sanitizeSvgMarkup,
  slugifyFilename,
  type FrameworkSnippets,
  type GeneratedFaviconPackage,
} from '@/lib/favicon-studio';

type StudioSource = {
  name: string;
  previewUrl: string;
  loadable: File | string;
  origin: 'upload' | 'emoji';
};

type SnippetKey = keyof FrameworkSnippets;

const SNIPPET_OPTIONS: Array<{ key: SnippetKey; label: string }> = [
  { key: 'nextjs', label: 'Next.js' },
  { key: 'html5', label: 'HTML5' },
  { key: 'react', label: 'React' },
  { key: 'vue', label: 'Vue' },
  { key: 'wordpress', label: 'WordPress' },
];

type StudioToolFocus = {
  title: string;
  description: string;
  sectionId:
    | 'package-builder'
    | 'fetch-favicons'
    | 'site-analysis'
    | 'emoji-source'
    | 'quick-exports'
    | 'svg-viewer'
    | 'utility-shortcuts';
  ctaHref?: string;
  ctaLabel?: string;
};

const TOOL_FOCUS_CONFIG: Record<string, StudioToolFocus> = {
  'image-to-favicon': {
    title: 'Image to Favicon',
    description:
      'Upload artwork here, then export favicon packages, ICO files, and platform-ready icon assets.',
    sectionId: 'package-builder',
  },
  'emoji-favicon': {
    title: 'Emoji Favicon',
    description:
      'Generate a clean emoji source, then feed it directly into the shared favicon package workflow.',
    sectionId: 'emoji-source',
  },
  'png-to-ico': {
    title: 'PNG to ICO',
    description:
      'Use the current source to produce a favicon.ico file and bundled PNG exports for browsers.',
    sectionId: 'quick-exports',
  },
  'ico-converter': {
    title: 'ICO Converter',
    description:
      'Generate ICO and PNG outputs from one source asset without leaving the shared studio.',
    sectionId: 'quick-exports',
  },
  'favicon-checker': {
    title: 'Favicon Checker',
    description:
      'Audit a live site for missing favicon files, browser coverage, and best-practice gaps.',
    sectionId: 'site-analysis',
  },
  'favicon-analyzer': {
    title: 'Favicon Analyzer',
    description:
      'Review favicon quality, payload, compatibility, and checked assets for any public URL.',
    sectionId: 'site-analysis',
  },
  'seo-checker': {
    title: 'SEO Checker',
    description:
      'Run favicon analysis first to catch missing files and metadata that hurt browser and sharing surfaces.',
    sectionId: 'site-analysis',
  },
  'favicon-extractor': {
    title: 'Favicon Extractor',
    description:
      'Fetch the favicon files a site already exposes and inspect each discovered asset.',
    sectionId: 'fetch-favicons',
  },
  'svg-viewer': {
    title: 'SVG Viewer',
    description:
      'Preview uploaded SVG markup, clean noisy exports, and keep the output ready for favicon packaging.',
    sectionId: 'svg-viewer',
  },
  'svg-to-png': {
    title: 'SVG to PNG',
    description:
      'Upload SVG artwork, then export PNG favicon sizes and install-ready assets from the same source.',
    sectionId: 'svg-viewer',
  },
  'image-to-base64': {
    title: 'Image to Base64',
    description:
      'Reuse the current favicon source as a data URL for docs, embeds, and design-system handoff.',
    sectionId: 'quick-exports',
  },
  'base64-to-image': {
    title: 'Base64 to Image',
    description:
      'Use the shared source data URL and previews to inspect or recover image outputs from generated assets.',
    sectionId: 'quick-exports',
  },
  'android-adaptive-icon': {
    title: 'Android Adaptive Icon',
    description:
      'Build Android-ready icon assets from the package workflow and quick export set.',
    sectionId: 'quick-exports',
  },
  'apple-touch-icon': {
    title: 'Apple Touch Icon',
    description:
      'Export the Apple touch icon directly from the shared package and quick-download workflow.',
    sectionId: 'quick-exports',
  },
  'pwa-generator': {
    title: 'PWA Generator',
    description:
      'Create a manifest-ready icon bundle from one upload and copy the install snippets here.',
    sectionId: 'package-builder',
  },
  'mobile-icons': {
    title: 'Mobile Icons',
    description:
      'Generate mobile-ready icon sizes for homescreen, shortcuts, and install surfaces from the same source.',
    sectionId: 'package-builder',
  },
  'design-system-export': {
    title: 'Design System Export',
    description:
      'Use the snippet and export surfaces here when handing icon assets into broader product systems.',
    sectionId: 'quick-exports',
  },
};

function gradeTone(grade: FaviconAnalysisResult['grade']) {
  switch (grade) {
    case 'A':
      return 'bg-emerald-500/12 text-emerald-300 ring-emerald-500/30';
    case 'B':
      return 'bg-cyan-500/12 text-cyan-300 ring-cyan-500/30';
    case 'C':
      return 'bg-amber-500/12 text-amber-300 ring-amber-500/30';
    case 'D':
      return 'bg-orange-500/12 text-orange-300 ring-orange-500/30';
    default:
      return 'bg-rose-500/12 text-rose-300 ring-rose-500/30';
  }
}

function practiceTone(status: FaviconAnalysisResult['bestPractices'][number]['status']) {
  switch (status) {
    case 'pass':
      return 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/20';
    case 'warning':
      return 'bg-amber-500/10 text-amber-300 ring-amber-500/20';
    case 'fail':
      return 'bg-rose-500/10 text-rose-300 ring-rose-500/20';
    default:
      return 'bg-cyan-500/10 text-cyan-300 ring-cyan-500/20';
  }
}

function PrimaryButton({
  children,
  onClick,
  disabled,
  className = '',
  type = 'button',
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  type?: 'button' | 'submit';
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-xl bg-dash-accent px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    >
      {children}
    </button>
  );
}

function SecondaryButton({
  children,
  onClick,
  disabled,
  className = '',
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-xl border border-dash-border bg-dash-input px-4 py-2.5 text-sm font-medium text-dash-text transition hover:border-dash-accent/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    >
      {children}
    </button>
  );
}

function Card({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-dash-border bg-dash-surface/90 p-5 shadow-[0_18px_50px_rgba(5,10,25,0.18)] backdrop-blur">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-dash-text">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-dash-text2">{description}</p>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-dash-text2">
        {label}
      </span>
      {hint ? <span className="mt-1 block text-xs text-dash-text2">{hint}</span> : null}
      <div className="mt-2">{children}</div>
    </label>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: 'text' | 'url';
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="w-full rounded-xl border border-dash-border bg-dash-input px-3 py-2.5 text-sm text-dash-text outline-none transition focus:border-dash-accent"
    />
  );
}

function TextArea({
  value,
  onChange,
  placeholder,
  rows = 4,
  readOnly = false,
}: {
  value: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  rows?: number;
  readOnly?: boolean;
}) {
  return (
    <textarea
      value={value}
      onChange={(event) => onChange?.(event.target.value)}
      placeholder={placeholder}
      readOnly={readOnly}
      rows={rows}
      className="w-full rounded-2xl border border-dash-border bg-dash-input px-3 py-2.5 text-sm leading-6 text-dash-text outline-none transition focus:border-dash-accent"
    />
  );
}

function StatusMessage({
  tone,
  children,
}: {
  tone: 'error' | 'success' | 'info';
  children: ReactNode;
}) {
  const toneClass =
    tone === 'error'
      ? 'border-rose-500/25 bg-rose-500/10 text-rose-200'
      : tone === 'success'
        ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-200'
        : 'border-cyan-500/25 bg-cyan-500/10 text-cyan-200';

  return (
    <div className={`rounded-2xl border px-4 py-3 text-sm ${toneClass}`}>{children}</div>
  );
}

export default function FaviconToolsClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [source, setSource] = useState<StudioSource | null>(null);
  const [packageConfig, setPackageConfig] = useState(DEFAULT_FAVICON_PACKAGE_CONFIG);
  const [packageResult, setPackageResult] = useState<GeneratedFaviconPackage | null>(null);
  const [packageError, setPackageError] = useState('');
  const [packageBusy, setPackageBusy] = useState(false);
  const [snippetKey, setSnippetKey] = useState<SnippetKey>('nextjs');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [fetchUrl, setFetchUrl] = useState('https://github.com');
  const [fetchBusy, setFetchBusy] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [fetchResult, setFetchResult] = useState<FaviconFetchPayload | null>(null);

  const [analysisUrl, setAnalysisUrl] = useState('https://github.com');
  const [analysisBusy, setAnalysisBusy] = useState(false);
  const [analysisError, setAnalysisError] = useState('');
  const [analysisResult, setAnalysisResult] = useState<FaviconAnalysisResult | null>(null);

  const [emoji, setEmoji] = useState('🚀');
  const [emojiBackground, setEmojiBackground] = useState('#111827');
  const [emojiPadding, setEmojiPadding] = useState('12');
  const [emojiBusy, setEmojiBusy] = useState(false);
  const [emojiError, setEmojiError] = useState('');

  const [base64Value, setBase64Value] = useState('');
  const [svgMarkup, setSvgMarkup] = useState('');
  const [cleanSvg, setCleanSvg] = useState('');
  const [svgFileName, setSvgFileName] = useState('');

  const focusedToolKey = searchParams.get('tool');
  const focusedTool = focusedToolKey ? TOOL_FOCUS_CONFIG[focusedToolKey] ?? null : null;

  const copyText = async (text: string, key: string) => {
    await copyToClipboard(text);
    setCopiedId(key);
    window.setTimeout(() => {
      setCopiedId((current) => (current === key ? null : current));
    }, 1800);
  };

  const applySource = (nextSource: StudioSource) => {
    setSource(nextSource);
    setBase64Value(nextSource.previewUrl);
    setPackageError('');
    setPackageResult(null);
  };

  const handleSourceUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const previewUrl = await fileToDataUrl(file);
    applySource({
      name: file.name,
      previewUrl,
      loadable: file,
      origin: 'upload',
    });
  };

  const ensurePackage = async () => {
    if (packageResult) {
      return packageResult;
    }

    if (!source) {
      throw new Error('Upload a source image or generate one from emoji first.');
    }

    const loadedImage = await loadImageFromSource(source.loadable);
    const nextPackage = await buildFaviconPackage(loadedImage, {
      ...packageConfig,
      appName:
        packageConfig.appName.trim() || source.name.replace(/\.[^.]+$/, '') || 'img-man App',
    });
    setPackageResult(nextPackage);
    return nextPackage;
  };

  const handleBuildPackage = async () => {
    try {
      setPackageBusy(true);
      setPackageError('');
      await ensurePackage();
    } catch (error) {
      setPackageError(
        error instanceof Error ? error.message : 'Failed to build favicon package.',
      );
    } finally {
      setPackageBusy(false);
    }
  };

  const handleQuickDownload = async (fileName: string) => {
    try {
      const pkg = await ensurePackage();
      const file = findPackageFile(pkg, fileName);
      if (!file) {
        throw new Error(`Missing ${fileName} in generated package.`);
      }

      downloadBlob(file.blob, file.name);
    } catch (error) {
      setPackageError(
        error instanceof Error ? error.message : 'Failed to prepare requested file.',
      );
    }
  };

  const handleDownloadZip = async () => {
    try {
      const pkg = await ensurePackage();
      const label = slugifyFilename(
        packageConfig.appName || source?.name.replace(/\.[^.]+$/, '') || 'favicon-package',
      );
      downloadBlob(pkg.zipBlob, `${label}-favicons.zip`);
    } catch (error) {
      setPackageError(
        error instanceof Error ? error.message : 'Failed to download favicon package.',
      );
    }
  };

  const handleFetchFavicons = async () => {
    try {
      setFetchBusy(true);
      setFetchError('');
      setFetchResult(null);

      const response = await fetch(`/api/favicon/fetch?url=${encodeURIComponent(fetchUrl)}`);
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to fetch favicons.');
      }

      setFetchResult(payload.data as FaviconFetchPayload);
    } catch (error) {
      setFetchError(error instanceof Error ? error.message : 'Failed to fetch favicons.');
    } finally {
      setFetchBusy(false);
    }
  };

  const handleAnalyze = async () => {
    try {
      setAnalysisBusy(true);
      setAnalysisError('');
      setAnalysisResult(null);

      const response = await fetch('/api/favicon/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: analysisUrl }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Analysis failed.');
      }

      setAnalysisResult(payload as FaviconAnalysisResult);
    } catch (error) {
      setAnalysisError(error instanceof Error ? error.message : 'Analysis failed.');
    } finally {
      setAnalysisBusy(false);
    }
  };

  const handleEmojiSource = async () => {
    try {
      setEmojiBusy(true);
      setEmojiError('');
      const emojiAsset = await createEmojiSource(
        emoji || '✨',
        512,
        emojiBackground,
        Number.parseInt(emojiPadding || '12', 10),
      );
      applySource({
        name: `emoji-${slugifyFilename(emoji || 'icon')}.png`,
        previewUrl: emojiAsset.dataUrl,
        loadable: emojiAsset.dataUrl,
        origin: 'emoji',
      });
    } catch (error) {
      setEmojiError(
        error instanceof Error ? error.message : 'Failed to build emoji source.',
      );
    } finally {
      setEmojiBusy(false);
    }
  };

  const handleSvgUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const markup = await file.text();
    setSvgFileName(file.name);
    setSvgMarkup(markup);
    setCleanSvg(sanitizeSvgMarkup(markup));
  };

  const downloadAnalysis = async (format: 'json' | 'txt') => {
    if (!analysisResult) {
      return;
    }

    const hostname = new URL(analysisResult.url).hostname;
    const fileBase = `favicon-analysis-${slugifyFilename(hostname)}`;
    if (format === 'json') {
      downloadBlob(
        new Blob([JSON.stringify(analysisResult, null, 2)], {
          type: 'application/json',
        }),
        `${fileBase}.json`,
      );
      return;
    }

    downloadBlob(
      new Blob([buildAnalysisReport(analysisResult)], { type: 'text/plain' }),
      `${fileBase}.txt`,
    );
  };

  const cleanedSvgPreview = cleanSvg
    ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(cleanSvg)}`
    : '';

  const activeSnippet = packageResult?.snippets[snippetKey] ?? '';

  const scrollToSection = (sectionId: StudioToolFocus['sectionId']) => {
    document.getElementById(sectionId)?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  };

  useEffect(() => {
    if (!focusedTool) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      scrollToSection(focusedTool.sectionId);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [focusedTool]);

  return (
    <div className="p-6">
      <div className="relative overflow-hidden rounded-[28px] border border-dash-border bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.18),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.14),transparent_34%),linear-gradient(180deg,rgba(15,23,42,0.78),rgba(15,23,42,0.94))] p-6 shadow-[0_30px_80px_rgba(5,10,25,0.24)]">
        <div className="absolute inset-0 bg-[linear-gradient(135deg,transparent_0%,rgba(255,255,255,0.02)_42%,transparent_100%)]" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.22em] text-cyan-200">
              <Sparkles className="h-3.5 w-3.5" />
              Favicon Studio
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white">
              Generate packages, inspect live sites, and ship icons from one surface.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
              This studio folds the favicon repo into img-man-native tooling: package export,
              PNG and ICO outputs, emoji source generation, remote site fetching, analysis,
              SVG cleanup, and implementation snippets.
            </p>
            {focusedTool ? (
              <div className="mt-5 rounded-[24px] border border-cyan-400/20 bg-slate-950/35 p-4 backdrop-blur">
                <div className="text-xs uppercase tracking-[0.22em] text-cyan-200">
                  Focused tool
                </div>
                <div className="mt-2 text-lg font-semibold text-white">{focusedTool.title}</div>
                <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-300">
                  {focusedTool.description}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <SecondaryButton
                    onClick={() => scrollToSection(focusedTool.sectionId)}
                    className="border-white/10 bg-white/5 text-slate-100 hover:border-cyan-400/40"
                  >
                    <ArrowRight className="h-4 w-4" />
                    Jump to section
                  </SecondaryButton>
                </div>
              </div>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Package</div>
              <div className="mt-1 text-sm font-semibold text-white">ZIP + ICO + manifest</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Inspect</div>
              <div className="mt-1 text-sm font-semibold text-white">Fetch + analyze live sites</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Utility</div>
              <div className="mt-1 text-sm font-semibold text-white">Emoji, SVG, base64 exports</div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <div className="space-y-6">
          <div id="package-builder" className="scroll-mt-24">
            <Card
              title="1. Build deployment-ready favicon packages"
              description="Upload a source image or use the emoji generator, then export a complete bundle with browser icons, manifest files, and framework snippets."
              action={
                <PrimaryButton onClick={handleBuildPackage} disabled={packageBusy || !source}>
                  {packageBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileArchive className="h-4 w-4" />}
                  Generate package
                </PrimaryButton>
              }
            >
            <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="space-y-4">
                <Field
                  label="Source artwork"
                  hint="PNG, JPG, WEBP, SVG, or ICO work well here."
                >
                  <label className="flex cursor-pointer flex-col items-center justify-center rounded-[22px] border border-dashed border-dash-border bg-dash-panel/50 px-4 py-8 text-center transition hover:border-dash-accent/50">
                    <ImagePlus className="h-7 w-7 text-dash-accent" />
                    <span className="mt-3 text-sm font-medium text-dash-text">
                      Upload source image
                    </span>
                    <span className="mt-1 text-xs text-dash-text2">
                      Square art with transparent padding produces the cleanest small icons.
                    </span>
                    <input
                      type="file"
                      accept="image/*,.svg,.ico"
                      onChange={handleSourceUpload}
                      className="hidden"
                    />
                  </label>
                </Field>

                {source ? (
                  <div className="flex items-center gap-4 rounded-2xl border border-dash-border bg-dash-panel/60 p-4">
                    <img
                      src={source.previewUrl}
                      alt={source.name}
                      className="h-20 w-20 rounded-2xl border border-dash-border bg-white/90 object-contain p-2"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-dash-text">{source.name}</div>
                      <div className="mt-1 text-xs text-dash-text2">
                        Source origin: {source.origin === 'emoji' ? 'Emoji generator' : 'File upload'}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <SecondaryButton onClick={() => setPackageResult(null)} className="px-3 py-2 text-xs">
                          <RefreshCcw className="h-3.5 w-3.5" />
                          Reset exports
                        </SecondaryButton>
                        <SecondaryButton onClick={() => copyText(source.previewUrl, 'source-base64')} className="px-3 py-2 text-xs">
                          {copiedId === 'source-base64' ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                          Copy data URL
                        </SecondaryButton>
                      </div>
                    </div>
                  </div>
                ) : (
                  <StatusMessage tone="info">
                    Upload a logo mark, glyph, or symbol first. The package generator and quick export actions reuse that source across the whole studio.
                  </StatusMessage>
                )}

                {packageError ? <StatusMessage tone="error">{packageError}</StatusMessage> : null}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="App name">
                  <TextInput
                    value={packageConfig.appName}
                    onChange={(value) => setPackageConfig((current) => ({ ...current, appName: value }))}
                    placeholder="img-man"
                  />
                </Field>
                <Field label="Short name">
                  <TextInput
                    value={packageConfig.shortName || ''}
                    onChange={(value) => setPackageConfig((current) => ({ ...current, shortName: value }))}
                    placeholder="img-man"
                  />
                </Field>
                <Field label="Theme color">
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={packageConfig.themeColor}
                      onChange={(event) =>
                        setPackageConfig((current) => ({ ...current, themeColor: event.target.value }))
                      }
                      className="h-11 w-12 rounded-xl border border-dash-border bg-transparent"
                    />
                    <TextInput
                      value={packageConfig.themeColor || ''}
                      onChange={(value) => setPackageConfig((current) => ({ ...current, themeColor: value }))}
                    />
                  </div>
                </Field>
                <Field label="Background color">
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={packageConfig.backgroundColor}
                      onChange={(event) =>
                        setPackageConfig((current) => ({ ...current, backgroundColor: event.target.value }))
                      }
                      className="h-11 w-12 rounded-xl border border-dash-border bg-transparent"
                    />
                    <TextInput
                      value={packageConfig.backgroundColor || ''}
                      onChange={(value) =>
                        setPackageConfig((current) => ({ ...current, backgroundColor: value }))
                      }
                    />
                  </div>
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Description">
                    <TextArea
                      value={packageConfig.description || ''}
                      onChange={(value) =>
                        setPackageConfig((current) => ({ ...current, description: value }))
                      }
                      placeholder="Asset manager and design studio"
                      rows={3}
                    />
                  </Field>
                </div>
                <Field label="Start URL">
                  <TextInput
                    type="url"
                    value={packageConfig.startUrl || ''}
                    onChange={(value) => setPackageConfig((current) => ({ ...current, startUrl: value }))}
                    placeholder="/"
                  />
                </Field>
                <Field label="Apple status bar">
                  <select
                    value={packageConfig.appleStatusBarStyle}
                    onChange={(event) =>
                      setPackageConfig((current) => ({
                        ...current,
                        appleStatusBarStyle: event.target.value as typeof current.appleStatusBarStyle,
                      }))
                    }
                    className="w-full rounded-xl border border-dash-border bg-dash-input px-3 py-2.5 text-sm text-dash-text outline-none"
                  >
                    <option value="default">default</option>
                    <option value="black">black</option>
                    <option value="black-translucent">black-translucent</option>
                  </select>
                </Field>
              </div>
            </div>

            {packageResult ? (
              <div className="mt-6 space-y-5">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="rounded-2xl border border-dash-border bg-dash-panel/60 p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-dash-text2">Artifacts</div>
                    <div className="mt-2 text-2xl font-semibold text-dash-text">
                      {packageResult.stats.totalFiles}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-dash-border bg-dash-panel/60 p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-dash-text2">Package size</div>
                    <div className="mt-2 text-2xl font-semibold text-dash-text">
                      {packageResult.stats.formattedSize}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-dash-border bg-dash-panel/60 p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-dash-text2">Manifest icons</div>
                    <div className="mt-2 text-2xl font-semibold text-dash-text">
                      {packageResult.manifest.icons.length}
                    </div>
                  </div>
                </div>

                <div>
                  <div className="mb-3 text-sm font-semibold text-dash-text">Preview matrix</div>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                    {packageResult.previews.map((preview) => (
                      <div
                        key={preview.name}
                        className="rounded-2xl border border-dash-border bg-dash-panel/60 p-4"
                      >
                        <div className="flex aspect-square items-center justify-center rounded-2xl border border-dash-border bg-white/95 p-4">
                          <img src={preview.dataUrl} alt={preview.name} className="max-h-full max-w-full object-contain" />
                        </div>
                        <div className="mt-3 text-sm font-medium text-dash-text">{preview.name}</div>
                        <div className="mt-1 text-xs uppercase tracking-[0.16em] text-dash-text2">
                          {preview.width}x{preview.height} {preview.purpose}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
            </Card>
          </div>

          <div id="fetch-favicons" className="scroll-mt-24">
            <Card
              title="2. Fetch favicon assets from live sites"
              description="Pull the favicon sources a site already exposes. Useful for audits, migrations, and reverse-engineering markup."
            >
            <div className="flex flex-col gap-3 md:flex-row">
              <div className="flex-1">
                <TextInput value={fetchUrl} onChange={setFetchUrl} type="url" placeholder="https://example.com" />
              </div>
              <PrimaryButton onClick={handleFetchFavicons} disabled={fetchBusy}>
                {fetchBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
                Fetch icons
              </PrimaryButton>
            </div>

            {fetchError ? <div className="mt-4"><StatusMessage tone="error">{fetchError}</StatusMessage></div> : null}

            {fetchResult ? (
              <div className="mt-5 space-y-4">
                <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.16em] text-dash-text2">
                  <span>{fetchResult.domain}</span>
                  <span>{fetchResult.favicons.length} assets fetched</span>
                  <span>{fetchResult.totalFound} candidates scanned</span>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {fetchResult.favicons.map((favicon) => (
                    <div key={favicon.url} className="rounded-2xl border border-dash-border bg-dash-panel/60 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-dash-border bg-white/95 p-2">
                          <img src={favicon.dataUrl} alt={favicon.url} className="max-h-full max-w-full object-contain" />
                        </div>
                        <span className="rounded-full border border-dash-border px-2.5 py-1 text-[11px] uppercase tracking-[0.16em] text-dash-text2">
                          {favicon.source}
                        </span>
                      </div>
                      <div className="mt-4 text-sm font-semibold text-dash-text break-all">{favicon.url}</div>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-dash-text2">
                        <span>{favicon.type}</span>
                        <span>{favicon.sizes || 'size unknown'}</span>
                        <span>{formatAnalysisBytes(favicon.sizeBytes)}</span>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <SecondaryButton onClick={() => downloadBlob(new Blob([favicon.dataUrl], { type: 'text/plain' }), `${slugifyFilename(fetchResult.domain)}-favicon-url.txt`)} className="px-3 py-2 text-xs">
                          <FileCode2 className="h-3.5 w-3.5" />
                          Save data URL
                        </SecondaryButton>
                        <SecondaryButton onClick={() => copyText(favicon.url, favicon.url)} className="px-3 py-2 text-xs">
                          {copiedId === favicon.url ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                          Copy URL
                        </SecondaryButton>
                        <a
                          href={favicon.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 rounded-xl border border-dash-border bg-dash-input px-3 py-2 text-xs font-medium text-dash-text transition hover:border-dash-accent/40 hover:text-white"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          Open
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            </Card>
          </div>

          <div id="site-analysis" className="scroll-mt-24">
            <Card
              title="3. Analyze a site's favicon implementation"
              description="Run best-practice checks across common favicon paths, then export the report as JSON or plain text."
            >
            <div className="flex flex-col gap-3 md:flex-row">
              <div className="flex-1">
                <TextInput value={analysisUrl} onChange={setAnalysisUrl} type="url" placeholder="https://example.com" />
              </div>
              <PrimaryButton onClick={handleAnalyze} disabled={analysisBusy}>
                {analysisBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Analyze site
              </PrimaryButton>
            </div>

            {analysisError ? <div className="mt-4"><StatusMessage tone="error">{analysisError}</StatusMessage></div> : null}

            {analysisResult ? (
              <div className="mt-5 space-y-5">
                <div className="grid gap-4 lg:grid-cols-[0.88fr_1.12fr]">
                  <div className="rounded-3xl border border-dash-border bg-dash-panel/60 p-5">
                    <div className="text-xs uppercase tracking-[0.18em] text-dash-text2">Overall score</div>
                    <div className="mt-4 flex items-end gap-4">
                      <div className={`inline-flex h-20 w-20 items-center justify-center rounded-full ring-1 ${gradeTone(analysisResult.grade)}`}>
                        <span className="text-3xl font-semibold">{analysisResult.grade}</span>
                      </div>
                      <div>
                        <div className="text-3xl font-semibold text-dash-text">{analysisResult.score}</div>
                        <div className="text-sm text-dash-text2">out of 100</div>
                      </div>
                    </div>
                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-dash-border bg-dash-surface px-4 py-3">
                        <div className="text-xs uppercase tracking-[0.18em] text-dash-text2">Payload</div>
                        <div className="mt-2 text-lg font-semibold text-dash-text">
                          {formatAnalysisBytes(analysisResult.performance.totalFileSize)}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-dash-border bg-dash-surface px-4 py-3">
                        <div className="text-xs uppercase tracking-[0.18em] text-dash-text2">Avg. load</div>
                        <div className="mt-2 text-lg font-semibold text-dash-text">
                          {formatLoadTime(analysisResult.performance.averageLoadTime)}
                        </div>
                      </div>
                    </div>
                    <div className="mt-5 flex flex-wrap gap-2">
                      <SecondaryButton onClick={() => downloadAnalysis('json')} className="px-3 py-2 text-xs">
                        <Download className="h-3.5 w-3.5" />
                        Download JSON
                      </SecondaryButton>
                      <SecondaryButton onClick={() => downloadAnalysis('txt')} className="px-3 py-2 text-xs">
                        <FileCode2 className="h-3.5 w-3.5" />
                        Download text report
                      </SecondaryButton>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-3xl border border-dash-border bg-dash-panel/60 p-5">
                      <div className="text-sm font-semibold text-dash-text">Best-practice checks</div>
                      <div className="mt-4 space-y-3">
                        {analysisResult.bestPractices.map((practice) => (
                          <div key={practice.id} className="rounded-2xl border border-dash-border bg-dash-surface p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="text-sm font-medium text-dash-text">{practice.title}</div>
                                <div className="mt-1 text-sm text-dash-text2">{practice.description}</div>
                              </div>
                              <span className={`rounded-full px-2.5 py-1 text-[11px] uppercase tracking-[0.16em] ring-1 ${practiceTone(practice.status)}`}>
                                {practice.status}
                              </span>
                            </div>
                            {practice.recommendation ? (
                              <div className="mt-3 text-xs leading-6 text-dash-text2">
                                Recommendation: {practice.recommendation}
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-3xl border border-dash-border bg-dash-panel/60 p-5">
                    <div className="text-sm font-semibold text-dash-text">Browser compatibility</div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      {analysisResult.compatibility.map((entry) => (
                        <div key={entry.browser} className="rounded-2xl border border-dash-border bg-dash-surface p-4">
                          <div className="flex items-center gap-3">
                            <span className="inline-flex h-10 min-w-10 items-center justify-center rounded-xl border border-dash-border bg-dash-input px-2 text-xs font-semibold text-dash-text">
                              {entry.icon}
                            </span>
                            <div>
                              <div className="text-sm font-medium text-dash-text">{entry.browser}</div>
                              <div className="text-xs text-dash-text2">{entry.supported ? 'Supported by current matrix' : 'Missing required asset'}</div>
                            </div>
                          </div>
                          {entry.notes ? <div className="mt-3 text-xs leading-6 text-dash-text2">{entry.notes}</div> : null}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-3xl border border-dash-border bg-dash-panel/60 p-5">
                    <div className="text-sm font-semibold text-dash-text">Checked files</div>
                    <div className="mt-4 space-y-3">
                      {analysisResult.files.map((file) => (
                        <div key={file.url} className="rounded-2xl border border-dash-border bg-dash-surface p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-medium text-dash-text break-all">{file.url}</div>
                              <div className="mt-1 flex flex-wrap gap-2 text-xs text-dash-text2">
                                <span>{file.type}</span>
                                {typeof file.fileSize === 'number' ? <span>{formatAnalysisBytes(file.fileSize)}</span> : null}
                                {typeof file.loadTime === 'number' ? <span>{formatLoadTime(file.loadTime)}</span> : null}
                              </div>
                            </div>
                            <span className={`rounded-full px-2.5 py-1 text-[11px] uppercase tracking-[0.16em] ring-1 ${file.exists ? practiceTone('pass') : practiceTone('fail')}`}>
                              {file.exists ? 'found' : 'missing'}
                            </span>
                          </div>
                          {file.error ? <div className="mt-3 text-xs text-dash-text2">{file.error}</div> : null}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
            </Card>
          </div>
        </div>

        <div className="space-y-6">
          <div id="emoji-source" className="scroll-mt-24">
            <Card
              title="Emoji favicon source"
              description="Generate a clean source icon from a single emoji, then feed it into the package builder."
              action={
                <PrimaryButton onClick={handleEmojiSource} disabled={emojiBusy}>
                  {emojiBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                  Use emoji source
                </PrimaryButton>
              }
            >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Emoji">
                <TextInput value={emoji} onChange={setEmoji} placeholder="✨" />
              </Field>
              <Field label="Padding %">
                <TextInput value={emojiPadding} onChange={setEmojiPadding} placeholder="12" />
              </Field>
              <Field label="Background">
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={emojiBackground}
                    onChange={(event) => setEmojiBackground(event.target.value)}
                    className="h-11 w-12 rounded-xl border border-dash-border bg-transparent"
                  />
                  <TextInput value={emojiBackground} onChange={setEmojiBackground} />
                </div>
              </Field>
              <div className="rounded-2xl border border-dash-border bg-dash-panel/60 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-dash-text2">Use case</div>
                <div className="mt-2 text-sm leading-6 text-dash-text2">
                  Handy for docs sites, internal tools, prototypes, and installation surfaces that only need a clean glyph.
                </div>
              </div>
            </div>
            {emojiError ? <div className="mt-4"><StatusMessage tone="error">{emojiError}</StatusMessage></div> : null}
            </Card>
          </div>

          <div id="quick-exports" className="scroll-mt-24">
            <Card
              title="Quick exports, snippets, and base64"
              description="Use the current source to download common files fast, copy framework snippets, and reuse the source as a data URL."
              action={
                <SecondaryButton onClick={handleDownloadZip} disabled={!source}>
                  <Download className="h-4 w-4" />
                  Download ZIP
                </SecondaryButton>
              }
            >
            <div className="grid gap-3 sm:grid-cols-2">
              <SecondaryButton onClick={() => handleQuickDownload('favicon.ico')} disabled={!source}>
                <FileImage className="h-4 w-4" />
                favicon.ico
              </SecondaryButton>
              <SecondaryButton onClick={() => handleQuickDownload('favicon-32x32.png')} disabled={!source}>
                <FileImage className="h-4 w-4" />
                favicon-32x32.png
              </SecondaryButton>
              <SecondaryButton onClick={() => handleQuickDownload('apple-touch-icon.png')} disabled={!source}>
                <Palette className="h-4 w-4" />
                Apple touch icon
              </SecondaryButton>
              <SecondaryButton onClick={() => handleQuickDownload('android-chrome-512x512.png')} disabled={!source}>
                <Zap className="h-4 w-4" />
                Android 512
              </SecondaryButton>
            </div>

            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-dash-text">Source data URL</div>
                <SecondaryButton onClick={() => copyText(base64Value, 'base64')} disabled={!base64Value} className="px-3 py-2 text-xs">
                  {copiedId === 'base64' ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  Copy base64
                </SecondaryButton>
              </div>
              <TextArea value={base64Value} rows={7} readOnly placeholder="Upload or generate a source to populate this data URL." />
            </div>

            <div className="mt-5">
              <div className="mb-3 text-sm font-semibold text-dash-text">Implementation snippets</div>
              <div className="flex flex-wrap gap-2">
                {SNIPPET_OPTIONS.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setSnippetKey(option.key)}
                    className={`rounded-full px-3 py-2 text-xs font-medium transition ${snippetKey === option.key ? 'bg-dash-accent text-white' : 'border border-dash-border bg-dash-input text-dash-text2 hover:text-dash-text'}`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <div className="mt-4 rounded-3xl border border-dash-border bg-[#0b1220] p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-400">{snippetKey}</div>
                  <SecondaryButton onClick={() => copyText(activeSnippet, `snippet-${snippetKey}`)} disabled={!activeSnippet} className="px-3 py-2 text-xs">
                    {copiedId === `snippet-${snippetKey}` ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Code2 className="h-3.5 w-3.5" />}
                    Copy snippet
                  </SecondaryButton>
                </div>
                <pre className="overflow-x-auto whitespace-pre-wrap break-words text-xs leading-6 text-slate-200">
                  {activeSnippet || 'Generate a package first to populate framework-specific favicon code.'}
                </pre>
              </div>
            </div>
            </Card>
          </div>

          <div id="svg-viewer" className="scroll-mt-24">
            <Card
              title="SVG viewer and cleaner"
              description="Inspect uploaded SVG markup, remove common export noise, and download the cleaned result."
            >
            <label className="flex cursor-pointer items-center justify-center gap-3 rounded-2xl border border-dashed border-dash-border bg-dash-panel/50 px-4 py-4 text-sm text-dash-text hover:border-dash-accent/40">
              <FileCode2 className="h-4 w-4" />
              Upload SVG
              <input type="file" accept=".svg,image/svg+xml" onChange={handleSvgUpload} className="hidden" />
            </label>

            {cleanSvg ? (
              <div className="mt-5 space-y-4">
                <div className="flex aspect-[16/10] items-center justify-center rounded-3xl border border-dash-border bg-white/95 p-6">
                  <img src={cleanedSvgPreview} alt="Cleaned SVG preview" className="max-h-full max-w-full object-contain" />
                </div>
                <div className="flex flex-wrap gap-2">
                  <SecondaryButton onClick={() => copyText(cleanSvg, 'svg-clean')} className="px-3 py-2 text-xs">
                    {copiedId === 'svg-clean' ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    Copy cleaned SVG
                  </SecondaryButton>
                  <SecondaryButton
                    onClick={() =>
                      downloadBlob(
                        new Blob([cleanSvg], { type: 'image/svg+xml' }),
                        `${slugifyFilename(svgFileName || 'favicon')}-cleaned.svg`,
                      )
                    }
                    className="px-3 py-2 text-xs"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download cleaned SVG
                  </SecondaryButton>
                </div>
                <div className="grid gap-4 xl:grid-cols-2">
                  <div>
                    <div className="mb-2 text-xs uppercase tracking-[0.18em] text-dash-text2">Original</div>
                    <TextArea value={svgMarkup} rows={10} readOnly />
                  </div>
                  <div>
                    <div className="mb-2 text-xs uppercase tracking-[0.18em] text-dash-text2">Cleaned</div>
                    <TextArea value={cleanSvg} rows={10} readOnly />
                  </div>
                </div>
              </div>
            ) : null}
            </Card>
          </div>

          <div id="utility-shortcuts" className="scroll-mt-24">
            <Card
              title="img-man utility shortcuts"
              description="The favicon repo also included generic image tools. Those already exist in img-man, so this studio links back to the native surfaces instead of duplicating them."
            >
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => router.push('/dashboard/ai')}
                className="group rounded-2xl border border-dash-border bg-dash-panel/60 p-4 text-left transition hover:border-dash-accent/40"
              >
                <div className="flex items-center gap-3 text-dash-text">
                  <Sparkles className="h-5 w-5 text-dash-accent" />
                  <span className="font-medium">AI icon generation</span>
                </div>
                <p className="mt-2 text-sm leading-6 text-dash-text2">
                  Use img-man AI Studio when you need prompt-based icon or logo creation before packaging.
                </p>
                <div className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-dash-accent">
                  Open AI Studio
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                </div>
              </button>

              <button
                type="button"
                onClick={() => router.push('/dashboard/tools')}
                className="group rounded-2xl border border-dash-border bg-dash-panel/60 p-4 text-left transition hover:border-dash-accent/40"
              >
                <div className="flex items-center gap-3 text-dash-text">
                  <FileImage className="h-5 w-5 text-dash-accent" />
                  <span className="font-medium">Resizer, vectorize, and conversions</span>
                </div>
                <p className="mt-2 text-sm leading-6 text-dash-text2">
                  img-man already ships the generic image utilities the favicon repo used for resizing and vector flows.
                </p>
                <div className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-dash-accent">
                  Open Tools Hub
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                </div>
              </button>
            </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}