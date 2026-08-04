// SPDX-License-Identifier: Apache-2.0
/**
 * Tests — PDF to Image
 * Tests for pdf-to-image-client.tsx component
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

function readPdfToImageClient() {
  return readFileSync(
    path.resolve(process.cwd(), 'src/app/dashboard/tools/pdf-to-image-client.tsx'),
    'utf-8',
  );
}

describe('PDF to Image Client', () => {
  it('module exports a default component', () => {
    const content = readPdfToImageClient();
    expect(content).toContain('export default function PdfToImageModal');
  });

  it('component name is PdfToImageModal', () => {
    const content = readPdfToImageClient();
    expect(content).toContain('function PdfToImageModal');
  });
});
