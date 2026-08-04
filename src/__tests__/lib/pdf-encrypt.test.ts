// SPDX-License-Identifier: Apache-2.0
/**
 * Tests — PDF Encrypt Utility
 * Tests for the server-side PDF encryption library
 */
import { describe, it, expect } from 'vitest';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { encryptPdf } from '@/lib/pdf-encrypt';

describe('PDF Encrypt Utility', () => {
  it('exports encryptPdf function', () => {
    expect(encryptPdf).toBeDefined();
    expect(typeof encryptPdf).toBe('function');
  });

  it('encrypts a minimal PDF without throwing', async () => {
    // Create a minimal test PDF
    const doc = await PDFDocument.create();
    doc.addPage([200, 200]);
    const pdfBytes = await doc.save();

    const encrypted = await encryptPdf(new Uint8Array(pdfBytes), {
      userPassword: 'test123',
    });

    expect(encrypted).toBeInstanceOf(Uint8Array);
    expect(encrypted.length).toBeGreaterThan(0);
    // Encrypted PDF should still start with %PDF
    const header = new TextDecoder().decode(encrypted.subarray(0, 5));
    expect(header).toBe('%PDF-');

    // Loading without ignoreEncryption should throw (PDF is encrypted)
    await expect(PDFDocument.load(encrypted)).rejects.toThrow();
  });

  it('produces different output than the original', async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage([200, 200]);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    page.drawText('Hello World', { x: 50, y: 100, size: 12, font });
    const originalBytes = await doc.save();

    const encrypted = await encryptPdf(new Uint8Array(originalBytes), {
      userPassword: 'secret',
      ownerPassword: 'owner',
    });

    // The encrypted bytes should differ from the original
    expect(encrypted.length).not.toBe(originalBytes.length);
  });
});
