// SPDX-License-Identifier: Apache-2.0

import JSZip from 'jszip';

export type FaviconPurpose =
  | 'favicon'
  | 'apple-touch'
  | 'android'
  | 'maskable'
  | 'ms-tile'
  | 'utility';

export interface FaviconSpec {
  width: number;
  height: number;
  name: string;
  purpose: FaviconPurpose;
}

export interface FaviconPackageConfig {
  appName: string;
  shortName?: string;
  description?: string;
  themeColor?: string;
  backgroundColor?: string;
  startUrl?: string;
  appleStatusBarStyle?: 'default' | 'black' | 'black-translucent';
  display?: 'standalone' | 'fullscreen' | 'minimal-ui' | 'browser';
}

export interface PackageFile {
  name: string;
  blob: Blob;
  purpose: FaviconPurpose;
  width?: number;
  height?: number;
}

export interface PackagePreview {
  name: string;
  dataUrl: string;
  purpose: FaviconPurpose;
  width: number;
  height: number;
}

export interface FrameworkSnippets {
  html5: string;
  nextjs: string;
  react: string;
  vue: string;
  wordpress: string;
}

export interface WebManifestIcon {
  src: string;
  sizes: string;
  type: string;
  purpose?: 'any' | 'maskable';
}

export interface WebManifest {
  name: string;
  short_name: string;
  description?: string;
  start_url: string;
  display: 'standalone' | 'fullscreen' | 'minimal-ui' | 'browser';
  theme_color: string;
  background_color: string;
  icons: WebManifestIcon[];
}

export interface GeneratedFaviconPackage {
  files: PackageFile[];
  previews: PackagePreview[];
  manifest: WebManifest;
  browserConfigXml: string;
  snippets: FrameworkSnippets;
  readme: string;
  zipBlob: Blob;
  stats: {
    totalFiles: number;
    totalBytes: number;
    formattedSize: string;
  };
}

type RasterSource = HTMLImageElement | ImageBitmap;

const BASE_ICON_SPECS: FaviconSpec[] = [
  { width: 16, height: 16, name: 'favicon-16x16.png', purpose: 'favicon' },
  { width: 32, height: 32, name: 'favicon-32x32.png', purpose: 'favicon' },
  { width: 48, height: 48, name: 'favicon-48x48.png', purpose: 'favicon' },
  { width: 64, height: 64, name: 'favicon-64x64.png', purpose: 'favicon' },
  { width: 96, height: 96, name: 'favicon-96x96.png', purpose: 'favicon' },
  { width: 128, height: 128, name: 'favicon-128x128.png', purpose: 'favicon' },
  { width: 256, height: 256, name: 'favicon-256x256.png', purpose: 'favicon' },
  { width: 180, height: 180, name: 'apple-touch-icon.png', purpose: 'apple-touch' },
  { width: 152, height: 152, name: 'apple-touch-icon-152x152.png', purpose: 'apple-touch' },
  { width: 167, height: 167, name: 'apple-touch-icon-167x167.png', purpose: 'apple-touch' },
  { width: 192, height: 192, name: 'android-chrome-192x192.png', purpose: 'android' },
  { width: 512, height: 512, name: 'android-chrome-512x512.png', purpose: 'android' },
  { width: 192, height: 192, name: 'android-chrome-maskable-192x192.png', purpose: 'maskable' },
  { width: 512, height: 512, name: 'android-chrome-maskable-512x512.png', purpose: 'maskable' },
  { width: 70, height: 70, name: 'mstile-70x70.png', purpose: 'ms-tile' },
  { width: 150, height: 150, name: 'mstile-150x150.png', purpose: 'ms-tile' },
  { width: 310, height: 150, name: 'mstile-310x150.png', purpose: 'ms-tile' },
  { width: 310, height: 310, name: 'mstile-310x310.png', purpose: 'ms-tile' },
];

const PREVIEW_NAMES = new Set([
  'favicon-32x32.png',
  'apple-touch-icon.png',
  'android-chrome-192x192.png',
  'android-chrome-512x512.png',
  'android-chrome-maskable-512x512.png',
]);

