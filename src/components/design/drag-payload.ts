// SPDX-License-Identifier: Apache-2.0
/**
 * Drag-and-drop payload helpers for the Design Studio sidebar.
 * Shared between the editor canvas (`editor.tsx`) and any sidebar
 * panel that wants to expose its items as draggable sources.
 *
 * D36 — `v0.14.0` Design Studio v1.0 floor.
 */

export const DESIGN_DRAG_MIME = 'application/x-imgman-design';

export type DesignDragKind = 'image' | 'asset';

export interface DesignDragPayload {
  kind: DesignDragKind;
  /** Public URL the canvas can fetch / embed directly. */
  url: string;
  /** Display name for the new layer. */
  name: string;
  /** Optional original asset id when the source is the org library. */
  assetId?: string;
}

/** Set drag payload + a sensible drag image fallback on a `dragstart` event. */
export function setDesignDragPayload(
  event: React.DragEvent<Element>,
  payload: DesignDragPayload,
): void {
  try {
    event.dataTransfer.setData(DESIGN_DRAG_MIME, JSON.stringify(payload));
    // Plain text fallback so external targets (text editors, address bars)
    // still receive something useful.
    event.dataTransfer.setData('text/uri-list', payload.url);
    event.dataTransfer.setData('text/plain', payload.url);
    event.dataTransfer.effectAllowed = 'copy';
  } catch {
    // Some browsers throw if dataTransfer is read-only outside user gesture.
  }
}

/** Read a structured payload from a `drop` event, or `null` if absent/invalid. */
export function readDesignDragPayload(
  event: React.DragEvent<Element> | DragEvent,
): DesignDragPayload | null {
  const dt = event.dataTransfer;
  if (!dt) return null;
  const raw = dt.getData(DESIGN_DRAG_MIME);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as DesignDragPayload;
      if (parsed && typeof parsed.url === 'string' && parsed.url) {
        return {
          kind: parsed.kind === 'asset' ? 'asset' : 'image',
          url: parsed.url,
          name: typeof parsed.name === 'string' && parsed.name ? parsed.name : 'Image',
          assetId: typeof parsed.assetId === 'string' ? parsed.assetId : undefined,
        };
      }
    } catch {
      // fall through to URI fallback
    }
  }
  const uri = dt.getData('text/uri-list') || dt.getData('text/plain');
  if (uri && /^https?:\/\//i.test(uri)) {
    return { kind: 'image', url: uri, name: 'Dropped image' };
  }
  return null;
}
