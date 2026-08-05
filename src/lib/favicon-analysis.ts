// SPDX-License-Identifier: Apache-2.0

export type FaviconFileType =
  | 'ico'
  | 'png'
  | 'svg'
  | 'apple-touch'
  | 'manifest'
  | 'browserconfig'
  | 'unknown';

export interface FaviconFileCheck {
  url: string;
  type: FaviconFileType;
  size?: { width: number; height: number };
  fileSize?: number;
  contentType?: string;
  loadTime?: number;
  exists: boolean;
  error?: string;
}

export interface FaviconPerformanceMetrics {
  totalLoadTime: number;
  totalFileSize: number;
  averageLoadTime: number;
  largestFile: { url: string; size: number } | null;
  slowestFile: { url: string; time: number } | null;
}

export interface FaviconCompatibilityCheck {
  browser: string;
  supported: boolean;
  icon: string;
  notes?: string;
}

export interface FaviconBestPractice {
  id: string;
  title: string;
  description: string;
  status: 'pass' | 'fail' | 'warning' | 'info';
  recommendation?: string;
}

export interface FaviconAnalysisResult {
  url: string;
  timestamp: string;
  files: FaviconFileCheck[];
  performance: FaviconPerformanceMetrics;
  compatibility: FaviconCompatibilityCheck[];
  bestPractices: FaviconBestPractice[];
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
}

export interface FaviconLinkReference {
  url: string;
  type: string;
  sizes?: string;
  rel?: string;
  source: 'markup' | 'default' | 'service';
}

export interface FetchedFaviconAsset extends FaviconLinkReference {
  dataUrl: string;
  sizeBytes: number;
}

export interface FaviconFetchPayload {
  sourceUrl: string;
  domain: string;
  favicons: FetchedFaviconAsset[];
  totalFound: number;
  fetchedAt: string;
}

const FAVICON_PATHS: Array<{ path: string; type: FaviconFileType }> = [
  { path: '/favicon.ico', type: 'ico' },
  { path: '/favicon.png', type: 'png' },
  { path: '/favicon.svg', type: 'svg' },
  { path: '/favicon-16x16.png', type: 'png' },
  { path: '/favicon-32x32.png', type: 'png' },
  { path: '/favicon-48x48.png', type: 'png' },
  { path: '/apple-touch-icon.png', type: 'apple-touch' },
  { path: '/apple-touch-icon-180x180.png', type: 'apple-touch' },
  { path: '/apple-touch-icon-precomposed.png', type: 'apple-touch' },
  { path: '/android-chrome-192x192.png', type: 'png' },
  { path: '/android-chrome-512x512.png', type: 'png' },
  { path: '/android-chrome-maskable-192x192.png', type: 'png' },
  { path: '/android-chrome-maskable-512x512.png', type: 'png' },
  { path: '/site.webmanifest', type: 'manifest' },
  { path: '/manifest.json', type: 'manifest' },
  { path: '/browserconfig.xml', type: 'browserconfig' },
  { path: '/mstile-150x150.png', type: 'png' },
];

const BROWSER_COMPATIBILITY: FaviconCompatibilityCheck[] = [
  { browser: 'Chrome', supported: true, icon: 'C', notes: 'Full support for ICO, PNG, SVG, and manifest icons.' },
  { browser: 'Firefox', supported: true, icon: 'F', notes: 'Supports ICO, PNG, and SVG favicon sources.' },
  { browser: 'Safari', supported: true, icon: 'S', notes: 'Prefers apple-touch-icon for install surfaces.' },
  { browser: 'Edge', supported: true, icon: 'E', notes: 'Supports modern favicon and PWA metadata.' },
  { browser: 'iOS Safari', supported: true, icon: 'iOS', notes: 'Requires apple-touch-icon for home screen quality.' },
  { browser: 'Android Chrome', supported: true, icon: 'A', notes: 'Uses manifest icons for install prompts.' },
  { browser: 'IE 11', supported: false, icon: 'IE', notes: 'Needs favicon.ico for legacy compatibility.' },
];

function inferSizeFromPath(pathOrSizes: string): { width: number; height: number } | undefined {
  const match = pathOrSizes.match(/(\d+)x(\d+)/i);
  if (!match) {
    return undefined;
  }

  return {
    width: Number.parseInt(match[1], 10),
    height: Number.parseInt(match[2], 10),
  };
}

function inferMimeType(url: string, fallback = 'image/png'): string {
  const normalizedUrl = url.toLowerCase();

  if (normalizedUrl.endsWith('.ico')) {
    return 'image/x-icon';
  }

  if (normalizedUrl.endsWith('.svg')) {
    return 'image/svg+xml';
  }

  if (normalizedUrl.endsWith('.webp')) {
    return 'image/webp';
  }

  if (normalizedUrl.endsWith('.jpg') || normalizedUrl.endsWith('.jpeg')) {
    return 'image/jpeg';
  }

  return fallback;
}

