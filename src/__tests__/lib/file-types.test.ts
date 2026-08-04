// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from 'vitest';
import {
  getFileTypeInfo,
  getFileCategory,
  BLOCKED_EXTENSIONS,
} from '@/lib/file-types';

describe('getFileTypeInfo', () => {
  it('returns null for image/* (handled as thumbnail)', () => {
    expect(getFileTypeInfo('image/jpeg')).toBeNull();
    expect(getFileTypeInfo('image/png')).toBeNull();
    expect(getFileTypeInfo('image/webp')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(getFileTypeInfo('')).toBeNull();
  });

  it('identifies PDF', () => {
    const info = getFileTypeInfo('application/pdf');
    expect(info).not.toBeNull();
    expect(info!.label).toBe('PDF');
  });

  it('identifies Word documents', () => {
    const info = getFileTypeInfo('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    expect(info).not.toBeNull();
    expect(info!.label).toBe('DOC');
  });

  it('identifies Excel spreadsheets', () => {
    const info = getFileTypeInfo('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(info).not.toBeNull();
    expect(info!.label).toBe('XLS');
  });

  it('identifies CSV as spreadsheet', () => {
    const info = getFileTypeInfo('text/csv');
    expect(info).not.toBeNull();
    expect(info!.label).toBe('XLS');
  });

  it('identifies PowerPoint presentations', () => {
    const info = getFileTypeInfo('application/vnd.openxmlformats-officedocument.presentationml.presentation');
    expect(info).not.toBeNull();
    expect(info!.label).toBe('PPT');
  });

  it('identifies video files via prefix match', () => {
    const info = getFileTypeInfo('video/mp4');
    expect(info).not.toBeNull();
    expect(info!.label).toBe('Video');
  });

  it('identifies audio files via prefix match', () => {
    const info = getFileTypeInfo('audio/mpeg');
    expect(info).not.toBeNull();
    expect(info!.label).toBe('Audio');
  });

  it('identifies ZIP archives', () => {
    const info = getFileTypeInfo('application/zip');
    expect(info).not.toBeNull();
    expect(info!.label).toBe('ZIP');
  });

  it('identifies tar archives', () => {
    const info = getFileTypeInfo('application/x-tar');
    expect(info).not.toBeNull();
    expect(info!.label).toBe('ZIP');
  });

  it('identifies JSON as code', () => {
    const info = getFileTypeInfo('application/json');
    expect(info).not.toBeNull();
    expect(info!.label).toBe('Code');
  });

  it('identifies JavaScript as code', () => {
    const info = getFileTypeInfo('application/javascript');
    expect(info).not.toBeNull();
    expect(info!.label).toBe('Code');
  });

  it('identifies HTML as code', () => {
    const info = getFileTypeInfo('text/html');
    expect(info).not.toBeNull();
    expect(info!.label).toBe('Code');
  });

  it('identifies plain text via prefix match', () => {
    const info = getFileTypeInfo('text/plain');
    expect(info).not.toBeNull();
    expect(info!.label).toBe('TXT');
  });

  it('returns generic File for unknown MIME types', () => {
    const info = getFileTypeInfo('application/x-custom-unknown-binary');
    expect(info).not.toBeNull();
    expect(info!.label).toBe('File');
  });

  it('returns icon and color for all identified types', () => {
    const testMimes = [
      'application/pdf',
      'application/vnd.ms-word',
      'application/vnd.ms-excel',
      'application/vnd.ms-powerpoint',
      'video/webm',
      'audio/ogg',
      'application/zip',
      'application/json',
      'text/plain',
    ];
    for (const mime of testMimes) {
      const info = getFileTypeInfo(mime);
      expect(info, `should return info for ${mime}`).not.toBeNull();
      expect(info!.icon, `${mime} should have icon`).toBeDefined();
      expect(info!.color, `${mime} should have color`).toBeTruthy();
      expect(info!.bg, `${mime} should have bg`).toBeTruthy();
    }
  });
});

describe('getFileCategory', () => {
  it('categorizes image types', () => {
    expect(getFileCategory('image/jpeg')).toBe('image');
    expect(getFileCategory('image/png')).toBe('image');
    expect(getFileCategory('image/webp')).toBe('image');
  });

  it('categorizes video types', () => {
    expect(getFileCategory('video/mp4')).toBe('video');
    expect(getFileCategory('video/webm')).toBe('video');
  });

  it('categorizes audio types', () => {
    expect(getFileCategory('audio/mpeg')).toBe('audio');
    expect(getFileCategory('audio/ogg')).toBe('audio');
  });

  it('categorizes PDF as document', () => {
    expect(getFileCategory('application/pdf')).toBe('document');
  });

  it('categorizes Word as document', () => {
    expect(getFileCategory('application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBe('document');
  });

  it('categorizes spreadsheet as document', () => {
    expect(getFileCategory('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')).toBe('document');
  });

  it('categorizes CSV as document', () => {
    expect(getFileCategory('text/csv')).toBe('document');
  });

  it('categorizes plain text as document', () => {
    expect(getFileCategory('text/plain')).toBe('document');
  });

  it('categorizes RTF as document', () => {
    expect(getFileCategory('application/rtf')).toBe('document');
  });

  it('categorizes zip as archive', () => {
    expect(getFileCategory('application/zip')).toBe('archive');
  });

  it('categorizes gzip as archive', () => {
    expect(getFileCategory('application/x-gzip')).toBe('archive');
  });

  it('categorizes tar as archive', () => {
    expect(getFileCategory('application/x-tar')).toBe('archive');
  });

  it('categorizes JSON as code', () => {
    expect(getFileCategory('application/json')).toBe('code');
  });

  it('categorizes JavaScript as code', () => {
    expect(getFileCategory('application/javascript')).toBe('code');
  });

  it('categorizes XML as code', () => {
    expect(getFileCategory('application/xml')).toBe('code');
  });

  it('categorizes Python as code', () => {
    expect(getFileCategory('application/x-python')).toBe('code');
  });

  it('categorizes SQL as code', () => {
    expect(getFileCategory('application/sql')).toBe('code');
  });

  it('categorizes unknown as other', () => {
    expect(getFileCategory('application/x-custom-binary')).toBe('other');
  });

  it('categorizes opendocument as document', () => {
    expect(getFileCategory('application/vnd.oasis.opendocument.text')).toBe('document');
  });
});

describe('BLOCKED_EXTENSIONS', () => {
  it('is a Set', () => {
    expect(BLOCKED_EXTENSIONS).toBeInstanceOf(Set);
  });

  it('blocks common executable extensions', () => {
    const dangerous = ['exe', 'bat', 'cmd', 'sh', 'msi', 'dll', 'com', 'scr', 'vbs'];
    for (const ext of dangerous) {
      expect(BLOCKED_EXTENSIONS.has(ext), `${ext} should be blocked`).toBe(true);
    }
  });

  it('blocks script extensions', () => {
    expect(BLOCKED_EXTENSIONS.has('ps1')).toBe(true);
    expect(BLOCKED_EXTENSIONS.has('wsf')).toBe(true);
    expect(BLOCKED_EXTENSIONS.has('hta')).toBe(true);
  });

  it('does not block common media extensions', () => {
    // BLOCKED_EXTENSIONS contains file extensions, not MIME types
    // These extension strings should NOT be in the block list
    expect(BLOCKED_EXTENSIONS.has('jpg')).toBe(false);
    expect(BLOCKED_EXTENSIONS.has('png')).toBe(false);
    expect(BLOCKED_EXTENSIONS.has('pdf')).toBe(false);
    expect(BLOCKED_EXTENSIONS.has('mp4')).toBe(false);
  });
});
