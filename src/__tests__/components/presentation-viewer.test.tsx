// SPDX-License-Identifier: Apache-2.0
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const mockArchive = {
  files: {
    'ppt/slides/slide1.xml': {},
    'ppt/slides/slide2.xml': {},
  },
  file: vi.fn((path: string) => ({
    async: vi.fn(async () => {
      if (path.endsWith('slide1.xml')) {
        return '<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:t>Quarterly Review</a:t><a:t>Revenue grew 18%</a:t></p:sld>';
      }

      return '<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:t>Roadmap</a:t><a:t>Launch OCR workspace</a:t></p:sld>';
    }),
  })),
};

vi.mock('jszip', () => ({
  default: {
    loadAsync: vi.fn(async () => mockArchive),
  },
}));

describe('PresentationViewer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(global.fetch).mockReset();
  });

  it('exports PresentationViewer as named export', async () => {
    const mod = await import('@/components/dashboard/presentation-viewer');
    expect(mod.PresentationViewer).toBeDefined();
    expect(typeof mod.PresentationViewer).toBe('function');
  });

  it('renders extracted slide text and allows slide switching', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-length': '4096' }),
      arrayBuffer: async () => new ArrayBuffer(64),
    } as Response);

    const { PresentationViewer } = await import(
      '@/components/dashboard/presentation-viewer'
    );

    render(
      <PresentationViewer
        src="https://example.com/deck.pptx"
        name="deck.pptx"
      />,
    );

    const headings = await screen.findAllByText('Quarterly Review', {}, { timeout: 10000 });
    expect(headings.length).toBeGreaterThan(0);

    expect(
      screen.getByText((_, element) =>
        element?.tagName === 'PRE' &&
        (element.textContent?.includes('Revenue grew 18%') ?? false),
      ),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /roadmap/i }));

    await waitFor(() => {
      expect(
        screen.getByText((_, element) =>
          element?.tagName === 'PRE' &&
          (element.textContent?.includes('Launch OCR workspace') ?? false),
        ),
      ).toBeInTheDocument();
    }, { timeout: 10000 });
  }, 15000);

  it('renders extracted ODP slide text', async () => {
    const contentArchive = {
      files: {
        'content.xml': {},
      },
      file: vi.fn(() => ({
        async: vi.fn(async () =>
          '<office:presentation><draw:page draw:name="Intro"><text:p>Company Overview</text:p></draw:page><draw:page draw:name="Plan"><text:p>Launch asset workflows</text:p></draw:page></office:presentation>',
        ),
      })),
    };

    const jszip = await import('jszip');
    vi.mocked(jszip.default.loadAsync).mockResolvedValueOnce(
      contentArchive as never,
    );

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-length': '4096' }),
      arrayBuffer: async () => new ArrayBuffer(64),
    } as Response);

    const { PresentationViewer } = await import(
      '@/components/dashboard/presentation-viewer'
    );

    render(
      <PresentationViewer
        src="https://example.com/deck.odp"
        name="deck.odp"
        mimeType="application/vnd.oasis.opendocument.presentation"
      />,
    );

    await waitFor(() => {
      expect(screen.getAllByText('Company Overview').length).toBeGreaterThan(0);
    });

    expect(
      screen.getByText((_, element) =>
        element?.tagName === 'PRE' &&
        (element.textContent?.includes('Company Overview') ?? false),
      ),
    ).toBeInTheDocument();
  });
});
