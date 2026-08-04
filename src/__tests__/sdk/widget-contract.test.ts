// SPDX-License-Identifier: Apache-2.0
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ImgManWidget } from '@img-man/sdk';

describe('img-man widget SDK contract', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="widget-target"></div>';
  });

  it('exports the widget constructor on the npm and script-tag surfaces', () => {
    const imageManGlobal = (
      window as unknown as { ImageMan?: { Widget?: typeof ImgManWidget } }
    ).ImageMan;

    expect(ImgManWidget).toBeDefined();
    expect(imageManGlobal?.Widget).toBe(ImgManWidget);
  });

  it('mounts an iframe from the documented config and forwards ready/select/upload/error events', () => {
    const onReady = vi.fn();
    const onSelect = vi.fn();
    const onUpload = vi.fn();
    const onError = vi.fn();

    const widget = new ImgManWidget({
      container: '#widget-target',
      orgSlug: 'acme-corp',
      apiKey: 'img_abc123',
      mode: 'picker',
      maxFiles: 5,
      theme: 'light',
      onReady,
      onSelect,
      onUpload,
      onError,
    });

    widget.open();

    const iframe = document.querySelector('iframe');
    expect(iframe).toBeTruthy();
    expect(iframe?.getAttribute('title')).toBe('img-man Asset Manager');

    const src = new URL(iframe?.getAttribute('src') ?? '');
    expect(src.pathname).toBe('/embed');
    expect(src.searchParams.get('orgSlug')).toBe('acme-corp');
    expect(src.searchParams.get('apiKey')).toBe('img_abc123');
    expect(src.searchParams.get('mode')).toBe('picker');
    expect(src.searchParams.get('maxFiles')).toBe('5');
    expect(src.searchParams.get('theme')).toBe('light');

    window.dispatchEvent(
      new MessageEvent('message', { data: { type: 'imageman:ready' } }),
    );
    window.dispatchEvent(
      new MessageEvent('message', {
        data: {
          type: 'imageman:assets-confirmed',
          payload: [
            {
              id: 'asset-1',
              url: 'https://cdn.example/asset-1.png',
              name: 'asset-1.png',
              mimeType: 'image/png',
              width: 1200,
              height: 800,
            },
          ],
        },
      }),
    );
    window.dispatchEvent(
      new MessageEvent('message', {
        data: {
          type: 'imageman:upload-complete',
          payload: {
            id: 'asset-2',
            url: 'https://cdn.example/asset-2.png',
            name: 'asset-2.png',
          },
        },
      }),
    );
    window.dispatchEvent(
      new MessageEvent('message', {
        data: {
          type: 'imageman:error',
          payload: {
            code: 'upload_failed',
            message: 'Upload failed',
          },
        },
      }),
    );

    expect(onReady).toHaveBeenCalledOnce();
    expect(onSelect).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'asset-1', name: 'asset-1.png' }),
    ]);
    expect(onUpload).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'asset-2', name: 'asset-2.png' }),
    );
    expect(onError).toHaveBeenCalledWith({
      code: 'upload_failed',
      message: 'Upload failed',
    });

    widget.close();
    expect(document.querySelector('iframe')).toBeNull();
  });

  it('supports runtime theme messaging and permanent destroy semantics', () => {
    const container = document.getElementById('widget-target');
    expect(container).toBeTruthy();

    const widget = new ImgManWidget({
      container: container!,
      orgSlug: 'acme-corp',
      apiKey: 'img_abc123',
      mode: 'full',
      baseUrl: 'https://imageman.example',
    });

    widget.open();

    const iframe = document.querySelector('iframe') as HTMLIFrameElement | null;
    expect(iframe).toBeTruthy();

    const postMessage = vi.fn();
    Object.defineProperty(iframe!, 'contentWindow', {
      configurable: true,
      value: { postMessage },
    });

    widget.setTheme(true, 'FF5500');

    expect(postMessage).toHaveBeenCalledWith(
      {
        type: 'imageman:theme',
        payload: { dark: true, accentColor: 'FF5500' },
      },
      '*',
    );

    widget.destroy();
    expect(document.querySelector('iframe')).toBeNull();
    expect(() => widget.open()).toThrow(/destroyed/);
  });
});