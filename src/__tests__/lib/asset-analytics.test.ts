// SPDX-License-Identifier: Apache-2.0
/**
 * Tests for the storage-side helpers in lib/asset-analytics.
 * The recorder itself is tested via the API tests; here we exercise the pure
 * functions: encoding, time math, bucket rollups and raw pruning.
 */
import { describe, it, expect } from 'vitest';
import {
  encodeRawRecord,
  decodeRawRecord,
  buildTransformKey,
  hashIp,
  trimReferer,
  weekKey,
  monthKey,
  startOfIsoWeek,
  rollupBuckets,
  pruneRaw,
  type AssetAccessRecord,
} from '@/lib/asset-analytics';
import type { IAnalyticsBucket, IAnalyticsRawRecord } from '@/models/asset-analytics';

describe('encodeRawRecord / decodeRawRecord', () => {
  it('round-trips all fields losslessly', () => {
    const record: AssetAccessRecord = {
      status: 200,
      failed: false,
      bytesServed: 12345,
      country: 'US',
      city: 'Seattle',
      region: 'WA',
      referer: 'example.com',
      userAgent: 'Mozilla/5.0',
      ipHash: 'abc123',
      transformKey: 'w=200,fit=cover',
      latencyMs: 42,
    };
    const b = encodeRawRecord(record);
    expect(typeof b).toBe('string');
    expect(b.length).toBeGreaterThan(0);

    const decoded = decodeRawRecord({ b, createdAt: new Date('2026-05-10') });
    expect(decoded.status).toBe(200);
    expect(decoded.country).toBe('US');
    expect(decoded.transformKey).toBe('w=200,fit=cover');
    expect(decoded.bytesServed).toBe(12345);
    expect(decoded.failed).toBe(false);
    expect(decoded.createdAt).toEqual(new Date('2026-05-10'));
  });

  it('skips empty/null fields to keep payload compact', () => {
    const b = encodeRawRecord({ status: 304, failed: false });
    const json = JSON.parse(Buffer.from(b, 'base64').toString('utf8'));
    expect(json.s).toBe(304);
    expect(json.co).toBeUndefined();
    expect(json.r).toBeUndefined();
    expect(json.b).toBeUndefined();
  });

  it('returns a sane fallback on corrupt base64', () => {
    const decoded = decodeRawRecord({ b: '!!notbase64!!', createdAt: new Date() });
    expect(decoded.status).toBe(0);
    expect(decoded.country).toBeNull();
  });
});

describe('buildTransformKey', () => {
  it('builds a sorted comma-joined key, skipping empties', () => {
    expect(buildTransformKey({ w: 200, h: 100, fit: 'cover', q: null, format: '' }))
      .toBe('fit=cover,h=100,w=200');
  });

  it('returns "original" when nothing is set', () => {
    expect(buildTransformKey({ w: null, h: null, format: '' })).toBe('original');
  });
});

describe('hashIp / trimReferer', () => {
  it('returns null for empty inputs', () => {
    expect(hashIp(null)).toBeNull();
    expect(trimReferer(null)).toBeNull();
  });

  it('hashes an IP deterministically and truncates', () => {
    const a = hashIp('1.2.3.4');
    const b = hashIp('1.2.3.4');
    expect(a).toBe(b);
    expect(a?.length).toBe(16);
  });

  it('trims referer to host', () => {
    expect(trimReferer('https://docs.example.com/page?x=1'))
      .toBe('docs.example.com');
  });

  it('falls back to truncated string for invalid URLs', () => {
    const out = trimReferer('not a url at all but very long '.repeat(10));
    expect(out?.length).toBeLessThanOrEqual(80);
  });
});

describe('weekKey / monthKey / startOfIsoWeek', () => {
  it('produces YYYY-Www format', () => {
    expect(weekKey(new Date('2026-05-10T12:00:00Z'))).toMatch(/^\d{4}-W\d{2}$/);
  });

  it('produces YYYY-MM format', () => {
    expect(monthKey(new Date('2026-05-10T12:00:00Z'))).toBe('2026-05');
  });

  it('returns Monday for the start of an ISO week', () => {
    // 2026-05-10 is a Sunday.
    const monday = startOfIsoWeek(new Date('2026-05-10T00:00:00Z'));
    expect(monday.getUTCDay()).toBe(1);
  });
});

