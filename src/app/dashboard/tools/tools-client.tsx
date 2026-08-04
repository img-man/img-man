// SPDX-License-Identifier: Apache-2.0
'use client';

import { useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  ScanLine,
  FilePlus2,
  Images,
  Sparkles,
  Search,
  Smile,
  Smartphone,
  VectorSquare,
  Eraser,
  X,
  Link as LinkIcon,
  Unlink,
  Download,
  Loader2,
  ChevronDown,
  Minimize2,
  Type,
  Library,
  Scissors,
  RotateCw,
  Droplets,
  FileOutput,
  FileImage,
  Lock,
  ScanText,
  FileEdit,
  ShieldOff,
  Hash,
  ArrowUpDown,
  Crop,
  FileCog,
  FileSignature,
  Wrench,
  Package,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import AiBadge from '@/components/ai-badge';
import { useAiFeatureAccess } from '@/lib/use-ai-feature-access';

const PdfMergeModal = dynamic(() => import('./pdf-merge-client'), {
  ssr: false,
});
const ImgToPdfModal = dynamic(() => import('./img-to-pdf-client'), {
  ssr: false,
});
const VectorizeModal = dynamic(() => import('./vectorize-client'), {
  ssr: false,
});
const CompressorModal = dynamic(() => import('./compressor-client'), {
  ssr: false,
});
const BatchRenameModal = dynamic(() => import('./batch-rename-client'), {
  ssr: false,
});
const PdfSplitModal = dynamic(() => import('./pdf-split-client'), {
  ssr: false,
});
const PdfCompressModal = dynamic(() => import('./pdf-compress-client'), {
  ssr: false,
});
const PdfRotateModal = dynamic(() => import('./pdf-rotate-client'), {
  ssr: false,
});
const PdfWatermarkModal = dynamic(() => import('./pdf-watermark-client'), {
  ssr: false,
});
const PdfPageExtractModal = dynamic(() => import('./pdf-page-extract-client'), {
  ssr: false,
});
// Flatten PDF removed per user request (limited use-case)
const PdfToImageModal = dynamic(() => import('./pdf-to-image-client'), {
  ssr: false,
});
const PdfProtectModal = dynamic(() => import('./pdf-protect-client'), {
  ssr: false,
});
const PdfOcrModal = dynamic(() => import('./pdf-ocr-client'), { ssr: false });
const PdfEditorModal = dynamic(
  () => import('./pdf-editor/components/PdfEditorShell'),
  { ssr: false },
);
const PdfUnlockModal = dynamic(() => import('./pdf-unlock-client'), {
  ssr: false,
});
const PdfPageNumbersModal = dynamic(() => import('./pdf-page-numbers-client'), {
  ssr: false,
});
const PdfOrganizeModal = dynamic(() => import('./pdf-organize-client'), {
  ssr: false,
});
const PdfCropModal = dynamic(() => import('./pdf-crop-client'), { ssr: false });
const PdfMetadataModal = dynamic(() => import('./pdf-metadata-client'), {
  ssr: false,
});
const PdfSignModal = dynamic(() => import('./pdf-sign-client'), { ssr: false });
const PdfRepairModal = dynamic(() => import('./pdf-repair-client'), {
  ssr: false,
});
const AssetPicker = dynamic(
  () => import('@/components/dashboard/asset-picker'),
  { ssr: false },
);

/* ─── Tool definitions ─────────────────────────────────── */

type ToolCategory = 'image' | 'pdf' | 'batch';
type PdfToolGroup =
  | 'organize'
  | 'convert'
  | 'optimize'
  | 'secure'
  | 'edit'
  | 'intelligence';

interface ToolsClientProps {
  initialTab?: ToolCategory | 'all';
  title?: string;
  description?: string;
  hideTabs?: boolean;
}

interface ToolDef {
  id: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  title: string;
  description: string;
  badge?: string;
  category: ToolCategory;
  group?: PdfToolGroup;
  action:
    | 'resizer'
    | 'pdf-merge'
    | 'images-to-pdf'
    | 'pdf-split'
    | 'pdf-compress'
    | 'pdf-rotate'
    | 'pdf-watermark'
    | 'pdf-page-extract'
    | 'pdf-to-image'
    | 'pdf-protect'
    | 'pdf-ocr'
    | 'pdf-editor'
    | 'pdf-unlock'
    | 'pdf-page-numbers'
    | 'pdf-organize'
    | 'pdf-crop'
    | 'pdf-metadata'
    | 'pdf-sign'
    | 'pdf-repair'
    | 'vectorize'
    | 'compressor'
    | 'batch-rename'
    | 'link'
    | 'coming-soon';
  href?: string;
  aiFeatureKeys?: readonly string[];
}

const TABS: { key: ToolCategory | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'image', label: 'Image' },
  { key: 'pdf', label: 'PDF' },
  { key: 'batch', label: 'Batch' },
];

const PDF_GROUPS: {
  key: PdfToolGroup;
  title: string;
  description: string;
}[] = [
  {
    key: 'organize',
    title: 'Organize & Pages',
    description:
      'Merge, split, reorder, rotate, crop, and prepare page-level output.',
  },
  {
    key: 'convert',
    title: 'Convert',
    description:
      'Move documents into or out of PDF-compatible formats using the current tool set.',
  },
  {
    key: 'optimize',
    title: 'Optimize & Repair',
    description:
      'Reduce file size, repair damaged documents, and clean up PDF metadata.',
  },
  {
    key: 'secure',
    title: 'Sign & Secure',
    description:
      'Add signatures, passwords, watermarks, and unlock restrictions when authorized.',
  },
  {
    key: 'edit',
    title: 'Edit In Place',
    description:
      'Open the PDF editor floor: add text, images, annotations, and page-level changes.',
  },
  {
    key: 'intelligence',
    title: 'OCR & Intelligence',
    description:
      'Extract text and prepare PDFs for searchable workflows and AI follow-up.',
  },
];

