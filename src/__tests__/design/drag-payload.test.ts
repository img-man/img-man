// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it, vi } from 'vitest';

import {
  DESIGN_DRAG_MIME,
  readDesignDragPayload,
  setDesignDragPayload,
} from '@/components/design/drag-payload';

function makeDataTransfer(initial: Record<string, string> = {}) {
  const store = new Map<string, string>(Object.entries(initial));
  const dt = {
    types: Array.from(store.keys()),
    effectAllowed: 'none' as string,
    dropEffect: 'none' as string,
    setData: vi.fn((type: string, value: string) => {
      store.set(type, value);
      (dt as { types: string[] }).types = Array.from(store.keys());
    }),
    getData: vi.fn((type: string) => store.get(type) ?? ''),
  };
  return dt as unknown as DataTransfer & { setData: ReturnType<typeof vi.fn> };
}

describe('design drag payload', () => {
  it('round-trips kind/url/name through dataTransfer', () => {
    const dt = makeDataTransfer();
    setDesignDragPayload(
      { dataTransfer: dt } as unknown as React.DragEvent,
      { kind: 'image', url: 'https://cdn.example/p.jpg', name: 'Photo' },
    );
    const parsed = readDesignDragPayload({
      dataTransfer: dt,
    } as unknown as React.DragEvent);
    expect(parsed).toEqual({
      kind: 'image',
      url: 'https://cdn.example/p.jpg',
      name: 'Photo',
      assetId: undefined,
    });
    expect(dt.getData(DESIGN_DRAG_MIME)).not.toBe('');
  });

  it('preserves assetId for org library drags', () => {
    const dt = makeDataTransfer();
    setDesignDragPayload(
      { dataTransfer: dt } as unknown as React.DragEvent,
      {
        kind: 'asset',
        url: 'https://cdn.example/a.jpg',
        name: 'Logo',
        assetId: 'asset-123',
      },
    );
    const parsed = readDesignDragPayload({
      dataTransfer: dt,
    } as unknown as React.DragEvent);
    expect(parsed?.kind).toBe('asset');
    expect(parsed?.assetId).toBe('asset-123');
  });

  it('falls back to text/uri-list for external URL drags', () => {
    const dt = makeDataTransfer({
      'text/uri-list': 'https://cdn.example/external.png',
    });
    const parsed = readDesignDragPayload({
      dataTransfer: dt,
    } as unknown as React.DragEvent);
    expect(parsed).toEqual({
      kind: 'image',
      url: 'https://cdn.example/external.png',
      name: 'Dropped image',
    });
  });

  it('returns null when no usable payload is present', () => {
    const dt = makeDataTransfer({ 'text/plain': 'just some words' });
    expect(
      readDesignDragPayload({
        dataTransfer: dt,
      } as unknown as React.DragEvent),
    ).toBeNull();
  });
});
