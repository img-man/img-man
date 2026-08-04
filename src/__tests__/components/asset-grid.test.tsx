// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// We need to unmock next-auth/react for these component tests (setup.ts mocks it globally)
// The components use fetch, which is mocked in setup.ts

describe('AssetGrid', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset fetch mock
    vi.mocked(global.fetch).mockReset();
  });

  it('renders skeleton loader while loading', async () => {
    // Make fetch hang forever so we can see loading state
    vi.mocked(global.fetch).mockReturnValue(new Promise(() => {}));

    const { AssetGrid } = await import('@/components/dashboard/asset-grid');

    render(
      <AssetGrid
        selectedIds={new Set()}
        onSelectionChange={vi.fn()}
        onAssetOpen={vi.fn()}
        onFolderOpen={vi.fn()}
      />,
    );

    // Should show skeleton placeholders
    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders empty state when no assets', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        assets: [],
        totalPages: 0,
        page: 1,
        limit: 30,
        total: 0,
      }),
    } as Response);

    const { AssetGrid } = await import('@/components/dashboard/asset-grid');

    render(
      <AssetGrid
        selectedIds={new Set()}
        onSelectionChange={vi.fn()}
        onAssetOpen={vi.fn()}
        onFolderOpen={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('This folder is empty')).toBeInTheDocument();
    });
  });

  it('renders search empty state when searching with no results', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        assets: [],
        totalPages: 0,
        page: 1,
        limit: 30,
        total: 0,
      }),
    } as Response);

    const { AssetGrid } = await import('@/components/dashboard/asset-grid');

    render(
      <AssetGrid
        searchQuery="nonexistent"
        selectedIds={new Set()}
        onSelectionChange={vi.fn()}
        onAssetOpen={vi.fn()}
        onFolderOpen={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/No results for/)).toBeInTheDocument();
    });
  });

  it('renders asset cards when data returns', async () => {
    const mockAssets = [
      {
        _id: 'a1',
        name: 'photo1.png',
        mimeType: 'image/png',
        sizeBytes: 1024,
        url: 'https://example.com/photo1.png',
        tags: ['nature'],
        createdAt: '2025-01-01T00:00:00Z',
      },
      {
        _id: 'a2',
        name: 'photo2.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 2048,
        url: 'https://example.com/photo2.jpg',
        tags: [],
        createdAt: '2025-01-02T00:00:00Z',
      },
    ];

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        assets: mockAssets,
        totalPages: 1,
        page: 1,
        limit: 30,
        total: 2,
      }),
    } as Response);

    const { AssetGrid } = await import('@/components/dashboard/asset-grid');

    render(
      <AssetGrid
        selectedIds={new Set()}
        onSelectionChange={vi.fn()}
        onAssetOpen={vi.fn()}
        onFolderOpen={vi.fn()}
      />,
    );

    await waitFor(() => {
      // Asset images should be rendered
      const images = screen.getAllByRole('img');
      expect(images).toHaveLength(2);
    });
  });

  it('calls onAssetOpen when clicking an asset card', async () => {
    const mockAssets = [
      {
        _id: 'a1',
        name: 'photo1.png',
        mimeType: 'image/png',
        sizeBytes: 1024,
        url: 'https://example.com/photo1.png',
        tags: [],
        createdAt: '2025-01-01T00:00:00Z',
      },
    ];

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        assets: mockAssets,
        totalPages: 1,
        page: 1,
        limit: 30,
        total: 1,
      }),
    } as Response);

    const onAssetOpen = vi.fn();
    const { AssetGrid } = await import('@/components/dashboard/asset-grid');

    render(
      <AssetGrid
        selectedIds={new Set()}
        onSelectionChange={vi.fn()}
        onAssetOpen={onAssetOpen}
        onFolderOpen={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole('img')).toBeInTheDocument();
    });

    // Click the asset card (div[role="button"] wrapping the image)
    const img = screen.getByRole('img');
    const assetCard =
      img.closest('[data-asset-id]') ?? img.closest('[role="button"]');
    expect(assetCard).not.toBeNull();
    fireEvent.click(assetCard!);
    expect(onAssetOpen).toHaveBeenCalledWith(
      expect.objectContaining({ _id: 'a1' }),
    );
  });

  it('passes search query and sort params to fetch', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ assets: [], totalPages: 0 }),
    } as Response);

    const { AssetGrid } = await import('@/components/dashboard/asset-grid');

    render(
      <AssetGrid
        searchQuery="sunset"
        sort="name"
        sortDir="asc"
        mimeType="image/"
        selectedIds={new Set()}
        onSelectionChange={vi.fn()}
        onAssetOpen={vi.fn()}
        onFolderOpen={vi.fn()}
      />,
    );

    await waitFor(() => {
      // calls[0] is the folders fetch, calls[1] is the assets fetch
      const assetCall = vi
        .mocked(global.fetch)
        .mock.calls.find((c) => (c[0] as string).includes('/api/assets'));
      expect(assetCall).toBeDefined();
      const fetchUrl = assetCall![0] as string;
      expect(fetchUrl).toContain('q=sunset');
      expect(fetchUrl).toContain('sort=name');
      expect(fetchUrl).toContain('sortDir=asc');
      expect(fetchUrl).toContain('mimeType=image%2F');
    });
  });
});

