// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';

import { inspectApiKey, redact } from '@/lib/api-key-diagnostics';

const VALID_LIVE = 'im_live_aBCDefGHIjKLMnoPQRStu';   // 22-char payload
const VALID_TEST = 'im_test_aBCDefGHIjKLMnoPQRStu';

describe('inspectApiKey (D53)', () => {
  it('returns ok for a well-formed live key', () => {
    const r = inspectApiKey(VALID_LIVE);
    expect(r.diagnosis).toBe('ok');
    expect(r.shape.environment).toBe('live');
    expect(r.shape.charsetOk).toBe(true);
    expect(r.shape.payloadLength).toBeGreaterThanOrEqual(20);
    expect(r.redacted).toMatch(/^im_live_\u2026/);
    expect(r.redacted).not.toContain('aBCDef');
  });

  it('returns wrong-environment when the org expects live but got test', () => {
    const r = inspectApiKey(VALID_TEST, { expectedEnvironment: 'live' });
    expect(r.diagnosis).toBe('wrong-environment');
    expect(r.notes[0]).toMatch(/expects a live key/);
  });

  it('returns looks-revoked when revokedAt is provided', () => {
    const r = inspectApiKey(VALID_LIVE, { revokedAt: new Date('2026-01-01T00:00:00Z') });
    expect(r.diagnosis).toBe('looks-revoked');
  });

  it('flags unknown-shape for a key without the expected prefix', () => {
    const r = inspectApiKey('sk-aBCDefGHIjKLMnoPQRStu');
    expect(r.diagnosis).toBe('unknown-shape');
    expect(r.shape.environment).toBe('unknown');
  });

  it('flags too-short payloads with a note', () => {
    const r = inspectApiKey('im_live_short');
    expect(r.notes.some((n) => /at least 20/.test(n))).toBe(true);
  });

  it('returns empty for blank input', () => {
    expect(inspectApiKey('').diagnosis).toBe('empty');
    expect(inspectApiKey(undefined).diagnosis).toBe('empty');
  });
});

describe('redact (D53)', () => {
  it('keeps the prefix and last 4 chars only', () => {
    const r = redact(VALID_LIVE);
    expect(r.startsWith('im_live_')).toBe(true);
    expect(r.endsWith(VALID_LIVE.slice(-4))).toBe(true);
    expect(r).not.toContain(VALID_LIVE.slice(8, -4));
  });
  it('falls back to a generic mask for unknown-shape keys', () => {
    expect(redact('xyzlongkey1234567890')).toMatch(/^xy\u20267890$/);
    expect(redact('short')).toBe('\u2022\u2022\u2022\u2022');
  });
});
