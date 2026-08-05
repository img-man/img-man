// SPDX-License-Identifier: Apache-2.0
/**
 * Tools page integration tests
 * Tests that tools-client.tsx has the correct TOOLS definitions and modal wiring
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

describe('Tools client integration', () => {
  it('exports default ToolsClient component', async () => {
    // Dynamic imports will fail for components that use next/dynamic,
    // so we just verify the module can be imported
    const mod = await import('@/app/dashboard/tools/tools-client');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });

  it('exports a dedicated PDF suite route with PDF metadata', async () => {
    const mod = await import('@/app/dashboard/pdf/page');

    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
    expect(mod.metadata).toEqual({ title: 'PDF Suite — img-man' });
  });

  it('renders grouped workflow sections for the PDF suite view', async () => {
    const { default: ToolsClient } = await import(
      '@/app/dashboard/tools/tools-client'
    );

    render(
      React.createElement(ToolsClient, {
        initialTab: 'pdf',
        title: 'PDF Suite',
        description: 'PDF workflow surface',
        hideTabs: true,
      }),
    );

    expect(screen.queryByTestId('tools-tabs')).not.toBeInTheDocument();
    expect(screen.getByTestId('pdf-suite-groups')).toBeInTheDocument();
    expect(screen.getByTestId('pdf-group-organize')).toBeInTheDocument();
    expect(screen.getByText('Organize & Pages')).toBeInTheDocument();
    expect(screen.getByText('Sign & Secure')).toBeInTheDocument();
    expect(screen.getByText('Split to Single Pages')).toBeInTheDocument();
  });

  it('exposes the favicon tool inventory in the Image tools view', async () => {
    const { default: ToolsClient } = await import(
      '@/app/dashboard/tools/tools-client'
    );

    render(
      React.createElement(ToolsClient, {
        initialTab: 'image',
        title: 'Image Tools',
        description: 'Image workflow surface',
        hideTabs: true,
      }),
    );

    expect(screen.getByText('AI Favicon Generator')).toBeInTheDocument();
    expect(screen.getByText('Text to Favicon')).toBeInTheDocument();
    expect(screen.getByText('Favicon Checker')).toBeInTheDocument();
    expect(screen.getByText('SVG Viewer')).toBeInTheDocument();
    expect(screen.getByText('Android Adaptive Icon')).toBeInTheDocument();
  });
});

describe('All tool modules importable', () => {
  const tools = [
    { name: 'pdf-merge-client', exportName: 'PdfMergeModal' },
    { name: 'img-to-pdf-client', exportName: 'ImgToPdfModal' },
    { name: 'vectorize-client', exportName: 'VectorizeModal' },
    { name: 'compressor-client', exportName: 'CompressorModal' },
    { name: 'batch-rename-client', exportName: 'BatchRenameModal' },
  ];

  for (const tool of tools) {
    it(`${tool.name} module is importable`, async () => {
      const mod = await import(`@/app/dashboard/tools/${tool.name}`);
      expect(mod.default).toBeDefined();
      expect(mod.default.name).toBe(tool.exportName);
    });
  }
});