describe('DashboardToolbar', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders search input and controls', async () => {
    const { DashboardToolbar } = await import('@/components/dashboard/toolbar');

    render(
      <DashboardToolbar
        searchQuery=""
        onSearchChange={vi.fn()}
        sort="createdAt"
        sortDir="desc"
        onSortChange={vi.fn()}
        mimeType=""
        onMimeTypeChange={vi.fn()}
        totalSelected={0}
        onClearSelection={vi.fn()}
        onBatchDelete={vi.fn()}
        onBatchMove={vi.fn()}
      />,
    );

    expect(screen.getByPlaceholderText(/Search assets/)).toBeInTheDocument();
    expect(screen.getByText('Date uploaded')).toBeInTheDocument();
    expect(screen.getByText('Filter')).toBeInTheDocument();
  });

  it('shows bulk action bar when items selected', async () => {
    const { DashboardToolbar } = await import('@/components/dashboard/toolbar');

    render(
      <DashboardToolbar
        searchQuery=""
        onSearchChange={vi.fn()}
        sort="createdAt"
        sortDir="desc"
        onSortChange={vi.fn()}
        mimeType=""
        onMimeTypeChange={vi.fn()}
        totalSelected={5}
        onClearSelection={vi.fn()}
        onBatchDelete={vi.fn()}
        onBatchMove={vi.fn()}
      />,
    );

    expect(screen.getByText('5 selected')).toBeInTheDocument();
    expect(screen.getByText('Move')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('calls onBatchDelete when delete clicked', async () => {
    const onBatchDelete = vi.fn();
    const { DashboardToolbar } = await import('@/components/dashboard/toolbar');

    render(
      <DashboardToolbar
        searchQuery=""
        onSearchChange={vi.fn()}
        sort="createdAt"
        sortDir="desc"
        onSortChange={vi.fn()}
        mimeType=""
        onMimeTypeChange={vi.fn()}
        totalSelected={3}
        onClearSelection={vi.fn()}
        onBatchDelete={onBatchDelete}
        onBatchMove={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText('Delete'));
    expect(onBatchDelete).toHaveBeenCalled();
  });

  it('debounces search input', async () => {
    vi.useFakeTimers();
    const onSearchChange = vi.fn();
    const { DashboardToolbar } = await import('@/components/dashboard/toolbar');

    render(
      <DashboardToolbar
        searchQuery=""
        onSearchChange={onSearchChange}
        sort="createdAt"
        sortDir="desc"
        onSortChange={vi.fn()}
        mimeType=""
        onMimeTypeChange={vi.fn()}
        totalSelected={0}
        onClearSelection={vi.fn()}
        onBatchDelete={vi.fn()}
        onBatchMove={vi.fn()}
      />,
    );

    const input = screen.getByPlaceholderText(/Search assets/);
    fireEvent.change(input, { target: { value: 'sunset' } });

    // Should NOT be called immediately
    expect(onSearchChange).not.toHaveBeenCalled();

    // Advance timers past debounce period (350ms)
    vi.advanceTimersByTime(400);

    expect(onSearchChange).toHaveBeenCalledWith('sunset');
    vi.useRealTimers();
  });

  it('hides bulk bar when no selection', async () => {
    const { DashboardToolbar } = await import('@/components/dashboard/toolbar');

    render(
      <DashboardToolbar
        searchQuery=""
        onSearchChange={vi.fn()}
        sort="createdAt"
        sortDir="desc"
        onSortChange={vi.fn()}
        mimeType=""
        onMimeTypeChange={vi.fn()}
        totalSelected={0}
        onClearSelection={vi.fn()}
        onBatchDelete={vi.fn()}
        onBatchMove={vi.fn()}
      />,
    );

    expect(screen.queryByText('selected')).not.toBeInTheDocument();
  });
});
