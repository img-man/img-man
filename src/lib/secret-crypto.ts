// SPDX-License-Identifier: Apache-2.0
import crypto from 'crypto';

function getStoredSecretEncryptionKey() {
  const secret =
    process.env.GCP_CREDENTIALS_ENCRYPTION_KEY ||
    process.env.NEXTAUTH_SECRET ||
    process.env.AUTH_SECRET ||
    (process.env.NODE_ENV === 'production' ? '' : 'imgman-dev-gcp-credentials');

  if (!secret) {
    throw new Error(
      'Missing GCP_CREDENTIALS_ENCRYPTION_KEY or NEXTAUTH_SECRET for stored credential encryption',
    );
  }

  return crypto.createHash('sha256').update(secret).digest();
}

export function encryptStoredSecret(secretValue: string, prefix: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getStoredSecretEncryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(secretValue, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return `${prefix}${iv.toString('base64')}.${tag.toString('base64')}.${ciphertext.toString('base64')}`;
}

export function decryptStoredSecret(secretValue: string, prefix: string) {
  const payload = secretValue.slice(prefix.length);
  const [ivBase64, tagBase64, ciphertextBase64] = payload.split('.');

  if (!ivBase64 || !tagBase64 || !ciphertextBase64) {
    throw new Error('Invalid encrypted secret payload');
  }

  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    getStoredSecretEncryptionKey(),
    Buffer.from(ivBase64, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(tagBase64, 'base64'));

  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextBase64, 'base64')),
    decipher.final(),
  ]);

  return plaintext.toString('utf8');
}