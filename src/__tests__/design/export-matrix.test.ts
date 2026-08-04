// SPDX-License-Identifier: Apache-2.0
/**
 * D38 \u2014 export reliability matrix.
 * Walks every supported format and asserts the export pipeline plumbs
 * the right MIME, extension, and quality knob through to the canvas.
 * We stub `Image.onload`, `canvas.toDataURL`, and `URL.createObjectURL`
 * because jsdom does not implement them.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DESIGN_EXPORT_FORMATS,
  exportDesignFromSvg,
  type DesignExportFormat,
} from '@/components/design/editor-export';

interface RecordedDownload {
  href: string;
  download: string;
  clicks: number;
}

function makeSvg(): SVGSVGElement {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg') as SVGSVGElement;
  svg.setAttribute('width', '200');
  svg.setAttribute('height', '100');
  const rect = document.createElementNS(NS, 'rect');
  rect.setAttribute('width', '50');
  rect.setAttribute('height', '50');
  svg.appendChild(rect);
  return svg;
}

describe('export reliability matrix (D38)', () => {
  let downloads: RecordedDownload[] = [];
  let toDataURLCalls: Array<{ mime: string; quality?: number }> = [];
  let originalCreateObjectURL: typeof URL.createObjectURL;
  let originalRevokeObjectURL: typeof URL.revokeObjectURL;
  let originalCreateElement: typeof document.createElement;

  beforeEach(() => {
    downloads = [];
    toDataURLCalls = [];

    originalCreateObjectURL = URL.createObjectURL;
    originalRevokeObjectURL = URL.revokeObjectURL;
    URL.createObjectURL = vi.fn(() => 'blob:fake');
    URL.revokeObjectURL = vi.fn();

    // jsdom Image: trigger onload synchronously so the rasterize promise resolves.
    Object.defineProperty(window.Image.prototype, 'src', {
      configurable: true,
      set() {
        queueMicrotask(() => {
          if (typeof this.onload === 'function') this.onload();
        });
      },
    });

    // Stub canvas.toDataURL since jsdom returns "" by default and we want the
    // requested MIME/quality recorded.
    const proto = HTMLCanvasElement.prototype as unknown as {
      toDataURL: (mime: string, quality?: number) => string;
      getContext: (id: string) => unknown;
    };
    proto.toDataURL = function (mime: string, quality?: number) {
      toDataURLCalls.push({ mime, quality });
      return `data:${mime};base64,AAAA`;
    };
    proto.getContext = () => ({
      fillStyle: '',
      fillRect: vi.fn(),
      scale: vi.fn(),
      drawImage: vi.fn(),
    });

    // Capture <a> downloads.
    originalCreateElement = document.createElement.bind(document);
    document.createElement = ((tag: string) => {
      const el = originalCreateElement(tag);
      if (tag === 'a') {
        const anchor = el as HTMLAnchorElement;
        const record: RecordedDownload = {
          href: '',
          download: '',
          clicks: 0,
        };
        Object.defineProperty(anchor, 'href', {
          configurable: true,
          get: () => record.href,
          set: (v: string) => {
            record.href = v;
          },
        });
        Object.defineProperty(anchor, 'download', {
          configurable: true,
          get: () => record.download,
          set: (v: string) => {
            record.download = v;
          },
        });
        anchor.click = () => {
          record.clicks += 1;
          downloads.push({ ...record });
        };
      }
      return el;
    }) as typeof document.createElement;
  });

  afterEach(() => {
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    document.createElement = originalCreateElement;
  });

  const cases: Array<{
    format: Exclude<DesignExportFormat, 'pdf'>;
    expectedMime: string;
    expectedExt: string;
    expectQualityForwarded: boolean;
  }> = [
    { format: 'png', expectedMime: 'image/png', expectedExt: 'png', expectQualityForwarded: true },
    { format: 'jpeg', expectedMime: 'image/jpeg', expectedExt: 'jpeg', expectQualityForwarded: true },
    { format: 'webp', expectedMime: 'image/webp', expectedExt: 'webp', expectQualityForwarded: true },
  ];

  for (const c of cases) {
    it(`raster export emits ${c.format} with the right MIME and extension`, async () => {
      await exportDesignFromSvg(
        makeSvg(),
        { width: 200, height: 100, background: '#fff' },
        { format: c.format, scale: 2, quality: 90, transparent: false },
      );
      expect(toDataURLCalls).toHaveLength(1);
      expect(toDataURLCalls[0].mime).toBe(c.expectedMime);
      if (c.expectQualityForwarded) {
        expect(toDataURLCalls[0].quality).toBeCloseTo(0.9);
      }
      expect(downloads).toHaveLength(1);
      expect(downloads[0].download).toBe(`design.${c.expectedExt}`);
      expect(downloads[0].clicks).toBe(1);
    });
  }

  it('SVG export downloads an svg blob and skips canvas rasterization', async () => {
    await exportDesignFromSvg(
      makeSvg(),
      { width: 200, height: 100 },
      { format: 'svg', scale: 1, quality: 100, transparent: true },
    );
    expect(toDataURLCalls).toHaveLength(0);
    expect(downloads).toHaveLength(1);
    expect(downloads[0].download).toBe('design.svg');
  });

  it('JPEG always forces a background fill even when transparent=true', async () => {
    // Capture context calls
    const fillRectSpy = vi.fn();
    (HTMLCanvasElement.prototype as unknown as { getContext: () => unknown }).getContext = () => ({
      fillStyle: '',
      fillRect: fillRectSpy,
      scale: vi.fn(),
      drawImage: vi.fn(),
    });
    await exportDesignFromSvg(
      makeSvg(),
      { width: 200, height: 100, background: '#abcdef' },
      { format: 'jpeg', scale: 1, quality: 80, transparent: true },
    );
    expect(fillRectSpy).toHaveBeenCalled();
  });

  it('exposes pdf in the canonical matrix even though we skip its e2e here', () => {
    expect(DESIGN_EXPORT_FORMATS).toContain('pdf');
  });
});
