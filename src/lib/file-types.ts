// SPDX-License-Identifier: Apache-2.0
/**
 * Centralised file-type → icon / colour / label mapping.
 *
 * To add a new extension or MIME type to an existing category, just append it
 * to the `mimePatterns` array – no other code changes needed.
 */

import {
  FileText,
  FileSpreadsheet,
  Presentation,
  FileCode,
  FileArchive,
  FileVideo,
  FileAudio,
  File,
  type LucideIcon,
} from 'lucide-react';

/* ─── Category definition ────────────────────────────────────── */

export interface FileTypeCategory {
  /** Lucide icon component */
  icon: LucideIcon;
  /** Tailwind text-colour class */
  color: string;
  /** Tailwind background class (light + dark) */
  bg: string;
  /** Short uppercase label shown in thumbnail */
  label: string;
  /**
   * Strings matched against the full MIME type.
   * A match is found when `mimeType.includes(pattern)` is true,
   * OR when the pattern starts with `^` and is tested as a prefix.
   */
  mimePatterns: string[];
}

/* ─── Categories (order matters — first match wins) ──────────── */

export const FILE_TYPE_CATEGORIES: FileTypeCategory[] = [
  // ── Documents ─────────────────────────────────────────────────
  {
    icon: FileText,
    color: 'text-red-500',
    bg: 'bg-red-50 dark:bg-red-950',
    label: 'PDF',
    mimePatterns: ['application/pdf'],
  },
  {
    icon: FileText,
    color: 'text-blue-500',
    bg: 'bg-blue-50 dark:bg-blue-950',
    label: 'DOC',
    mimePatterns: [
      'word',
      'wordprocessingml',
      'application/msword',
      'opendocument.text', // .odt
      'application/rtf',
      'text/markdown',
    ],
  },
  {
    icon: FileSpreadsheet,
    color: 'text-emerald-500',
    bg: 'bg-emerald-50 dark:bg-emerald-950',
    label: 'XLS',
    mimePatterns: [
      'spreadsheet',
      'excel',
      'text/csv',
      'application/vnd.ms-excel',
      'tab-separated',
    ],
  },
  {
    icon: Presentation,
    color: 'text-orange-500',
    bg: 'bg-orange-50 dark:bg-orange-950',
    label: 'PPT',
    mimePatterns: [
      'presentation',
      'powerpoint',
      'application/vnd.ms-powerpoint',
      'opendocument.presentation', // .odp
    ],
  },

  // ── Media ─────────────────────────────────────────────────────
  {
    icon: FileVideo,
    color: 'text-purple-500',
    bg: 'bg-purple-50 dark:bg-purple-950',
    label: 'Video',
    mimePatterns: ['^video/'],
  },
  {
    icon: FileAudio,
    color: 'text-pink-500',
    bg: 'bg-pink-50 dark:bg-pink-950',
    label: 'Audio',
    mimePatterns: ['^audio/'],
  },

  // ── Archives ──────────────────────────────────────────────────
  {
    icon: FileArchive,
    color: 'text-amber-500',
    bg: 'bg-amber-50 dark:bg-amber-950',
    label: 'ZIP',
    mimePatterns: [
      'zip',
      'tar',
      'compressed',
      'archive',
      'x-rar',
      'x-7z',
      'x-bzip',
      'x-gzip',
    ],
  },

  // ── Code / Data ───────────────────────────────────────────────
  {
    icon: FileCode,
    color: 'text-cyan-500',
    bg: 'bg-cyan-50 dark:bg-cyan-950',
    label: 'Code',
    mimePatterns: [
      'json',
      'xml',
      'html',
      'javascript',
      'ecmascript',
      'css',
      'typescript',
      'yaml',
      'x-python',
      'x-sh',
      'x-shellscript',
      'sql',
    ],
  },

  // ── Plain text (catch-all for text/*) ─────────────────────────
  {
    icon: FileText,
    color: 'text-dash-text2',
    bg: 'bg-dash-muted dark:bg-dash-inverted-hover',
    label: 'TXT',
    mimePatterns: ['^text/'],
  },
];

/** Fallback for truly unknown MIME types */
export const FILE_TYPE_FALLBACK: Omit<FileTypeCategory, 'mimePatterns'> = {
  icon: File,
  color: 'text-dash-text-muted',
  bg: 'bg-dash-muted dark:bg-dash-inverted-hover',
  label: 'File',
};

/* ─── Lookup helper ──────────────────────────────────────────── */

export interface FileTypeInfo {
  icon: LucideIcon;
  color: string;
  bg: string;
  label: string;
}

/**
 * Given a MIME type, return the matching icon / colour / label.
 * Returns `null` for image/* since those should render a thumbnail.
 */
export function getFileTypeInfo(mimeType: string): FileTypeInfo | null {
  if (!mimeType || mimeType.startsWith('image/')) return null;

  for (const cat of FILE_TYPE_CATEGORIES) {
    for (const pattern of cat.mimePatterns) {
      if (pattern.startsWith('^')) {
        // Prefix match
        if (mimeType.startsWith(pattern.slice(1))) {
          return {
            icon: cat.icon,
            color: cat.color,
            bg: cat.bg,
            label: cat.label,
          };
        }
      } else {
        // Substring match
        if (mimeType.includes(pattern)) {
          return {
            icon: cat.icon,
            color: cat.color,
            bg: cat.bg,
            label: cat.label,
          };
        }
      }
    }
  }

  return { ...FILE_TYPE_FALLBACK };
}

/* ─── File category derivation (shared between client & server) ─ */

export type FileCategory =
  | 'image'
  | 'video'
  | 'audio'
  | 'document'
  | 'archive'
  | 'code'
  | 'other';

/**
 * Derive a broad file category from a MIME type string.
 * Used by the upload component (client) and the confirm API (server).
 */
export function getFileCategory(mimeType: string): FileCategory {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (
    mimeType === 'application/pdf' ||
    mimeType.includes('word') ||
    mimeType.includes('spreadsheet') ||
    mimeType.includes('presentation') ||
    mimeType.includes('excel') ||
    mimeType.includes('powerpoint') ||
    mimeType.includes('opendocument') ||
    mimeType === 'application/rtf' ||
    mimeType === 'text/csv'
  )
    return 'document';
  if (
    mimeType.includes('zip') ||
    mimeType.includes('tar') ||
    mimeType.includes('compressed') ||
    mimeType.includes('archive') ||
    mimeType.includes('x-rar') ||
    mimeType.includes('x-7z') ||
    mimeType.includes('gzip')
  )
    return 'archive';
  if (
    mimeType.includes('json') ||
    mimeType.includes('xml') ||
    mimeType.includes('javascript') ||
    mimeType.includes('typescript') ||
    mimeType.includes('css') ||
    mimeType.includes('html') ||
    mimeType.includes('yaml') ||
    mimeType.includes('x-python') ||
    mimeType.includes('x-sh') ||
    mimeType.includes('sql')
  )
    return 'code';
  if (mimeType.startsWith('text/')) return 'document';
  return 'other';
}

/* ─── Blocked extensions (shared between client & server) ───── */

/**
 * Executable / dangerous file extensions blocked for security.
 * Used by the upload component (client validation) and the
 * confirm API route (server-side enforcement).
 */
export const BLOCKED_EXTENSIONS = new Set([
  'exe',
  'bat',
  'cmd',
  'sh',
  'msi',
  'dll',
  'com',
  'scr',
  'pif',
  'vbs',
  'wsf',
  'wsh',
  'ps1',
  'reg',
  'inf',
  'hta',
  'cpl',
  'msp',
  'mst',
]);