const faviconToolHref = (tool: string) => `/dashboard/tools/favicon?tool=${tool}`;

const FAVICON_IMAGE_TOOLS: ToolDef[] = [
  {
    id: 'text-to-favicon',
    icon: Type,
    iconBg: 'bg-orange-100 dark:bg-orange-900/30',
    iconColor: 'text-orange-600 dark:text-orange-400',
    title: 'Text to Favicon',
    description:
      'Start from a short prompt in AI Studio, then package the result for browser delivery.',
    badge: 'AI',
    category: 'image',
    action: 'link',
    href: '/dashboard/ai',
    aiFeatureKeys: ['generate'],
  },
  {
    id: 'image-to-favicon',
    icon: FileImage,
    iconBg: 'bg-amber-100 dark:bg-amber-900/30',
    iconColor: 'text-amber-600 dark:text-amber-400',
    title: 'Image to Favicon',
    description:
      'Upload artwork and export favicon packages, ICO files, and install-ready snippets.',
    badge: 'Favicon',
    category: 'image',
    action: 'link',
    href: faviconToolHref('image-to-favicon'),
  },
  {
    id: 'emoji-favicon',
    icon: Smile,
    iconBg: 'bg-yellow-100 dark:bg-yellow-900/30',
    iconColor: 'text-yellow-600 dark:text-yellow-400',
    title: 'Emoji Favicon',
    description:
      'Build a clean favicon source from a single emoji, then export the full icon set.',
    badge: 'Favicon',
    category: 'image',
    action: 'link',
    href: faviconToolHref('emoji-favicon'),
  },
  {
    id: 'pixel-editor',
    icon: FileEdit,
    iconBg: 'bg-pink-100 dark:bg-pink-900/30',
    iconColor: 'text-pink-600 dark:text-pink-400',
    title: 'Pixel Editor',
    description:
      'Open Design Studio for manual icon cleanup and pixel-level refinement before export.',
    badge: 'Design',
    category: 'image',
    action: 'link',
    href: '/dashboard/designs',
  },
  {
    id: 'png-to-ico',
    icon: FileOutput,
    iconBg: 'bg-blue-100 dark:bg-blue-900/30',
    iconColor: 'text-blue-600 dark:text-blue-400',
    title: 'PNG to ICO',
    description:
      'Convert uploaded PNG artwork into favicon.ico output with browser-ready package assets.',
    badge: 'Favicon',
    category: 'image',
    action: 'link',
    href: faviconToolHref('png-to-ico'),
  },
  {
    id: 'ico-converter',
    icon: FileCog,
    iconBg: 'bg-cyan-100 dark:bg-cyan-900/30',
    iconColor: 'text-cyan-600 dark:text-cyan-400',
    title: 'ICO Converter',
    description:
      'Generate ICO and PNG outputs from one source asset without leaving the favicon workflow.',
    badge: 'Favicon',
    category: 'image',
    action: 'link',
    href: faviconToolHref('ico-converter'),
  },
  {
    id: 'favicon-checker',
    icon: Search,
    iconBg: 'bg-violet-100 dark:bg-violet-900/30',
    iconColor: 'text-violet-600 dark:text-violet-400',
    title: 'Favicon Checker',
    description:
      'Audit a live site for missing favicon files, icon coverage, and implementation gaps.',
    badge: 'Utility',
    category: 'image',
    action: 'link',
    href: faviconToolHref('favicon-checker'),
  },
  {
    id: 'favicon-extractor',
    icon: LinkIcon,
    iconBg: 'bg-sky-100 dark:bg-sky-900/30',
    iconColor: 'text-sky-600 dark:text-sky-400',
    title: 'Favicon Extractor',
    description:
      'Fetch favicon candidates from any public URL and inspect the returned icon set.',
    badge: 'Utility',
    category: 'image',
    action: 'link',
    href: faviconToolHref('favicon-extractor'),
  },
  {
    id: 'svg-viewer',
    icon: Search,
    iconBg: 'bg-emerald-100 dark:bg-emerald-900/30',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    title: 'SVG Viewer',
    description:
      'Preview SVG uploads, inspect the markup, and clean exports before packaging.',
    badge: 'SVG',
    category: 'image',
    action: 'link',
    href: faviconToolHref('svg-viewer'),
  },
  {
    id: 'svg-to-png',
    icon: FileImage,
    iconBg: 'bg-green-100 dark:bg-green-900/30',
    iconColor: 'text-green-600 dark:text-green-400',
    title: 'SVG to PNG',
    description:
      'Convert SVG artwork into PNG favicon exports and multi-platform icon sizes.',
    badge: 'SVG',
    category: 'image',
    action: 'link',
    href: faviconToolHref('svg-to-png'),
  },
  {
    id: 'image-to-base64',
    icon: LinkIcon,
    iconBg: 'bg-indigo-100 dark:bg-indigo-900/30',
    iconColor: 'text-indigo-600 dark:text-indigo-400',
    title: 'Image to Base64',
    description:
      'Copy the generated favicon source as a data URL for embeds, docs, and prototypes.',
    badge: 'SVG',
    category: 'image',
    action: 'link',
    href: faviconToolHref('image-to-base64'),
  },
  {
    id: 'base64-to-image',
    icon: Unlink,
    iconBg: 'bg-fuchsia-100 dark:bg-fuchsia-900/30',
    iconColor: 'text-fuchsia-600 dark:text-fuchsia-400',
    title: 'Base64 to Image',
    description:
      'Recover and inspect image outputs from favicon data URLs inside the shared studio flow.',
    badge: 'SVG',
    category: 'image',
    action: 'link',
    href: faviconToolHref('base64-to-image'),
  },
  {
    id: 'android-adaptive-icon',
    icon: Smartphone,
    iconBg: 'bg-lime-100 dark:bg-lime-900/30',
    iconColor: 'text-lime-600 dark:text-lime-400',
    title: 'Android Adaptive Icon',
    description:
      'Generate Android-ready app icon assets from the same favicon package workflow.',
    badge: 'Advanced',
    category: 'image',
    action: 'link',
    href: faviconToolHref('android-adaptive-icon'),
  },
  {
    id: 'apple-touch-icon',
    icon: FileImage,
    iconBg: 'bg-rose-100 dark:bg-rose-900/30',
    iconColor: 'text-rose-600 dark:text-rose-400',
    title: 'Apple Touch Icon',
    description:
      'Export the Apple touch icon alongside your browser favicon set and snippets.',
    badge: 'Advanced',
    category: 'image',
    action: 'link',
    href: faviconToolHref('apple-touch-icon'),
  },
  {
    id: 'og-image-generator',
    icon: Images,
    iconBg: 'bg-orange-100 dark:bg-orange-900/30',
    iconColor: 'text-orange-600 dark:text-orange-400',
    title: 'OG Image Generator',
    description:
      'Use Design Studio to build OG and social cards alongside your icon exports.',
    badge: 'Design',
    category: 'image',
    action: 'link',
    href: '/dashboard/designs',
  },
  {
    id: 'pwa-generator',
    icon: Package,
    iconBg: 'bg-blue-100 dark:bg-blue-900/30',
    iconColor: 'text-blue-600 dark:text-blue-400',
    title: 'PWA Generator',
    description:
      'Create a manifest-friendly icon bundle for installable web apps and shortcuts.',
    badge: 'Advanced',
    category: 'image',
    action: 'link',
    href: faviconToolHref('pwa-generator'),
  },
  {
    id: 'design-system-export',
    icon: Library,
    iconBg: 'bg-teal-100 dark:bg-teal-900/30',
    iconColor: 'text-teal-600 dark:text-teal-400',
    title: 'Design System Export',
    description:
      'Use shared icon exports and snippets when shipping brand assets across products.',
    badge: 'Advanced',
    category: 'image',
    action: 'link',
    href: faviconToolHref('design-system-export'),
  },
  {
    id: 'mobile-icons',
    icon: Smartphone,
    iconBg: 'bg-cyan-100 dark:bg-cyan-900/30',
    iconColor: 'text-cyan-600 dark:text-cyan-400',
    title: 'Mobile Icons',
    description:
      'Export mobile-ready PNG icon sets for homescreen, install, and device surfaces.',
    badge: 'Advanced',
    category: 'image',
    action: 'link',
    href: faviconToolHref('mobile-icons'),
  },
  {
    id: 'favicon-animation',
    icon: Sparkles,
    iconBg: 'bg-purple-100 dark:bg-purple-900/30',
    iconColor: 'text-purple-600 dark:text-purple-400',
    title: 'Favicon Animation',
    description:
      'Prepare animation frames in Design Studio, then export assets for manual animated favicon workflows.',
    badge: 'Design',
    category: 'image',
    action: 'link',
    href: '/dashboard/designs',
  },
  {
    id: 'favicon-analyzer',
    icon: Search,
    iconBg: 'bg-violet-100 dark:bg-violet-900/30',
    iconColor: 'text-violet-600 dark:text-violet-400',
    title: 'Favicon Analyzer',
    description:
      'Review icon presence, compatibility, and favicon implementation quality for any site.',
    badge: 'Utility',
    category: 'image',
    action: 'link',
    href: faviconToolHref('favicon-analyzer'),
  },
  {
    id: 'color-palette',
    icon: Droplets,
    iconBg: 'bg-blue-100 dark:bg-blue-900/30',
    iconColor: 'text-blue-600 dark:text-blue-400',
    title: 'Color Palette',
    description:
      'Use the favicon builder and design surfaces to shape brand colors before export.',
    badge: 'Design',
    category: 'image',
    action: 'link',
    href: '/dashboard/designs',
  },
  {
    id: 'seo-checker',
    icon: Search,
    iconBg: 'bg-emerald-100 dark:bg-emerald-900/30',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    title: 'SEO Checker',
    description:
      'Run favicon analysis to catch missing icon metadata and browser-surface implementation issues.',
    badge: 'Utility',
    category: 'image',
    action: 'link',
    href: faviconToolHref('seo-checker'),
  },
  {
    id: 'email-signature',
    icon: FileSignature,
    iconBg: 'bg-amber-100 dark:bg-amber-900/30',
    iconColor: 'text-amber-600 dark:text-amber-400',
    title: 'Email Signature',
    description:
      'Use Design Studio to assemble branded email assets and supporting icon exports.',
    badge: 'Design',
    category: 'image',
    action: 'link',
    href: '/dashboard/designs',
  },
];

