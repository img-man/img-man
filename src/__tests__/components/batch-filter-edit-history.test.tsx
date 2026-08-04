// SPDX-License-Identifier: Apache-2.0
/**
 * BatchFilterDialog & EditHistoryPanel UI Tests
 * Tests for BatchFilterDialog and EditHistoryPanel rendering.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Mock lucide-react icons — create a factory for all needed icons
const iconFactory = (name: string) => {
  const IconComponent = (props: Record<string, unknown>) =>
    React.createElement('span', { 'data-testid': `icon-${name}`, ...props });
  IconComponent.displayName = name;
  return IconComponent;
};

vi.mock('lucide-react', () => {
  const icons = [
    'Sparkles',
    'Save',
    'ChevronLeft',
    'ChevronRight',
    'Loader2',
    'X',
    'SlidersHorizontal',
    'CheckCircle2',
    'AlertCircle',
    'History',
    'RotateCcw',
    'ChevronDown',
    'ChevronRight',
    'ChevronUp',
    'Crop',
    'PenTool',
    'Clock',
    'User',
    'Sun',
    'Contrast',
    'Droplets',
    'Thermometer',
    'Eye',
    'CircleDot',
    'CloudFog',
    'Grip',
    'Eclipse',
    'Scan',
    'UserRound',
    'Waves',
    'Pencil',
    'Sliders',
  ];
  const mod: Record<string, unknown> = {};
  for (const name of icons) {
    const Comp = (props: Record<string, unknown>) =>
      React.createElement('span', { 'data-testid': `icon-${name}`, ...props });
    Comp.displayName = name;
    mod[name] = Comp;
  }
  return mod;
});

// Global fetch mock
const mockFetch = vi.fn();
global.fetch = mockFetch;

// ── Batch Filter Dialog ───────────────────────────────────────────

describe('BatchFilterDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders with correct asset count', async () => {
    const { default: BatchFilterDialog } =
      await import('@/components/dashboard/batch-filter-dialog');
    const onClose = vi.fn();
    render(
      React.createElement(BatchFilterDialog, {
        assetIds: ['a1', 'a2', 'a3'],
        onClose,
      }),
    );

    expect(screen.getByText('Batch Apply Filter')).toBeDefined();
    expect(screen.getByText(/3 selected images/)).toBeDefined();
  });

  it('shows filter category buttons', async () => {
    const { default: BatchFilterDialog } =
      await import('@/components/dashboard/batch-filter-dialog');
    render(
      React.createElement(BatchFilterDialog, {
        assetIds: ['a1'],
        onClose: vi.fn(),
      }),
    );

    expect(screen.getByText('All')).toBeDefined();
    expect(screen.getByText('Vivid')).toBeDefined();
    expect(screen.getByText('B&W')).toBeDefined();
    expect(screen.getByText('Vintage')).toBeDefined();
  });

  it('shows preset names', async () => {
    const { default: BatchFilterDialog } =
      await import('@/components/dashboard/batch-filter-dialog');
    render(
      React.createElement(BatchFilterDialog, {
        assetIds: ['a1'],
        onClose: vi.fn(),
      }),
    );

    // Pop, Punch, Tropical are vivid presets
    expect(screen.getByText('Pop')).toBeDefined();
    expect(screen.getByText('Punch')).toBeDefined();
  });

  it('has mode radio buttons', async () => {
    const { default: BatchFilterDialog } =
      await import('@/components/dashboard/batch-filter-dialog');
    render(
      React.createElement(BatchFilterDialog, {
        assetIds: ['a1'],
        onClose: vi.fn(),
      }),
    );

    expect(screen.getByText('Save as copies')).toBeDefined();
    expect(screen.getByText('Overwrite originals')).toBeDefined();
  });

  it('apply button is disabled when no preset selected', async () => {
    const { default: BatchFilterDialog } =
      await import('@/components/dashboard/batch-filter-dialog');
    render(
      React.createElement(BatchFilterDialog, {
        assetIds: ['a1'],
        onClose: vi.fn(),
      }),
    );

    const applyButton = screen.getByText(/Apply to 1 image/);
    expect(applyButton.closest('button')?.disabled).toBe(true);
  });

  it('calls onClose when cancel is clicked', async () => {
    const { default: BatchFilterDialog } =
      await import('@/components/dashboard/batch-filter-dialog');
    const onClose = vi.fn();
    render(
      React.createElement(BatchFilterDialog, {
        assetIds: ['a1'],
        onClose,
      }),
    );

    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalled();
  });

  it('shows intensity slider after selecting a preset', async () => {
    const { default: BatchFilterDialog } =
      await import('@/components/dashboard/batch-filter-dialog');
    render(
      React.createElement(BatchFilterDialog, {
        assetIds: ['a1'],
        onClose: vi.fn(),
      }),
    );

    // Select "Pop" preset
    fireEvent.click(screen.getByText('Pop'));
    expect(screen.getByText('Intensity')).toBeDefined();
    expect(screen.getByText('100%')).toBeDefined();
  });
});

// ── Edit History Panel ────────────────────────────────────────────

describe('EditHistoryPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially', async () => {
    mockFetch.mockImplementation(() => new Promise(() => {})); // never resolves
    const { EditHistoryPanel } =
      await import('@/components/dashboard/edit-history-panel');
    render(React.createElement(EditHistoryPanel, { assetId: 'asset1' }));
    // Should show loading indicator text
    expect(screen.getByText('Loading history…')).toBeDefined();
  });

  it('renders error state on fetch failure', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));
    const { EditHistoryPanel } =
      await import('@/components/dashboard/edit-history-panel');
    render(React.createElement(EditHistoryPanel, { assetId: 'asset1' }));
    await waitFor(() => {
      expect(screen.getByText(/Network error/)).toBeDefined();
    });
  });

  it('renders empty state when no edits', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          assetId: 'asset1',
          name: 'photo.jpg',
          hasOriginal: false,
          editCount: 0,
          edits: [],
        }),
    });
    const { EditHistoryPanel } =
      await import('@/components/dashboard/edit-history-panel');
    render(React.createElement(EditHistoryPanel, { assetId: 'asset1' }));
    await waitFor(() => {
      expect(screen.getByText(/No edits/)).toBeDefined();
    });
  });

  it('renders edit entries when present', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          assetId: 'asset1',
          name: 'photo.jpg',
          hasOriginal: true,
          editCount: 1,
          edits: [
            {
              index: 0,
              adjustments: { brightness: 20 },
              cropSettings: null,
              annotationCount: 0,
              timestamp: new Date().toISOString(),
              user: { name: 'Test', email: 'test@test.com' },
              mode: 'overwrite',
            },
          ],
        }),
    });
    const { EditHistoryPanel } =
      await import('@/components/dashboard/edit-history-panel');
    render(React.createElement(EditHistoryPanel, { assetId: 'asset1' }));
    await waitFor(() => {
      // The component shows the edit number and adjustment summary
      expect(screen.getByText(/brightness/)).toBeDefined();
    });
  });
});

