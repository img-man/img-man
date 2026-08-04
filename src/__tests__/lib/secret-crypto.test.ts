// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, beforeEach } from 'vitest';
import { encryptStoredSecret, decryptStoredSecret } from '@/lib/secret-crypto';

const PREFIX = 'gcp_cred_';

describe('encryptStoredSecret / decryptStoredSecret', () => {
  beforeEach(() => {
    // Use a deterministic test key so we don't need a real env
    process.env.GCP_CREDENTIALS_ENCRYPTION_KEY = 'test-encryption-key-for-unit-tests';
  });

  it('round-trips: decrypt(encrypt(value)) === value', () => {
    const plain = 'my-super-secret-value';
    const encrypted = encryptStoredSecret(plain, PREFIX);
    const decrypted = decryptStoredSecret(encrypted, PREFIX);
    expect(decrypted).toBe(plain);
  });

  it('produces different ciphertexts each call (random IV)', () => {
    const plain = 'same-value';
    const a = encryptStoredSecret(plain, PREFIX);
    const b = encryptStoredSecret(plain, PREFIX);
    expect(a).not.toBe(b); // different IVs → different ciphertext
    // But both decrypt to the same thing
    expect(decryptStoredSecret(a, PREFIX)).toBe(plain);
    expect(decryptStoredSecret(b, PREFIX)).toBe(plain);
  });

  it('encrypted value starts with the prefix', () => {
    const encrypted = encryptStoredSecret('secret', PREFIX);
    expect(encrypted.startsWith(PREFIX)).toBe(true);
  });

  it('encrypted value contains three dot-separated base64 segments after the prefix', () => {
    const encrypted = encryptStoredSecret('secret', PREFIX);
    const payload = encrypted.slice(PREFIX.length);
    const parts = payload.split('.');
    expect(parts).toHaveLength(3);
    // Each part should be non-empty base64
    for (const part of parts) {
      expect(part.length).toBeGreaterThan(0);
    }
  });

  it('handles empty string plaintext', () => {
    // Empty plaintext produces an empty ciphertext segment; the parser
    // rejects it because an empty base64 string is falsy. Document this
    // known edge case rather than silently accepting it.
    const encrypted = encryptStoredSecret('', PREFIX);
    expect(() => decryptStoredSecret(encrypted, PREFIX)).toThrow('Invalid encrypted secret payload');
  });

  it('handles unicode / multibyte plaintext', () => {
    const plain = '日本語テスト 🔑 €£¥';
    const encrypted = encryptStoredSecret(plain, PREFIX);
    const decrypted = decryptStoredSecret(encrypted, PREFIX);
    expect(decrypted).toBe(plain);
  });

  it('handles long plaintexts (JSON blob)', () => {
    const plain = JSON.stringify({
      type: 'service_account',
      project_id: 'test-project',
      private_key: 'a'.repeat(512),
      client_email: 'test@test.iam.gserviceaccount.com',
    });
    const encrypted = encryptStoredSecret(plain, PREFIX);
    const decrypted = decryptStoredSecret(encrypted, PREFIX);
    expect(decrypted).toBe(plain);
  });

  it('throws on tampered ciphertext (auth tag mismatch)', () => {
    const encrypted = encryptStoredSecret('secret', PREFIX);
    // Corrupt the last character of the ciphertext segment
    const corrupted = encrypted.slice(0, -2) + 'AA';
    expect(() => decryptStoredSecret(corrupted, PREFIX)).toThrow();
  });

  it('throws on invalid payload format (missing dots)', () => {
    const invalid = `${PREFIX}notvalid`;
    expect(() => decryptStoredSecret(invalid, PREFIX)).toThrow('Invalid encrypted secret payload');
  });

  it('works with a different prefix', () => {
    const altPrefix = 'stripe_key_';
    const plain = 'sk_test_abc123';
    const encrypted = encryptStoredSecret(plain, altPrefix);
    expect(encrypted.startsWith(altPrefix)).toBe(true);
    const decrypted = decryptStoredSecret(encrypted, altPrefix);
    expect(decrypted).toBe(plain);
  });

  it('uses NEXTAUTH_SECRET as fallback key when GCP key absent', () => {
    delete process.env.GCP_CREDENTIALS_ENCRYPTION_KEY;
    process.env.NEXTAUTH_SECRET = 'fallback-nextauth-secret-key';
    const plain = 'test-with-fallback';
    const encrypted = encryptStoredSecret(plain, PREFIX);
    const decrypted = decryptStoredSecret(encrypted, PREFIX);
    expect(decrypted).toBe(plain);
    delete process.env.NEXTAUTH_SECRET;
  });
});