const TOOLS: ToolDef[] = [
  {
    id: 'resizer',
    icon: ScanLine,
    iconBg: 'bg-blue-100 dark:bg-blue-900/30',
    iconColor: 'text-blue-600 dark:text-blue-400',
    title: 'Image Resizer',
    description:
      'Resize & convert images to PNG, JPEG, or WEBP with aspect-ratio lock.',
    category: 'image',
    action: 'resizer',
  },
  {
    id: 'pdf-merge',
    icon: FilePlus2,
    iconBg: 'bg-red-100 dark:bg-red-900/30',
    iconColor: 'text-red-600 dark:text-red-400',
    title: 'PDF Merge',
    description: 'Combine multiple PDF files into a single document.',
    category: 'pdf',
    group: 'organize',
    action: 'pdf-merge',
  },
  {
    id: 'images-to-pdf',
    icon: Images,
    iconBg: 'bg-purple-100 dark:bg-purple-900/30',
    iconColor: 'text-purple-600 dark:text-purple-400',
    title: 'Images to PDF',
    description: 'Convert a set of images into a PDF document.',
    category: 'pdf',
    group: 'convert',
    action: 'images-to-pdf',
  },
  {
    id: 'pdf-split',
    icon: Scissors,
    iconBg: 'bg-orange-100 dark:bg-orange-900/30',
    iconColor: 'text-orange-600 dark:text-orange-400',
    title: 'Split PDF',
    description: 'Split a PDF into separate documents by page ranges.',
    category: 'pdf',
    group: 'organize',
    action: 'pdf-split',
  },
  {
    id: 'pdf-compress',
    icon: Minimize2,
    iconBg: 'bg-cyan-100 dark:bg-cyan-900/30',
    iconColor: 'text-cyan-600 dark:text-cyan-400',
    title: 'Compress PDF',
    description: 'Reduce PDF file size by optimizing and stripping metadata.',
    category: 'pdf',
    group: 'optimize',
    action: 'pdf-compress',
  },
  {
    id: 'pdf-to-image',
    icon: FileImage,
    iconBg: 'bg-green-100 dark:bg-green-900/30',
    iconColor: 'text-green-600 dark:text-green-400',
    title: 'Split to Single Pages',
    description:
      'Create one single-page PDF per page of the source document.',
    category: 'pdf',
    group: 'organize',
    action: 'pdf-to-image',
  },
  {
    id: 'pdf-rotate',
    icon: RotateCw,
    iconBg: 'bg-teal-100 dark:bg-teal-900/30',
    iconColor: 'text-teal-600 dark:text-teal-400',
    title: 'Rotate PDF',
    description: 'Rotate all or specific pages in a PDF document.',
    category: 'pdf',
    group: 'organize',
    action: 'pdf-rotate',
  },
  {
    id: 'pdf-watermark',
    icon: Droplets,
    iconBg: 'bg-blue-100 dark:bg-blue-900/30',
    iconColor: 'text-blue-600 dark:text-blue-400',
    title: 'Add Watermark',
    description: 'Add a text watermark to every page of a PDF.',
    category: 'pdf',
    group: 'secure',
    action: 'pdf-watermark',
  },
  {
    id: 'pdf-page-extract',
    icon: FileOutput,
    iconBg: 'bg-violet-100 dark:bg-violet-900/30',
    iconColor: 'text-violet-600 dark:text-violet-400',
    title: 'Extract Pages',
    description: 'Select and extract specific pages from a PDF.',
    category: 'pdf',
    group: 'organize',
    action: 'pdf-page-extract',
  },

  {
    id: 'pdf-protect',
    icon: Lock,
    iconBg: 'bg-rose-100 dark:bg-rose-900/30',
    iconColor: 'text-rose-600 dark:text-rose-400',
    title: 'Password Protect',
    description: 'Encrypt a PDF with password protection.',
    category: 'pdf',
    group: 'secure',
    action: 'pdf-protect',
  },
  {
    id: 'pdf-ocr',
    icon: ScanText,
    iconBg: 'bg-sky-100 dark:bg-sky-900/30',
    iconColor: 'text-sky-600 dark:text-sky-400',
    title: 'OCR Scanner',
    description: 'Scan images to extract editable text with AI-powered OCR.',
    category: 'pdf',
    group: 'intelligence',
    action: 'pdf-ocr',
    aiFeatureKeys: [],
  },
  {
    id: 'pdf-editor',
    icon: FileEdit,
    iconBg: 'bg-fuchsia-100 dark:bg-fuchsia-900/30',
    iconColor: 'text-fuchsia-600 dark:text-fuchsia-400',
    title: 'PDF Editor',
    description:
      'Add text blocks, images, annotations, and signatures to a PDF.',
    category: 'pdf',
    group: 'edit',
    action: 'pdf-editor',
  },
  {
    id: 'pdf-unlock',
    icon: ShieldOff,
    iconBg: 'bg-orange-100 dark:bg-orange-900/30',
    iconColor: 'text-orange-600 dark:text-orange-400',
    title: 'Unlock PDF',
    description: 'Remove password protection and restrictions from a PDF.',
    category: 'pdf',
    group: 'secure',
    action: 'pdf-unlock',
  },
  {
    id: 'pdf-page-numbers',
    icon: Hash,
    iconBg: 'bg-indigo-100 dark:bg-indigo-900/30',
    iconColor: 'text-indigo-600 dark:text-indigo-400',
    title: 'Add Page Numbers',
    description: 'Insert page numbers with customizable position and format.',
    category: 'pdf',
    group: 'organize',
    action: 'pdf-page-numbers',
  },
  {
    id: 'pdf-organize',
    icon: ArrowUpDown,
    iconBg: 'bg-violet-100 dark:bg-violet-900/30',
    iconColor: 'text-violet-600 dark:text-violet-400',
    title: 'Organize PDF',
    description: 'Reorder, remove, or rearrange pages in your PDF.',
    category: 'pdf',
    group: 'organize',
    action: 'pdf-organize',
  },
  {
    id: 'pdf-crop',
    icon: Crop,
    iconBg: 'bg-lime-100 dark:bg-lime-900/30',
    iconColor: 'text-lime-600 dark:text-lime-400',
    title: 'Crop PDF',
    description: 'Trim margins from all pages of a PDF document.',
    category: 'pdf',
    group: 'organize',
    action: 'pdf-crop',
  },
  {
    id: 'pdf-metadata',
    icon: FileCog,
    iconBg: 'bg-teal-100 dark:bg-teal-900/30',
    iconColor: 'text-teal-600 dark:text-teal-400',
    title: 'Edit Metadata',
    description:
      'View and edit PDF document properties like title, author, and keywords.',
    category: 'pdf',
    group: 'optimize',
    action: 'pdf-metadata',
  },
  {
    id: 'pdf-sign',
    icon: FileSignature,
    iconBg: 'bg-emerald-100 dark:bg-emerald-900/30',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    title: 'Sign PDF',
    description: 'Add your signature to any page of a PDF document.',
    category: 'pdf',
    group: 'secure',
    action: 'pdf-sign',
  },
  {
    id: 'pdf-repair',
    icon: Wrench,
    iconBg: 'bg-amber-100 dark:bg-amber-900/30',
    iconColor: 'text-amber-600 dark:text-amber-400',
    title: 'Repair PDF',
    description: 'Attempt to fix corrupted or damaged PDF files.',
    category: 'pdf',
    group: 'optimize',
    action: 'pdf-repair',
  },
  {
    id: 'logo-gen',
    icon: Sparkles,
    iconBg: 'bg-amber-100 dark:bg-amber-900/30',
    iconColor: 'text-amber-600 dark:text-amber-400',
    title: 'AI Favicon Generator',
    description:
      'Generate favicon concepts and icon directions in AI Studio, then export them across img-man.',
    badge: 'AI',
    category: 'image',
    action: 'link',
    href: '/dashboard/ai',
    aiFeatureKeys: ['generate'],
  },
  {
    id: 'img-to-svg',
    icon: VectorSquare,
    iconBg: 'bg-emerald-100 dark:bg-emerald-900/30',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    title: 'Image to SVG',
    description: 'Convert raster images to SVG vector format.',
    category: 'image',
    action: 'vectorize',
  },
  {
    id: 'favicon-studio',
    icon: Package,
    iconBg: 'bg-amber-100 dark:bg-amber-900/30',
    iconColor: 'text-amber-600 dark:text-amber-400',
    title: 'Favicon Studio',
    description:
      'Generate favicon packages, convert icon formats, and inspect site icons.',
    badge: 'Favicon',
    category: 'image',
    action: 'link',
    href: '/dashboard/tools/favicon',
  },
  ...FAVICON_IMAGE_TOOLS,
  {
    id: 'bg-remover',
    icon: Eraser,
    iconBg: 'bg-pink-100 dark:bg-pink-900/30',
    iconColor: 'text-pink-600 dark:text-pink-400',
    title: 'Background Remover',
    description: 'Automatically remove backgrounds from images using AI.',
    category: 'image',
    action: 'link',
    href: '/dashboard/ai',
    aiFeatureKeys: ['bg_remove'],
  },
  {
    id: 'compressor',
    icon: Minimize2,
    iconBg: 'bg-cyan-100 dark:bg-cyan-900/30',
    iconColor: 'text-cyan-600 dark:text-cyan-400',
    title: 'Batch Compressor',
    description:
      'Compress & resize multiple images at once with quality control.',
    category: 'batch',
    action: 'compressor',
  },
  {
    id: 'batch-rename',
    icon: Type,
    iconBg: 'bg-indigo-100 dark:bg-indigo-900/30',
    iconColor: 'text-indigo-600 dark:text-indigo-400',
    title: 'Batch Rename',
    description:
      'Rename files with pattern templates like {original}, {counter}, {date}.',
    category: 'batch',
    action: 'batch-rename',
  },
];

