import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createAssetDocument, ASSET_COLLECTION } from '../../src/models/asset.js';

const base = {
  id: 'asset_1',
  filename: 'photo.png',
  format: 'PNG',
  width: 100,
  height: 50,
  bytes: 2048,
  storageProvider: 'memory',
  storageKey: 'a/photo.png',
  tags: ['Nature', 'nature', ' Sky '],
};

test('createAssetDocument normalizes fields', () => {
  const fixedNow = () => new Date('2026-01-01T00:00:00.000Z');
  const doc = createAssetDocument(base, { now: fixedNow });
  assert.equal(doc.format, 'png');
  assert.deepEqual(doc.tags, ['nature', 'sky']);
  assert.equal(doc.ownerId, null);
  assert.equal(doc.createdAt, '2026-01-01T00:00:00.000Z');
  assert.equal(doc.updatedAt, doc.createdAt);
  assert.equal(ASSET_COLLECTION, 'assets');
});

test('createAssetDocument defaults tags and ownerId', () => {
  const doc = createAssetDocument({ ...base, tags: undefined, ownerId: 'u1' });
  assert.deepEqual(doc.tags, []);
  assert.equal(doc.ownerId, 'u1');
});

test('createAssetDocument validation', () => {
  assert.throws(() => createAssetDocument({ ...base, id: 'bad id' }));
  assert.throws(() => createAssetDocument({ ...base, filename: '' }), /filename/);
  assert.throws(() => createAssetDocument({ ...base, format: 'tiff' }), /unsupported/);
  assert.throws(() => createAssetDocument({ ...base, width: 0 }), /width/);
  assert.throws(() => createAssetDocument({ ...base, height: -1 }), /height/);
  assert.throws(() => createAssetDocument({ ...base, bytes: -1 }), /bytes/);
  assert.throws(() => createAssetDocument({ ...base, storageProvider: '' }), /storageProvider/);
  assert.throws(() => createAssetDocument({ ...base, storageKey: '' }), /storageKey/);
});
