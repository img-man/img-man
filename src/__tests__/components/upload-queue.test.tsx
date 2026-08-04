// SPDX-License-Identifier: Apache-2.0
import { StrictMode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, waitFor } from '@testing-library/react';

vi.mock('@/lib/upload-helpers', () => ({
  formatUploadBytes: vi.fn(() => '1 KB'),
  summarizeUploadSelection: vi.fn((files: File[]) => ({
    validFiles: files,
    errors: [],
  })),
  uploadAssetFile: vi.fn(
    async (_file: File, options?: { onStageChange?: (stage: string) => void }) => {
      options?.onStageChange?.('requesting-url');
      options?.onStageChange?.('uploading');
      options?.onStageChange?.('extracting-metadata');
      options?.onStageChange?.('confirming');
      options?.onStageChange?.('done');
    },
  ),
}));

vi.mock('@/lib/task-center-events', () => ({
  clearStoredUploadTasks: vi.fn(),
  publishUploadTasks: vi.fn(),
}));

vi.mock('@/app/embed/dashboard/embed-scope-context', () => ({
  useEmbedScope: () => ({ isEmbed: false }),
}));

import { UploadQueue } from '@/components/dashboard/upload-queue';
import { uploadAssetFile } from '@/lib/upload-helpers';

const mockUploadAssetFile = vi.mocked(uploadAssetFile);

function makeSettingsResponse(isByoc: boolean) {
  return new Response(
    JSON.stringify({
      settings: {
        storageConfig: {
          bucket: 'test-bucket',
          isByoc,
        },
      },
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    },
  );
}

function setInputFiles(input: HTMLInputElement, files: File[]) {
  Object.defineProperty(input, 'files', {
    configurable: true,
    value: files,
  });
  fireEvent.change(input);
}

describe('UploadQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => makeSettingsResponse(false));
  });

  it('starts a queued file only once in StrictMode', async () => {
    const { container } = render(
      <StrictMode>
        <UploadQueue />
      </StrictMode>,
    );

    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());

    const inputs = container.querySelectorAll('input[type="file"]');
    const fileInput = inputs[0] as HTMLInputElement;
    const file = new File(['hello'], 'photo.png', { type: 'image/png' });

    setInputFiles(fileInput, [file]);

    await waitFor(() => expect(mockUploadAssetFile).toHaveBeenCalledTimes(1));
  });

  it('prefers same-origin upload for BYOC storage', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => makeSettingsResponse(true));

    const { container } = render(<UploadQueue />);

    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());

    const inputs = container.querySelectorAll('input[type="file"]');
    const fileInput = inputs[0] as HTMLInputElement;
    const file = new File(['hello'], 'photo.png', { type: 'image/png' });

    setInputFiles(fileInput, [file]);

    await waitFor(() => expect(mockUploadAssetFile).toHaveBeenCalledTimes(1));
    expect(mockUploadAssetFile).toHaveBeenCalledWith(
      file,
      expect.objectContaining({ preferServerUpload: true }),
    );
  });
});