function getAttributeValue(tag: string, attribute: string): string | undefined {
  const match = tag.match(new RegExp(`${attribute}=["']([^"']+)["']`, 'i'));
  return match?.[1];
}

function createUserAgentHeader() {
  return {
    'User-Agent': 'img-man-Favicon-Studio/1.0',
  };
}

export function normalizeWebsiteUrl(value: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new Error('URL is required');
  }

  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(withProtocol);
  } catch {
    throw new Error('Invalid URL format');
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new Error('Only http and https URLs are supported');
  }

  return parsedUrl.toString();
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 B';
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function formatLoadTime(milliseconds: number): string {
  if (!Number.isFinite(milliseconds) || milliseconds <= 0) {
    return '0 ms';
  }

  if (milliseconds < 1000) {
    return `${Math.round(milliseconds)} ms`;
  }

  return `${(milliseconds / 1000).toFixed(2)} s`;
}

export function extractIconLinksFromHtml(
  html: string,
  sourceUrl: string,
): FaviconLinkReference[] {
  const linkTags = html.match(/<link\b[^>]*>/gi) ?? [];
  const discovered: FaviconLinkReference[] = [];

  for (const linkTag of linkTags) {
    const rel = getAttributeValue(linkTag, 'rel')?.toLowerCase();
    if (!rel || !rel.includes('icon')) {
      continue;
    }

    const href = getAttributeValue(linkTag, 'href');
    if (!href) {
      continue;
    }

    let absoluteUrl: string;
    try {
      absoluteUrl = new URL(href, sourceUrl).toString();
    } catch {
      continue;
    }

    discovered.push({
      url: absoluteUrl,
      type: getAttributeValue(linkTag, 'type') ?? inferMimeType(absoluteUrl),
      sizes: getAttributeValue(linkTag, 'sizes'),
      rel,
      source: 'markup',
    });
  }

  return dedupeFaviconLinks(discovered);
}

export function buildDefaultFaviconCandidates(
  normalizedUrl: string,
): FaviconLinkReference[] {
  const parsedUrl = new URL(normalizedUrl);
  const origin = parsedUrl.origin;
  const hostname = parsedUrl.hostname;

  return [
    {
      url: `https://www.google.com/s2/favicons?domain=${hostname}&sz=256`,
      type: 'image/png',
      rel: 'service-icon',
      source: 'service',
    },
    {
      url: `https://icons.duckduckgo.com/ip3/${hostname}.ico`,
      type: 'image/x-icon',
      rel: 'service-icon',
      source: 'service',
    },
    {
      url: new URL('/favicon.ico', origin).toString(),
      type: 'image/x-icon',
      rel: 'shortcut icon',
      source: 'default',
    },
    {
      url: new URL('/favicon.png', origin).toString(),
      type: 'image/png',
      rel: 'icon',
      source: 'default',
    },
    {
      url: new URL('/favicon.svg', origin).toString(),
      type: 'image/svg+xml',
      rel: 'icon',
      source: 'default',
    },
    {
      url: new URL('/apple-touch-icon.png', origin).toString(),
      type: 'image/png',
      rel: 'apple-touch-icon',
      sizes: '180x180',
      source: 'default',
    },
    {
      url: new URL('/favicon-32x32.png', origin).toString(),
      type: 'image/png',
      rel: 'icon',
      sizes: '32x32',
      source: 'default',
    },
  ];
}

