// SPDX-License-Identifier: Apache-2.0
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

vi.mock('mammoth', () => {
  const extractRawText = vi.fn(async () => ({
    value: 'Executive Summary\n\nRevenue increased 24% year-over-year.',
    messages: [{ type: 'warning', message: 'Comment references were ignored.' }],
  }));

  return {
    default: { extractRawText },
    extractRawText,
  };
});

describe('DocxViewer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(global.fetch).mockReset();
  });

  it('exports DocxViewer as named export', async () => {
    const mod = await import('@/components/dashboard/docx-viewer');
    expect(mod.DocxViewer).toBeDefined();
    expect(typeof mod.DocxViewer).toBe('function');
  });

  it('renders extracted DOCX text and warnings', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-length': '4096' }),
      arrayBuffer: async () => new ArrayBuffer(32),
    } as Response);

    const { DocxViewer } = await import('@/components/dashboard/docx-viewer');

    render(
      <DocxViewer src="https://example.com/proposal.docx" name="proposal.docx" />,
    );

    await waitFor(() => {
      expect(screen.getByText('Executive Summary')).toBeInTheDocument();
    });

    expect(
      screen.getByText('Revenue increased 24% year-over-year.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Comment references were ignored.'),
    ).toBeInTheDocument();
  });
});
