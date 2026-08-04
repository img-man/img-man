// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';

import { detectKind, validateUpload } from '@/lib/upload-validation';

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
const GIF = new Uint8Array([...str('GIF89a'), 0, 0, 0, 0]);
const PDF = new Uint8Array([...str('%PDF-1.4'), 0, 0]);
const WEBP = new Uint8Array([...str('RIFF'), 0, 0, 0, 0, ...str('WEBP'), 0, 0, 0, 0]);
const MP4 = new Uint8Array([0, 0, 0, 0x18, ...str('ftyp'), ...str('mp42'), 0, 0, 0, 0]);
const AVIF = new Uint8Array([0, 0, 0, 0x18, ...str('ftyp'), ...str('avif'), 0, 0, 0, 0]);
const EXE = new Uint8Array([0x4d, 0x5a, 0, 0, 0, 0, 0, 0]);
const ELF = new Uint8Array([0x7f, 0x45, 0x4c, 0x46, 0, 0, 0, 0]);
const SH = new Uint8Array([0x23, 0x21, ...str('/bin/sh\n'), 0]);
const SVG = new Uint8Array(str('<svg xmlns="http://www.w3.org/2000/svg"></svg>'));
const SVG_WITH_SCRIPT = new Uint8Array(str('<svg><script>alert(1)</script></svg>'));

function str(s: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < s.length; i++) out.push(s.charCodeAt(i));
  return out;
}

describe('detectKind (D57)', () => {
  it('detects common image formats by magic bytes', () => {
    expect(detectKind(PNG).kind).toBe('image/png');
    expect(detectKind(JPEG).kind).toBe('image/jpeg');
    expect(detectKind(GIF).kind).toBe('image/gif');
    expect(detectKind(WEBP).kind).toBe('image/webp');
    expect(detectKind(AVIF).kind).toBe('image/avif');
  });
  it('detects mp4 and pdf', () => {
    expect(detectKind(MP4).kind).toBe('video/mp4');
    expect(detectKind(PDF).kind).toBe('application/pdf');
  });
  it('detects executables and shell scripts', () => {
    expect(detectKind(EXE).kind).toBe('application/x-msdownload');
    expect(detectKind(ELF).kind).toBe('application/x-elf');
    expect(detectKind(SH).kind).toBe('application/x-shellscript');
  });
  it('detects SVG by content sniffing', () => {
    expect(detectKind(SVG).kind).toBe('image/svg+xml');
  });
  it('returns octet-stream for unknown bytes', () => {
    expect(detectKind(new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])).kind).toBe(
      'application/octet-stream',
    );
  });
});

describe('validateUpload (D57)', () => {
  it('accepts a valid PNG with matching declared MIME', () => {
    const r = validateUpload({ bytes: PNG, declaredMime: 'image/png', filename: 'a.png' });
    expect(r.ok).toBe(true);
    expect(r.detected).toBe('image/png');
  });
  it('rejects empty files', () => {
    const r = validateUpload({ bytes: new Uint8Array(0) });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/empty/i);
  });
  it('rejects executables even when declared as image/png', () => {
    const r = validateUpload({ bytes: EXE, declaredMime: 'image/png', filename: 'a.png' });
    expect(r.ok).toBe(false);
    expect(r.detected).toBe('application/x-msdownload');
    expect(r.reason).toMatch(/Executable/);
  });
  it('rejects ELF, shell scripts, and Mach-O', () => {
    expect(validateUpload({ bytes: ELF }).ok).toBe(false);
    expect(validateUpload({ bytes: SH }).ok).toBe(false);
  });
  it('rejects mismatched MIME family (image declared, application detected)', () => {
    const r = validateUpload({ bytes: PDF, declaredMime: 'image/png' });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/contradict/);
  });
  it('rejects SVG with <script>', () => {
    const r = validateUpload({ bytes: SVG_WITH_SCRIPT, declaredMime: 'image/svg+xml' });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/active content/);
  });
  it('accepts safe SVG', () => {
    const r = validateUpload({ bytes: SVG, declaredMime: 'image/svg+xml' });
    expect(r.ok).toBe(true);
  });
  it('rejects file types outside the allowlist', () => {
    const r = validateUpload({
      bytes: PDF,
      declaredMime: 'application/pdf',
      allow: ['image/png', 'image/jpeg'],
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/allowlist/);
  });
});