export function dedupeFaviconLinks(
  links: FaviconLinkReference[],
): FaviconLinkReference[] {
  const seen = new Set<string>();
  const deduped: FaviconLinkReference[] = [];

  for (const link of links) {
    const key = `${link.url}|${link.rel ?? ''}|${link.sizes ?? ''}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(link);
  }

  return deduped;
}

export function scoreFaviconLink(link: FaviconLinkReference): number {
  let score = 0;

  if (link.source === 'markup') {
    score += 50;
  } else if (link.source === 'default') {
    score += 20;
  }

  if (link.rel?.includes('apple-touch')) {
    score += 18;
  }

  if (link.type.includes('svg')) {
    score += 14;
  }

  if (link.type.includes('x-icon') || link.url.endsWith('.ico')) {
    score += 12;
  }

  const inferredSize = inferSizeFromPath(link.sizes ?? link.url);
  if (inferredSize) {
    score += Math.min(inferredSize.width, 512) / 8;
  }

  return score;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function checkRemoteFile(
  baseUrl: string,
  path: string,
  type: FaviconFileType,
): Promise<FaviconFileCheck> {
  const url = new URL(path, baseUrl).toString();
  const startedAt = Date.now();

  try {
    let response = await fetchWithTimeout(
      url,
      {
        method: 'HEAD',
        redirect: 'follow',
        headers: createUserAgentHeader(),
        cache: 'no-store',
      },
      10_000,
    );

    if (!response.ok && [403, 405].includes(response.status)) {
      response = await fetchWithTimeout(
        url,
        {
          method: 'GET',
          redirect: 'follow',
          headers: createUserAgentHeader(),
          cache: 'no-store',
        },
        10_000,
      );
    }

    const loadTime = Date.now() - startedAt;

    if (!response.ok) {
      return {
        url,
        type,
        exists: false,
        error: `HTTP ${response.status}`,
        loadTime,
      };
    }

    const contentLength = response.headers.get('content-length');
    const fileSize = contentLength
      ? Number.parseInt(contentLength, 10)
      : undefined;

    return {
      url,
      type,
      exists: true,
      fileSize,
      contentType: response.headers.get('content-type') ?? undefined,
      size: inferSizeFromPath(path),
      loadTime,
    };
  } catch (error) {
    return {
      url,
      type,
      exists: false,
      error:
        error instanceof Error && error.name === 'AbortError'
          ? 'Timeout'
          : error instanceof Error
            ? error.message
            : 'Network error',
      loadTime: Date.now() - startedAt,
    };
  }
}

function calculatePerformance(
  files: FaviconFileCheck[],
): FaviconPerformanceMetrics {
  const availableFiles = files.filter((file) => file.exists);
  const totalLoadTime = availableFiles.reduce(
    (sum, file) => sum + (file.loadTime ?? 0),
    0,
  );
  const totalFileSize = availableFiles.reduce(
    (sum, file) => sum + (file.fileSize ?? 0),
    0,
  );
  const averageLoadTime =
    availableFiles.length > 0 ? totalLoadTime / availableFiles.length : 0;

  let largestFile: { url: string; size: number } | null = null;
  let slowestFile: { url: string; time: number } | null = null;

  for (const file of availableFiles) {
    if (
      typeof file.fileSize === 'number' &&
      (!largestFile || file.fileSize > largestFile.size)
    ) {
      largestFile = { url: file.url, size: file.fileSize };
    }

    if (
      typeof file.loadTime === 'number' &&
      (!slowestFile || file.loadTime > slowestFile.time)
    ) {
      slowestFile = { url: file.url, time: file.loadTime };
    }
  }

  return {
    totalLoadTime,
    totalFileSize,
    averageLoadTime,
    largestFile,
    slowestFile,
  };
}

function checkBestPractices(
  files: FaviconFileCheck[],
): FaviconBestPractice[] {
  const practices: FaviconBestPractice[] = [];
  const pngFiles = files.filter((file) => file.type === 'png' && file.exists);

  const hasIco = files.some((file) => file.type === 'ico' && file.exists);
  practices.push({
    id: 'has-ico',
    title: 'favicon.ico exists',
    description: 'The legacy favicon.ico file still covers the widest browser matrix.',
    status: hasIco ? 'pass' : 'fail',
    recommendation: hasIco ? undefined : 'Add favicon.ico in the site root for baseline compatibility.',
  });

  const hasAppleTouch = files.some(
    (file) => file.type === 'apple-touch' && file.exists,
  );
  practices.push({
    id: 'has-apple-touch',
    title: 'Apple touch icon',
    description: 'Required for good quality home-screen bookmarks on iOS.',
    status: hasAppleTouch ? 'pass' : 'warning',
    recommendation: hasAppleTouch
      ? undefined
      : 'Add apple-touch-icon.png at 180x180 for iOS devices.',
  });

  const hasManifest = files.some(
    (file) => file.type === 'manifest' && file.exists,
  );
  practices.push({
    id: 'has-manifest',
    title: 'Web app manifest',
    description: 'Install surfaces and Android shortcuts use a manifest definition.',
    status: hasManifest ? 'pass' : 'warning',
    recommendation: hasManifest
      ? undefined
      : 'Add site.webmanifest or manifest.json with icon definitions.',
  });

  const hasSvg = files.some((file) => file.type === 'svg' && file.exists);
  practices.push({
    id: 'has-svg',
    title: 'SVG favicon',
    description: 'Modern browsers can use SVG for sharp, scalable favicons.',
    status: hasSvg ? 'pass' : 'info',
    recommendation: hasSvg
      ? undefined
      : 'Consider adding favicon.svg for high-density displays.',
  });

  const hasMultiplePngSizes =
    pngFiles.filter((file) => file.size).length >= 3 || pngFiles.length >= 3;
  practices.push({
    id: 'has-png-matrix',
    title: 'Multiple PNG sizes',
    description: 'Provide at least small, medium, and install-size PNG icons.',
    status: hasMultiplePngSizes
      ? 'pass'
      : pngFiles.length > 0
        ? 'warning'
        : 'fail',
    recommendation: hasMultiplePngSizes
      ? undefined
      : 'Ship 16x16, 32x32, and 192x192 PNG files at minimum.',
  });

  const oversizedPng = pngFiles.some(
    (file) => typeof file.fileSize === 'number' && file.fileSize > 50_000,
  );
  practices.push({
    id: 'png-weight',
    title: 'PNG payload stays lean',
    description: 'Large favicon payloads slow down cold loads and install checks.',
    status: oversizedPng ? 'warning' : 'pass',
    recommendation: oversizedPng
      ? 'Compress oversized PNG files and prefer SVG where possible.'
      : undefined,
  });

  const hasBrowserConfig = files.some(
    (file) => file.type === 'browserconfig' && file.exists,
  );
  practices.push({
    id: 'has-browserconfig',
    title: 'Windows tile metadata',
    description: 'browserconfig.xml helps legacy Microsoft surfaces.',
    status: hasBrowserConfig ? 'pass' : 'info',
    recommendation: hasBrowserConfig
      ? undefined
      : 'Add browserconfig.xml if Windows tile support matters for your audience.',
  });

  return practices;
}

function calculateScore(practices: FaviconBestPractice[]) {
  const statusWeight: Record<FaviconBestPractice['status'], number> = {
    pass: 1,
    warning: 0.5,
    info: 0.75,
    fail: 0,
  };
  const totalWeight = practices.length || 1;
  const earnedWeight = practices.reduce(
    (sum, practice) => sum + statusWeight[practice.status],
    0,
  );
  const score = Math.round((earnedWeight / totalWeight) * 100);

  let grade: FaviconAnalysisResult['grade'] = 'F';
  if (score >= 90) {
    grade = 'A';
  } else if (score >= 80) {
    grade = 'B';
  } else if (score >= 70) {
    grade = 'C';
  } else if (score >= 60) {
    grade = 'D';
  }

  return { score, grade };
}

export async function analyzeWebsiteFavicons(
  websiteUrl: string,
): Promise<FaviconAnalysisResult> {
  const normalizedUrl = normalizeWebsiteUrl(websiteUrl);
  const baseUrl = new URL(normalizedUrl).origin;

  const fileChecks = await Promise.all(
    FAVICON_PATHS.map(({ path, type }) => checkRemoteFile(baseUrl, path, type)),
  );

  const performance = calculatePerformance(fileChecks);
  const bestPractices = checkBestPractices(fileChecks);
  const { score, grade } = calculateScore(bestPractices);

  const compatibility = BROWSER_COMPATIBILITY.map((browser) => ({
    ...browser,
    supported:
      browser.browser === 'IE 11'
        ? fileChecks.some((file) => file.type === 'ico' && file.exists)
        : fileChecks.some((file) => file.exists),
  }));

  return {
    url: baseUrl,
    timestamp: new Date().toISOString(),
    files: fileChecks,
    performance,
    compatibility,
    bestPractices,
    score,
    grade,
  };
}

export function buildAnalysisReport(result: FaviconAnalysisResult): string {
  const lines = [
    'Favicon Analysis Report',
    '=======================',
    `URL: ${result.url}`,
    `Generated: ${new Date(result.timestamp).toLocaleString()}`,
    `Score: ${result.score}/100 (${result.grade})`,
    '',
    'Performance',
    '-----------',
    `Total payload: ${formatBytes(result.performance.totalFileSize)}`,
    `Average load: ${formatLoadTime(result.performance.averageLoadTime)}`,
    `Total load: ${formatLoadTime(result.performance.totalLoadTime)}`,
    '',
    'Files',
    '-----',
    ...result.files.map((file) => {
      const status = file.exists ? 'OK' : 'MISS';
      const details: string[] = [status, file.type.toUpperCase(), file.url];

      if (typeof file.fileSize === 'number') {
        details.push(formatBytes(file.fileSize));
      }

      if (typeof file.loadTime === 'number') {
        details.push(formatLoadTime(file.loadTime));
      }

      if (file.error) {
        details.push(file.error);
      }

      return `- ${details.join(' | ')}`;
    }),
    '',
    'Best Practices',
    '--------------',
    ...result.bestPractices.map((practice) => {
      const baseLine = `- [${practice.status.toUpperCase()}] ${practice.title}: ${practice.description}`;
      return practice.recommendation
        ? `${baseLine}\n  Recommendation: ${practice.recommendation}`
        : baseLine;
    }),
  ];

  return lines.join('\n');
}