/* ─── Image Resizer Modal ───────────────────────────────── */

type OutputFormat = 'image/png' | 'image/jpeg' | 'image/webp';

interface ResizerState {
  file: File | null;
  previewUrl: string | null;
  width: string;
  height: string;
  naturalWidth: number;
  naturalHeight: number;
  lockAspect: boolean;
  format: OutputFormat;
  quality: number;
  processing: boolean;
}

function ImageResizerModal({ onClose }: { onClose: () => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [state, setState] = useState<ResizerState>({
    file: null,
    previewUrl: null,
    width: '',
    height: '',
    naturalWidth: 0,
    naturalHeight: 0,
    lockAspect: true,
    format: 'image/png',
    quality: 90,
    processing: false,
  });

  const handleFileChange = useCallback((file: File | null) => {
    if (!file || !file.type.startsWith('image/')) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setState((s) => ({
        ...s,
        file,
        previewUrl: url,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        width: String(img.naturalWidth),
        height: String(img.naturalHeight),
      }));
    };
    img.src = url;
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      handleFileChange(file);
    },
    [handleFileChange],
  );

  const handleWidthChange = useCallback(
    (val: string) => {
      const w = parseInt(val, 10);
      if (state.lockAspect && state.naturalWidth > 0 && !isNaN(w)) {
        const ratio = state.naturalHeight / state.naturalWidth;
        setState((s) => ({
          ...s,
          width: val,
          height: String(Math.round(w * ratio)),
        }));
      } else {
        setState((s) => ({ ...s, width: val }));
      }
    },
    [state.lockAspect, state.naturalWidth, state.naturalHeight],
  );

  const handleHeightChange = useCallback(
    (val: string) => {
      const h = parseInt(val, 10);
      if (state.lockAspect && state.naturalHeight > 0 && !isNaN(h)) {
        const ratio = state.naturalWidth / state.naturalHeight;
        setState((s) => ({
          ...s,
          height: val,
          width: String(Math.round(h * ratio)),
        }));
      } else {
        setState((s) => ({ ...s, height: val }));
      }
    },
    [state.lockAspect, state.naturalWidth, state.naturalHeight],
  );

  const handleResize = useCallback(async () => {
    if (!state.file || !state.previewUrl) return;
    const w = parseInt(state.width, 10);
    const h = parseInt(state.height, 10);
    if (isNaN(w) || isNaN(h) || w <= 0 || h <= 0) return;

    setState((s) => ({ ...s, processing: true }));
    try {
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = state.previewUrl!;
      });
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, w, h);

      const quality =
        state.format === 'image/png' ? undefined : state.quality / 100;
      const blob = await new Promise<Blob | null>((res) =>
        canvas.toBlob(res, state.format, quality),
      );
      if (!blob) return;

      const extMap: Record<string, string> = {
        'image/png': 'png',
        'image/jpeg': 'jpg',
        'image/webp': 'webp',
      };
      const ext = extMap[state.format] ?? 'png';
      const baseName = state.file.name.replace(/\.[^.]+$/, '');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${baseName}_${w}x${h}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setState((s) => ({ ...s, processing: false }));
    }
  }, [state]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div
        className="relative w-full max-w-2xl rounded-2xl border border-dash-border bg-dash-surface shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-dash-border px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-dash-text">
              Image Resizer
            </h2>
            <p className="text-xs text-dash-text-muted mt-0.5">
              Resize and convert images in your browser
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-dash-text-muted hover:bg-dash-surface-hover hover:text-dash-text transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Drop zone / preview */}
          <div
            className={`relative flex items-center justify-center rounded-xl border-2 border-dashed transition-colors cursor-pointer ${
              state.previewUrl
                ? 'border-dash-border bg-dash-muted h-48'
                : 'border-dash-border bg-dash-muted hover:border-[var(--im-primary)]/60 hover:bg-[var(--im-primary-light)] h-36'
            }`}
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => !state.previewUrl && fileInputRef.current?.click()}
          >
            {state.previewUrl ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={state.previewUrl}
                  alt="Preview"
                  className="max-h-44 max-w-full rounded-lg object-contain shadow"
                />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (state.previewUrl) URL.revokeObjectURL(state.previewUrl);
                    setState((s) => ({
                      ...s,
                      file: null,
                      previewUrl: null,
                      width: '',
                      height: '',
                      naturalWidth: 0,
                      naturalHeight: 0,
                    }));
                  }}
                  className="absolute right-2 top-2 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
                  title="Remove image"
                >
                  <X className="h-3 w-3" />
                </button>
                <div className="absolute bottom-2 left-2 rounded-md bg-black/60 px-2 py-0.5 text-[10px] text-white">
                  {state.naturalWidth} × {state.naturalHeight}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center gap-2 text-dash-text-muted">
                <ScanLine className="h-8 w-8" />
                <p className="text-sm font-medium">
                  Drop an image or click to upload
                </p>
                <p className="text-xs">PNG, JPEG, WEBP, GIF, BMP supported</p>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
            />
          </div>

          {/* Browse Library button */}
          {!state.previewUrl && (
            <button
              onClick={() => setShowPicker(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-dash-border bg-dash-muted hover:border-[var(--im-primary)]/60 hover:bg-[var(--im-primary-light)] h-10 cursor-pointer transition-colors text-dash-text-muted"
              data-testid="resizer-browse"
            >
              <Library className="h-4 w-4" />
              <span className="text-xs font-medium">
                Or browse from your library
              </span>
            </button>
          )}

          {/* Dimensions */}
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-dash-text2 mb-1">
                Width (px)
              </label>
              <input
                type="number"
                min={1}
                value={state.width}
                onChange={(e) => handleWidthChange(e.target.value)}
                disabled={!state.file}
                className="w-full rounded-lg border border-dash-border bg-dash-muted px-3 py-2 text-sm text-dash-text outline-none focus:border-[var(--im-primary)] focus:ring-2 focus:ring-[var(--im-primary)]/20 disabled:opacity-50"
                placeholder="Width"
              />
            </div>
            <button
              onClick={() =>
                setState((s) => ({ ...s, lockAspect: !s.lockAspect }))
              }
              className={`mt-5 rounded-lg p-2 transition-colors border ${
                state.lockAspect
                  ? 'bg-[var(--im-primary)] border-[var(--im-primary)] text-[var(--im-primary-fg)]'
                  : 'border-dash-border bg-dash-muted text-dash-text-muted hover:bg-dash-surface-hover'
              }`}
              title={
                state.lockAspect
                  ? 'Aspect ratio locked'
                  : 'Aspect ratio unlocked'
              }
            >
              {state.lockAspect ? (
                <LinkIcon className="h-4 w-4" />
              ) : (
                <Unlink className="h-4 w-4" />
              )}
            </button>
            <div className="flex-1">
              <label className="block text-xs font-medium text-dash-text2 mb-1">
                Height (px)
              </label>
              <input
                type="number"
                min={1}
                value={state.height}
                onChange={(e) => handleHeightChange(e.target.value)}
                disabled={!state.file}
                className="w-full rounded-lg border border-dash-border bg-dash-muted px-3 py-2 text-sm text-dash-text outline-none focus:border-[var(--im-primary)] focus:ring-2 focus:ring-[var(--im-primary)]/20 disabled:opacity-50"
                placeholder="Height"
              />
            </div>
          </div>

          {/* Format + Quality */}
          <div className="flex items-end gap-4">
            <div className="flex-1">
              <label className="block text-xs font-medium text-dash-text2 mb-1">
                Output Format
              </label>
              <div className="relative">
                <select
                  value={state.format}
                  onChange={(e) =>
                    setState((s) => ({
                      ...s,
                      format: e.target.value as OutputFormat,
                    }))
                  }
                  className="w-full appearance-none rounded-lg border border-dash-border bg-dash-muted px-3 py-2 pr-8 text-sm text-dash-text outline-none focus:border-[var(--im-primary)] focus:ring-2 focus:ring-[var(--im-primary)]/20 cursor-pointer"
                >
                  <option value="image/png">PNG</option>
                  <option value="image/jpeg">JPEG</option>
                  <option value="image/webp">WEBP</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-dash-text-muted" />
              </div>
            </div>
            {state.format !== 'image/png' && (
              <div className="flex-1">
                <label className="block text-xs font-medium text-dash-text2 mb-1">
                  Quality:{' '}
                  <span className="text-dash-text">{state.quality}%</span>
                </label>
                <input
                  type="range"
                  min={1}
                  max={100}
                  value={state.quality}
                  onChange={(e) =>
                    setState((s) => ({ ...s, quality: Number(e.target.value) }))
                  }
                  className="w-full accent-[var(--im-primary)] cursor-pointer"
                />
              </div>
            )}
          </div>

          {/* Action button */}
          <button
            onClick={handleResize}
            disabled={!state.file || state.processing}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--im-primary)] px-4 py-2.5 text-sm font-semibold text-[var(--im-primary-fg)] shadow-sm transition hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {state.processing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing…
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Resize &amp; Download
              </>
            )}
          </button>
        </div>
      </div>

      {/* Asset Picker overlay */}
      {showPicker && (
        <AssetPicker
          accept="image/*"
          multiple={false}
          onClose={() => setShowPicker(false)}
          onSelect={(files) => {
            setShowPicker(false);
            if (files[0]) handleFileChange(files[0]);
          }}
        />
      )}
    </div>
  );
}

