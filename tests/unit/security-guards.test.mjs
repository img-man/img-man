import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  constantTimeEquals,
  parseBearerToken,
  redactSecrets,
  assertSafeAssetId,
} from '../../src/lib/security/guards.js';

test('constantTimeEquals', () => {
  assert.equal(constantTimeEquals('abc', 'abc'), true);
  assert.equal(constantTimeEquals('abc', 'abd'), false);
  assert.equal(constantTimeEquals('abc', 'abcd'), false);
  assert.equal(constantTimeEquals('', ''), true);
});

test('parseBearerToken', () => {
  assert.equal(parseBearerToken('Bearer xyz'), 'xyz');
  assert.equal(parseBearerToken('bearer  abc'), 'abc');
  assert.equal(parseBearerToken('Basic xyz'), null);
  assert.equal(parseBearerToken(null), null);
  assert.equal(parseBearerToken(123), null);
});

test('redactSecrets masks secret-like keys recursively', () => {
  const input = {
    user: 'bob',
    password: 'p',
    nested: { apiKey: 'k', token: 't', ok: 1 },
    list: [{ secret: 's' }, { fine: 2 }],
  };
  const out = redactSecrets(input);
  assert.equal(out.user, 'bob');
  assert.equal(out.password, '[redacted]');
  assert.equal(out.nested.apiKey, '[redacted]');
  assert.equal(out.nested.token, '[redacted]');
  assert.equal(out.nested.ok, 1);
  assert.equal(out.list[0].secret, '[redacted]');
  assert.equal(out.list[1].fine, 2);
});

test('redactSecrets custom mask and primitives', () => {
  assert.equal(redactSecrets('plain'), 'plain');
  assert.equal(redactSecrets(5), 5);
  const out = redactSecrets({ token: 'x' }, { mask: '***' });
  assert.equal(out.token, '***');
});

test('assertSafeAssetId', () => {
  assert.equal(assertSafeAssetId('asset_123-AB'), 'asset_123-AB');
  assert.throws(() => assertSafeAssetId('bad id'));
  assert.throws(() => assertSafeAssetId(''));
  assert.throws(() => assertSafeAssetId(5));
});
