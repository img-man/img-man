// SPDX-License-Identifier: Apache-2.0
/**
 * img-man JavaScript SDK
 *
 * Provides a simple API to embed the img-man widget in any web application.
 *
 * Usage:
 *   import { ImgManWidget } from '@img-man/sdk';
 *
 *   const widget = new ImgManWidget({
 *     container: '#imgman-container',
 *     orgSlug: 'acme-corp',
 *     apiKey: 'img_xyz789',
 *     mode: 'picker',
 *     onSelect: (assets) => console.log('Selected:', assets),
 *   });
 *   widget.open();
 *
 * Loaded from a <script> tag instead, the same class is at `ImageMan.Widget`
 * (`img-man` is not a valid JS identifier, so the global keeps the old name).
 *
 * This surface takes the org API key in the browser. Prefer the server-minted
 * token flow in customer-docs/features/embed.md for anything user-facing.
 */

export interface ImgManWidgetConfig {
  /** CSS selector or HTMLElement for the iframe container. */
  container: string | HTMLElement;
  /** Organization slug. */
  orgSlug: string;
  /** API key for authentication. */
  apiKey: string;
  /** Widget mode: picker, uploader, or full. Default: 'full'. */
  mode?: 'picker' | 'uploader' | 'full';
  /** Max number of files that can be selected. Default: 1. */
  maxFiles?: number;
  /** MIME type filter. Default: 'image/*'. */
  accept?: string;
  /** Color theme. Default: 'light'. */
  theme?: 'dark' | 'light';
  /** Accent color (hex without #). Default: '3B82F6'. */
  accentColor?: string;
  /** Hide the upload button. Default: false. */
  hideUpload?: boolean;
  /** Base URL for the img-man instance. */
  baseUrl?: string;

  // ─── Callbacks ─────────────────────────────────────────────
  /** Called when the user selects an asset (single). */
  onSelect?: (assets: ImgManAsset[]) => void;
  /** Called when an upload completes. */
  onUpload?: (asset: { id: string; url: string; name: string }) => void;
  /** Called when the widget is ready. */
  onReady?: () => void;
  /** Called when an error occurs. */
  onError?: (error: { code: string; message: string }) => void;
}

export interface ImgManAsset {
  id: string;
  url: string;
  name: string;
  mimeType: string;
  width: number;
  height: number;
}

export class ImgManWidget {
  private config: Required<
    Pick<ImgManWidgetConfig, 'orgSlug' | 'apiKey' | 'mode' | 'maxFiles' | 'accept' | 'theme' | 'accentColor' | 'hideUpload' | 'baseUrl'>
  > & Pick<ImgManWidgetConfig, 'onSelect' | 'onUpload' | 'onReady' | 'onError'>;
  private containerEl: HTMLElement;
  private iframe: HTMLIFrameElement | null = null;
  private messageHandler: ((e: MessageEvent) => void) | null = null;
  private destroyed = false;

  constructor(config: ImgManWidgetConfig) {
    // Resolve container
    if (typeof config.container === 'string') {
      const el = document.querySelector(config.container) as HTMLElement;
      if (!el) throw new Error(`ImageMan: container "${config.container}" not found`);
      this.containerEl = el;
    } else {
      this.containerEl = config.container;
    }

    this.config = {
      orgSlug: config.orgSlug,
      apiKey: config.apiKey,
      mode: config.mode ?? 'full',
      maxFiles: config.maxFiles ?? 1,
      accept: config.accept ?? 'image/*',
      theme: config.theme ?? 'light',
      accentColor: config.accentColor ?? '3B82F6',
      hideUpload: config.hideUpload ?? false,
      baseUrl: config.baseUrl ?? window.location.origin,
      onSelect: config.onSelect,
      onUpload: config.onUpload,
      onReady: config.onReady,
      onError: config.onError,
    };
  }

  /** Create the iframe and mount it in the container. */
  open(): void {
    if (this.destroyed) throw new Error('ImageMan: widget has been destroyed');
    if (this.iframe) return; // already open

    const params = new URLSearchParams({
      orgSlug: this.config.orgSlug,
      apiKey: this.config.apiKey,
      mode: this.config.mode,
      maxFiles: String(this.config.maxFiles),
      accept: this.config.accept,
      theme: this.config.theme,
      accentColor: this.config.accentColor,
      hideUpload: String(this.config.hideUpload),
    });

    this.iframe = document.createElement('iframe');
    this.iframe.src = `${this.config.baseUrl}/embed?${params}`;
    this.iframe.style.cssText =
      'width:100%;height:100%;border:none;display:block;';
    this.iframe.setAttribute('allow', 'clipboard-write');
    this.iframe.setAttribute('title', 'img-man Asset Manager');

    // Listen for messages from iframe
    this.messageHandler = (event: MessageEvent) => {
      if (!event.data || typeof event.data.type !== 'string') return;
      if (!event.data.type.startsWith('imageman:')) return;

      switch (event.data.type) {
        case 'imageman:ready':
          this.config.onReady?.();
          break;
        case 'imageman:asset-selected':
          // Single selection event — accumulate if needed
          break;
        case 'imageman:assets-confirmed':
          this.config.onSelect?.(event.data.payload);
          break;
        case 'imageman:upload-complete':
          this.config.onUpload?.(event.data.payload);
          break;
        case 'imageman:error':
          this.config.onError?.(event.data.payload);
          break;
        case 'imageman:clipboard-copy': {
          const text = typeof event.data.text === 'string' ? event.data.text : '';
          if (text) {
            try {
              if (navigator.clipboard && window.isSecureContext) {
                navigator.clipboard.writeText(text).catch(() => {});
              } else {
                const ta = document.createElement('textarea');
                ta.value = text;
                ta.style.position = 'fixed';
                ta.style.top = '-9999px';
                document.body.appendChild(ta);
                ta.focus();
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
              }
            } catch {
              // ignore
            }
          }
          break;
        }
      }
    };
    window.addEventListener('message', this.messageHandler);

    this.containerEl.appendChild(this.iframe);
  }

  /** Remove the iframe from the container. */
  close(): void {
    if (this.iframe) {
      this.iframe.remove();
      this.iframe = null;
    }
    if (this.messageHandler) {
      window.removeEventListener('message', this.messageHandler);
      this.messageHandler = null;
    }
  }

  /** Set theme at runtime. */
  setTheme(dark: boolean, accentColor?: string): void {
    this.iframe?.contentWindow?.postMessage(
      {
        type: 'imageman:theme',
        payload: { dark, accentColor },
      },
      '*',
    );
  }

  /** Permanently destroy the widget instance. */
  destroy(): void {
    this.close();
    this.destroyed = true;
  }
}

// ─── UMD export for <script> tag usage ──────────────────────────
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).ImageMan = { Widget: ImgManWidget };
}

export * from './edition';
export * from './agent';