describe('rollupBuckets', () => {
  function makeRecord(over: Partial<AssetAccessRecord> = {}): AssetAccessRecord {
    return {
      status: 200,
      failed: false,
      bytesServed: 100,
      country: 'US',
      referer: 'example.com',
      transformKey: 'original',
      ...over,
    };
  }

  it('creates a new weekly bucket on first record', () => {
    const weekly: IAnalyticsBucket[] = [];
    const monthly: IAnalyticsBucket[] = [];
    const now = new Date('2026-05-04T10:00:00Z'); // Monday
    rollupBuckets({ weekly, monthly, record: makeRecord(), now });
    expect(weekly).toHaveLength(1);
    expect(weekly[0].views).toBe(1);
    expect(weekly[0].bytesServed).toBe(100);
    expect(weekly[0].byCountry.US).toBe(1);
  });

  it('accumulates into the same weekly bucket within the week', () => {
    const weekly: IAnalyticsBucket[] = [];
    const monthly: IAnalyticsBucket[] = [];
    const now = new Date('2026-05-04T10:00:00Z');
    rollupBuckets({ weekly, monthly, record: makeRecord(), now });
    rollupBuckets({ weekly, monthly, record: makeRecord({ failed: true, status: 500 }), now });
    expect(weekly).toHaveLength(1);
    expect(weekly[0].views).toBe(2);
    expect(weekly[0].failures).toBe(1);
    expect(weekly[0].byStatus['500']).toBe(1);
  });

  it('rotates oldest weekly bucket into monthly when cap exceeded', () => {
    const weekly: IAnalyticsBucket[] = [];
    const monthly: IAnalyticsBucket[] = [];

    // Six different ISO weeks → cap of 5 means oldest must roll into monthly.
    const dates = [
      '2026-04-06T10:00:00Z', // Mon week 15
      '2026-04-13T10:00:00Z', // week 16
      '2026-04-20T10:00:00Z', // week 17
      '2026-04-27T10:00:00Z', // week 18
      '2026-05-04T10:00:00Z', // week 19
      '2026-05-11T10:00:00Z', // week 20
    ];
    for (const d of dates) {
      rollupBuckets({ weekly, monthly, record: makeRecord(), now: new Date(d) });
    }

    expect(weekly).toHaveLength(5);
    // The April 6 bucket is gone.
    expect(weekly.some((b) => b.key.endsWith('W15'))).toBe(false);
    // Its data was folded into monthly[2026-04].
    const apr = monthly.find((b) => b.key === '2026-04');
    expect(apr).toBeDefined();
    expect(apr?.views).toBe(1);
    expect(apr?.byCountry.US).toBe(1);
  });
});

describe('pruneRaw', () => {
  it('drops entries older than retention window', () => {
    const now = new Date('2026-05-10T00:00:00Z');
    const raw: IAnalyticsRawRecord[] = [
      { createdAt: new Date('2026-03-01'), b: 'old' },
      { createdAt: new Date('2026-05-09'), b: 'fresh' },
    ];
    pruneRaw(raw, 1000, 30, now);
    expect(raw).toHaveLength(1);
    expect(raw[0].b).toBe('fresh');
  });

  it('caps the array to maxRecords keeping the most recent', () => {
    const now = new Date('2026-05-10T00:00:00Z');
    // Records appended chronologically (oldest first → newest last), as the
    // recorder does in production.
    const raw: IAnalyticsRawRecord[] = Array.from({ length: 10 }, (_, i) => ({
      createdAt: new Date(now.getTime() - (9 - i) * 1000),
      b: `r${i}`,
    }));
    pruneRaw(raw, 3, 365, now);
    expect(raw).toHaveLength(3);
    expect(raw.map((r) => r.b)).toEqual(['r7', 'r8', 'r9']);
  });
});
