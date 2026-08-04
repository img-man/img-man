// SPDX-License-Identifier: Apache-2.0
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

const mockArchive = {
  file: vi.fn(() => ({
    async: vi.fn(async () =>
      '<office:text><text:h>Project Charter</text:h><text:p>Stakeholder review is approved.</text:p></office:text>',
    ),
  })),
};

vi.mock('jszip', () => ({
  default: {
    loadAsync: vi.fn(async () => mockArchive),
  },
}));

describe('DocumentTextViewer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(global.fetch).mockReset();
  });

  it('exports DocumentTextViewer as named export', async () => {
    const mod = await import('@/components/dashboard/document-text-viewer');
    expect(mod.DocumentTextViewer).toBeDefined();
    expect(typeof mod.DocumentTextViewer).toBe('function');
  });

  it('renders extracted ODT text', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-length': '2048' }),
      arrayBuffer: async () => new ArrayBuffer(32),
    } as Response);

    const { DocumentTextViewer } = await import(
      '@/components/dashboard/document-text-viewer'
    );

    render(
      <DocumentTextViewer
        src="https://example.com/report.odt"
        name="report.odt"
        mimeType="application/vnd.oasis.opendocument.text"
      />,
    );

    await waitFor(
      () => {
        expect(screen.getByText('Project Charter')).toBeInTheDocument();
      },
      { timeout: 15_000 },
    );

    expect(screen.getByText('Stakeholder review is approved.')).toBeInTheDocument();
  }, 20_000);

  it('renders extracted RTF text', async () => {
    const rtf = '{\\rtf1\\ansi\\b Release Notes\\b0\\par Feature rollout complete.}';

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-length': '512' }),
      arrayBuffer: async () => new TextEncoder().encode(rtf).buffer,
    } as Response);

    const { DocumentTextViewer } = await import(
      '@/components/dashboard/document-text-viewer'
    );

    render(
      <DocumentTextViewer
        src="https://example.com/notes.rtf"
        name="notes.rtf"
        mimeType="application/rtf"
      />,
    );

    await waitFor(
      () => {
        expect(screen.getByText(/Release Notes/)).toBeInTheDocument();
      },
      { timeout: 15_000 },
    );

    expect(screen.getByText(/Feature rollout complete\./)).toBeInTheDocument();
  }, 20_000);
});
