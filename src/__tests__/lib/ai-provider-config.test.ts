// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, beforeEach } from 'vitest';
import {
  encryptStoredOpenAiApiKey,
  decryptStoredOpenAiApiKey,
} from '@/lib/ai-provider-config';

describe('encryptStoredOpenAiApiKey', () => {
  beforeEach(() => {
    process.env.GCP_CREDENTIALS_ENCRYPTION_KEY = 'test-key-for-ai-provider-config';
  });

  it('returns undefined for undefined input', () => {
    expect(encryptStoredOpenAiApiKey(undefined)).toBeUndefined();
  });

  it('returns undefined for empty string', () => {
    expect(encryptStoredOpenAiApiKey('')).toBeUndefined();
  });

  it('returns undefined for whitespace-only string', () => {
    expect(encryptStoredOpenAiApiKey('   ')).toBeUndefined();
  });

  it('encrypts a valid API key', () => {
    const key = 'sk-test-abc123def456ghi789';
    const encrypted = encryptStoredOpenAiApiKey(key);
    expect(encrypted).toBeDefined();
    expect(encrypted).toContain('enc:openai-api-key:v1:');
  });

  it('returns the same value if already encrypted (idempotent)', () => {
    const key = 'sk-test-some-key';
    const encrypted = encryptStoredOpenAiApiKey(key)!;
    const re_encrypted = encryptStoredOpenAiApiKey(encrypted);
    // Should return the already-encrypted string unchanged
    expect(re_encrypted).toBe(encrypted);
  });

  it('trims whitespace before encrypting', () => {
    const key = '  sk-test-trimmed-key  ';
    const encrypted = encryptStoredOpenAiApiKey(key)!;
    const decrypted = decryptStoredOpenAiApiKey(encrypted);
    expect(decrypted).toBe('sk-test-trimmed-key');
  });
});

describe('decryptStoredOpenAiApiKey', () => {
  beforeEach(() => {
    process.env.GCP_CREDENTIALS_ENCRYPTION_KEY = 'test-key-for-ai-provider-config';
  });

  it('returns undefined for undefined input', () => {
    expect(decryptStoredOpenAiApiKey(undefined)).toBeUndefined();
  });

  it('returns undefined for empty string', () => {
    expect(decryptStoredOpenAiApiKey('')).toBeUndefined();
  });

  it('returns undefined for whitespace-only string', () => {
    expect(decryptStoredOpenAiApiKey('   ')).toBeUndefined();
  });

  it('returns raw key if not encrypted (missing prefix)', () => {
    const rawKey = 'sk-test-not-encrypted';
    expect(decryptStoredOpenAiApiKey(rawKey)).toBe(rawKey);
  });

  it('round-trips: decrypt(encrypt(key)) === key', () => {
    const key = 'sk-test-round-trip-key-xyz';
    const encrypted = encryptStoredOpenAiApiKey(key)!;
    const decrypted = decryptStoredOpenAiApiKey(encrypted);
    expect(decrypted).toBe(key);
  });

  it('throws on a corrupted encrypted payload', () => {
    const badPayload = 'enc:openai-api-key:v1:corrupted-payload-not-base64!!!!';
    expect(() => decryptStoredOpenAiApiKey(badPayload)).toThrow();
  });
});