export const DEFAULT_FAVICON_PACKAGE_CONFIG: FaviconPackageConfig = {
  appName: '',
  shortName: '',
  description: '',
  themeColor: '#111827',
  backgroundColor: '#ffffff',
  startUrl: '/',
  appleStatusBarStyle: 'default',
  display: 'standalone',
};

function getSourceDimensions(source: RasterSource) {
  if ('naturalWidth' in source) {
    return {
      width: source.naturalWidth || source.width,
      height: source.naturalHeight || source.height,
    };
  }

  return {
    width: source.width,
    height: source.height,
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function drawContainedImage(
  context: CanvasRenderingContext2D,
  source: RasterSource,
  width: number,
  height: number,
  paddingPercent = 0,
) {
  const { width: sourceWidth, height: sourceHeight } = getSourceDimensions(source);
  const padding = Math.max(0, Math.min(0.45, paddingPercent));
  const innerWidth = width * (1 - padding * 2);
  const innerHeight = height * (1 - padding * 2);
  const scale = Math.min(innerWidth / sourceWidth, innerHeight / sourceHeight);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  const offsetX = (width - drawWidth) / 2;
  const offsetY = (height - drawHeight) / 2;

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(source, offsetX, offsetY, drawWidth, drawHeight);
}

async function canvasToBlob(
  canvas: HTMLCanvasElement,
  type = 'image/png',
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Failed to create image blob'));
        return;
      }

      resolve(blob);
    }, type, 1);
  });
}

async function renderRasterBlob(
  source: RasterSource,
  spec: FaviconSpec,
  backgroundColor?: string,
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = spec.width;
  canvas.height = spec.height;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Failed to acquire canvas context');
  }

  if (backgroundColor) {
    context.fillStyle = backgroundColor;
    context.fillRect(0, 0, spec.width, spec.height);
  }

  drawContainedImage(context, source, spec.width, spec.height);
  return canvasToBlob(canvas);
}

async function renderMaskableBlob(
  source: RasterSource,
  spec: FaviconSpec,
  backgroundColor: string,
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = spec.width;
  canvas.height = spec.height;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Failed to acquire canvas context');
  }

  context.fillStyle = backgroundColor;
  context.fillRect(0, 0, spec.width, spec.height);
  drawContainedImage(context, source, spec.width, spec.height, 0.1);

  return canvasToBlob(canvas);
}

function buildIcoFile(images: ImageData[], sizes: number[]): ArrayBuffer {
  const headerSize = 6;
  const dirEntrySize = 16;
  const imageSizes = sizes.map((size) => {
    const pixelDataSize = size * size * 4;
    const andMaskRowSize = Math.floor((size + 31) / 32) * 4;
    const andMaskSize = andMaskRowSize * size;
    return 40 + pixelDataSize + andMaskSize;
  });

  const totalImageSize = imageSizes.reduce((sum, current) => sum + current, 0);
  const totalSize = headerSize + dirEntrySize * images.length + totalImageSize;
  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);

  view.setUint16(0, 0, true);
  view.setUint16(2, 1, true);
  view.setUint16(4, images.length, true);

  let imageOffset = headerSize + dirEntrySize * images.length;
  for (let index = 0; index < images.length; index += 1) {
    const size = sizes[index];
    const entryOffset = headerSize + index * dirEntrySize;

    view.setUint8(entryOffset, size === 256 ? 0 : size);
    view.setUint8(entryOffset + 1, size === 256 ? 0 : size);
    view.setUint8(entryOffset + 2, 0);
    view.setUint8(entryOffset + 3, 0);
    view.setUint16(entryOffset + 4, 1, true);
    view.setUint16(entryOffset + 6, 32, true);
    view.setUint32(entryOffset + 8, imageSizes[index], true);
    view.setUint32(entryOffset + 12, imageOffset, true);

    imageOffset += imageSizes[index];
  }

  let currentOffset = headerSize + dirEntrySize * images.length;
  for (let index = 0; index < images.length; index += 1) {
    const size = sizes[index];
    const image = images[index];
    const andMaskRowSize = Math.floor((size + 31) / 32) * 4;

    view.setUint32(currentOffset, 40, true);
    view.setInt32(currentOffset + 4, size, true);
    view.setInt32(currentOffset + 8, size * 2, true);
    view.setUint16(currentOffset + 12, 1, true);
    view.setUint16(currentOffset + 14, 32, true);
    view.setUint32(currentOffset + 16, 0, true);
    view.setUint32(currentOffset + 20, 0, true);
    view.setInt32(currentOffset + 24, 0, true);
    view.setInt32(currentOffset + 28, 0, true);
    view.setUint32(currentOffset + 32, 0, true);
    view.setUint32(currentOffset + 36, 0, true);
    currentOffset += 40;

    for (let y = size - 1; y >= 0; y -= 1) {
      for (let x = 0; x < size; x += 1) {
        const sourceIndex = (y * size + x) * 4;
        view.setUint8(currentOffset, image.data[sourceIndex + 2]);
        view.setUint8(currentOffset + 1, image.data[sourceIndex + 1]);
        view.setUint8(currentOffset + 2, image.data[sourceIndex]);
        view.setUint8(currentOffset + 3, image.data[sourceIndex + 3]);
        currentOffset += 4;
      }
    }

    for (let row = 0; row < size; row += 1) {
      for (let column = 0; column < andMaskRowSize; column += 1) {
        view.setUint8(currentOffset, 0);
        currentOffset += 1;
      }
    }
  }

  return buffer;
}

