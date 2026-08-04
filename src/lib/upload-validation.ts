// SPDX-License-Identifier: Apache-2.0
/**
 * Upload validation (D57).
 *
 * Defends the upload pipeline against:
 *   - Mismatched Content-Type (client-asserted) vs actual file bytes.
 *   - Polyglot files trying to smuggle a script under an image extension.
 *   - Executable formats that have no business being uploaded as media.
 *
 * Pure functions over the **first 16 bytes** of the file. Safe to call from
 * the edge runtime, the API route, the worker, and the SDK. No I/O.
 */

export type DetectedKind =
  | 'image/jpeg'
  | 'image/png'
  | 'image/gif'
  | 'image/webp'
  | 'image/avif'
  | 'image/heic'
  | 'image/svg+xml'
  | 'image/bmp'
  | 'image/tiff'
  | 'video/mp4'
  | 'video/webm'
  | 'video/quicktime'
  | 'application/pdf'
  | 'application/zip'
  | 'application/x-msdownload'  // PE / .exe / .dll
  | 'application/x-elf'         // ELF binaries
  | 'application/x-mach-binary' // Mach-O
  | 'application/x-shellscript'
  | 'application/octet-stream';

export interface DetectionResult {
  kind: DetectedKind;
  /** Whether the magic bytes were a known signature (vs heuristic/fallback). */
  confident: boolean;
}

/** Allowed kinds for the default media uploader. */
export const DEFAULT_ALLOWED_KINDS: readonly DetectedKind[] = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/avif',
  'image/heic',
  'image/svg+xml',
  'image/bmp',
  'image/tiff',
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'application/pdf',
];

/** Kinds that are ALWAYS rejected regardless of allowlist. */
export const FORBIDDEN_KINDS: readonly DetectedKind[] = [
  'application/x-msdownload',
  'application/x-elf',
  'application/x-mach-binary',
  'application/x-shellscript',
];

export interface ValidateUploadInput {
  bytes: Uint8Array;
  /** Client-claimed MIME from the request (multipart, fetch, etc.). */
  declaredMime?: string;
  /** Original filename (used only for SVG / text disambiguation). */
  filename?: string;
  /** Override allowlist; defaults to DEFAULT_ALLOWED_KINDS. */
  allow?: readonly DetectedKind[];
}

export interface ValidateUploadResult {
  ok: boolean;
  detected: DetectedKind;
  confident: boolean;
  /** Present when `ok === false`. */
  reason?: string;
}

/**
 * Sniff the magic bytes of `bytes` and return a coarse media kind.
 * Returns `application/octet-stream` if no signature matched.
 */
