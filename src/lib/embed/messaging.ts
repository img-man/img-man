// SPDX-License-Identifier: Apache-2.0
/**
 * postMessage API for parent ↔ iframe communication.
 *
 * Provides type-safe message definitions and helpers
 * for the embeddable img-man widget.
 */

// ─── Message Types ──────────────────────────────────────────────

/** Events emitted FROM the widget TO the parent window. */
export type WidgetOutboundEvent =
  | { type: 'imageman:ready' }
  | {
      type: 'imageman:asset-selected';
      payload: {
        id: string;
        url: string;
        name: string;
        mimeType: string;
        width: number;
        height: number;
      };
    }
  | {
      type: 'imageman:assets-confirmed';
      payload: Array<{
        id: string;
        url: string;
        name: string;
        mimeType: string;
        width: number;
        height: number;
      }>;
    }
  | {
      type: 'imageman:upload-complete';
      payload: { id: string; url: string; name: string };
    }
  | {
      type: 'imageman:error';
      payload: { code: string; message: string };
    }
  | { type: 'imageman:close' };

/** Commands sent FROM the parent TO the widget. */
export type WidgetInboundCommand =
  | {
      type: 'imageman:open';
      config?: { mode?: string; maxFiles?: number; accept?: string };
    }
  | { type: 'imageman:close' }
  | {
      type: 'imageman:theme';
      payload: { dark?: boolean; accentColor?: string };
    }
  | {
      type: 'imageman:resize';
      payload: { width: number; height: number };
    };

export type WidgetMessage = WidgetOutboundEvent | WidgetInboundCommand;

// ─── Sending helpers (used inside the widget) ───────────────────

/**
 * Post a message to the parent window.
 * No-op if not running inside an iframe.
 */
export function postToParent(event: WidgetOutboundEvent): void {
  if (typeof window === 'undefined') return;
  if (window.parent === window) return; // not in an iframe

  // Use '*' for origin — security is enforced via API key domain check.
  window.parent.postMessage(event, '*');
}

/**
 * Send a "ready" event to parent. Should be called once on mount.
 */
export function notifyReady(): void {
  postToParent({ type: 'imageman:ready' });
}

/**
 * Send asset-selected event.
 */
export function notifyAssetSelected(asset: {
  id: string;
  url: string;
  name: string;
  mimeType: string;
  width: number;
  height: number;
}): void {
  postToParent({ type: 'imageman:asset-selected', payload: asset });
}

/**
 * Send confirmed assets event (picker mode confirm button).
 */
export function notifyAssetsConfirmed(
  assets: Array<{
    id: string;
    url: string;
    name: string;
    mimeType: string;
    width: number;
    height: number;
  }>,
): void {
  postToParent({ type: 'imageman:assets-confirmed', payload: assets });
}

/**
 * Send upload-complete event.
 */
export function notifyUploadComplete(asset: {
  id: string;
  url: string;
  name: string;
}): void {
  postToParent({ type: 'imageman:upload-complete', payload: asset });
}

/**
 * Send error event.
 */
export function notifyError(code: string, message: string): void {
  postToParent({ type: 'imageman:error', payload: { code, message } });
}

// ─── Receiving helpers (used inside the widget) ─────────────────

/**
 * Subscribe to commands from the parent window.
 * Returns an unsubscribe function.
 */
export function onParentCommand(
  handler: (cmd: WidgetInboundCommand) => void,
): () => void {
  if (typeof window === 'undefined') return () => {};

  const listener = (event: MessageEvent) => {
    const data = event.data;
    if (
      data &&
      typeof data.type === 'string' &&
      data.type.startsWith('imageman:')
    ) {
      handler(data as WidgetInboundCommand);
    }
  };

  window.addEventListener('message', listener);
  return () => window.removeEventListener('message', listener);
}

// ─── Helpers for parent page (used by SDK) ──────────────────────

/**
 * Subscribe to events from the widget iframe.
 * Returns an unsubscribe function.
 */
export function onWidgetEvent(
  handler: (event: WidgetOutboundEvent) => void,
): () => void {
  if (typeof window === 'undefined') return () => {};

  const listener = (event: MessageEvent) => {
    const data = event.data;
    if (
      data &&
      typeof data.type === 'string' &&
      data.type.startsWith('imageman:')
    ) {
      handler(data as WidgetOutboundEvent);
    }
  };

  window.addEventListener('message', listener);
  return () => window.removeEventListener('message', listener);
}

/**
 * Send a command to the widget iframe.
 */
export function sendToWidget(
  iframe: HTMLIFrameElement,
  command: WidgetInboundCommand,
): void {
  iframe.contentWindow?.postMessage(command, '*');
}

/**
 * Send a resize command to tell the widget its container dimensions.
 * Call this from the parent page when the iframe container resizes.
 */
export function sendResizeToWidget(
  iframe: HTMLIFrameElement,
  width: number,
  height: number,
): void {
  sendToWidget(iframe, {
    type: 'imageman:resize',
    payload: { width, height },
  });
}

/**
 * Subscribe to resize commands inside the widget.
 * Returns an unsubscribe function.
 *
 * @example
 * ```ts
 * const unsub = onParentResize((size) => {
 *   console.log(`Container is ${size.width}x${size.height}`);
 * });
 * ```
 */
export function onParentResize(
  handler: (size: { width: number; height: number }) => void,
): () => void {
  return onParentCommand((cmd) => {
    if (cmd.type === 'imageman:resize' && 'payload' in cmd) {
      handler(cmd.payload);
    }
  });
}