/* ─── Main Tools Page ───────────────────────────────────── */

export default function ToolsClient({
  initialTab = 'all',
  title = 'Tools',
  description = 'Productivity tools for images and documents',
  hideTabs = false,
}: ToolsClientProps) {
  const router = useRouter();
  const { areFeaturesEnabled } = useAiFeatureAccess();
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ToolCategory | 'all'>(initialTab);

  const availableTabs = hideTabs
    ? TABS.filter((tab) => tab.key === activeTab)
    : TABS;
  const isPdfSuite = hideTabs && activeTab === 'pdf';

  const filteredTools =
    activeTab === 'all' ? TOOLS : TOOLS.filter((t) => t.category === activeTab);
  const groupedPdfTools = PDF_GROUPS.map((group) => ({
    ...group,
    tools: filteredTools.filter((tool) => tool.group === group.key),
  })).filter((group) => group.tools.length > 0);

  const handleLaunch = useCallback(
    (tool: ToolDef) => {
      if (tool.action === 'link' && tool.href) {
        router.push(tool.href);
      } else if (tool.action !== 'coming-soon') {
        setActiveModal(tool.action);
      }
      // 'coming-soon' does nothing (button is disabled)
    },
    [router],
  );

  const renderToolCard = (tool: ToolDef) => {
    const Icon = tool.icon;
    const isComingSoon = tool.action === 'coming-soon';
    const isAiTool = tool.aiFeatureKeys !== undefined;
    const isAiEnabled = !isAiTool || areFeaturesEnabled(tool.aiFeatureKeys);
    const isDisabled = isComingSoon || !isAiEnabled;

    return (
      <div
        key={tool.id}
        className={`group relative flex flex-col gap-4 rounded-2xl border border-dash-border bg-dash-surface p-5 transition-all ${
          isDisabled
            ? 'opacity-75'
            : 'hover:border-[var(--im-primary)]/40 hover:shadow-lg'
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div
            className={`flex h-11 w-11 items-center justify-center rounded-xl ${tool.iconBg}`}
          >
            <Icon className={`h-5 w-5 ${tool.iconColor}`} />
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {isAiTool && <AiBadge disabled={!isAiEnabled} />}
            {tool.badge && (
              <span className="rounded-full bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                {tool.badge}
              </span>
            )}
          </div>
        </div>

        <div className="flex-1">
          <h3 className="text-sm font-semibold text-dash-text">{tool.title}</h3>
          <p className="mt-1 text-xs leading-relaxed text-dash-text2">
            {tool.description}
          </p>
          {isAiTool && !isAiEnabled && (
            <p className="mt-2 text-xs text-dash-text-muted">
              Disabled by your organization&apos;s AI settings.
            </p>
          )}
        </div>

        <button
          onClick={() => {
            if (!isDisabled) {
              handleLaunch(tool);
            }
          }}
          disabled={isDisabled}
          className={`self-start rounded-lg px-4 py-2 text-xs font-semibold transition-colors ${
            isDisabled
              ? 'cursor-not-allowed bg-dash-muted text-dash-text-muted'
              : 'bg-[var(--im-primary)] text-[var(--im-primary-fg)] hover:brightness-110 active:scale-95 shadow-sm'
          }`}
        >
          {isComingSoon
            ? 'Coming Soon'
            : !isAiEnabled
              ? 'Disabled in Settings'
              : 'Launch'}
        </button>
      </div>
    );
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-dash-text">{title}</h1>
        <p className="mt-0.5 text-sm text-dash-text2">
          {description}
        </p>
      </div>

      {isPdfSuite && (
        <div className="mb-6 rounded-2xl border border-dash-border bg-dash-surface px-5 py-4">
          <div className="flex flex-wrap items-center gap-3 text-xs text-dash-text2">
            <span className="rounded-full bg-[var(--im-primary-light)] px-2.5 py-1 font-semibold text-[var(--im-primary)]">
              {filteredTools.length} live PDF tools
            </span>
            <span>{groupedPdfTools.length} workflow groups</span>
            <span>Client-side today, server-backed APIs next</span>
          </div>
        </div>
      )}

      {/* Category tabs */}
      {!hideTabs && (
        <div
          className="mb-6 flex gap-1 rounded-xl bg-dash-muted p-1"
          data-testid="tools-tabs"
        >
          {availableTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition-all ${
                activeTab === tab.key
                  ? 'bg-dash-surface text-dash-text shadow-sm'
                  : 'text-dash-text-muted hover:text-dash-text'
              }`}
              data-testid={`tab-${tab.key}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Tool cards grid */}
      {isPdfSuite ? (
        <div className="space-y-8" data-testid="pdf-suite-groups">
          {groupedPdfTools.map((group) => (
            <section key={group.key} data-testid={`pdf-group-${group.key}`}>
              <div className="mb-3">
                <h2 className="text-base font-semibold text-dash-text">
                  {group.title}
                </h2>
                <p className="mt-1 text-xs text-dash-text2">
                  {group.description}
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {group.tools.map(renderToolCard)}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredTools.map(renderToolCard)}
        </div>
      )}

      {/* Image Resizer Modal */}
      {activeModal === 'resizer' && (
        <ImageResizerModal onClose={() => setActiveModal(null)} />
      )}

      {/* PDF Merge Modal */}
      {activeModal === 'pdf-merge' && (
        <PdfMergeModal onClose={() => setActiveModal(null)} />
      )}

      {/* Images to PDF Modal */}
      {activeModal === 'images-to-pdf' && (
        <ImgToPdfModal onClose={() => setActiveModal(null)} />
      )}

      {/* Vectorize Modal */}
      {activeModal === 'vectorize' && (
        <VectorizeModal onClose={() => setActiveModal(null)} />
      )}

      {/* Compressor Modal */}
      {activeModal === 'compressor' && (
        <CompressorModal onClose={() => setActiveModal(null)} />
      )}

      {/* Batch Rename Modal */}
      {activeModal === 'batch-rename' && (
        <BatchRenameModal onClose={() => setActiveModal(null)} />
      )}

      {/* PDF Split Modal */}
      {activeModal === 'pdf-split' && (
        <PdfSplitModal onClose={() => setActiveModal(null)} />
      )}

      {/* PDF Compress Modal */}
      {activeModal === 'pdf-compress' && (
        <PdfCompressModal onClose={() => setActiveModal(null)} />
      )}

      {/* PDF Rotate Modal */}
      {activeModal === 'pdf-rotate' && (
        <PdfRotateModal onClose={() => setActiveModal(null)} />
      )}

      {/* PDF Watermark Modal */}
      {activeModal === 'pdf-watermark' && (
        <PdfWatermarkModal onClose={() => setActiveModal(null)} />
      )}

      {/* PDF Page Extract Modal */}
      {activeModal === 'pdf-page-extract' && (
        <PdfPageExtractModal onClose={() => setActiveModal(null)} />
      )}

      {/* PDF to Image Modal */}
      {activeModal === 'pdf-to-image' && (
        <PdfToImageModal onClose={() => setActiveModal(null)} />
      )}

      {/* PDF Password Protect Modal */}
      {activeModal === 'pdf-protect' && (
        <PdfProtectModal onClose={() => setActiveModal(null)} />
      )}

      {/* OCR Scanner Modal */}
      {activeModal === 'pdf-ocr' && (
        <PdfOcrModal onClose={() => setActiveModal(null)} />
      )}

      {/* PDF Editor Modal */}
      {activeModal === 'pdf-editor' && (
        <PdfEditorModal onClose={() => setActiveModal(null)} />
      )}

      {/* PDF Unlock Modal */}
      {activeModal === 'pdf-unlock' && (
        <PdfUnlockModal onClose={() => setActiveModal(null)} />
      )}

      {/* PDF Page Numbers Modal */}
      {activeModal === 'pdf-page-numbers' && (
        <PdfPageNumbersModal onClose={() => setActiveModal(null)} />
      )}

      {/* PDF Organize Modal */}
      {activeModal === 'pdf-organize' && (
        <PdfOrganizeModal onClose={() => setActiveModal(null)} />
      )}

      {/* PDF Crop Modal */}
      {activeModal === 'pdf-crop' && (
        <PdfCropModal onClose={() => setActiveModal(null)} />
      )}

      {/* PDF Metadata Modal */}
      {activeModal === 'pdf-metadata' && (
        <PdfMetadataModal onClose={() => setActiveModal(null)} />
      )}

      {/* PDF Sign Modal */}
      {activeModal === 'pdf-sign' && (
        <PdfSignModal onClose={() => setActiveModal(null)} />
      )}

      {/* PDF Repair Modal */}
      {activeModal === 'pdf-repair' && (
        <PdfRepairModal onClose={() => setActiveModal(null)} />
      )}
    </div>
  );
}