export function detectKind(bytes: Uint8Array, filename?: string): DetectionResult {
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (starts(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { kind: 'image/png', confident: true };
  }
  // JPEG: FF D8 FF
  if (starts(bytes, [0xff, 0xd8, 0xff])) {
    return { kind: 'image/jpeg', confident: true };
  }
  // GIF87a / GIF89a
  if (starts(bytes, asciiBytes('GIF87a')) || starts(bytes, asciiBytes('GIF89a'))) {
    return { kind: 'image/gif', confident: true };
  }
  // BMP: 'BM'
  if (starts(bytes, [0x42, 0x4d])) return { kind: 'image/bmp', confident: true };
  // TIFF: II*\0 or MM\0*
  if (starts(bytes, [0x49, 0x49, 0x2a, 0x00]) || starts(bytes, [0x4d, 0x4d, 0x00, 0x2a])) {
    return { kind: 'image/tiff', confident: true };
  }
  // PDF: %PDF-
  if (starts(bytes, asciiBytes('%PDF-'))) {
    return { kind: 'application/pdf', confident: true };
  }
  // RIFF container — WEBP at bytes 8..12 = 'WEBP'
  if (starts(bytes, asciiBytes('RIFF')) && starts(bytes.subarray(8), asciiBytes('WEBP'))) {
    return { kind: 'image/webp', confident: true };
  }
  // ISO BMFF (mp4/heic/avif) — bytes 4..8 = 'ftyp', then brand at 8..12.
  if (bytes.length >= 12 && starts(bytes.subarray(4), asciiBytes('ftyp'))) {
    const brand = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
    if (brand === 'avif' || brand === 'avis') return { kind: 'image/avif', confident: true };
    if (brand.startsWith('heic') || brand.startsWith('heix') || brand === 'mif1') {
      return { kind: 'image/heic', confident: true };
    }
    if (brand === 'qt  ') return { kind: 'video/quicktime', confident: true };
    return { kind: 'video/mp4', confident: true };
  }
  // Matroska / WebM: 1A 45 DF A3 (EBML header)
  if (starts(bytes, [0x1a, 0x45, 0xdf, 0xa3])) {
    return { kind: 'video/webm', confident: true };
  }
  // ZIP: PK\003\004
  if (starts(bytes, [0x50, 0x4b, 0x03, 0x04])) {
    return { kind: 'application/zip', confident: true };
  }
  // PE / Windows EXE / DLL: 'MZ'
  if (starts(bytes, [0x4d, 0x5a])) return { kind: 'application/x-msdownload', confident: true };
  // ELF
  if (starts(bytes, [0x7f, 0x45, 0x4c, 0x46])) return { kind: 'application/x-elf', confident: true };
  // Mach-O (32/64, BE/LE)
  if (
    starts(bytes, [0xfe, 0xed, 0xfa, 0xce])
    || starts(bytes, [0xfe, 0xed, 0xfa, 0xcf])
    || starts(bytes, [0xcf, 0xfa, 0xed, 0xfe])
    || starts(bytes, [0xce, 0xfa, 0xed, 0xfe])
  ) {
    return { kind: 'application/x-mach-binary', confident: true };
  }
  // Shebang
  if (starts(bytes, [0x23, 0x21])) {
    return { kind: 'application/x-shellscript', confident: true };
  }

  // SVG — only by content sniffing, since it's text. Look for '<svg' or
  // '<?xml ... <svg' in the leading bytes. Filename hint helps but isn't trusted alone.
  const head = decodeAsciiLossy(bytes.subarray(0, 256)).toLowerCase().trimStart();
  if (head.startsWith('<svg') || (head.startsWith('<?xml') && head.includes('<svg'))) {
    return { kind: 'image/svg+xml', confident: true };
  }
  if (filename && /\.svg$/i.test(filename) && head.startsWith('<')) {
    // Treat as SVG only if it at least starts with an element \u2014 still flag as
    // less confident.
    return { kind: 'image/svg+xml', confident: false };
  }

  return { kind: 'application/octet-stream', confident: false };
}

/**
 * Validate a candidate upload. Returns `ok: false` if the file is forbidden,
 * not in the allowlist, or its real bytes contradict the declared MIME.
 */
export function validateUpload(input: ValidateUploadInput): ValidateUploadResult {
  const { bytes, declaredMime, filename, allow = DEFAULT_ALLOWED_KINDS } = input;

  if (!bytes || bytes.length === 0) {
    return {
      ok: false,
      detected: 'application/octet-stream',
      confident: false,
      reason: 'Empty file',
    };
  }

  const detection = detectKind(bytes, filename);

  if (FORBIDDEN_KINDS.includes(detection.kind)) {
    return {
      ok: false,
      detected: detection.kind,
      confident: detection.confident,
      reason: `Executable / script files are not allowed (detected ${detection.kind})`,
    };
  }

  if (!allow.includes(detection.kind)) {
    return {
      ok: false,
      detected: detection.kind,
      confident: detection.confident,
      reason: `File type ${detection.kind} is not in the upload allowlist`,
    };
  }

  // SVG can carry script tags. Reject if `<script` appears anywhere in the
  // first 4 KiB of the file. Stronger sanitization happens server-side before
  // serving, but this catches the obvious cases at upload.
  if (detection.kind === 'image/svg+xml') {
    const sample = decodeAsciiLossy(bytes.subarray(0, 4096)).toLowerCase();
    if (sample.includes('<script') || sample.includes('javascript:') || sample.includes('onload=')) {
      return {
        ok: false,
        detected: detection.kind,
        confident: detection.confident,
        reason: 'SVG contains active content (script / event handlers)',
      };
    }
  }

  // Cross-check against client-declared MIME. We only fail when the declared
  // type is in a different *family* than the detected one (e.g. image/png
  // claimed but bytes are application/x-msdownload). Sub-type drift like
  // image/jpg vs image/jpeg is tolerated.
  if (declaredMime) {
    const declaredFamily = declaredMime.split('/')[0];
    const detectedFamily = detection.kind.split('/')[0];
    if (declaredFamily && detectedFamily && declaredFamily !== detectedFamily) {
      return {
        ok: false,
        detected: detection.kind,
        confident: detection.confident,
        reason: `Declared MIME ${declaredMime} contradicts detected ${detection.kind}`,
      };
    }
  }

  return { ok: true, detected: detection.kind, confident: detection.confident };
}

// ── helpers ───────────────────────────────────────────────────────────────

function starts(bytes: Uint8Array, sig: ArrayLike<number>): boolean {
  if (bytes.length < sig.length) return false;
  for (let i = 0; i < sig.length; i++) {
    if (bytes[i] !== sig[i]) return false;
  }
  return true;
}

function asciiBytes(s: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < s.length; i++) out.push(s.charCodeAt(i));
  return out;
}

function decodeAsciiLossy(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    const c = bytes[i];
    out += c >= 0x20 && c < 0x7f ? String.fromCharCode(c) : c === 0x0a || c === 0x0d || c === 0x09 ? String.fromCharCode(c) : ' ';
  }
  return out;
}
