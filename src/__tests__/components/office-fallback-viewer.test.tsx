// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

describe('OfficeFallbackViewer', () => {
  it('exports OfficeFallbackViewer as named export', async () => {
    const mod = await import('@/components/dashboard/office-fallback-viewer');
    expect(mod.OfficeFallbackViewer).toBeDefined();
    expect(typeof mod.OfficeFallbackViewer).toBe('function');
  });

  it('renders legacy Word guidance', async () => {
    const { OfficeFallbackViewer } = await import(
      '@/components/dashboard/office-fallback-viewer'
    );

    render(
      <OfficeFallbackViewer
        src="https://example.com/proposal.doc"
        name="proposal.doc"
        mimeType="application/msword"
      />,
    );

    expect(screen.getByText('Legacy document file')).toBeInTheDocument();
    expect(
      screen.getByText(/Convert the file to DOCX or ODT/),
    ).toBeInTheDocument();
    expect(screen.getByText('Download original')).toBeInTheDocument();
  });

  it('renders legacy presentation guidance', async () => {
    const { OfficeFallbackViewer } = await import(
      '@/components/dashboard/office-fallback-viewer'
    );

    render(
      <OfficeFallbackViewer
        src="https://example.com/deck.ppt"
        name="deck.ppt"
        mimeType="application/vnd.ms-powerpoint"
      />,
    );

    expect(screen.getByText('Legacy presentation file')).toBeInTheDocument();
    expect(
      screen.getByText(/Export the deck as PPTX/),
    ).toBeInTheDocument();
    expect(screen.getByText('Open in native app')).toBeInTheDocument();
  });
});