async function createIcoBlob(source: RasterSource): Promise<Blob> {
  const sizes = [16, 32, 48];
  const imageData: ImageData[] = [];

  for (const size of sizes) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;

    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Failed to acquire canvas context');
    }

    drawContainedImage(context, source, size, size);
    imageData.push(context.getImageData(0, 0, size, size));
  }

  return new Blob([buildIcoFile(imageData, sizes)], { type: 'image/x-icon' });
}

export function createWebManifest(config: FaviconPackageConfig): WebManifest {
  const appName = config.appName.trim() || 'img-man App';
  const shortName = config.shortName?.trim() || appName.slice(0, 12);
  const themeColor = config.themeColor?.trim() || '#111827';
  const backgroundColor = config.backgroundColor?.trim() || '#ffffff';

  return {
    name: appName,
    short_name: shortName,
    description: config.description?.trim() || undefined,
    start_url: config.startUrl?.trim() || '/',
    display: config.display || 'standalone',
    theme_color: themeColor,
    background_color: backgroundColor,
    icons: [
      {
        src: '/android-chrome-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/android-chrome-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/android-chrome-maskable-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/android-chrome-maskable-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}

export function createBrowserConfigXml(tileColor: string): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<browserconfig>
  <msapplication>
    <tile>
      <square70x70logo src="/mstile-70x70.png"/>
      <square150x150logo src="/mstile-150x150.png"/>
      <wide310x150logo src="/mstile-310x150.png"/>
      <square310x310logo src="/mstile-310x310.png"/>
      <TileColor>${tileColor}</TileColor>
    </tile>
  </msapplication>
</browserconfig>`;
}

export function createFrameworkSnippets(
  config: FaviconPackageConfig,
): FrameworkSnippets {
  const appName = config.appName.trim() || 'img-man App';
  const themeColor = config.themeColor?.trim() || '#111827';
  const appleStatusBarStyle = config.appleStatusBarStyle || 'default';

  const html5 = `<!-- Standard favicons -->
<link rel="icon" type="image/x-icon" href="/favicon.ico">
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
<link rel="icon" type="image/png" sizes="48x48" href="/favicon-48x48.png">

<!-- Apple touch -->
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="${appleStatusBarStyle}">
<meta name="apple-mobile-web-app-title" content="${appName}">

<!-- PWA / Android -->
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="${themeColor}">

<!-- Windows -->
<meta name="msapplication-TileColor" content="${themeColor}">
<meta name="msapplication-config" content="/browserconfig.xml">`;

  const nextjs = `import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '${appName}',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    other: [
      { rel: 'manifest', url: '/site.webmanifest' },
    ],
  },
  themeColor: '${themeColor}',
};`;

  const react = `import { Helmet } from 'react-helmet';

export function FaviconHead() {
  return (
    <Helmet>
      <link rel="icon" type="image/x-icon" href="/favicon.ico" />
      <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
      <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
      <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
      <link rel="manifest" href="/site.webmanifest" />
      <meta name="theme-color" content="${themeColor}" />
    </Helmet>
  );
}`;

  const vue = `<script>
export default {
  metaInfo: {
    link: [
      { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
      { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32x32.png' },
      { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' },
      { rel: 'manifest', href: '/site.webmanifest' },
    ],
    meta: [
      { name: 'theme-color', content: '${themeColor}' },
      { name: 'msapplication-config', content: '/browserconfig.xml' },
    ],
  },
};
</script>`;

  const wordpress = `<?php
function imageman_add_favicons() {
  ?>
  <link rel="icon" type="image/x-icon" href="<?php echo get_template_directory_uri(); ?>/favicon.ico">
  <link rel="apple-touch-icon" sizes="180x180" href="<?php echo get_template_directory_uri(); ?>/apple-touch-icon.png">
  <link rel="manifest" href="<?php echo get_template_directory_uri(); ?>/site.webmanifest">
  <meta name="theme-color" content="${themeColor}">
  <?php
}
add_action('wp_head', 'imageman_add_favicons');
?>`;

  return {
    html5,
    nextjs,
    react,
    vue,
    wordpress,
  };
}

function createImplementationDocument(snippets: FrameworkSnippets): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Favicon snippets</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 40px auto; max-width: 960px; padding: 0 24px; }
    h2 { margin-top: 32px; }
    pre { background: #0f172a; color: #e2e8f0; border-radius: 16px; padding: 18px; overflow-x: auto; }
  </style>
</head>
<body>
  <h1>Favicon implementation snippets</h1>
  <h2>HTML5</h2>
  <pre><code>${escapeHtml(snippets.html5)}</code></pre>
  <h2>Next.js</h2>
  <pre><code>${escapeHtml(snippets.nextjs)}</code></pre>
  <h2>React</h2>
  <pre><code>${escapeHtml(snippets.react)}</code></pre>
  <h2>Vue</h2>
  <pre><code>${escapeHtml(snippets.vue)}</code></pre>
  <h2>WordPress</h2>
  <pre><code>${escapeHtml(snippets.wordpress)}</code></pre>
</body>
</html>`;
}

function createReadme(config: FaviconPackageConfig, fileCount: number): string {
  const appName = config.appName.trim() || 'img-man App';

  return `# Favicon package for ${appName}

Generated by img-man Favicon Studio.

## Files

This export includes ${fileCount} assets covering browser tabs, install surfaces, Apple touch icons, Windows tiles, and implementation snippets.

## Install

1. Copy the generated image files into your public web root.
2. Add the markup from implementation.html or use the framework snippet that matches your app.
3. Clear cache and verify on desktop, mobile, and install prompts.

## Included highlights

- favicon.ico
- Standard PNG matrix
- Apple touch icons
- Android chrome icons and maskable icons
- site.webmanifest
- browserconfig.xml
- implementation.html

Generated on ${new Date().toISOString().split('T')[0]}
`;
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

export async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read blob'));
    reader.readAsDataURL(blob);
  });
}

export async function fileToDataUrl(file: File): Promise<string> {
  return blobToDataUrl(file);
}

export async function loadImageFromSource(
  source: File | string,
): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to load image source'));

    if (typeof source === 'string') {
      image.src = source;
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      image.src = reader.result as string;
    };
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read image file'));
    reader.readAsDataURL(source);
  });
}

