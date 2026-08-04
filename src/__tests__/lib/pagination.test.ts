// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';

import {
  clampPageSize,
  cursorToMongoFilter,
  decodeCursor,
  encodeCursor,
  paginate,
} from '@/lib/pagination';

const HEX24 = '507f1f77bcf86cd799439011';

describe('encodeCursor / decodeCursor (D47)', () => {
  it('round-trips a payload', () => {
    const token = encodeCursor({ t: 1714560000000, i: HEX24 });
    expect(decodeCursor(token)).toEqual({ t: 1714560000000, i: HEX24 });
  });
  it('returns null for missing or malformed tokens', () => {
    expect(decodeCursor(null)).toBeNull();
    expect(decodeCursor('')).toBeNull();
    expect(decodeCursor('not-base64-json')).toBeNull();
    expect(decodeCursor(encodeCursor({ t: 1, i: HEX24 }).slice(0, -2))).toBeNull();
  });
  it('rejects non-hex object ids when encoding', () => {
    expect(() => encodeCursor({ t: 1, i: 'nope' })).toThrow();
  });
});

describe('clampPageSize (D47)', () => {
  it('clamps to [1, 200] and floors fractional values', () => {
    expect(clampPageSize(0)).toBe(50);
    expect(clampPageSize(-3)).toBe(50);
    expect(clampPageSize(1000)).toBe(200);
    expect(clampPageSize(50.7)).toBe(50);
    expect(clampPageSize('25')).toBe(25);
    expect(clampPageSize(undefined)).toBe(50);
    expect(clampPageSize(undefined, 25)).toBe(25);
  });
});

describe('paginate (D47)', () => {
  const items = Array.from({ length: 5 }, (_, i) => ({
    id: `5${'0'.repeat(22)}${i}`.slice(-24),
    createdAt: new Date(1714560000000 + i * 1000),
  }));

  it('returns first page and a next cursor when more items remain', () => {
    const page = paginate({ items, pageSize: 2, getKey: (x) => x });
    expect(page.items).toHaveLength(2);
    expect(page.hasMore).toBe(true);
    expect(page.nextCursor).not.toBeNull();
    const decoded = decodeCursor(page.nextCursor);
    expect(decoded?.t).toBe(items[1].createdAt.getTime());
    expect(decoded?.i).toBe(items[1].id);
  });

  it('returns null cursor when the page is the last one', () => {
    const page = paginate({ items: items.slice(0, 2), pageSize: 5, getKey: (x) => x });
    expect(page.items).toHaveLength(2);
    expect(page.hasMore).toBe(false);
    expect(page.nextCursor).toBeNull();
  });
});

describe('cursorToMongoFilter (D47)', () => {
  it('produces the (createdAt desc, _id desc) "after" clause', () => {
    const cursor = encodeCursor({ t: 1714560000000, i: HEX24 });
    const filter = cursorToMongoFilter(cursor);
    expect(filter).toEqual({
      $or: [
        { createdAt: { $lt: new Date(1714560000000) } },
        { createdAt: new Date(1714560000000), _id: { $lt: HEX24 } },
      ],
    });
  });

  it('returns empty filter when the cursor is missing or invalid', () => {
    expect(cursorToMongoFilter(undefined)).toEqual({});
    expect(cursorToMongoFilter('garbage')).toEqual({});
  });
});
