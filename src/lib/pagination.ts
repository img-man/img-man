// SPDX-License-Identifier: Apache-2.0
/**
 * Cursor pagination (D47).
 *
 * The asset listing endpoints page over `(createdAt desc, _id desc)` to be
 * stable in the face of inserts. This module encodes / decodes the opaque
 * cursor token and exposes a tiny helper that builds the Mongo filter clause
 * for "after this cursor".
 *
 * Token format: `base64url(JSON({ t: epoch_ms, i: hex_objectid }))`. Pure,
 * no I/O. Caller still has to perform the actual DB query.
 */

export interface CursorPayload {
  /** Sort key: createdAt as epoch milliseconds. */
  t: number;
  /** Tie-breaker: ObjectId as 24-char lowercase hex. */
  i: string;
}

export interface PaginationInput<T> {
  items: readonly T[];
  pageSize: number;
  /** How to read `(createdAt, id)` off an item. */
  getKey: (item: T) => { createdAt: Date; id: string };
}

export interface PaginationPage<T> {
  items: T[];
  /** Cursor to pass back as `?cursor=...` for the next page. Null when done. */
  nextCursor: string | null;
  /** Convenience: same as `nextCursor !== null`. */
  hasMore: boolean;
}

const MIN_PAGE_SIZE = 1;
const MAX_PAGE_SIZE = 200;

/** Encode a cursor token. */
export function encodeCursor(payload: CursorPayload): string {
  if (!Number.isFinite(payload.t)) throw new Error('encodeCursor: t must be finite');
  if (!/^[a-f0-9]{24}$/i.test(payload.i)) throw new Error('encodeCursor: i must be 24-hex');
  const json = JSON.stringify({ t: Math.floor(payload.t), i: payload.i.toLowerCase() });
  return base64UrlEncode(json);
}

/** Decode a cursor token. Returns `null` on any failure (malformed, tampered). */
export function decodeCursor(cursor: string | null | undefined): CursorPayload | null {
  if (!cursor) return null;
  try {
    const json = base64UrlDecode(cursor);
    const parsed = JSON.parse(json) as Partial<CursorPayload>;
    if (typeof parsed.t !== 'number' || !Number.isFinite(parsed.t)) return null;
    if (typeof parsed.i !== 'string' || !/^[a-f0-9]{24}$/i.test(parsed.i)) return null;
    return { t: Math.floor(parsed.t), i: parsed.i.toLowerCase() };
  } catch {
    return null;
  }
}

/**
 * Clamp a requested page size into the safe range. Falsy / non-numeric inputs
 * fall back to `defaultSize`.
 */
export function clampPageSize(requested: unknown, defaultSize = 50): number {
  const n = typeof requested === 'number' ? requested : Number(requested);
  if (!Number.isFinite(n) || n <= 0) return defaultSize;
  return Math.min(MAX_PAGE_SIZE, Math.max(MIN_PAGE_SIZE, Math.floor(n)));
}

/**
 * Slice an in-memory array into a single page and emit the cursor pointing at
 * the last item. The DB-backed code path skips this entirely \u2014 it queries
 * `pageSize + 1` items and uses the extra row to decide `hasMore` / build the
 * cursor. Both paths share the same encoder.
 */
export function paginate<T>(input: PaginationInput<T>): PaginationPage<T> {
  const size = clampPageSize(input.pageSize);
  const slice = input.items.slice(0, size);
  const hasMore = input.items.length > size;
  const last = slice[slice.length - 1];
  const nextCursor = hasMore && last
    ? encodeCursor({ t: input.getKey(last).createdAt.getTime(), i: input.getKey(last).id })
    : null;
  return { items: slice, nextCursor, hasMore };
}

/**
 * Build the Mongo filter clause for "items strictly older than this cursor"
 * under a `(createdAt desc, _id desc)` sort. Returns an empty object when the
 * cursor is missing/invalid so the caller naturally gets the first page.
 */
export function cursorToMongoFilter(
  cursor: string | null | undefined,
): Record<string, unknown> {
  const decoded = decodeCursor(cursor);
  if (!decoded) return {};
  const cutoff = new Date(decoded.t);
  return {
    $or: [
      { createdAt: { $lt: cutoff } },
      { createdAt: cutoff, _id: { $lt: decoded.i } },
    ],
  };
}

// ── helpers ───────────────────────────────────────────────────────────────

function base64UrlEncode(s: string): string {
  // Cross-platform: use Node Buffer when available, otherwise btoa.
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(s, 'utf8').toString('base64')
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  // Browser fallback.
  const b64 = btoa(unescape(encodeURIComponent(s)));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(s: string): string {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(padded, 'base64').toString('utf8');
  }
  return decodeURIComponent(escape(atob(padded)));
}