export function slugifyFilename(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'imgman-favicon';
}

export function sanitizeSvgMarkup(svgMarkup: string): string {
  return svgMarkup
    .replace(/<\?xml[\s\S]*?\?>/gi, '')
    .replace(/<!doctype[\s\S]*?>/gi, '')
    .replace(/<!--([\s\S]*?)-->/g, '')
    .replace(/<metadata[\s\S]*?<\/metadata>/gi, '')
    .replace(/>\s+</g, '><')
    .trim();
}

export async function createEmojiSource(
  emoji: string,
  size: number,
  backgroundColor: string,
  paddingPercent: number,
): Promise<{ dataUrl: string; blob: Blob }> {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Failed to acquire canvas context');
  }

  context.clearRect(0, 0, size, size);
  if (backgroundColor !== 'transparent') {
    context.fillStyle = backgroundColor;
    context.fillRect(0, 0, size, size);
  }

  const safeSize = size * (1 - Math.max(0, Math.min(0.45, paddingPercent / 100)) * 2);
  context.font = `${Math.floor(safeSize)}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(emoji, size / 2, size / 2 + size * 0.03);

  const blob = await canvasToBlob(canvas);
  return {
    blob,
    dataUrl: canvas.toDataURL('image/png'),
  };
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function findPackageFile(
  pkg: GeneratedFaviconPackage,
  fileName: string,
): PackageFile | undefined {
  return pkg.files.find((file) => file.name === fileName);
}

export async function buildFaviconPackage(
  source: RasterSource,
  config: FaviconPackageConfig,
): Promise<GeneratedFaviconPackage> {
  const resolvedConfig: FaviconPackageConfig = {
    ...DEFAULT_FAVICON_PACKAGE_CONFIG,
    ...config,
    appName: config.appName.trim() || 'img-man App',
    shortName:
      config.shortName?.trim() ||
      (config.appName.trim() || 'img-man App').slice(0, 12),
    themeColor: config.themeColor?.trim() || '#111827',
    backgroundColor: config.backgroundColor?.trim() || '#ffffff',
    startUrl: config.startUrl?.trim() || '/',
  };

  const imageFiles = await Promise.all(
    BASE_ICON_SPECS.map(async (spec) => {
      const blob =
        spec.purpose === 'maskable'
          ? await renderMaskableBlob(source, spec, resolvedConfig.backgroundColor!)
          : await renderRasterBlob(
              source,
              spec,
              spec.purpose === 'ms-tile' ? resolvedConfig.backgroundColor : undefined,
            );

      return {
        name: spec.name,
        blob,
        purpose: spec.purpose,
        width: spec.width,
        height: spec.height,
      } satisfies PackageFile;
    }),
  );

  const icoBlob = await createIcoBlob(source);
  const manifest = createWebManifest(resolvedConfig);
  const browserConfigXml = createBrowserConfigXml(resolvedConfig.themeColor!);
  const snippets = createFrameworkSnippets(resolvedConfig);
  const readme = createReadme(resolvedConfig, imageFiles.length + 5);

  const manifestBlob = new Blob([JSON.stringify(manifest, null, 2)], {
    type: 'application/manifest+json',
  });
  const browserConfigBlob = new Blob([browserConfigXml], {
    type: 'application/xml',
  });
  const implementationBlob = new Blob(
    [createImplementationDocument(snippets)],
    { type: 'text/html' },
  );
  const readmeBlob = new Blob([readme], { type: 'text/markdown' });

  const files: PackageFile[] = [
    ...imageFiles,
    { name: 'favicon.ico', blob: icoBlob, purpose: 'favicon', width: 48, height: 48 },
    { name: 'site.webmanifest', blob: manifestBlob, purpose: 'utility' },
    { name: 'browserconfig.xml', blob: browserConfigBlob, purpose: 'utility' },
    { name: 'implementation.html', blob: implementationBlob, purpose: 'utility' },
    { name: 'README.md', blob: readmeBlob, purpose: 'utility' },
  ];

  const zip = new JSZip();
  for (const file of files) {
    zip.file(file.name, file.blob);
  }

  const zipBlob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
  });

  const previews = await Promise.all(
    imageFiles
      .filter((file) => PREVIEW_NAMES.has(file.name) && file.width && file.height)
      .map(async (file) => ({
        name: file.name,
        purpose: file.purpose,
        width: file.width!,
        height: file.height!,
        dataUrl: await blobToDataUrl(file.blob),
      })),
  );

  const totalBytes = files.reduce((sum, file) => sum + file.blob.size, 0);

  return {
    files,
    previews,
    manifest,
    browserConfigXml,
    snippets,
    readme,
    zipBlob,
    stats: {
      totalFiles: files.length,
      totalBytes,
      formattedSize: formatBytes(totalBytes),
    },
  };
}
