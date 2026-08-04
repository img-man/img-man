// SPDX-License-Identifier: Apache-2.0
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

vi.mock('exceljs', () => ({
  Workbook: vi.fn(function Workbook() {
    return {
      xlsx: {
        load: vi.fn(),
      },
      worksheets: [
        {
          name: 'Summary',
          eachRow: vi.fn((_options, callback) => {
            callback({ values: [undefined, 'Name', 'Amount'] });
            callback({ values: [undefined, 'Q1', '1200'] });
            callback({ values: [undefined, 'Q2', '980'] });
          }),
        },
      ],
    };
  }),
}));

describe('SpreadsheetViewer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(global.fetch).mockReset();
  });

  it('exports SpreadsheetViewer as named export', async () => {
    const mod = await import('@/components/dashboard/spreadsheet-viewer');
    expect(mod.SpreadsheetViewer).toBeDefined();
    expect(typeof mod.SpreadsheetViewer).toBe('function');
  });

  it('renders workbook rows from ExcelJS workbook data', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(32),
    } as Response);

    const { SpreadsheetViewer } = await import(
      '@/components/dashboard/spreadsheet-viewer'
    );

    render(
      <SpreadsheetViewer
        src="https://example.com/report.xlsx"
        name="report.xlsx"
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('report.xlsx')).toBeInTheDocument();
    });

    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Amount')).toBeInTheDocument();
    expect(screen.getByText('Q1')).toBeInTheDocument();
    expect(screen.getByText('1200')).toBeInTheDocument();
  });
});
