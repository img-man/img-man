// SPDX-License-Identifier: Apache-2.0
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TaskCenter } from '@/components/dashboard/task-center';
import { publishUploadTasks } from '@/lib/task-center-events';

describe('TaskCenter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    vi.mocked(global.fetch).mockReset();
  });

  it('shows empty states when there are no uploads or AI jobs', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ jobs: [] }),
    } as Response);

    render(<TaskCenter />);

    await userEvent.click(screen.getByRole('button', { name: /toggle task center/i }));

    await waitFor(() => {
      expect(screen.getByText('No uploads yet in this session.')).toBeInTheDocument();
    });
    expect(screen.getByText('No pending AI jobs.')).toBeInTheDocument();
  });

  it('renders upload snapshots from the shared task store', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ jobs: [] }),
    } as Response);

    publishUploadTasks([
      {
        id: 'u1',
        name: 'launch-banner.png',
        status: 'uploading',
        progress: 42,
      },
    ]);

    render(<TaskCenter />);

    expect(screen.getByText('1')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /toggle task center/i }));

    await waitFor(() => {
      expect(screen.getByText('launch-banner.png')).toBeInTheDocument();
    });
    expect(screen.getByText('42%')).toBeInTheDocument();
    expect(screen.getByText('Uploading')).toBeInTheDocument();
  });
});
