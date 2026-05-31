import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  assertStorageKey,
  createMemoryStorageProvider,
  createStorageRegistry,
  createDefaultStorageRegistry,
} from '../../src/lib/storage/provider.js';

test('assertStorageKey accepts safe keys', () => {
  assert.equal(assertStorageKey('a/b/c.png'), 'a/b/c.png');
});

test('assertStorageKey rejects bad keys', () => {
  assert.throws(() => assertStorageKey(''), TypeError);
  assert.throws(() => assertStorageKey(123));
  assert.throws(() => assertStorageKey('/leading'));
  assert.throws(() => assertStorageKey('../escape'));
  assert.throws(() => assertStorageKey('back\\slash'));
  assert.throws(() => assertStorageKey('x'.repeat(1025)), RangeError);
});

test('memory provider round-trips put/get/remove', async () => {
  const p = createMemoryStorageProvider({ baseUrl: 'http://h/s/' });
  assert.equal(p.id, 'memory');
  await p.put('k/1.png', 'hello', { kind: 'test' });
  const got = await p.get('k/1.png');
  assert.equal(got.data.toString(), 'hello');
  assert.equal(got.meta.size, 5);
  assert.equal(got.meta.kind, 'test');
  assert.equal(await p.get('missing'), null);
  assert.equal(await p.getSignedUrl('k/1.png'), 'http://h/s/k/1.png');
  assert.equal(await p.remove('k/1.png'), true);
  assert.equal(await p.remove('k/1.png'), false);
});

test('memory provider accepts Buffer input', async () => {
  const p = createMemoryStorageProvider();
  await p.put('b.bin', Buffer.from([1, 2, 3]));
  const got = await p.get('b.bin');
  assert.equal(got.data.length, 3);
});

test('registry registers, resolves, lists', () => {
  const r = createStorageRegistry();
  const a = createMemoryStorageProvider();
  r.register(a);
  assert.deepEqual(r.list(), ['memory']);
  assert.equal(r.resolve(), a);
  assert.equal(r.resolve('memory'), a);
});

test('registry guards duplicates and bad input', () => {
  const r = createStorageRegistry();
  r.register(createMemoryStorageProvider());
  assert.throws(() => r.register(createMemoryStorageProvider()));
  assert.throws(() => r.register({}), TypeError);
});

test('registry resolve errors', () => {
  const empty = createStorageRegistry();
  assert.throws(() => empty.resolve());
  const r = createStorageRegistry();
  r.register(createMemoryStorageProvider());
  assert.throws(() => r.resolve('nope'));
});

test('default registry seeds memory provider', () => {
  const r = createDefaultStorageRegistry();
  assert.equal(r.resolve().id, 'memory');
});

test('non-default registration keeps first default', () => {
  const r = createStorageRegistry();
  const a = createMemoryStorageProvider();
  r.register(a, { default: true });
  // second provider with different id, not default
  const b = { ...createMemoryStorageProvider(), id: 'other' };
  r.register(b);
  assert.equal(r.resolve(), a);
  assert.equal(r.resolve('other'), b);
});
